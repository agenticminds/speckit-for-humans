# Enabling the Pre-Commit Hook

The pre-commit hook is currently **disabled** and saved as `pre-commit.disabled`.

## To Enable When Ready

1. **Rename the disabled hook to active:**
   ```bash
   mv .github/hooks/pre-commit.disabled .github/hooks/pre-commit
   ```

2. **Ensure it's executable:**
   ```bash
   chmod +x .github/hooks/pre-commit
   ```

3. **Install the hook:**
   ```bash
   bun run install-hooks
   ```

4. **Verify installation:**
   ```bash
   ls -l .git/hooks/pre-commit
   ```

## What the Hook Does

When enabled, the pre-commit hook will:
- Automatically run `bun run lint:fix` before each commit
- Check for remaining linting issues with `bun run lint`
- Block commits if linting fails (with helpful error messages)

## Current Status

- ✅ Hook implementation is complete
- ✅ Hook is saved as `pre-commit.disabled`
- ⚠️ Hook is **not active** (won't run on commits)
- 📝 Ready to enable when codebase is lint-clean

## Testing Before Enabling

Before enabling, ensure:
- [ ] Run `bun run lint:fix` manually and review all changes
- [ ] Run `bun run lint` and fix any remaining errors
- [ ] Verify build still works: `bun run build && bun run verify-build`
- [ ] Run tests: `bun run test`
- [ ] All team members are aware of the hook

---

**Last Disabled:** 2025-12-25  
**Reason:** Codebase needs linting cleanup before automated checks

