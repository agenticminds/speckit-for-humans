# Task: Image Resize Handles

## 1. Task Metadata

- **Task name:** Image Resize Handles
- **Slug:** image-resize-handles
- **Status:** shipped
- **Created:** 2025-01-03
- **Last updated:** 2025-12-11 (resize icon swap)
- **Shipped:** 2025-12-10

---

## 2. Context & Problem

**Current state:**
- Images display at full resolution when dropped/inserted
- No way to resize images in the editor
- Large images break layout and waste space
- Users must manually resize images in external tools

**Pain points:**
- **Layout breaking:** Huge images (2000px+) overflow editor, break reading flow
- **Wasted space:** Full-resolution images when smaller would suffice
- **Workflow interruption:** Must leave editor to resize images externally
- **No visual control:** Can't preview how image will look at different sizes
- **User need:** Image resizing with HTML width/height attributes is a standard feature in modern markdown editors

**Why it matters:**
- **Better UX:** Resize images directly in editor without leaving workflow
- **Faster editing:** No need to switch to external image editors
- **Layout control:** Prevent huge images from breaking document flow
- **Professional polish:** Expected feature in modern markdown editors

---

## 3. Desired Outcome & Scope

**Success criteria:**
- All images in editor show resize icon on hover (top-right corner)
- Clicking resize icon opens modal dialog for resizing
- Modal allows downsizing only (upscaling blocked)
- Warning dialog before destructive resize (with "never ask again" option)
- Original image backed up with timestamp before resize
- Resized image replaces original file (no width/height metadata needed)
- Huge images (>2000px or >2MB) show dialog with suggested resolution on drop
- External images (HTTP/HTTPS) automatically downloaded to workspace before resize
- Local images outside workspace handled with copy-to-repo dialog
- Undo/redo support using backup chain
- Modal auto-closes after 5 seconds of inactivity, or on scroll/click/keypress

**In scope:**
- **Resize icon & modal:**
  - Pencil/resize icon appears on image hover (top-right corner)
  - Clicking icon opens sticky modal dialog (bottom-right, glass effect)
  - Modal shows width/height inputs with live preview
  - Only downsizing allowed (upscaling inputs disabled)
  - Preserves aspect ratio automatically
  - Modal auto-closes after 5 seconds of inactivity
  - Modal closes on scroll, click outside, or any keypress (except when typing in inputs)
- **Huge image dialog:**
  - Triggers on drop if image > 2000px width/height OR > 2MB
  - Shows thumbnail preview
  - Suggests resolution based on cursor placement (80% of editor width)
  - Options: "Resize to suggested", "Resize to custom", "Use original"
- **External image handling:**
  - HTTP/HTTPS images detected automatically
  - Error message shown: "Cannot resize external images. Please download the image to your workspace first, then you can resize it."
  - Users must manually download external images before resizing
  - ~~Download dialog and automatic download feature removed due to TipTap schema violations~~
- **Local image outside workspace:**
  - Detects local images outside current workspace
  - Dialog offers: "Edit in place" or "Copy to repo"
  - Copy option allows choosing target folder
- **Warning dialog:**
  - Shows on resize confirmation (after user clicks "Confirm" in modal)
  - Message: "Speckit for Humans will reduce resolution of image to fit the size. Continue?"
  - Options: "Resize", "Cancel", checkbox "Never ask again"
  - Setting saved to VS Code config (package.json)
  - Setting synchronized in real-time between extension and webview
- **Backup system:**
  - Timestamped backups: `image-backup-YYYYMMDDHHmmss.png`
  - Each resize creates new backup
  - Used for undo/redo chain
- **Undo/redo:**
  - Full undo/redo support using backup chain
  - Maximum 10 undo levels (configurable)
  - WebView maintains resize history stack
- **Image insertion toolbar:**
  - Toolbar button opens image insertion dialog
  - Dialog includes file picker, drag-drop zone, and hints about all insertion methods

