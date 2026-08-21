# Contract: Recognition Grammar

**Feature**: [spec.md](../spec.md) | **Research**: [research.md](../research.md) (R-021 – R-028)

The tokenizer lives in `src/shared/speckitIds/` and is the only component both runtimes share. It is pure: text in, tokens out, no I/O, no VS Code API, no ProseMirror. That is deliberate — it is the highest-risk piece of the feature and this makes it exhaustively unit-testable.

These contract tests MUST be written and MUST fail before implementation begins (constitution principle 1).

---

## Interface

```ts
tokenize(text: string, opts: { families: IdFamily[] }): IdToken[]
```

Position-bearing but AST-free. Node-level exclusion (stage 0) happens in the caller, because markdown structure is invisible to a text scanner.

---

## Accept

- **C-tok-1**: Every declared family's canonical form is accepted. `FR-001`, `FR-G12`, `FR-EX-001`, `FR-005a`, `SC-001`, `SC-003b`, `T042`, `T019l`, `US2`, `US8-1`, `C-ws-1`, `C-readFile-1`, `C-UI-1`, `C-git-write-2`, `C-P-4`, `C1`, `C-12`, `R-001`, `R-11`, `R2`, `Q1`, `AS1`, `BR-4`, `AD-6`, `OQ-8`, `A-7`, `D13`, `P-APP-DIR`, `P-BUN`.
- **C-tok-2**: Body widths are exact where the corpus is exact. `FR-` takes exactly 3 digits; grouped `FR-<L>` exactly 2; `T` exactly 3; `US` exactly 1. `R-` takes 1–3.
- **C-tok-3**: Task revision suffixes span **`a`–`l`**. `T019a` and `T019l` both accept. A rule capped at `f` fails this contract.
- **C-tok-4**: `P-<CAPS-KEBAB>` accepts with **no digits anywhere**. `P-APP-DIR`, `P-PLATFORM-LINK`, `P-SOPS`, `P-BUN`.
- **C-tok-5**: Multi-segment and camelCase contract namespaces accept. `C-git-write-2`, `C-readFile-1`, `C-createFolder-2`.
- **C-tok-6**: Hyphenated and unhyphenated spellings are **distinct IDs**, not aliases. `R-11` and `R11` resolve independently; `C-1` and `C1` likewise.
- **C-tok-7**: Brackets fall outside the token. `[US1]` yields `US1` spanning only the four ID characters.
- **C-tok-8**: A token adjacent to punctuation accepts with the punctuation outside. `see FR-001.`, `(FR-001)`.
- **C-tok-9**: `per-FR-022`, `clarify-Q1` accept. The left-hyphen predicate must be the refined form — a blanket "reject after a hyphen" fails this and costs 9 real references for no measured gain.

## Reject

- **C-tok-10**: Every named look-alike is rejected: `HS256`, `AES-256`, `ES2022`, `SHA-256`, `SHA-1`, `DNS-1123`, `DNS-01`, `HTTP-01`, `UTF-8`, `UTF-16`, `RS256`, `VT323`, `PGRST106`, `PGRST002`, `PGRST116`, `TS7016`, `ISO-8601`, `X-Kong-Upstream-Latency`.
- **C-tok-11**: Unlisted look-alikes are rejected by the same closed vocabulary, with no denylist entry: `Route53`, `Auth0`, `Base64`, `PG15`, `PG16`, `PG17`, `WebGL2`, `Qwen3`, `GPT-5`, `Deno-2`, `Tailwind-4`, `A11y`, `IX1`, `Spec-014`, `Large-1000`, `Phase-1`, `Phase-8`, `B-1`, `K8s`, `S256`, `Xabc1234`.
- **C-tok-12**: Greedy prefix extraction. `TS7016` yields prefix `TS`, never `T` + `S7016`. `PGRST116` yields `PGRST`, never `P`.
- **C-tok-13**: **Bare `P<digits>` is never a token.** All five priority forms reject: `(Priority: P1)`, `(P1)`, `P1→P3`, `P1/P2`, `P1–P3`, and bare prose `P1`. So does `P0001`.
- **C-tok-14**: `FR-P07` accepts **whole** while `P07` is never emitted. This is one assertion, not two — the scanner resuming at the token's end is what makes it true.
- **C-tok-15**: Compound fragments never emit standalone: `CORE`, `UI`, `GUARD`, `VD`, `EX`, and the `G` of `FR-G12`.
- **C-tok-16**: Line references reject: `file.ts:120-140`, `path.ts#L257`, `~L116-121`, bare `L76`, `L153`, `L645`.
- **C-tok-17**: Filename and word tails reject via the right predicate: `T038-login-screen.txt`, `T016-scaffolding`, `T041f-era`.
- **C-tok-18**: Case and shape variants reject: `fr-001`, `FR001`, bare `FR-`, `FR-1` (needs 3 digits), `T42` (needs 3).
- **C-tok-19**: Placeholders reject: `XYZ-999`, `DRAFT-4242`, `MARKER-039`.
- **C-tok-20**: Out-of-scope single-letter families reject: `L10`, `V1`, `A1`, `S3`, `U2`, `B14`, `E9`, `G1`, `M7`, `I4`, `H4`, `W11`, `N2`, `TM3`. Note `A1` rejects while `A-7` accepts — the hyphen is the discriminator.

