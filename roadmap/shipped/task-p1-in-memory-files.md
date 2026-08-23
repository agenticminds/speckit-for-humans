# Task: In-Memory File Support

## 1. Task Metadata

- **Task name:** In-Memory File Support
- **Slug:** in-memory-files
- **Status:** shipped
- **Created:** 2025-01-15
- **Last updated:** 2025-01-15
- **Shipped:** 2025-01-15

---

## 2. Context & Problem

**Current state:**
- Extension only works with saved files in the repository
- Users must save files before opening with "Speckit for Humans"
- No support for quick workflows like creating blank editors, pasting markdown, and editing immediately

**Pain points:**
- **Workflow friction:** Users want to press CMD+N, paste markdown, and immediately use WYSIWYG editor
- **Quick notes:** Can't create temporary markdown documents without saving first
- **Content creation:** Writers often start with unsaved files to draft before committing to disk
- **Competitive gap:** Most modern editors support unsaved/untitled files seamlessly

**Why it matters:**
- **Natural workflow:** Users expect to create and edit files without saving first
- **Flexibility:** Enables quick note-taking, drafting, and experimentation
- **VS Code integration:** Untitled files are a core VS Code feature that should work with custom editors

---

## 3. Desired Outcome & Scope

**Success criteria:**
- User can create untitled markdown file (CMD+N) and open it with "Speckit for Humans"
- User can paste markdown content into untitled file and see it rendered
- Images work correctly when untitled file is in a workspace (resolve relative to workspace folder)
- Images work when untitled file has no workspace (use absolute paths, show warning dialog)
- Warning dialog appears when working without workspace, informing user where images will be saved
- Existing saved file functionality remains unchanged

**In scope:**
- Support `untitled:` scheme in custom editor registration
- Handle image path resolution for untitled files (workspace folder or home directory fallback)
- Show informational warning when working without workspace
- All image operations (save, resize, resolve) work with untitled files

**Out of scope:**
- Auto-save untitled files (user must manually save)
- Multiple workspace folder handling (uses first workspace folder)
- Custom image save locations for untitled files (uses workspace or home directory)

---

## 4. UX & Behavior

**Entry points:**
- **CMD+N:** Create new untitled file, set language to markdown
- **Command Palette:** "Open with Speckit for Humans" on untitled markdown file
- **Right-click:** Context menu on untitled markdown file

**User flows:**

### Flow 1: Create and edit untitled file in workspace
1. User presses CMD+N to create new file
2. User sets language to markdown (or file is auto-detected as markdown)
3. User pastes markdown content with images: `![alt](./images/photo.jpg)`
4. User runs "Open with Speckit for Humans" from command palette
5. Editor opens with content rendered, images resolve relative to workspace folder
6. User can edit, save images, resize images - all works normally

### Flow 2: Create untitled file without workspace
1. User opens VS Code without workspace folder
2. User presses CMD+N, sets language to markdown
3. User pastes markdown content
4. User runs "Open with Speckit for Humans"
5. Warning dialog appears: "You are working without a workspace. Images will be saved to: [home directory]"
6. Editor opens, images with absolute paths work, relative paths resolve to home directory

### Flow 3: Save untitled file
1. User edits untitled file in WYSIWYG editor
2. User presses CMD+S
3. VS Code shows save dialog
4. User saves file to workspace
5. Editor seamlessly transitions from `untitled:` to `file:` scheme
6. All functionality continues to work

**Behavior rules:**
- **Workspace detection:** For untitled files, use first workspace folder if available, otherwise use home directory
- **Image resolution:** Relative paths resolve against workspace folder (if available) or home directory
- **Warning dialog:** Only shown once per untitled file when no workspace exists
- **Image operations:** All image features work (save, resize, copy) using appropriate base path

### Current Functionality (Source of Truth)

- **Current behavior (user-facing):** Extension only supports `file:` scheme documents. Untitled files require save before opening with custom editor.
- **Current implementation (technical):** Custom editor selector in `package.json` only includes `scheme: "file"`. `MarkdownEditorProvider` uses `document.uri.fsPath` which doesn't exist for untitled files. Image handlers assume document directory exists.
- **Key files:** `package.json` (custom editor selector), `src/extension.ts` (openFile command), `src/editor/MarkdownEditorProvider.ts` (image path resolution)
- **Pattern to follow:** Similar to how workspace folder detection works for saved files, but extended to handle untitled files with fallback logic

---

## 5. Technical Plan

- **Surfaces:**
  - Extension side: `package.json`, `src/extension.ts`, `src/editor/MarkdownEditorProvider.ts`
  - Document export: `src/features/documentExport.ts`

- **Key changes:**
  - `package.json` – Add `untitled` scheme to custom editor selector for `*.md` and `*.markdown`
  - `src/extension.ts` – Remove save requirement for untitled files in `speckitForHumans.openFile` command
  - `src/editor/MarkdownEditorProvider.ts` – Add `getDocumentDirectory()` and `getImageBasePath()` helper methods. Update `localResourceRoots` to include workspace folder or home directory. Add warning dialog for untitled files without workspace. Update all image handlers to use helper methods.
  - `src/features/documentExport.ts` – Add `getDocumentBasePath()` helper and update image resolution

