# Task: Image Path Robustness

## 1. Task Metadata

- **Task name:** Image Path Robustness
- **Slug:** image-path-robustness
- **Status:** shipped
- **Created:** 2025-12-01
- **Last updated:** 2026-02-27
- **Shipped:** 2026-02-27

---

## 2. Context & Problem

**Current state:**
- Speckit for Humans renders images in the webview by resolving `src` attributes through the extension (`handleResolveImageUri`)
- Workspace images inserted via drag & drop / paste are saved with filesystem-friendly relative paths (e.g. `./images/foo bar.png`) and generally work
- Many existing markdown documents (imported from web, docs tools, or static sites) use URL-encoded image paths like `Hero%20Image.png` or `images/My%20Diagram%201.png`
- The resolver currently treats `relativePath` as a raw filesystem path and never URL-decodes it before resolving

**Pain points:**
- **Broken images in real-world docs:** Markdown that works on GitHub / websites fails to render images in the WYSIWYG view when filenames contain spaces and `%20` encoding
- **Surprising behavior:** Users see the same repository render fine on GitHub but show broken images in Speckit for Humans
- **Workspace friction:** Mixed content (images created via the extension + legacy `%20` paths) behaves inconsistently in the same file
- **Debugging overhead:** Users have to inspect the filesystem and manually rewrite image URLs just to get previews working
- **Product trust:** “Images just work” is an expectation for a modern markdown editor; broken screenshots hurt perceived quality

**Why it matters:**
- **Reading experience:** Images are core to technical docs and blog posts; missing screenshots break narrative flow
- **Adoption friction:** Users often bring existing markdown into VS Code; incompatibility with common URL-encoding patterns is a silent adoption killer
- **Alignment with VS Code:** VS Code’s own markdown preview is tolerant of typical relative paths; Speckit for Humans should match or exceed that robustness
- **Foundation for future features:** Robust path handling is a prerequisite for advanced features like image refactors, workspace moves, and export flows

---

## 3. Desired Outcome & Scope

**Success criteria:**
- Markdown documents that use URL-encoded image paths (e.g. `%20`, `%23`) for workspace files render correctly in the WYSIWYG view
- Relative image paths are resolved in a way that matches how authors intuitively structure repos:
  - `./images/foo bar.png`
  - `images/My%20Diagram.png`
  - `../assets/screenshots/Hero%20Image.png`
- Remote images (`http://`, `https://`) and data URIs continue to work as-is
- Image resolution remains fast (<5ms overhead per unique path in typical documents) and does not materially affect editor performance
- Behavior is consistent across:
  - Markdown typed or edited by hand
  - Images inserted via workspace drag & drop
  - Images pasted from clipboard (saved via extension)
- No regressions in existing image features (drag & drop, paste, save-to-folder flow)

**In scope:**
- Normalization of image paths before filesystem resolution in the extension, including:
  - URL-decoding path segments for workspace-relative paths
  - Preserving directory separators and relative segments (`./`, `../`)
  - Handling `file://` URIs and absolute paths coming from VS Code APIs when needed
- Alignment of behavior between WYSIWYG rendering and what ends up in the markdown source
- Unit tests for path normalization and resolution logic
- Manual verification with real markdown docs that include spaces and `%`-encoded characters in image filenames

**Out of scope:**
- Changing where images are stored on disk (folder layout, renames, migrations)
- Implementing image rename / refactor tooling across a workspace
- Non-image asset resolution (e.g. links to PDFs or other attachments)
- Export pipelines (PDF/HTML) beyond ensuring they can rely on the corrected paths

---

## 4. UX & Behavior

**Entry points:**
- Opening any `.md` file in Speckit for Humans that already contains image references
- Typing or pasting markdown image syntax in source view (future) that includes URL-encoded paths
- Images inserted via existing drag & drop / paste flows (should continue to "just work" and be resilient if users later hand-edit the paths)

**User flows:**

### Flow 1: Open existing doc with URL-encoded image paths
1. User opens a markdown file that contains images like:
   - `![Hero](marketplace-assets/screenshots/Hero%20Image.png)`
   - `![Diagram](../assets/Diagrams/My%20Diagram%201.png)`
