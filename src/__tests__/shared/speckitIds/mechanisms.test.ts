import { tokenizeToIds } from '../../../shared/speckitIds/tokenizer';
import { ID_FAMILIES, FAMILY_PREFIXES } from '../../../shared/speckitIds/families';
import { extractPrefix } from '../../../shared/speckitIds/boundaries';

/**
 * Pins the properties the grammar actually relies on.
 *
 * This file exists because mutation testing contradicted the design notes. Four
 * mechanisms the comments described as load-bearing turned out to be inert:
 * breaking them broke no test, because the code does not depend on them. Two
 * others carry everything.
 *
 * Measured, by breaking each mechanism and counting failures across the 160
 * tests in this directory:
 *
 *   greedy prefix extraction        33 failures  -> load-bearing
 *   left boundary predicate         13 failures  -> load-bearing
 *   right boundary predicate         5 failures  -> load-bearing
 *   family prefix-equality filter     0 failures -> inert (patterns self-enforce)
 *   FAMILY_PREFIXES membership gate   0 failures -> inert (fast path only)
 *   longest-match arbitration         0 failures -> inert (patterns are disjoint)
 *   resume-at-start+1 on rejection    0 failures -> inert (unobservable, see below)
 *
 * The inert four are kept, because each is either a real speed-up or a safe
 * default that stays correct if the family table grows. But they are no longer
 * described as the mechanism, and the properties that make them redundant are
 * pinned below so that a future change cannot quietly make them load-bearing
 * again without a test noticing.
 */

describe('patterns self-enforce their own prefix', () => {
  it('never matches a family whose prefix differs from the text', () => {
    // This is why dropping the prefix-equality filter in the scanner changes
    // nothing: every family pattern contains its own literal prefix, so a
    // pattern simply cannot match text belonging to another family.
    for (const family of ID_FAMILIES) {
      for (const foreign of ['HS256', 'PGRST116', 'ES2022', 'DNS-1123', 'Route53']) {
        family.pattern.lastIndex = 0;
        const match = family.pattern.exec(foreign);
        expect(match === null || match.index !== 0).toBe(true);
      }
    }
  });
});

describe('family patterns are pairwise disjoint at any start offset', () => {
  // This is the property that makes declaration order irrelevant, and it is the
  // real reason longest-match arbitration is unobservable. Assert it directly
  // rather than inferring it from an order-shuffling test that would pass either
  // way.
  const samples = [
    'FR-001',
    'FR-005a',
    'FR-G12',
    'FR-EX-001',
    'SC-001',
    'SC-EX-001',
    'T042',
    'T019l',
    'US2',
    'US8-1',
    'C-ws-1',
    'C-readFile-1',
    'C-CORE-3',
    'C-P-4',
    'C-12',
    'C1',
    'R-001',
    'R-11',
    'R2',
    'D13',
    'Q1',
    'AS1',
    'BR-4',
    'AD-6',
    'OQ-8',
    'A-7',
    'P-APP-DIR',
  ];

  it.each(samples)('exactly one family matches %s at offset zero', sample => {
    const matching = ID_FAMILIES.filter(family => {
      family.pattern.lastIndex = 0;
      const match = family.pattern.exec(sample);
      return match !== null && match.index === 0 && match[0].length === sample.length;
    });

    expect(matching).toHaveLength(1);
  });
});

describe('greedy prefix extraction is load-bearing (C-tok-12)', () => {
  // Breaking this is the single most damaging mutation: 33 of 160 tests fail.
  // It matters for ACCEPTANCE rather than rejection — a one-character prefix
  // makes every multi-letter family unreachable, because the extracted prefix
  // is then absent from the vocabulary.
  it('extracts the whole letter run, not the first letter', () => {
    expect(extractPrefix('FR-001', 0)).toBe('FR');
    expect(extractPrefix('TS7016', 0)).toBe('TS');
    expect(extractPrefix('PGRST116', 0)).toBe('PGRST');
    expect(extractPrefix('US8-1', 0)).toBe('US');
    expect(extractPrefix('Qwen3', 0)).toBe('Qwen');
  });

  it('yields a prefix outside the vocabulary for every named constant', () => {
    for (const constant of ['HS256', 'RS256', 'ES2022', 'VT323', 'TS7016', 'PGRST116']) {
      expect(FAMILY_PREFIXES.has(extractPrefix(constant, 0))).toBe(false);
    }
  });

  it('yields a prefix inside the vocabulary for every accepted family', () => {
    for (const sample of ['FR-001', 'SC-001', 'T042', 'US2', 'AS1', 'BR-4', 'OQ-8']) {
      expect(FAMILY_PREFIXES.has(extractPrefix(sample, 0))).toBe(true);
    }
  });
});

describe('resume-at-start+1 is a safe default, not an observable behaviour', () => {
  it('cannot currently be distinguished from resume-at-end', () => {
    // Honest negative result. The design notes claimed `versionFR-001` proves
    // the difference. It does not: both strategies return nothing for it.
    //
    // The difference would only show if a validly-bounded identifier began
    // strictly inside a rejected span. That cannot happen with this grammar,
    // because a candidate contains only letters, digits and hyphens, so
    // anything starting inside one is preceded by a boundary-blocking
    // character and is itself rejected.
    //
    // The behaviour is retained because it cannot skip text, which stays the
    // safe default if a future family admits a character that breaks the
    // argument above. It is documented here as unproven rather than asserted
    // as proven.
    expect(tokenizeToIds('versionFR-001')).toEqual([]);
    expect(tokenizeToIds('xT042')).toEqual([]);
    expect(tokenizeToIds('FR-001xFR-002')).toEqual([]);
  });
});