- **Architecture notes:**
  - For untitled files, `getWorkspaceFolder(document.uri)` may not work reliably, so we check `workspaceFolders[0]` first
  - Image base path logic: workspace folder → document directory → home directory (fallback chain)
  - Warning dialog is non-blocking and shows actual save location
  - All image operations (resolve, save, resize) use the same base path logic for consistency

- **Performance considerations:**
  - No performance impact - path resolution is synchronous and fast
  - Warning dialog only shown once per untitled file (not on every image operation)

---

## 6. Work Breakdown

| Status | Task | Notes |
|--------|------|-------|
| `done` | **Update feature-inventory.md** | Add task to "In Progress" section ⚠️ DO FIRST |
| `done` | Add untitled scheme to package.json | Update custom editor selector |
| `done` | Update openFile command | Remove save requirement for untitled files |
| `done` | Add helper methods | `getDocumentDirectory()` and `getImageBasePath()` |
| `done` | Update localResourceRoots | Handle untitled files in `resolveCustomTextEditor` |
| `done` | Add warning dialog | Show info when untitled file has no workspace |
| `done` | Update image handlers | All 8 image handling methods use helper methods |
| `done` | Update documentExport | Handle untitled files in export image resolution |
| `done` | **Write unit tests** | `inMemoryFiles.test.ts` ⚠️ REQUIRED |
| `done` | **Ship task & update inventory** | Move to shipped/, update feature-inventory.md ⚠️ DO LAST |

### How to Verify

**Add untitled scheme to package.json:**
1. Open `package.json`
2. Verify `customEditors[0].selector` includes entries with `"scheme": "untitled"`
3. Test: Create untitled file, right-click → "Open with Speckit for Humans" should appear

**Update openFile command:**
1. Create untitled markdown file (CMD+N, set language to markdown)
2. Paste some markdown content
3. Run "Open with Speckit for Humans" from command palette
4. Verify: Editor opens without requiring save first

**Image resolution in workspace:**
1. Create untitled file in workspace with markdown: `![test](./images/test.jpg)`
2. Open with Speckit for Humans
3. Verify: Image resolves correctly relative to workspace folder
4. Check browser console: Image URI should point to workspace folder, not home directory

**Image resolution without workspace:**
1. Open VS Code without workspace folder
2. Create untitled markdown file with image: `![test](./images/test.jpg)`
3. Open with Speckit for Humans
4. Verify: Warning dialog appears showing home directory path
5. Verify: Image resolves relative to home directory (or shows error if image doesn't exist there)

**Warning dialog:**
1. Open VS Code without workspace
2. Create untitled markdown file
3. Open with Speckit for Humans
4. Verify: Information message appears: "You are working without a workspace. Images will be saved to: [path]"
5. Verify: Dialog is non-blocking (doesn't prevent editor from opening)

**Unit tests:**
1. Run `npm test`
2. All tests pass including new `inMemoryFiles.test.ts`
3. Coverage includes: untitled files with workspace, without workspace, image resolution, warning dialog logic

---

## 7. Implementation Log

### 2025-01-15 – Initial Implementation

- **What:** Implemented full in-memory file support for untitled markdown files
- **Files:**
  - `package.json` (lines 42-51): Added `untitled` scheme to custom editor selector
  - `src/extension.ts` (lines 44-58): Removed save requirement, support both `file` and `untitled` schemes
  - `src/editor/MarkdownEditorProvider.ts`:
    - Lines 40-55: Added `getDocumentDirectory()` helper method
    - Lines 57-65: Added `getImageBasePath()` helper method
    - Lines 75-103: Updated `localResourceRoots` and added warning dialog
    - Lines 322-346: Updated `handleResolveImageUri` to use helper
    - Lines 348-373: Updated `handleWorkspaceImage` to use helper
    - Lines 375-400: Updated `handleSaveImage` to use helper
    - Lines 412-497: Updated `handleResizeImage` to use helper
    - Lines 509-545: Updated `handleUndoResize` to use helper
    - Lines 557-593: Updated `handleRedoResize` to use helper
    - Lines 605-649: Updated `handleCheckImageInWorkspace` to use helper
    - Lines 661-706: Updated `handleCopyLocalImageToWorkspace` to use helper
  - `src/features/documentExport.ts`:
    - Lines 28-40: Added `getDocumentBasePath()` helper
    - Lines 69, 419, 938: Updated to use helper for image resolution
- **Issues:**
  - Initial implementation had issue where `getWorkspaceFolder(document.uri)` doesn't work reliably for untitled files
  - Fixed by checking `workspaceFolders[0]` first for untitled files
  - Image paths were resolving to home directory instead of workspace folder - fixed by prioritizing workspace folder detection
- **Decisions:**
  - Use `workspaceFolders[0]` for untitled files instead of `getWorkspaceFolder()` because the latter may not work for untitled URIs
  - Warning dialog is informational (non-blocking) to avoid interrupting workflow
  - Home directory fallback enables absolute paths to work even without workspace
  - All image operations use same base path logic for consistency
- **Follow-up:**
  - Consider adding configuration option to customize image save location for untitled files
  - May want to support multiple workspace folders in future (currently uses first one)

---

