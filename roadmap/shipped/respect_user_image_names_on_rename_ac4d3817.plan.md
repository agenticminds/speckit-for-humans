---
name: Respect User Image Names on Rename
overview: Modify image rename behavior to respect user-chosen names exactly, without automatically adding dimensions or source prefix. Use existing includeDimensions config to control both dimensions and source prefix for resize operations. Context-based renaming (adding dimensions and source prefix based on config) should only apply to resize operations, not manual renames.
todos:
  - id: create-user-rename-function
    content: Create buildImageFilenameForUserRename() function that respects user's exact name without auto-adding dimensions or source prefix
    status: completed
  - id: update-handleRenameImage
    content: Modify handleRenameImage() to use new function and respect user's exact name (no config-based additions)
    status: completed
  - id: update-resize-handler
    content: Modify handleResizeImage() to use includeDimensions config to control both dimensions AND source prefix on resize
    status: completed
  - id: update-updateFilenameDimensions
    content: Update updateFilenameDimensions() in both MarkdownEditorProvider.ts and imageDragDrop.ts to accept includeDimensions config and apply it to both dimensions and source prefix
    status: completed
  - id: update-webview-functions
    content: Update buildImageFilename() and updateFilenameDimensions() in imageDragDrop.ts to use includeDimensions config for both dimensions and source prefix
    status: completed
  - id: update-tests
    content: Update imageRename.test.ts and add resize tests to verify includeDimensions config controls both dimensions and source prefix
    status: completed
  - id: manual-testing
    content: "Manual testing: rename images (verify no auto-additions); resize with includeDimensions true/false; verify both dimensions and source prefix are controlled together"
    status: completed
---

# Respect User Image Names on Rename

## Current Behavior

**Rename operation** (`handleRenameImage` in `MarkdownEditorProvider.ts`):

- User provides a new name via rename dialog
- System automatically adds dimensions using `buildImageFilenameForRename()` based on `includeDimensions` config
- Example: User chooses "my-image" → becomes "dropped_my-image_800x600px.png"

**Resize operation** (`handleResizeImage`):

- Already correctly updates dimensions in filename using `updateFilenameDimensions()`
- This behavior should remain unchanged

## Desired Behavior

**Rename operation:**

- Respect user's exact chosen name (no auto-adding dimensions or source prefix)
- Example: User chooses "my-image" → becomes "my-image.png" (always)

**Resize operation:**

- Use existing `includeDimensions` config to control BOTH dimensions AND source prefix
- If `includeDimensions` is true → update dimensions AND preserve/add source prefix in filename
- If `includeDimensions` is false → remove dimensions AND remove source prefix from filename
- Single config controls both for simplicity

## Implementation Changes

### 1. Modify `handleRenameImage` in `MarkdownEditorProvider.ts`

**Current logic (lines 1005-1031):**

- Extracts source prefix from old filename
- Gets dimensions from file
- Uses `buildImageFilenameForRename()` which auto-adds dimensions

**New logic:**

- Use user's exact name without auto-adding dimensions or source prefix
- Only add extension

**Code change:**

```typescript
// Build new filename: user's exact name + extension
// Do NOT auto-add dimensions or source prefix on manual rename
const oldExt = path.extname(absoluteOldPath);
const newFilename = `${newName}.${oldExt.replace('.', '')}`;
```

### 2. Update Resize to Use Single Config for Both

**File:** `src/editor/MarkdownEditorProvider.ts` (`handleResizeImage`)

**Current logic (lines 651-659):**

- Only checks `includeDimensions` config
- Uses `updateFilenameDimensions()` which preserves source prefix

**New logic:**

- Use existing `includeDimensions` config to control BOTH dimensions AND source prefix
- If `includeDimensions` is true → update dimensions AND preserve source prefix
- If `includeDimensions` is false → remove dimensions AND remove source prefix
- Update `updateFilenameDimensions()` to accept `includeDimensions` config and apply to both

**Code change:**

```typescript
// Update filename with new dimensions and source prefix (respect includeDimensions config)
const config = vscode.workspace.getConfiguration();
const includeDimensions = config.get<boolean>('speckitForHumans.imageFilename.includeDimensions', true);

let newFilename: string;
if (includeDimensions) {
  newFilename = updateFilenameDimensions(
    path.basename(absolutePath), 
    newWidth, 
    newHeight,
    includeDimensions  // Controls both dimensions and source prefix
  );
} else {
  // Remove both dimensions and source prefix
  newFilename = updateFilenameDimensions(
    path.basename(absolutePath), 
    newWidth, 
    newHeight,
    false  // Will strip both dimensions and source prefix
  );
}
```

### 3. Update `updateFilenameDimensions` Function

**File:** `src/editor/MarkdownEditorProvider.ts`

**Current signature:**

```typescript
function updateFilenameDimensions(
  filename: string,
  newWidth: number,
  newHeight: number
): string
```

**New signature:**

```typescript
function updateFilenameDimensions(
  filename: string,
  newWidth: number,
  newHeight: number,
  includeDimensions: boolean = true  // Controls both dimensions AND source prefix
): string
```

**Logic changes:**

