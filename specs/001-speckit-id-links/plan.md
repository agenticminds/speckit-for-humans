# Implementation Plan: Spec Kit ID Links

**Branch**: `001-speckit-id-links` | **Date**: 2026-08-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-speckit-id-links/spec.md`

**Grounding**: [id-conventions-survey.md](./id-conventions-survey.md) — field survey of 508 real spec files, 18 ID families, ~18,000 references.

## Summary

Recognize spec-kit ID tokens (`FR-001`, `T042`, `US2`, `C-readFile-1`, `R-001`, `P-APP-DIR`, and 12 more families) in the plain text of markdown documents inside a spec-kit feature folder, present them using the editor's existing link appearance, and navigate to the definition — which usually lives in a different file and is usually not a heading.

Two hard constraints shape every decision:

1. **Nothing is written to disk at either end.** The referencing token stays plain text; the defining artifact gains no anchors. Presentation and targets are both layered in at view time.
2. **No new interaction is invented.** Links look and activate exactly like the author-written markdown links this editor already supports.

**Technical approach** (resolved by Phase 0 — see [research.md](./research.md)):

1. **Render** with ProseMirror inline decorations carrying `nodeName: 'a'`, `class: 'markdown-link'`, and `data-speckit-id`. Never a mark — a mark lives in the document and would be serialized to the file. Three independent barriers prove a decoration cannot reach disk (R-001).
2. **Recognize** with a closed, enumerated 19-family vocabulary and boundary predicates evaluated at match time. Measured on the real corpus: 18,722 tokens accepted, **0 false positives**, 12 false negatives (0.064%). An open vocabulary would add 1,948 false accepts (R-021, R-027).
3. **Index** on the extension host — the webview's CSP is `default-src 'none'` and it cannot read a file. Kept fresh by a global document-change listener **and** a file watcher, which cover disjoint cases; neither alone satisfies the spec (R-013, R-017).
4. **Navigate** by sending the **ID**, never a position or a line number. Raw line numbers are wrong in ~6.5% of real files because content is rewritten twice on its way into the webview. The destination locates the definition in its own document (R-008, R-016).

Everything reuses existing machinery: the existing link class gives appearance for free, the existing click handler gives activation for free, and one new branch keyed on a data attribute carries dispatch.

## Technical Context

**Language/Version**: TypeScript 5.9.3, `strict: true`, target ES2020, module commonjs

**Runtime**: Node >= 22 (extension host); browser context (webview)

**Package manager / runner**: Bun 1.3.14 — `bun install`, `bun run <script>`. npm is out of policy per constitution. `package-lock.json` removed, `bun.lock` committed.

**Primary Dependencies**: TipTap 3 (`@tiptap/core`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/markdown`), VS Code Extension API ^1.85.0. No new runtime dependency is anticipated.

**Storage**: None. Markdown files on disk are read-only inputs for the definition index; the feature writes nothing.

**Testing**: Jest 30 + ts-jest. Global `testEnvironment: 'node'`; webview specs opt into jsdom via a `@jest-environment jsdom` docblock. `setupFiles` → `src/__tests__/setup.ts`, `setupFilesAfterEnv` → `src/__tests__/setup-after-env.ts`. Coverage threshold 60% global, with `src/webview/**` currently excluded from collection.

**Target Platform**: VS Code ^1.85.0 and Open VSX IDEs (Cursor, Windsurf, VSCodium), macOS/Windows/Linux

**Project Type**: VS Code extension — two contexts, extension host (Node, file-system capable) and webview (sandboxed browser, no file system), communicating by `postMessage`

**Performance Goals**: navigation visible within 2s (SC-001); live link-state refresh within 2s (SC-006); with 300 definitions in a feature folder, no perceptible slowdown on open or typing versus the feature off (SC-009)

**Constraints**: byte-identical files at both ends (SC-005, FR-024); zero error dialogs from unresolvable IDs (SC-007, FR-010); presentation indistinguishable from author-written links (SC-008, FR-020, FR-021); webview CSP forbids external resource loading; existing document-sync path is debounced 500ms

**Scale/Scope**: 18 ID families; 4 definition syntaxes plus one heading-derived special case; ~18,000 references and ~150 look-alike classes in the reference corpus; 5 independently shippable user stories (P1–P5)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution v2.0.0, ratified 2026-08-20.

