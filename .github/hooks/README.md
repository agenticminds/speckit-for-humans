# Git Hooks

This directory contains git hook templates that can be installed to automate common workflows.

## Available Hooks

### `pre-commit` (Currently Disabled)

**Status:** ⚠️ **DISABLED** - The pre-commit hook is currently disabled. It will be enabled once the codebase is ready for automated linting checks.

**Purpose:** Automatically fixes linting issues and prevents commits with linting errors.

**What it does:**
- Runs before every `git commit`
- Automatically fixes linting issues with `bun run lint:fix`
- Checks for remaining issues with `bun run lint`
- Blocks the commit if linting fails (with helpful error message)

**Why it's useful:**
Ensures code quality is maintained automatically. You don't need to remember to run linting - it happens automatically before every commit.

**To enable when ready:**
```bash
# Rename the disabled hook back to active
mv .github/hooks/pre-commit.disabled .github/hooks/pre-commit
chmod +x .github/hooks/pre-commit

# Reinstall hooks
bun run install-hooks
```

**To skip (not recommended):**
```bash
git commit --no-verify
```

## Installation

### Quick Install (Recommended)

Run the installation script from the project root:

```bash
bun run install-hooks
# or
./scripts/install-git-hooks.sh
```

### Manual Install

Copy the hooks to your `.git/hooks/` directory:

```bash
cp .github/hooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

## Important Notes

⚠️ **Git hooks are not tracked by git** - Each developer must install them manually after cloning the repository.

✅ **Hooks are optional** - The project will work fine without them, they just provide helpful automation and reminders.

## Verifying Installation

After installation, you can verify the hooks work:

1. Check the hook files exist and are executable:
   ```bash
   ls -l .git/hooks/pre-commit
   ```

2. Test pre-commit by making a linting error and trying to commit

## Troubleshooting

**Hook not running:**
- Ensure the hook file is executable: `chmod +x .git/hooks/pre-commit`
- Check that you're using `git commit` (hooks don't run for `git commit --no-verify`)

**Want to disable a hook temporarily:**
- Rename it: `mv .git/hooks/pre-commit .git/hooks/pre-commit.disabled`
- Or use: `git commit --no-verify` (skips pre-commit hook)

**Errors in hook execution:**
- Hooks run in a minimal shell environment
- Check the hook script for syntax errors: `bash -n .git/hooks/pre-commit`
