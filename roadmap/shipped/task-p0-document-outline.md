# Task: Document Outline (Inline & TOC)

## 1. Task Metadata

- **Slug:** task-p0-document-outline
- **Status:** shipped
- **Priority:** P0 (critical nav)
- **Created:** 2025-11-28
- **Last Updated:** 2025-12-02
- **Shipped:** 2025-12-02

---

## 2. Context & Problem

Users need a persistent Outline panel in the VS Code sidebar (Explorer) to navigate long docs. We have now added a persistent sidebar outline (with tree nesting, actions, search, and live sync) in addition to the existing modal TOC overlay. Navigation should be always visible, click to jump, and reflect the current heading.

---

## 3. Desired Outcome & Scope

- **Explorer Outline panel:** Persistent sidebar tree showing document headings (H1–H6) with indentation. Includes view-title actions (reveal current heading, filter/search, clear filter), plus VS Code's built-in collapse all.
- **Navigation:** Clicking a heading focuses the WYSIWYG editor and scrolls the heading into view with toolbar offset.
- **Sync:** Current heading highlights as the cursor moves; outline auto-reveals and scrolls to the active heading; ancestor path is visually highlighted; updates live on document changes.
- **Commands/entry:** No command palette entry (intentional). Toolbar TOC button remains as the lightweight modal; sidebar outline loads automatically with our editor.
- **Non-goals:** Inline outline mode; custom expand/collapse controls (VS Code's TreeView API doesn't support programmatic expand all); keyboard-only navigation between rows (future); editor TextDocument mutations from the outline.

---

## 4. UX & Behavior

- **Entry points:** Explorer sidebar view "Speckit for Humans: Outline" (auto-shown only when our editor is active). Toolbar TOC button keeps opening the modal overlay (unchanged). No palette command (palette hygiene).
- **Sidebar behavior:**
  - Hierarchical tree with H-level description
  - View-title actions: Reveal Current, Filter, Clear Filter
  - VS Code's built-in Collapse All (ellipsis menu) - provided by `showCollapseAll: true`
  - Clicking heading jumps to heading and focuses editor
  - Tree starts fully expanded on document load and maintains expansion as you navigate
  - Active nodes and ancestors stay expanded automatically
- **Sync:**
  - Auto-updates on edits and selection changes
  - Highlights current heading with green dot icon + highlighted text
  - Highlights ancestor path with green chevron icon + highlighted text
  - Auto-reveals and scrolls sidebar to current heading (scroll sync)
  - Auto-expands tree path to show clicked heading, even if tree is manually collapsed
  - Scroll respects formatting toolbar offset
- **Filter:**
  - Live filtering as user types (QuickPick-based)
  - Esc closes input; X button clears filter
- **Modal overlay (existing):** Remains available via toolbar (hamburger); command wiring for overlay toggle also present.
- **Empty state:** If no headings, returns empty tree (future: show "No headings yet" message).

---

## 4b. Current Functionality (source of truth)

- **User-facing:** Sidebar outline exists and auto-appears when md-human editor is active. Tree supports manual expand/collapse (user-driven), reveal current, live filter/search with clear button. Ancestor path highlighting shows navigation context. VS Code's built-in Collapse All available in ellipsis menu. Modal TOC overlay still available from toolbar.
- **Technical:** Outline tree provider in `src/features/outlineView.ts`; view contribution and title actions in `package.json`; tree wired via `createTreeView` with `showCollapseAll: true` in `src/extension.ts` and backed by active webview context. Webview posts outline + selection updates (`src/webview/editor.ts`), responds to `navigateToHeading`; shared outline utils in `src/webview/utils/outline.ts` and scroll helper in `scrollToHeading.ts`. Active webview tracking in `src/activeWebview.ts` and `MarkdownEditorProvider.ts`. Overlay remains in `src/webview/features/tocOverlay.ts`.
- **Styles:** Overlay styles in `src/webview/editor.css`; sidebar relies on VS Code tree styling with TreeItemLabel highlights for emphasis.
- **API limitations:** VS Code's TreeView API doesn't provide a programmatic "expand all" command. Setting `TreeItemCollapsibleState.Expanded` on items doesn't automatically expand them visually - it only affects the initial/default state. This is a [known limitation](https://github.com/microsoft/vscode/issues/131955) of VS Code's TreeView API.

---

## 5. Technical Plan

- **Surfaces:** VS Code Explorer view with title actions; extension tree data provider; toolbar modal overlay retained; webview messaging for outline data, selection, and navigation.
- **Key changes (done):**
  - `package.json` – contributed Explorer view `speckitForHumansOutline` with title actions (reveal current, filter, clear filter). Removed custom Expand All / Collapse to H1/H2 due to VS Code API limitations.
  - `src/extension.ts` / `src/editor/MarkdownEditorProvider.ts` / `src/activeWebview.ts` – track active webview, create tree view with `showCollapseAll: true`, wire commands to provider, keep context key so view shows only when editor is active.
  - `src/features/outlineView.ts` – tree provider with:
    - Nesting, filtering, reveal current
    - Active heading highlighting (green dot + TreeItemLabel highlights)
    - Ancestor path highlighting (green chevron + TreeItemLabel highlights)
    - Pending reveal system for deferred auto-scroll after tree render
    - Live filter via QuickPick with onDidChangeValue
    - Clear filter command
    - Simplified collapsible state: always expanded by default, active nodes and ancestors stay expanded
    - Cached active node for O(1) ancestor state lookups (performance optimization)
  - `src/webview/editor.ts` + `src/webview/utils/outline.ts` + `src/webview/utils/scrollToHeading.ts` – build outline, push updates/selection to extension, handle `navigateToHeading` with toolbar-offset scroll; shared outline builder reused by overlay.
  - `src/webview/features/tocOverlay.ts` – continues to work, now using shared outline/scroll helpers.
  - Tests: comprehensive unit tests for outline provider covering tree building, filtering, active state, ancestor tracking, reveal functionality.