| # | Principle | Gate for this feature | Status |
|---|---|---|---|
| 1 | Verification Before Completion | Each of the 5 user stories defines its runnable verification before its implementation is called done. Contract tests lock the tokenizer's accept/reject behavior and the extension↔webview message shape before dependent work starts. Documentation lands in the same phase. | PLANNED |
| 2 | Real Validation Over Green-Looking Shortcuts | The four Core Integration Boundaries named in the spec must be exercised through the shipped runtime path. No mocked file system, no simulated postMessage, no stubbed reveal, on any shipped path. | PLANNED |
| 3 | Benchmark Integrity and Measurable Gates | SC-002 (≥95% of references resolve), SC-003 (0 look-alikes linked), SC-004 (132/132 compressed refs expanded), SC-009 (300-definition typing latency) each need a numeric target, a comparison operator, and an explicit enforced-or-recorded label. | PLANNED |
| 4 | Provenance-Backed Test Assets | Fixtures must be real spec-kit markdown, not invented samples, with source recorded. Constraint: the reference corpus is a private repo, so fixtures must be derived and their provenance documented rather than copied wholesale into this public repository. `src/__tests__/fixtures/` already exists as the home. | PLANNED — see Complexity Tracking |
| 5 | Lazy Loading and Observability Discipline | The feature adds no heavy dependency. Indexing work must be deferred and debounced rather than done at startup. Per-stage timing (tokenize, index, resolve, decorate) must be emitted as structured data so a regression can be attributed to a stage. | PLANNED |
| 6 | Runtime Verification | Every phase checkpoint requires loading the extension in a real Extension Development Host, opening a real feature folder, and confirming links render, activate, and navigate — with no developer-console errors. Build success is not evidence. | PLANNED |
| 7 | Clean Gate Checks (Zero-Tolerance) | `bun run lint` (0 warnings, `--max-warnings 0`), `bun run test` (≥954 passing, 0 new skips, clean process exit), `bun run build:debug`. | **FAILING (pre-existing)** — see below |
| 8 | Consumer Documentation Integrity | This feature changes consumer-visible behavior, so README and wiki coverage is required deliverable scope in the same phase, not follow-up polish. | PLANNED |

### Gate 7 is currently failing

`bun run test` passes 954 tests but prints *"A worker process has failed to exit gracefully and has been force exited."* Under this constitution a leaked handle that prevents clean process exit **fails the gate** even when every assertion passes, and pre-existing problems are explicitly in scope for the phase that observes them.

State of remediation:

- The implicated frame (`src/__tests__/webview/imageResizeModal.test.ts:79` → a `window.setTimeout` at `src/webview/features/imageResizeModal.ts:250`) was **ruled out**: that suite run in isolation passes with exit code 0 and no warning. Jest attributes the force-exit to whichever worker was last active, so the stack trace is misleading.
- Root-cause work is in progress. Suppression is prohibited — no `forceExit`, no config flag that hides the warning, no skipped tests.

**This gate must be green before any phase checkpoint for this feature can pass.** It does not block Phase 0/Phase 1 design.

### Constitution-driven scope this feature must carry

Beyond the spec's own requirements, the constitution adds required deliverables that must appear in `tasks.md`:

- Bun migration completion is task 1 (the constitution records npm use as a time-boxed, owned exception expiring when it lands). Install, lint, test, build, and vsix packaging are already verified on Bun; documentation still refers to npm in `CONTRIBUTING.md`, `AGENTS.md`, `docs/BUILD.md`, `docs/DEVELOPMENT.md`, and `roadmap/README.md`.
- Structured per-stage timing instrumentation (principle 5).
- README and wiki updates (principle 8).
- A browser/webview-level verification step per phase (principle 6).
- Explicit enforced-or-recorded labels on every benchmark metric (principle 3).

## Project Structure

### Documentation (this feature)

