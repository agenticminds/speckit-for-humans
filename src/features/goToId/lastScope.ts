/**
 * The last spec-kit feature folder the user actually had open.
 *
 * Step 2 of the candidate chain. It exists because the moment you most want to
 * jump to `T042` is the moment you are looking at an AI assistant panel rather
 * than at a markdown file — so `window.activeTextEditor` is empty, and the
 * feature you were working in a second ago is otherwise forgotten.
 *
 * Module state rather than a class, matching `activeWebview` next door. There
 * is one window, one user, and one "where was I".
 */

let lastFeatureRoot: string | null = null;

/** Record a feature folder as the most recent one. Nulls are ignored. */
export function rememberFeatureRoot(featureRoot: string | null | undefined): void {
  if (typeof featureRoot === 'string' && featureRoot !== '') {
    lastFeatureRoot = featureRoot;
  }
}

export function getLastFeatureRoot(): string | null {
  return lastFeatureRoot;
}

/** Test seam. Production code never needs to forget. */
export function resetLastFeatureRoot(): void {
  lastFeatureRoot = null;
}
