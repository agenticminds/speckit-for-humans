# Spec Kit ID Conventions — Field Survey

**Surveyed**: 2026-08-20
**Corpus**: `~/bl/dev/specs` — 508 markdown files, 45 numbered feature folders plus `briefs/`, `issues/`, `tiny/`
**Method**: 8 parallel sweep agents (by artifact type, by shape, by noise, by policy docs) → 3 adversarial verification lenses (definition-site, reference-traffic, refutation) → independent ground-truth census
**Status**: authoritative input for this feature. Supersedes the earlier assumption that only `FR-` and `SC-` exist.

> All counts are reference occurrences across the corpus. Every family below was confirmed against real files.

---

## 1. Real ID families

### Requirement IDs

| Family | Shape | Refs | Defined in | Definition syntax |
|---|---|---|---|---|
| Functional requirement | `FR-001` | 4810 | `spec.md` | `- **FR-001**: …` bullet (1150 of 1157 definition lines) |
| Functional requirement, grouped | `FR-G01`, `FR-W03`, `FR-A01` | ~700 | `spec.md` | same bullet form |
| Functional requirement, 3-segment | `FR-EX-001`, `SC-EX-001` | few | sidecar `.md` | same bullet form |
| Functional requirement, revised | `FR-005a` … `FR-005f` | 441 | `spec.md` | same bullet form |
| Success criterion | `SC-001` | 1763 | `spec.md` | `- **SC-001**: …` bullet (404 sites) |
| Success criterion, revised | `SC-003a` | 25 | `spec.md` | same |

The grouped form is a **second, undocumented FR namespace**: group letters seen are
`G W R A P D T S C N B E X`. A `FR-\d{3}` rule silently drops all ~700 of them.

Evidence: `~/bl/dev/specs/029-edge-function-bundling/spec.md:123`,
`~/bl/dev/specs/045-github-app-credentials/spec.md:210`,
`~/bl/dev/specs/005-casdoor-supabase-auth/token-refresh-addendum.md:56`,
`~/bl/dev/specs/008-github-fs-adapter/tasks.md:267`,
`~/bl/dev/specs/009-supabase-fs-adapter/example-app.md:122`

### Task IDs

| Family | Shape | Refs | Defined in | Definition syntax |
|---|---|---|---|---|
| Task | `T001` | 5099 | `tasks.md` | **checkbox** bullet: `- [ ] T001`, `- [x] T001`, `- [X] T001` (2363 sites) |
| Task, revised | `T001a` … `T001d` | 48 | `tasks.md` | same |

Largest family in the corpus. Note the definition site is a checkbox item, not a plain bullet.

Evidence: `~/bl/dev/specs/007-fs-adapter/tasks.md:99`

### User story IDs — the important one

| Family | Shape | Refs | Defined in | Definition syntax |
|---|---|---|---|---|
| User story | `US1` … `US9` | 3435 | `spec.md` | **none — no literal definition site exists** |
| Acceptance scenario | `US8-1`, `US2-2` | some | `spec.md`, sidecars | `- [ ] **US8-1**: …` |

`US1` has **zero** literal definition sites. Stories are headed
`### User Story 1 - <title> (Priority: P1)` — the token `US1` never appears in a heading in
any of the 42 `spec.md` files. It is referenced as a tag, e.g. `[US1]`, from `tasks.md`.
Any bullet- or heading-text matcher finds 0 of 3435.

Not `US01`. Not `US-01`. It is `US` + a single digit.

Evidence: `~/bl/dev/specs/028-local-fs-adapter/spec.md:72`,
`~/bl/dev/specs/033-multibase-publishing/spec.md:32`,
`~/bl/dev/specs/028-local-fs-adapter/tasks.md:107`,
`~/bl/dev/specs/011-multibase-platform-cli/ops-install.md:295`,
`~/bl/dev/specs/034-ns-identity-plane/research.md:137`

### Contract IDs

| Family | Shape | Refs | Defined in | Definition syntax |
|---|---|---|---|---|
| Contract, namespaced | `C-ws-1`, `C-reg-4`, `C-git-write-2` | ~700 | `contracts/*.md` | bullet / heading |
| Contract, camelCase namespace | `C-readFile-1`, `C-writeFile-3`, `C-createFolder-2` | — | `contracts/*.md` | bullet / heading |
| Contract, caps namespace | `C-UI-1`, `C-CORE-3`, `C-GUARD-2`, `C-VD-1`, `C-P-4`, `C-E-2` | ~70 | `contracts/*.md` | bullet / heading |
| Contract, bare | `C1` … `C12`, `C-1` … `C-12` | ~37 | `contracts/*.md` | `## C1 …` heading |

30+ namespaces observed. `CORE`, `UI`, `GUARD`, `VD` are **middle segments, not prefixes** —
zero standalone uses.

Evidence: `~/bl/dev/specs/007-fs-adapter/contracts/fs-adapter.contract.md:48`,
`~/bl/dev/specs/018-auth-ui-package/contracts/auth-core.contract.md:33`,
`~/bl/dev/specs/018-auth-ui-package/contracts/auth-ui.contract.md:28`,
`~/bl/dev/specs/037-theme-mode-consolidation/contracts/palette-and-mode.md:5-48`

