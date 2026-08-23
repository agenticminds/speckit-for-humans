---
name: Image Metadata Overlay & Configurable Dimensions
overview: "Comprehensive plan covering: (1) Redesign metadata display to centered card overlay with typography refinements, (2) Add configurable option to control dimension suffixes in filenames. Both features work together to provide a polished image metadata experience."
todos: []
---

# Image Metadata Overlay & Configurable Dimensions

## Overview

This plan covers two related image metadata features:

1. **Centered Metadata Overlay**: Redesign from bottom backdrop strip to full-image overlay with centered card-style panel and typography refinements
2. **Configurable Dimension Suffixes**: Add configuration option to control whether filenames include dimension suffixes (e.g., `_1000x563px`)

Both features enhance the image metadata experience - the overlay provides better visual presentation, while the config option gives users control over filename format.

## Part 1: Centered Metadata Overlay with Typography

### Current Implementation

**Current Design:**

- Backdrop only covers bottom 18% of image (patchy appearance)
- Metadata footer positioned at bottom
- Basic typography without clear hierarchy
- Font sizes: 9px-13px with minimal spacing

### Target Design

**New Design:**

- Full-image backdrop overlay (covers entire image)
- Centered metadata card/panel
- Typography-focused: clear hierarchy, optimal readability
- Lightweight CSS: font-size, line-height, spacing tweaks

### Visual Specification

```
┌─────────────────────────────────────┐
│                                     │
│    [Full semi-transparent backdrop] │
│                                     │
│         ┌──────────────────┐        │
│         │  800×451px       │ ← 16px, weight 500
│         │  · 576.0 KB      │ ← 14px, weight 400
│         │                  │        │
│         │ ./images/        │ ← 13px, muted
│         │ pop_800x451px.png│        │
│         │                  │        │
│         │ Modified: Today  │ ← 13px, muted
│         └──────────────────┘        │
│                                     │
└─────────────────────────────────────┘
```

### Typography Specifications

**Font Size Hierarchy:**

- **Small images (< 200px)**: Base 13px, dimensions 13px, path/date 11px
- **Medium images (200-600px)**: Base 14px, dimensions 15px, size 13px, path/date 12px
- **Large images (> 600px)**: Base 15px, dimensions 16px, size 14px, path/date 13px

**Line Height:**

- Card container: `1.5` (comfortable reading)
- Metadata rows: `1.4` (slightly tighter for compact display)
- Between rows: `6px-8px` spacing

**Font Weight & Color:**

- Dimensions: `font-weight: 500` (medium - primary info)
- Size: `font-weight: 400` (normal - secondary)
- Path/Date: `font-weight: 400` (normal - tertiary, muted color with opacity)

**Spacing:**

- Card padding: Small 12px-14px, Medium 14px-16px, Large 16px-20px
- Row spacing: 6px between rows
- Element spacing: 8px gap between inline elements

### Implementation - CSS Changes

**File:** `src/webview/editor.css`

**1. Update Backdrop (Full Image):**

```css
.image-wrapper::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;  /* Full image coverage */
  background: rgba(0, 0, 0, 0.6);
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
  pointer-events: none;
  z-index: 10;
  border-radius: inherit;
}

.image-wrapper.image-hover-active::before {
  opacity: 1;
}
```

**2. Update Footer - Centered Card:**

```css
.image-metadata-footer {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  max-width: 320px;
  width: auto;
  background: var(--vscode-editorWidget-background);
  border: 1px solid var(--vscode-widget-border);
  border-radius: 8px;
  padding: 14px 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  z-index: 11;
  display: none;
  opacity: 0;
  transition: opacity 0.2s ease-in-out, transform 0.2s ease-in-out;
  line-height: 1.5;
  font-family: var(--vscode-editor-font-family);
}

.image-wrapper.image-hover-active .image-metadata-footer {
  display: block;
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
}
```

**3. Typography Hierarchy by Image Size:**

See detailed CSS in plan file for small/medium/large image typography rules.

## Part 2: Configurable Dimension Suffixes

### Overview

Add configuration option `speckitForHumans.imageFilename.includeDimensions` (default: `true`) to control whether image filenames include dimension suffixes like `_1000x563px`. When disabled, images are named without dimensions.

### Implementation

**1. Add Configuration Option**

**File:** `package.json`