```text
specs/001-speckit-id-links/
├── spec.md                     # Feature specification (complete)
├── id-conventions-survey.md    # Field survey — grounding evidence (complete)
├── plan.md                     # This file
├── research.md                 # Phase 0 output
├── data-model.md               # Phase 1 output
├── quickstart.md               # Phase 1 output
├── contracts/                  # Phase 1 output
├── checklists/
│   └── requirements.md         # Spec quality checklist (complete)
└── tasks.md                    # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

Existing layout, with this feature's additions marked:

```text
src/
├── extension.ts                        # activation, command registration
├── editor/
│   └── MarkdownEditorProvider.ts       # CustomTextEditorProvider; webview host; message dispatch
│                                       #   + definition-index ownership, reveal-at-position handling
├── features/                           # extension-host features (e.g. documentExport)
│   └── (new) speckitIndex/             # feature-folder discovery, definition extraction, freshness
├── shared/                             # code used by BOTH contexts — home for the tokenizer
│   └── (new) speckitIds/               # recognition grammar, family table, rejection rules
├── webview/
│   ├── editor.ts                       # TipTap setup; Link config (:648); link click handler (:961+)
│   ├── extensions/                     # ProseMirror/TipTap extensions — home for the decoration plugin
│   │   └── (new) speckitIdLinks.ts
│   ├── features/                        # overlays, dialogs, modals
│   ├── types/
│   └── utils/
│       └── linkValidation.ts           # existing shouldAutoLink guard
└── __tests__/
    ├── editor/
    ├── features/
    ├── fixtures/                        # provenance-backed spec-kit fixtures live here
    └── webview/
