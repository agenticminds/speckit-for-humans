---
name: Safe In-Place Resize (Backups + Reference Warnings + Collision UX)
overview: Resize images in-place (stable file path) while always creating a readable, deduplicated backup under `.md4h/image-backups/`. Add reference-awareness UI for resize (and rename) so users understand blast radius, and add explicit overwrite/collision confirmation for manual rename (and optional resize copy mode).
todos:
  - id: audit-current-flows
    content: Audit current save/rename/resize flows, reference scanning, and filename helpers to map current behavior + risks
    status: completed
  - id: define-image-storage-mode-config
    content: Add config to choose image folder base (per-document vs workspace folder) and update path computations accordingly
    status: completed
  - id: make-save-image-collision-safe
    content: Make `saveImage` collision-safe (never overwrite silently; auto-suffix `-2/-3/...` or prompt) and add tests
    status: completed
  - id: remove-include-dimensions-config
    content: Remove `speckitForHumans.imageFilename.includeDimensions` and migrate all naming/resize logic to the new “clean primary filename” rules
    status: completed
  - id: define-backup-path-and-gitignore
    content: Define `.md4h/image-backups/` location and add it to `.gitignore` (and document behavior)
    status: completed
  - id: implement-backup-naming-dedup
    content: Implement backup path+name builder using `<backupRoot>/<relativeDir>/<cleanStem>/<timestamp>/original_<cleanStem>_<oldWxH>px.<ext>` and de-duplication of prior backup prefixes/dim suffixes
    status: completed
  - id: switch-resize-to-in-place
    content: Update `handleResizeImage` to always overwrite the original image file and only write backups (no rename of the primary image)
    status: completed
  - id: add-resize-reference-preview
    content: Add an extension message to compute reference counts/list for an image (including multiple refs in same file) for the resize modal
    status: completed
  - id: add-resize-ui-reference-warnings
    content: Update resize modal UI to show “Referenced in X files” when referenced beyond current file, plus “Also used Y times in this file”
    status: completed
  - id: add-rename-collision-confirm
    content: Update rename UX to preflight collisions and require explicit overwrite confirmation; show references list before applying
    status: completed
  - id: shared-dialog-components
    content: Extract shared UI components (filename preview, collision banner, references list) reusable across rename and resize
    status: pending
  - id: tests
    content: Add unit tests for backup naming de-dup + reference counting; add integration tests for in-place resize behavior (no path change)
    status: completed
  - id: manual-testing
    content: Manual test on a long doc: resize a multiply-referenced image, verify references warning, backup creation, undo/redo, and no broken links
    status: pending
---

# Safe In-Place Resize (Backups + Reference Warnings + Collision UX)

## Problem

### 1) Resize has an “invisible blast radius”

Images are often referenced from multiple markdown files (and multiple times within the same file). A resize can affect more places than the user expects.

### 2) Filename-based resize creates collisions + broken references

When resize renames the primary file (e.g. to encode dimensions), it can:
- collide with an existing filename
- require updating references across the workspace (or risk breaking them)

### 3) Backups need to be reliable and readable

We want a “never lose pixels” guarantee. Backups should be:
- always created
- stored away from user-facing image folders
- named predictably (avoid scary repeated prefixes/suffixes)

## Decisions (Confirmed)

1) **Default resize behavior:** resize the original file in-place **after** creating a backup.
2) **Backup location:** store backups under `.md4h/image-backups/` (intended to be gitignored). `.md4h/` is the container for future MD4H internal artifacts.
3) **Backup naming:** hard-coded and readable: `original_<originalFileName>_<resolution>.<ext>`, with logic to avoid repeated prefixing/appending when a file is resized multiple times.
4) **Reference UI:** show references when the image is referenced in files beyond the current document; also detect multiple references within the current file and warn that resize impacts those too.
5) **Primary image naming (drop/paste):** keep filenames clean (no resolution). Only add a `dropped_`/`pasted_` source prefix when the original name is missing/generic.
6) **External absolute-path images:** do not create backups alongside external files; always write backups under the workspace `.md4h/image-backups/` folder (avoid touching files outside the workspace beyond the explicit in-place resize write).
7) **Untitled docs / Save As:** when a markdown document has no stable directory (untitled), save images under the workspace-level image folder (so links don’t depend on a future save location).
8) **Resize metadata fidelity:** resizing may drop image metadata (EXIF/ICC/orientation). The “safety net” is the automatic backup, and the UI should clearly communicate where the backup is stored.

## Related Image Improvements (Landed Alongside This Plan)

These are image-related UX fixes we implemented in the same timeframe, but they are not strictly part of the “safe in-place resize” design:

- **Indented images round-trip:** preserve leading indentation before `![...](...)` so intentionally aligned images keep their indentation on save.
- **Images with spaces in paths:** render `![alt](./path with spaces.png)` even though it’s technically invalid markdown, and serialize back as `![alt](<./path with spaces.png>)` so saved markdown is standards-friendly (no renames required).
- **Image menu UX:** allow “Reveal in OS” / “Show in Workspace” actions for local images (helps verify backups and locate originals quickly).

