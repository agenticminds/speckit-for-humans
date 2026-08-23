# Environment Context – VS Code Extension

> **Distilled technical context** for LLMs implementing features in `markdown-for-humans`.
>
> This file is intentionally lean (~130 lines). For deep dives, see `docs/ARCHITECTURE.md`.
>
> **Maintenance rule:** Update this file when architecture changes. Keep it brief—essentials only.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                VS Code Extension Host (Node.js)             │
│                                                             │
│   MarkdownEditorProvider (CustomTextEditorProvider)         │
│   • Registers custom editor for .md files                   │
│   • Manages webview lifecycle                               │
│   • Handles two-way document sync                           │
│                                                             │
│   TextDocument ◄──────────────────► WebviewPanel            │
│   (Source of truth)                 (Visual editor)         │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────▼───────────────┐
              │    WebView Context (Browser)  │
              │                               │
              │    TipTap Editor (ProseMirror)│
              │    • StarterKit (formatting)  │
              │    • Markdown (serialization) │
              │    • Tables, TaskList, Link   │
              │    • Custom: Mermaid, Image,  │
              │      SpeckitIdLinks           │
              │                               │
              │    BubbleMenuView (toolbar)   │
              └───────────────────────────────┘
```

---

## Source of Truth

**TextDocument is canonical.** The webview renders it; edits flow back to update it.

- VS Code handles save/undo/redo automatically
- Git diffs work correctly (text-based)
- External changes (git pull, other editors) trigger webview refresh

---

## Messaging Protocol

| Direction | Message Type | Purpose |
|-----------|--------------|---------|
| Extension → Webview | `update` | Send markdown content (initial load or external change) |
| Webview → Extension | `edit` | User changed content, apply to TextDocument |
| Webview → Extension | `save` | User pressed Cmd/Ctrl+S, trigger VS Code save |
| Webview → Extension | `ready` | Webview initialized, request initial content |
| Extension → Webview | `speckitIndex` | Spec Kit definition index for this document's feature folder. Carries a monotonic `revision`; the webview drops a duplicate and treats a backwards one as "link nothing" |
| Webview → Extension | `openSpeckitDefinition` | An ID link was clicked. Host resolves the path, opens the artifact in **this** editor, and pushes a reveal |
| Extension → Webview | `revealSpeckitDefinition` | Scroll to a definition. Carries an identifier, never a position or a line number — the webview locates it in its own parsed document |
| Webview → Extension | `openFileAtLocation` | Reused as the ID-link reveal fallback when the parsed document does not contain the definition |

---

## Performance Constraints

| Metric | Budget | Notes |
|--------|--------|-------|
| Typing latency | <16ms | Never block the editor thread |
| Sync debounce | 500ms | Batch rapid edits before sending to extension |
| External update skip | 2s | Don't interrupt user if they edited recently |
| Target doc size | <10,000 lines | Beyond this, consider virtual scrolling |
| Spec Kit stage timings | none set | Recorded, not gated. Five disjoint stages — `tokenize`, `read`, `extract`, `resolve`, `decorate` — via `src/shared/perf/stageTimings.ts`. Reads are reported apart from extraction so a regression is attributable |

---

## Key File Locations

| Task | Primary File | Directory |
|------|--------------|-----------|
| Register command/keybinding | `extension.ts` | `src/` |
| Handle webview messages | `MarkdownEditorProvider.ts` | `src/editor/` |
| TipTap setup & extensions | `editor.ts` | `src/webview/` |
| Toolbar buttons | `BubbleMenuView.ts` | `src/webview/` |
| Custom TipTap extension | Create new file | `src/webview/extensions/` |
| Styles | `editor.css` | `src/webview/` |
| Extension manifest | `package.json` | Root |
| Spec Kit ID grammar (pure) | `families.ts`, `tokenizer.ts`, `expand.ts`, `qualifiers.ts`, `boundaries.ts` | `src/shared/speckitIds/` |
| Spec Kit definition index (host) | `index.ts`, `extract.ts`, `discovery.ts`, `watch.ts` | `src/features/speckitIndex/` |
| Spec Kit ID link decorations | `speckitIdLinks.ts` | `src/webview/extensions/` |
| Per-stage timing instrumentation | `stageTimings.ts` | `src/shared/perf/` |

---

## TipTap Extension Pattern

New features often follow this pattern:

1. **Create extension** in `src/webview/extensions/[feature].ts`
2. **Register** in `editor.ts` extensions array
3. **Add toolbar button** in `BubbleMenuView.ts` (if UI needed)
4. **Wire messages** in `MarkdownEditorProvider.ts` (if extension-side logic needed)
5. **Add command** in `package.json` contributes (if command palette entry needed)

### View-only extensions must not touch the document

`SpeckitIdLinks` is the reference example. It presents Spec Kit identifiers as links using
ProseMirror **decorations**, never marks:

- A mark lives in `state.doc` and is serialized into the file. A decoration lives in the view and
  cannot reach disk. That is the whole reason the feature can promise a byte-identical file.
- The plugin never dispatches a document-changing transaction. Its repaint carries plugin meta
  only, so `docChanged` is false, the editor's update event does not fire, and the
  index → decorate → sync loop terminates.
- The decoration carries **no `href`**. Dispatch is keyed on a `data-` attribute, checked as the
  first statement of the link click handler, before any `href` is read.
- Anything view-only must be stripped from the export clone. The export sanitizer is a denylist
  that passes `class` and unknown attributes through untouched — see `stripSpeckitIdLinks` in
  `src/webview/utils/exportContent.ts`.

---

## References

- **Full architecture:** `[Project Root]/docs/ARCHITECTURE.md`
- **Design principles:** `[Project Root]/docs/DEVELOPMENT.md`
- **Coding guide:** `[Project Root]/AGENTS.md` (index) + `[Project Root]/vibe-coding-rules/` (details)