```

**Structure Decision**: Single existing project, no new top-level directories. The work splits along the extension's existing context boundary, which is also the file-system boundary:

- **`src/shared/speckitIds/`** — the recognition grammar and family table. Placed in `shared/` because both contexts need it: the webview to decide what to decorate, the extension host to decide what to index. This is the highest-risk component and the one most amenable to pure unit testing, so it is deliberately isolated from both runtimes.
- **`src/features/speckitIndex/`** — extension-host only. Discovers the feature folder, reads artifacts the person does not have open, extracts definitions in all four syntaxes, and keeps the index fresh. Must live here because the webview cannot touch the file system.
- **`src/webview/extensions/speckitIdLinks.ts`** — webview only. Renders view-only link presentation over recognized tokens and hands activation to the existing `.markdown-link` click path rather than adding a second one.
- **`src/editor/MarkdownEditorProvider.ts`** — extended, not replaced: carries the new index-push and reveal-at-position messages on the existing contract.

## Complexity Tracking

> Filled only for Constitution Check items needing justification.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Principle 4: fixtures derived from the corpus rather than copied from it | The corpus that grounds every requirement (`~/bl/dev/specs`) is a private repository. Its files cannot be committed into this public, MIT-licensed extension. But invented fixtures are exactly what principle 4 prohibits. | Copying real files wholesale is rejected because it would publish private content. Writing fresh synthetic fixtures is rejected because principle 4 names synthetic substitutes as prohibited. Resolution: fixtures reproduce the exact *structures* the survey documented — all 4 definition syntaxes, all 18 families, the enumerated look-alikes, the `(Priority: P#)` collision, the compressed-reference forms — with each fixture recording the survey section and corpus path:line it was derived from, so provenance is traceable without republishing private text. |
| Principle 7: proceeding into design while a gate is red | The failing gate is a pre-existing test-runner handle leak, unrelated to this feature's design decisions. Blocking Phase 0/1 on it would stall design for an orthogonal defect. | Ignoring the leak is rejected outright — the constitution puts pre-existing gate failures in scope and forbids suppression. It is being root-caused now, and is recorded above as a hard blocker on any *phase checkpoint*, which is where the constitution actually places the gate. Design work is not a phase checkpoint. |

## Constitution Check — post-design re-evaluation

Re-run after Phase 1. Changes from the initial check:

| # | Principle | Post-design status |
|---|---|---|
| 1 | Verification Before Completion | **STRENGTHENED.** Two contract files now lock behavior before implementation — 40 tokenizer assertions and 9 message-shape assertions, all required to fail first. |
| 2 | Real Validation Over Green-Looking Shortcuts | **SATISFIED IN DESIGN.** The byte-identity proof uses the repo's existing real-TipTap jsdom harness, not mocks. Scenarios 4–8 of the quickstart run in a real Extension Development Host. C-msg-9 records explicitly that the mock may not be used to prove the freshness integration. |
| 3 | Benchmark Integrity and Measurable Gates | **IMPROVED, AND ONE TARGET CORRECTED.** SC-002's original "100% for the top four families" was **unachievable as written** — the corpus references deliberately vacant and never-defined IDs, which FR-010 requires to stay plain. Reworded to a measured, achievable target: ≥98% resolution, ≤0.1% recognition miss, and no unresolved reference whose definition actually exists. C-tok-40 requires per-family counts so a single-family regression cannot hide in an unchanged total. |
| 4 | Provenance-Backed Test Assets | **RESOLVED as justified.** Fixtures reproduce corpus *structures* with recorded `path:line` provenance. See Complexity Tracking. |
| 5 | Lazy Loading and Observability Discipline | **SATISFIED.** No new dependency. Nothing runs until a markdown file is opened in this editor. Quickstart scenario 8 requires reads and extraction to be timed **separately** — a combined number hides which regressed, and cold I/O is the unmeasured risk. |
| 6 | Runtime Verification | **SPECIFIED.** Five of eight quickstart scenarios require the Extension Development Host, with zero developer-console errors called out as a pass condition. |
| 7 | Clean Gate Checks (Zero-Tolerance) | **STILL FAILING (pre-existing).** Unchanged by design work. Root-cause work in progress; the misleading stack frame has been ruled out. Recorded in the quickstart as a blocker on every scenario. |
| 8 | Consumer Documentation Integrity | **UNCHANGED — still owed.** README and wiki coverage remain required deliverable scope, plus the npm→Bun documentation sweep. Both belong in `tasks.md`. |

**No new violations introduced.** The two Complexity Tracking entries stand as written.

### Design decisions that resolved requirement conflicts

- **Target opens in the WYSIWYG editor** (user decision). The custom editor's priority is `option`, so `.md` does not open here by default — meaning someone who never opted in gets a WYSIWYG tab. Accepted deliberately: it is the only way to land on a list item or table row. The existing line-based handler stays as graceful degradation.
- **Decorations are stripped from exports.** The export path clones the live editor DOM and the sanitizer is a denylist, so ID links would otherwise appear as dead `<a>` tags in exported PDFs and Word files.
- **`D#` admitted as the nineteenth family** (user decision), 617 references. The thirteen other single-letter families stay out, recorded in FR-001c with the reason: admitting the general form reintroduces the `L#`-versus-line-reference and `P#`-versus-priority-marker collisions with no shape-level discriminator.

## Phase Status

- [x] Constitution Check (initial) — 6 planned, 1 pre-existing failure recorded, 2 justified in Complexity Tracking
- [x] Phase 0: [research.md](./research.md) — 4 tracks, 29 findings, Technical Approach resolved
- [x] Phase 1: [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)
- [x] Constitution Check (post-design re-evaluation) — no new violations; SC-002 corrected to an achievable target
- [ ] Phase 2: `tasks.md` — run `/speckit-tasks`

### Carried into `tasks.md`

Work the constitution or research requires that the spec's own requirements do not name:

1. **Bun migration completion is task 1.** Install, lint, test, build, and vsix packaging are verified. Documentation still says npm in `CONTRIBUTING.md`, `AGENTS.md`, `docs/BUILD.md`, `docs/DEVELOPMENT.md`, and `roadmap/README.md`.
2. **Fix the jest worker leak** — gate 7 blocks every phase checkpoint until it is green. Suppression is prohibited.
3. **Grow the VS Code mock.** It has none of `createFileSystemWatcher`, `findFiles`, `openTextDocument`, `workspace.fs`, or `RelativePattern`, and jest maps `vscode` to it globally. Nothing here is unit-testable until it does. Two suites already stub file-finding locally — standardize rather than adding a third.
4. **Add `documentPath` to the `update` payload** (C-msg-1). A prerequisite for the whole feature, independent of navigation, and it must land first.
5. **Extract a node-agnostic reveal helper.** Two correct copies already exist; do not write a third.
6. **Structured per-stage timing** for tokenize, read, extract, resolve, and decorate (principle 5).
7. **README and wiki updates** (principle 8).
8. **Strip decorations from the export path.**
