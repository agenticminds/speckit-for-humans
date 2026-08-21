# Quickstart: Validating Spec Kit ID Links

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Contracts**: [tokenizer](./contracts/tokenizer.contract.md) · [messages](./contracts/messages.contract.md)

How to prove this feature works. Every scenario below is runnable and maps to a specific requirement.

Per constitution principle 6, **build success and passing unit tests are not evidence that this feature works.** Scenarios 4 onward run in a real Extension Development Host, and a phase checkpoint does not pass without them.

---

## Prerequisites

```bash
cd /Users/marty/am/markdown-for-humans
bun install
```

This repo uses **Bun**, not npm. Already verified end to end: install, lint, test, build, and vsix packaging.

### Gate 7 blocks every checkpoint below

`bun run test` currently passes 954 tests but prints *"A worker process has failed to exit gracefully"*. The constitution counts a leaked handle as a **gate failure** even when every assertion passes, and puts pre-existing failures in scope. Confirm it is fixed before trusting any scenario here:

```bash
bun run test > /tmp/jest-out.txt 2>&1; echo "EXIT=$?"
grep -c "failed to exit gracefully" /tmp/jest-out.txt   # must be 0
grep -E "^Tests:" /tmp/jest-out.txt                     # passed must be >= 954, skipped <= 27
```

`EXIT=0` and a zero count are both required. Note the exit code is captured outside a pipe — a piped run reports the exit code of the last command in the pipeline, not of jest.

### Fixtures

Fixtures live in `src/__tests__/fixtures/` and are **derived** from the surveyed corpus, not copied from it — the corpus is a private repo and this one is public MIT. Each fixture records the survey section and the corpus `path:line` its structure came from, so provenance is traceable without republishing private text. That is the constitution's provenance requirement met without leaking anything (see the plan's Complexity Tracking).

---

## Scenario 1 — The tokenizer, in isolation

Fastest and highest-value loop. Pure text in, tokens out — no VS Code, no ProseMirror.

```bash
bun run test src/__tests__/shared/speckitIds
```

**Expected**: every assertion in the [tokenizer contract](./contracts/tokenizer.contract.md) passes — 40 contract items covering 19 families, all look-alike classes, compressed references, cross-feature qualifiers, and the ordering guarantees.

**The four that catch the most bugs:**

| Assert | Input | Expected |
|---|---|---|
| C-tok-13 | `(Priority: P1)` | **no token.** 367 of these in the corpus |
| C-tok-14 | `FR-P07` | exactly one token, `FR-P07`. `P07` never appears |
| C-tok-34 | `versionFR-001` | **no tokens.** Proves rejection resumes at `start + 1` |
| C-tok-23 | `FR-017–FR-021` | exactly two tokens. Intermediates are never synthesized |

**If C-tok-13 or C-tok-14 fails, stop.** Those two are the whole priority-marker collision, and getting them wrong mislinks 693 tokens.

---

## Scenario 2 — Bytes on disk never change

The requirement most likely to be broken silently, and the one a user would least forgive.

```bash
bun run test src/__tests__/webview/speckitIdLinks.serialization
```

Uses the real-TipTap jsdom harness that already exists in this repo — a real `Editor`, a real markdown manager, no mocks.

**Expected**:
1. Two editors are built from the same source, one with the extension and one without.
2. Their serialized markdown is **string-identical**.
3. Their `getJSON()` is **deep-equal** — this is the assertion that proves a decoration never entered the document.

**Then prove it end to end:**

```bash
shasum -a 256 <fixture>.md > /tmp/before.txt
# open the fixture in the editor, click several ID links, navigate around, save
shasum -a 256 <fixture>.md > /tmp/after.txt
diff /tmp/before.txt /tmp/after.txt   # must be empty
```

Do this for **both** ends — the referencing document and the artifact that was navigated *to*. FR-024 covers both, and the target side is the one people forget.

---

## Scenario 3 — Definition extraction, all six syntaxes

```bash
bun run test src/__tests__/features/speckitIndex
```

**Expected**: all six definition syntaxes are found — plain bullet, checkbox with bare ID, checkbox with bolded ID, heading, table row, and bolded ID opening a paragraph.

**The ones that were missed in earlier drafts:**

| Fixture line | Must yield |
|---|---|
| `- **BR-1** HTTP and HTTPS MUST…` | `BR-1` — the trailing colon is **optional** |
| `**AD-4 — The IDP is served at root…**` | `AD-4` — a bolded ID opening a *paragraph* |
| `` \| `P-APP-DIR` \| preflight(…) \| `` | `P-APP-DIR` — backticked in a table cell |
| `### User Story 2 - Reopen… (Priority: P2)` | `US2` — synthesized; the token appears nowhere |
| `## R2. openrouter/free is NOT…` | `R2` — separator is `.`, not `:` |
| a fenced block containing `- **FR-001**: example` | **nothing.** A documentation example is not a target |

