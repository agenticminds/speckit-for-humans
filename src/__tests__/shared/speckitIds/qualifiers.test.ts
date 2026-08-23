import { recognize } from '../../../shared/speckitIds/expand';
import { bindQualifiers, collectQualifierCandidates } from '../../../shared/speckitIds/qualifiers';

/**
 * The cross-feature qualifier contract: C-tok-28 through C-tok-33, FR-017,
 * FR-018.
 *
 * Stage 4, and it cannot run before stage 3. A qualifier RETARGETS a token that
 * recognition already produced and never creates one, which is what makes
 * `SC-006/SC-009` safe: by the time binding runs, the `006` is already inside a
 * token and cannot be read as a feature number (C-tok-32).
 *
 * The load-bearing negative is FR-018. Binding is gated on a set of feature
 * numbers the caller has verified against real sibling directories, and the
 * empty set is the default, so a reference the caller cannot vouch for stays
 * pointed at the document's own feature — never at another one.
 */

/** Feature numbers the host has verified as existing sibling directories. */
const KNOWN = ['003', '006', '007', '008', '013', '014', '019', '024', '026', '039'];

/** Recognition, then binding: the two stages as a caller runs them. */
const bind = (text: string, knownFeatures: readonly string[] = KNOWN) =>
  bindQualifiers(text, recognize(text), { knownFeatures });

/** `id@qualifier` per token, in document order. `@-` means unqualified. */
const bound = (text: string, knownFeatures: readonly string[] = KNOWN): string[] =>
  bind(text, knownFeatures).map(token => `${token.id}@${token.featureQualifier ?? '-'}`);

describe('C-tok-28: NNN + space + ID binds the qualifier', () => {
  it('binds the four forms the survey counted', () => {
    expect(bound('008 FR-P07')).toEqual(['FR-P07@008']);
    expect(bound('013 T080')).toEqual(['T080@013']);
    expect(bound('019 FR-010')).toEqual(['FR-010@019']);
    expect(bound('024 D13')).toEqual(['D13@024']);
  });

  it('binds inside parentheses and mid-sentence, where these really occur', () => {
    expect(bound('as decided in (039 SC-008) earlier')).toEqual(['SC-008@039']);
    expect(bound('rework 007 FR-024a before merging')).toEqual(['FR-024a@007']);
  });

  it('binds a tab as readily as a space', () => {
    expect(bound('008\tFR-P07')).toEqual(['FR-P07@008']);
  });

  it('does not bind across a line break, which is not the documented form', () => {
    expect(bound('008\nFR-P07')).toEqual(['FR-P07@-']);
  });
});

describe('C-tok-29: lead words and possessives bind', () => {
  it('binds after a lead word', () => {
    expect(bound('spec 014 FR-028')).toEqual(['FR-028@014']);
  });

  it('binds through a possessive', () => {
    expect(bound("026's FR-030")).toEqual(['FR-030@026']);
    expect(bound("008's FR-P07")).toEqual(['FR-P07@008']);
  });

  it('binds through a typographic apostrophe too', () => {
    expect(bound('026’s FR-030')).toEqual(['FR-030@026']);
  });

  it('carries the qualifier across the abbreviated tail of one range', () => {
    // `spec 026's FR-030–034` names two identifiers in feature 026, not one
    // there and one here. An expanded token exists only as the continuation of
    // the chain head immediately before it, so it inherits the head's target.
    expect(bound("spec 026's FR-030–034")).toEqual(['FR-030@026', 'FR-034@026']);
  });
});

describe('C-tok-30: binding requires three digits and an existing sibling feature', () => {
  it('refuses a four-digit number', () => {
    expect(bound('1024 FR-001')).toEqual(['FR-001@-']);
  });

  it('refuses a number that names no sibling directory', () => {
    expect(bound('100 T042')).toEqual(['T042@-']);
  });

  it('leaves a date alone, which names nothing to bind in the first place', () => {
    expect(bound('2026 06 19')).toEqual([]);
  });

  it('refuses a number glued to a word or a hyphen on its left', () => {
    expect(bound('v008 FR-P07')).toEqual(['FR-P07@-']);
    expect(bound('x-008 FR-P07')).toEqual(['FR-P07@-']);
  });

  it('refuses two spaces, so only the documented single separator binds', () => {
    expect(bound('008  FR-P07')).toEqual(['FR-P07@-']);
  });
});