### Research and decision IDs

| Family | Shape | Refs | Defined in | Definition syntax |
|---|---|---|---|---|
| Research | `R-001` | 357 | `research.md` | `## R-001: …` heading (58 sites) **and** table row `\| R-029 \| …` (40 sites) |
| Research, no hyphen | `R1` … `R12` | ~580 | `research.md` | `## R2. <title>` heading |
| Clarification question | `Q1` … `Q10` | 171 | `research.md`, `briefs/` | heading / bullet |
| Assertion scenario | `AS1` … | some | `tasks.md` | bullet |
| Brief requirement | `BR-1` | 130 | `briefs/*.md` | bullet |
| Architecture decision | `AD-1` | 30 | `briefs/*.md` | bullet |
| Open question | `OQ-1` | 49 | `briefs/*.md` | bullet |
| Assumption / exit / precondition | `A-1`, `E-1`, `P-1` | 34 / 11 / 12 | `quickstart.md`, `tasks.md` | bullet / table row |

`R-001` and `R1` are **the same concept in two incompatible spellings**.

`BR-`, `AD-`, `OQ-` originate in `briefs/` and are then cited from numbered feature folders
(BR 90 refs outside briefs, OQ 42). A tool scoped to `NNN-*/` never finds their definitions.

Evidence: `~/bl/dev/specs/045-github-app-credentials/research.md:10`,
`~/bl/dev/specs/008-github-fs-adapter/research.md:473`,
`~/bl/dev/specs/020-pi-model-selector/research.md:8-24`,
`~/bl/dev/specs/036-ask-user-tool/research.md:22`,
`~/bl/dev/specs/033-multibase-publishing/research.md:102-105`,
`~/bl/dev/specs/briefs/multibase-ingress.md:85,238`,
`~/bl/dev/specs/briefs/multibase-cli-framework.md:203`,
`~/bl/dev/specs/briefs/live-db-queries.md:208`,
`~/bl/dev/specs/007-fs-adapter/tasks.md:171-174`,
`~/bl/dev/specs/039-optional-filesystem-doctree/quickstart.md:83`,
`~/bl/dev/specs/039-optional-filesystem-doctree/tasks.md:117`

### Preconditions — IDs with no number at all

`P-APP-DIR` (26), `P-PLATFORM-LINK` (22), `P-PLATFORM-INSTALLED`, `P-PLATFORM-DIR`,
`P-INSTANCE`, `P-K8S`, `P-CLOUD`, `P-SOPS`, `P-CASDOOR-ADMIN`, `P-AGE-KEYS`, `P-BUN`.

Defined in table rows. Any rule requiring trailing digits rejects this entire family.

---

## 2. Reference forms a per-token matcher gets wrong

| Form | Example | Count | Problem |
|---|---|---|---|
| Slash group | `FR-009/010` | 63 | only the first ID matches |
| Multi-slash group | `FR-012/013/014` | 28 | same |
| SC slash group | `SC-004/005` | 17 | same |
| En-dash range | `FR-017–FR-021` | 24 | middle IDs never linked |
| Ellipsis range | `SC-001…SC-009`, `C-1…C-12`, `A-1…A-9` | some | same |
| Cross-feature qualified | `008 FR-P07`, `013 T080`, `019 FR-010`, `spec 014 FR-028`, `026's FR-030` | 68 | resolves to **another feature folder**, not the current one |
| Tag form | `[US1]` | many | bracketed, inside a task line |

Cross-feature references directly break a one-document-one-spec.md assumption.

Evidence: `~/bl/dev/specs/033-multibase-publishing/data-model.md:79`,
`~/bl/dev/specs/012-model-providers/plan.md:18`,
`~/bl/dev/specs/039-optional-filesystem-doctree/tasks.md:12,117`,
`~/bl/dev/specs/045-github-app-credentials/tasks.md:35`

---

## 3. Must never link

### Deliberate placeholders and negative fixtures

| Token | Where |
|---|---|
| `XYZ-999` | `~/bl/dev/specs/038-pi-agent-sidebar/tasks.md:54` |
| `DRAFT-4242` | `~/bl/dev/specs/038-pi-agent-sidebar/tasks.md:102` |
| `MARKER-039` | `~/bl/dev/specs/039-optional-filesystem-doctree/quickstart.md:38` |
| `FR-015` (intentionally vacant) | `~/bl/dev/specs/029-edge-function-bundling/spec.md:123` |

### Look-alike constants, with counts

`HS256` (46), `AES-256` (39), `ES2022` (33), `SHA-256` (23), `DNS-1123` (22), `DNS-01` (13),
`UTF-8` (8), `RS256` (7), `P0001` (7), `VT323` (5), `UTF-16` (5), `HTTP-01` (5),
`PGRST106` / `PGRST002` / `PGRST116`, `TS7016` (2), `SHA-1` (2), `ISO-8601` (1),
`X-Kong-Upstream-Latency`.

