/**
 * The definition index (FR-015).
 *
 * One index per feature root, held on the PROVIDER instance rather than in a
 * per-panel closure. Two documents from one feature folder must share it: the
 * per-panel alternative means N copies of the same 60KB payload, N sets of file
 * reads, and — once live refresh lands — N listeners each blind to the others.
 *
 * Extension host only. The webview's content security policy is
 * `default-src 'none'`; it cannot read a file even if handed a path.
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { extractDefinitions, type DefinitionSite } from './extract';
import { ID_FAMILIES } from '../../shared/speckitIds/families';
import { isWithinFeatureScope, type FeatureScope } from './discovery';
import { hostStageTimings } from '../../shared/perf/stageTimings';

/** One sibling feature a document named with a cross-feature qualifier (FR-017). */
export interface QualifiedFeatureIndex {
  /** The three-digit number as written in the document. */
  readonly feature: string;
  readonly featureRoot: string;
  readonly definitions: readonly DefinitionSite[];
}

/** The `speckitIndex` push payload, less its `type` tag (C-msg-2). */
export interface SpeckitIndexPayload {
  readonly revision: number;
  readonly featureRoot: string | null;
  readonly definitions: readonly DefinitionSite[];
  /**
   * Sibling features this document qualified by number, indexed ON DEMAND.
   *
   * Empty for the overwhelming majority of documents, which name no other
   * feature. Nothing here is reachable from an unqualified reference — that is
   * FR-018, and it is why these definitions travel in their own bucket rather
   * than merged into `definitions`.
   */
  readonly qualified: readonly QualifiedFeatureIndex[];
}

/**
 * Upper bound on definitions in one payload.
 *
 * Follows the existing search-result cap precedent. The largest real feature
 * folder holds 854 definitions, so this is roughly six times the observed
 * maximum — high enough never to bite in practice, low enough that a runaway
 * folder cannot push a multi-megabyte message. Truncation is LOGGED, because a
 * silent one reads to the user as "no such identifier" (C-msg-2h).
 */
export const DEFINITION_CAP = 5000;

/** Guards against walking a pathological tree. Feature folders are shallow. */
const MAX_DEPTH = 8;

interface CachedIndex {
  revision: number;
  /** Per artifact, so a single changed file can be re-extracted on its own. */
  readonly files: Map<string, DefinitionSite[]>;
  definitions: DefinitionSite[];
  /**
   * The briefs folder this index was built with, remembered so a refresh can
   * tell that a changed file BELONGS to this root even though it sits outside
   * the feature folder (FR-016). Recomputing it from the path is not possible:
   * `briefs/` matches no feature-folder grammar.
   */
  readonly briefsDir: string | null;
}

const EMPTY: SpeckitIndexPayload = {
  revision: 0,
  featureRoot: null,
  definitions: [],
  qualified: [],
};

/**
 * Upper bound on sibling features indexed for one document.
 *
 * The busiest real document names three. The cap exists so a file that happens
 * to be full of three-digit numbers cannot turn one push into forty folder
 * walks.
 */
const MAX_QUALIFIED_FEATURES = 8;

/** A qualifier as written, and as feature-folder discovery spells it. */
const QUALIFIER = /^\d{3}$/;
const FEATURE_DIR_NUMBER = /^(\d{3})-/;

export class SpeckitIndexStore {
  private readonly byRoot = new Map<string, CachedIndex>();
  private inFlight = new Map<string, Promise<CachedIndex>>();
  private nextRevision = 1;
  /**
   * Revision issued for one composition of indexes, keyed by the roots AND
   * their revisions.
   *
   * A push carries the document's own feature plus whichever siblings it
   * qualified, so the same folder can legitimately be sent to two panels with
   * two different contents. The webview drops a revision it has already seen,
   * so re-sending an unchanged composition must reuse its number — and a
   * composition that differs in any part must get a new one.
   */
  private readonly composedRevisions = new Map<string, number>();
  /** Highest revision issued for a root, so a push for it can never go back. */
  private readonly lastIssued = new Map<string, number>();

