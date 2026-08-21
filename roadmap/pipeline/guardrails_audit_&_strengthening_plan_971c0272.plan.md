---
name: Guardrails Audit & Strengthening Plan
overview: Deep audit of AGENTS.md and coding guides to identify why code quality debt accumulated despite guardrails. Analysis of gaps, loopholes, and weak enforcement. Plan to strengthen guidelines with actionable, enforceable rules.
todos:
  - id: add-eslint-rules
    content: Add ESLint rules to block any types and deprecated APIs
    status: pending
  - id: add-pre-commit-hook
    content: Set up pre-commit hook with husky to run lint, type-check, and tests
    status: pending
  - id: add-ci-quality-checks
    content: Add CI/CD quality checks for any types and other violations
    status: pending
  - id: update-common-pitfalls
    content: Add listener cleanup pattern, update sync section with hash-based approach
    status: pending
  - id: update-coding-standards
    content: Add error handling section, deprecated APIs section, type safety patterns
    status: pending
  - id: update-testing-guide
    content: Add memory leak testing section with patterns and examples
    status: pending
  - id: strengthen-agents-checklist
    content: Update self-review checklist with verifiable commands and mandatory items
    status: pending
  - id: add-enforcement-section
    content: Add Code Quality Enforcement section to AGENTS.md with automated checks
    status: pending
  - id: enable-typescript-strict
    content: Verify/enable TypeScript strict mode, fix existing violations incrementally
    status: pending
  - id: document-exceptions
    content: Document when any types are necessary (with eslint-disable comments and reasons)
    status: pending
  - id: quarterly-audit-process
    content: Establish quarterly audit process to review codebase vs. guidelines compliance
    status: pending
---

# Guardrails Audit & Strengthening Plan

## Executive Summary

**Problem:** Despite comprehensive guidelines in `AGENTS.md` and `prompts/vibe-coding-guides/`, significant code quality debt accumulated:

- 125 `any` types (guideline says "no `any`")
- ✅ Console logging resolved (2025-01-13: build-time removal via esbuild)
- 5+ memory leaks (guideline says "clear listeners")
- Deprecated APIs (`substr`)
- Missing error handling (`applyEdit`)

**Root Cause Analysis:**

1. **Rules exist but aren't enforced** - Checklists are optional, no automated checks
2. **Vague guidance** - "Clear listeners" but no specific patterns
3. **Missing patterns** - No examples for common scenarios
4. **No pre-commit validation** - Code can be committed without review
5. **Self-review is optional** - Easy to skip checklist
6. **Incomplete coverage** - Some issues (deprecated APIs, hash-based sync) not mentioned

---

## Part 1: Gap Analysis - What Guidelines Say vs. Reality

### 1.1 TypeScript `any` Types

**What Guidelines Say:**

- `AGENTS.md:119`: "Code quality - TypeScript strict, meaningful names, **no `any`**"
- `coding-standards.md:167`: "TypeScript strict, **no `any`**, meaningful names"

**Reality:**

- **125 instances** of `any` in codebase
- Most in critical files: `BubbleMenuView.ts`, `editor.ts`, `imageEnterSpacing.ts`

**Why It Failed:**

1. ❌ **No enforcement** - TypeScript compiler doesn't fail on `any` (strict mode allows it)
2. ❌ **No pre-commit hook** - Can commit `any` types
3. ❌ **No lint rule** - ESLint not configured to warn on `any`
4. ❌ **Vague guidance** - Says "no `any`" but doesn't explain HOW to avoid it
5. ❌ **No examples** - Doesn't show how to type ProseMirror internals, window properties
6. ❌ **Checklist is optional** - Self-review can be skipped

**Gap:** Rule exists but is unenforceable and lacks actionable guidance.

### 1.3 Memory Leaks (Event Listeners)

**What Guidelines Say:**

- `performance.md:38`: "**Clear event listeners when webview disposed**"
- `vscode-integration.md:13`: "Clean up in `deactivate()` (dispose subscriptions)"

