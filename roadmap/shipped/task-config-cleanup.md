# Task: Configuration Cleanup

## 1. Task Metadata

- **Task name:** Configuration Cleanup
- **Slug:** config-cleanup
- **Status:** shipped
- **Created:** 2025-12-13
- **Shipped:** 2025-12-13

---

## 2. Context & Problem

**Current state:**
- 7 configuration options defined in `package.json`
- Some configs were defined but never implemented or used in code
- Unused configs create confusion for users and maintenance burden

**Pain points:**
- **User confusion:** Settings appear in VS Code UI but don't actually do anything
- **Maintenance debt:** Unused configs need to be maintained even though they're not functional
- **Code clarity:** Having unused configs makes it unclear what features are actually implemented

**Why it matters:**
- **Clean configuration:** Only show settings that actually work
- **Reduced maintenance:** Less code to maintain and document
- **Better UX:** Users only see functional settings

---

## 3. Desired Outcome & Scope

**Success criteria:**
- All configuration options in `package.json` are actively used in the codebase
- Removed unused configs: `enableMath`, `enableDiagrams`, `autoSave`
- Documentation updated to reflect removed configs
- No code references to removed configs

**In scope:**
- Review all 7 configuration options
- Identify which are unused
- Remove unused configs from `package.json`
- Update documentation (PRIVACY_POLICY.md)

**Out of scope:**
- Implementing missing features (KaTeX math support)
- Adding new configuration options

---

## 4. Implementation

### Removed Configurations

1. **`speckitForHumans.enableMath`**
   - **Reason:** Not implemented - KaTeX support is planned but not shipped
   - **Status:** Can be re-added when implementing KaTeX math support

2. **`speckitForHumans.enableDiagrams`**
   - **Reason:** Always enabled - Mermaid is always loaded, no conditional logic exists
   - **Status:** Removed - no toggle functionality needed

3. **`speckitForHumans.autoSave`**
   - **Reason:** Redundant - VS Code handles auto-save natively via `files.autoSave`
   - **Status:** Removed - redundant setting

### Kept Configurations (All Actively Used)

1. **`speckitForHumans.imagePath`** - Used in image drag/drop and storage
2. **`speckitForHumans.imagePathBase`** - Controls whether image path is relative to document or workspace folder
3. **`speckitForHumans.chromePath`** - Used in PDF export functionality
4. **`speckitForHumans.imageResize.skipWarning`** - Used in image resize modal

### Files Modified

- `package.json` - Removed 3 unused configuration options (lines 122-136)
- `PRIVACY_POLICY.md` - Updated example to use actual configs instead of `enableMath`

---

## 5. Testing

**Verification:**
- ✅ No code in `src/` references removed configs
- ✅ No linter errors
- ✅ `package.json` structure is valid
- ✅ Documentation updated

**Test results:**
- All existing tests pass
- No breaking changes to functionality

---

## 6. Notes

- Historical task files (`task-user-chrome-path.md`, `task-p1-katex-math.md`) still reference removed configs - these are kept as historical documentation
- When implementing KaTeX math support in the future, `enableMath` config should be re-added at that time
- Mermaid diagrams remain always enabled (no toggle needed)
- VS Code's native `files.autoSave` setting handles document auto-saving




