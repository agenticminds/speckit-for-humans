/**
 * The closed vocabulary of spec-kit identifier families.
 *
 * Shared by both runtimes: the webview decides what to decorate, the extension
 * host decides what to index, and they must agree exactly. This module is pure —
 * no file access, no VS Code API, no ProseMirror — which is why the riskiest
 * component in the feature is also the cheapest to test.
 *
 * The vocabulary being CLOSED is the single most important decision here
 * (FR-001a). Measured over a 508-file corpus, an open prefix set of the form
 * `[A-Z][A-Za-z]{0,5}-?\d{1,4}[a-z]?` accepted 1,948 tokens that are not
 * identifiers: every named cryptographic constant, every language version, and
 * 611 priority markers. Adding a prefix here is a deliberate spec change.
 *
 * Body widths are exact where the corpus is exact. Each one was measured, and
 * the obvious wrong guess drops real references — see the notes on each family.
 */

/** Which spelling a family uses. Some concepts appear as both, and they are NOT aliases. */
export type Separator = 'hyphen' | 'none';

export interface IdFamily {
  /** Letter prefix, before any separator. Matched greedily against the source text. */
  readonly prefix: string;
  readonly separator: Separator;
  /**
   * Sticky pattern matching a complete identifier starting at `lastIndex`.
   * Includes the prefix and separator.
   */
  readonly pattern: RegExp;
  /**
   * Fully anchored pattern for the identifier part alone, with no prefix or
   * separator. Used to validate an abbreviated member of a compressed reference
   * against the shape of the chain's head, so that `FR-A01–A05` yields
   * `FR-A05` rather than `A05` or `FR-005`.
   */
  readonly bodyPattern: RegExp;
  readonly meaning: string;
  /**
   * Artifacts that may define this family, in search order. A search order, not
   * a single owner: the corpus defines `Q#` in the shared briefs folder while
   * referencing it from research, and defines one precondition identifier in
   * both places.
   */
  readonly owningArtifacts: readonly string[];
}

const SPEC = ['spec.md'];
const TASKS = ['tasks.md'];
const RESEARCH = ['research.md'];
const CONTRACTS = ['contracts/'];
const BRIEFS = ['briefs/'];

/**
 * All nineteen families, most specific first.
 *
 * Declaration order is deliberate policy, not a correctness requirement. The
 * scanner takes the longest match at each position, and the patterns are
 * pairwise disjoint at any given start offset — verified by shuffling this
 * array and asserting identical output (C-tok-36). Ordering longest-first keeps
 * that property obvious to whoever adds the twentieth family.
 */
