---

description: "Task list for Spec Kit ID Links"
---

# Tasks: Spec Kit ID Links

**Input**: Design documents from `/specs/001-speckit-id-links/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included and mandatory. The project constitution requires contract tests to lock interfaces before downstream work, and `AGENTS.md` makes test-first non-negotiable. Every contract test must be written and observed failing before its implementation task starts.

**Organization**: Grouped by user story so each ships independently.

## Format: `[ID] [P?] [Story] Description → satisfies`

- **[P]**: Can run in parallel — different files, no dependency on incomplete work
- **[Story]**: Which user story the task serves (US1–US5)
- **→ satisfies**: The requirement, criterion, or contract items the task discharges. A task with no arrow does infrastructure work that no requirement names directly.
- **[Enforced gate]** / **[Recorded]** / **[Manual check]**: verification classification, required by the constitution. Enforced gate fails a phase checkpoint; recorded is measured but non-blocking; manual check needs a person in a real Extension Development Host.
- Exact file paths in every description, **except** the eleven verification and gate tasks that exercise the whole system rather than one file. Those name the quickstart scenario or gate command instead. This is a deliberate, recorded deviation from the strict format rule, not an oversight.

---

## Already complete — not tasks

Recorded so nothing here is claimed twice. Done during planning, out of order, and verified by running it:

- Bun installs dependencies; `bun.lock` committed; npm lockfile deleted.
- Every script in `package.json` invokes `bun run`.
- `bun run lint` clean, `bun run test` passes 958, `bun run build:release` succeeds, `bun run package:release` produces the extension package.
- Extension package no longer ships `.specify/` or `bun.lock` — 94 files down to 72.
- 174 npm-to-Bun replacements across 21 documentation files. Not individually reviewed, by decision: the continuous integration run in T001 proves the ones that execute, and hand-checking mechanical renames is not worth a human's time.

---

## Phase 1: Setup — finish the Bun migration

**Purpose**: Close the two unproven pieces of work already in the tree.

- [X] T001 Push the branch and watch the GitHub Actions run at `.github/workflows/ci.yml`, iterating until every job is green — the Bun setup step and the removal of the npm dependency cache are unverified, and this is the only place they can be proven **[Enforced gate]**
  - Closed out 2026-08-21. Two attempts were needed. The first run failed in the packaging job: the Bun switch had been applied to the test job's toolbox setup but not the packaging job's, which still asked for an npm dependency cache keyed on the deleted lockfile. Both test jobs passed in that same run, proving Bun itself works on the runner. Second run green across all three jobs — `test (22.x)`, `test (24.x)`, `package`.
  - A `workflow_dispatch` trigger was added so CI can be fired from the command line on any branch, since pull requests are not used on this repository and the existing triggers only covered `main`. Fire it with `gh workflow run ci.yml --repo <owner>/<repo> --ref <branch>`.
  - Correction to an earlier note here: the absence of prior runs was **not** a fork permission problem. The dispatch worked on the first attempt. No workflow had ever run simply because no trigger had ever matched.
- [X] T002 [P] Document the nine script names referenced in docs but absent from `package.json` — `type-check`, `build`, `package`, `watch`, `build:webview`, `build:extension`, `build:marketplace`, `package:marketplace`, `lint-staged` — in `docs/BUILD.md`, noting they predate this work and were inherited
- [X] T003 [P] Update `.github/hooks/ENABLE_PRE_COMMIT.md` and `.github/hooks/README.md` so the enable instructions name the Bun commands the hook now runs

---

## Phase 2: Foundational — blocking prerequisites

**Purpose**: Nothing in any user story can be built or tested until these land.

### Gate repairs

- [X] T004 Resolve the Jest worker force-exit warning reported by `bun run test`, root-caused as Jest's own shutdown deadline being too short to reap eleven workers rather than a leaked handle; set `workerGracefulExitTimeout` in `jest.config.js` to a value that reflects the real reaping time, and record in a comment that this corrects a deadline rather than masking a leak
- [X] T005 [P] Replace the real-time wait in the success-toast dismissal test in `src/__tests__/webview/auditOverlay.test.ts` with Jest fake timers, so it stops failing roughly one run in fifteen under load
- [X] T006 Confirm the `bun run validate` gate exits zero with no warning and no new skipped tests, capturing the exit code outside a pipe **[Enforced gate]**

### VS Code mock expansion

- [X] T007 Add `workspace.fs` with `readFile` and `stat` to `src/__mocks__/vscode.ts`
- [X] T008 Add `workspace.createFileSystemWatcher` and `RelativePattern` to `src/__mocks__/vscode.ts`
- [X] T009 Add `workspace.textDocuments`, `workspace.openTextDocument`, and `workspace.findFiles` to `src/__mocks__/vscode.ts`
- [X] T010 Reconcile the local `findFiles` stubs in `src/__tests__/editor/imageReferences.test.ts` and `src/__tests__/editor/imageResizeInPlace.test.ts` against the shared mock, standardising on one approach

### Document path plumbing

- [X] T011 Write a failing test in `src/__tests__/editor/documentPath.test.ts` asserting the `update` payload carries the document's workspace-relative path and that every existing field survives unchanged → C-msg-1
- [X] T012 Add `documentPath` to the `update` payload in `src/editor/MarkdownEditorProvider.ts`, null for any non-file scheme → C-msg-1, FR-019
- [X] T013 Consume `documentPath` in the `update` handler in `src/webview/editor.ts` and store it in module state → FR-015, FR-018

### Recognition grammar — the highest-risk component

- [X] T014 [P] Build the provenance-recorded fixture corpus under `src/__tests__/fixtures/speckit/`, reproducing all six definition syntaxes, all nineteen families, every look-alike class, the priority-marker collision, and every compressed-reference form — each fixture recording the survey section and corpus location its structure derives from, never copying private corpus text → SC-003
- [X] T015 Write the family vocabulary contract test in `src/__tests__/shared/speckitIds/families.test.ts` → C-tok-1 … C-tok-9, FR-001, FR-001a, FR-002, FR-003
- [X] T016 [P] Write the rejection contract test in `src/__tests__/shared/speckitIds/rejection.test.ts`, including the assertion that bare `P` followed by digits never yields a token → C-tok-10 … C-tok-20, FR-007, FR-008, FR-009, FR-001c, SC-003
- [X] T017 [P] Write the boundary-predicate and ordering contract test in `src/__tests__/shared/speckitIds/boundaries.test.ts`, including that `versionFR-001` yields nothing and that output is invariant under family declaration order → C-tok-34 … C-tok-37, FR-009
- [X] T018 Observe T015 through T017 failing, then declare the nineteen families in `src/shared/speckitIds/families.ts` with their exact body shapes → FR-001, FR-001a, FR-002, FR-003
- [X] T019 Implement boundary predicates in `src/shared/speckitIds/boundaries.ts`, including the refined hyphen clause that admits `per-FR-022` while still rejecting compound interiors → FR-009
- [X] T020 Implement the anchored scanner in `src/shared/speckitIds/tokenizer.ts` with greedy prefix matching, resume-at-start-plus-one on rejection, and resume-at-end on acceptance → FR-001, FR-001a, FR-007
- [X] T021 Run T015 through T017 green and record per-family accept counts **[Recorded]** → C-tok-40
- [X] T022 Add a corpus measurement harness in `src/__tests__/shared/speckitIds/corpus.test.ts` that runs the recognizer over the whole fixture corpus and asserts the resolution floor and the recognition-miss ceiling, failing the run if either is breached **[Enforced gate]** → C-tok-38, SC-002, SC-002a
  - **Half done, deliberately.** The recognition-miss ceiling (SC-002a) and the zero-look-alike gate are enforced: frozen per-file and per-family censuses, and a file of pure look-alikes asserted to yield zero tokens. The resolution floor (SC-002) is NOT enforced yet, because measuring it needs the definition index from T033. Asserting it now would mean either duplicating extraction in the test or writing an assertion that cannot fail, and a gate that cannot fail is worse than an absent one because it reads as covered. Recorded in the test file too.

### Shared reveal helper

- [X] T023 [P] Write a failing test in `src/__tests__/webview/scrollToPos.test.ts` asserting a position inside a list item, a task item, and a table cell each resolve to a scrollable element → C-msg-4f
- [X] T024 Extract the node-agnostic reveal from `src/webview/features/searchOverlay.ts` into `src/webview/utils/scrollToPos.ts`, then repoint `searchOverlay.ts` and `src/webview/features/auditOverlay.ts` at it so no third copy exists → FR-022

---

## Phase 3: User Story 1 — Jump from a reference to its definition (Priority: P1) 🎯 MVP

**Goal**: The four highest-volume families — requirements, success criteria, tasks, user stories — render as links and navigate to their definitions. Look-alikes never link.

**Independent test**: Open a feature folder's plan, task list, and specification. Confirm those four families link and navigate, and that a paragraph of constants and priority markers links nothing.

### Tests for User Story 1

- [X] T025 [P] [US1] Write the byte-identity test in `src/__tests__/webview/speckitIdLinks.serialization.test.ts` using the existing real-editor jsdom harness, asserting two editors — one with the extension, one without — produce identical serialized markdown and deep-equal document JSON **[Enforced gate]** → FR-013, FR-024, SC-005
- [X] T026 [P] [US1] Write the definition-extraction test in `src/__tests__/features/speckitIndex/extract.test.ts` for the plain bullet, both checkbox forms, the heading, the table row, the paragraph-leading bold, and the derived user-story heading — plus the assertion that a definition inside a fenced code block is not extracted → FR-011, FR-012, FR-005
- [X] T027 [P] [US1] Write the feature-folder discovery test in `src/__tests__/features/speckitIndex/discovery.test.ts` asserting a folder is found by its numbered name and not by containing a specification file, and that a document outside any numbered folder yields no scope → FR-019
- [X] T028 [P] [US1] Write the decoration test in `src/__tests__/webview/speckitIdLinks.test.ts` asserting resolved tokens gain the existing link class and a data attribute, that code spans and code blocks are skipped, and that text already carrying a link mark is left alone → FR-005, FR-006, FR-020
- [X] T029 [P] [US1] Write the self-reference test in `src/__tests__/webview/speckitIdLinks.selfReference.test.ts` asserting an ID occurring as the leading content of its own definition — bullet, checkbox, heading, table cell, and paragraph alike — is left as plain text while a reference to the same ID elsewhere in that document still links → FR-014
- [X] T030 [P] [US1] Write the source-view test in `src/__tests__/webview/speckitIdLinks.sourceView.test.ts` asserting the plain markdown view shows exactly the stored text with no link markup, for a document whose visual view carries resolved links → FR-023
- [X] T031 [P] [US1] Write the negative no-interruption test in `src/__tests__/webview/speckitIdLinks.noDialog.test.ts` asserting that an unresolvable ID, a stale index naming a deleted file, and a path that fails to resolve each produce no error message, dialog, warning, or badge — the existing local-file handler raises a *File not found* dialog, and this asserts the new path never reaches it **[Enforced gate]** → FR-010, SC-007

### Implementation for User Story 1

- [X] T032 [US1] Implement feature-folder and specs-root discovery in `src/features/speckitIndex/discovery.ts` by walking ancestors for a three-digit-prefixed basename, bailing on any non-file scheme → FR-019
- [X] T033 [US1] Implement definition extraction in `src/features/speckitIndex/extract.ts` by line-scanning raw markdown for all six syntaxes, reusing the fence state machine in `src/shared/blankLinePolicy.ts` rather than writing a second one → FR-011, FR-012, FR-005
- [X] T034 [US1] Implement the index cache in `src/features/speckitIndex/index.ts` keyed by feature root, held on the provider instance rather than per-panel, with first-definition-wins inside one artifact and feature-folder-wins across artifacts → FR-015
- [X] T035 [US1] Add the `speckitIndex` push message in `src/editor/MarkdownEditorProvider.ts`, sent from the ready handler beside the existing settings push, as its own message type and never folded into `update` → C-msg-2
- [X] T036 [US1] Implement the decoration plugin in `src/webview/extensions/speckitIdLinks.ts` as a TipTap extension supplying inline decorations, pruning nodes whose schema marks them as code, skipping code and link marks, and never dispatching a document-changing transaction → FR-005, FR-006, FR-020, FR-024
- [X] T037 [US1] Add self-reference suppression to `src/webview/extensions/speckitIdLinks.ts`, deciding from block shape whether a token is the leading content of its own definition, with no dependence on raw line numbers → FR-014
- [X] T038 [US1] Register the plugin in the static extension array in `src/webview/editor.ts`
- [X] T039 [US1] Add the `openSpeckitDefinition` dispatch branch as the first statement of the link click handler in `src/webview/editor.ts`, keyed on the data attribute and placed ahead of the href read → C-msg-3a, C-msg-3b, FR-021
- [X] T040 [US1] Add the `openSpeckitDefinition` handler in `src/editor/MarkdownEditorProvider.ts` that resolves the path document-relative then workspace-relative, validates containment against the derived roots, and opens the target in this editor rather than the plain text editor → C-msg-3d, C-msg-3e, FR-022
- [X] T041 [US1] Write the readiness test in `src/__tests__/editor/revealReadiness.test.ts` covering all four states a reveal can arrive in — no panel registered, panel registered but its webview has not signalled ready, panel registered and ready, and panel ready then reloaded — asserting the reveal is delivered exactly once in every case and never dropped → C-msg-4d, C-msg-4e
- [X] T042 [US1] Add a `ready` boolean to the `openPanels` entry type in `src/editor/MarkdownEditorProvider.ts`, set false where the panel is registered and set true in the `ready` message handler — panel presence currently cannot be used to infer readiness, because registration happens after the webview HTML is assigned and before its script has loaded → C-msg-4e
- [X] T043 [US1] Add a pending-reveal map in `src/editor/MarkdownEditorProvider.ts` holding at most one reveal per document URI with latest-wins replacement and an expiry, so a reveal for a document that never finishes opening cannot accumulate → C-msg-4d
- [X] T044 [US1] Implement reveal dispatch in `src/editor/MarkdownEditorProvider.ts` as a two-way decision on the readiness flag — send immediately when ready, otherwise store in the pending map — and flush the pending entry for that URI from the `ready` handler, which also covers a reloaded webview because its ready signal fires again in a fresh script context → C-msg-4d, C-msg-4e
- [X] T045 [US1] Add the `revealSpeckitDefinition` handler in `src/webview/editor.ts` that locates the definition in its own document and calls the shared reveal helper, buffering when the editor is not yet constructed → C-msg-4a, C-msg-4b, C-msg-4c, FR-022
- [ ] T046 [US1] Verify quickstart scenarios 1, 2, 4 and 5 in a real Extension Development Host, confirming zero developer-console errors **[Manual check]** → SC-001, SC-008

**Checkpoint**: Requirements, success criteria, tasks and user stories all link and navigate. Feature is shippable here.

---

## Phase 4: User Story 2 — The remaining ID families (Priority: P2)

**Goal**: Contracts, research, questions, briefs, preconditions and assumptions link too.

**Independent test**: Open a contracts file, a research file and a briefs file; confirm those families resolve.

- [X] T047 [P] [US2] Extend the family contract test in `src/__tests__/shared/speckitIds/families.test.ts` to cover namespaced and camelCase contract identifiers, both research spellings, and the digit-free precondition family → FR-001, FR-002, FR-003
- [X] T048 [US2] Extend `src/features/speckitIndex/discovery.ts` to include the shared briefs folder, which sits outside every feature folder → FR-016
- [X] T049 [US2] Extend `src/features/speckitIndex/index.ts` so each family resolves against an ordered list of candidate artifacts rather than a single owner → FR-015
- [ ] T050 [US2] Verify quickstart scenario 3 and the contracts, research and briefs rows of scenario 5 in the Extension Development Host **[Manual check]** → FR-016

---

## Phase 5: User Story 3 — Compressed references (Priority: P3)

**Goal**: Every identifier named inside a group or range is separately activatable.

**Independent test**: A document containing slash groups, dash ranges, ellipsis ranges and a bracketed tag; confirm each named identifier activates.

- [ ] T051 [P] [US3] Write the expansion contract test in `src/__tests__/shared/speckitIds/expand.test.ts`, including that range intermediates are never synthesized **[Enforced gate]** → C-tok-21 … C-tok-27, FR-004, SC-004
- [ ] T052 [US3] Implement continuation expansion in `src/shared/speckitIds/expand.ts`, seeding only from confirmed anchors, validating abbreviated tails against the head's body shape, trying separators longest-first, and admitting only fully-qualified members after an ASCII hyphen → FR-004
- [ ] T053 [US3] Verify the compressed-reference fixture in the Extension Development Host **[Manual check]** → SC-004

---

## Phase 6: User Story 4 — Cross-feature references (Priority: P4)

**Goal**: A reference naming another feature's number crosses into that feature's folder.

**Independent test**: A task list in one feature referencing identifiers in others; confirm each opens the named feature's artifact.

- [ ] T054 [P] [US4] Write the qualifier contract test in `src/__tests__/shared/speckitIds/qualifiers.test.ts`, including that an unqualified reference never falls through to another feature and that the slash form is not supported → C-tok-28 … C-tok-33, FR-017, FR-018
- [ ] T055 [US4] Implement qualifier binding in `src/shared/speckitIds/qualifiers.ts`, retargeting existing tokens only, requiring exactly three digits and an existing sibling feature directory, and accepting a lead word or possessive → FR-017
- [ ] T056 [US4] Extend `src/features/speckitIndex/index.ts` to index a qualified sibling feature on demand and cache it, without eagerly indexing every feature → FR-017
- [ ] T057 [US4] Verify the cross-feature rows of quickstart scenario 5, including that a traversal attempt inside a qualifier is rejected **[Manual check]** → FR-017, FR-018

---

## Phase 7: User Story 5 — References keep up while artifacts are edited (Priority: P5)

**Goal**: Links change state as definitions are added, renamed or removed, with no user action.

**Independent test**: Two documents from one feature open side by side; edit an identifier in one and watch the other change without being touched.

- [ ] T058 [P] [US5] Write the freshness test in `src/__tests__/features/speckitIndex/watch.test.ts` asserting both an unsaved edit in an open document and an on-disk change to an unopened file trigger re-indexing, and that a revision going backwards is treated as link-nothing → C-msg-2c, C-msg-2d, FR-025
- [ ] T059 [US5] Add one unfiltered workspace-wide document-change listener in `src/features/speckitIndex/watch.ts`, following the pattern in `src/features/wordCount.ts` rather than extending the per-panel listener, which is filtered to its own document → FR-025
- [ ] T060 [US5] Add a file-system watcher scoped to the feature root and the briefs folder in `src/features/speckitIndex/watch.ts`, covering files nobody has open → FR-025
- [ ] T061 [US5] Implement the dirty-correct reader in `src/features/speckitIndex/index.ts` that prefers an open document's in-memory text and falls back to reading from disk, without force-opening every artifact → FR-025
- [ ] T062 [US5] Debounce re-indexing in `src/features/speckitIndex/watch.ts` at the project's existing sync cadence and re-extract only the changed file, pushing to every panel under the changed feature root → C-msg-2f, FR-025
- [ ] T063 [US5] Verify both halves of quickstart scenario 6 — the unsaved-edit path and the on-disk path — in the Extension Development Host **[Manual check]** → SC-006

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T064 Strip elements carrying the identifier data attribute in `src/webview/utils/exportContent.ts` so exported documents carry no dead links
- [ ] T065 [P] Add structured per-stage timing in `src/features/speckitIndex/index.ts` and `src/webview/extensions/speckitIdLinks.ts` for tokenize, read, extract, resolve and decorate, reporting reads separately from extraction so a regression is attributable **[Recorded]** → SC-009
- [ ] T066 [P] Add the nineteenth family, research decisions, to `src/shared/speckitIds/families.ts` with its heading-defined extraction → FR-001b
- [ ] T067 [P] Document the feature in `README.md` and the wiki, covering what links, what deliberately does not, and that files are never modified
- [ ] T068 [P] Update `vibe-coding-rules/env-context.md` per the documentation-trigger table, since this adds a TipTap extension and changes key file locations
- [ ] T069 [P] Add the terms this feature introduces to `docs/glossary.md`
- [ ] T070 Run quickstart scenarios 7 and 8, confirming exports are clean and per-stage timings are recorded with three hundred definitions loaded **[Manual check]** → SC-009
- [ ] T071 Run the full `bun run validate` gate and confirm the extension package still excludes planning metadata **[Enforced gate]**

---

## Requirement coverage

Every functional requirement and success criterion, with the tasks that discharge it. Constitution principle 1 requires verification to be defined before implementation, so a requirement whose only entry is an implementation task is a defect in this table, not a shortcut.

| Requirement | Tasks |
|---|---|
| FR-001 recognize nineteen families | T015, T018, T020, T047, T066 |
| FR-001a closed vocabulary, greedy prefix | T015, T018, T020 |
| FR-001b research-decision family | T066 |
| FR-001c no other single-letter family | T016 |
| FR-002 hyphenated and unhyphenated are distinct | T015, T018, T047 |
| FR-003 no trailing-digit requirement | T015, T018, T047 |
| FR-004 one link per ID in a compressed reference | T051, T052 |
| FR-005 code spans and blocks excluded both sides | T026, T028, T033, T036 |
| FR-006 author-written links untouched | T028, T036 |
| FR-007 reject look-alikes | T016, T020 |
| FR-008 reject priority markers, resolve the namespace | T016 |
| FR-009 reject compound interiors | T016, T017, T019 |
| FR-010 unresolved is plain, with no interruption | T031 |
| FR-011 six definition syntaxes | T026, T033 |
| FR-012 user-story target derived from its heading | T026, T033 |
| FR-013 targets established at view time | T025 |
| FR-014 defining occurrence stays plain | T029, T037 |
| FR-015 resolve within the document's own folder | T013, T034, T049 |
| FR-016 briefs folder resolves | T048, T050 |
| FR-017 cross-feature qualified reference resolves | T054, T055, T056, T057 |
| FR-018 unqualified never falls through | T013, T054, T057 |
| FR-019 no feature folder means nothing links | T012, T027, T032 |
| FR-020 existing link appearance | T028, T036 |
| FR-021 existing activation gesture | T039 |
| FR-022 activating shows the artifact and reveals | T024, T040, T045 |
| FR-023 source view unaffected | T030 |
| FR-024 no file altered at either end | T025, T036 |
| FR-025 live refresh across open documents | T058, T059, T060, T061, T062 |
| SC-001 single deliberate action | T046 |
| SC-002 resolution floor | T022 |
| SC-002a recognition-miss ceiling | T022 |
| SC-003 zero look-alikes linked | T014, T016 |
| SC-004 every named ID activatable | T051, T053 |
| SC-005 zero bytes added | T025 |
| SC-006 refresh with no user action | T063 |
| SC-007 zero interruptions | T031 |
| SC-008 indistinguishable from a real link | T046 |
| SC-009 per-stage timings recorded | T065, T070 |

Coverage: 37 of 37.

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1** is independent and can run at any time. T001 should run first regardless, since an unverified continuous integration config gets more expensive to debug the more commits pile on top.
- **Phase 2** blocks every user story. Within it: gate repairs, mock expansion and document-path plumbing are mutually independent; the grammar depends on the fixture corpus; the reveal helper is independent of all of it.
- **Phase 3** depends on all of Phase 2.
- **Phases 4 through 7** each depend on Phase 3 and on nothing else. They may run in any order or concurrently.
- **Phase 8** depends on Phase 3 at minimum. T066 is independent of everything.

### Within each story

Tests first, observed failing, then implementation. The constitution treats a test written after its implementation as insufficient evidence.

### Parallel opportunities

- Phase 1: T002 and T003 together.
- Phase 2: the three gate repairs, the three mock tasks, the document-path trio, the fixture corpus and the reveal helper are five independent tracks. The three grammar contract tests (T015–T017) are parallel to each other.
- Phase 3: all seven test tasks (T025–T031) are parallel.
- Phases 4 through 7 are parallel to each other once Phase 3 lands.
- Phase 8: T065 through T069 are all parallel.

---

## Implementation Strategy

### Minimum shippable product

Phases 1, 2 and 3. That delivers the four families carrying roughly thirteen thousand of the eighteen thousand references in the surveyed corpus, with look-alikes correctly ignored. Stop there and the feature is genuinely useful.

### Order after that

Add Phase 4 for coverage, then 5 and 6 for reference forms, then 7 for liveness. Each is a standalone increment.

### The two tasks most likely to sink the schedule

T020, the scanner, and T041 through T044, the reveal readiness handling. The first carries every correctness guarantee in the feature. The second was originally one vague task and is now four, because panel presence cannot be used to infer that a webview can receive a message — registration happens before the webview script loads. Getting that wrong produces the failure where the first click works and the second silently does nothing.

---

## Notes

- The grammar in `src/shared/speckitIds/` is pure: text in, tokens out, no file access, no editor API. Keep it that way. It is why the highest-risk component is also the cheapest to test.
- The decoration plugin must never dispatch a document-changing transaction. That single constraint is what stops the refresh loop from running forever, and the byte-identity requirement demands it anyway.
- Per the constitution, the file-system reads and the live-refresh path may not be proven with the mock. They need the Extension Development Host.
- Verification classification: **7 enforced gates**, **6 manual checks**, **2 recorded**. The remaining 56 are implementation or authoring work whose verification lives in the test task that precedes it.
- 55 of 71 tasks carry a traceability arrow. The 16 without it are infrastructure that no requirement names directly — expanding the VS Code mock, updating hook documentation, registering the plugin — and that is deliberate rather than a coverage hole.