2. Speckit for Humans loads the WYSIWYG editor.
3. All images that exist in the workspace at the corresponding decoded paths render correctly (no broken-image icons).
4. User can scroll and read the document with screenshots inline, matching GitHub/web behavior.

### Flow 2: Mix of legacy `%20` paths and new images
1. User opens a doc that has some legacy `%20`-encoded image paths and inserts new images via drag & drop.
2. New images are saved to the chosen folder using the existing naming rules (including spaces if present).
3. Both old and new images render correctly in WYSIWYG.
4. If the user later edits image markdown by hand (e.g. changing spaces to `%20` in the path), the images continue to resolve as long as the underlying file exists.

### Flow 3: Remote and data URLs
1. User has images with `https://` URLs and `data:` URIs in the same document.
2. These images are not treated as workspace files and are passed through unchanged.
3. They continue to render exactly as before.

**Behavior rules:**
- For `src` values starting with `http://`, `https://`, `data:`, or `vscode-webview://`, the extension must not rewrite paths.
- For other `src` values, the extension treats the value as a URI-like path and:
  - Splits on `/` and URL-decodes each segment individually, falling back safely if decoding fails
  - Resolves the resulting normalized path relative to the markdown document directory
- If the resolved file does not exist, the webview still receives a best-effort URI and the image may appear broken, but no exceptions are thrown.
- Drag & drop / paste flows that already store clean relative paths remain unchanged; they should simply benefit from the more robust resolver.

---

## 5. Technical Plan

- **Surfaces:**
  - **Extension (Node.js side):** `src/editor/MarkdownEditorProvider.ts` image resolution and messaging
  - **Webview (browser side):** `src/webview/editor.ts` + `src/webview/extensions/customImage.ts` for path resolution requests
  - **Tests:** New test file under `src/__tests__/` (likely `editor/imagePathResolution.test.ts` or similar)

- **Key changes:**
  - `src/editor/MarkdownEditorProvider.ts`
    - Introduce a small helper to normalize/URL-decode workspace image paths (per-path-segment `decodeURIComponent` with try/catch).
    - Update `handleResolveImageUri` to apply normalization before `path.resolve`.
    - Add safeguards for `file://` URIs or absolute paths if they appear in `relativePath`.
  - `src/webview/extensions/customImage.ts`
    - Confirm that only workspace-relative, non-HTTP `src` values are sent to the resolver (current behavior) and adjust comments if needed.
  - `src/webview/editor.ts`
    - Keep the message shape for `resolveImageUri` but ensure type safety where we create `requestId` and pass `relativePath`.
  - `src/__tests__/editor/imagePathResolution.test.ts` (new)
    - Unit tests for normalization function and `handleResolveImageUri` behavior using fake documents and webview mocks.

- **Architecture notes:**
  - The TextDocument remains the source of truth; we are not rewriting markdown paths in this task, only how they are interpreted at render time.
  - Image resolution remains a request/response flow: webview → extension (`resolveImageUri`) → webview (`imageUriResolved`).
  - Normalization is intentionally extension-side so behavior is consistent regardless of how the markdown was produced (TipTap, another editor, or external tools).

- **Performance considerations:**
  - Path normalization is O(n) in the length of the path string and runs per `src` resolution; expected overhead is negligible compared to webview rendering.
  - We should avoid any filesystem stat checks inside the resolver to keep it fast; rely on VS Code's `asWebviewUri` and the existing localResourceRoots for access control.
  - No additional debounce is required; the existing update and messaging mechanisms suffice.

---

## 6. Work Breakdown

| Status | Task | Notes |
|--------|------|-------|
| `done` | Design and implement image path normalization helper on extension side | `MarkdownEditorProvider.ts` – `normalizeImagePath()` function |
| `done` | Integrate normalization into `handleResolveImageUri` and ensure behavior for relative/absolute paths and `file://` URIs | `MarkdownEditorProvider.ts` |
| `done` | Verify webview image resolution flow still behaves correctly for remote URLs and data URIs | Manual check via sample docs |
| `done` | **Write unit tests** for path normalization and resolution behavior | `src/__tests__/editor/imagePathResolution.test.ts` – 36 tests |
| `done` | Manual verification with real docs (GitHub README, `medium-blog-post.md`, workspace images with spaces) | `medium-blog-post.md` verified; mixed `%20` + new images stable |