**Reality:**

- **5+ known listener leaks**: mermaid.ts, editor.ts, imageDragDrop.ts
- Listeners added but never removed

**Why It Failed:**

1. ❌ **Vague guidance** - Says "clear listeners" but doesn't show HOW
2. ❌ **No patterns** - No code examples for proper cleanup
3. ❌ **No checklist item** - Not in self-review checklist
4. ❌ **Webview-specific gap** - Guidance focuses on extension `deactivate()`, not webview cleanup
5. ❌ **No examples** - Doesn't show TipTap `on('destroy')` pattern
6. ❌ **No testing requirement** - No test to verify cleanup

**Gap:** Guidance exists but is too abstract, missing webview-specific patterns.

---

### 1.4 Error Handling

**What Guidelines Say:**

- `ux-principles.md:28-51`: Error handling section with examples
- `coding-standards.md:167`: "error handling" (mentioned but not detailed)

**Reality:**

- `applyEdit()` has no try/catch
- Many async operations lack error handling
- Errors silently fail

**Why It Failed:**

1. ❌ **Not in checklist** - Error handling not explicitly in self-review
2. ❌ **No specific requirements** - Doesn't say "all async operations must have try/catch"
3. ❌ **No pattern for critical operations** - Doesn't show `applyEdit` pattern
4. ❌ **Vague guidance** - Says "error handling" but doesn't specify where
5. ❌ **No enforcement** - Can commit code without error handling

**Gap:** Guidance exists but isn't actionable or enforced.

---

### 1.5 Deprecated APIs

**What Guidelines Say:**

- **Nothing** - No mention of deprecated APIs anywhere

**Reality:**

- 6 instances of deprecated `substr()` method

**Why It Failed:**

1. ❌ **Complete gap** - Not mentioned in any guide
2. ❌ **No lint rule** - ESLint not configured to catch deprecated APIs
3. ❌ **No awareness** - Developers may not know `substr` is deprecated

**Gap:** Complete blind spot in guidelines.

---

### 1.6 Race Conditions & Sync Logic

**What Guidelines Say:**

- `common-pitfalls.md:8-17`: "Feedback Loops in Document Sync"
  - Solution: "Set `ignoreNextUpdate` flag" (the problematic approach!)
  - "Check `lastEditTimestamp`" (good)
  - "Skip updates if content unchanged" (good)

**Reality:**

- Webview still uses boolean `ignoreNextUpdate` flag (problematic)
- Extension uses content comparison (good)
- Inconsistency between webview and extension

**Why It Failed:**

1. ❌ **Documents problematic pattern** - `common-pitfalls.md` recommends the boolean flag approach
2. ❌ **No hash-based pattern** - Doesn't mention content hashing
3. ❌ **Inconsistent guidance** - Extension uses better pattern but webview doesn't
4. ❌ **No enforcement** - Can use boolean flag even though it's risky

**Gap:** Guidelines document the anti-pattern as the solution.

---

### 1.7 Self-Review Checklist

**What Guidelines Say:**

- `AGENTS.md:118-126`: Self-review checklist with 8 items
- Includes: "no `any`", "no console.log", "error handling"

**Reality:**

- Checklist is **optional** - No enforcement
- Easy to skip or miss items
- No automated validation

**Why It Failed:**

1. ❌ **Not enforced** - Checklist is manual, can be skipped
2. ❌ **No pre-commit hook** - Code can be committed without review
3. ❌ **No automated checks** - TypeScript/ESLint don't enforce checklist items
4. ❌ **No verification** - No way to verify checklist was followed
5. ❌ **Too many items** - 8 items is easy to miss one

**Gap:** Checklist exists but is purely honor-system.

---

## Part 2: Structural Issues in Guidelines

### 2.1 Missing Enforcement Mechanisms

**Current State:**

- Guidelines are **advisory only**
- No automated checks
- No pre-commit validation
- No CI/CD checks
- No lint rules

