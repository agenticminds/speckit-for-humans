import { tokenizeToIds } from '../../../shared/speckitIds/tokenizer';
import {
  ID_FAMILIES,
  FAMILY_PREFIXES,
  familiesForPrefix,
} from '../../../shared/speckitIds/families';

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

/**
 * Phase 4 (US2): the families whose definitions do NOT live in `spec.md` or
 * `tasks.md`. Contracts, both research spellings, questions, brief-stage
 * families and the digit-free preconditions.
 *
 * These are the families most easily lost, because each one is a special case:
 * contract namespaces are free-form, research is spelled two incompatible ways,
 * and preconditions carry no digits at all so every "prefix then number" rule
 * rejects the whole family.
 */

describe('contract namespaces (C-tok-5, FR-001)', () => {
  const namespaced: Array<[string, string]> = [
    ['C-ws-1', 'lowercase, single segment'],
    ['C-readFile-1', 'camelCase'],
    ['C-createFolder-2', 'camelCase, second occurrence in the contract'],
    ['C-git-write-2', 'multi-segment kebab'],
    ['C-UI-1', 'uppercase'],
    ['C-P-4', 'single uppercase letter — a contract, NOT a precondition'],
    ['C-e2e-1', 'namespace carrying a digit'],
    ['C-tok-41', 'two-digit member'],
    ['C-msg-2h', 'suffixed member'],
  ];

  it.each(namespaced)('accepts %s (%s)', token => {
    expect(tokenizeToIds(token)).toEqual([token]);
  });

  it('takes the whole namespaced identifier, never a bare C prefix inside it', () => {
    // The namespaced pattern is declared before the bare forms precisely so
    // `C-tok-41` cannot degrade into `C` plus leftovers, and the scanner
    // resuming at the token end is what stops `41` seeding anything.
    expect(tokenizeToIds('see C-tok-41 and C-msg-2')).toEqual(['C-tok-41', 'C-msg-2']);
  });

  it('resolves every contract spelling against the contracts folder (FR-015)', () => {
    for (const family of familiesForPrefix('C')) {
      expect(family.owningArtifacts).toContain('contracts/');
    }
  });
});

describe('both research spellings are first-class families (C-tok-6, FR-002)', () => {
  it('declares a hyphenated and an unhyphenated research family', () => {
    const research = familiesForPrefix('R');
    expect(research.map(family => family.separator).sort()).toEqual(['hyphen', 'none']);
  });

  it('accepts each spelling in prose without the other swallowing it', () => {
    expect(tokenizeToIds('R-11 supersedes R11, and R2 stands')).toEqual(['R-11', 'R11', 'R2']);
  });

  it('accepts the unhyphenated revision suffixes the corpus uses', () => {
    expect(tokenizeToIds('R7a')).toEqual(['R7a']);
    expect(tokenizeToIds('R7b')).toEqual(['R7b']);
  });

  it('searches research.md for both spellings (FR-015)', () => {
    for (const family of familiesForPrefix('R')) {
      expect(family.owningArtifacts).toContain('research.md');
    }
  });
});

describe('the digit-free precondition family (C-tok-4, FR-003)', () => {
  it('accepts an identifier that carries no digit anywhere', () => {
    for (const token of ['P-APP-DIR', 'P-BUN', 'P-SOPS', 'P-PLATFORM-LINK', 'P-DB-URL-SET']) {
      expect(tokenizeToIds(token)).toEqual([token]);
    }
  });

  it('accepts a precondition inside running prose and in a table cell', () => {
    expect(tokenizeToIds('requires P-APP-DIR before running')).toEqual(['P-APP-DIR']);
    expect(tokenizeToIds('| P-APP-DIR | Run from a Vite app root |')).toEqual(['P-APP-DIR']);
  });

  it('rejects every bare priority marker, which shares the prefix', () => {
    // The single most expensive collision in the corpus: 611 priority markers.
    for (const marker of ['P1', 'P2', 'P3', 'P0001']) {
      expect(tokenizeToIds(marker)).toEqual([]);
    }
    expect(tokenizeToIds('(Priority: P2)')).toEqual([]);
  });

  it('searches both the briefs folder and research.md, in that order (FR-015, FR-016)', () => {
    // P-APP-DIR is genuinely defined in both places in the corpus, so the
    // family cannot name a single owner.
    const [precondition] = familiesForPrefix('P');
    expect(precondition.owningArtifacts).toEqual(['briefs/', 'research.md']);
  });
});

describe('every family names an ordered search list, not a single owner (FR-015, FR-016)', () => {
  it('gives each family at least one candidate artifact', () => {
    for (const family of ID_FAMILIES) {
      expect(family.owningArtifacts.length).toBeGreaterThan(0);
    }
  });

  it('sends the brief-stage families outside the feature folder (FR-016)', () => {
    for (const prefix of ['BR', 'AD', 'OQ']) {
      for (const family of familiesForPrefix(prefix)) {
        expect(family.owningArtifacts).toEqual(['briefs/']);
      }
    }
  });

  it('lets a family span two artifacts when the corpus defines it in both', () => {
    // Q is defined in briefs/ and cited from research.md; assumptions appear in
    // briefs/ and in contract files.
    for (const family of familiesForPrefix('Q')) {
      expect(family.owningArtifacts.length).toBeGreaterThan(1);
    }
    for (const family of familiesForPrefix('A')) {
      expect(family.owningArtifacts).toContain('briefs/');
    }
  });
});