  /**
   * The index for a scope, building it on first ask.
   *
   * Revisions are drawn from one counter across every feature root, so the
   * sequence a webview sees is monotonic even when it is shown documents from
   * different folders in turn (C-msg-2c).
   *
   * `qualifiers` lists the three-digit feature numbers this document actually
   * names (FR-017). Each is resolved to a sibling directory and indexed ON
   * DEMAND — the alternative, indexing every feature in the workspace, is 45
   * folder walks for a benefit almost no document asks for. A number that names
   * no directory, or that resolves outside the feature and specs roots, is
   * dropped without a word.
   */
  async getIndex(
    scope: FeatureScope,
    qualifiers: readonly string[] = []
  ): Promise<SpeckitIndexPayload> {
    const featureRoot = scope.featureRoot;
    if (!featureRoot) {
      // No feature folder means link nothing (FR-019, C-msg-2b). Still carries a
      // revision, so the webview can tell "told to link nothing" apart from
      // "never heard from the host".
      return { ...EMPTY, revision: this.nextRevision++ };
    }

    const own = await this.ensure(featureRoot, scope.briefsDir);
    const qualified = await this.resolveQualified(scope, qualifiers);

    const key = [
      `${featureRoot}@${own.revision}`,
      ...qualified.map(entry => `${entry.feature}:${entry.featureRoot}@${entry.revision}`),
    ].join('|');

    return {
      revision: this.revisionFor(featureRoot, key),
      featureRoot,
      definitions: own.definitions,
      qualified: qualified.map(entry => ({
        feature: entry.feature,
        featureRoot: entry.featureRoot,
        definitions: entry.definitions,
      })),
    };
  }

  /** Drop a whole feature root, e.g. when its last panel closes. */
  invalidate(featureRoot: string): void {
    this.byRoot.delete(featureRoot);
  }

  /**
   * Forget one artifact, so the next ask re-reads it.
   *
   * Whole-folder invalidation would be simpler and much more expensive: the
   * steady-state cost of re-extracting one changed file is ~0.3ms against 3.5ms
   * for the largest real folder.
   *
   * @returns whether any root actually held it, so a caller can tell a stale
   *   entry apart from a path no index has ever seen.
   */
  invalidateFile(fsPath: string): boolean {
    let dropped = false;
    for (const [featureRoot, cached] of this.byRoot) {
      if (cached.files.delete(fsPath)) {
        this.byRoot.delete(featureRoot);
        dropped = true;
      }
    }
    return dropped;
  }

  /**
   * Re-read and re-extract ONE artifact in place, in every root that holds it
   * (FR-025).
   *
   * The cheap half of freshness. Dropping the root and rebuilding costs a
   * directory walk plus a read of every artifact — 3.5ms for the largest real
   * feature folder, on every debounce tick while someone types. Re-extracting
   * the one file that changed is ~0.3ms steady-state and reads exactly one file.
   *
   * A file that reads as nothing is REMOVED rather than left behind, so a
   * deleted artifact stops defining anything. A file that no root has seen but
   * that lies under a root — a newly created artifact — is added.
   *
   * The revision is advanced on every root touched, because the webview treats
   * a revision that does not move forward as a duplicate to drop, or worse, as
   * link-nothing (C-msg-2c, C-msg-2d).
   *
   * @returns the feature roots whose index changed, so their panels can be
   *   pushed to and no others (C-msg-2f).
   */
  async refreshFile(fsPath: string): Promise<readonly string[]> {
    if (!fsPath.toLowerCase().endsWith('.md')) {
      return [];
    }

    const touched: string[] = [];
    for (const [featureRoot, cached] of this.byRoot) {
      const known = cached.files.has(fsPath);
      if (!known && !belongsTo(fsPath, featureRoot, cached.briefsDir)) {
        continue;
      }

      const text = await hostStageTimings.measureAsync('read', () => readArtifact(fsPath));
      if (text === null) {
        if (!known) {
          // Neither on disk nor previously indexed: nothing to refresh, and
          // nothing to announce.
          continue;
        }
        cached.files.delete(fsPath);
      } else {
        cached.files.set(
          fsPath,
          hostStageTimings.measure('extract', () => extractDefinitions(text, fsPath))
        );
      }

      cached.definitions = hostStageTimings.measure('resolve', () =>
        flatten(cached.files, featureRoot)
      );
      cached.revision = this.nextRevision++;
      touched.push(featureRoot);
    }
    // SC-009. Throttled inside, so a burst of debounced refreshes while someone
    // types produces one line rather than one per keystroke.
    hostStageTimings.report('index refresh');
    return touched;
  }