**What's Missing:**

1. ESLint rules for `any` types
2. ESLint rules for deprecated APIs
3. Pre-commit hooks to run checks
4. CI/CD validation
5. TypeScript strict mode enforcement

**Note:** Console logging is handled by build-time removal (esbuild `pure` option), not ESLint.

---

### 2.2 Vague or Abstract Guidance

**Examples:**

1. **"Clear event listeners"** (performance.md:38)

   - ❌ Doesn't say WHERE to clear them
   - ❌ Doesn't show HOW (TipTap `on('destroy')` pattern)
   - ❌ Doesn't mention webview-specific cleanup

2. **"Error handling"** (coding-standards.md:167)

   - ❌ Doesn't specify which operations need it
   - ❌ Doesn't show patterns for async operations
   - ❌ Doesn't mention user-facing vs. logged errors

3. **"No `any`"** (AGENTS.md:119)

   - ❌ Doesn't explain how to type ProseMirror internals
   - ❌ Doesn't show window property typing
   - ❌ Doesn't explain when `any` might be necessary (with documentation)

---

### 2.3 Missing Patterns & Examples

**What's Missing:**

1. **Listener Cleanup Pattern**
   ```typescript
   // ❌ Missing from guidelines
   editor.on('destroy', () => {
     document.removeEventListener('click', handler);
   });
   ```

2. **Hash-Based Sync Pattern**
   ```typescript
   // ❌ Missing from guidelines (documents boolean flag instead)
   const contentHash = hashString(content);
   if (contentHash === lastSentHash) return;
   ```

3. **Error Handling Pattern for Critical Operations**
   ```typescript
   // ❌ Missing from guidelines
   try {
     await vscode.workspace.applyEdit(edit);
   } catch (error) {
     vscode.window.showErrorMessage(...);
   }
   ```

4. **Window Property Typing**
   ```typescript
   // ❌ Missing from guidelines
   interface WindowWithMD4H extends Window {
     vscode?: VsCodeApi;
   }
   ```


---

### 2.4 Contradictory Guidance

**Example 1: Console Logging**

- `AGENTS.md:124`: "No console.log"
- `ux-principles.md:50`: "Log technical details to Debug Console"
- **Contradiction:** When is logging allowed?

**✅ Resolved (2025-01-13):** Implemented build-time removal via esbuild `pure` option. Use `console.log()` directly in code; production builds automatically strip `console.log/debug/info` while keeping `console.error/warn`. See `scripts/build-webview.js` for implementation.

**Example 2: Sync Pattern**

- `common-pitfalls.md:13`: Recommends `ignoreNextUpdate` boolean flag
- Extension code uses content comparison (better approach)
- **Contradiction:** Which pattern should be used?

---

### 2.5 Missing Coverage Areas

**Not Mentioned Anywhere:**

1. **Deprecated APIs** - No guidance on checking for/avoiding deprecated methods
2. **Hash-based deduplication** - Only boolean flag mentioned
3. **Window global properties** - No typing guidance
4. **ProseMirror type safety** - No guidance on typing internals
5. **Test coverage requirements** - Says "write tests" but no coverage thresholds
6. **Memory leak testing** - No guidance on how to test for leaks
7. **Pre-commit validation** - No mention of git hooks or automated checks

---

## Part 3: Why "Vibe Coding" Failed

### 3.1 Definition of "Vibe Coding"

Based on context, "Vibe Coding" appears to mean:

- Fast, iterative development
- Focus on getting features working
- Less emphasis on code quality/technical debt
- "Make it work, optimize later" mindset

### 3.2 How Guidelines Failed to Prevent Vibe Coding

**Issue 1: Guidelines Are Optional**

- Self-review checklist can be skipped
- No automated enforcement
- Easy to say "I'll fix it later"

**Issue 2: Guidelines Are Vague**

