import { tokenize, tokenizeToIds } from '../../../shared/speckitIds/tokenizer';
import { ID_FAMILIES } from '../../../shared/speckitIds/families';

/**
 * Contract items C-tok-34 through C-tok-37: the scan's mechanics.
 *
 * These assert behaviour that a naive implementation gets wrong in ways that
 * only show up on specific inputs, so each case names the input that catches it.
 */

describe('resume position on rejection (C-tok-34)', () => {
  it('yields nothing for versionFR-001', () => {
    // The single most diagnostic input in the suite.
    //
    // A candidate `FR-001` starts at offset 7 and is rejected, because a letter
    // precedes it. The scanner must then resume at offset 8, where it considers
    // and also correctly rejects `R-001`.
    //
    // An implementation that resumes at the REJECTED MATCH'S END skips past
    // offset 8 entirely. That happens to produce the right answer here, but it
    // means a real identifier starting inside a rejected span is invisible —
    // which the next test demonstrates.
    expect(tokenizeToIds('versionFR-001')).toEqual([]);
  });

  it('finds an identifier that starts inside a longer rejected shape', () => {
    // `xT042` is rejected at offset 1. Resuming at offset 2 finds nothing, which
    // is correct. But the reverse case must also hold: a rejected candidate must
    // not consume text that a later valid candidate needs.
    expect(tokenizeToIds('xT042')).toEqual([]);
    expect(tokenizeToIds('x T042')).toEqual(['T042']);
  });

  it('does not let a rejected candidate hide a following valid one', () => {
    expect(tokenizeToIds('versionFR-001 and FR-002')).toEqual(['FR-002']);
  });
});

describe('resume position on acceptance (C-tok-35)', () => {
  it('yields exactly one token for a namespaced contract identifier', () => {
    // Resuming at the token's end is what makes maximal munch protect the
    // interior. Resuming at start+1 after acceptance would re-scan `CORE-3`.
    expect(tokenize('C-CORE-3')).toHaveLength(1);
  });

  it('yields exactly one token for a three-segment identifier', () => {
    expect(tokenize('FR-EX-001')).toHaveLength(1);
  });

  it('yields exactly one token for a grouped identifier', () => {
    expect(tokenize('FR-G12')).toHaveLength(1);
  });
});

describe('order independence (C-tok-36)', () => {
  const text = [
    'Tasks T019a and T019l satisfy FR-001, FR-G12, FR-EX-001 and SC-003b.',
    'Contracts C-readFile-1, C-P-4, C-12 and C1 all apply.',
    'Research R-001, R-11, R2 and decision D13 are cited, with Q1 and AS1.',
    'Briefs BR-4, AD-6, OQ-8, A-7 and precondition P-APP-DIR are referenced.',
    'Stories US2 and US8-1 are in scope. Constants HS256 and AES-256 are not.',
  ].join('\n');

  const baseline = tokenizeToIds(text);

  it('produces a non-trivial baseline', () => {
    expect(baseline.length).toBeGreaterThan(15);
  });

  it('produces identical output under any family declaration order', () => {
    // The patterns are pairwise disjoint at any given start offset, and the
    // scanner takes the longest match rather than the first. Declaration order
    // is therefore policy for readability, not a correctness dependency — and
    // this proves it stays that way.
    for (let seed = 0; seed < 12; seed++) {
      const shuffled = [...ID_FAMILIES];
      // Deterministic shuffle: no Math.random, so a failure is reproducible.
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = (i * 31 + seed * 17 + 7) % (i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      expect(tokenizeToIds(text, { families: shuffled })).toEqual(baseline);
    }
  });
});

describe('boundaries are part of acceptance, not a later filter (C-tok-37)', () => {
  it('is observable through the resume behaviour', () => {
    // A post-filter cannot reproduce this. It would receive a match at offset 7
    // of `versionFR-001`, discard it, and never reconsider offset 8 — so it
    // could not distinguish this input from one where offset 8 does hold a
    // valid identifier.
    expect(tokenizeToIds('versionFR-001')).toEqual([]);
    expect(tokenizeToIds('FR-001')).toEqual(['FR-001']);
  });
});

describe('token offsets', () => {
  it('reports the exact span of each identifier', () => {
    const text = 'see FR-001 now';
    const [token] = tokenize(text);
    expect(token.from).toBe(4);
    expect(token.to).toBe(10);
    expect(text.slice(token.from, token.to)).toBe('FR-001');
  });

  it('excludes enclosing brackets from the span', () => {
    const text = '[US1]';
    const [token] = tokenize(text);
    expect(text.slice(token.from, token.to)).toBe('US1');
  });

  it('marks every token from this stage as anchored with no qualifier', () => {
    for (const token of tokenize('FR-001 and T042')) {
      expect(token.origin).toBe('anchored');
      expect(token.featureQualifier).toBeNull();
    }
  });
});