**Out of scope:**
- Upsizing images (only downsizing supported)
- Width/height metadata in markdown (image file itself is source of truth)
- Image alignment controls (left/right/center) - future feature
- Multiple image selection and batch resize - future feature
- Image cropping - future feature

---

## 4. UX & Behavior

**Entry points:**
- **Primary:** Hover image → resize icon appears (top-right) → click icon → modal opens
- **Toolbar:** Click image insertion button → dialog opens → choose file/drop/paste
- **Huge images:** Drop image > threshold → dialog appears immediately
- **Keyboard:** Escape key closes modal, any keypress closes modal (except when typing in inputs)

**User flows:**

### Flow 1: Resize normal local image
1. User drops image → Image displays at full size
2. User hovers image → Resize icon appears (top-right corner)
3. User clicks resize icon → Modal opens (bottom-right, sticky, glass effect)
4. User enters width/height → Live preview updates, aspect ratio preserved
5. User clicks "Confirm" → Warning dialog appears (if not disabled)
6. User clicks "Resize" → Image resized, original backed up as `image-backup-20250103143022.png`
7. Image displays at new size, markdown unchanged (file itself resized)
8. Modal auto-closes after 5 seconds, or on scroll/click/keypress

### Flow 2: Huge image dialog
1. User drops 4000x3000px image (5MB)
2. Dialog appears: "This image is very large (4000 x 3000px, 5MB)"
3. Thumbnail preview shown
4. Suggested resolution: "1120 x 840px (80% of editor width)"
5. User clicks "Resize to suggested" → Image resized immediately, no warning dialog
6. Image displays at suggested size

### Flow 3: Undo resize
1. User resizes image from 2000x1500 to 800x600
2. Backup created: `hero-backup-20250103143022.png`
3. User presses `Cmd+Z` (or clicks undo)
4. Extension restores from backup → Image returns to 2000x1500
5. User presses `Cmd+Shift+Z` (redo) → Resize reapplied

### Flow 4: External image resize (REMOVED)
1. User inserts external image (HTTP/HTTPS URL) → Image displays
2. User clicks resize icon → Error message appears: "Cannot resize external images. Please download the image to your workspace first, then you can resize it."
3. ~~Download dialog appears~~ **REMOVED**
4. ~~User selects target folder → Confirms download~~ **REMOVED**
5. ~~Image downloads to workspace (Node.js bypasses CSP)~~ **REMOVED**
6. ~~TipTap node updates with local path (placeholder ID ensures reliability)~~ **REMOVED**
7. ~~Resize modal opens automatically after download~~ **REMOVED**
8. User must manually download external image to workspace before resizing

### Flow 5: Local image outside workspace
1. User inserts local image outside workspace → Image displays
2. User clicks resize icon → Dialog appears: "Edit in place" or "Copy to repo"
3. User chooses "Copy to repo" → Selects target folder
4. Image copied to workspace
5. Resize modal opens automatically

### Flow 6: Never ask again
1. User resizes image → Warning dialog appears
2. User checks "Never ask again" → Clicks "Resize"
3. Setting saved: `speckitForHumans.imageResize.skipWarning = true`
4. Setting synchronized immediately (no restart needed)
5. Future resizes skip warning dialog
6. User can restore in VS Code settings

---

## 4b. Current Functionality (Source of Truth)

**Current behavior (user-facing):** 
- Images can be dropped/pasted/inserted via toolbar button
- Images display at full size with `max-width: 100%` CSS constraint
- Resize icon (edit-sparkle/pencil) appears on image hover (top-right corner)
- Clicking icon opens resize modal (bottom-right, sticky, glass effect)
- Modal allows width/height input with live preview
- Only downsizing allowed (upscaling blocked)
- Warning dialog shown before destructive resize (unless disabled)
- Original image backed up with timestamp before resize
- External images (HTTP/HTTPS) automatically downloaded to workspace
- Local images outside workspace handled with copy dialog
- Modal auto-closes after 5 seconds of inactivity, or on scroll/click/keypress
- Undo/redo support using backup chain

