# Phase 0 Research: Spec Kit ID Links

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-08-20

Four research tracks were dispatched to resolve the Technical Approach unknown in [plan.md](./plan.md). All claims below are from source reading of this repository and its `node_modules`, with `file:line` citations. Nothing here was verified in a live webview; runtime verification is a Phase 6 gate per constitution principle 6.

**Track status**: all four tracks complete — R-001–R-006 (rendering) · R-007–R-012 (navigation) · R-013–R-020 (definition index) · R-021–R-028 (recognition grammar)

---

## R-001: Render with ProseMirror decorations, never with a mark

**Decision**: Use an inline `Decoration` with `nodeName: 'a'`, supplied from a `Plugin`'s `props.decorations`, wrapped in a TipTap `Extension.create({ addProseMirrorPlugins() })`.

```ts
Decoration.inline(from, to, {
  nodeName: 'a',
  class: 'markdown-link',
  'data-speckit-id': id,
})
```

No mark. No node. No `href` — see R-009.

**Rationale**: A mark lives in `state.doc`, so it is serialized to the file. This repo documents that exact failure in a comment written to explain a prior bug: `src/webview/utils/markdownSerialization.ts:17-28` records that `@tiptap/markdown` opens and closes marks in array order, and that a `link` mark nested in a `code` mark emits literal `[text](url)`. A mark would therefore write link syntax into the file on the next debounced sync, violating FR-024 and SC-005 outright.

A decoration lives in plugin state and cannot reach the doc. Three independent barriers confirm it:

| Barrier | Citation |
|---|---|
| Serialization reads doc JSON only | `src/webview/utils/markdownSerialization.ts:156` → `editor.getJSON()`, which is `state.doc.toJSON()` (`@tiptap/core/dist/index.js:4964-4966`). Plugin state is unreachable from `doc`. |
| A decoration-only transaction never reaches the sync path | TipTap gates its `update` event on `!transactions.some(tr => tr.docChanged) → return` (`@tiptap/core/dist/index.js:4941`). `onUpdate` (`src/webview/editor.ts:713-726`) is the only caller of `debouncedUpdate`. A `setMeta`-only transaction has `docChanged === false`. |
| Identical text is a no-op write | `src/editor/MarkdownEditorProvider.ts:3464-3466` returns early when `normalizedContent === currentText`, before any `WorkspaceEdit`. |

Every other route out of the editor was checked and is schema-based, not DOM-based: `copyMarkdown.ts:48-52` and `aiContextReference.ts:239-242` both go through `markdown.serialize(json)`; `getHTML()` is `getHTMLFromFragment(state.doc.content, schema)` (`@tiptap/core:4970`); `turndown` appears only on the inbound paste path (`src/webview/utils/pasteHandler.ts:114`). One exception — see R-006.

The `nodeName` mechanism is documented API (`prosemirror-view/dist/index.d.ts:147`). `computeOuterDeco`/`patchOuterDeco` (`dist/index.cjs:1694-1728`) create the element, merge `class`, and set remaining attributes; `iterDeco` (`dist/index.cjs:2069-2087`) splits text nodes at decoration boundaries. Marks sync before the node (`dist/index.cjs:1339`), so the wrapper nests *inside* `<strong>`/`<em>` — valid HTML.

**Alternatives rejected**:

| Alternative | Why rejected |
|---|---|
| Custom `speckitIdLink` mark | In `state.doc`; serialized to disk. Violates FR-024/SC-005. |
| Extend the existing `Link` mark with an attribute | Same fatal flaw, plus it entangles author-written links with synthetic ones and puts them in undo history — `Ctrl+Z` could half-remove a "link" the user never made. |
| Input rule / paste rule applying a mark | Writes to the document by definition, and cannot revert to plain prose when a definition is renamed (FR-025). |
| `Decoration.widget` | Widgets insert DOM with no backing text. We must restyle *existing* text; widgets break caret arithmetic across the token. |
| `Decoration.node` | Applies to whole nodes only. Our targets are sub-spans of text nodes. (This is why `imageEnterSpacing` uses it — its targets *are* whole image nodes.) |
| Post-hoc DOM mutation of `view.dom` | ProseMirror owns and re-renders that DOM, and mutation desyncs `posAtDOM`. |

---

## R-002: Follow `imageEnterSpacing` as the plugin shape, `auditDocument` as the index-feed shape

**Decision**: Structure the plugin on `src/webview/extensions/imageEnterSpacing.ts:420-493`; feed the definition index in via `setMeta` following `src/webview/features/auditDocument.ts:414-448`. Register in the static extension array beside `DocumentAuditExtension` at `src/webview/editor.ts:668`.

**Rationale**: Three decoration plugins already exist here. `imageEnterSpacing` is the only one that is a self-contained TipTap extension computing decorations *from the document*, with a recompute short-circuit at `:475-481` — the right model for tokenizing text. The other two are driven by external `setMeta` pushes: `auditDocument.ts:423` reads `tr.getMeta(key)` and otherwise maps the old set forward, with its driver at `src/webview/editor.ts:1811,1826` dispatching `state.tr.setMeta(auditPluginKey, issues)`. That is precisely the house pattern for pushing a definition index in and satisfying FR-025 liveness.

`src/webview/features/searchOverlay.ts:69-92` has the same shape but registers lazily via `editor.registerPlugin` (`:178`) — do not copy that; this extension must be static. `src/webview/extensions/draggableBlocks.ts:833-848` is a `Plugin` with only a `view()` and is not a decoration precedent.

`src/webview/extensions/markdownConfig.ts:10` self-documents as "currently NOT USED" — not on the path, do not extend it.

---

## R-003: Code spans and code blocks are excluded by one schema check each

**Decision**: Key both exclusions off `node.type.spec.code` and `mark.type.spec.code` rather than off type names, and prune whole subtrees.

```ts
doc.descendants((node, pos) => {
  if (node.type.spec.code) return false;                          // prunes codeBlock + mermaid
  if (!node.isText || !node.text) return true;
  if (node.marks.some(m => m.type.spec.code)) return true;        // inline code span
  if (node.marks.some(m => m.type.name === 'link')) return true;  // FR-006 + nested-<a> guard
  // tokenize node.text, push Decoration.inline(pos + i, pos + j, attrs)
});
```

**Rationale**: The schema makes this nearly free.

