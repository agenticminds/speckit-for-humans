/**
 * Continuation expansion: the abbreviated members of a compressed reference.
 *
 * Stage 3 of the six-stage pipeline, and it cannot run before stage 2. Every
 * chain is seeded from a CONFIRMED anchored token, because expanding from an
 * unconfirmed match would let a look-alike seed a chain — `L76/82` would become
 * two links (R-024, FR-004).
 *
 * Pure. No file access, no VS Code API, no ProseMirror.
 *
 * What this module does NOT do, and must never do, is synthesize the interior
 * of a range. `FR-017–FR-021` names exactly two identifiers; `FR-018` appears
 * nowhere in the text. A decoration needs a character range in the document, so
 * rendering it would mean inserting characters, which FR-023 and FR-024 forbid
 * (C-tok-23). Every token this module emits covers text the author wrote.
 *
 * Groups and ranges collapse to a single rule here. Once intermediates are off
 * the table, `FR-012/013/014` and `FR-017–FR-021` differ only in which
 * separator sits between the members, so there is nothing for a distinction to
 * buy.
 */

import { hasValidRightBoundary } from './boundaries';
import { ID_FAMILIES, type IdFamily } from './families';
import { matchFamilyAt, tokenize, type IdToken, type TokenizeOptions } from './tokenizer';

/**
 * Separators that continue a chain, LONGEST FIRST.
 *
 * The ordering is load-bearing for exactly one pair: `..` before `...` splits
 * `FR-009...010` after two dots, leaving `.010`, which is not a body of any
 * family, and the chain ends one member short. The single-character entries are
 * mutually exclusive, so their relative order is free; they are kept in the
 * order the contract lists them.
 *
 * The ASCII hyphen is in this list but is not like the others — see
 * `readMember`. A comma is deliberately absent: `FR-011, 042` occurs once in
 * the corpus, and admitting it would make every "`FR-001`, 42 users" a false
 * positive (C-tok-27).
 */
const SEPARATORS: readonly string[] = [
  '...',
  '..',
  '/',
  '–', // en dash
  '—', // em dash
  '…', // horizontal ellipsis
  '→', // rightwards arrow
  '-',
];

/** The ASCII hyphen, which admits only fully-qualified members (C-tok-25). */
const ASCII_HYPHEN = '-';

/**
 * A candidate member as written: letters, digits and hyphens.
 *
 * Hyphens are included because two bodies contain them — the precondition
 * family `P-APP-DIR` and the acceptance-scenario form `US8-1`. Taking the
 * MAXIMAL run and then demanding a whole-body match is what supplies the
 * member's right boundary: `010-x` fails `^\d{3}[a-f]?$` outright, so a
 * trailing word cannot be silently truncated to something that fits.
 */
const MEMBER_RUN = /[A-Za-z0-9-]+/y;

/** The longest separator starting at `index`, or null. */
function separatorAt(text: string, index: number): string | null {
  for (const separator of SEPARATORS) {
    if (text.startsWith(separator, index)) {
      return separator;
    }
  }
  return null;
}

/**
 * The part of an identifier before its body — prefix plus separator.
 *
 * `FR-009` yields `FR-`, `T026` yields `T`. Prepending this to a validated
 * abbreviated body is how `010` becomes the canonical `FR-010` while the token
 * still covers only the three characters written.
 */
function stemOf(family: IdFamily): string {
  return family.prefix + (family.separator === 'hyphen' ? '-' : '');
}

/**
 * The next member of a chain whose head has the given family, or null.
 *
 * Two admission rules, and which applies is decided by the separator:
 *
 * - After an ASCII hyphen, ONLY a fully-qualified member is admitted. This is
 *   the whole reason `L76-82`, `T016-scaffolding` and `T038-login-screen.txt`
 *   stay rejected while `US1-US5` and `T026-T028` work. An abbreviated tail is
 *   not merely unlikely here, it is categorically refused.
 * - After any other separator, an abbreviated member is admitted if it matches
 *   the HEAD's body pattern — never the union of all patterns. That is what
 *   makes `FR-A01–A05` yield `FR-A05` rather than `A05` or `FR-005` (C-tok-22).
 */