## Configuration Audit (Current → New Plan)

### `speckitForHumans.imagePath`

- **Current:** controls where dropped/pasted images are saved (relative to the document base path).
- **New plan:** keep `imagePath` as the folder path, but interpret it relative to a new base mode:
  - `relativeToDocument` (current behavior): images saved under `<docDir>/<imagePath>/…`
  - `workspaceFolder` (new): images saved under `<workspaceFolder>/<imagePath>/…`
- **Backup note:** backups still go under `.md4h/image-backups/` and should be anchored to the workspace folder when available (so `.md4h/` is not created in every nested doc folder).
- **Untitled behavior (decision):** if the document is untitled, default to workspace-level saves (equivalent to `imagePathBase=workspaceFolder`) because we don’t know where the markdown file will end up.

### (New) `speckitForHumans.imagePathBase`

- **Purpose:** choose where `imagePath` is rooted.
- **Proposed values:**
  - `relativeToDocument` (default; backward compatible)
  - `workspaceFolder` (shared assets folder per workspace folder)
- **Markdown insertion rule:** always compute the markdown link as a relative path from the current markdown file directory to the saved image file (so `../assets/foo.png` works correctly).

### `speckitForHumans.imageResize.skipWarning`

- **Current:** skips a second “warning dialog” before a resize is applied.
- **New plan:** the resize is safer (always backed up), but still has a blast radius when the image is referenced elsewhere.
- **Recommendation:** keep the setting for “skip extra confirmation” but still show reference impact information when the image is referenced beyond the current file.

### Remove: `speckitForHumans.imageFilename.includeDimensions`

- **Current:** controls whether automatic image filenames include source prefix and dimensions in some code paths.
- **New plan:** primary filenames should never contain resolution, and resize must not rename the primary file. This makes `includeDimensions` a poor fit and it should be removed.
- **Replacement behavior (no config):**
  - Drop/paste: keep clean filenames; add `dropped_`/`pasted_` only when original name is missing/generic.
  - Resize: in-place overwrite + backup (no primary rename).
- **Migration steps (implementation):**
  - Remove the setting from `package.json` contribution points.
  - Stop sending/reading `includeDimensions` into the webview (`window.includeDimensions`).
  - Update webview filename generation to no longer depend on `includeDimensions`.
  - Update extension-host resize logic to stop using `updateFilenameDimensions(...includeDimensions)`.
  - Update unit tests that assert the old naming patterns.
- **Risk:** clean naming increases collision likelihood; save operations must be collision-safe (auto-suffix / prompt) so naming preferences never become a data-loss vector.

## Desired UX

### Resize (Default: Edit Original)

- User opens Resize modal
- Modal shows impact summary:
  - If referenced elsewhere: **“Referenced in X other files”** where **X is a clickable pill/link** that opens a persisted popover anchored inside the modal (easy to click multiple files)
    - Popover contents: list of referencing files (+ line numbers), each row has actions: `Open`, `Open to the side`
    - Popover UX: stays open while resizing, closes via `Esc` or click-outside, and is keyboard-navigable
    - Perf: reference scan computed once on modal open (or on first expand), not on every slider change
  - If referenced multiple times in current doc: **“Also used Y times in this file”**
- Modal shows a subtle safety note (small text): **“A backup of the original will be saved to `.md4h/image-backups/`”** (visible even when `skipWarning` is enabled)
- On confirm:
  - Create backup in `.md4h/image-backups/…`
  - Overwrite the original image bytes (path unchanged)
  - Allow undo (restore from backup)

### Rename (Manual Rename Only)

- Before applying rename:
  - Preflight collision (target exists?) and require explicit overwrite confirmation if applicable
  - Show “Referenced in X files” and allow opening those files for review

## Backup System Design

### Backup root

Backup files live under:

`<basePath>/.md4h/image-backups/`

Where `basePath` follows existing image path resolution rules (workspace/doc directory or home for untitled).

### Multi-root workspace behavior (planned)

- When the document is in a workspace folder, treat that workspace folder as the “base” for:
  - `imagePathBase=workspaceFolder` saves
  - `.md4h/image-backups/` (avoid scattering `.md4h/` into nested doc directories)
- In multi-root workspaces, use the workspace folder that contains the current markdown file.

### External absolute-path images (decision)

- If the image is referenced by an absolute path outside the workspace, do **not** create backups next to that file (avoid writing into sensitive locations / cloud-synced folders).
- Instead, write backups under the workspace `.md4h/image-backups/` folder.

### Backup path structure

Maintain a stable mapping so backups are easy to find:

- Mirror the original relative directory when possible:
  - Original: `<basePath>/images/cat.png`
  - Backup: `<basePath>/.md4h/image-backups/images/<backupFileName>.png`

### Backup filename format (proposal)