- "No `any`" but no HOW
- "Clear listeners" but no pattern
- Hard to follow when guidance is abstract

**Issue 3: Guidelines Are Incomplete**

- Missing patterns for common scenarios
- Doesn't cover all edge cases
- Gaps allow workarounds

**Issue 4: No Quality Gates**

- Can commit code that violates guidelines
- No pre-commit validation
- No CI/CD checks
- Tests can be skipped

**Issue 5: Feature Velocity > Code Quality**

- Guidelines don't block feature work
- Quality is "nice to have" not "must have"
- No penalty for violating guidelines

---

## Part 4: Strengthening the Guardrails

### 4.1 Add Automated Enforcement

#### 4.1.1 ESLint Rules

**Add to `.eslintrc.js`:**

```javascript
rules: {
  '@typescript-eslint/no-explicit-any': 'error',  // Block any types
  'no-restricted-syntax': [
    'error',
    {
      selector: 'CallExpression[callee.property.name="substr"]',
      message: 'Use .substring() or .slice() instead of deprecated .substr()',
    },
  ],
}
```

**Note:** Console logging is handled by build-time removal (esbuild `pure` option in `scripts/build-webview.js`), not ESLint. This keeps line numbers accurate and removes `console.log/debug/info` in production while keeping `console.error/warn`.

**Impact:** Catches violations at development time

**Risk:** Low - Linting only, doesn't break functionality

**Estimated Time:** 30 minutes

---

#### 4.1.2 Pre-Commit Hook

**Add `.husky/pre-commit`:**

```bash
#!/bin/sh
bun run lint
bun run type-check
bun run test
```

**Impact:** Blocks commits with violations

**Risk:** Medium - Could slow down development if too strict

**Estimated Time:** 1 hour (setup husky + scripts)

**Alternative (Lighter):**

- Only run on changed files
- Allow `--no-verify` for emergencies (documented)
- Focus on critical checks (types, tests)

---

#### 4.1.3 TypeScript Strict Mode

**Current:** Unknown if strict mode is enabled

**Check:** `tsconfig.json` for `strict: true`

**Add if missing:**

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true
  }
}
```

**Impact:** Catches type errors at compile time

**Risk:** Medium - May require fixing existing code

**Estimated Time:** 2-4 hours (fix existing violations)

---

### 4.2 Add Specific Patterns & Examples

#### 4.2.1 Update `common-pitfalls.md`

**Add Section: Event Listener Cleanup**

````markdown
## 6. Event Listener Memory Leaks

**Problem:** Event listeners added but never removed accumulate, causing memory leaks

**Solution Pattern:**
```typescript
// ✅ Good - Store handler reference, remove on destroy
let clickHandler: ((e: MouseEvent) => void) | null = null;

function setupFeature() {
  clickHandler = (e: MouseEvent) => {
    // Handle click
  };
  document.addEventListener('click', clickHandler);
  
  // Clean up when editor destroyed
  editor.on('destroy', () => {
    if (clickHandler) {
      document.removeEventListener('click', clickHandler);
      clickHandler = null;
    }
  });
}

// ❌ Bad - Handler never removed
document.addEventListener('click', (e) => {
  // Handle click
});
````

**Checklist:**

- [ ] Store handler reference
- [ ] Remove in `editor.on('destroy')` or `webviewPanel.onDidDispose()`
- [ ] Test: Open/close editor 10 times, check for listener accumulation
````

---

#### 4.2.2 Update `common-pitfalls.md` Sync Section

**Replace Boolean Flag with Hash-Based Pattern:**

```markdown
## 1. Feedback Loops in Document Sync

**Problem:** Update from extension → triggers webview update → triggers extension update → infinite loop

**Solution (Webview Side):**
```typescript
// ✅ Good - Hash-based content deduplication
let lastSentContentHash: string | null = null;
let lastSentTimestamp: number = 0;

