/**
 * The anchored scanner: plain text in, identifier tokens out.
 *
 * Pure. No file access, no VS Code API, no ProseMirror. Both runtimes use it,
 * so both agree on what an identifier is.
 *
 * This is stage 1 and stage 2 of the six-stage pipeline. Node-level exclusion
 * of code spans, code blocks and existing links is stage 0 and belongs to the
 * caller, because markdown structure is invisible to a text scanner. Expansion
 * of compressed references and cross-feature qualifier binding are stages 3 and
 * 4 and live in their own modules.
 */

import { extractPrefix, hasValidLeftBoundary, hasValidRightBoundary } from './boundaries';
import { FAMILY_PREFIXES, ID_FAMILIES, type IdFamily } from './families';

export interface IdToken {
  /** The identifier as written, e.g. `FR-001`, `T042`, `US2`, `P-APP-DIR`. */
  readonly id: string;
  /** The family's letter prefix. */
  readonly prefix: string;
  /** Offset of the first character, inclusive. */
  readonly from: number;
  /** Offset just past the last character, exclusive. */
  readonly to: number;
  /** `anchored` from this scanner; `expanded` from compressed-reference expansion. */
  readonly origin: 'anchored' | 'expanded';
  /** Three-digit feature number when a qualifier retargeted this token. */
  readonly featureQualifier: string | null;
}

export interface TokenizeOptions {
  /** Override the family table. Used by the order-independence test. */
  readonly families?: readonly IdFamily[];
}

/**
 * The longest family match starting exactly at `index`, or null.
 *
 * Longest-match arbitration is defensive, not load-bearing: the family patterns
 * are pairwise disjoint at any given start offset, so at most one ever matches
 * and first-match would behave identically. Mutation testing confirms this —
 * replacing the length comparison with a first-match rule fails no test. The
 * comparison is kept so the property is not silently required when the
 * twentieth family arrives, and the disjointness it makes redundant is pinned
 * by a test in `mechanisms.test.ts`.
 *
 * The prefix membership check is a fast path with the same status. Removing it
 * also fails no test, because each family pattern contains its own literal
 * prefix and therefore cannot match another family's text. What the check does
 * buy is avoiding a scan over every family at every offset.
 *
 * The load-bearing part here is `extractPrefix` being GREEDY. That is not about
 * rejection, as one might assume, but about acceptance: a one-character prefix
 * makes every multi-letter family unreachable, and breaking it fails 33 tests.
 *
 * Boundaries are NOT checked here. Callers that need a bare shape test — the
 * right-boundary rule asking whether a complete identifier begins after a
 * hyphen — need the shape without the boundary conditions, or a qualified range
 * such as `US1-US5` could never satisfy its own precondition.
 */
function longestMatchAt(
  text: string,
  index: number,
  families: readonly IdFamily[]
): { family: IdFamily; id: string } | null {
  const prefix = extractPrefix(text, index);
  if (prefix.length === 0 || !FAMILY_PREFIXES.has(prefix)) {
    return null;
  }

  let best: { family: IdFamily; id: string } | null = null;

  for (const family of families) {
    if (family.prefix !== prefix) {
      continue;
    }
    family.pattern.lastIndex = index;
    const match = family.pattern.exec(text);
    if (!match || match.index !== index) {
      continue;
    }
    if (!best || match[0].length > best.id.length) {
      best = { family, id: match[0] };
    }
  }

  return best;
}

/**
 * Every identifier in `text`, in order of appearance.
 *
 * Resume behaviour:
 *
 * - On ACCEPTANCE the scan resumes at the token's end, so a compound
 *   identifier's interior is never offered as a candidate.
 * - On REJECTION it resumes at `start + 1` rather than at the rejected shape's
 *   end, because that cannot skip text.
 *
 * An earlier note here claimed `versionFR-001` proves the rejection case
 * matters. It does not, and mutation testing showed the two strategies are
 * currently indistinguishable: a candidate contains only letters, digits and
 * hyphens, so anything starting inside one is preceded by a boundary-blocking
 * character and is rejected regardless. `start + 1` is retained as the safe
 * default should a future family admit a character that breaks that argument.
 * See `mechanisms.test.ts`, which records this as an unproven property rather
 * than asserting it as a proven one.
 */
export function tokenize(text: string, options: TokenizeOptions = {}): IdToken[] {
  const families = options.families ?? ID_FAMILIES;
  const tokens: IdToken[] = [];

  // Bare shape test for the right-boundary rule. Deliberately ignores
  // boundaries: it answers "does an identifier start here", not "would one be
  // accepted here".
  const startsCompleteId = (offset: number): boolean =>
    longestMatchAt(text, offset, families) !== null;

  let index = 0;
  while (index < text.length) {
    const candidate = longestMatchAt(text, index, families);
    if (!candidate) {
      index++;
      continue;
    }

    const end = index + candidate.id.length;
    const accepted =
      hasValidLeftBoundary(text, index) && hasValidRightBoundary(text, end, startsCompleteId);

    if (!accepted) {
      index++;
      continue;
    }

    tokens.push({
      id: candidate.id,
      prefix: candidate.family.prefix,
      from: index,
      to: end,
      origin: 'anchored',
      featureQualifier: null,
    });
    index = end;
  }

  return tokens;
}

/** Just the identifier strings, in order. Convenience for assertions. */
export function tokenizeToIds(text: string, options: TokenizeOptions = {}): string[] {
  return tokenize(text, options).map(token => token.id);
}