The paragraph-bold form is what capped `AD-#` resolution at 50% when it was missing. The fenced-block exclusion is the one that creates phantom targets.

---

## Scenario 4 — Links render and activate (Extension Development Host)

```bash
bun run watch:debug
# then press F5 in VS Code to launch the Extension Development Host
```

In the dev host:

1. Open a fixture feature folder.
2. Right-click `plan.md` → **Open with Markdown for Humans**.

**Expected**:

- `FR-001`, `T042`, `US2`, `D13` all render with link styling.
- They are **visually indistinguishable** from an author-written `[text](url)` in the same document (SC-008). Put one of each side by side and compare.
- `AES-256`, `HS256`, `(Priority: P1)`, `spec.md:120-140`, and a fenced `FR-001` are all plain text.
- Clicking a link uses the **same gesture** as an ordinary link — no modifier, no new affordance (FR-021).
- The developer console shows **zero** errors. The constitution requires this explicitly; console errors fail the checkpoint.

---

## Scenario 5 — Cross-file navigation lands on the right line

The core of the feature, and where the design took its biggest risk.

| Click | Expected |
|---|---|
| `FR-001` in `plan.md` | `spec.md` opens **in the WYSIWYG editor**, scrolled to the `- **FR-001**:` bullet |
| `T042` | `tasks.md` opens at the `- [ ] T042` checkbox item |
| `US2` | `spec.md` opens at the `### User Story 2` heading |
| `C-ws-1` | the right file under `contracts/` opens at that entry |
| `R-029` defined in a table | `research.md` opens at that **table row** |
| `BR-4` | the file in `briefs/` opens — outside the feature folder entirely |
| `008 FR-P07` | feature **008**'s `spec.md`, not the current feature's |
| a bare `FR-999` that nothing defines | nothing happens. No dialog, no error, no navigation (FR-010, SC-007) |

**Check the target is not hidden under the sticky toolbar.** The existing heading-specific scroll helper skips its offset compensation for non-heading positions, which would leave a bullet or table row tucked underneath. Verify visually for a table cell specifically — that is the least-tested path.

**Click the same link twice.** `ready` fires only once per webview lifetime, so a reveal into an already-open panel takes a different code path from the first one. "First click works, second does nothing" is the predicted failure (C-msg-4e).

---

## Scenario 6 — Live refresh with two files open

Proves FR-025 and SC-006. Both halves matter, because they exercise different mechanisms.

**Unsaved edits** — the scenario the spec actually specifies:

1. Open `tasks.md` and `spec.md` side by side. `tasks.md` references `FR-010`, which `spec.md` does not define.
2. Type a new `- **FR-010**: …` bullet into `spec.md`. **Do not save.**
3. Within ~2 seconds, without touching `tasks.md`, its `FR-010` becomes a link.
4. Rename the definition to `FR-011`. The `FR-010` reference in `tasks.md` reverts to plain prose.

**On-disk changes** — the other half:

```bash
git checkout -- <fixture>/spec.md    # or have an agent rewrite it
```

Both open documents update. A file watcher is required here; the change event alone never fires for a file nobody has open.

**If step 3 fails but the on-disk half works**, the index is reading from disk instead of from the dirty buffer. That is the single most likely defect in this component.

---

## Scenario 7 — Exports carry no dead links

```bash
# with a document containing resolved ID links open, export to PDF and to DOCX
```

**Expected**: no `<a>` wrapper around any ID in the output. The export path clones the live editor DOM, and the export sanitizer is a denylist that passes `class` through untouched, so decorations leak unless explicitly stripped.

**Known pre-existing**: search-match and validation-error highlights leak the same way today. Do not "fix" those here — note them and move on.

---

## Scenario 8 — Performance

Proves SC-009.

1. A fixture feature folder with **300+ definitions** (the largest real corpus folder has 854).
2. Open a document referencing many of them.
3. Type a paragraph of prose continuously.

**Expected**: typing feels identical to the feature switched off. Per-keystroke work should be one decoration-set map plus a regex pass over the changed paragraph — not a full-document rescan.

**Where the budget goes**: extraction is measured at 3.5ms for the largest real folder. It is not the bottleneck. Cost lives in file reads and the ~60KB index payload. Read the structured per-stage timings (principle 5 requires them) and confirm reads and extraction are reported **separately** — a combined number hides which one regressed, and cold I/O on a network drive or container mount is unmeasured.

---

## Full gate

```bash
bun run validate          # lint + test + build
bun run package:release   # produces the vsix
```

All must be clean, with zero lint warnings (`--max-warnings 0` is already enforced) and a clean process exit.

**Also confirm the vsix ships nothing it shouldn't.** `.specify/` and `bun.lock` were both leaking into the package earlier and are now excluded — the package went from 94 files to 72. Check the file list in the packaging output before publishing.
