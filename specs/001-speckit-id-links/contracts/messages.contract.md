# Contract: Extension ↔ Webview Messages

**Feature**: [spec.md](../spec.md) | **Research**: [research.md](../research.md) (R-008, R-009, R-019)

Three new message types. **No existing message changes shape**, with one additive exception (C-msg-1). The extension host owns the file system; the webview owns the document view. `postMessage` is the only channel — the webview's CSP is `default-src 'none'`, so it cannot read a file even if handed a path.

These contract tests MUST lock the message shapes before any dependent work starts (constitution principle 1).

---

## C-msg-1 · `update` gains the document path

**Additive change to an existing message.** The `update` payload currently carries content and settings and **no path or URI** — verified. Without it the webview cannot determine its own feature folder, which FR-015, FR-018, and FR-019 all require.

```ts
{ type: 'update', /* …all existing fields unchanged… */, documentPath: string }
```

- **C-msg-1a**: Every existing `update` field is still present and unchanged in type.
- **C-msg-1b**: `documentPath` is absent or null for a non-`file` scheme, and the webview then links nothing.
- **C-msg-1c**: This is a prerequisite for the whole feature, independent of navigation. It must land first.

---

## C-msg-2 · `speckitIndex` — host → webview, push

Unsolicited push, no `requestId`. Follows the `settingsUpdate` pattern.

```ts
{ type: 'speckitIndex',
  revision: number,
  featureRoot: string | null,
  definitions: Array<{
    id: string,
    fsPath: string,
    line: number,            // raw-file coordinates, host-side use only
    kind: 'bullet' | 'checkboxBare' | 'checkboxBold' | 'heading' | 'tableRow' | 'paragraphBold' | 'userStoryHeading',
    headingText?: string,
  }> }
```

- **C-msg-2a**: **MUST NOT be folded into `update`.** Three separate layers would swallow it — a content-equality guard, a 100ms echo suppressor, and the webview's own content-hash dedupe. An index change with unchanged document content would silently never arrive. This is the single most important assertion in this contract.
- **C-msg-2b**: `featureRoot: null` means link nothing (FR-019).
- **C-msg-2c**: `revision` is monotonic. The webview ignores a revision equal to or lower than the one it holds.
- **C-msg-2d**: A revision that goes **backwards** — possible after a webview reload — is treated as *link nothing*, never as continuity.
- **C-msg-2e**: Sent on `ready`, alongside the existing `settingsUpdate`, and again from the debounced freshness path.
- **C-msg-2f**: Sent to **every** panel whose document lies under the changed feature root, not only the active one. This is how a background `tasks.md` updates with no user action, satisfying FR-025 and SC-006.
- **C-msg-2g**: Carries no snippets. The text-anchored reveal makes them unnecessary, and payload size is the real cost — ~60KB for the largest real feature folder.
- **C-msg-2h**: Definition count is capped, following the existing search-result cap precedent, and the cap is logged when hit. A silent truncation would read as "no such ID".

---

## C-msg-3 · `openSpeckitDefinition` — webview → host, fire-and-forget

Follows the `openFileLink` pattern. Note the handler already knows which document asked, because `document` arrives by closure — no URI travels in the payload.

```ts
{ type: 'openSpeckitDefinition', id: string, fsPath: string,
  kind: string, headingText?: string }
```

- **C-msg-3a**: Dispatched from a branch that is the **first statement** in the link click handler, before the `href` is read. Later placement lets the token fall through to the local-file branch, which cannot carry a position, opens the plain text editor, and raises a `File not found` dialog on a miss — violating FR-010, FR-022, and SC-007 at once.
- **C-msg-3b**: Dispatch keys on the `data-speckit-id` attribute, not on an `href`. The decoration carries no `href`.
- **C-msg-3c**: When `fsPath` is the current document, the host bounces straight back as C-msg-4 without reopening anything.
- **C-msg-3d**: Otherwise the host opens the target **in this WYSIWYG editor**, via the custom viewType. Plain `showTextDocument` yields VS Code's text editor instead, because the custom editor's priority is `option`.
- **C-msg-3e**: The host resolves `fsPath` document-relative first, then workspace-relative, then validates containment against the derived feature and specs roots before reading. A traversal attempt inside a cross-feature qualifier must be rejected.
- **C-msg-3f**: No existing branch of the click handler changes behavior. Ordinary markdown links, anchors, images, and external URLs are untouched.