```json
"speckitForHumans.imageFilename.includeDimensions": {
  "type": "boolean",
  "default": true,
  "description": "Include image dimensions in filenames (e.g., image_1000x563px.png). When disabled, images are named without dimensions (e.g., image.png)."
}
```

**2. Pass Configuration to Webview**

**File:** `src/editor/MarkdownEditorProvider.ts`

- Read config in `updateWebview()` (around line 253) and include in message
- Read config in `handleWebviewMessage()` for `ready` case (around line 285) and send via `settingsUpdate`
- Add config change listener (around line 193) to watch for changes
- Modify `handleResizeImage()` to read config and conditionally update filename

**Key changes:**

```typescript
// In updateWebview()
const includeDimensions = config.get<boolean>('speckitForHumans.imageFilename.includeDimensions', true);
webview.postMessage({
  type: 'update',
  content: transformedContent,
  skipResizeWarning: skipWarning,
  includeDimensions: includeDimensions,
});

// In handleResizeImage() around line 600
const includeDimensions = config.get<boolean>('speckitForHumans.imageFilename.includeDimensions', true);
let newFilename: string;
if (includeDimensions) {
  newFilename = updateFilenameDimensions(path.basename(absolutePath), newWidth, newHeight);
} else {
  newFilename = path.basename(absolutePath); // Keep original name
}
```

**3. Store Configuration in Webview**

**File:** `src/webview/editor.ts`

- Store `includeDimensions` in `window` object (similar to `skipResizeWarning`)
- Handle `settingsUpdate` message to update stored value
- Handle `update` message to initialize value

**4. Modify Image Naming Functions**

**File:** `src/webview/features/imageDragDrop.ts`

**Modify `buildImageFilename()`:**

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
```

**Modify `generateImageName()`:**

```typescript
export function generateImageName(
  originalName: string,
  source: ImageSourceType,
  dimensions: ImageDimensions
): string {
  // ... existing sanitization code ...
  const includeDimensions = (window as any).includeDimensions !== false; // Default true
  return buildImageFilename(source, safeName, dimensions, ext, includeDimensions);
}
```

**Modify `updateFilenameDimensions()`:**

```typescript
export function updateFilenameDimensions(
  filename: string,
  newDimensions: ImageDimensions
): string {
  const includeDimensions = (window as any).includeDimensions !== false;
  if (!includeDimensions) {
    return filename; // Return original if dimensions disabled
  }
  // ... existing logic ...
}
```

**5. Update Tests**

**File:** `src/__tests__/features/imageDragDrop.test.ts`

Add tests for naming functions with `includeDimensions: false`.

## Files to Modify

### Part 1: Centered Overlay

1. `src/webview/editor.css` - Update backdrop, footer positioning, typography hierarchy
2. `src/webview/features/imageMetadata.ts` - Verify content structure (optional)

### Part 2: Configurable Dimensions

1. `package.json` - Add configuration option
2. `src/editor/MarkdownEditorProvider.ts` - Read config, pass to webview, use in resize handler
3. `src/webview/editor.ts` - Store config, handle updates
4. `src/webview/features/imageDragDrop.ts` - Modify naming functions to respect config
5. `src/__tests__/features/imageDragDrop.test.ts` - Add tests

## Testing Strategy

### Part 1: Centered Overlay

1. **Visual testing**: Verify full-image backdrop, centered card, typography hierarchy
2. **Typography testing**: Verify font sizes, line-height, spacing feel natural
3. **Animation testing**: Verify smooth fade-in/out and scale-in

### Part 2: Configurable Dimensions

1. **Unit tests**: Test naming functions with config disabled
2. **Integration tests**: Test resize flow with config disabled
3. **Manual testing**: Toggle config, verify filename format in new images and resizes

## Success Criteria

### Part 1: Centered Overlay

- Full-image backdrop overlay (no patchy appearance)
- Centered metadata card with excellent typography
- Clear visual hierarchy (dimensions prominent, path/date secondary)
- Comfortable reading experience (proper line-height, spacing)
- Lightweight CSS (only font-size, line-height, spacing tweaks)

### Part 2: Configurable Dimensions

- Configuration option added and functional
- New images respect config setting
- Resize operations respect config setting
- Default behavior (dimensions ON) preserved
- Config changes propagate to webview correctly

## Implementation Order

**Recommended order:**

1. Implement Part 1 (Centered Overlay) first - improves UX immediately
2. Then implement Part 2 (Configurable Dimensions) - adds flexibility

Both can be done independently, but Part 1 provides immediate visual improvement.