function debouncedUpdate(markdown: string) {
  const contentHash = hashString(markdown);
  
  // Skip if content unchanged
  if (contentHash === lastSentContentHash) {
    return;
  }
  
  // Skip if sent very recently (< 100ms) to avoid feedback loops
  const timeSinceLastSend = Date.now() - lastSentTimestamp;
  if (timeSinceLastSend < 100) {
    return;
  }
  
  lastSentContentHash = contentHash;
  lastSentTimestamp = Date.now();
  
  vscode.postMessage({ type: 'edit', content: markdown });
}

// ❌ Bad - Boolean flag can miss rapid updates
let ignoreNextUpdate = false;  // Don't use this pattern
````


**Solution (Extension Side):**

- Use content comparison: `if (currentContent === lastSentContent) return;`
- Track timestamps: `if (Date.now() - lastEditTime < 100) return;`

**See:** `[Project Root]/docs/ARCHITECTURE.md#document-synchronization`

````

---

#### 4.2.4 Add Error Handling Section

**Add to `coding-standards.md`:**

```markdown
## Error Handling Requirements

**Rule:** All async operations and critical operations must have error handling

**Pattern for Critical Operations:**
```typescript
// ✅ Good - User-facing errors for critical operations
private async applyEdit(content: string, document: vscode.TextDocument): Promise<boolean> {
  try {
    const edit = new vscode.WorkspaceEdit();
    edit.replace(document.uri, fullRange, content);
    const success = await vscode.workspace.applyEdit(edit);
    
    if (!success) {
      vscode.window.showErrorMessage(
        'Failed to save changes. The file may be read-only or locked.'
      );
      console.error('[MD4H] applyEdit failed:', { uri: document.uri.toString() });
    }
    return success;
  } catch (error) {
    const message = error instanceof Error 
      ? `Failed to save: ${error.message}`
      : 'Failed to save: Unknown error';
    vscode.window.showErrorMessage(message);
    console.error('[MD4H] applyEdit exception:', error);
    return false;
  }
}
````

**Checklist:**

- [ ] All `async` functions have try/catch
- [ ] Critical operations (save, applyEdit) show user-facing errors
- [ ] Non-critical errors are logged only
- [ ] Error messages are user-friendly (no stack traces)
````

---

### 4.3 Strengthen Self-Review Checklist

#### 4.3.1 Make Checklist More Specific

**Current (AGENTS.md:118-126):**
- [ ] Code quality - TypeScript strict, meaningful names, no `any`
- [ ] Clean code - No console.log, debugging code

**Improved:**
- [ ] **TypeScript:** No `any` types (run `bun run type-check`, must pass)
- [ ] **Logging:** Use `console.log()` for development (automatically removed in production builds), `console.error()` for errors (always kept)
- [ ] **Listeners:** All `addEventListener()` have matching `removeEventListener()` in cleanup
- [ ] **Error handling:** All `async` functions have try/catch, critical operations show user errors
- [ ] **Deprecated APIs:** No `.substr()`, `.substring()` or `.slice()` used instead
- [ ] **Sync logic:** Uses content hash comparison, not boolean flags
- [ ] **Tests:** All new code has tests, `bun run test` passes

**Impact:** More actionable, verifiable items
**Risk:** Low
**Estimated Time:** 30 minutes to update

---

#### 4.3.2 Add Verification Steps

**Add to Checklist:**
- [ ] **Run `bun run type-check`** - Must pass with 0 errors
- [ ] **Run `bun run lint`** - Must pass with 0 errors
- [ ] **Run `bun run test`** - All tests pass
- [ ] **Check for listeners:** `grep -r "addEventListener" src/` → verify matching `removeEventListener`

**Impact:** Makes checklist verifiable
**Risk:** Low
**Estimated Time:** 15 minutes to add

---

### 4.4 Add Missing Coverage

#### 4.4.1 Add Deprecated APIs Section

**Add to `coding-standards.md`:**