Plus 482 `file:line-line` spans and bare line references like `L76`, `L153`, `L645`.

### The hard collision

`P1`–`P7` priority markers appear 367 times as `(Priority: P1)`. The real `FR-P0#` namespace
tail looks identical once split. A rule accepting bare `P<digits>` mislinks every priority
marker; a rule rejecting it must still catch `FR-P07`.

Evidence: `~/bl/dev/specs/028-local-fs-adapter/spec.md:72` vs
`~/bl/dev/specs/045-github-app-credentials/tasks.md:35`

---

## 4. Prefixes that do NOT exist here

`CHK`, `NFR`, `ADR`, `RISK`, `DEC`, `INV`, `UC`, `TC`, `ISSUE`, `BUG` — **zero occurrences**.
`AC` — 2. Anything on this list in a design doc was inferred from spec-kit in general, not
from this corpus.

Issues are identified by **filename** (`NNN-short-slug.md`), not by an in-text ID.
See `~/bl/dev/specs/issues/README.md:20-23`.

---

## 5. Consequences for this feature

1. **Definition sites are not just bullets.** Four distinct syntaxes carry definitions:
   plain bullet, checkbox bullet, `##` heading, and table row.
2. **The target is not just `spec.md`.** `T###` lives in `tasks.md`, `R-###`/`R#`/`Q#` in
   `research.md`, `C-*` in `contracts/*.md`, `BR-`/`AD-`/`OQ-` in `briefs/*.md`.
3. **`US1` has no definition site.** Linking it requires deriving the anchor from
   `### User Story 1 …` heading text, not from the token.
4. **Cross-feature references exist.** `008 FR-P07` must resolve into a different feature
   folder. The form is a three-digit feature number, whitespace, then the ID — 68 occurrences.
   A slash form (`003/FR-004`) does **not** exist; see the correction note below.
5. **Two spellings for one concept.** `R-001` and `R1`; `C-1` and `C1`.
6. **Some IDs carry no digits.** `P-APP-DIR`.
7. **A permissive regex is dangerous.** ~150 look-alike constants would become broken links,
   and 367 priority markers sit one character away from a real namespace.

The prior spec's assumption — recognize `FR-` and `SC-`, resolve against one `spec.md` —
covers roughly 6600 of the ~18,000 real ID references in this corpus and would mislink
constants. It needs revision.

---

## Corrections to this survey

Measured by the Phase 0 recognition-grammar research ([research.md](./research.md) R-021–R-029) against the same corpus, using a runnable harness rather than pattern-counting. Where the two disagree, the research figures are authoritative.

| This survey said | Actually |
|---|---|
| Cross-feature refs use a slash: `003/FR-004`, `006/SC-002` | **The slash form has zero occurrences.** Both cited lines were slash *groups* misread — `(FR-009/010)` and `SC-006/SC-009`, where the second reading splits an ID in half. The real form is `NNN` + whitespace + ID, 68 occurrences |
| `P-` family: `P-1`, 12 refs | **Zero occurrences.** Every literal `P-1` is the interior of `C-P-1`. Only the digit-free `P-<CAPS-KEBAB>` form is real |
| `E-` family: `E-1`, 11 refs | **Zero occurrences.** Same miscount — all are interiors of `C-E-#` |
| `C-#`: ~37 refs | `C#` (unhyphenated) is **~323** occurrences. This figure counted only the hyphenated form |
| `A-#` defined in `quickstart.md` | Defined in a `contracts/` table |
| `R-###` is 3 digits | **1 to 3.** `R-1`…`R-11` are real, 27 occurrences. An `R-\d{3}` rule drops all of them |
| Task suffixes `a`–`f` | **`a`–`l`.** `T019a`…`T019l` is real; an `[a-f]` cap drops 20+ references |
| 18 families | **19.** `D#` (research decisions, `## D1 — title`) has **617 references** — more than eight of the listed families. Admitted to scope |
| ~150 look-alikes | ~40 more exist: `Route53`, `Auth0`, `Base64`, `PG15/16/17`, `WebGL2`, `Qwen3`, `GPT-5`, `Deno-2`, `Tailwind-4`, `A11y`, `IX1`, `Spec-014`, `Large-1000`, `Phase-1/8`, `B-1`, `K8s`, `S256`, commit hashes. All already rejected by the closed vocabulary — a fixture gap, not a design gap |
| Four definition syntaxes | **Six.** Adds checkbox-with-bolded-ID and bolded-ID-opening-a-paragraph. The missing paragraph form is what capped `AD-#` resolution at 50% |

Also uncovered: `D#`, `R#`, `C#`, and `Q#` are not four families but four instances of **one ad-hoc per-document convention**, `<single uppercase letter><digits>`. The corpus also uses `V#`, `A#`, `S#`, `U#`, `B#`, `E#`, `G#`, `M#`, `L#`, `I#`, `TM#`, `H#`, `W#`, `N#` — roughly 600 further references, all deliberately out of scope. Generalizing to `[A-Z]\d+` would add 1,948 false accepts, because `L#` collides with 108 line references and `P#` with 367 priority markers.
