# Task: Git Diff Integration

**Status:** completed
**Created:** 2025-11-28
**Last Updated:** 2025-11-28 08:00

## Goal
Ensure the Speckit for Humans extension integrates cleanly with VS Code's built-in Git extension and diff views, without interfering with the standard Git diff UI.

## Context
The extension uses a `CustomTextEditorProvider` for `.md` files. Currently, it may be intercepting Git diff resources (like `git:` URIs) which should use the built-in text diff editor instead. This task implements the "Simple Fix (MVP)" phase from the spec.

## Approach
Following the spec at [specs/git-diff-integration/task-git-diff-integration.md](../specs/git-diff-integration/task-git-diff-integration.md):

1. **Package.json selector hardening**: Add `scheme: "file"` to prevent custom editor from activating on `git:` URIs
2. **Document sync audit**: Ensure bidirectional sync between TextDocument and webview works correctly
3. **Command verification**: Confirm `speckitForHumans.openFile` command exists and works
4. **Manual testing**: Test with Git operations (diff views, checkout, discard, etc.)

## Requirements
- R1: Only apply custom editor to `file` scheme (not `git:` or other virtual URIs)
- R2: Keep TextDocument as single source of truth
- R3: Provide command to open MD files in the custom editor from Explorer/SCM

## Files to Examine/Modify
- `package.json` - Add scheme selector to custom editor
- `src/editor/MarkdownEditorProvider.ts` - Verify document sync logic
- `src/extension.ts` - Verify command registration

## Changes Made

### 2025-11-28 08:00 - Initial planning
- Created task file
- Reviewing current implementation to understand what exists

### 2025-11-28 08:05 - Current implementation audit
- **GOOD NEWS**: Most requirements already implemented!
- R1 ✓ - `package.json:48-49` already has `"scheme": "file"` for both .md and .markdown
- R2 ✓ - Document sync is implemented in `MarkdownEditorProvider.ts`:
  - Line 60-64: `onDidChangeTextDocument` listener for external changes → webview
  - Line 267-288: `applyEdit` method for webview → TextDocument
  - Line 88-102: Feedback loop protection with timestamp tracking
- R3 ✓ - `speckitForHumans.openFile` command exists (extension.ts:16-40)
  - Accepts optional URI parameter
  - Prompts user if no URI provided
  - Uses `vscode.openWith` to open in custom editor
- Explorer context menu ✓ - Already configured (package.json:76-82)
- **MISSING**: SCM context menu entry (need to add for opening from Source Control view)

### 2025-11-28 08:10 - Added SCM context menu
- Added `scm/resourceState/context` menu entry in package.json:83-89
- Users can now right-click changed .md files in Source Control view
- Command uses same `speckitForHumans.openFile` with `when` clause checking for .md extension
- Ready for testing

### 2025-11-28 08:15 - Built extension successfully
- Ran `npm run build` - all builds successful
- Extension size: 7.7kb (excellent)
- Webview size: 4.1MB (acceptable, mostly TipTap + highlight.js + Mermaid)
- Ready for manual testing in VS Code

## Decisions

### Priority: "option" vs "default"
- Custom editor uses `priority: "option"` (package.json:55)
- This makes the extension available but NOT the default editor
- Users can choose when to use WYSIWYG vs standard text editor
- **Critical for Git diffs**: Ensures diff views use built-in text editor, not our custom editor
- Users can set as default via VS Code's "Configure Default Editor" if desired

## Issues Encountered
None! Most of the implementation was already in place.

## Follow-up Tasks
- [x] Add SCM context menu entry
- [x] Build extension
- [ ] **Manual testing required** (see test plan below)

## Manual Test Plan

### Test 1: Git Diff Views (verify scheme: "file" works)
1. Open a `.md` file with pending changes (e.g., this task file)
2. In SCM view, click "Open Changes" (diff icon)
3. **Expected**: Shows standard text diff editor (NOT the custom WYSIWYG editor)
4. Verify both sides show markdown source, not rendered view

### Test 2: SCM Context Menu
1. In SCM view, find a modified `.md` file
2. Right-click the file
3. **Expected**: See "Open with Speckit for Humans" option in context menu
4. Click the option
5. **Expected**: File opens in WYSIWYG editor

### Test 3: Explorer Context Menu
1. In Explorer, right-click any `.md` file
2. **Expected**: See "Open with Speckit for Humans" option
3. Click it and verify file opens in WYSIWYG editor

### Test 4: Document Sync (External Changes → Webview)
1. Open a `.md` file in WYSIWYG editor
2. Make a change in the editor (add some text)
3. **Do NOT save yet**
4. Run `git checkout -- <filename>` or use SCM "Discard Changes"
5. **Expected**: Webview updates immediately to show reverted content

### Test 5: Document Sync (Webview → Git)
1. Open a `.md` file in WYSIWYG editor
2. Make several edits in the WYSIWYG view
3. Check SCM view
4. **Expected**: File shows as modified with correct diff

### Test 6: Command Palette
1. Press Cmd/Ctrl+Shift+P
2. Type "Speckit for Humans: Open File"
3. Select a `.md` file
4. **Expected**: File opens in WYSIWYG editor

### Test 7: Priority Option
1. Double-click a `.md` file in Explorer
2. **Expected**: Opens in default editor (likely VS Code's standard text editor)
3. To change default: Right-click file → "Open With..." → Choose "Speckit for Humans" → Check "Configure Default Editor"

## Notes
This is the MVP/simple fix phase. A future phase may add a custom WYSIWYG diff viewer, but that's out of scope for now.
