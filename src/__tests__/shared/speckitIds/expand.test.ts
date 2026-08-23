import {
  expandCompressedReferences,
  recognize,
  recognizeToIds,
} from '../../../shared/speckitIds/expand';
import { tokenize, tokenizeToIds } from '../../../shared/speckitIds/tokenizer';

/**
 * The expansion contract: C-tok-21 through C-tok-27, FR-004, SC-004.
 *
 * Stage 3 of the pipeline. Everything here is about ABBREVIATED members of a
 * compressed reference — `010` in `FR-009/010`. Fully-qualified members are
 * found by the ordinary anchored scan and are asserted here only to pin that
 * expansion neither duplicates nor drops them.
 *
 * The load-bearing negative is C-tok-23: a range names its two endpoints and
 * nothing else. Synthesizing `FR-018` from `FR-017–FR-021` would require
 * inserting characters into the document, which FR-023 and FR-024 forbid.
 */

/** Ids in document order, anchored and expanded together. */
const ids = (text: string): string[] => recognizeToIds(text);

/** Just the substrings the tokens actually cover, in document order. */
const spans = (text: string): string[] =>
  recognize(text).map(token => text.slice(token.from, token.to));

describe('C-tok-21: abbreviated slash groups expand, one token per ID named', () => {
  it('expands a two-member group', () => {
    expect(ids('see FR-009/010 for detail')).toEqual(['FR-009', 'FR-010']);
  });

  it('expands a three-member group', () => {
    expect(ids('FR-012/013/014')).toEqual(['FR-012', 'FR-013', 'FR-014']);
  });

  it('expands a seven-member group', () => {
    expect(ids('SC-003/007/008/009/011/012/013')).toEqual([
      'SC-003',
      'SC-007',
      'SC-008',
      'SC-009',
      'SC-011',
      'SC-012',
      'SC-013',
    ]);
  });

  it('expands the SC slash group form the survey counted 17 times', () => {
    expect(ids('SC-004/005')).toEqual(['SC-004', 'SC-005']);
  });

  it('leaves a fully-qualified slash group to the anchored scan, without duplicating it', () => {
    expect(ids('SC-001/SC-002')).toEqual(['SC-001', 'SC-002']);
    expect(recognize('SC-001/SC-002').map(token => token.origin)).toEqual(['anchored', 'anchored']);
  });

  it('covers only the characters actually written for an abbreviated member', () => {
    // The canonical id is `FR-010`; the text says `010`. A decoration needs a
    // character range in the document, so the span covers only what is written.
    expect(spans('FR-009/010')).toEqual(['FR-009', '010']);
  });

  it('marks an abbreviated member as expanded and a head as anchored', () => {
    const tokens = recognize('FR-009/010');
    expect(tokens.map(token => token.origin)).toEqual(['anchored', 'expanded']);
    expect(tokens.map(token => token.prefix)).toEqual(['FR', 'FR']);
    expect(tokens[1]).toMatchObject({ id: 'FR-010', from: 7, to: 10, featureQualifier: null });
  });
});

describe('C-tok-22: shape compatibility is enforced against the head’s body', () => {
  it('expands a grouped-namespace range against the grouped body shape', () => {
    // Never `A05` (that is a bare body, not an identifier) and never `FR-005`
    // (that is the plain numeric family, a different family entirely).
    expect(ids('FR-A01–A05')).toEqual(['FR-A01', 'FR-A05']);
  });

  it('rejects a tail that does not match the head’s body shape', () => {
    // `9` is not a three-digit body, so the plain numeric head cannot own it.
    expect(ids('FR-009/9')).toEqual(['FR-009']);
    // `A05` is not a three-digit body either.
    expect(ids('FR-009/A05')).toEqual(['FR-009']);
    // and a three-digit body is not a grouped body.
    expect(ids('FR-A01/005')).toEqual(['FR-A01']);
  });

  it('keeps the head’s shape for every member of a longer chain', () => {
    expect(ids('FR-012/013/A14')).toEqual(['FR-012', 'FR-013']);
  });

  it('admits the revision suffix the head’s body pattern allows', () => {
    expect(ids('FR-005/005a')).toEqual(['FR-005', 'FR-005a']);
  });

  it('expands an unhyphenated family without inventing a separator', () => {
    expect(ids('T026…028')).toEqual(['T026', 'T028']);
    expect(spans('T026…028')).toEqual(['T026', '028']);
  });
});

