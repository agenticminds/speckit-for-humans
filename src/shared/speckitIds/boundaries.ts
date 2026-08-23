/**
 * Boundary predicates for identifier recognition.
 *
 * These carry nearly all of the rejection power in the grammar, and they are
 * evaluated as part of deciding whether a match is accepted — not applied
 * afterwards as a filter. That distinction is observable: see the note on
 * `versionFR-001` in the scanner.
 *
 * Pure functions over a string and an offset. No dependencies.
 */

/**
 * Characters that, appearing immediately before a candidate, disqualify it.
 *
 * Letters and digits mean the candidate is embedded in a longer word.
 * Underscore likewise. `#` guards against a deep-link fragment such as
 * `provider.ts#L257`. `~` guards against a range written `~L116-121`. `$`, `%`
 * and `@` guard against template interpolation.
 */
const LEFT_BLOCKING = /[A-Za-z0-9_#~$%@-]/;

/** Characters that, appearing immediately after a candidate, disqualify it. */
const RIGHT_BLOCKING = /[A-Za-z0-9-]/;

/** A maximal run of letters and digits ending immediately before `index`. */
const TRAILING_WORD_RUN = /[A-Za-z][A-Za-z0-9]*$/;

/**
 * Does the run of word characters ending just before `hyphenIndex` look like the
 * prefix of an identifier?
 *
 * This is what makes the hyphen rule discriminating rather than blunt. A hyphen
 * before a candidate is usually harmless — `per-FR-022` and `clarify-Q1` are
 * genuine references, and a flat "reject anything after a hyphen" rule costs
 * nine of them while measurably buying nothing, because maximal munch already
 * consumes compound identifiers whole.
 *
 * What the rule must still catch is the tail of a compound identifier: the
 * `P07` inside `FR-P07`, or the `3` inside `C-CORE-3`. In those the run before
 * the hyphen starts with an uppercase letter, so keying on that separates the
 * two cases. It is defence in depth rather than the primary mechanism — the
 * scanner's resume-at-end behaviour means those tails are never even offered as
 * candidates — but it keeps the guarantee true as the family table grows.
 */
function prefixRunIsIdShaped(text: string, hyphenIndex: number): boolean {
  const before = text.slice(0, hyphenIndex);
  const run = TRAILING_WORD_RUN.exec(before);
  if (!run) {
    return false;
  }
  const first = run[0][0];
  return first >= 'A' && first <= 'Z';
}

/**
 * May a candidate start at `start`?
 *
 * A leading `/` is allowed because it is how the corpus writes a slash group,
 * as in `SC-001/SC-002`.
 */
export function hasValidLeftBoundary(text: string, start: number): boolean {
  if (start === 0) {
    return true;
  }

  const previous = text[start - 1];

  if (previous === '/') {
    return true;
  }

  if (previous === '-') {
    return !prefixRunIsIdShaped(text, start - 1);
  }

  return !LEFT_BLOCKING.test(previous);
}

/**
 * May a candidate end at `end`?
 *
 * A trailing hyphen is allowed only when a complete identifier of the same
 * grammar begins immediately after it, which is how a fully qualified range is
 * written — `US1-US5`, `T026-T028`. Without that condition the rule would
 * accept `T038-login-screen.txt`, `T016-scaffolding` and `T041f-era`, all of
 * which are filenames or words rather than references.
 *
 * @param startsCompleteId Callback asking whether a complete identifier begins
 *   at the given offset. Supplied by the scanner, which owns the family table,
 *   so this module stays free of that dependency.
 */
export function hasValidRightBoundary(
  text: string,
  end: number,
  startsCompleteId: (offset: number) => boolean
): boolean {
  if (end >= text.length) {
    return true;
  }

  const next = text[end];

  if (next === '-') {
    return startsCompleteId(end + 1);
  }

  return !RIGHT_BLOCKING.test(next);
}

/**
 * The maximal run of letters starting at `start`, which is the candidate's
 * prefix.
 *
 * Extraction is GREEDY, and that is load-bearing: `TS7016` must yield `TS` and
 * be rejected, never `T` followed by something that looks like a task body.
 */
export function extractPrefix(text: string, start: number): string {
  let end = start;
  while (end < text.length) {
    const code = text.charCodeAt(end);
    const isLetter = (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
    if (!isLetter) {
      break;
    }
    end++;
  }
  return text.slice(start, end);
}