---

## C-msg-4 · `revealSpeckitDefinition` — host → webview, push

Follows the `navigateToHeading` pattern.

```ts
{ type: 'revealSpeckitDefinition', id: string, kind: string, headingText?: string }
```

- **C-msg-4a**: Carries **no position and no line number**. The host holds a `TextDocument`, not a ProseMirror doc, so it cannot produce a valid position; and raw line numbers are wrong in ~6.5% of real files because content is rewritten twice on its way into the webview.
- **C-msg-4b**: The receiving webview locates the definition in **its own** document and scrolls there.
- **C-msg-4c**: Must be buffered when the target editor is not yet constructed, following the existing pending-initial-content pattern. Dropping it on a null editor loses the navigation.
- **C-msg-4d**: The host queues a reveal for a panel that is absent or not yet ready, and flushes on `ready`.
- **C-msg-4e**: **`ready` fires exactly once per webview lifetime.** So a reveal into an already-open panel cannot rely on the flush. The host needs an explicit "panel exists and has content" check as well. This is the likeliest source of a "first click works, second does nothing" bug.
  - The same window swallows **content**, not just reveals. `resolveCustomTextEditor` posts the document optimistically right after assigning the webview HTML, and `updateWebview` caches that payload *before* posting it — so an unforced resend on `ready` hits the equality guard and posts nothing. The `update` sent on `ready` MUST therefore bypass both dedupe guards (`force`). Without it, a webview that missed the optimistic push stays blank for the life of the tab, with no error and no retry. Covered by `src/__tests__/editor/initialContentDelivery.test.ts`.
- **C-msg-4f**: Reveal works for a position inside a list item, task item, and table cell — not only a heading. The existing heading-specific scroll helper walks up looking for `h1`–`h6` and finds nothing for a bullet, skipping its sticky-toolbar offset. Extract the node-agnostic reveal that already exists in the search overlay rather than writing a third copy.
- **C-msg-4g**: When the definition cannot be found in the parsed document, fall back to the existing line-based open-at-location handler, which lands in the plain text editor where raw line numbers are correct. Degrade, never error.

---

## Cross-cutting

- **C-msg-5**: No new message weakens the CSP, adds a `localResourceRoot`, or introduces a resource load. Text crosses as message data only.
- **C-msg-6**: The webview writes nothing and requests no write. The feature is read-only at both ends.
- **C-msg-7**: **The refresh loop terminates.** `applyEdit` → change event → re-index → `speckitIndex` → re-decorate → stop, because decorations do not modify the document. Assertion: dispatching an index push produces a transaction with `docChanged === false`, so the editor's update event does not fire and no sync is attempted. If the decoration plugin ever dispatches a doc-changing transaction this loop becomes infinite — that is a hard constraint on the plugin, and FR-024 requires it anyway.
- **C-msg-8**: The VS Code mock must grow before any of this is unit-testable. It currently has a change-document event and **none** of `createFileSystemWatcher`, `findFiles`, `openTextDocument`, `workspace.fs`, or `RelativePattern`, and jest maps `vscode` to it globally. Two existing suites stub file-finding locally; standardize on one approach rather than adding a third.
- **C-msg-9**: Per constitution principle 2, the freshness path is a core integration boundary and MUST be verified against real document-change events in an Extension Development Host, not against the mock. The mock is for the tokenizer and the extraction logic, not for proving the integration works.
- **C-msg-10**: **`requestContent`** (webview → host) is the content watchdog re-asking after no `update` ever arrived. It shares the `ready` handler body, which is idempotent, and does not re-fire `ready` semantics. The webview arms it after signalling `ready`, disarms it on the first `update`, retries at most 3 times, then paints a failure into `#editor` — a silent blank pane is never an acceptable end state. Covered by `src/__tests__/webview/contentWatchdog.test.ts`.
