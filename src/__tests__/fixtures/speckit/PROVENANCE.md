# Fixture Corpus Provenance

**Purpose**: exercise spec-kit ID recognition and definition extraction against every structure that occurs in real spec-kit documents.

**Why this file exists**: the project constitution requires test assets to be traceable to real sources and forbids silently substituting synthetic data. It also forbids publishing private material. The corpus these structures were observed in — 508 markdown files across 45 feature folders — is a **private repository**, and this one is public and MIT-licensed, so its text cannot be copied here.

The resolution: every structure below reproduces a form observed in that corpus, and records where it was observed. The *shapes* are real and attributable. The *prose* is written fresh, so nothing private is republished.

Anyone changing these fixtures must keep that split: copy the shape, never the sentence.

---

## Source

Survey of `~/bl/dev/specs` recorded in [`specs/001-speckit-id-links/id-conventions-survey.md`](../../../../specs/001-speckit-id-links/id-conventions-survey.md), with the measured grammar findings in [`research.md`](../../../../specs/001-speckit-id-links/research.md) sections R-021 through R-029.

Corpus census at time of survey: 508 files, 18,722 recognized ID tokens, 1,067 distinct IDs, 19 families.

---

## Structures reproduced, and where each was observed

### Definition syntaxes — all six

| Fixture location | Structure | Observed at |
|---|---|---|
| `specs/001-example-feature/spec.md` | plain bullet, bolded ID, trailing colon | `029-edge-function-bundling/spec.md:123` |
| `specs/briefs/example-brief.md` | plain bullet, bolded ID, **no** colon | `briefs/multibase-ingress.md:92` |
| `specs/001-example-feature/tasks.md` | checkbox bullet, bare ID | `007-fs-adapter/tasks.md:99` |
| `specs/001-example-feature/tasks.md` | checkbox bullet, bolded ID | `011-multibase-platform-cli/ops-install.md:295` |
| `specs/001-example-feature/research.md` | `##` heading, four separator forms | `045-github-app-credentials/research.md:10`, `020-pi-model-selector/research.md:8`, `037-theme-mode-consolidation/contracts/palette-and-mode.md:5` |
| `specs/001-example-feature/research.md` | table row, bare / backticked / bolded first cell | `008-github-fs-adapter/research.md:472`, `032-multibase-cli-framework/research.md:142`, `briefs/multibase-cli-reference.md:32` |
| `specs/briefs/example-brief.md` | bolded ID opening a paragraph | `briefs/multibase-ingress.md` (`**AD-4 — …**`, `**AD-5** When…`, `**AD-6 (BR-17)** All…`) |
| `specs/001-example-feature/spec.md` | user-story heading, no literal token | `028-local-fs-adapter/spec.md:91` |

### Families — all nineteen

| Fixture | Family | Observed count in corpus |
|---|---|---|
| `spec.md` | `FR-###` | 5,303 |
| `spec.md` | `FR-<letter>##` grouped | 670 |
| `spec.md` | `FR-###a` revision-suffixed | 441 |
| `spec.md` | `FR-EX-###` three-segment | 15 |
| `spec.md` | `SC-###`, `SC-###a` | 1,822 |
| `spec.md` | `US#`, `US#-#` | 3,248 |
| `tasks.md` | `T###`, `T###a` (suffix range reaches `l`) | 5,298 |
| `research.md` | `R-###` (1–3 digits) | 331 |
| `research.md` | `R#` unhyphenated | 603 |
| `research.md` | `D#` research decisions | 617 |
| `research.md` | `Q#` | 170 |
| `tasks.md` | `AS#` | 6 |
| `contracts/example.contract.md` | `C-<ns>-#`, camelCase and caps namespaces | 562 |
| `contracts/example.contract.md` | `C#`, `C-#` | 355 |
| `briefs/example-brief.md` | `BR-#` | 128 |
| `briefs/example-brief.md` | `AD-#` | 30 |
| `briefs/example-brief.md` | `OQ-#` | 49 |
| `briefs/example-brief.md` | `A-#` | 34 |
| `briefs/example-brief.md` | `P-<CAPS-KEBAB>` digit-free | 94 |

### Look-alikes — must never link

`lookalikes.md` collects every rejection class. Counts are corpus occurrences.

Constants: `HS256` (46), `AES-256` (39), `ES2022` (33), `SHA-256` (23), `DNS-1123` (22), `DNS-01` (13), `UTF-8` (8), `RS256` (7), `P0001` (7), `VT323` (5), `UTF-16` (5), `HTTP-01` (5), `PGRST116`, `TS7016` (2), `SHA-1` (2), `ISO-8601` (1).

Unlisted constants found during grammar work: `Route53`, `Auth0`, `Base64`, `PG16`, `WebGL2`, `Qwen3`, `GPT-5`, `Deno-2`, `Tailwind-4`, `A11y`, `IX1`, `K8s`, `S256`, commit hashes.

Priority markers: 367 occurrences of `(Priority: P#)`, plus `(P1)`, `P1→P3`, `P1/P2`, `P1–P3`, and bare prose. **All 725 bare `P<digits>` occurrences in the corpus are priority markers. Not one is an ID.**

Line references: 730 `file:line` spans, 47 `#L` fragments, bare `L76`-style refs.

Deliberate placeholders: `XYZ-999` (`038-pi-agent-sidebar/tasks.md:54`), `DRAFT-4242` (`:102`), `MARKER-039` (`039-optional-filesystem-doctree/quickstart.md:38`).

Compound fragments: `CORE`, `UI`, `GUARD`, `VD`, `EX`, and the group letter of a grouped ID.

Out-of-scope single-letter families: `L#`, `V#`, `A#` (unhyphenated), `S#`, `U#`, `B#`, `E#`, `G#`, `M#`, `I#`, `H#`, `W#`, `N#`, `TM#`. Real conventions, roughly 600 references, deliberately excluded per FR-001c.

### Reference forms

| Fixture | Form | Observed count |
|---|---|---|
| `plan.md` | slash group, abbreviated members | 132 chains, 214 expanded members |
| `plan.md` | slash group, fully qualified | 205 chains |
| `plan.md` | en-dash range (U+2013) | 345 |
| `plan.md` | ellipsis range (U+2026) | ~40 |
| `plan.md` | `..` range | 50 |
| `plan.md` | arrow sequence (U+2192) | some |
| `plan.md` | ASCII-hyphen range, fully qualified only | 3 |
| `tasks.md` | bracketed tag `[US1]` | many |
| `tasks.md` | cross-feature qualifier, `NNN` + space + ID | 68 |

Note the slash cross-feature form (`003/FR-004`) is **absent by design**. It has zero corpus occurrences; the survey's claim to the contrary was a misreading of slash groups. See research R-025.

---

## Expected census

`census.json` holds the counts a recognizer must produce over this corpus. It is the enforced gate for SC-002 and SC-002a. Update it deliberately, never to make a failing run pass.
