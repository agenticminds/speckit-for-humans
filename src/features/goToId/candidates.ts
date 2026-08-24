/**
 * Which feature folders should this navigation search, and in what order?
 *
 * The editor's own linking is scoped to the feature folder of the document you
 * are reading (`discoverFeatureScope`). That is right for links, because a
 * document can only link what it can see. It is wrong for this command, which
 * is invoked precisely when you are NOT reading a document — you are looking at
 * an AI assistant panel, or a terminal, and there may be no markdown open at
 * all.
 *
 * So the chain widens step by step, cheapest and most specific first:
 *
 *   1. the active document's feature folder
 *   2. the last feature folder you had open this session
 *   3. spec-kit's own pointer, `.specify/feature.json`
 *   4. every feature folder under `specs/`
 *
 * Spec Kit stops after its equivalent of step 3 and errors. Step 4 is ours. An
 * error saying "no feature context available" is a worse answer than a picker
 * listing every identifier in the workspace, because the second one is still a
 * way to get where you were going.
 *
 * Pure path arithmetic, like `discoverFeatureScope` and for the same reason:
 * ordering must be testable without a file system.
 */

import * as path from 'path';

/** Where a candidate feature folder came from, for logging and for tests. */
export type CandidateSource = 'activeDocument' | 'lastDocument' | 'featureJson' | 'allFeatures';

export interface ScopeCandidate {
  /** Absolute path of the feature folder. */
  readonly featureRoot: string;
  readonly source: CandidateSource;
}

export interface CandidateInputs {
  /** Feature root of the document in the active editor, if any. */
  readonly activeFeatureRoot?: string | null;
  /** Feature root of the last spec-kit document seen this session, if any. */
  readonly lastFeatureRoot?: string | null;
  /**
   * `feature_directory` from `.specify/feature.json`, already resolved to an
   * absolute path. Spec-kit stores it relative to the project root.
   */
  readonly featureJsonRoot?: string | null;
  /** Every `NNN-` folder found under the workspace's `specs/` directories. */
  readonly allFeatureRoots?: readonly string[];
}

/**
 * The chain, deduplicated, most specific first.
 *
 * A folder that appears at two priorities is listed once, at the higher one.
 * That matters: the active document's folder is nearly always also in
 * `allFeatureRoots`, and searching it twice would double every result in the
 * picker.
 *
 * Paths are normalized before comparison so `specs/001-x` and `specs/./001-x`
 * are recognised as the same folder.
 */
export function orderScopeCandidates(inputs: CandidateInputs): ScopeCandidate[] {
  const ordered: ScopeCandidate[] = [];
  const seen = new Set<string>();

  const add = (raw: string | null | undefined, source: CandidateSource): void => {
    if (typeof raw !== 'string' || raw.trim() === '') {
      return;
    }
    const featureRoot = path.resolve(raw);
    if (seen.has(featureRoot)) {
      return;
    }
    seen.add(featureRoot);
    ordered.push({ featureRoot, source });
  };

  add(inputs.activeFeatureRoot, 'activeDocument');
  add(inputs.lastFeatureRoot, 'lastDocument');
  add(inputs.featureJsonRoot, 'featureJson');
  for (const root of inputs.allFeatureRoots ?? []) {
    add(root, 'allFeatures');
  }

  return ordered;
}

/**
 * Exactly three digits then a hyphen — the same rule `discoverFeatureScope`
 * uses, and deliberately not a looser one. The two must agree, or this command
 * would offer to navigate into a folder the editor does not consider a feature.
 */
const FEATURE_DIR = /^\d{3}-/;

/** Is this folder name a spec-kit feature folder? */
export function isFeatureDirName(name: string): boolean {
  return FEATURE_DIR.test(name);
}