- **Architecture notes:** Outline tree built extension-side from TextDocument; navigation dispatched to webview. No TextDocument edits. Outline updates and selection sync are debounced via webview side; tree reflects current state. Always creates fresh TreeItem objects to ensure VS Code respects state changes.
- **Performance considerations:** Outline computed from document headings; filtered/nested in-memory; auto-reveal deferred via setTimeout to let tree render first. Scroll uses requestAnimationFrame with toolbar offset. Active node cached to eliminate redundant O(n) traversals on every render.

---

## 6. Work Breakdown

| Status | Task | Notes / How to Verify |
|--------|------|-----------------------|
| completed | Contribute Outline view | Explorer view + title actions in `package.json`; view only when md-human active. |
| completed | Active panel tracking | `MarkdownEditorProvider` + `activeWebview.ts` set/clear active; commands routed via `extension.ts`. |
| completed | Outline tree provider | `src/features/outlineView.ts` builds nested tree, filtering, simplified collapse (default expanded); updates on outline/selection messages. |
| completed | Navigation wiring | Tree items post `navigateToHeading` to webview; scroll uses toolbar offset. |
| completed | Highlight sync | Webview posts selection; tree highlights/auto-reveals current heading. |
| completed | Ancestor path highlighting | Active heading path shows chevron icons + highlighted text for navigation context. |
| completed | Scroll sync | Sidebar auto-scrolls to reveal active heading when cursor moves in document. |
| completed | Live filter | QuickPick-based filter updates tree as user types; clear filter button. |
| completed | Keep modal overlay working | TOC overlay still wired via toolbar and command. |
| completed | Performance optimization | Cached active node eliminates O(n²) traversals; memory leak fixed in filtering. |
| completed | Tests | Comprehensive unit tests for outline provider (27 passing); `npm test -- outlineView`, `npm test -- tocOverlay`. |
| removed | Custom Expand All | Removed due to VS Code TreeView API limitation (cannot programmatically expand items). |
| removed | Collapse to H1/H2 | Removed due to API limitations; VS Code's built-in Collapse All (showCollapseAll: true) retained. |
| pending | Manual verification | Scenario: outline actions visible; edit updates tree; click row scrolls with offset; active heading highlights/reveals while moving cursor; filter works; modal overlay still works. |
| pending | Ship | Update feature inventory/changelog; move task to shipped/ when done. |

---

## 7. Implementation Log

### 2025-12-02 – Simplified collapse modes and performance optimization

- **Removed:** Custom Expand All, Collapse to H1, and Collapse to H2 commands due to VS Code TreeView API limitations
- **API Limitation:** VS Code's TreeView API doesn't support programmatic expand/collapse ([GitHub issue #131955](https://github.com/microsoft/vscode/issues/131955))
- **Kept:** VS Code's built-in Collapse All (via `showCollapseAll: true`)
- **Fixed:** Performance bottleneck - cached active node eliminates O(n²) traversals, now O(1) lookups
- **Fixed:** Memory leak in `applyFilter()` - now clears stale `parentMap` references
- **Fixed:** QuickPick placeholder mismatch and concurrent call prevention
- **Fixed:** Reveal Current functionality - removed blocking guard
- **Fixed:** TreeView reveal identity and auto-expand - `doRevealActive()` creates items if needed for reveal, and `getChildren()` reuses existing items when state matches (ensures reveal works with same instance AND supports auto-expand in collapsed mode)
- **Simplified:** Tree always starts fully expanded; active nodes and ancestors stay expanded automatically
- **Tests:** 29 passing (removed 4 collapse mode tests, added 2 reveal identity tests)

### 2025-12-02 – Enhanced UX features (earlier)

- **Added:** Ancestor path highlighting (green chevron + bold text for H1→H2→H3 chain)
- **Added:** Scroll sync (sidebar auto-scrolls to keep active heading visible)
- **Added:** Live filter (QuickPick with onDidChangeValue filters as you type)
- **Added:** Clear filter command and toolbar button
- **Fixed:** Tree now starts fully expanded on document load (was collapsed)
- **Fixed:** Reveal deferred until after tree renders (was failing silently)
- **Tests:** Added comprehensive tests for ancestor tracking, filter behavior, edge cases

### 2025-12-01 – Task re-aimed to sidebar outline

- **What:** Shifted goal to persistent Explorer Outline panel; kept modal overlay as-is; removed inline outline scope. Identified command contribution gaps and lack of view provider.
- **Ready for:** Implement sidebar outline view and navigation sync with webview; palette command intentionally omitted to avoid command noise.
- **First task:** Contribute Outline view (no palette command) and wire active panel tracking.

### Note on command palette clutter

- Intentional choice: do **not** add a command palette entry for the Outline view to avoid polluting the palette. Primary entry points are the Explorer view and the toolbar modal overlay. If future UX needs a palette shortcut, scope it to `activeCustomEditorId == speckitForHumans.editor` to keep the palette clean.
