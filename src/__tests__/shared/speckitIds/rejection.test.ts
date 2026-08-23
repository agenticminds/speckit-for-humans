import { tokenizeToIds } from '../../../shared/speckitIds/tokenizer';

/**
 * Contract items C-tok-10 through C-tok-20: nothing that merely looks like an
 * identifier may be accepted.
 *
 * Almost every case below is rejected by one rule — the prefix vocabulary is
 * closed, and the prefix is extracted greedily. There is no denylist. That
 * matters because the alternative was measured: an open prefix set accepted
 * 1,948 non-identifiers over the surveyed corpus.
 */

function rejects(text: string) {
  expect(tokenizeToIds(text)).toEqual([]);
}

describe('named constants (C-tok-10)', () => {
  const constants = [
    'HS256',
    'RS256',
    'AES-256',
    'SHA-256',
    'SHA-1',
    'ES2022',
    'DNS-1123',
    'DNS-01',
    'HTTP-01',
    'HTTP-401',
    'UTF-8',
    'UTF-16',
    'ISO-8601',
    'VT323',
    'P0001',
    'PGRST116',
    'PGRST002',
    'TS7016',
    'X-Kong-Upstream-Latency',
  ];

  it.each(constants)('rejects %s', rejects);

  it('rejects them inside running prose too', () => {
    const text = 'Tokens are HS256 over AES-256 with SHA-256 digests in UTF-8.';
    rejects(text);
  });
});

describe('constants the survey never listed (C-tok-11)', () => {
  const found = [
    'Route53',
    'Auth0',
    'Base64',
    'PG15',
    'PG16',
    'PG17',
    'WebGL2',
    'Qwen3',
    'GPT-5',
    'Deno-2',
    'Tailwind-4',
    'A11y',
    'IX1',
    'K8s',
    'S256',
    'Xabc1234',
    'Spec-014',
    'Large-1000',
    'Phase-1',
    'Phase-8',
    'B-1',
  ];

  it.each(found)('rejects %s with no denylist entry', rejects);
});

describe('greedy prefix extraction (C-tok-12)', () => {
  it('reads TS7016 as prefix TS, never as T followed by a body', () => {
    // Non-greedy extraction would find `T` here, which IS a family prefix, and
    // then happily match a three-digit body.
    rejects('TS7016');
  });

  it('reads PGRST116 as prefix PGRST, never as P', () => {
    rejects('PGRST116');
  });

  it('reads Qwen3 as prefix Qwen, never as Q', () => {
    rejects('Qwen3');
  });

  it('reads Deno-2 as prefix Deno, never as D', () => {
    rejects('Deno-2');
  });
});

describe('priority markers (C-tok-13)', () => {
  const markers = [
    '(Priority: P1)',
    '(Priority: P7)',
    '(P1)',
    '(P2) (P3)',
    'P1→P3',
    'P1/P2',
    'P1–P3',
    'the MVP requires the P1 stories together',
    'P0001',
  ];

  it.each(markers)('rejects %s', rejects);

  it('rejects a bare P followed by digits in every form', () => {
    // Measured: all 725 bare P-plus-digits occurrences in the corpus are
    // priority markers. Not one is an identifier.
    for (let n = 0; n <= 9; n++) {
      rejects(`P${n}`);
    }
  });
});

describe('the grouped namespace still resolves (C-tok-14)', () => {
  it('accepts FR-P07 whole and never emits its tail', () => {
    // One assertion, not two. The scanner resuming at the token's end is what
    // makes the tail unreachable, so this is the same fact stated once.
    expect(tokenizeToIds('FR-P07')).toEqual(['FR-P07']);
  });

  it('accepts the grouped form beside a priority marker in one line', () => {
    const text = 'Story two (Priority: P2) covers FR-P07 and FR-P01.';
    expect(tokenizeToIds(text)).toEqual(['FR-P07', 'FR-P01']);
  });
});

describe('compound fragments (C-tok-15)', () => {
  const fragments = ['CORE', 'UI', 'GUARD', 'VD', 'EX'];

  it.each(fragments)('rejects %s standing alone', rejects);

  it('accepts a namespaced contract whole without emitting its middle segment', () => {
    expect(tokenizeToIds('C-CORE-3')).toEqual(['C-CORE-3']);
    expect(tokenizeToIds('C-GUARD-2')).toEqual(['C-GUARD-2']);
  });

  it('never emits the group letter of a grouped identifier', () => {
    const tokens = tokenizeToIds('FR-G12');
    expect(tokens).toEqual(['FR-G12']);
    expect(tokens).not.toContain('G12');
  });
});

describe('line and file references (C-tok-16)', () => {
  const refs = [
    'spec.md:41-58',
    'editor.ts:1852',
    'provider.ts#L257',
    '~L116-121',
    'L76',
    'L153',
    'L645',
  ];

  it.each(refs)('rejects %s', rejects);

  it('rejects a file reference in prose without swallowing a real identifier', () => {
    const text = 'See spec.md:41-58 for FR-001.';
    expect(tokenizeToIds(text)).toEqual(['FR-001']);
  });
});

describe('filename and word tails (C-tok-17)', () => {
  const tails = ['T038-login-screen.txt', 'T016-scaffolding', 'T041f-era'];

  it.each(tails)('rejects %s', rejects);

  it('still accepts a fully qualified range, where the tail IS an identifier', () => {
    // The right-boundary rule allows a trailing hyphen only when a complete
    // identifier follows it. This is the difference between the two cases.
    expect(tokenizeToIds('T026-T028')).toContain('T026');
    expect(tokenizeToIds('US1-US5')).toContain('US1');
  });
});

describe('case and shape variants (C-tok-18)', () => {
  const variants = ['fr-001', 'FR001', 'FR-', 'FR-1', 'T42', 'us1', 'sc-001'];

  it.each(variants)('rejects %s', rejects);
});

describe('deliberate placeholders (C-tok-19)', () => {
  const placeholders = ['XYZ-999', 'DRAFT-4242', 'MARKER-039'];

  it.each(placeholders)('rejects %s', rejects);
});

describe('out-of-scope single-letter families (C-tok-20)', () => {
  const outOfScope = [
    'L10',
    'V1',
    'A1',
    'S3',
    'U2',
    'B14',
    'E9',
    'G1',
    'M7',
    'I4',
    'H4',
    'W11',
    'N2',
    'TM3',
  ];

  it.each(outOfScope)('rejects %s', rejects);

  it('accepts the hyphenated assumption family while rejecting the unhyphenated one', () => {
    // The hyphen is the whole discriminator here.
    expect(tokenizeToIds('A-1')).toEqual(['A-1']);
    expect(tokenizeToIds('A1')).toEqual([]);
  });
});

describe('an unresolvable identifier is still a token (C-tok-19 boundary)', () => {
  it('recognizes a well-formed identifier that happens to define nothing', () => {
    // Recognition and resolution are separate stages. A withdrawn requirement
    // is shaped correctly, so it tokenizes; it stays plain prose later because
    // the index finds no definition, which is FR-010's job rather than the
    // grammar's.
    expect(tokenizeToIds('FR-015')).toEqual(['FR-015']);
  });
});