## Compressed references

- **C-tok-21**: Abbreviated slash groups expand, one token per ID named. `FR-009/010` → `FR-009`, `FR-010`. `FR-012/013/014` → three. `SC-003/007/008/009/011/012/013` → seven.
- **C-tok-22**: Shape compatibility is enforced against the **head's** body. `FR-A01–A05` → `FR-A01`, `FR-A05` — never `A05`, never `FR-005`.
- **C-tok-23**: Range intermediates are **never** synthesized. `FR-017–FR-021` yields exactly two tokens. `C-1…C-12` yields exactly two.
- **C-tok-24**: All separators are handled, longest-first: `/`, `–` (U+2013), `—` (U+2014), `…` (U+2026), `→` (U+2192), `...`, `..`. Trying `..` before `...` fails this.
- **C-tok-25**: ASCII `-` admits **only fully-qualified** members. `US1-US5` and `T026-T028` expand; `L76-82` and `T016-scaffolding` do not.
- **C-tok-26**: An abbreviated tail never seeds a chain on its own. A bare `010` in running prose yields nothing.
- **C-tok-27**: Comma abbreviation is unsupported. `FR-011, 042` yields only `FR-011`, so that `FR-001, 42 users` cannot misfire.

## Cross-feature qualifiers

- **C-tok-28**: `NNN` + space + ID binds the qualifier: `008 FR-P07`, `013 T080`, `019 FR-010`, `024 D13`.
- **C-tok-29**: Lead words and possessives bind: `spec 014 FR-028`, `026's FR-030`, `008's FR-P07`.
- **C-tok-30**: Binding requires exactly 3 digits and an existing sibling feature directory. `2026 06 19`, `1024 FR-001`, and `100 T042` do not bind.
- **C-tok-31**: A qualifier **retargets** an existing token and never creates one.
- **C-tok-32**: A slash group is never misread as a qualifier. In `SC-006/SC-009`, the `006` is already inside a token and cannot bind.
- **C-tok-33**: The slash qualifier form is **not** supported. `003/FR-004` yields `FR-004` unqualified, resolving against the document's own feature — which per FR-018 means plain prose if not defined locally.

## Ordering guarantees

- **C-tok-34**: On **rejection** the scanner resumes at `start + 1`. Assertion: `versionFR-001` yields **no** tokens — resuming at `end` would hide, then wrongly surface, the inner `R-001`.
- **C-tok-35**: On **acceptance** it resumes at `end`. Assertion: `C-CORE-3` yields exactly one token.
- **C-tok-36**: Output is invariant under family declaration order. Assertion: shuffle the family array N times, assert identical output. This was verified empirically over 12 permutations across the corpus, 18,722 tokens every time.
- **C-tok-37**: Boundary predicates are evaluated at match time, not as a post-filter. Observable via C-tok-34, which a post-filter cannot satisfy.

## Corpus-level acceptance

- **C-tok-38**: Run against a provenance-recorded fixture corpus, the tokenizer produces **zero** false positives across every class in C-tok-10 through C-tok-20, and no more than **0.1%** false negatives.
- **C-tok-39**: Known-wrong cases are asserted **as** known-wrong, so a future change that fixes or worsens them is visible: `(US3-AC4)`, `(US4-AC3)`, `T041f-era`, `T016-scaffolding`, `~T030`, `C8/R10-2`.
- **C-tok-40**: Per-family accept counts are recorded, not merely totalled, so a regression in one family cannot hide inside an unchanged total.