```markdown
## Deprecated APIs

**Rule:** Never use deprecated JavaScript/TypeScript APIs

**Common Deprecated APIs:**
- ❌ `.substr()` → ✅ `.substring()` or `.slice()`
- ❌ `document.createEvent()` → ✅ `new Event()`
- ❌ `Array.findIndex()` with polyfill → ✅ Native (ES2015+)

**How to Check:**
- TypeScript compiler warnings
- ESLint rule: `no-restricted-syntax`
- MDN documentation (shows deprecation status)

**Before Using Any API:**
1. Check MDN for deprecation status
2. Use modern alternative
3. Document if polyfill needed for compatibility
````


---

#### 4.4.2 Add Type Safety Patterns

**Add to `coding-standards.md`:**

````markdown
## Type Safety Patterns

### Window Global Properties

**Pattern:**
```typescript
// ✅ Good - Typed interface
interface WindowWithMD4H extends Window {
  vscode?: {
    postMessage: (message: unknown) => void;
  };
  resolveImagePath?: (path: string) => Promise<string>;
}

(window as WindowWithMD4H).vscode = vscode;
````

### ProseMirror Internals

**When `any` is Unavoidable:**

```typescript
// ✅ Good - Document why, use type guard
// ProseMirror internals are complex, use duck-typing fallback
function isGapCursor(selection: unknown): selection is GapCursor {
  if (selection instanceof GapCursor) return true;
  const sel = selection as any;  // eslint-disable-line @typescript-eslint/no-explicit-any
  return sel?.type === 'gapcursor';
  // Reason: instanceof fails in test environment due to module bundling
}
```

**Rule:** If `any` is necessary, add `eslint-disable` comment with reason

````

---

#### 4.4.3 Add Memory Leak Testing

**Add to `testing.md`:**

```markdown
## Memory Leak Testing

**Pattern:** Test that listeners are cleaned up

```typescript
describe('Listener Cleanup', () => {
  it('removes event listeners on destroy', () => {
    const addSpy = jest.spyOn(document, 'addEventListener');
    const removeSpy = jest.spyOn(document, 'removeEventListener');
    
    const editor = createEditor();
    editor.destroy();
    
    expect(removeSpy).toHaveBeenCalledTimes(addSpy.callCount);
  });
});
````

**Manual Test:**

1. Open DevTools Performance monitor
2. Open/close editor 10 times
3. Check for listener count growth
4. Should remain stable, not grow
````

---

### 4.5 Add Quality Gates

#### 4.5.1 Pre-Commit Validation

**Create `.husky/pre-commit`:**
```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run on changed files only
bun run lint-staged
bun run type-check
````


**Create `lint-staged.config.js`:**

```javascript
module.exports = {
  '*.ts': [
    'eslint --fix',
    'prettier --write',
  ],
  '*.{ts,tsx}': () => 'bun run type-check',
};
```

**Impact:** Blocks commits with violations

**Risk:** Medium - Could slow development

**Mitigation:** Allow `--no-verify` for emergencies (document when to use)

---

#### 4.5.2 CI/CD Quality Checks

**Add to GitHub Actions:**

```yaml
- name: Type Check
  run: bun run type-check

- name: Lint
  run: bun run lint

- name: Test
  run: bun run test

- name: Check for any types
  run: |
    ANY_COUNT=$(grep -r "\\bany\\b" src/ | wc -l)
    if [ $ANY_COUNT -gt 20 ]; then
      echo "Too many 'any' types: $ANY_COUNT (max 20)"
      exit 1
    fi

```

**Impact:** Catches violations in CI

**Risk:** Low - Only blocks PRs, not local development

**Estimated Time:** 1 hour

---

### 4.6 Update AGENTS.md

#### 4.6.1 Add Enforcement Section

**Add to AGENTS.md after "Critical Constraints":**

```markdown
### 6. Code Quality Enforcement (MANDATORY)

