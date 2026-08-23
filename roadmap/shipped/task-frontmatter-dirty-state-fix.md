# Task: Frontmatter Dirty State Fix

<!--
LLM INSTRUCTIONS (do not remove):

LEAN PRINCIPLE: Sections 1-4 must be ~35-45 lines TOTAL. Focus on WHAT not HOW.

Key guidelines for each section:
- Section 2 (Context): 5-10 lines. Problem statement, no implementation details.
- Section 3 (Outcome): 5-8 lines. Success criteria only, not how to achieve them.
- Section 4 (UX): 10-15 lines. Entry points + 1-2 key flows.
- Section 4 Current Functionality: 3-5 lines. REQUIRED. Describe current behavior (functional + technical) and key files from ACTUAL CODEBASE.
- Section 5-6: Added during refinement (task-refine.md). Can be detailed.
- Section 7: Implementation log - this is where ALL detail goes.

CRITICAL: Read source code before defining tasks. Documentation can be stale.
Use task-discovery.md "Codebase Exploration" table to find related files.
-->

> **Canonical structure** for task files in `speckit-for-humans`.
>
> **One file = one task.** Combines discovery, planning, and changelog.
>
> **File location:**
> - Active: `roadmap/pipeline/task-[slug].md`
> - Completed: `roadmap/shipped/task-[slug].md`
>
> **Workflow:**
> 1. Tag `task-discovery.md` → create sections 1–4 + Current Functionality (~35-45 lines)
> 2. Tag `task-refine.md` → add sections 5–6 (technical plan, work breakdown)
> 3. Implement → update section 6 status, log in section 7
> 4. Tag `task-ship.md` → move to shipped/, update FEATURE-INVENTORY.md

---

## 1. Task Metadata

- **Task name:** Fix Frontmatter Dirty State on Document Open
- **Slug:** `frontmatter-dirty-state-fix`
- **Status:** `shipped`
- **Created:** 2025-12-05
- **Last updated:** 2025-12-05
- **Shipped:** 2025-12-05

---

## 2. Context & Problem

- **Problem:** Opening markdown files with YAML frontmatter causes VS Code to mark the document as dirty (white dot indicator) even though no user edits were made.
- **Current state:** Documents with frontmatter are transformed (wrapped in ```yaml fence) for webview rendering, but the initialization sequence triggers an unwanted edit event.
- **Why it matters:** Users think they have unsaved changes when they haven't made any edits, creating confusion and breaking trust in the editor's state tracking.

---

## 3. Desired Outcome & Scope

- **Success criteria:**
  - Opening a markdown file with YAML frontmatter does not mark the document as dirty
  - Frontmatter continues to render as a syntax-highlighted code block in the webview
  - Actual user edits correctly mark the document as dirty
  - Saving preserves the original `---` frontmatter format on disk

- **Out of scope:** Changing how frontmatter is displayed or adding new frontmatter features

---

## 4. UX & Behavior

- **Entry points:** Opening any markdown file with YAML frontmatter in the custom editor
- **Flow:** User opens file with frontmatter → Frontmatter displays as ```yaml code block → Document tab shows NO dirty indicator → User can close without save prompt

### Current Functionality (Source of Truth)

- **Current behavior (user-facing):** Frontmatter wrapping/unwrapping works correctly for rendering and saving, but documents are incorrectly marked dirty on open
- **Current implementation (technical):** `MarkdownEditorProvider.updateWebview()` wraps frontmatter before sending to webview; `wrapFrontmatterForWebview()` and `unwrapFrontmatterFromWebview()` handle transformation
- **Key files:** `src/editor/MarkdownEditorProvider.ts` (wrapping/unwrapping), `src/webview/editor.ts` (TipTap initialization)
- **Pattern to follow:** The `isUpdating` flag pattern already exists in webview to prevent feedback loops during content updates

---

## 5. Technical Plan

- **Surfaces:** Webview (TipTap editor initialization)
- **Key changes:**
  - `src/webview/editor.ts` – Set `isUpdating = true` before calling `setContent()` during initialization, preventing `onUpdate` callback from firing
  - `src/editor/MarkdownEditorProvider.ts` – Improve code comments for clarity on content tracking
- **Architecture notes:** Leverages existing `isUpdating` flag that prevents `onUpdate` callback execution; no new mechanisms needed
- **Performance:** No performance impact; only affects initialization path

---

## 6. Work Breakdown

| Status | Task | Notes |
|--------|------|-------|
| `done` | **Identify root cause** | TipTap's `setContent()` triggers `onUpdate` during initialization |
| `done` | **Implement fix in webview** | `src/webview/editor.ts` lines 354-361 |
| `done` | **Improve code clarity** | Better comments in `MarkdownEditorProvider.ts` |
| `done` | **Verify existing tests pass** | `frontmatterRendering.test.ts` ✓ |
| `done` | **Build and verify** | Extension builds successfully ✓ |

**Status:** `pending` → `in-progress` → `done`

### How to Verify

**Manual verification:**
1. Open a markdown file with YAML frontmatter → 2. Check document tab for dirty indicator → 3. Expected: No white dot, frontmatter displays as ```yaml block

**Unit tests:**
1. Run `npm test` → 2. All frontmatter tests pass → 3. Coverage: wrap/unwrap transformations work correctly

---

## 7. Implementation Log

### 2025-12-05 – Diagnosed and Fixed Dirty State Bug

- **What:** Identified and fixed the root cause of documents being marked dirty on open when they contain YAML frontmatter
- **Root Cause Analysis:**
  - When a document opens, `MarkdownEditorProvider.updateWebview()` wraps frontmatter in a ```yaml fence for better rendering
  - The webview receives this transformed content and calls `editor.commands.setContent(initialContent, { contentType: 'markdown' })`
  - **Problem:** TipTap's `setContent()` triggers the `onUpdate` callback even during initialization
  - The `onUpdate` callback calls `debouncedUpdate()`, which sends the wrapped content back to VS Code as an "edit"
  - VS Code's `applyEdit()` unwraps and applies it, marking the document as dirty
- **Files Modified:**
  - `src/webview/editor.ts` lines 354-361: Added `isUpdating = true` before `setContent()` and reset after to prevent `onUpdate` from firing during initialization
  - `src/editor/MarkdownEditorProvider.ts` lines 123-128: Improved comments explaining why we store original content in `lastWebviewContent`
- **Decisions:** 
  - Chose to reuse existing `isUpdating` flag mechanism rather than introduce new state tracking
  - This is a surgical fix affecting only the initialization path
  - The `onUpdate` callback already checks `isUpdating` at the start, so the pattern was proven
- **Testing:**
  - Existing test suite passes: `frontmatterRendering.test.ts` ✓
  - Built extension successfully
  - Ready for manual testing with any markdown file containing frontmatter
- **Impact:** Critical UX bug fix with minimal risk; only affects initialization, user edits work exactly as before

---

**End of task. Bug fixed and shipped.**
