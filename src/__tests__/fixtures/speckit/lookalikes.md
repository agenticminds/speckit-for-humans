# Look-alikes

Fixture. Every token here is shaped like a spec-kit identifier and **must never
be linked**. Counts are corpus occurrences. See ./PROVENANCE.md.

This file is deliberately outside any numbered feature folder, which means
the feature-folder rule alone would keep it inert. That is not the point: the tokenizer must
reject every line below on shape, so that the same text inside a feature folder
is equally safe.

## Cryptographic and hash constants

Tokens are signed HS256 or RS256. Payloads use AES-256. Digests are SHA-256,
and one legacy path still emits SHA-1. The PKCE challenge method is S256. The
elliptic curve is P-256.

## Encodings, versions, and formats

Text is UTF-8, with a legacy UTF-16 path. Timestamps are ISO-8601. The build
targets ES2022. The font is VT323. Images are Base64.

## Network and infrastructure labels

Hostnames follow DNS-1123. Challenges are DNS-01 or HTTP-01. DNS lives on
Route53. Identity is Auth0. The cluster is K8s. The database is PG16.

## Error codes

The database raises PGRST116 and P0001. The compiler raises TS7016. A gateway
returns HTTP-401.

## Priority markers

Every one of these is a priority, not an identifier. All 725 bare `P<digits>`
occurrences in the surveyed corpus were priority markers; not one was an ID.

Story one is (Priority: P1). Story two is (Priority: P2). Setup is (P1) and
polish is (P3). Ordering runs P1→P3, or written P1/P2, or as a range P1–P3.
In prose: the MVP needs the P1 stories together, then P2.

## Line and file references

See spec.md:41-58 for the requirement. The handler is at editor.ts:1852.
Deep links carry a fragment: provider.ts#L257. Ranges appear as ~L116-121.
Bare line refs in prose: L76, L153, L645.

## Deliberate placeholders

Negative fixtures from the corpus: XYZ-999, DRAFT-4242, MARKER-039.

## Compound fragments

These are middle segments of contract identifiers, never standalone: CORE, UI,
GUARD, VD. This one is the prefix segment of a three-part identifier: EX.
This is the group letter of a grouped requirement, stripped of its prefix and
therefore not an identifier: G12.

## Filename and word tails

The asset T038-login-screen.txt. The folder T016-scaffolding. The phrase
T041f-era. The scenarios (US3-AC4) and (US4-AC3).

## Out-of-scope single-letter families

Real conventions in the corpus, roughly 600 references, deliberately excluded by
the closed-vocabulary rule, because admitting the general form reintroduces the
line-reference and priority-marker collisions with no shape-level discriminator:

L10, V1, A1, S3, U2, B14, E9, G1, M7, I4, H4, W11, N2, TM3.

## Case and shape variants

Lower case fr-001. No separator FR001. Bare prefix FR-. Too few digits FR-1 and
T42. Identifier embedded in a word: versionFR-001.

## Commit hashes and mixed tokens

Commit Xabc1234. Sizes Large-1000. Phases Phase-1 and Phase-8. Variant B-1.
Accessibility A11y. Index IX1. Model Qwen3 and GPT-5. Runtime Deno-2.
Framework Tailwind-4. Renderer WebGL2. Header X-Kong-Upstream-Latency.
Spec reference Spec-014.