  dispose(): void {
    this.byRoot.clear();
    this.inFlight.clear();
    this.composedRevisions.clear();
    this.lastIssued.clear();
  }

  /**
   * The revision to send for one composition of indexes.
   *
   * Reused when the same composition is sent again, so an unchanged push is a
   * duplicate the webview can drop. Re-issued whenever the cached number would
   * be lower than one already sent for this root — which happens when a
   * document's qualifier set goes back to a combination seen earlier, and which
   * the webview would otherwise read as a backwards revision and treat as
   * "link nothing" (C-msg-2c, C-msg-2d).
   */
  private revisionFor(featureRoot: string, key: string): number {
    const cached = this.composedRevisions.get(key);
    const highest = this.lastIssued.get(featureRoot) ?? 0;
    if (cached !== undefined && cached >= highest) {
      return cached;
    }
    const revision = this.nextRevision++;
    this.composedRevisions.set(key, revision);
    this.lastIssued.set(featureRoot, revision);
    return revision;
  }

  /** The cached index for a root, building it once however many ask at once. */
  private async ensure(featureRoot: string, briefsDir: string | null): Promise<CachedIndex> {
    const cached = this.byRoot.get(featureRoot);
    if (cached) {
      return cached;
    }

    // Collapse concurrent first-opens of two documents in one folder into a
    // single set of reads.
    const existing = this.inFlight.get(featureRoot);
    if (existing) {
      return existing;
    }

    const build = this.build(featureRoot, briefsDir).finally(() =>
      this.inFlight.delete(featureRoot)
    );
    this.inFlight.set(featureRoot, build);
    return build;
  }

  /**
   * Index the sibling features this document named, and only those (FR-017).
   *
   * A sibling is indexed exactly as it would be if the user opened it — same
   * briefs folder, same cache entry — so a document that qualifies feature 008
   * and a document that lives inside feature 008 share one index rather than
   * disagreeing about it.
   *
   * Three gates, all silent on failure: the qualifier must be three digits, it
   * must name a real `NNN-` directory beside this feature, and the directory
   * must lie inside the derived roots. The last is what a traversal attempt
   * written into a qualifier runs into (C-msg-3e).
   */
  private async resolveQualified(
    scope: FeatureScope,
    qualifiers: readonly string[]
  ): Promise<Array<CachedIndex & { feature: string; featureRoot: string }>> {
    const specsRoot = scope.specsRoot;
    const wanted = [...new Set(qualifiers)].filter(value => QUALIFIER.test(value));
    if (!specsRoot || wanted.length === 0) {
      return [];
    }

    // Listed per push rather than cached: it is one directory read, and a cache
    // would go stale the moment a new feature folder is created.
    const siblings = await listFeatureDirectories(specsRoot);
    const resolved: Array<CachedIndex & { feature: string; featureRoot: string }> = [];

    for (const feature of wanted.slice(0, MAX_QUALIFIED_FEATURES)) {
      const root = siblings.get(feature);
      // A qualifier naming this document's own feature is not cross-feature;
      // its definitions are already in `definitions`.
      if (!root || root === scope.featureRoot || !isWithinFeatureScope(root, scope)) {
        continue;
      }
      const index = await this.ensure(root, scope.briefsDir);
      resolved.push({ ...index, feature, featureRoot: root });
    }

    return resolved;
  }