describe('C-tok-23: range intermediates are never synthesized', () => {
  it('yields exactly the two endpoints of a fully-qualified en-dash range', () => {
    const tokens = recognize('FR-017–FR-021');
    expect(tokens.map(token => token.id)).toEqual(['FR-017', 'FR-021']);
    expect(tokens).toHaveLength(2);
  });

  it('never emits an interior identifier of a range', () => {
    const emitted = ids('FR-017–FR-021');
    for (const interior of ['FR-018', 'FR-019', 'FR-020']) {
      expect(emitted).not.toContain(interior);
    }
  });

  it('yields exactly two for an ellipsis range spanning twelve numbers', () => {
    const tokens = recognize('C-1…C-12');
    expect(tokens.map(token => token.id)).toEqual(['C-1', 'C-12']);
    expect(tokens).toHaveLength(2);
  });

  it('never emits an interior identifier of an ellipsis range', () => {
    const emitted = ids('C-1…C-12');
    for (const interior of ['C-2', 'C-3', 'C-4', 'C-11']) {
      expect(emitted).not.toContain(interior);
    }
  });

  it('yields exactly two for an abbreviated range as well', () => {
    // The abbreviated form is the one expansion actually touches, and it is
    // just as forbidden to fill in the middle.
    const tokens = recognize('SC-001…009');
    expect(tokens.map(token => token.id)).toEqual(['SC-001', 'SC-009']);
    expect(tokens).toHaveLength(2);
  });

  it('never emits a token whose text is absent from the document', () => {
    // The general form of the rule, stated as a property rather than a case:
    // every token must cover text that is literally present.
    const samples = [
      'FR-017–FR-021',
      'C-1…C-12',
      'SC-001…009',
      'US1-US5',
      'A-1…A-9',
      'FR-012/013/014',
      'T026-T028',
    ];
    for (const text of samples) {
      for (const token of recognize(text)) {
        expect(text.slice(token.from, token.to).length).toBeGreaterThan(0);
        expect(text).toContain(text.slice(token.from, token.to));
        // The span is a suffix of the canonical id: either the whole id or the
        // abbreviated body. It can never be text the author did not write.
        expect(token.id.endsWith(text.slice(token.from, token.to))).toBe(true);
      }
    }
  });
});

describe('C-tok-24: all separators are handled, longest-first', () => {
  const CASES: ReadonlyArray<readonly [string, string]> = [
    ['/', 'FR-009/010'],
    ['en dash', 'FR-009–010'],
    ['em dash', 'FR-009—010'],
    ['ellipsis', 'FR-009…010'],
    ['arrow', 'FR-009→010'],
    ['three dots', 'FR-009...010'],
    ['two dots', 'FR-009..010'],
  ];

  it.each(CASES)('expands across the %s separator', (_name, text) => {
    expect(ids(text)).toEqual(['FR-009', 'FR-010']);
  });

  it('tries three dots before two dots', () => {
    // Trying `..` first splits `FR-009...010` as `FR-009` + `..` + `.010`,
    // whose body `.010` matches nothing. The chain would silently end.
    const tokens = recognize('FR-009...010');
    expect(tokens).toHaveLength(2);
    expect(tokens[1].from).toBe(9);
    expect('FR-009...010'.slice(tokens[1].from, tokens[1].to)).toBe('010');
  });

  it('handles a fully-qualified arrow range', () => {
    expect(ids('T003→T004')).toEqual(['T003', 'T004']);
  });

  it('does not treat an unlisted character as a separator', () => {
    expect(ids('FR-009|010')).toEqual(['FR-009']);
    expect(ids('FR-009 010')).toEqual(['FR-009']);
    expect(ids('FR-009:010')).toEqual(['FR-009']);
  });
});

describe('C-tok-25: ASCII hyphen admits only fully-qualified members', () => {
  it('expands a fully-qualified hyphen range', () => {
    expect(ids('US1-US5')).toEqual(['US1', 'US5']);
    expect(ids('T026-T028')).toEqual(['T026', 'T028']);
  });

  it('never admits an abbreviated member after an ASCII hyphen', () => {
    // This is what keeps a line reference out. `76` is a plausible body for no
    // family here, but the rule does not even ask: after `-`, abbreviated is
    // categorically refused.
    expect(ids('L76-82')).toEqual([]);
    // The head itself is lost too, and that is the anchored scan's doing, not
    // expansion's: a trailing ASCII hyphen with no complete identifier after it
    // fails the right-boundary rule, so `T026` was never confirmed. Expansion
    // seeds only from confirmed anchors, so there is nothing to seed from.
    expect(ids('T026-028')).toEqual([]);
    expect(ids('C-1-2')).toEqual([]);
  });

  it('does not expand into a word after an ASCII hyphen', () => {
    expect(ids('T016-scaffolding')).toEqual([]);
    expect(ids('T038-login-screen.txt')).toEqual([]);
  });

  it('is expansion, not the anchored scan, that recovers the second endpoint', () => {
    // `US5` and `T028` sit immediately after a hyphen whose preceding run is
    // identifier-shaped, so the left-boundary rule refuses them — that rule is
    // what keeps the `P07` inside `FR-P07` from standing alone. Recovering them
    // is exactly the job C-tok-25 gives expansion, and the origin says so.
    expect(tokenizeToIds('T026-T028')).toEqual(['T026']);
    expect(recognize('T026-T028').map(token => token.origin)).toEqual(['anchored', 'expanded']);
    expect(tokenizeToIds('US1-US5')).toEqual(['US1']);
    expect(recognize('US1-US5').map(token => token.origin)).toEqual(['anchored', 'expanded']);
  });
});

