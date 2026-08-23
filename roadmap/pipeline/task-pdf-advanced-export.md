# Task: Advanced PDF Export (Puppeteer Engine)

---

## 1. Task Metadata

- **Task name:** Advanced PDF Export (Puppeteer Engine)
- **Slug:** `pdf-advanced-export`
- **Status:** `planned`
- **Created:** 2025-12-09
- **Last updated:** 2025-12-09
- **Shipped:** *(not yet shipped)*

---

## 2. Context & Problem

- **Problem:** Current PDF export uses system Chrome/Edge via CLI. This is great for basic WYSIWYG export but limited for **advanced layout needs**:
  - Custom headers/footers with page numbers, titles, and dates.
  - Per-export page size/margins beyond a small set of CSS-based presets.
  - Potential future features like export presets ("Manuscript", "Handout") and richer document metadata.
- **Current state:**
  - Basic export is implemented via Chrome CLI in `src/features/documentExport.ts` and is being polished in `task-user-chrome-path.md` (image embedding, basic options, theme handling).
  - The extension no longer bundles Chromium (`@sparticuz/chromium`, `puppeteer-core`) to keep bundle size small.
- **Why it matters:**
  - Some users (e.g. technical writers, teams generating PDFs for external stakeholders) will eventually need **book-like control** over page layout and decorations.
  - We want a path to these features that is **opt-in**, without forcing heavy dependencies on everyone.

---

## 3. Desired Outcome & Scope

- **Success criteria:**
  - Users can opt into an **advanced PDF engine** based on `puppeteer-core` while keeping the default lightweight Chrome-CLI engine.
  - Advanced engine reuses the **same HTML + CSS** pipeline as the basic export to avoid divergence.
  - Advanced engine unlocks at least:
    - Custom headers and footers with page numbers.
    - More flexible margins and page sizes per export.
  - The `speckitForHumans.chromePath` integration from `task-user-chrome-path` is reused for Puppeteer `executablePath`.
  - The feature is clearly documented as **optional** and does not regress basic export.

- **In scope:**
  - Adding a configurable "PDF engine" switch.
  - Wiring `puppeteer-core` into the existing export flow for advanced mode.
  - Basic header/footer templates and per-export layout options using Puppeteer’s `page.pdf()` API.
  - Documentation and high-level tests.

- **Out of scope (for this task):**
  - Complex template system or fully custom per-project layouts.
  - PDF/A compliance and accessibility tagging.
  - Frontmatter-driven template variables (can be a follow-up to frontmatter work).

---

## 4. UX & Behavior

- **Entry points:**
  - Same as today: PDF export button in editor toolbar → Export menu → PDF option.
  - Additional behavior controlled via VS Code settings.

- **Engine selection behavior:**
  - New setting: `speckitForHumans.pdf.engine`
    - Values: `"chromeCli"` (default), `"puppeteer"`.
  - When `"chromeCli"` is selected:
    - Behavior is exactly the same as defined in `task-user-chrome-path.md` and `task-document-export.md`.
  - When `"puppeteer"` is selected:
    - Export still goes through `exportDocument('pdf', ...)`, but internally calls a Puppeteer-backed function instead of the Chrome-CLI function.

- **Advanced export behavior (Puppeteer engine):**
  1. User clicks "Export as PDF".
  2. Flow to ensure `chromePath` is valid is reused from `user-chrome-path` (no new prompts).
  3. Puppeteer launches with `executablePath = chromePath`.
  4. HTML/CSS from `buildExportHTML()` is loaded into a page.
  5. `page.pdf()` is called with options derived from settings, including:
     - `format` / `width` / `height`
     - `margin`
     - `displayHeaderFooter`, `headerTemplate`, `footerTemplate`
     - `printBackground`
  6. On success, the same success toast is shown as basic export.

---

## 5. Technical Plan

- **Surfaces:**
  - Extension side only (Node.js) – all logic in `src/features/documentExport.ts`.
  - No webview changes required; webview just sends HTML + meta as today.

- **Key changes:**
  - `package.json`
    - Add `speckitForHumans.pdf.engine` setting (enum-like string):
      - Default: `"chromeCli"`.
      - Alternate: `"puppeteer"`.
    - Add markdown description explaining trade-offs and that this is an **advanced**, optional feature.
  - `src/features/documentExport.ts`
    - Introduce an internal `enum` or string union for PDF engine: `'chromeCli' | 'puppeteer'`.
    - In `exportToPDF(...)`, read the engine setting once and dispatch to:
      - `exportToPDFWithChromeCli(...)` (existing logic, possibly slightly renamed), or
      - `exportToPDFWithPuppeteer(...)` (new).
    - Implement `exportToPDFWithPuppeteer(...)`:
      - `import('puppeteer-core')` lazily (only when needed).
      - Use `executablePath` from the already-validated `chromePath`.
      - Reuse `buildExportHTML()` output as the page content.
      - Map our settings (`pageSize`, `margins`, header/footer toggles) to `page.pdf()` options.
    - Ensure both paths share as much code as possible around:
      - Temporary HTML file generation (if still needed) **or** direct `page.setContent` usage.
      - Error handling and progress reporting.

- **Architecture notes:**
  - `puppeteer-core` should be added as a **runtime dependency** but used only when the advanced engine is enabled.
  - There should be clear guards and helpful error messages if Puppeteer fails to launch with the user’s `chromePath`.
  - Tests should stub Puppeteer to avoid launching a real browser in CI.

---

## 6. Work Breakdown

| Status | Priority | Task | Notes |
|--------|----------|------|-------|
| `planned` | P0 | Add `speckitForHumans.pdf.engine` setting | Default to `"chromeCli"`, document options and trade-offs. |
| `planned` | P1 | Refactor `exportToPDF()` to support engine dispatch | Keep Chrome-CLI as the default path; introduce `exportToPDFWithChromeCli` helper. |
| `planned` | P1 | Implement `exportToPDFWithPuppeteer()` | Lazy-load `puppeteer-core`, reuse `buildExportHTML()`, wire to `page.pdf()`. |
| `planned` | P1 | Add header/footer support via Puppeteer | Minimal templates for page numbers and document title, configurable via simple settings. |
| `planned` | P1 | Add tests for engine selection & error handling | Mock Puppeteer, verify correct dispatch and error messages. |
| `planned` | P2 | Extend advanced layout options | Optional settings for more granular margins, custom footer text, etc. |
| `planned` | P2 | Documentation updates | Explain when and why to use the advanced engine, with examples. |

---

## 7. How to Verify

1. **Engine selection:**
   - Set `speckitForHumans.pdf.engine` to `"chromeCli"`.
   - Trigger PDF export and confirm behavior matches current implementation.
   - Set it to `"puppeteer"` and confirm advanced path is taken (e.g., via logs or header/footer output).

2. **Header/footer output (Puppeteer engine):
   - Enable headers/footers in settings.
   - Export a multi-page document.
   - Verify page numbers and title appear as expected on each page.

3. **Error handling:**
   - Set an invalid `chromePath` and engine = `"puppeteer"`.
   - Confirm a clear, actionable error is shown (not a generic stack trace).

4. **Performance:**
   - Ensure that with engine = `"chromeCli"`, there is **no additional startup cost** from Puppeteer.
   - With engine = `"puppeteer"`, confirm export is still reasonably fast for typical documents.

---

## 8. Implementation Log

*(Empty for now – to be filled in when this task is actually implemented.)*