  private async build(featureRoot: string, briefsDir: string | null): Promise<CachedIndex> {
    const files = new Map<string, DefinitionSite[]>();
    // The briefs folder is a SIBLING of the feature folder, so a walk rooted at
    // the feature folder never reaches it. `BR-`, `AD-` and `OQ-` are defined
    // there and cited from inside feature folders — 90 and 42 such references
    // in the survey — so omitting it leaves those families permanently
    // unresolved (FR-016). A briefs folder that does not exist lists as empty.
    const artifacts = [
      ...(await listMarkdownFiles(featureRoot)),
      ...(briefsDir ? await listMarkdownFiles(briefsDir) : []),
    ];

    for (const fsPath of artifacts) {
      // Read and extract are timed SEPARATELY and never as one number (SC-009).
      // Extraction is 3.5ms for the largest real folder; the reads around it are
      // where the cost actually lives, and a combined figure hides which moved.
      const text = await hostStageTimings.measureAsync('read', () => readArtifact(fsPath));
      if (text !== null) {
        files.set(
          fsPath,
          hostStageTimings.measure('extract', () => extractDefinitions(text, fsPath))
        );
      }
    }

    const cached: CachedIndex = {
      revision: this.nextRevision++,
      files,
      definitions: [],
      briefsDir,
    };
    cached.definitions = hostStageTimings.measure('resolve', () => flatten(files, featureRoot));
    this.byRoot.set(featureRoot, cached);
    hostStageTimings.report('index build');
    return cached;
  }
}

/**
 * The numbered feature folders beside a feature, by their three-digit number.
 *
 * Same rule as discovery: a feature folder is identified by its NUMBERED NAME
 * and by nothing else, so the qualifier grammar and the folder grammar cannot
 * drift apart.
 */
async function listFeatureDirectories(specsRoot: string): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  let entries: Array<[string, vscode.FileType]>;
  try {
    entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(specsRoot));
  } catch {
    return found;
  }

  for (const [name, type] of entries) {
    if (type !== vscode.FileType.Directory) {
      continue;
    }
    const number = FEATURE_DIR_NUMBER.exec(name)?.[1];
    // First wins, so two folders sharing a number resolve deterministically.
    if (number && !found.has(number)) {
      found.set(number, path.join(specsRoot, name));
    }
  }
  return found;
}

/**
 * The artifacts that may define this identifier's family, in search order.
 *
 * A family names an ordered candidate LIST, never a single owner (FR-015). The
 * survey's table reads as one artifact per family, but `Q` is defined in
 * `briefs/` and referenced from `research.md`, and `P-APP-DIR` is defined in
 * both `briefs/` and a feature's `research.md`.
 *
 * An identifier belonging to no family — which the extractor cannot produce,
 * since it uses the same recognizer — yields an empty list and therefore ranks
 * every artifact equally.
 */
function candidateArtifactsFor(id: string): readonly string[] {
  for (const family of ID_FAMILIES) {
    family.pattern.lastIndex = 0;
    const match = family.pattern.exec(id);
    if (match && match[0] === id) {
      return family.owningArtifacts;
    }
  }
  return [];
}

/**
 * How early this artifact appears in the family's candidate list.
 *
 * A file the family does not name still ranks — last, not never. The list is a
 * search order, not a filter: a research identifier defined in a `data-model.md`
 * sidecar must still resolve, just behind `research.md` if both define it.
 */
function artifactRank(fsPath: string, featureRoot: string, candidates: readonly string[]): number {
  const relative = path.relative(featureRoot, fsPath);
  const segments = relative.split(path.sep);
  const base = segments[segments.length - 1];

  for (let index = 0; index < candidates.length; index++) {
    const candidate = candidates[index];
    const matched = candidate.endsWith('/')
      ? segments.slice(0, -1).includes(candidate.slice(0, -1))
      : base === candidate;
    if (matched) {
      return index;
    }
  }
  return candidates.length;
}

/** Feature-folder files sort ahead of the shared briefs folder. */
function locality(fsPath: string, featureRoot: string): number {
  const relative = path.relative(featureRoot, fsPath);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative) ? 0 : 1;
}

/**
 * Definitions in resolution order, capped.
 *
 * The consumer takes the FIRST entry for an identifier, so this order IS the
 * resolution policy, and it encodes three rules in priority order:
 *
 * 1. Local scope is authoritative — a feature-folder definition beats the
 *    briefs one even for a family whose declared home is `briefs/`. `P-APP-DIR`
 *    is genuinely defined in both places in the corpus.
 * 2. Within one locality, the family's candidate artifact list decides. Plain
 *    alphabetical order would resolve `FR-001` into `contracts/` and `T042`
 *    into `plan.md`, since both sort ahead of their owning artifact.
 * 3. Within one artifact, the first definition wins.
 *
 * Sorting by a key tuple rather than by grouped file order is what lets rules 1
 * and 2 disagree about file order for two different families in the same pair
 * of files — which they do, and which a single file ordering cannot express.
 */