describe('C-tok-26: an abbreviated tail never seeds a chain on its own', () => {
  it('yields nothing for a bare number in running prose', () => {
    expect(ids('the 010 case')).toEqual([]);
    expect(ids('010')).toEqual([]);
  });

  it('yields nothing for a bare group of numbers', () => {
    expect(ids('009/010/011')).toEqual([]);
  });

  it('does not seed from a rejected look-alike', () => {
    // `L76` is not a recognized family, so there is no confirmed anchor and
    // therefore no chain, regardless of what follows.
    expect(ids('L76/82')).toEqual([]);
    expect(ids('P-256/384')).toEqual([]);
  });

  it('starts the chain only after the anchor, never before it', () => {
    expect(ids('010/FR-009')).toEqual(['FR-009']);
  });
});

describe('C-tok-27: comma abbreviation is unsupported', () => {
  it('yields only the head for a comma-abbreviated group', () => {
    expect(ids('FR-011, 042')).toEqual(['FR-011']);
    expect(ids('FR-011,042')).toEqual(['FR-011']);
  });

  it('is why a count following an identifier cannot misfire', () => {
    expect(ids('FR-001, 42 users')).toEqual(['FR-001']);
    expect(ids('FR-001, 042 users are affected')).toEqual(['FR-001']);
  });

  it('still finds a fully-qualified identifier after a comma', () => {
    expect(ids('FR-011, FR-042')).toEqual(['FR-011', 'FR-042']);
  });
});

describe('the tag form needs no rule (US3 acceptance scenario 3)', () => {
  it('recognizes a bracketed tag without including the brackets', () => {
    const tokens = recognize('- [ ] T051 [P] [US3] write the test');
    expect(tokens.map(token => token.id)).toEqual(['T051', 'US3']);
    const text = '- [ ] T051 [P] [US3] write the test';
    expect(text.slice(tokens[1].from, tokens[1].to)).toBe('US3');
  });
});

describe('expansion never disturbs the anchored scan', () => {
  const SAMPLES = [
    'plain prose with no identifiers at all',
    'FR-001 and SC-002 and T003 and US4 and P-APP-DIR',
    'HS256, PGRST116, ES2022, DNS-1123, provider.ts#L257',
    '(Priority: P1) and FR-P07',
    'FR-017–FR-021',
    'FR-011, 042',
  ];

  it.each(SAMPLES)('preserves every anchored token for %s', text => {
    const anchored = recognize(text)
      .filter(token => token.origin === 'anchored')
      .map(token => token.id);
    expect(anchored).toEqual(tokenizeToIds(text));
  });

  it('returns tokens in document order', () => {
    const text = 'FR-012/013/014 then SC-004/005 then T026-T028';
    const tokens = recognize(text);
    const froms = tokens.map(token => token.from);
    expect([...froms].sort((a, b) => a - b)).toEqual(froms);
  });

  it('accepts a caller-supplied anchor list rather than re-scanning', () => {
    const text = 'FR-009/010';
    expect(expandCompressedReferences(text, tokenize(text)).map(token => token.id)).toEqual([
      'FR-009',
      'FR-010',
    ]);
  });

  it('produces nothing when the caller supplies no anchors', () => {
    expect(expandCompressedReferences('FR-009/010', [])).toEqual([]);
  });
});

describe('SC-004: every surveyed compressed form is fully expanded', () => {
  // One row per form the survey counted, so a regression names the form.
  const FORMS: ReadonlyArray<readonly [string, string, string[]]> = [
    ['slash group', 'FR-009/010', ['FR-009', 'FR-010']],
    ['multi-slash group', 'FR-012/013/014', ['FR-012', 'FR-013', 'FR-014']],
    ['SC slash group', 'SC-004/005', ['SC-004', 'SC-005']],
    ['en-dash range', 'FR-017–FR-021', ['FR-017', 'FR-021']],
    ['ellipsis range, SC', 'SC-001…SC-009', ['SC-001', 'SC-009']],
    ['ellipsis range, C', 'C-1…C-12', ['C-1', 'C-12']],
    ['ellipsis range, A', 'A-1…A-9', ['A-1', 'A-9']],
    ['tag form', '[US1]', ['US1']],
  ];

  it.each(FORMS)('%s', (_form, text, expected) => {
    expect(ids(text)).toEqual(expected);
  });
});