### How to Verify

**Path normalization helper:**
1. Run unit tests for the helper.
2. Confirm that inputs like `"images/Hero%20Image.png"` and `"../assets/My%20Diagram%201.png"` normalize to paths with spaces.
3. Confirm that already-decoded paths (e.g. `"images/Hero Image.png"`) are unchanged.

**`handleResolveImageUri` integration:**
1. Open a markdown file with workspace images using `%20` in paths.
2. Start Speckit for Humans WYSIWYG editor.
3. Confirm that images resolve and display when the corresponding decoded files exist in the workspace.

**Remote/data URLs:**
1. Create a markdown file with `https://` image URLs and `data:` URIs.
2. Open in Speckit for Humans and verify that these images still load.

**Unit tests:**
1. Run `npm test`.
2. All tests pass, including new image-path resolution tests.
3. Tests cover positive, negative (file missing), and edge cases (invalid encodings).

**Manual doc verification:**
1. Open `medium-blog-post.md` and confirm all marketplace screenshot images render without modifying the markdown.
2. Create a new doc that mixes legacy `%20` paths and new drag & drop images; verify all render correctly.

---

## 7. Implementation Log

### 2025-12-01 – Implementation complete

- **What:** Implemented `normalizeImagePath()` helper and integrated into `handleResolveImageUri`. Added comprehensive unit tests.
- **Files changed:**
  - `src/editor/MarkdownEditorProvider.ts` – added `normalizeImagePath()` export, updated `handleResolveImageUri` to use it
  - `src/__tests__/editor/imagePathResolution.test.ts` – new test file with 36 tests
- **Test results:** All 203 tests pass (`npm test`), including 36 new image path tests
  - 2026-02-27: Regression suite still green (`npm test`) after adding handler integration tests
- **Implementation details:**
  - Per-segment URL decoding: splits path on `/`, decodes each segment with `decodeURIComponent`, rejoins
  - Preserves `.` and `..` segments unchanged
  - Graceful fallback for malformed `%` sequences (returns segment as-is)
  - Handles `file://` URIs by stripping scheme and decoding
  - Skips remote URLs (`http://`, `https://`, `data:`, `vscode-webview://`)
- **Decisions:**
  - Normalize paths on the extension side using per-segment URL decoding before filesystem resolution.
  - Do not modify markdown source paths as part of this task.
  - Return original (un-normalized) path in the response message for consistency with existing behavior.

### 2026-02-27 – Manual verification & shipping

- **What:** Confirmed remote/data URLs remain untouched and manual doc verification succeeds, including `medium-blog-post.md` with `%20` images and mixed new images.
- **Status:** All work breakdown items complete; task shipped.

### 2025-12-01 – Task refined

- **What:** Defined problem, desired outcomes, and technical plan for image path robustness. Added work breakdown and verification steps.
- **Files:** `roadmap/pipeline/task-p1-image-path-robustness.md`
- **Issues:** None – implementation pending.
- **Decisions:**
  - Normalize paths on the extension side using per-segment URL decoding before filesystem resolution.
  - Do not modify markdown source paths as part of this task.

---

## 8. Decisions & Tradeoffs

- **Decode at render time, not rewrite source:** Keeps user-authored markdown unchanged while making the viewer forgiving of URL encoding habits.
- **Per-segment decoding:** Decoding each path segment (between `/`) avoids accidentally changing directory separators and better matches how URLs are structured.
- **No filesystem existence checks:** We rely on VS Code's webview resource handling instead of adding our own `fs.stat` calls, keeping the resolver simple and fast.

---

## 9. Follow-up & Future Work

- Image rename/refactor tooling that updates markdown paths when assets are moved or renamed.
- Workspace-level configuration for preferred image folder layout and naming conventions.
- Better error feedback in the editor for truly missing images (e.g. hover tooltip explaining that the file was not found).
- Consistent path normalization for non-image assets (attachments, downloadable files) if/when those are supported.
- Export pipeline validation to ensure image paths used here also work for HTML/PDF export flows.