describe('C-tok-31: a qualifier retargets an existing token and never creates one', () => {
  it('returns exactly the tokens it was given, at the same offsets', () => {
    const text = "008 FR-P07 and spec 026's FR-030 and plain FR-001";
    const before = recognize(text);
    const after = bindQualifiers(text, before, { knownFeatures: KNOWN });

    expect(after).toHaveLength(before.length);
    expect(after.map(token => [token.id, token.from, token.to])).toEqual(
      before.map(token => [token.id, token.from, token.to])
    );
  });

  it('creates nothing when the text names a feature but no identifier', () => {
    expect(bind('see 008 for the rationale')).toEqual([]);
  });

  it('covers only the identifier, never the qualifier digits', () => {
    const text = '008 FR-P07';
    expect(bind(text).map(token => text.slice(token.from, token.to))).toEqual(['FR-P07']);
  });

  it('leaves the input array untouched', () => {
    const text = '008 FR-P07';
    const before = recognize(text);
    bindQualifiers(text, before, { knownFeatures: KNOWN });
    expect(before[0].featureQualifier).toBeNull();
  });
});

describe('C-tok-32: a slash group is never misread as a qualifier', () => {
  it('leaves both members of SC-006/SC-009 unqualified', () => {
    // The `006` is already inside a token by the time binding runs, and the
    // character before it is a hyphen, which blocks the qualifier's left edge.
    expect(bound('SC-006/SC-009')).toEqual(['SC-006@-', 'SC-009@-']);
  });

  it('leaves an abbreviated group unqualified', () => {
    expect(bound('FR-009/010')).toEqual(['FR-009@-', 'FR-010@-']);
  });

  it('does not let a preceding identifier bind the one after it', () => {
    expect(bound('FR-006 FR-009')).toEqual(['FR-006@-', 'FR-009@-']);
  });
});

describe('C-tok-33: the slash qualifier form is not supported', () => {
  it('yields FR-004 unqualified for 003/FR-004', () => {
    expect(bound('003/FR-004')).toEqual(['FR-004@-']);
  });

  it('yields SC-002 unqualified for 006/SC-002', () => {
    expect(bound('006/SC-002')).toEqual(['SC-002@-']);
  });
});

describe('FR-018: an unqualified reference never falls through to another feature', () => {
  it('binds nothing at all when the caller supplies no known features', () => {
    expect(bindQualifiers('008 FR-P07', recognize('008 FR-P07'))).toEqual([
      expect.objectContaining({ id: 'FR-P07', featureQualifier: null }),
    ]);
  });

  it('leaves every plain reference pointed at the document own feature', () => {
    const text = 'FR-001, T042 and US2 with 008 FR-P07 alongside';
    expect(bound(text)).toEqual(['FR-001@-', 'T042@-', 'US2@-', 'FR-P07@008']);
  });

  it('refuses a traversal attempt written inside the qualifier', () => {
    // Not a three-digit run on its own left edge, so there is nothing to bind
    // even before the host containment gate sees it.
    expect(bound('008/../../etc FR-P07')).toEqual(['FR-P07@-']);
    expect(bound('../008 FR-P07', ['008'])).toEqual(['FR-P07@008']);
  });
});

describe('candidate collection tells the host which features to index', () => {
  it('names each three-digit number that precedes a recognized identifier', () => {
    const text = "008 FR-P07, spec 014 FR-028, 026's FR-030 and plain FR-001";
    expect(collectQualifierCandidates(text, recognize(text))).toEqual(['008', '014', '026']);
  });

  it('reports each candidate once, in first-appearance order', () => {
    const text = '019 FR-010 then 008 FR-P07 then 019 FR-011';
    expect(collectQualifierCandidates(text, recognize(text))).toEqual(['019', '008']);
  });

  it('names nothing when no identifier is preceded by a bare number', () => {
    const text = 'FR-001 and SC-006/SC-009 and 2026 06 19';
    expect(collectQualifierCandidates(text, recognize(text))).toEqual([]);
  });

  it('does not gate candidates on the known set, which is what the host verifies', () => {
    const text = '100 T042';
    expect(collectQualifierCandidates(text, recognize(text))).toEqual(['100']);
  });
});