- Fenced code blocks are node `codeBlock` (`src/webview/extensions/codeBlockWithCopy.ts:15`; StarterKit's own is disabled at `src/webview/editor.ts:599`), spec `code: true` (`@tiptap/extension-code-block/dist/index.js:20-23`).
- Mermaid is node `mermaid`, also `code: true`, `isolating: true` (`src/webview/extensions/mermaid.ts:48-62`) — caught by the same check.
- Inline code is mark `code`, spec `code: true`, `excludes: '_'` (`@tiptap/extension-code/dist/index.js:12-13`). That `excludes` means code text can never also carry a link mark, so the two skips cannot interact badly.
- `inlineMath` (`src/webview/extensions/inlineMath.ts:50-53`) and `mathBlock` (`mathBlock.ts:34-38`) are `atom: true` with LaTeX in an attribute, so they hold no text children and are skipped by construction.

`return false` prunes the subtree, so code-block text is never regex-scanned. Pruning also sidesteps a secondary hazard: `codeBlock` renders through a custom node view (`src/webview/extensions/codeBlockCopyNodeView.ts:165`), and decorations inside custom node views are a known source of surprise.

`preservedCodeBlock.ts` is not a node — it only supplies `parseMarkdown`/`renderMarkdown` for `codeBlock` (`codeBlockWithCopy.ts:42-43`).

---

## R-004: Existing link appearance and click dispatch are reused for free

**Decision**: Carry `class: 'markdown-link'` on the decoration. Add no new stylesheet rule and no second click listener.

**Rationale**: `.markdown-link` (`src/webview/editor.css:854-863`) styles `color`, `text-decoration`, `cursor`, and `:hover` purely off the class — no `a[href]` selector, no attribute dependency. A decoration carrying that class is pixel-identical to an author-written link, satisfying SC-008 and FR-020 by construction.

`handleLinkClick` is bound to `editorInstance.view.dom` (`src/webview/editor.ts:1053`) and matches `target.closest('.markdown-link')` (`:963`). A decoration-rendered element lives inside `view.dom`, so it is already in scope — FR-021 satisfied without a new gesture.

**One genuine collision**: text already carrying a `link` mark renders its own `<a class="markdown-link" href>`. A decoration on top would nest `<a>` inside `<a>`, which is invalid HTML that browsers restructure. Skipping link-marked text is therefore mandatory — which is conveniently already FR-006 (R-003 implements it).

**No conflict with `shouldAutoLink` or autolink**: `shouldAutoLink` (`src/webview/utils/linkValidation.ts:15-34`) only gates URLs that linkifyjs already detected, and `FR-001`/`T042`/`US2` are not URL-shaped so never reach it. TipTap's autolink plugin reads document text, not rendered DOM, so a decoration is invisible to it.

---

## R-005: Recompute decorations by mapping, not rebuilding

**Decision**: Map the existing `DecorationSet` through the transaction, short-circuit no-op transactions, and rescan only changed blocks. Full-document scans happen exactly twice: at `init`, and when a new index arrives by `setMeta`.

1. Map first: `prev.decorations.map(tr.mapping, tr.doc)` — as `searchOverlay.ts:83` and `auditDocument.ts:433` already do. O(changed), keeps positions correct without touching text.
2. Short-circuit: `if (!tr.docChanged && indexUnchanged) return prev;` — mirrors `imageEnterSpacing.ts:475-481`. Selection-only transactions, the majority, then cost nothing.
3. Rescan changed blocks only: walk `tr.mapping.maps[i].forEach(...)`, expand each range to its enclosing block via `tr.doc.resolve(newS).before(depth)`, then `mapped.remove(mapped.find(bStart, bEnd)).add(tr.doc, rescan(bStart, bEnd))`. The `find`/`map`/`add`/`remove` API is confirmed at `prosemirror-view/dist/index.d.ts:194-229`.
4. Feed the index by `setMeta`, never by rescanning (R-002).

**Rationale**: The existing 500ms debounce does **not** protect this. `DEBOUNCE_SYNC_MS = 500` (`src/webview/editor.ts:182`, applied in `debouncedUpdate` at `:505-529`, called from `onUpdate` at `:721`) guards only the serialize-and-postMessage path. `plugin.state.apply` runs synchronously on every keystroke, ahead of the debounce. Decoration cost is on the typing critical path and must be paid per-transaction.

With this pattern, per-keystroke work is one `map` plus a regex pass over one paragraph, which meets SC-009 (300 definitions, typing indistinguishable from feature-off).

---

## R-006: Decorations leak into exports — strip them

**Decision**: Strip `[data-speckit-id]` wrappers in `collectExportContent`.

**Rationale**: `src/webview/utils/exportContent.ts:33-36` does `editor.view.dom.cloneNode(true)` and `:79` takes `clonedContent.innerHTML`. This is the only DOM-derived output in the codebase, so an exported PDF, HTML, or DOCX would contain `<a class="markdown-link" data-speckit-id="FR-001">FR-001</a>` — a dead link in a delivered document. `sanitizeExportHtml` (`src/features/documentExport.ts:44`) will not catch it; its own comment states that `style`/`class` "passes through untouched", i.e. it is a denylist.

Files on disk stay byte-identical either way — this is not the save path, so FR-024 and SC-005 are unaffected.

**Note**: this leak is pre-existing for other overlays. `.search-match` (`src/webview/editor.css:2470`) and `.validation-error-highlight` (`:2818`) leak the same way today. Fixing them is out of scope for this feature but worth recording.

---

## R-007: There is no existing path that opens another file *and* reveals a position in it

**Decision**: This gap must be closed by new code; nothing existing composes.

**Rationale**: Three capabilities exist separately and none combines:

- Open another file → `handleOpenFileLink` (`src/editor/MarkdownEditorProvider.ts:3039`) and `handleOpenFileAtLocation` (`:2082`). Both land in **VS Code's plain text editor** via `showTextDocument`.
- Reveal a position in the WYSIWYG editor → `navigateToHeading` (`src/webview/editor.ts:1623-1628` ← `src/extension.ts:107-114` ← `src/features/outlineView.ts:40-44`). Only in the **already-active** panel, and it carries a ProseMirror position, meaningless across documents.
- Resolve a target by name → the `#`-anchor branch (`src/webview/editor.ts:994-1017`). **Same document only, headings only.**

The existing click handler `handleLinkClick` (`src/webview/editor.ts:961`, bound `:1053`, torn down `:1076`) has four branches in order — external URL `:978-991` → `openExternalLink`; `#`-anchor `:994-1017` handled in-webview with no message; image `:1020-1036` → `openImage`; local file fallthrough `:1038-1049` → `openFileLink`.

Note the branch order hazard: an href of `./spec.md#FR-001` does **not** hit the anchor branch (it does not start with `#`), so it falls through to `openFileLink` with the fragment attached, fails `stat` twice, and raises `showWarningMessage('File not found: …')` (`MarkdownEditorProvider.ts:3090`) — a direct FR-010 and SC-007 violation.

Confirmed same-document-only: the anchor branch calls `buildOutlineFromEditor(editorInstance)` (`src/webview/utils/outline.ts:51-70`), which reads `editor.state.doc` and collects only `node.type.name === 'heading'` (`:56`). There is no cross-document variant and no host round-trip.

---

## R-008: Send an ID token, not a position and not a line number

**Decision**: The webview posts `{ type: 'openSpeckitDefinition', id, path }`. The host opens the artifact in the WYSIWYG editor and forwards the **ID** to the target panel, which locates the definition in its own ProseMirror doc and scrolls.

Flow:

1. New branch in `handleLinkClick` posts the message (R-009).
2. Host resolves `path` → `Uri`, reusing the two-step document-relative → workspace-relative resolution at `MarkdownEditorProvider.ts:3053-3086`.
3. Host runs `vscode.commands.executeCommand('vscode.openWith', uri, 'markdownForHumans.editor')`.
4. Host looks the panel up in the URI-keyed `openPanels` map (`:233-236`, populated `:486`, cleaned `:621-623`) and posts `{ type: 'revealSpeckitDefinition', id }`. If the panel is absent or not yet ready, it parks the request in a new `pendingReveals` map and flushes on `case 'ready'` (`:759`).
5. The target webview scans its own doc for the definition and calls the generalized reveal (R-010).

**Rationale**: The host holds a `TextDocument`, not a ProseMirror doc, so it cannot produce a valid position. And a line number cannot be mapped back to a bullet: `computeBlockLineRanges` (`src/webview/utils/aiContextReference.ts:119-174`) is one-directional, **top-level-block granular** — a bullet maps to its whole enclosing list, not the item — and it assumes the buffer matches disk.

An ID token is exact to the item, survives a dirty target buffer, writes nothing to disk (FR-024), and reuses the definition scanner that FR-013 requires building anyway.

**Editor choice**: the target opens in the WYSIWYG editor. `package.json` sets `contributes.customEditors[0].priority: "option"`, so `.md` does not open in this editor by default and users opt in per file — which is exactly why `handleOpenFileLink`'s `showTextDocument` yields the plain text editor today. The one existing way in is `vscode.commands.executeCommand('vscode.openWith', uri, 'markdownForHumans.editor')`, used by `markdownForHumans.openFile` (`src/extension.ts:44-80`, specifically `:73-77`). With `supportsMultipleEditorsPerDocument: false` (`MarkdownEditorProvider.ts:301-311`), an already-open tab for that URI is focused rather than duplicated.

This was a product decision, not a finding: opening in the WYSIWYG editor means a user who never opted in gets a WYSIWYG tab. Accepted deliberately — it is the only way to land on a list item or table row, and `handleOpenFileAtLocation` (`:2082`) remains available as graceful degradation for non-`file` schemes or when the scanner cannot find the definition.

**Alternatives rejected**:

| Alternative | Why rejected |
|---|---|
| Write anchors into the target file | Forbidden by FR-013 and FR-024. |
| Reuse `openFileAtLocation` with a line number | Zero new host code, but lands in the plain text editor and the webview cannot compute the line for a nested bullet. Retained only as fallback. |
| Extend `openFileLink` with a `#slug` fragment and reuse the anchor branch | The anchor branch is slug-based and heading-only (`outline.ts:56`), so addressing a bullet or table row would need a synthetic anchor scheme on both ends; `handleOpenFileLink` would also need fragment stripping (`:3056`) and still opens the text editor. |
| Resolve the position on the host, send a ProseMirror position | The host has no PM doc. Positions are only meaningful in the webview that produced them. |
| Route the reveal via `getActiveWebviewPanel()` (the `navigateToHeading` pattern) | The active panel is not reliably the just-opened one at dispatch time. Use the URI-keyed `openPanels` lookup. |
| Widen `OutlineEntry` to carry IDs | `isOutlineEntry` (`:265-282`) and `buildTree` (`outlineView.ts:279-304`) are heading-level-shaped, and the outline tree is a per-active-document view, not a cross-file index. |

---

## R-009: Dispatch on `data-speckit-id`, before the `href` read, and carry no `href`

**Decision**: Add one branch as the first statement in `handleLinkClick`, ahead of the `href` read at `src/webview/editor.ts:966`:

```ts
const speckitId = link.getAttribute('data-speckit-id');
if (speckitId) {
  e.preventDefault(); e.stopPropagation();
  vscode.postMessage({ type: 'openSpeckitDefinition', id: speckitId, /* … */ });
  return;
}
```

**Rationale**: The handler bails at `:969-972` when `href` is missing, and its routing branches on href *shape*, with anything unrecognized falling through to `openFileLink` (`:1039-1046`). An `href="speckit:FR-001"` would therefore reach `handleOpenFileLink`, which cannot carry a position (`:3128-3129`), opens the plain text editor, and raises a warning dialog on a miss (`:3090`) — three requirement violations. Dispatching on a data attribute before the href read avoids all of it, and the change is purely additive: no existing branch is touched.

**Accepted trade-off**: an `<a>` without `href` is not keyboard-focusable and offers no "Copy link address". Adding `href` would reopen the fallthrough hazard unless this branch strictly precedes it. If accessibility work is taken up, add both the `href` and the guard branch, in that order.

---

## R-010: Extract the reveal from `searchOverlay`, not from `scrollToHeading`

**Decision**: Generalize to `scrollToPos(editor, pos)`, extracted from `src/webview/features/searchOverlay.ts:185-220`.

**Rationale**: `scrollToHeading` (`src/webview/utils/scrollToHeading.ts:9-57`) is heading-specialized. After `setTextSelection` + `focus`, it climbs the DOM with `while (target && !target.matches?.('h1, h2, h3, h4, h5, h6'))` (`:36-40`), capped at depth 10. At a position inside a list item the climb walks `li → ul → .ProseMirror → #editor → body → html → null`, exits with `target === null`, and skips the explicit toolbar-offset scroll at `:43-51`. The position *is* reached via TipTap's default `focus({ scrollIntoView: true })` (`@tiptap/core/dist/index.js:520,531-532`), but with no offset compensation the target can land under the sticky `.formatting-toolbar`. Not a hard failure, but not a correct reveal.

`scrollToMatch` (`searchOverlay.ts:185-220`) is node-type agnostic: `setTextSelection({from,to})` → `view.dispatch(tr.scrollIntoView())` → `domAtPos` → `element.scrollIntoView({block:'center'})` → `window.scrollTo` fallback via `coordsAtPos`. `domAtPos`/`coordsAtPos` are position-based, so it works inside a `taskItem`, `listItem`, or `tableCell`.

`navigateToIssue` (`src/webview/features/auditOverlay.ts:760-796`) is the same shape plus `setNodeSelection` for atom nodes. **Two correct copies already exist — extract, do not write a third.**

---

## R-011: The webview does not know its own file path — this must be fixed regardless

**Decision**: Add the document's workspace-relative path to the `update` payload at `src/editor/MarkdownEditorProvider.ts:689-703`.

**Rationale**: Verified directly — the payload carries `content`, `skipResizeWarning`, `skipAiContextSaveWarning`, `imagePath`, `imagePathBase`, `showImageHoverOverlay`, `paragraphSpacingBefore`, `paragraphSpacingAfter`, `zoom`, `formattingShortcutsEnabled`, `blankLineMode`, `enableMath` — and no path or URI. It is consumed at `src/webview/editor.ts:1104-1143`.

The only way the webview can currently learn its path is `getAiContextRef`, which **saves the document first** (`:968-974`) — unusable as a path probe.

Without the path, the webview cannot determine its own feature folder, which FR-015, FR-018, and FR-019 all require. This is a prerequisite for the whole feature, independent of navigation.

---

## R-012: `openPanels` is not reachable from `extension.ts`

**Decision**: Keep the reveal dispatch inside the provider. Do not attempt to reach `openPanels` from `extension.ts`.

**Rationale**: `MarkdownEditorProvider.register` returns only a `Disposable` (`:299-313`), and `src/extension.ts:15-16` keeps no reference to the instance. The URI-keyed `openPanels` map (`:233-236`) is therefore only usable from inside the provider, so the new `openSpeckitDefinition` handler must live there (R-008 step 4).

`getActiveWebviewDocument()` (`src/activeWebview.ts:33-35`) exists and is unused by any navigation path found; it may be a cheaper hook, but its callers were not fully traced.

---

## Open risks carried into Phase 1

| # | Risk | Disposition |
|---|---|---|
| 1 | **`vscode.openWith` timing.** Whether it resolves after `resolveCustomTextEditor` has run (and thus after `openPanels.set` at `:486`) is undocumented and untested. | The `pendingReveals` + `ready` flush makes it moot, but needs runtime verification. |
| 2 | **`ready` fires exactly once per webview lifetime** — `hasSentReadySignal` (`src/webview/editor.ts:166,197-201`). So a reveal into an already-open panel cannot rely on it. | Needs an explicit "panel exists and has content" check, not just a `ready` flush. |
| 3 | **IME composition.** Rebuilding a decoration over the token being typed re-creates its DOM node, which can abort an in-flight composition. The repo has **zero** `composing`/`compositionstart` handling anywhere. | Mitigation is small (`if (view.composing) return prev;`, though `apply` has no `view` so it needs a `handleDOMEvents` flag). No house pattern exists. Flag for the Extension Development Host check. |
| 4 | **Target already open in the plain text editor.** With `priority: "option"` and `supportsMultipleEditorsPerDocument: false`, whether `openWith` replaces the text tab or adds a second tab for the same URI is unverified. | Runtime verification. |
| 5 | **Editing inside a decorated token.** The token will flicker in and out of linked state mid-edit as it transiently stops matching. | Decorations are strictly better than marks here (nothing sticky to inherit), but this needs a fixture. |
| 6 | **Third-party internals.** The `iterDeco`/`patchOuterDeco` argument in R-001 rests on `prosemirror-view` implementation detail, not only its public typings. `nodeName` itself is documented (`index.d.ts:147`); the mark-nesting order is not. | Pin with a jsdom assertion on rendered `view.dom` so a `prosemirror-view` bump cannot silently change it. |
| 7 | **`markdownConfig.ts` is dead code** (`:10`). | Do not extend. Consider deleting separately. |

## Verification harness already available

`src/__tests__/webview/aiContextReference.realEditor.test.ts:1-45` is a real-TipTap jsdom harness (`@jest-environment jsdom`, real `Editor`, real `Markdown` manager). The byte-identity proof for SC-005 and FR-024 is: build one editor with the extension and one without, assert `getEditorMarkdownForSync(editor, mode)` returns an identical string, and assert `editor.getJSON()` is deep-equal. That is genuine end-to-end evidence, not a mock — which constitution principle 2 requires.

---

## R-013: The extension host owns the index — the webview cannot participate

**Decision**: A new module under `src/features/speckitIndex/`, held as a field on the single `MarkdownEditorProvider` instance. Not on the per-panel closure in `resolveCustomTextEditor` — two documents in one feature folder must share one cache.

**Rationale**: No negotiation is available. The webview cannot read a file and cannot be handed one:

| Guard | Location | Consequence |
|---|---|---|
| `default-src 'none'` | `src/editor/MarkdownEditorProvider.ts:3635` | no `fetch`/XHR of any kind |
| `script-src 'nonce-…'` | `:3637` | no injected loaders |
| `img-src cspSource https: data: blob:` | `:3639` | images are the only resource class allowed in, and only after the host rewrites the URI |
| `localResourceRoots` | `:436-451` | gates `asWebviewUri` **resources**, not text reads |
| `enableScripts: true`, no `portMapping`, no `TextDocumentContentProvider` | `:454-457` | `postMessage` is the sole data channel |

The webview already proves the split: it cannot resolve even its own image `src` attributes and must round-trip through the host (`src/webview/extensions/customImage.ts:264-266` → `window.resolveImagePath` at `src/webview/editor.ts:383-393` → `handleResolveImageUri` at `:1377-1410`). A markdown file it never opened is strictly further out of reach.

One provider instance exists (`register()` → `new MarkdownEditorProvider(context)`, `:297-315`), and it already keys every live panel by document URI in `openPanels` (`:233-236`) with `supportsMultipleEditorsPerDocument: false` (`:309`) — a clean 1:1 panel↔document mapping, so one cache serves every open panel.

---

## R-014: Feature-folder discovery must NOT require `spec.md`

**Decision**: Walk ancestors of the document's directory for the first basename matching `/^\d{3}-/`. That is the feature root; its parent is the specs root. Purely path-based.

**This corrects FR-003 in the spec**, which currently says "the nearest enclosing folder that contains a `spec.md`".

**Rationale**: Three of 45 real feature folders have no `spec.md` — `010-multibase-example-app`, `011-multibase-platform-cli`, `023-eyecandy-bg-effects` — and `011` still defines `US8-1` (`011-multibase-platform-cli/ops-install.md:295`). A `spec.md`-gated detector silently disables the feature in ~7% of real folders.

Full algorithm:

1. Bail if `document.uri.scheme !== 'file'` — satisfies FR-019 for untitled docs, and matches existing scheme checks at `:321-323`, `:445`.
2. Ancestor-walk for `/^\d{3}-/` → feature root. Parent → specs root.
3. Index every `.md` under the feature root, **recursively**. Required, not optional: `FR-EX-###` lives in a sidecar (`005-casdoor-supabase-auth/token-refresh-addendum.md:56`) and `C-*` lives in `contracts/`.
4. Also index `<specsRoot>/briefs/*.md` when present — FR-016. `Q1` is only ever defined there (`briefs/fs-adapter-realtime.md:276`).
5. For cross-feature references (User Story 4), resolve on demand: list `<specsRoot>` for a directory matching `/^003-/`, index it, cache. Do not eagerly index all 45.
6. No matching ancestor → empty index, nothing links (FR-019).

**Do not use `.specify/feature.json` for discovery.** It records exactly one active feature — this repo's says `specs/001-speckit-id-links`; the corpus's said `specs/008-github-fs-adapter` while the agent was reading files in `045-github-app-credentials`. It answers "what am I working on", not "what folder is this document in", so it would mis-resolve 44 of 45 folders, and it is absent in any workspace not initialized by spec-kit.

**Family→artifact is a search order, not a single owner.** The survey's table reads as one artifact per family, but `Q` is defined in `briefs/` and referenced from `research.md`, and `P-APP-DIR` is defined in *both* `briefs/multibase-cli-reference.md:32` and `032-multibase-cli-framework/research.md:142`. Model each family as an ordered candidate list, first hit wins.

`tiny/` and `issues/` are correctly out of scope — zero bolded ID definitions in `tiny/`, and `issues/README.md:20-23` states issues are filename-identified.

---

## R-015: There are five definition syntaxes, not four, and every delimiter varies

**Decision**: Extract by line-scanning raw text with tolerant patterns. **This corrects FR-011 in the spec**, which names four syntaxes.

| Syntax | Real example | Correction to the spec |
|---|---|---|
| Plain bullet, bolded ID | `- **FR-001**: The package MUST…` (`007-fs-adapter/spec.md:127`) | **The trailing colon is optional** — `- **BR-4** When HTTPS is enabled…` (`briefs/multibase-ingress.md:92`), `- **Q1** What is the notification vocabulary…` (`briefs/fs-adapter-realtime.md:276`) |
| Checkbox bullet, bare ID | `- [x] T027 [P] [US1] Implement…` (`008-github-fs-adapter/tasks.md`) | ID is **not bolded** here. Beware the trailing `[P]` and `[US1]` tags — `[P]` is a parallel marker, not a priority marker |
| **Checkbox + bolded ID** | `- [ ] **US8-1**: Per-app db…` (`011-multibase-platform-cli/ops-install.md:295`) | **A fifth combination the four-syntax framing hides** |
| `##` heading | `## R-001: What replaces the OAuth App` (`045-…/research.md:10`)<br>`## R2. openrouter/free is NOT…` (`020-…/research.md:8`)<br>`## C1 — Stylesheet scope contract` (`037-…/contracts/palette-and-mode.md:5`) | **Separator is `:`, `.`, `—`, or nothing.** Match "heading text begins with the ID followed by a non-ID boundary", not a fixed delimiter |
| Table row, first cell | `\| R-001 \| How do we talk to the remote? \|` (`008-…/research.md:472`)<br>`` \| `P-APP-DIR` \| preflight(…) \| ``  (`032-…/research.md:142`)<br>`\| **P-APP-DIR** \| Run from a Vite app root… \|` (`briefs/multibase-cli-reference.md:32`) | **Three decorations: bare, backticked, bolded.** Matching only bare loses the entire digit-free `P-` family |
| User story (derived) | `### User Story 2 - Reopen the last folder (Priority: P2)` (`028-local-fs-adapter/spec.md:91`) | Match `/^#{2,4}\s+User Story\s+(\d+)\b/`, synthesize `US${n}`. Heading is `###`, not `##` |

Patterns must tolerate leading indentation — `AS#` definitions are *nested* bullets (`007-fs-adapter/tasks.md:171-174`).

**Fenced code must be skipped during extraction, not only during recognition.** FR-005 covers references only; without the same fence tracking on the definition side, a documentation example becomes a phantom target. Reuse the existing state machine — `isFenceDelimiterLine` in `src/shared/blankLinePolicy.ts:3-9` already handles ` ``` `/`~~~`, length ≥ 3, and the closing-fence-must-be-at-least-as-long rule. Do not write a second one.

**Line-scanning beats a markdown AST**: all five syntaxes are line-anchored, `findImageReferences` (`:2107-2160`) already establishes the house pattern (`split('\n')` → per-line regex → record line index), and an AST costs ~10× for zero benefit.

---

## R-016: Raw line numbers do not survive the crossing into the webview — measured

**Decision**: `line` is for the extension host only (ordering, and the plain-text-editor fallback). The WYSIWYG reveal is **text-anchored**, confirming R-008 with hard numbers.

**Rationale**: Content reaching the webview is transformed twice:

- `applyBlankLinePolicy` (`:663`, default mode `strip` per `:164`) collapses blank runs and trims leading/trailing blanks.
- `wrapFrontmatterForWebview` (`:3540-3570`) inserts two fence lines.

Measured on the corpus: **7 of 503 files have consecutive blank lines** (10 extra lines total) and **26 files carry frontmatter**. So roughly **6.5% of real files would have a silently off-by-N line number** in the webview — wrong about 1 file in 15, which is exactly the failure mode that presents as "usually works".

The house precedent already avoids this: existing cross-target navigation is text-anchored, not position-anchored. The anchor-link handler rebuilds the outline in the destination and matches by slug (`src/webview/editor.ts:996-1017`), and `scrollToHeading` takes a position computed *in the destination's own document*.

**Also: FR-014 needs no line mapping at all.** "The defining occurrence stays plain text" is decidable locally — the webview already knows whether a token is the first inline content of a list item, heading, or table cell. Deciding it in the webview removes the only other reason to map lines to positions.

---

## R-017: Both freshness mechanisms are required; they cover disjoint cases

**Decision**: One global `onDidChangeTextDocument` **plus** a `FileSystemWatcher` scoped to the feature root and `briefs/`. Skip `onDidSaveTextDocument` entirely.

| Mechanism | Fires for | Misses |
|---|---|---|
| `onDidChangeTextDocument` | dirty edits in any open doc, including custom-editor docs (webview `edit` → `applyEdit` `:3449` → `WorkspaceEdit`) | files not open in any editor |
| `createFileSystemWatcher` | create / change / delete on disk, including by external tools | unsaved buffers |
| `onDidSaveTextDocument` | nothing the other two miss | — **skip it** |

**Rationale**: The spec's own acceptance scenario (User Story 5, FR-025, SC-006) has the person editing `spec.md` while `tasks.md` is open. Those edits live in an in-memory dirty `TextDocument` — disk is stale, so no watcher and no save event fires. A disk-only index **fails acceptance scenario 5.1**. Conversely `onDidChangeTextDocument` never fires for a file nobody has open, so an editor-events-only index breaks on `git checkout`, on an agent writing `spec.md`, and on first open of a folder.

**The existing per-panel listener cannot be extended.** `MarkdownEditorProvider.ts:490-494` is registered per panel and filtered to that panel's own document (`e.document.uri.toString() === document.uri.toString()`). N open panels means N listeners each ignoring the other N−1 documents — precisely the cross-file case. Leave it alone. The right precedent is `src/features/wordCount.ts:112`, an unfiltered workspace-wide listener registered once.

**Reader that is dirty-correct without forcing files open:**

```ts
const open = vscode.workspace.textDocuments.find(d => d.uri.fsPath === p);
const text = open
  ? open.getText()                                                    // dirty content
  : Buffer.from(await vscode.workspace.fs.readFile(uri)).toString();   // disk
```

Prefer this over `vscode.workspace.openTextDocument(uri)`. The latter *is* dirty-correct — its contract is "will return early if this document is already open" (`@types/vscode/index.d.ts:14159`), which is why `findImageReferences` (`:2115`) uses it — but it **force-opens every artifact in the folder**, adding ~14 documents to `workspace.textDocuments` with a lifetime the extension does not control (`:14171-14172`).

**No feedback loop, given one hard constraint.** `applyEdit` → `onDidChangeTextDocument` → re-index → push → webview re-decorates → **stop**, because decorations do not modify the document. This holds *only if* the decoration plugin never dispatches a doc-changing transaction. That is a binding constraint on `speckitIdLinks.ts`, and it is what FR-024/SC-005 require anyway.

---

## R-018: Reuse the 500ms cadence; extraction is not the cost

**Decision**: Debounce the index at 500ms, reusing `DEBOUNCE_SYNC_MS` (`src/webview/editor.ts:182`). Build on open, not at activation. Re-extract only the changed file.

**Measured cost** (line-scanner running all five patterns plus fence tracking, over the real corpus):

| Scope | Files | Bytes | Lines | Candidate defs | Extract time |
|---|---|---|---|---|---|
| `008-github-fs-adapter` (largest) | 14 | 416 KB | 3,947 | 854 | **3.5 ms** |
| `013-pi-coding-agent` (most files) | 22 | 220 KB | 1,983 | 308 | 2.6 ms |
| `007-fs-adapter` (typical) | 8 | 89 KB | 958 | 287 | 1.2 ms |
| Whole corpus (worst imaginable) | 508 | 6.4 MB | 69,251 | 10,119 | **45 ms** |

SC-009's bar is 300 definitions; the worst real folder has ~854 and costs 3.5 ms. **Extraction is not the bottleneck.** The real costs are I/O (14 reads, tens of ms cold, then OS-cached) and payload size (~854 × ~70 B ≈ **60 KB** per revision — fine occasionally, wasteful per keystroke, which is what the debounce is for). Omit snippets from the payload; text-anchored reveal makes them unnecessary.

**Budget for SC-006**: keystroke → `edit` costs 500 ms. Another 500 ms for the index gives 1 s total, leaving 1 s of headroom in the 2 s budget. Do not reuse `AUTO_SAVE_DEBOUNCE_MS = 1000` (`:247`) — that leaves only 500 ms slack.

**Schedule**: discover the feature folder in `resolveCustomTextEditor`; build and push alongside the existing `settingsUpdate` in the `ready` handler (`:759-808`). Nothing runs until a markdown file is actually opened, satisfying constitution principle 5's ban on startup work.

**Cache**: `Map<featureRoot, { revision, files: Map<fsPath, Definition[]>, byId: Map<string, Definition[]> }>`. Invalidate one `fsPath` per change, bump `revision`, push only when `revision` changed. Drop a feature root when its last panel disposes — `onDidDispose` (`:611-631`) already cleans `pendingEdits`, `lastWebviewContent`, `inFlightApplyEdits`, `autoSaveTimers`, and `openPanels`; add the index to that list.

---

## R-019: Three new messages, no changes to existing ones

**A. `speckitIndex`** — extension → webview, push, no `requestId`. Model: `settingsUpdate` (`:569`).

```ts
{ type: 'speckitIndex',
  revision: number,              // monotonic; webview ignores stale/duplicate
  featureRoot: string | null,    // null ⇒ not in a feature folder ⇒ link nothing (FR-019)
  definitions: Array<{
    id: string, fsPath: string,
    line: number,                // 0-based, RAW file — host-side use only (R-016)
    kind: 'bullet'|'checkbox'|'heading'|'tableRow'|'userStoryHeading',
    headingText?: string,        // userStoryHeading only, for text-anchored reveal
  }> }
```

Sent from the `ready` handler (`:759-808`, beside the existing `settingsUpdate`), and from the debounced freshness path to every panel in `openPanels` whose document lies under the changed feature root — which is how a *background* `tasks.md` updates with no user action. `retainContextWhenHidden: true` (`:306`) guarantees a hidden panel is alive to receive it.

**B. `openSpeckitDefinition`** — webview → extension, fire-and-forget. Model: `openFileLink` (`:894`).

**C. `revealSpeckitDefinition`** — extension → webview, push. Model: `navigateToHeading` (`src/extension.ts:108-112` → `src/webview/editor.ts:1623-1628`).

**Critical: do not fold the index into `update`.** `updateWebview` (`:659-703`) is guarded by a content-equality check against `lastWebviewContent` (`:665-669`) and a 100 ms echo suppressor (`:673-675`), and the webview independently dedupes by content hash (`:180-190`). An index change with unchanged document content would be swallowed by all three layers.

**Deliberately not added**: a `getSpeckitIndex`/`speckitIndexResult` request/response pair. The push covers cold start via `ready`, and the index is small enough that pull-on-demand adds a state machine for nothing.

**House patterns confirmed**: request/response with a `requestId` and a resolver `Map` (`uriResolveCallbacks` at `src/webview/editor.ts:382-393`, reply `:1564`; `imageReferencesCallbacks` `:404-412`, reply `:1333-1341`; `queryDocumentDirty` with a 2s defensive timeout `:255-270`) is for **webview-initiated questions**. Unsolicited push with no `requestId` (`update`, `settingsUpdate`, `navigateToHeading`) is for **host-has-news**. The index is the latter. Note also that `document` arrives by closure into `handleWebviewMessage` (`:497-501`), so a new handler already knows which document asked — no URI need travel in the payload.

---

## R-020: Path resolution — use the derived roots as the allow-list, not `getAllowedFileRoots`

**Decision**: Discovery is document-relative (ancestor walk), which is the house default. But validate reads against the **derived feature root + specs root**, not `getAllowedFileRoots`. Reads only; never `writeFile`.

**Rationale**: The established ladder is document-first, workspace-fallback, then containment check:

| Helper | Line | Returns |
|---|---|---|
| `getDocumentDirectory` | `:321-338` | `dirname(fsPath)` for `file:`; else first workspace folder |
| `getWorkspaceFolderPath` | `:344-370` | `getWorkspaceFolder`, else the **longest-matching** folder sorted by path length (correct multi-root behavior) |
| `getAllowedFileRoots` | `:1449-1463` | de-duped allow-list: workspace folder + document dir + image base |
| `isPathContainedWithin` | `:3724-3748` | `path.resolve` both sides for Windows drive letters, case-insensitive on `win32` only |

Every mutating handler gates on `getAllowedFileRoots(document).some(root => isPathContainedWithin(abs, root))` (`:1793`, `:1906`, `:1970`, `:2333`), added per a security review (noted at `:1443-1448`).

But the feature root and `briefs/` can legitimately sit **outside** the workspace — `localResourceRoots` already anticipates this (`:445-451`) — so `getAllowedFileRoots` would reject a valid `briefs/`. Use the derived roots instead, and still run every path through `isPathContainedWithin` before reading, so a hostile `003/../../../../etc/passwd` cross-feature qualifier cannot escape.

`handleOpenFileLink` (`:3039-3095`) is the explicit two-step template to copy: `path.resolve(dirname(document.uri.fsPath), rel)` + `fs.stat`, retry against `workspaceFolders[0]` on failure.

---

## Corrections this research forces on the spec

| Spec item | Says | Must say |
|---|---|---|
All four are now **applied** to `spec.md`.

| Spec item | Said | Now says |
|---|---|---|
| **FR-011** | "a plain bullet …, a checkbox bullet, a `##`-level heading, and a table row" — four syntaxes | five syntaxes: checkbox-with-bare-ID and checkbox-with-bolded-ID are distinct forms. Plus explicit tolerance for the optional trailing colon, the several heading separators, the three table-cell decorations, and leading indentation (R-015) |
| **FR-005** | excluded code spans/blocks from **recognition** only | also excludes them from **definition extraction**, so a fenced example cannot become a phantom target (R-015) |
| **Edge cases** | "An ID defined twice in one artifact … links to the first definition" | adds the cross-artifact case: feature-folder definition wins over `briefs/`, because local scope is authoritative. `P-APP-DIR` is defined in both (`briefs/multibase-cli-reference.md:32` and `032-…/research.md:142`) |
| **Assumptions** | "a numbered folder holding `spec.md` and its companion artifacts" | a feature folder is identified by its **numbered name, not by the presence of `spec.md`**, and sidecars and nested subfolders are eligible (R-014) |

**Correction to this track's own report**: the agent attributed the `spec.md`-gating error to FR-003. That was wrong on two counts — it quoted the superseded first draft, and FR-003 in the current spec is about digit-free tokens. The real defect was in the Assumptions section, and is fixed there. FR-003 needed no change.

## Additional risks from this track

| # | Risk | Disposition |
|---|---|---|
| 8 | **`src/__mocks__/vscode.ts` is missing every API this feature needs.** It has `onDidChangeTextDocument` (`:83`) and no `createFileSystemWatcher`, no `findFiles`, no `openTextDocument`, no `workspace.fs`, no `RelativePattern`. `jest.config.js:33` maps `^vscode$` to it globally, so the mock must grow before any of this is unit-testable. | Real, currently-uncounted setup cost. Must appear in `tasks.md`. Two suites already stub `findFiles` locally (`src/__tests__/editor/imageReferences.test.ts`, `imageResizeInPlace.test.ts`) — standardize on one approach. |
| 9 | **Constitution principle 2 forbids mocking the boundaries this design leans on.** The freshness path needs an Extension Development Host test, not a mocked one. | The most expensive line item in this component, and not optional. Budget for it. |
| 10 | **Cold I/O is unmeasured.** Extraction is 3.5 ms; 14 reads over a network drive, container mount, or virtual FS are not. | Instrument reads separately from extraction — principle 5 demands per-stage timing anyway, and read-vs-extract is exactly the split that matters. |
| 11 | **A pathological feature folder** — 200 files, or a single 5 MB generated `tasks.md`. Nothing in the corpus approaches it; nothing guarantees the next corpus won't. | Per-folder budget with a bail-out, following the `MAX_FILE_SEARCH_RESULTS = 2000` precedent (`:216`). |
| 12 | **`revision` monotonicity across webview reloads.** `retainContextWhenHidden: true` (`:306`) keeps panels alive, but VS Code can still reload a webview. | The webview must treat "no index yet" and "revision went backwards" as "link nothing" rather than assuming continuity. `hasSentReadySignal`/`signalReady` (`src/webview/editor.ts:199-203`) is the reload seam. |
| 13 | **Text-anchored reveal is designed but unproven for table cells.** No existing code locates a non-heading target. | Needs a real check that a table-cell reveal scrolls somewhere sensible. Note the two navigation tracks disagreed here: R-010's analysis of `scrollToHeading`'s `h1–h6` climb is the more precise one — extract from `searchOverlay.ts:185-220` instead. |

---

## R-021: Closed prefix vocabulary — an allowlist, stated honestly

**Decision**: The family prefix vocabulary is **closed and enumerated** (~20 prefixes). A maximal `[A-Za-z]+` run that is not a declared prefix is not an ID. Match the letter prefix **greedily** — this is load-bearing: `TS7016` must yield prefix `TS`, not `T` + `S7016`; `PGRST116` must yield `PGRST`, not `P`.

Architecture is two layers, deliberately separated:
- **Layer A** — token patterns (closed vocabulary).
- **Layer B** — boundary predicates evaluated *at match time*, not as a post-filter. Nearly all rejection power lives here.

A candidate is accepted iff its pattern matches **and** both boundary predicates hold.

**Rationale, measured**: this single rule rejects, with no denylist, every named look-alike — `HS256` (46), `AES-256` (39), `ES2022` (33), `SHA-256` (23), `DNS-1123` (22), `DNS-01` (13), `UTF-8` (8), `RS256` (7), `VT323` (5), `PGRST*` (16), `TS7016` (2), `SHA-1` (2), `ISO-8601` (1), `X-Kong-Upstream-Latency`, plus all four deliberate placeholders. It also rejects ~40 look-alikes the survey never listed but which are present: `Route53`, `Auth0`, `Base64`, `PG15/16/17`, `WebGL2`, `Qwen3`, `GPT-5`, `Deno-2`, `Tailwind-4`, `A11y`, `IX1`, `Spec-014`, `Large-1000`, `Phase-1`, `Phase-8`, `B-1`, `K8s`, `S256` (PKCE), and commit hashes like `Xabc1234`.

**Honest framing**: this is not "structure beats denylist", it is "**allowlist beats denylist**". The closed vocabulary *is* an allowlist — a bounded one, which is why it works.

**Ablation F** — replacing the closed vocabulary with an open `[A-Z][A-Za-z]{0,5}-?\d{1,4}[a-z]?`: **+1,948 false accepts**, dominated by 611 priority markers and the entire named-constant set. That is the empirical answer to "a permissive regex is dangerous."

---

## R-022: The `P` collision dissolves — bare `P<digits>` is never an ID

**Decision**: `P` followed only by digits is not an ID. The `P-` family requires a hyphen followed by an **uppercase letter**: `P-[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*`.

**Rationale**: all 725 bare `P\d+` occurrences in the corpus were inspected. **Every single one is a priority marker** — `(Priority: P1)` ×367, plus `(P1)`, `P1→P3`, `P1/P2`, `P1–P3`, and bare prose "the P1 stories". Zero are IDs.

| | count | accepted |
|---|---|---|
| `FR-P##` occurrences (7 distinct IDs, `FR-P01`–`FR-P07`) | 51 eligible | **51 (100%)** |
| `(Priority: P#)` markers | 367 | **0** |
| all bare `P\d+` | 725 | **0** |
| `P0001` (Postgres error code) | 7 | **0** — same rule |
| `P-<CAPS-KEBAB>` preconditions | 94 eligible | **94 (100%, 0 missed)** |

**Why no context detection is needed**: `FR-P07` is matched **whole** by the grouped-FR pattern, and the scanner resumes at the token's end — so `P07` is never even a candidate. A context rule would have had to cover all five marker forms, i.e. 358 of the 725 occurrences that `(Priority: …)` does not cover.

**Ablation D** — admitting `P\d+` as a family: **+693 false positives**. That is the entire cost of getting this one rule wrong.

`P-256` (the NIST curve) has zero occurrences here, but the `P-[A-Z]` requirement already rejects it.

---

## R-023: Boundary predicates

```
LEFT(t, i)  ≡ i == 0
            ∨ t[i-1] == '/'                                   # slash-group member
            ∨ (t[i-1] == '-' ∧ ¬ prefix_run_is_ID_shaped(t, i-1))
            ∨ t[i-1] ∉ [A-Za-z0-9_\-#~$%@]

RIGHT(t, j) ≡ j == len(t)
            ∨ (t[j] == '-' ∧ a complete same-grammar ID begins at j+1)
            ∨ t[j] ∉ [A-Za-z0-9\-]
```

Left-side `#`, `~`, `$`, `%`, `@` are rejected specifically for `…#L257` (47 occ), `~L116-121`, and template interpolation.

**The refined hyphen clause earns its complexity**: a naive "reject anything after a hyphen" costs 9 genuine references (`per-FR-022`, `clarify-Q1`…`Q4`) and buys nothing measurable, because maximal munch already consumes compounds whole. The refined form recovers all 9 and adds **zero** false positives. It also preserves FR-009 *structurally*: the run before the hyphen in `FR-P07` is `FR` (uppercase-initial), so the fragment is rejected no matter what the family table later grows to contain.

**Compound-fragment rejection has three independent mechanisms**: (1) maximal munch plus resume-at-end, so `CORE` in `C-CORE-3` is never a candidate; (2) `CORE`/`UI`/`GUARD`/`VD`/`EX` contain no digits and are not `P-` shaped, so no pattern matches them in isolation; (3) the left-hyphen predicate as defence-in-depth. **Measured: 0 standalone fragments accepted across 508 files.**

---

## R-024: Compressed references — endpoints only, and that is forced

**Decision**: Link every ID **literally present**. Do not synthesize intermediates. Groups and ranges therefore need no distinction — they collapse to one rule.

**Rationale — three reasons, the first decisive**:

1. **There is no text to decorate.** A decoration needs a character range in the document. `FR-017–FR-021` contains exactly two ID substrings; `FR-018` appears nowhere. Rendering it would require *inserting characters*, violating FR-023 and FR-024.
2. The spec already says so — User Story 3 scenario 2 says "both endpoints", and SC-004 says "every ID **named**".
3. Author usage supports it: `V1–V20` would mean 18 phantom links, and `T060–T060c` would require stepping a mixed numeric/alpha space with no way to know whether `T060b` exists.

**Expansion is only needed for abbreviated members.** Fully-qualified members (`SC-001/SC-002`, `T003→T004`, `FR-019 through FR-022`) are found by the ordinary scan. Of 736 accepted tokens whose left neighbour is `/`, only 214 needed expansion; 237 members expanded in total.

Rules: seed **only** from a confirmed anchor (a bare `010` never links alone); require **shape compatibility** against the *head's* body pattern, so `FR-A01–A05` yields `FR-A05`, never `A05` or `FR-005`; ASCII `-` admits **only fully-qualified** members, which is what keeps `L76-82`, `T016-scaffolding`, and `T038-login-screen.txt` rejected while `US1-US5` and `T026-T028` work. Separators must be tried longest-first (`...` before `..`) or the ellipsis mis-splits.

**Comma abbreviation is deliberately unsupported.** `FR-011, 042` occurs exactly once; supporting it would make every "`FR-001`, 42 users" a false positive.

Bracketed `[US1]` needs no rule — brackets are ordinary non-word characters and fall outside naturally.

---

## R-025: The cross-feature syntax in the spec does not exist

**Decision**: The real form is `NNN` + whitespace + ID, **68 occurrences**. **This corrects User Story 4 in the spec.**

**Rationale**: searching all 508 files for `\d{3}/(FR|SC|T|US)` returns **0 occurrences**. The survey's `003/FR-004` and `006/SC-002` are misreadings of slash *groups* — the cited evidence at `033-multibase-publishing/data-model.md:79` is `(FR-009/010)`, and `031-multibase-ingress/contracts/tcp-forwarding.md:3` is `SC-006/SC-009`, where the "`006/SC-002`" reading splits an ID in half.

Real examples: `008 FR-P07` (`045-github-app-credentials/tasks.md:35`), `019 FR-010` (9), `007 FR-026` (6), `006 FR-024` (4), `(008 R-010)`, `(013 T082)`, `024 D13`, `013 R1`, `014 US2`, `(039 SC-008)`, `007 FR-024a`. Also with a lead word or possessive: `spec 014 FR-028`, `spec 026's FR-030–034`, `008's FR-P07`.

```
QUALIFIER := (?<![0-9A-Za-z_-]) (\d{3}) (?:'s)? [ \t] (?=ANCHOR)
             where \1 names an existing sibling feature directory NNN-*
```

It **retargets** an already-recognized token and never creates one. Requiring exactly 3 digits plus a directory match keeps `2026 06 19`, `1024 FR-…`, and `100 T` out. Telling it apart from a slash group is trivial: a qualifier's left side is a bare 3-digit number with no family prefix, which never parses as an ID; a slash group's left side is always a full ID.

**Implementing `NNN/ID` would add parse risk to the 132 real abbreviated slash groups for zero benefit.**

---

## R-026: Six ordered stages

Each stage depends on the previous one's guarantees.

| Stage | What | Why here |
|---|---|---|
| **0** | Node-level exclusion at the AST — inline code, fenced and indented code, existing links (**both label and href**), autolinks, image alt text, bare URLs | Must be first: removes **887 occurrences (4.5%)** every later stage would get wrong. Markdown structure is invisible to a text scanner. Decorating then un-decorating is where off-by-one bugs live. 3 corpus links carry an ID in the label — rare, but FR-006 is explicit |
| **1** | Anchored tokenization, leftmost, maximal munch, single alternation | — |
| **2** | Reject-before-emit; on rejection resume at `start + 1`, on acceptance resume at `end` | Essential: in `versionFR-001`, rejecting at offset 7 and resuming at 8 correctly rejects `R-001` too. Resuming at `end` would hide a real ID starting inside a rejected span. Resuming at `end` on *acceptance* is what makes maximal munch protect compound interiors |
| **3** | Continuation expansion, seeded only from confirmed anchors | Cannot precede stage 2 — expanding from an unconfirmed match lets a look-alike seed a chain |
| **4** | Cross-feature qualifier binding | Must follow stage 3 so `SC-006` in `SC-006/SC-009` is already a token and its `006` can never be misread as a qualifier |
| **5** | Resolution against the definition index; unresolved → drop entirely, no styling, no error (FR-010) | Makes conservative recognition affordable, and is the right home for anything shape cannot decide |
| **6** | Suppress the self-reference (FR-014) | Last — needs both the token set and the index |

**Alternation order is provably not load-bearing**: 12 random permutations of the 20 patterns produced byte-identical output, 18,722 tokens each time. The patterns are pairwise disjoint at any given start offset. Declare them longest-first anyway so the property survives the next family someone adds.

**`\b` word boundaries are unusable** — `\b` treats `-` as a boundary, so `FR-P07` yields fragment `P07` and `C-CORE-3` yields `CORE`. The custom left predicate exists precisely for this.

---

## R-027: Measured results

| | value |
|---|---|
| Files scanned | 508 |
| **Tokens accepted** | **18,722** (18,485 anchored + 237 expanded) |
| Distinct IDs | 1,067 |
| Correctly excluded per FR-005 (code/URL/link-target) | **887 (4.5%)** |
| Cross-feature references bound | 68 |
| Accept/reject suite | **109/109 pass** (33 accept, 76 reject) |
| **False positives** | **0** across every look-alike class |
| **False negatives** | **12 (0.064%)** |

False positives measured at zero for: named constants (235 occ), placeholders (4), priority markers (367), all bare `P\d+` (725), `file:line` spans (730), `#L` fragments (47), compound fragments, and ~40 unlisted look-alikes.

Method for the zero claim: an independent **over-generating** matcher was run over the corpus and all 213 distinct accepted token shapes plus all 213 distinct rejected shapes were classified by hand. Every accepted shape belongs to a declared family.

**Resolution rates** against a crude definition index scoped to the document's own feature folder ∪ `briefs/`:

| family | accepted | resolved | rate |
|---|---|---|---|
| `FR-###` | 5,303 | 5,138 | 96.9% |
| `T###` | 5,298 | 5,248 | 99.1% |
| `US#` | 3,248 | 3,234 | 99.6% |
| `SC-###` | 1,822 | 1,789 | 98.2% |
| `FR-<L>##` | 670 | 664 | 99.1% |
| `R#` | 603 | 602 | 99.8% |
| `C-<ns>-#` | 562 | 562 | 100% |
| `R-###` | 331 | 324 | 97.9% |
| `C#` | 318 | 317 | 99.7% |
| `Q#` / `BR-#` / `P-<CAPS>` / `AS#` / `SC-EX-###` | 170 / 128 / 94 / 6 / 4 | all | 100% |
| `OQ-#` | 49 | 35 | 71.4% |
| `AD-#` | 30 | 15 | 50.0% |
| **TOTAL** | **18,722** | **18,411** | **98.3%** |

The 311 shortfalls are: cross-feature references (resolvable once R-025 is wired into resolution, which the measurement script did not do), genuinely undefined IDs (`FR-015` retired-and-vacant ×9, `OQ-8` never defined — correct behavior per FR-010), and **definition-index gaps**, not recognition gaps. `AD-#` at 50% and `OQ-#` at 71% are entirely explained by R-028.

---

## R-028: A sixth definition syntax — bolded ID opening a paragraph

**Decision**: **This corrects FR-011 again.** There is a sixth form: a bolded ID opening a *paragraph* (not a list item), with the delimiter after it being `—`, `–`, `(`, or nothing at all.

Evidence, all from `briefs/multibase-ingress.md`:

```
**AD-4 — The IDP is served at root…**
**AD-5** When HTTPS is on…
**AD-6 (BR-17)** All TCP forwarding…
```

This single gap caps `AD-#` resolution at 50% and `OQ-#` at 71%.

Also two bullet variants that FR-011's "bolded ID followed by colon" wording still excluded: `- **BR-1** HTTP and HTTPS MUST…` and `- **C1** The markdown content…` — bold ID, **no colon**.

---

## Corrections this track forces on the spec

Applied to `spec.md`:

| # | Spec item | Said | Now says |
|---|---|---|---|
| 1 | **FR-001** | lists `P-#` and `E-#` as families | both **removed — 0 corpus occurrences each**. The survey's "P-1 (12)" and "E-1 (11)" are miscounts of the `C-P-#` and `C-E-#` contract-namespace interiors. Removing `P-#` also reduces FR-008's collision to one line |
| 2 | **User Story 4** | Independent Test and scenario 1 use `003/FR-004`, `006/SC-002` | rewritten against the real form, `NNN` + space + ID (68 occ), e.g. `008 FR-P07`, `013 T080`. **`NNN/ID` has zero corpus occurrences** |
| 3 | **FR-011** | five definition syntaxes | **six** — adds the bolded ID opening a paragraph (R-028) |
| 4 | **SC-002** | "≥95% resolve, and the four highest-volume families reach 100%" | **100% is unachievable as literally written** — the corpus references deliberately vacant IDs (`FR-015` ×9) and never-defined ones (`OQ-8`), which FR-010 says must stay plain. Reworded to a measured, achievable target |
| 5 | **Look-alike list** | ~150 named | test fixtures must also cover `Route53`, `Auth0`, `Base64`, `PG15/16/17`, `WebGL2`, `Qwen3`, `GPT-5`, `Deno-2`, `Tailwind-4`, `A11y`, `IX1`, `Spec-014`, `Large-1000`, `Phase-1/8`, `B-1`, `K8s`, `S256`, commit hashes. All already rejected by the closed vocabulary — a fixture gap, not a design gap |

Corrections to the **survey** (not the spec — recorded for accuracy):

- `R-###` is **not always 3 digits**: `R-1`…`R-11` are real (27 occ). An `R-\d{3}` rule drops all of them.
- Task revision suffixes run **`a`–`l`**, not `a`–`f` (`T019a`…`T019l` in `013-pi-coding-agent/tasks.md`). An `[a-f]` rule drops 20+ references.
- `C#` is **~323 occurrences, not ~37** — the survey's figure counted only `C-#`.
- `A-#` is defined in a **`contracts/` table** (`039-optional-filesystem-doctree/contracts/agent-filesystem-report.md:40-48`), not `quickstart.md`.
- `SC-<L>##` (grouped success criteria) has **0 occurrences** — kept in the grammar for symmetry only.

## R-029: A nineteenth family exists — `D#`, 617 references

**Not in scope, and it will read as a bug.** `D#` is defined as `## D1 — <title>` headings in `research.md` and referenced as `research D10`, `D1–D10`, `plan D7`, and cross-feature as `spec 024 D13`. At **617 references** it is larger than eight of the eighteen in-scope families.

Deeper finding: `D#`, `R#`, `C#`, and `Q#` are **not four families — they are four instances of one ad-hoc per-document convention**, `<single uppercase letter><digits>`, defined in table rows, `##` headings, or bold bullets. The corpus also uses `V1`–`V27` (145), `A1`–`A13` (107), `S1`–`S10` (44), `U1`–`U4` (38), `B1`–`B14` (36), `E1`–`E9` (25), `G1`–`G9` (19), `M1`–`M7` (18), `L1`–`L11` (14), `I1`–`I4` (13), `TM1`–`TM3` (9), `H1`–`H4` (7), plus `W#`, `N#`, `F5` — roughly **600 further references**.

**Recommendation: keep the vocabulary closed. Do not generalize to `[A-Z]\d+`.** Admitting the convention wholesale is exactly what makes `L#` collide with the 108 line references and `P#` collide with the 367 priority markers, with no shape-level discriminator available. If one is added later, add exactly `D` and nothing else — it has the strongest case by volume.

`L#` specifically should stay out of v1 and be said so out loud: there is no shape rule separating contract `L10` from "line 26 of spec.md". The only workable discriminator is resolution-gated recognition.

## Residual known-wrong cases

1. **12 missed occurrences** (0.064%); 6 are `T1`–`T6` in `tiny/`, moot because `tiny/` is not a numbered feature folder (FR-019 excludes it). Others: `(US3-AC4)`, `(US4-AC3)`, `T041f-era`, `T016-scaffolding`, `~T030`, `C8/R10-2`.
2. **`FR-T001–T003` is irreducibly ambiguous** if anyone writes it — a truncated grouped-FR tail versus a task ID. Safe today only because grouped-FR bodies are exactly 2 digits and task bodies exactly 3.
3. **`US1-3` meaning "US1 through US3"** would read as acceptance scenario `US1-3`. Does not occur.
4. **`R10-2`** (1 occ) rejected outright — genuinely ambiguous.
5. **~1,200 references across 14 out-of-scope single-letter families** are silently unlinked. `D#` (617) is the one users will notice.
6. **The measurement harness masks code with regex**, an expedient that would not ship. Production must use the editor's AST, so the 887 exclusion figure will shift slightly.
7. **Resolution figures used a crude index** and did not implement cross-feature lookup. 98.3% is a floor, not a ceiling.
