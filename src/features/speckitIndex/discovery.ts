/**
 * Feature-folder discovery (FR-019).
 *
 * Pure path arithmetic: no file system access, no VS Code API beyond the shape
 * of a URI. That is deliberate — discovery is on the hot path for every document
 * that opens, and a stat per ancestor would cost more than the whole feature.
 *
 * A feature folder is identified by its NUMBERED NAME and by nothing else.
 *
 * - Not by containing `spec.md`. Three of the 45 feature folders in the survey
 *   have none, and one of those still defines an identifier.
 * - Not by `.specify/feature.json`. That records one *active* feature, so it
 *   would mis-resolve 44 of 45 folders, and it is absent entirely in a workspace
 *   that is not a spec-kit project.
 */

import * as path from 'path';

/** A URI, reduced to the two fields discovery actually reads. */
export interface UriLike {
  readonly fsPath: string;
  readonly scheme: string;
}

export interface FeatureScope {
  /** Nearest ancestor whose basename matches `NNN-`, or null. */
  readonly featureRoot: string | null;
  /** Parent of `featureRoot`. Sibling features and the shared briefs folder live here. */
  readonly specsRoot: string | null;
}

const NONE: FeatureScope = { featureRoot: null, specsRoot: null };

/**
 * Exactly three digits, then a hyphen.
 *
 * Three is not a stylistic choice. A looser `\d+-` admits date-prefixed folders
 * and ordinary numbered directories; a two-digit form appears nowhere in the
 * corpus. A cross-feature qualifier is written as three digits too, so the two
 * rules have to agree or a qualified reference could name a folder that
 * discovery would not recognise as a feature.
 */
const FEATURE_DIR = /^\d{3}-/;

/**
 * The feature scope a document belongs to, from its path alone.
 *
 * Returns nulls — meaning nothing in the document may be linked — for any
 * non-`file` scheme, including `untitled`. A document not yet saved to disk
 * belongs to no folder, however many spec-kit folders exist elsewhere in the
 * workspace (FR-019).
 */
export function discoverFeatureScope(uri: UriLike | null | undefined): FeatureScope {
  if (!uri || uri.scheme !== 'file' || typeof uri.fsPath !== 'string' || uri.fsPath === '') {
    return NONE;
  }

  let current = path.dirname(path.resolve(uri.fsPath));
  // Walk ancestors, nearest first. `path.dirname` of a root returns the root
  // itself, which is the loop's terminating condition.
  for (;;) {
    if (FEATURE_DIR.test(path.basename(current))) {
      return { featureRoot: current, specsRoot: path.dirname(current) };
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return NONE;
    }
    current = parent;
  }
}

/**
 * May this path be read on behalf of that scope? (C-msg-3e)
 *
 * The gate is the feature root plus the specs root — the latter because a
 * cross-feature qualifier legitimately reaches a sibling feature, and because
 * the shared briefs folder sits beside the feature folders rather than inside
 * one.
 *
 * `getAllowedFileRoots` is deliberately NOT reused here. It is anchored on the
 * workspace folders, and a briefs folder can legitimately sit outside the
 * workspace, so that gate would reject a legitimate read while this one does
 * not. The two answer different questions.
 *
 * The candidate is resolved before comparison, so a traversal segment inside a
 * qualifier collapses and is then measured against the roots like anything else.
 */
export function isWithinFeatureScope(candidate: string, scope: FeatureScope): boolean {
  if (!scope.featureRoot && !scope.specsRoot) {
    return false;
  }

  const target = path.resolve(candidate);
  return [scope.featureRoot, scope.specsRoot].some(root => {
    if (!root) {
      return false;
    }
    const resolved = path.resolve(root);
    // The separator matters: without it `/w/specs-private` would pass a
    // containment check against `/w/specs`.
    return target === resolved || target.startsWith(resolved + path.sep);
  });
}
