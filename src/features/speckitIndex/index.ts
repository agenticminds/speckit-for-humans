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
import type { FeatureScope } from './discovery';

/** The `speckitIndex` push payload, less its `type` tag (C-msg-2). */
export interface SpeckitIndexPayload {
  readonly revision: number;
  readonly featureRoot: string | null;
  readonly definitions: readonly DefinitionSite[];
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
}

const EMPTY: SpeckitIndexPayload = { revision: 0, featureRoot: null, definitions: [] };

export class SpeckitIndexStore {
  private readonly byRoot = new Map<string, CachedIndex>();
  private inFlight = new Map<string, Promise<SpeckitIndexPayload>>();
  private nextRevision = 1;

  /**
   * The index for a scope, building it on first ask.
   *
   * Revisions are drawn from one counter across every feature root, so the
   * sequence a webview sees is monotonic even when it is shown documents from
   * different folders in turn (C-msg-2c).
   */
  async getIndex(scope: FeatureScope): Promise<SpeckitIndexPayload> {
    const featureRoot = scope.featureRoot;
    if (!featureRoot) {
      // No feature folder means link nothing (FR-019, C-msg-2b). Still carries a
      // revision, so the webview can tell "told to link nothing" apart from
      // "never heard from the host".
      return { ...EMPTY, revision: this.nextRevision++ };
    }

    const briefsDir = scope.briefsDir;
    const cached = this.byRoot.get(featureRoot);
    if (cached) {
      return { revision: cached.revision, featureRoot, definitions: cached.definitions };
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
   */
  invalidateFile(fsPath: string): void {
    for (const [featureRoot, cached] of this.byRoot) {
      if (cached.files.delete(fsPath)) {
        this.byRoot.delete(featureRoot);
      }
    }
  }

  dispose(): void {
    this.byRoot.clear();
    this.inFlight.clear();
  }

  private async build(featureRoot: string, briefsDir: string | null): Promise<SpeckitIndexPayload> {
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
      const text = await readArtifact(fsPath);
      if (text !== null) {
        files.set(fsPath, extractDefinitions(text, fsPath));
      }
    }

    const cached: CachedIndex = { revision: this.nextRevision++, files, definitions: [] };
    cached.definitions = flatten(files, featureRoot);
    this.byRoot.set(featureRoot, cached);
    return { revision: cached.revision, featureRoot, definitions: cached.definitions };
  }
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

async function readArtifact(fsPath: string): Promise<string | null> {
  try {
    const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(fsPath));
    return Buffer.from(bytes).toString('utf8');
  } catch {
    return null;
  }
}