- Parse filename to extract source prefix, name, dimensions, extension
- Rebuild filename based on `includeDimensions` flag:
  - If `includeDimensions` is true → include dimensions AND source prefix
  - If `includeDimensions` is false → remove dimensions AND source prefix
  - Preserve name and extension always

### 4. Update `buildImageFilenameForRename` (or create simpler helper)

**Option A:** Modify `buildImageFilenameForRename` to accept a flag indicating "user rename" vs "system rename"

**Option B:** Create a new simpler function `buildImageFilenameForUserRename()` that doesn't add dimensions

**Recommendation:** Option B - keep `buildImageFilenameForRename` for potential future use, create simpler function for user renames.

**New function:**

```typescript
/**
 * Build image filename for user-initiated rename
 * Preserves source prefix but respects user's exact name (no auto-dimensions)
 * Pattern: {source}{name}.{ext}
 */
export function buildImageFilenameForUserRename(
  sourcePrefix: string | null,
  name: string,
  extension: string
): string {
  const source = sourcePrefix || '';
  return `${source}${name}.${extension}`;
}
```

### 5. Update Webview Functions

**File:** `src/webview/features/imageDragDrop.ts`

- Update `updateFilenameDimensions()` to use `includeDimensions` config for both dimensions AND source prefix
- Update `buildImageFilename()` to use `includeDimensions` config for both dimensions AND source prefix
- When `includeDimensions` is false, both dimensions and source prefix should be omitted

### 6. Update Tests

**File:** `src/__tests__/editor/imageRename.test.ts`

**Changes needed:**

- Update tests to verify dimensions are NOT added on rename
- Add test cases for:
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Rename preserves source prefix but not dimensions
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Rename without source prefix works correctly
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - User's exact name is respected

## File Changes

1. **`package.json`** (optional - update description)
   - Update `speckitForHumans.imageFilename.includeDimensions` description to clarify it controls both dimensions AND source prefix for resize operations
   - Current: "Include image dimensions in filenames..."
   - Suggested: "Include image context in filenames (dimensions and source prefix) for resize operations. When disabled, both dimensions and source prefix are removed from filenames on resize. Note: Manual renames always respect user's exact name regardless of this setting."

2. **`src/editor/MarkdownEditorProvider.ts`**
   - Modify `handleRenameImage()` (lines 1005-1031) to respect user's exact name (no config-based additions)
   - Modify `handleResizeImage()` (lines 651-659) to use `includeDimensions` config for both dimensions AND source prefix
   - Update `updateFilenameDimensions()` to accept `includeDimensions` config and apply it to both dimensions and source prefix
   - Add `buildImageFilenameForUserRename()` function (after `buildImageFilenameForRename`)

2. **`src/webview/features/imageDragDrop.ts`**
   - Update `updateFilenameDimensions()` to use `includeDimensions` config for both dimensions AND source prefix
   - Update `buildImageFilename()` to use `includeDimensions` config for both dimensions AND source prefix

3. **`src/__tests__/editor/imageRename.test.ts`**
   - Update existing tests
   - Add new tests for user rename behavior (no auto-additions)

4. **`src/__tests__/editor/imageResize.test.ts`** (if exists) or add to existing test files
   - Add tests verifying `includeDimensions` config controls both dimensions and source prefix on resize
   - Test with `includeDimensions: true` → both should be included
   - Test with `includeDimensions: false` → both should be removed

## Edge Cases

1. **User renames to name that already has dimensions:**

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - If user manually types "my-image_800x600px", respect it exactly
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Don't strip dimensions if user explicitly includes them

2. **Source prefix preservation:**

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - If original has "dropped_" or "pasted_", preserve it
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - If original has no prefix, don't add one

3. **Resize after rename:**
   - Resize should respect `includeDimensions` config (controls both dimensions and source prefix)
   - `updateFilenameDimensions()` should handle renamed files (may need to parse user-chosen names)

## Testing Strategy

1. **Unit tests:**

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `buildImageFilenameForUserRename()` with various inputs
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Rename with/without source prefix
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Rename preserves user's exact name

2. **Integration tests:**

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Rename image → verify filename has no auto-added dimensions
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Resize renamed image → verify dimensions are added/updated correctly
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Rename → resize → verify both operations work correctly

3. **Manual testing:**
   - Rename an image with source prefix → verify prefix preserved, no dimensions added
   - Rename an image without source prefix → verify no prefix added, no dimensions added
   - Resize with `includeDimensions: true` → verify both dimensions and source prefix are included/updated
   - Resize with `includeDimensions: false` → verify both dimensions and source prefix are removed
   - Rename then resize → verify both behaviors work correctly

## Success Criteria

✅ User-chosen names are respected exactly on rename (no config-based additions)
✅ Source prefix is not auto-added/preserved on rename
✅ Resize operations use existing `includeDimensions` config to control BOTH dimensions AND source prefix
✅ When `includeDimensions` is true → both dimensions and source prefix are included/updated on resize
✅ When `includeDimensions` is false → both dimensions and source prefix are removed on resize
✅ Tests pass (new + existing)
✅ Manual testing confirms expected behavior for both config values

## Verification Notes

- Tests: `npm test`
- Build: `npm run build`
