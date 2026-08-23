import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { tokenize } from '../../../shared/speckitIds/tokenizer';

/**
 * Corpus-level gate over the fixture corpus.
 *
 * Contract items C-tok-38 (zero false positives, bounded false negatives) and
 * C-tok-40 (per-family counts recorded, not merely totalled). Success criteria
 * SC-002a is enforced here; SC-002's resolution floor needs the definition
 * index and lands with that work in Phase 3 — see the note at the bottom.
 *
 * The counts below are FROZEN. Changing one is a deliberate act: it means either
 * a fixture changed or recognition changed, and either way the reason belongs in
 * the commit message. Never edit a count to make a failing run pass.
 */

const FIXTURES = join(__dirname, '../../fixtures/speckit');

function markdownFiles(dir: string): string[] {
  return readdirSync(dir)
    .flatMap(name => {
      const full = join(dir, name);
      return statSync(full).isDirectory()
        ? markdownFiles(full)
        : full.endsWith('.md')
          ? [full]
          : [];
    })
    .sort();
}

/** Family key: prefix, plus a hyphen when the identifier carries one. */
function familyKey(prefix: string, id: string): string {
  return id.slice(prefix.length).startsWith('-') ? `${prefix}-` : prefix;
}

function tokensIn(relativePath: string) {
  return tokenize(readFileSync(join(FIXTURES, relativePath), 'utf8'));
}

describe('per-file census (C-tok-40)', () => {
  const EXPECTED: Record<string, number> = {
    'PROVENANCE.md': 12,
    'lookalikes.md': 0,
    'specs/001-example-feature/contracts/example.contract.md': 29,
    'specs/001-example-feature/plan.md': 50,
    'specs/001-example-feature/research.md': 24,
    'specs/001-example-feature/spec.md': 41,
    'specs/001-example-feature/tasks.md': 48,
    'specs/002-second-feature/spec.md': 11,
    'specs/002-second-feature/tasks.md': 6,
    'specs/briefs/example-brief.md': 23,
  };

  it('covers every markdown file in the corpus', () => {
    const found = markdownFiles(FIXTURES).map(file => file.slice(FIXTURES.length + 1));
    expect(found.sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it.each(Object.entries(EXPECTED))('%s yields %i tokens', (relativePath, expected) => {
    expect(tokensIn(relativePath)).toHaveLength(expected);
  });
});

describe('look-alike file yields nothing at all (C-tok-38, SC-003)', () => {
  it('accepts zero tokens from a file that is entirely look-alikes', () => {
    // The strongest single assertion available. That file contains every
    // rejection class in prose form and deliberately cites no real identifier,
    // so any token at all is a false positive.
    //
    // It caught three during development. All three turned out to be genuine
    // references in the file's own explanatory prose rather than tokenizer
    // faults, and the prose was reworded so the gate means what it says.
    const tokens = tokensIn('lookalikes.md');
    const detail = tokens.map(token => `${token.id}@${token.from}`).join(', ');
    expect(detail).toBe('');
  });
});

describe('per-family census (C-tok-40)', () => {
  // Recorded per family, not merely totalled, so a regression confined to one
  // family cannot hide inside an unchanged total.
  const EXPECTED: Record<string, number> = {
    'FR-': 67,
    T: 34,
    'C-': 32,
    'SC-': 19,
    US: 18,
    'R-': 13,
    D: 12,
    'P-': 9,
    'AD-': 7,
    'BR-': 7,
    'A-': 7,
    R: 5,
    C: 4,
    'OQ-': 4,
    Q: 4,
    AS: 2,
  };

  const actual: Record<string, number> = {};
  for (const file of markdownFiles(FIXTURES)) {
    for (const token of tokenize(readFileSync(file, 'utf8'))) {
      const key = familyKey(token.prefix, token.id);
      actual[key] = (actual[key] ?? 0) + 1;
    }
  }

  it('matches the frozen per-family counts exactly', () => {
    expect(actual).toEqual(EXPECTED);
  });

  it('recognizes every family the corpus contains', () => {
    // Sixteen keys. Fewer than nineteen families because the grouped and
    // three-segment forms share their parent's prefix and separator, so they
    // count under the same key, and because the grouped success-criterion form
    // has zero occurrences anywhere in any corpus.
    //
    // Note that an acceptance-scenario identifier such as US8-1 counts under
    // `US`, not `US-`: its separator is the one between prefix and body, and
    // there is none. An earlier version of this key function used "does the id
    // contain a hyphen" and mis-filed three tokens because of it.
    expect(Object.keys(actual).length).toBe(16);
  });
});

describe('recognition miss ceiling (SC-002a)', () => {
  it('accepts the expected total across the whole corpus', () => {
    const total = markdownFiles(FIXTURES).reduce(
      (sum, file) => sum + tokenize(readFileSync(file, 'utf8')).length,
      0
    );
    // Frozen. A drop means recognition regressed; a rise means either a fixture
    // grew or something is now being accepted that should not be.
    expect(total).toBe(244);
  });
});

/**
 * NOT YET ENFORCED HERE: SC-002's resolution floor, that at least 98% of
 * recognized references resolve to a definition.
 *
 * Measuring it requires the definition index, which is Phase 3 work (T033).
 * Asserting it now would mean either duplicating extraction in the test, or
 * writing an assertion that cannot fail — and a gate that cannot fail is worse
 * than an absent one, because it reads as covered.
 *
 * The task list records this split so the remaining half is not lost.
 */