function flatten(files: Map<string, DefinitionSite[]>, featureRoot: string): DefinitionSite[] {
  const all: DefinitionSite[] = [];
  for (const fsPath of [...files.keys()].sort()) {
    all.push(...(files.get(fsPath) ?? []));
  }

  const ranks = new Map<string, number>();
  const keyed = all.map(site => {
    const cacheKey = `${site.id}\u0000${site.fsPath}`;
    let rank = ranks.get(cacheKey);
    if (rank === undefined) {
      rank = artifactRank(site.fsPath, featureRoot, candidateArtifactsFor(site.id));
      ranks.set(cacheKey, rank);
    }
    return { site, locality: locality(site.fsPath, featureRoot), rank };
  });

  keyed.sort(
    (a, b) =>
      a.locality - b.locality ||
      a.rank - b.rank ||
      (a.site.fsPath < b.site.fsPath ? -1 : a.site.fsPath > b.site.fsPath ? 1 : 0) ||
      a.site.line - b.site.line
  );
  all.length = 0;
  all.push(...keyed.map(entry => entry.site));
  if (all.length > DEFINITION_CAP) {
    console.warn(
      `[MD4H] Spec-kit definition cap reached: ${all.length} found, keeping ${DEFINITION_CAP}. ` +
        'Identifiers beyond the cap will read as undefined.'
    );
    return all.slice(0, DEFINITION_CAP);
  }
  return all;
}

/** Every `.md` under a root, recursively. Contracts live one level down. */
async function listMarkdownFiles(root: string, depth = 0): Promise<string[]> {
  if (depth > MAX_DEPTH) {
    return [];
  }
  let entries: Array<[string, vscode.FileType]>;
  try {
    entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(root));
  } catch {
    // A folder that cannot be listed contributes nothing. Never a dialog: an
    // unreadable artifact must degrade to "that identifier is undefined"
    // (FR-010, SC-007).
    return [];
  }

  const found: string[] = [];
  for (const [name, type] of entries) {
    if (name.startsWith('.') || name === 'node_modules') {
      continue;
    }
    const full = path.join(root, name);
    if (type === vscode.FileType.Directory) {
      found.push(...(await listMarkdownFiles(full, depth + 1)));
    } else if (name.toLowerCase().endsWith('.md')) {
      found.push(full);
    }
  }
  return found;
}

/** Is this path inside the feature folder, or inside its briefs folder? */
function belongsTo(fsPath: string, featureRoot: string, briefsDir: string | null): boolean {
  return [featureRoot, briefsDir].some(root => {
    if (!root) {
      return false;
    }
    const resolved = path.resolve(root);
    // The separator matters: without it `/w/specs/001-a` would swallow
    // `/w/specs/001-are-you-sure`.
    return path.resolve(fsPath).startsWith(resolved + path.sep);
  });
}

/**
 * An artifact's CURRENT text: the editor's copy if it has one, disk otherwise
 * (FR-025).
 *
 * An open document may hold unsaved edits, and quickstart scenario 6 turns on
 * exactly that: type a definition into `spec.md` without saving and a reference
 * in `tasks.md` must link within two seconds. Reading disk here is the single
 * most likely defect in this component, and it fails silently — the on-disk half
 * of freshness keeps working, so it looks half-fixed rather than broken.
 *
 * `openTextDocument` is deliberately NOT called. It would make the index OPEN
 * every artifact in the feature folder and the briefs folder, turning a read
 * into an editor-model allocation apiece; `textDocuments` lists what is already
 * open and costs nothing.
 */
async function readArtifact(fsPath: string): Promise<string | null> {
  const open = (vscode.workspace.textDocuments ?? []).find(
    document => document.uri.scheme === 'file' && document.uri.fsPath === fsPath
  );
  if (open) {
    return open.getText();
  }

  try {
    const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(fsPath));
    return Buffer.from(bytes).toString('utf8');
  } catch {
    return null;
  }
}