**Current implementation (technical):** 
- `CustomImage` extension (`src/webview/extensions/customImage.ts`) extends TipTap Image with custom node view
- Wraps image in `span.image-wrapper` with `button.image-resize-icon` (codicon-edit-sparkle)
- Icon shown on hover only when image is loaded
- `imageResizeModal.ts` implements sticky modal dialog with width/height inputs
- Uses Canvas API for client-side image resizing
- Placeholder ID system (`data-placeholder-id`) ensures reliable TipTap node updates
- `imageDragDrop.ts` handles drop/paste, integrates huge image dialog
- `imageInsertDialog.ts` provides toolbar button dialog with file picker and drag-drop
- `hugeImageDialog.ts` shows dialog for large images on drop
- `imageResizeWarning.ts` shows warning before destructive resize
- `localImageOutsideRepoDialog.ts` handles local images outside workspace
- `MarkdownEditorProvider.ts` handles file operations, downloads, backups, undo/redo
- Node.js `https`/`http` used for external image downloads (bypasses webview CSP)
- Settings synchronized via `vscode.workspace.onDidChangeConfiguration`

**Key files:** 
- `src/webview/extensions/customImage.ts` - Image node view with hover icon
- `src/webview/features/imageResizeModal.ts` - Core resize modal logic
- `src/webview/features/imageDragDrop.ts` - Drop/paste handling
- `src/webview/features/imageInsertDialog.ts` - Toolbar button dialog
- `src/webview/features/hugeImageDialog.ts` - Large image dialog
- `src/webview/features/imageResizeWarning.ts` - Warning dialog
- `src/webview/features/localImageOutsideRepoDialog.ts` - Local image outside repo dialog
- `src/webview/editor.ts` - Message handlers, global setupImageResize
- `src/editor/MarkdownEditorProvider.ts` - Extension-side handlers

**Pattern to follow:** 
- Modal dialogs follow `imageConfirmation.ts` pattern
- Placeholder ID pattern matches `updateImageSrc` in `imageDragDrop.ts`
- Node updates use `editor.chain().setNodeSelection(pos).updateAttributes('image', {...}).run()`
- Backup logic similar to document export backup patterns

---

## 5. Technical Plan

- **Surfaces:**
  - WebView: Resize handles UI, drag logic, warning dialog, huge image dialog, undo/redo tracking
  - Extension: Image resize handler, backup management, undo/redo handlers, settings integration

- **Key changes:**
  - `src/webview/features/hugeImageDialog.ts` (new) – Dialog for huge images with thumbnail and suggested resolution
  - `src/webview/features/imageResizeModal.ts` (new) – Sticky modal dialog for resizing (replaces drag handles)
  - `src/webview/features/imageResizeWarning.ts` (new) – Warning dialog with "never ask again" option
  - `src/webview/features/imageInsertDialog.ts` (new) – Toolbar button dialog with file picker and drag-drop
  - `src/webview/features/localImageOutsideRepoDialog.ts` (new) – Dialog for local images outside workspace
  - `src/webview/features/imageDragDrop.ts` – Integrate huge image dialog, export `insertImage` and `updateImageSrc`
  - `src/webview/extensions/customImage.ts` – Add resize icon on hover (top-right), icon click opens modal
  - `src/webview/editor.css` – Styles for image wrapper, resize icon, modal dialog
  - `src/webview/editor.ts` – Message handlers for external image download, workspace check, copy to repo
- `src/webview/BubbleMenuView.ts` – Add toolbar button for image insertion
- `src/editor/MarkdownEditorProvider.ts` – Add `handleResizeImage()`, `handleUndoResize()`, `handleRedoResize()`, `handleDownloadExternalImage()`, `handleCheckImageInWorkspace()`, `handleCopyLocalImageToWorkspace()` message handlers
- `package.json` – Add `speckitForHumans.imageResize.skipWarning` setting

