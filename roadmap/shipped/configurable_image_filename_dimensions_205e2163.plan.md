---
name: Configurable Image Filename Dimensions
overview: Add a VS Code configuration option to control whether image filenames include dimension suffixes (e.g., `_1000x563px`). Default is ON, but users can disable it. This affects both new image naming and resize operations.
todos: []
---

# Configurable Image Filename Dimensions

## Overview

Add a configuration option `speckitForHumans.imageFilename.includeDimensions` (default: `true`) that controls whether image filenames include dimension suffixes like `_1000x563px`. When disabled, images will be named without dimensions (e.g., `image.png` instead of `image_1000x563px.png`).

## Current Behavior

Currently, dimensions are always added to filenames:

- **New images**: `generateImageName()` → `buildImageFilename()` creates `{source}_{name}_{width}x{height}px.{ext}`
- **Resized images**: `updateFilenameDimensions()` updates dimensions in existing filenames

## Changes Required

### 1. Add Configuration Option

**File:** `package.json`

Add new config option in `contributes.configuration.properties`:

```json
"speckitForHumans.imageFilename.includeDimensions": {
  "type": "boolean",
  "default": true,
  "description": "Include image dimensions in filenames (e.g., image_1000x563px.png). When disabled, images are named without dimensions (e.g., image.png)."
}
```

### 2. Pass Configuration to Webview

**File:** `src/editor/MarkdownEditorProvider.ts`

- Read config in `updateWebview()` method (around line 253) and include in message
- Read config in `handleWebviewMessage()` for `ready` case (around line 285) and send via `settingsUpdate`
- Add config change listener (around line 193) to watch for changes and notify webview
- Modify `handleResizeImage()` to read config and conditionally call `updateFilenameDimensions()`

**Key changes:**

- Add `includeDimensions` to the `update` message payload
- Add `includeDimensions` to the `settingsUpdate` message payload
- In `handleResizeImage()`, check config before updating filename dimensions

### 3. Store Configuration in Webview

**File:** `src/webview/editor.ts`

- Store `includeDimensions` in `window` object (similar to `skipResizeWarning`)
- Handle `settingsUpdate` message to update the stored value
- Handle `update` message to initialize the value

### 4. Modify Image Naming Functions

**File:** `src/webview/features/imageDragDrop.ts`

- Modify `buildImageFilename()` to accept optional `includeDimensions` parameter
- Modify `generateImageName()` to check `window.includeDimensions` and conditionally include dimensions
- Modify `updateFilenameDimensions()` to check `window.includeDimensions` and return original filename if disabled

**Key changes:**

```typescript
export function buildImageFilename(
  source: ImageSourceType,
  name: string,
  dimensions: ImageDimensions,
  extension: string,
  includeDimensions: boolean = true  // Add parameter
): string {
  if (!includeDimensions) {
    return `${source}_${name}.${extension}`;
  }
  return `${source}_${name}_${dimensions.width}x${dimensions.height}px.${extension}`;
}

export function generateImageName(...) {
  const includeDimensions = (window as any).includeDimensions !== false; // Default true
  return buildImageFilename(source, safeName, dimensions, ext, includeDimensions);
}

export function updateFilenameDimensions(...) {
  const includeDimensions = (window as any).includeDimensions !== false;
  if (!includeDimensions) {
    return filename; // Return original if dimensions disabled
  }
  // ... existing logic
}
```

### 5. Modify Extension-Side Resize Handler

**File:** `src/editor/MarkdownEditorProvider.ts`

In `handleResizeImage()` method (around line 600):

- Read `includeDimensions` config
- Only call `updateFilenameDimensions()` if config is enabled
- If disabled, keep original filename (don't rename file, just overwrite it)

**Key change:**

```typescript
// In handleResizeImage()
const config = vscode.workspace.getConfiguration();
const includeDimensions = config.get<boolean>('speckitForHumans.imageFilename.includeDimensions', true);

let newFilename: string;
if (includeDimensions) {
  newFilename = updateFilenameDimensions(path.basename(absolutePath), newWidth, newHeight);
} else {
  newFilename = path.basename(absolutePath); // Keep original name
}
```

### 6. Update Tests

**File:** `src/__tests__/features/imageDragDrop.test.ts`

- Add tests for `buildImageFilename()` with `includeDimensions: false`
- Add tests for `generateImageName()` with dimensions disabled
- Add tests for `updateFilenameDimensions()` returning original when disabled

## Implementation Details

### Configuration Flow

```
User changes config → Extension reads → Sends to webview → Stored in window.includeDimensions
                                                          ↓
                                    Used by generateImageName(), buildImageFilename(), updateFilenameDimensions()
```

### Resize Flow (Extension Side)

```
Resize request → Read includeDimensions config
                ↓
         if (includeDimensions)
           → Update filename with dimensions
         else
           → Keep original filename (overwrite file)
```

### Edge Cases

1. **Existing images with dimensions**: When config is disabled, resizing an image that already has dimensions in the filename will keep the original filename (not strip dimensions from existing files)
2. **Config change during session**: Config changes are sent to webview via `settingsUpdate` message
3. **Backward compatibility**: Default is `true`, so existing behavior is preserved

## Files to Modify

1. `package.json` - Add configuration option
2. `src/editor/MarkdownEditorProvider.ts` - Read config, pass to webview, use in resize handler
3. `src/webview/editor.ts` - Store config, handle updates
4. `src/webview/features/imageDragDrop.ts` - Modify naming functions to respect config
5. `src/__tests__/features/imageDragDrop.test.ts` - Add tests for new behavior

## Testing Strategy

1. **Unit tests**: Test `buildImageFilename()`, `generateImageName()`, `updateFilenameDimensions()` with config disabled
2. **Integration tests**: Test resize flow with config disabled (file should not be renamed)
3. **Manual testing**: 

   - Toggle config on/off
   - Paste new image → verify filename format
   - Resize image → verify filename behavior
   - Change config mid-session → verify new images respect new setting