**Automated Checks:**
- ✅ TypeScript strict mode enabled
- ✅ ESLint rules block `any` types
- ✅ Build-time removal of `console.log/debug/info` (esbuild `pure` option)
- ✅ Pre-commit hook runs checks
- ✅ CI/CD validates quality gates

**Manual Checks (Self-Review):**
- [ ] Run `bun run type-check` - Must pass
- [ ] Run `bun run lint` - Must pass  
- [ ] Run `bun run test` - All tests pass
- [ ] Verify no listener leaks (grep addEventListener → check removeEventListener)

**If checks fail:**
- ⚠️ **STOP** - Do not commit
- 🔍 **Fix violations** - Don't bypass with `--no-verify` unless emergency
- 📝 **Document exceptions** - If `any` needed, add eslint-disable with reason
```

---

#### 4.6.2 Strengthen Self-Review Checklist

**Update AGENTS.md:118-126:**

```markdown
**Self-Review (Before Shipping) - ALL ITEMS MANDATORY:**
- [ ] **TypeScript:** Run `bun run type-check` - 0 errors, <20 `any` types (document remaining)
- [ ] **Logging:** Use `console.log()` for development (removed in production), `console.error()` for errors (always kept)
- [ ] **Listeners:** Run `grep -r "addEventListener" src/` - Verify matching `removeEventListener` in cleanup
- [ ] **Error handling:** All `async` functions have try/catch, critical ops show user errors
- [ ] **Deprecated APIs:** No `.substr()`, check MDN for deprecation status
- [ ] **Sync logic:** Uses content hash, not boolean flags
- [ ] **Tests:** `bun run test` passes, new code has tests
- [ ] **Documentation:** JSDoc updated, file headers current, inline WHY comments
- [ ] **Diff review:** Does this make sense to future you in 6 months?
- [ ] **Manual read:** Read a 3000+ word doc for 10+ minutes (light/dark)
```

**Impact:** Makes checklist verifiable and mandatory

**Risk:** Low

**Estimated Time:** 30 minutes

---

## Part 5: Implementation Plan

### Phase 1: Quick Wins (Week 1) - Enforcement

**Goal:** Add automated checks to catch violations

1. ✅ Add ESLint rules (30 min)
2. ✅ Add pre-commit hook (1 hour)
3. ✅ Add CI/CD checks (1 hour)
4. ✅ Update AGENTS.md with enforcement section (30 min)

**Total:** ~3 hours

**Impact:** High - Prevents future violations

**Risk:** Low

---

### Phase 2: Pattern Documentation (Week 2)

**Goal:** Add specific, actionable patterns

1. ✅ Update `common-pitfalls.md` with listener cleanup pattern (1 hour)
2. ✅ Update `common-pitfalls.md` sync section with hash-based pattern (1 hour)
3. ✅ Add error handling section to `coding-standards.md` (1 hour)
4. ✅ Add deprecated APIs section (30 min)
5. ✅ Add type safety patterns (1 hour)

**Total:** ~4.5 hours

**Impact:** High - Provides actionable guidance

**Risk:** Low

---

### Phase 3: Strengthen Checklists (Week 2)

**Goal:** Make checklists verifiable and mandatory

1. ✅ Update self-review checklist in AGENTS.md (30 min)
2. ✅ Add verification commands to checklist (15 min)
3. ✅ Add quality gates section to AGENTS.md (30 min)

**Total:** ~1.25 hours

**Impact:** Medium - Makes checklist actionable

**Risk:** Low

---

## Part 6: Success Metrics

### Before (Current State)

| Metric | Value |

|--------|-------|

| TypeScript `any` types | 125 |

| Console.log statements | ✅ Resolved (build-time removal) |

| Known memory leaks | 5+ |

| Deprecated APIs | 6 |

| Automated enforcement | 0 checks |

| Pattern examples | Limited |

### After (Target State)

| Metric | Target |

|--------|--------|

| TypeScript `any` types | <20 (documented) |

| Console.log statements | ✅ Handled by build (removed in production) |

| Known memory leaks | 0 |

| Deprecated APIs | 0 |

| Automated enforcement | ESLint + pre-commit + CI |

| Pattern examples | Complete coverage |

### Enforcement Metrics

| Check | Status |

|-------|--------|

| ESLint blocks `any` | ✅ Enabled |

| Build-time console.log removal | ✅ Enabled (esbuild `pure` option) |

| ESLint blocks deprecated APIs | ✅ Enabled |

| Pre-commit hook runs checks | ✅ Enabled |

| CI/CD validates quality | ✅ Enabled |

| TypeScript strict mode | ✅ Enabled |

---

## Part 7: Risk Assessment

### Low Risk Changes

- Adding ESLint rules (linting only)
- Adding pattern examples (documentation)
- Updating checklists (guidance only)
- Adding CI/CD checks (blocks PRs, not local dev)

### Medium Risk Changes

- Pre-commit hooks (could slow development)
  - **Mitigation:** Allow `--no-verify` for emergencies, document when to use
- TypeScript strict mode (may require fixing existing code)
  - **Mitigation:** Enable incrementally, fix violations in phases

### High Risk Changes

- None identified - all changes are additive or improve existing guidance

---

## Part 8: Rollout Strategy

### Step 1: Add Enforcement (Non-Breaking)

1. Add ESLint rules (warnings first, then errors)
2. Add pre-commit hook (warnings first)
3. Test with existing codebase
4. Fix violations incrementally

### Step 2: Update Documentation

1. Add patterns to coding guides
2. Update AGENTS.md
3. Review with team (if applicable)
4. Document exceptions/edge cases

### Step 3: Gradual Strictening

1. Week 1: Warnings only
2. Week 2: Errors for new code
3. Week 3: Errors for all code (after fixing violations)

---

## Part 9: Why This Will Work

### 1. Automated Enforcement

**Before:** Guidelines are optional

**After:** Violations block commits/PRs

**Impact:** Can't ignore rules

### 2. Specific Patterns

**Before:** "Clear listeners" (vague)

**After:** Code examples with TipTap `on('destroy')` pattern

**Impact:** Easy to follow

### 3. Verifiable Checklist

**Before:** "No `any`" (subjective)

**After:** "Run `bun run type-check`, must pass"

**Impact:** Can verify compliance

### 4. Complete Coverage

**Before:** Missing deprecated APIs, hash-based sync

**After:** All common issues covered

**Impact:** No blind spots

### 5. Quality Gates

**Before:** Can commit anything

**After:** Must pass checks

**Impact:** Prevents debt accumulation

---

## Part 10: Long-Term Maintenance

### 10.1 Regular Audits

**Schedule:** Quarterly audit of codebase vs. guidelines

**Process:**

1. Run automated checks
2. Review violations
3. Update guidelines if patterns change
4. Document new anti-patterns

### 10.2 Guideline Evolution

**When to Update:**

- New patterns discovered
- New pitfalls found
- Technology changes (e.g., new ProseMirror API)
- Team feedback

**Process:**

1. Document new pattern/issue
2. Add to appropriate guide
3. Update AGENTS.md if needed
4. Update enforcement if applicable

---

## Conclusion

**Root Causes Identified:**

1. ✅ Guidelines exist but aren't enforced
2. ✅ Guidance is vague, lacks patterns
3. ✅ Checklists are optional
4. ✅ Missing coverage (deprecated APIs, etc.)
5. ✅ No quality gates

**Solutions Proposed:**

1. ✅ Automated enforcement (ESLint, pre-commit, CI)
2. ✅ Specific patterns with code examples
3. ✅ Verifiable checklist items
4. ✅ Complete coverage of common issues
5. ✅ Quality gates that block violations

**Expected Outcome:**

- Guidelines become enforceable, not optional
- Patterns are clear and actionable
- Quality debt prevented, not just documented
- "Vibe coding" blocked by automated checks

**Timeline:** 2-3 weeks to implement all improvements