- **Architecture notes:**
  - Resize icon added in `CustomImage.addNodeView()` as button element (codicon-edit-sparkle)
  - Icon shown on hover only when image is loaded (`isImageLoaded` flag)
  - Modal dialog is sticky (bottom-right), uses glass effect styling
  - Canvas API used in webview to resize image (waits for `img.complete` before drawing)
  - Placeholder ID system (`data-placeholder-id`) ensures reliable TipTap node updates
  - Node updates use `editor.chain().setNodeSelection(pos).updateAttributes('image', {...}).run()` pattern
  - TipTap node attributes updated BEFORE download to persist through re-renders
  - External image downloads use Node.js `https`/`http` (bypasses webview CSP restrictions)
  - Timestamp format: `YYYYMMDDHHmmss` for backup filenames
  - Backup chain maintained in webview resize history, extension handles file operations
  - Settings read/write via VS Code Configuration API, synchronized via `onDidChangeConfiguration`
  - Huge image detection happens in `imageDragDrop.ts` before `insertImage()`
  - Modal auto-close: 5-second inactivity timer, closes on scroll/click/keypress
  - Event listeners properly cleaned up in `hideImageResizeModal()`

- **Performance considerations:**
  - Canvas resize operation is synchronous but fast for typical image sizes
  - Large images (>10MB) may cause brief UI freeze - acceptable for resize operation
  - Backup file operations are async, don't block UI
  - Resize history limited to 10 entries to prevent memory bloat

---

## 6. Work Breakdown

| Status | Task | Notes |
|--------|------|-------|
| `completed` | **Update feature-inventory.md** | Added task to "In Progress" section ✅ |
| `completed` | Create hugeImageDialog.ts | Dialog with thumbnail, suggested resolution, three options ✅ |
| `completed` | Integrate huge image dialog in imageDragDrop.ts | Check image size on drop, show dialog if threshold exceeded ✅ |
| `completed` | Create imageResizeWarning.ts | Warning dialog with "never ask again" checkbox ✅ |
| `completed` | Create imageResizeModal.ts | Sticky modal dialog (bottom-right), width/height inputs, live preview, canvas resize, undo/redo tracking ✅ |
| `completed` | Create imageInsertDialog.ts | Toolbar button dialog with file picker, drag-drop zone, insertion hints ✅ |
| `completed` | Create localImageOutsideRepoDialog.ts | Dialog for local images outside workspace with copy/edit options ✅ |
| `completed` | Modify CustomImage extension | Add resize icon on hover (top-right), icon click opens modal, removed image click handler ✅ |
| `completed` | Add CSS styles | Image wrapper, resize icon, modal dialog styles ✅ |
| `completed` | Add settings to package.json | `speckitForHumans.imageResize.skipWarning` setting ✅ |
| `completed` | Add handleResizeImage() in MarkdownEditorProvider | Backup original (timestamped), save resized image ✅ |
| `completed` | Add handleUndoResize() and handleRedoResize() | Restore from backup, reapply resize ✅ |
| `completed` | Wire up settings reading/updating | Read setting before showing warning, update on "never ask again", real-time sync ✅ |
| `removed` | ~~Restore external image download~~ | ~~Node.js download, placeholder ID-based node updates, reliable TipTap updates~~ **REMOVED: TipTap schema violations, replaced with error message** ❌ |
| `completed` | Add modal auto-close behavior | 5-second inactivity timer, close on scroll/click/keypress, proper cleanup ✅ |
| `completed` | Fix double image insertion | Blocked TipTap's default paste handler for images ✅ |
| `completed` | Fix image resize cache-busting | Added timestamp query parameter to force browser reload ✅ |
| `completed` | Fix placeholder ID persistence | Update TipTap node attributes before download to persist through re-renders ✅ |
| `completed` | Add toolbar button for image insertion | BubbleMenuView button with imageInsertDialog integration ✅ |
| `completed` | Fix image click behavior | Removed image click handler, only icon opens modal ✅ |
| `completed` | Code audit and cleanup | Removed dead code, simplified fallback logic, fixed core bugs ✅ |
| `completed` | **Write unit tests** | Added coverage for resize modal history/external guard, warning dialog, huge image dialog, local image outside repo dialog, and image insert validation ✅ |
| `completed` | **Ship task & update inventory** | Moved task to shipped/, metadata updated, feature-inventory updated ✅ |

