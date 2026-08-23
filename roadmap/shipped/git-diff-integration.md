# Changelog: Git Diff Integration

**Spec:** `../specs/git-diff-integration.md`

---

## 2025-11-28 – Simple Git integration fix (MVP)

- Confirmed custom editor only applies to `file` scheme URIs so Git diff views continue to use the built-in text diff.
- Verified TextDocument remains the single source of truth and syncs correctly between webview and file.
- Added SCM context menu entry for opening markdown files in Speckit for Humans.
- See detailed task log:
  - `./task-git-diff-integration.md`

---

## 2025-11-28 – Rich Git Diff (Rich Text Comparison) design

- Captured product-level spec for rich text diffing in `specs/git-diff-integration/task-git-diff-rich-text-comparison.md`.
- Captured technical implementation spec in `specs/git-diff-integration/git-diff-rich-text-technical-spec.md`.
- Defined Rich Diff as an optional webview-based comparison view that complements (but does not replace) the built-in text diff.

---

## 2025-11-29 – Spec consolidation

- Created canonical feature spec at `specs/git-diff-integration.md` combining the simple fix and rich diff plans.