export const ID_FAMILIES: readonly IdFamily[] = [
  // --- Three-segment forms. Must precede the two-segment forms they contain.
  {
    prefix: 'FR',
    separator: 'hyphen',
    pattern: /FR-EX-\d{3}[a-f]?/y,
    bodyPattern: /^EX-\d{3}[a-f]?$/,
    meaning: 'Functional requirement, example-app namespace',
    owningArtifacts: SPEC,
  },
  {
    prefix: 'SC',
    separator: 'hyphen',
    pattern: /SC-EX-\d{3}[a-f]?/y,
    bodyPattern: /^EX-\d{3}[a-f]?$/,
    meaning: 'Success criterion, example-app namespace',
    owningArtifacts: SPEC,
  },

  // --- Grouped forms. Body is EXACTLY two digits, which is the only thing
  // keeping `FR-T01–T03` from colliding with three-digit task identifiers.
  {
    prefix: 'FR',
    separator: 'hyphen',
    pattern: /FR-[A-Z]\d{2}[a-f]?/y,
    bodyPattern: /^[A-Z]\d{2}[a-f]?$/,
    meaning: 'Functional requirement, grouped namespace',
    owningArtifacts: SPEC,
  },
  {
    // Zero corpus occurrences. Kept for symmetry with the grouped FR form so
    // that a spec which starts using it is handled without a code change.
    prefix: 'SC',
    separator: 'hyphen',
    pattern: /SC-[A-Z]\d{2}[a-f]?/y,
    bodyPattern: /^[A-Z]\d{2}[a-f]?$/,
    meaning: 'Success criterion, grouped namespace',
    owningArtifacts: SPEC,
  },

  // --- Plain numeric forms. Exactly three digits.
  {
    prefix: 'FR',
    separator: 'hyphen',
    pattern: /FR-\d{3}[a-f]?/y,
    bodyPattern: /^\d{3}[a-f]?$/,
    meaning: 'Functional requirement',
    owningArtifacts: SPEC,
  },
  {
    prefix: 'SC',
    separator: 'hyphen',
    pattern: /SC-\d{3}[a-f]?/y,
    bodyPattern: /^\d{3}[a-f]?$/,
    meaning: 'Success criterion',
    owningArtifacts: SPEC,
  },

  // --- Contract identifiers. The namespaced form must precede the bare forms.
  // Namespace segments are lowercase, camelCase, multi-segment kebab, or
  // uppercase; all four occur. A single uppercase letter is a valid namespace,
  // which is why `C-P-4` is a contract identifier and not a precondition.
  {
    prefix: 'C',
    separator: 'hyphen',
    pattern: /C-(?:[A-Za-z][A-Za-z0-9]*-)+\d{1,3}[a-z]?/y,
    bodyPattern: /^(?:[A-Za-z][A-Za-z0-9]*-)+\d{1,3}[a-z]?$/,
    meaning: 'Contract, namespaced',
    owningArtifacts: CONTRACTS,
  },
  {
    prefix: 'C',
    separator: 'hyphen',
    pattern: /C-\d{1,2}[a-z]?/y,
    bodyPattern: /^\d{1,2}[a-z]?$/,
    meaning: 'Contract, hyphenated',
    owningArtifacts: CONTRACTS,
  },
  {
    // The unhyphenated spelling of the same concept. NOT an alias: `C-1` and
    // `C1` are different identifiers in different files.
    prefix: 'C',
    separator: 'none',
    pattern: /C\d{1,2}[a-z]?/y,
    bodyPattern: /^\d{1,2}[a-z]?$/,
    meaning: 'Contract, unhyphenated',
    owningArtifacts: CONTRACTS,
  },

  // --- Tasks. Suffix range reaches `l`, not `f`. A rule capped at `f` drops
  // more than twenty real references.
  {
    prefix: 'T',
    separator: 'none',
    pattern: /T\d{3}[a-l]?/y,
    bodyPattern: /^\d{3}[a-l]?$/,
    meaning: 'Task',
    owningArtifacts: TASKS,
  },

  // --- User stories. Exactly one digit; no double-digit story exists. The
  // optional `-n` tail is an acceptance-scenario sub-identifier.
  {
    prefix: 'US',
    separator: 'none',
    pattern: /US\d(?:-\d{1,2})?/y,
    bodyPattern: /^\d(?:-\d{1,2})?$/,
    meaning: 'User story, or acceptance scenario within one',
    owningArtifacts: SPEC,
  },

  // --- Research. One to three digits: `R-1` through `R-11` are real, so a
  // three-digit-only rule drops all of them.
  {
    prefix: 'R',
    separator: 'hyphen',
    pattern: /R-\d{1,3}/y,
    bodyPattern: /^\d{1,3}$/,
    meaning: 'Research question, hyphenated',
    owningArtifacts: RESEARCH,
  },
  {
    prefix: 'R',
    separator: 'none',
    pattern: /R\d{1,2}[a-b]?/y,
    bodyPattern: /^\d{1,2}[a-b]?$/,
    meaning: 'Research question, unhyphenated',
    owningArtifacts: RESEARCH,
  },

  // --- Research decisions. The nineteenth family (FR-001b), carrying more
  // references than eight of the others combined.
  {
    prefix: 'D',
    separator: 'none',
    pattern: /D\d{1,2}/y,
    bodyPattern: /^\d{1,2}$/,
    meaning: 'Research decision',
    owningArtifacts: RESEARCH,
  },

  // --- Clarification questions and assertion scenarios.
  {
    prefix: 'Q',
    separator: 'none',
    pattern: /Q\d{1,2}/y,
    bodyPattern: /^\d{1,2}$/,
    meaning: 'Clarification question',
    owningArtifacts: [...RESEARCH, ...BRIEFS],
  },
  {
    prefix: 'AS',
    separator: 'none',
    pattern: /AS\d{1,2}/y,
    bodyPattern: /^\d{1,2}$/,
    meaning: 'Assertion scenario',
    owningArtifacts: TASKS,
  },

  // --- Brief-stage families. Defined in the shared briefs folder, which sits
  // outside every feature folder, and cited from inside them (FR-016).
  {
    prefix: 'BR',
    separator: 'hyphen',
    pattern: /BR-\d{1,3}/y,
    bodyPattern: /^\d{1,3}$/,
    meaning: 'Brief-stage requirement',
    owningArtifacts: BRIEFS,
  },
  {
    prefix: 'AD',
    separator: 'hyphen',
    pattern: /AD-\d{1,2}/y,
    bodyPattern: /^\d{1,2}$/,
    meaning: 'Architecture decision',
    owningArtifacts: BRIEFS,
  },
  {
    prefix: 'OQ',
    separator: 'hyphen',
    pattern: /OQ-\d{1,2}/y,
    bodyPattern: /^\d{1,2}$/,
    meaning: 'Open question',
    owningArtifacts: BRIEFS,
  },
  {
    prefix: 'A',
    separator: 'hyphen',
    pattern: /A-\d{1,2}/y,
    bodyPattern: /^\d{1,2}$/,
    meaning: 'Assumption',
    owningArtifacts: [...BRIEFS, ...CONTRACTS],
  },

  // --- Preconditions. Digit-free (FR-003), so any rule requiring a trailing
  // number rejects this family entirely. Requiring an uppercase letter after
  // the hyphen is also what rejects the NIST curve `P-256`.
  {
    prefix: 'P',
    separator: 'hyphen',
    pattern: /P-[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*/y,
    bodyPattern: /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*$/,
    meaning: 'Precondition',
    owningArtifacts: [...BRIEFS, ...RESEARCH],
  },
] as const;

/**
 * Every declared prefix. The scanner extracts the maximal letter run at a
 * candidate position and rejects immediately if it is absent from this set.
 *
 * That one check, with GREEDY prefix extraction, rejects the entire named
 * constant set with no denylist: `HS256` yields `HS`, `PGRST116` yields
 * `PGRST`, `TS7016` yields `TS`, `DNS-1123` yields `DNS`. None are prefixes.
 * Non-greedy extraction would yield `T` from `TS7016` and wrongly proceed.
 */
export const FAMILY_PREFIXES: ReadonlySet<string> = new Set(
  ID_FAMILIES.map(family => family.prefix)
);

/** Prefixes that appear in a hyphenated family. */
export const HYPHENATED_PREFIXES: ReadonlySet<string> = new Set(
  ID_FAMILIES.filter(family => family.separator === 'hyphen').map(family => family.prefix)
);

/** Prefixes that appear in an unhyphenated family. */
export const UNHYPHENATED_PREFIXES: ReadonlySet<string> = new Set(
  ID_FAMILIES.filter(family => family.separator === 'none').map(family => family.prefix)
);

/** Families sharing a prefix, in declaration order. */
export function familiesForPrefix(prefix: string): readonly IdFamily[] {
  return ID_FAMILIES.filter(family => family.prefix === prefix);
}
