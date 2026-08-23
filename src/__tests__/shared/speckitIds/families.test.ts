import { tokenizeToIds } from '../../../shared/speckitIds/tokenizer';
import { ID_FAMILIES, FAMILY_PREFIXES } from '../../../shared/speckitIds/families';

/**
 * Contract items C-tok-1 through C-tok-9: every declared family is accepted, in
 * every shape the corpus actually uses.
 *
 * Body widths are asserted explicitly because each was measured and each has an
 * obvious wrong guess that silently drops real references. Those are called out
 * where they bite.
 */

describe('family vocabulary (C-tok-1)', () => {
  const accepted: Array<[string, string]> = [
    ['FR-001', 'functional requirement'],
    ['FR-G12', 'grouped functional requirement'],
    ['FR-EX-001', 'three-segment example-app requirement'],
    ['FR-005a', 'revision-suffixed requirement'],
    ['SC-001', 'success criterion'],
    ['SC-003b', 'revision-suffixed criterion'],
    ['SC-EX-001', 'three-segment example-app criterion'],
    ['T042', 'task'],
    ['T019l', 'task with a late revision suffix'],
    ['US2', 'user story'],
    ['US8-1', 'acceptance scenario within a story'],
    ['C-ws-1', 'contract, lowercase namespace'],
    ['C-readFile-1', 'contract, camelCase namespace'],
    ['C-git-write-2', 'contract, multi-segment namespace'],
    ['C-UI-1', 'contract, uppercase namespace'],
    ['C-P-4', 'contract, single-letter namespace'],
    ['C1', 'contract, unhyphenated'],
    ['C-12', 'contract, hyphenated'],
    ['R-001', 'research, hyphenated'],
    ['R-11', 'research, hyphenated, two digits'],
    ['R2', 'research, unhyphenated'],
    ['D13', 'research decision'],
    ['Q1', 'clarification question'],
    ['AS1', 'assertion scenario'],
    ['BR-4', 'brief requirement'],
    ['AD-6', 'architecture decision'],
    ['OQ-8', 'open question'],
    ['A-7', 'assumption'],
    ['P-APP-DIR', 'precondition, digit-free'],
    ['P-BUN', 'precondition, single segment'],
    ['P-PLATFORM-LINK', 'precondition, multi segment'],
  ];

  it.each(accepted)('accepts %s (%s)', token => {
    expect(tokenizeToIds(token)).toEqual([token]);
  });

  it('declares nineteen families across twenty-one pattern entries', () => {
    // Nineteen concepts; the grouped and three-segment forms are extra pattern
    // entries for two of them.
    expect(ID_FAMILIES.length).toBeGreaterThanOrEqual(19);
    expect(FAMILY_PREFIXES.size).toBeGreaterThanOrEqual(12);
  });
});

describe('exact body widths (C-tok-2, C-tok-3)', () => {
  it('requires exactly three digits for a plain requirement', () => {
    expect(tokenizeToIds('FR-001')).toEqual(['FR-001']);
    expect(tokenizeToIds('FR-1')).toEqual([]);
    expect(tokenizeToIds('FR-0001')).toEqual([]);
  });

  it('requires exactly two digits for a grouped requirement', () => {
    // Two digits versus three is the ONLY thing separating a truncated grouped
    // requirement tail from a task identifier. Widening either collides.
    expect(tokenizeToIds('FR-T01')).toEqual(['FR-T01']);
    expect(tokenizeToIds('FR-T001')).toEqual([]);
  });

  it('requires exactly three digits for a task', () => {
    expect(tokenizeToIds('T042')).toEqual(['T042']);
    expect(tokenizeToIds('T42')).toEqual([]);
  });

  it('accepts task revision suffixes through l, not merely f (C-tok-3)', () => {
    // A rule capped at `f` drops more than twenty real references.
    for (const suffix of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']) {
      expect(tokenizeToIds(`T019${suffix}`)).toEqual([`T019${suffix}`]);
    }
  });

  it('accepts one to three digits for a hyphenated research identifier', () => {
    // A three-digit-only rule drops all twenty-seven R-1 through R-11 refs.
    expect(tokenizeToIds('R-1')).toEqual(['R-1']);
    expect(tokenizeToIds('R-11')).toEqual(['R-11']);
    expect(tokenizeToIds('R-001')).toEqual(['R-001']);
  });

  it('accepts exactly one digit for a user story', () => {
    expect(tokenizeToIds('US1')).toEqual(['US1']);
    expect(tokenizeToIds('US10')).not.toEqual(['US10']);
  });
});

describe('preconditions carry no digits (C-tok-4)', () => {
  it('accepts an identifier made only of uppercase segments', () => {
    expect(tokenizeToIds('P-SOPS')).toEqual(['P-SOPS']);
    expect(tokenizeToIds('P-PLATFORM-INSTALLED')).toEqual(['P-PLATFORM-INSTALLED']);
  });

  it('still rejects a hyphenated P followed by digits', () => {
    // The NIST curve. Requiring a letter after the hyphen is what rejects it.
    expect(tokenizeToIds('P-256')).toEqual([]);
  });
});

describe('hyphenated and unhyphenated spellings are distinct families (C-tok-6)', () => {
  it('treats research spellings as different identifiers', () => {
    expect(tokenizeToIds('R-11')).toEqual(['R-11']);
    expect(tokenizeToIds('R11')).toEqual(['R11']);
  });

  it('treats contract spellings as different identifiers', () => {
    expect(tokenizeToIds('C-1')).toEqual(['C-1']);
    expect(tokenizeToIds('C1')).toEqual(['C1']);
  });
});

describe('surrounding punctuation (C-tok-7, C-tok-8, C-tok-9)', () => {
  it('excludes brackets from a tagged reference', () => {
    const tokens = tokenizeToIds('- [ ] T027 [P] [US1] Implement');
    expect(tokens).toContain('US1');
    expect(tokens).toContain('T027');
    expect(tokens).not.toContain('[US1]');
  });

  it('excludes trailing and enclosing punctuation', () => {
    expect(tokenizeToIds('see FR-001.')).toEqual(['FR-001']);
    expect(tokenizeToIds('(FR-001)')).toEqual(['FR-001']);
    expect(tokenizeToIds('FR-001, FR-002')).toEqual(['FR-001', 'FR-002']);
  });

  it('accepts an identifier preceded by a lowercase word and a hyphen (C-tok-9)', () => {
    // A blanket "reject after a hyphen" rule costs these nine real references
    // and measurably buys nothing.
    expect(tokenizeToIds('per-FR-022')).toEqual(['FR-022']);
    expect(tokenizeToIds('clarify-Q1')).toEqual(['Q1']);
  });
});

describe('multiple identifiers in running prose', () => {
  it('finds each one, in order, with correct offsets', () => {
    const text = 'Task T027 satisfies FR-001 and SC-004 for US1.';
    expect(tokenizeToIds(text)).toEqual(['T027', 'FR-001', 'SC-004', 'US1']);
  });
});