`original_<cleanStem>_<oldWidth>x<oldHeight>px.<ext>`

Notes:
- Backups must be unique. Prefer uniqueness via **directory structure** (timestamp folder) rather than stuffing timestamps into filenames.
- `cleanStem` must be de-duplicated:
  - strip any existing `backup_`/`original_` prefixes
  - strip any trailing `_123x456px` or `_<13digits>_123x456px` patterns

### De-dup algorithm (high-level)

`cleanStem = stripBackupPrefixes(stripDimensionSuffixes(stripTimestampDimensionSuffixes(stem)))`

Then, write backups under a unique per-operation directory:

`<backupRoot>/<relativeDir>/<cleanStem>/<timestamp>/original_<cleanStem>_<oldWxH>px.<ext>`

This keeps backup filenames readable while guaranteeing uniqueness across multiple resizes.

## Primary Filename Rules (Drop/Paste)

Goal: keep filenames user-friendly and stable.

1) Start from the best available original filename (sanitized), **without** resolution in the primary filename.
2) Only add a source prefix (`dropped_`/`pasted_`) when the original filename is missing or generic (e.g. clipboard images commonly show up as `image.png`).
3) Collisions must be handled safely (auto-suffix or explicit overwrite prompt); clean naming should never cause silent overwrites.

### Generic names (treat as “name missing”)

These should be treated as generic (high collision risk) and therefore trigger source+timestamp naming:

- `image.png`
- `clipboard-image.png`
- `screenshot.png`

### Timestamp format (pasted images)

Use a timestamp **up to seconds** to keep names short and reduce collision risk:

- `pasted_YYYYMMDD-HHmmss.ext`

Note: collisions can still occur within the same second (batch pastes). The extension host must still enforce uniqueness (e.g. `-2`, `-3`, …) at write time.

## UX / Data Fidelity Risks (Callouts)

- **Never overwrite silently:** `saveImage`, `rename`, and resize-backup writes must be collision-safe; silent overwrites are the biggest “trust breaker”.
- **Metadata loss on resize (accepted):** canvas-based resizing may strip EXIF (orientation), ICC profiles, and other metadata. We rely on the pre-resize backup as the recovery path and should disclose this in the resize UI (alongside the backup-location note).
- **External images (absolute paths):** backups stay in workspace `.md4h/` even when the image file is outside the workspace (avoid touching external folders beyond the explicit resize write).

## Reference Awareness Design

### Data requirements

For a given image path:
- `otherFiles`: list of files (and line numbers) that reference it, excluding current doc
- `currentFileCount`: number of occurrences in the current doc

### Performance guardrails

- Compute references once when opening the modal (or on explicit “Show references” expand).
- Avoid recomputing on every slider change.
- Keep the existing 1000 markdown file cap initially; revisit with a faster search strategy if needed.

## Implementation Notes (Target Files)

- Extension host:
  - `src/editor/MarkdownEditorProvider.ts` (resize/rename handlers + reference scanning)
- Webview:
  - `src/webview/features/imageResizeModal.ts` (UI)
  - `src/webview/features/imageRenameDialog.ts` (UI; may be replaced/refactored)
  - Shared UI helpers (new module under `src/webview/features/` if needed)

## Testing Plan (TDD)

### Unit tests

- Backup name de-duplication (repeated resizes do not stack prefixes/suffixes)
- Reference counting:
  - counts references in other files correctly
  - counts multiple occurrences in the same file

### Integration tests

- In-place resize:
  - original image path remains unchanged after resize
  - backup file created under `.md4h/image-backups/…`
  - undo restores original bytes

## Manual Testing Checklist

1) Create a workspace with:
   - `doc-a.md` and `doc-b.md` referencing the same image (and reference it twice in `doc-a.md`)
   - one image file with spaces in name (e.g. `image in vs-code.png`)
   - one intentionally indented image line (leading spaces/tabs)
2) Resize (in-place):
   - open image menu → Resize
   - confirm “backup will be saved to `.md4h/image-backups/`” is visible
   - confirm reference counts appear when referenced beyond current file
   - confirm markdown link path stays unchanged after resize
   - confirm a backup file appears under `.md4h/image-backups/…`
3) Undo/redo:
   - undo should restore original pixels; redo should reapply the resized pixels
4) Rename collision:
   - rename image to an existing filename and confirm overwrite confirmation + reference list appears
5) Spaces-in-path markdown:
   - open `![image in vs-code](./image in vs-code.png)` and confirm it renders
   - save and confirm it normalizes to `![image in vs-code](<./image in vs-code.png>)`
6) Indented images:
   - confirm indentation renders and is preserved after save (round-trip)

## Success Criteria

✅ Resize is “safe by default”: always backup, edit original file, no broken links.  
✅ Backups are predictable + readable; repeated resizes don’t create scary names.  
✅ Resize warns users when it impacts other files or multiple references in the same file.  
✅ Rename warns on collisions and shows references before applying.  
