/**
 * Cross-feature qualifier binding (FR-017, FR-018).
 *
 * Stage 4 of the pipeline, and it cannot run before stage 3. By the time this
 * module sees the text, every identifier is already a token, which is the whole
 * reason `SC-006/SC-009` is safe: its `006` is inside a token and can never be
 * read as a feature number (C-tok-32).
 *
 * Pure. No file access, no VS Code API, no ProseMirror.
 *
 * The grammar is the one the corpus actually uses (R-025) — 68 occurrences:
 *
 *     QUALIFIER := (?<![0-9A-Za-z_-]) (\d{3}) (?:'s)? [ \t] (?=TOKEN)
 *
 * Two things this module must never do:
 *
 * 1. **Create a token.** It retargets what recognition already produced and
 *    returns exactly as many tokens as it was handed (C-tok-31). A qualifier
 *    with no identifier after it is not a reference to anything.
 * 2. **Bind a feature it cannot vouch for.** `knownFeatures` is supplied by the
 *    caller and lists the three-digit numbers of sibling directories that
 *    genuinely exist. The default is EMPTY, so the failure mode of a caller that
 *    forgets to supply it is "nothing is cross-feature", never "this reference
 *    silently means some other feature" (FR-018).
 *
 * The slash form `003/FR-004` is deliberately unsupported (C-tok-33). It occurs
 * zero times across 508 files, while 132 real abbreviated slash groups would be
 * put at risk by parsing it.
 */

import type { IdToken } from './tokenizer';

export interface QualifierOptions {
  /**
   * Three-digit numbers of sibling feature directories that exist.
   *
   * Existence is a file-system question and this module is pure, so the answer
   * arrives as data. Omitting it binds nothing.
   */
  readonly knownFeatures?: Iterable<string>;
}

/** Exactly three digits — the same rule feature-folder discovery applies. */
const QUALIFIER_LENGTH = 3;

/**
 * Characters that block the qualifier's LEFT edge.
 *
 * This is what keeps `1024 FR-001` and `v008 FR-P07` out, and — because a
 * hyphen is included — what stops the `006` of `SC-006 FR-009` from binding the
 * identifier after it.
 */
const BLOCKS_LEFT = /[0-9A-Za-z_-]/;

/** The single space or tab between the number and the identifier. */
const GAP = /[ \t]/;

/** Straight and typographic apostrophes, for the possessive form. */
const APOSTROPHES = "'’";

/**
 * The three-digit feature number written immediately before `tokenFrom`, or
 * null.
 *
 * Read right to left rather than by matching a regex against a prefix slice, so
 * the cost is constant per token instead of linear in the text before it.
 */
function qualifierBefore(text: string, tokenFrom: number): string | null {
  let index = tokenFrom - 1;
  if (index < 0 || !GAP.test(text.charAt(index))) {
    return null;
  }
  index--;

  // `026's FR-030`, and the typographic apostrophe an editor substitutes.
  if (index >= 1 && text.charAt(index) === 's' && APOSTROPHES.includes(text.charAt(index - 1))) {
    index -= 2;
  }

  const end = index + 1;
  const start = end - QUALIFIER_LENGTH;
  if (start < 0) {
    return null;
  }
  const digits = text.slice(start, end);
  if (!/^\d{3}$/.test(digits)) {
    return null;
  }
  // Exactly three digits, so a longer run is not silently truncated to a
  // feature number (C-tok-30).
  if (start > 0 && BLOCKS_LEFT.test(text.charAt(start - 1))) {
    return null;
  }
  return digits;
}

/**
 * The same tokens, with cross-feature ones retargeted.
 *
 * The input array is never mutated: a retargeted token is a new object, and an
 * unbound one is passed through by reference.
 *
 * An `expanded` token inherits the qualifier of the token before it. That is
 * not a second binding rule but a consequence of what `expanded` means — such a
 * token exists only as the abbreviated continuation of the chain head directly
 * before it, so `spec 026's FR-030–034` names two identifiers in feature 026
 * rather than one there and one here. A fully-qualified chain member is
 * `anchored` and is not carried, because it is indistinguishable here from an
 * unrelated identifier that merely follows.
 */
export function bindQualifiers(
  text: string,
  tokens: readonly IdToken[],
  options: QualifierOptions = {}
): IdToken[] {
  const known = new Set(options.knownFeatures ?? []);
  if (known.size === 0) {
    return [...tokens];
  }

  const bound: IdToken[] = [];
  let carried: string | null = null;

  for (const token of tokens) {
    const qualifier = qualifierBefore(text, token.from);
    let target: string | null = null;

    if (qualifier !== null && known.has(qualifier)) {
      target = qualifier;
    } else if (qualifier === null && token.origin === 'expanded') {
      target = carried;
    }

    carried = target;
    bound.push(target === null ? token : { ...token, featureQualifier: target });
  }

  return bound;
}

/**
 * Every three-digit number that qualifies a token in this text, in order of
 * first appearance.
 *
 * The host asks this to learn which sibling features a document actually names,
 * so it can index those and only those (FR-017). Deliberately NOT filtered by
 * `knownFeatures`: this is the question that precedes knowing, and the caller
 * answers it by looking for the directory.
 */
export function collectQualifierCandidates(text: string, tokens: readonly IdToken[]): string[] {
  const seen = new Set<string>();
  for (const token of tokens) {
    const qualifier = qualifierBefore(text, token.from);
    if (qualifier !== null) {
      seen.add(qualifier);
    }
  }
  return [...seen];
}