function readMember(
  text: string,
  index: number,
  head: IdFamily,
  separator: string,
  families: readonly IdFamily[]
): IdToken | null {
  const stem = stemOf(head);

  if (separator === ASCII_HYPHEN) {
    const qualified = matchFamilyAt(text, index, families);
    if (!qualified || !qualified.id.startsWith(stem)) {
      return null;
    }
    if (!head.bodyPattern.test(qualified.id.slice(stem.length))) {
      return null;
    }
    const end = index + qualified.id.length;
    const startsCompleteId = (offset: number): boolean =>
      matchFamilyAt(text, offset, families) !== null;
    if (!hasValidRightBoundary(text, end, startsCompleteId)) {
      return null;
    }
    return {
      id: qualified.id,
      prefix: head.prefix,
      from: index,
      to: end,
      origin: 'expanded',
      featureQualifier: null,
    };
  }

  MEMBER_RUN.lastIndex = index;
  const run = MEMBER_RUN.exec(text);
  if (!run || run.index !== index || !head.bodyPattern.test(run[0])) {
    return null;
  }
  return {
    id: stem + run[0],
    prefix: head.prefix,
    from: index,
    to: index + run[0].length,
    origin: 'expanded',
    featureQualifier: null,
  };
}

/**
 * Every identifier named in `text`, anchored and expanded, in document order.
 *
 * `anchored` is the output of the stage-2 scan over the same string. Supplying
 * an empty list yields an empty result, which is the rule that a bare `010`
 * never links alone, stated as a signature rather than as a special case
 * (C-tok-26).
 *
 * Anchored tokens are passed through unchanged, so the two stages compose
 * without the later one being able to weaken the earlier one.
 *
 * A fully-qualified member reached over an ASCII hyphen is reported as
 * `expanded` even though nothing about it is abbreviated. That is accurate
 * provenance rather than a category error: the anchored scan genuinely refuses
 * it, because the left-boundary rule rejects an identifier preceded by a hyphen
 * whose preceding run is identifier-shaped — the same rule that stops the `P07`
 * inside `FR-P07` from standing alone. Expansion is what recovers it.
 */
export function expandCompressedReferences(
  text: string,
  anchored: readonly IdToken[],
  options: TokenizeOptions = {}
): IdToken[] {
  const families = options.families ?? ID_FAMILIES;
  const tokens: IdToken[] = [];
  const indexByStart = new Map<number, number>();
  anchored.forEach((token, position) => indexByStart.set(token.from, position));

  let position = 0;
  while (position < anchored.length) {
    const head = anchored[position];
    tokens.push(head);
    position++;

    const family = matchFamilyAt(text, head.from, families)?.family;
    if (!family) {
      continue;
    }

    let cursor = head.to;
    for (;;) {
      const separator = separatorAt(text, cursor);
      if (separator === null) {
        break;
      }

      const memberStart = cursor + separator.length;

      // A member the anchored scan already found — every non-ASCII separator is
      // a valid left boundary, so `SC-001/SC-002` and `C-1…C-12` arrive here.
      // Consume it as part of this chain so it is not also treated as a fresh
      // head, and so it is emitted exactly once.
      const alreadyAnchored = indexByStart.get(memberStart);
      if (alreadyAnchored !== undefined) {
        tokens.push(anchored[alreadyAnchored]);
        cursor = anchored[alreadyAnchored].to;
        position = alreadyAnchored + 1;
        continue;
      }

      const member = readMember(text, memberStart, family, separator, families);
      if (!member) {
        break;
      }
      tokens.push(member);
      cursor = member.to;
    }
  }

  return tokens;
}

/** Stage 2 and stage 3 together: the recognition path callers should use. */
export function recognize(text: string, options: TokenizeOptions = {}): IdToken[] {
  return expandCompressedReferences(text, tokenize(text, options), options);
}

/** Just the canonical identifier strings, in document order. */
export function recognizeToIds(text: string, options: TokenizeOptions = {}): string[] {
  return recognize(text, options).map(token => token.id);
}