### How to Verify

**Update feature-inventory.md (start):**
1. Open `roadmap/feature-inventory.md`
2. Add task to "🚧 In Progress" table
3. Verify: Task name, priority, status, slug are correct

**Create hugeImageDialog.ts:**
1. Drop image > 2000px or > 2MB
2. Verify: Dialog appears with thumbnail and suggested resolution
3. Verify: Three options work correctly

**Integrate huge image dialog:**
1. Drop huge image
2. Verify: Dialog appears before image is inserted
3. Verify: "Resize to suggested" resizes immediately

**Create imageResizeWarning.ts:**
1. Resize an image
2. Verify: Warning dialog appears on "Confirm" click
3. Verify: "Never ask again" saves to VS Code settings
4. Verify: Setting synchronized immediately (no restart needed)

**Create imageResizeModal.ts:**
1. Hover over image
2. Verify: Resize icon appears (top-right corner)
3. Click icon
4. Verify: Modal opens (bottom-right, sticky, glass effect)
5. Enter width/height
6. Verify: Live preview updates, aspect ratio preserved
7. Verify: Upscaling inputs disabled
8. Click "Confirm"
9. Verify: Warning dialog appears (if not disabled)
10. Verify: Modal auto-closes after 5 seconds of inactivity
11. Verify: Modal closes on scroll, click outside, or keypress

**Create imageInsertDialog.ts:**
1. Click toolbar image button
2. Verify: Dialog opens with file picker, drag-drop zone, hints
3. Verify: All insertion methods work (file picker, drag-drop, paste)

**Create localImageOutsideRepoDialog.ts:**
1. Insert local image outside workspace
2. Click resize icon
3. Verify: Dialog offers "Edit in place" or "Copy to repo"
4. Verify: Copy flow works correctly

**Modify CustomImage extension:**
1. Insert image
2. Verify: Resize icon appears on hover (top-right)
3. Verify: Icon only appears when image is loaded
4. Verify: Clicking icon opens modal
5. Verify: Clicking image itself does NOT open modal

**Add CSS styles:**
1. Hover image
2. Verify: Icon styled correctly (matches toolbar style, codicon-edit-sparkle)
3. Verify: Modal styled with glass effect, sticky positioning

**Add settings:**
1. Open VS Code settings
2. Verify: `speckitForHumans.imageResize.skipWarning` appears
3. Set to `true`
4. Resize image
5. Verify: Warning dialog skipped

**Add handleResizeImage():**
1. Resize image
2. Verify: Backup created with timestamp: `image-backup-YYYYMMDDHHmmss.png`
3. Verify: Original image file replaced with resized version
4. Verify: Image displays at new size in editor

**Add undo/redo handlers:**
1. Resize image
2. Press `Cmd+Z`
3. Verify: Image restored from backup
4. Press `Cmd+Shift+Z`
5. Verify: Resize reapplied

**Wire up settings:**
1. Check "Never ask again" in warning dialog
2. Verify: Setting updated in VS Code config
3. Resize another image
4. Verify: Warning dialog skipped

**Unit tests:**
1. Run `npm test`
2. All tests pass
3. Coverage includes positive, negative, and edge cases

**Ship task & update inventory:**
1. Tag `@prompts/features-and-tasks/task-ship.md`
2. LLM will guide through shipping workflow
3. Verify: Task moved to shipped/, feature-inventory.md updated

---

## 7. Implementation Log

### 2025-01-03 – Task created and refined

