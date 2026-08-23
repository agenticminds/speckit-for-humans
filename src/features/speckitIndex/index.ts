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

    const build = this.build(featureRoot).finally(() => this.inFlight.delete(featureRoot));
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

  private async build(featureRoot: string): Promise<SpeckitIndexPayload> {
    const files = new Map<string, DefinitionSite[]>();
    const artifacts = await listMarkdownFiles(featureRoot);

    for (const fsPath of artifacts) {
      const text = await readArtifact(fsPath);
      if (text !== null) {
        files.set(fsPath, extractDefinitions(text, fsPath));
      }
    }

    const cached: CachedIndex = { revision: this.nextRevision++, files, definitions: [] };
    cached.definitions = flatten(files);
    this.byRoot.set(featureRoot, cached);
    return { revision: cached.revision, featureRoot, definitions: cached.definitions };
  }
}

/**
 * Definitions in resolution order, capped.
 *
 * The consumer takes the FIRST entry for an identifier, so order encodes the
 * two precedence rules: within one artifact the first definition wins, and
 * across artifacts the search order is the artifact order here. Local scope is
 * authoritative, which is why feature-folder files sort ahead of anything
 * outside the folder.
 */
function flatten(files: Map<string, DefinitionSite[]>): DefinitionSite[] {
  const all: DefinitionSite[] = [];
  for (const fsPath of [...files.keys()].sort()) {
    all.push(...(files.get(fsPath) ?? []));
  }
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