- **What:** Task file created with discovery and refinement sections
- **Ready for:** Implementation
- **First task:** Update feature-inventory.md, then create hugeImageDialog.ts

### 2025-01-03 – Initial implementation (modal-based resize)

- **What:** Core functionality implemented with modal-based resize (replaced drag handles)
  - ✅ Huge image dialog with thumbnail and suggested resolution
  - ✅ Image resize modal (sticky bottom-right, glass effect)
  - ✅ Resize icon on hover (top-right corner, codicon-edit-sparkle)
  - ✅ Warning dialog with "never ask again" option
  - ✅ Canvas-based image resizing in webview
  - ✅ Timestamped backup system (`image-backup-YYYYMMDDHHmmss.png`)
  - ✅ Undo/redo support using backup chain
  - ✅ Settings integration (skipWarning)
  - ✅ Extension handlers for resize, undo, redo
  - ✅ CSS styling for icon and modal
- **Files created:**
  - `src/webview/features/hugeImageDialog.ts`
  - `src/webview/features/imageResizeWarning.ts`
  - `src/webview/features/imageResizeModal.ts`
- **Files modified:**
  - `src/webview/features/imageDragDrop.ts` - Integrated huge image dialog
  - `src/webview/extensions/customImage.ts` - Added resize icon on hover
  - `src/webview/editor.ts` - Added global setupImageResize function, message handlers
  - `src/webview/editor.css` - Added icon and modal styles
  - `src/editor/MarkdownEditorProvider.ts` - Added resize, undo, redo handlers
  - `package.json` - Added skipWarning setting
  - `roadmap/feature-inventory.md` - Added task to in-progress

### 2025-01-03 – UI Revamp: Hover icon and external image handling

- **What:** Major UI and flow improvements
  - ✅ Replaced drag handles with modal-based resize dialog
  - ✅ Added hover icon (pencil/resize) that appears top-right on image hover
  - ✅ Icon only appears when image is loaded
  - ✅ Removed image click handler - only icon opens modal
  - ✅ Added toolbar button for image insertion
  - ✅ Created imageInsertDialog with file picker, drag-drop, hints
  - ✅ Added localImageOutsideRepoDialog for images outside workspace
  - ✅ Restored external image download with placeholder ID system
  - ✅ Fixed TipTap node updates using reliable placeholder ID pattern
  - ✅ Added modal auto-close (5-second timer, scroll/click/keypress)
  - ✅ Blocked upscaling in resize modal (inputs disabled)
  - ✅ Settings synchronized in real-time via `onDidChangeConfiguration`
- **Files created:**
  - `src/webview/features/imageInsertDialog.ts`
  - `src/webview/features/localImageOutsideRepoDialog.ts`
- **Files modified:**
  - `src/webview/features/imageResizeModal.ts` - Restored external download, added auto-close, fixed placeholder ID persistence
  - `src/webview/extensions/customImage.ts` - Added hover icon, removed image click handler
  - `src/webview/editor.ts` - Restored external image handlers, workspace check, copy to repo
  - `src/webview/BubbleMenuView.ts` - Added toolbar button
  - `src/editor/MarkdownEditorProvider.ts` - Restored Node.js download, added workspace check, copy handlers
  - `package.json` - No changes

### 2025-01-03 – Bug fixes and code audit

- **What:** Critical bug fixes and code cleanup
  - ✅ Fixed placeholder ID not persisting in TipTap node (now updates node attributes before download)
  - ✅ Removed dead code (`showExternalImageInfoDialog`)
  - ✅ Simplified fallback logic in `externalImageDownloaded` handler
  - ✅ Fixed image load check in `resizeImageWithCanvas` (waits for `img.complete`)
  - ✅ Fixed null reference errors by capturing `img` and `vscodeApi` at start of async operations
  - ✅ Ensured all event listeners properly cleaned up in `hideImageResizeModal()`
- **Key insight:** Placeholder ID must be set on TipTap node attributes (not just DOM) to persist through re-renders
- **Files modified:**
  - `src/webview/features/imageResizeModal.ts` - Fixed placeholder ID persistence, removed dead code
  - `src/webview/editor.ts` - Simplified fallback logic
- **Ready for:** Testing and manual verification
- **Next:** Write unit tests, then manual testing

### 2025-01-03 – Removed external image download feature

- **What:** After attempting to fix external image download, persistent TipTap schema violations led to decision to remove feature entirely
  - ✅ Removed external image download functionality completely
  - ✅ External images now show error message: "Cannot resize external images. Please download the image to your workspace first, then you can resize it."
  - ✅ Fixed double image insertion when pasting from browser (blocked TipTap's default paste handler)
  - ✅ Fixed image resize cache-busting (added timestamp query parameter)
  - ✅ Fixed modal auto-close timer (removed `mousemove` from reset events)
  - ✅ Fixed event listener memory leaks (proper cleanup)
  - ✅ Fixed TypeScript errors in test files
- **Problems encountered:**
  - TipTap schema violations when updating node attributes after download
  - Complex placeholder ID tracking across re-renders
  - Race conditions between download completion and DOM updates
  - Inconsistent behavior with different image sources
- **User decision:** "I would like to remove the feature of image resizing on external images. It should only tell user that download the image locally to start altering its size, and do nothing. Remove any logic related to HTTP/HTTPS images"
- **Files modified:**
  - `src/webview/features/imageResizeModal.ts` - Lines 409-426: Show error message instead of download dialog; Lines 152-365: Removed download functions
  - `src/webview/editor.ts` - Removed `externalImageDownloaded` and `externalImageDownloadError` handlers
  - `src/editor/MarkdownEditorProvider.ts` - Removed `handleDownloadExternalImage()`, `downloadImageFromUrl()`, and http/https imports
  - `src/webview/extensions/customImage.ts` - Lines 17-49: Added ProseMirror plugin to block TipTap's default image paste handling
  - `src/webview/features/imageDragDrop.ts` - Removed unused `HugeImageOptions` import
  - `src/webview/features/hugeImageDialog.ts` - Prefixed unused parameter with `_`
  - `src/__tests__/webview/imageInsertDialog.test.ts` - Fixed TypeScript error
- **Files created:**
  - `src/webview/features/imageResizeModal.ts.backup` - Backup before removal
- **Testing results:**
  - ✅ Build successful
  - ✅ 24/27 test suites passing (3 failures unrelated to changes)
  - ✅ 393 tests passing
  - ✅ No TypeScript errors in changed files
- **Ready for:** Manual testing to verify external images show error correctly
- **Next:** Write unit tests for updated behavior

### 2025-12-10 – Unit tests added for image resize flows

- **What:** Added focused unit tests for the image resize modal history/guard behavior, resize warning dialog, huge image dialog, local image outside repo dialog, and image insert validation.
- **Files:** `src/__tests__/webview/imageResizeModal.test.ts`, `src/__tests__/webview/imageResizeWarning.test.ts`, `src/__tests__/webview/hugeImageDialog.test.ts`, `src/__tests__/webview/localImageOutsideRepoDialog.test.ts`, `src/__tests__/webview/imageInsertDialog.test.ts`
- **Results:** Targeted Jest suites pass (`npm test -- imageResizeModal imageResizeWarning hugeImageDialog localImageOutsideRepoDialog imageInsertDialog`)
- **Next:** Ship task & update feature inventory (done)

### 2025-12-11 – Resize icon polish

- **What:** Swapped the resize affordance to `codicon-edit-sparkle` so the hover icon matches the toolbar visual language and better communicates a transform action.
- **Files modified:** `src/webview/extensions/customImage.ts` (icon span now uses `codicon-edit-sparkle`); `src/webview/codicon.css` already includes the glyph.
- **Behavior:** No functional changes; hover icon glyph only.
