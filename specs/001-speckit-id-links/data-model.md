# Phase 1 Data Model: Spec Kit ID Links

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

Nothing here is persisted. Every structure lives in memory — the index on the extension host, the decoration set in the webview — and is rebuilt from markdown text. The feature writes no file, no database, and no cache on disk.

---

## Entity overview

```
FeatureScope ─────┬──&gt; Artifact ──&gt; DefinitionSite ──&gt; NavigationTarget
                  │                       ▲
                  └──&gt; DefinitionIndex ───┘
                              ▲
                              │ resolves
IdToken ──&gt; IdFamily          │
   │                          │
   └──&gt; Resolution ───────────┘
              │
              └──&gt; Decoration        (webview only, view-only)
```

---

## IdFamily

The closed vocabulary. Nineteen entries. Static data, not derived at runtime.

| Field | Type | Notes |
|---|---|---|
| `prefix` | string | `FR`, `SC`, `T`, `US`, `C`, `R`, `Q`, `AS`, `BR`, `AD`, `OQ`, `A`, `D`, `P` |
| `pattern` | RegExp | anchored, case-sensitive |
| `bodyPattern` | RegExp | the identifier part alone — used to validate abbreviated members of a compressed reference against the head's shape |
| `hyphenated` | boolean | the sole discriminator between `R-###`/`R#` and `C-#`/`C#`, which are **different IDs in different files** |
| `owningArtifacts` | string[] | ordered search list, not a single owner |
| `definitionKinds` | DefinitionKind[] | which of the six syntaxes can declare this family |

**Validation rules**

- `prefix` MUST be a member of the closed set (FR-001, FR-001a, FR-001b). Adding one is a deliberate spec change, never an inference.
- Prefix matching MUST be greedy: `TS7016` yields `TS`, `PGRST116` yields `PGRST`.
- No single-letter family beyond `C`, `R`, `Q`, `A`, `D`, `T`, `P` may exist (FR-001c).
- `P` MUST NOT accept a digits-only body. `P-` requires a hyphen then an uppercase letter — this is the whole of the priority-marker collision fix (R-022).
- `owningArtifacts` is a **search order**. `Q` is defined in `briefs/` but referenced from `research.md`; `P-APP-DIR` is defined in both `briefs/` and a feature's `research.md`.

**Body shapes that must not be loosened or tightened** (each was measured; getting one wrong drops real references):

| Family | Body | Consequence of the obvious wrong guess |
|---|---|---|
| `FR-###` | exactly 3 digits, optional `a`–`f` | — |
| `FR-<L>##` | letter, then exactly 2 digits | 2-vs-3 digits is the *only* thing keeping `FR-T01–T03` from colliding with task IDs |
| `T###` | exactly 3 digits, optional **`a`–`l`** | `[a-f]` drops 20+ references (`T019a`…`T019l` is real) |
| `R-###` | **1 to 3** digits | `R-\d{3}` drops all 27 `R-1`…`R-11` references |
| `US#` | exactly 1 digit, optional `-#` sub-ID | no `US10+` exists |
| `C-<ns>-#` | one or more kebab/camelCase segments, then 1–3 digits | multi-segment is real (`C-git-write-2`) |
| `P-<CAPS>` | uppercase kebab, **no digits at all** | a trailing-digit requirement drops the entire family |

---

## IdToken

One recognized occurrence in a document's text.

| Field | Type | Notes |
|---|---|---|
| `id` | string | the canonical ID, e.g. `FR-001`, `T042`, `US2`, `P-APP-DIR` |
| `family` | IdFamily | — |
| `from`, `to` | number | ProseMirror positions in the **containing** document |
| `origin` | `'anchored' \| 'expanded'` | `expanded` means it came from a compressed reference's abbreviated tail |
| `featureQualifier` | string \| null | a three-digit feature number when the reference was cross-feature (R-025) |

**Validation rules**

- Both boundary predicates MUST hold at match time, not as a post-filter (R-023).
- An `expanded` token MUST have been seeded from a confirmed anchored token in the same chain. A bare `010` never links alone.
- An `expanded` token's tail MUST validate against the **head's** `bodyPattern`, never the union of all patterns — this is what makes `FR-A01–A05` yield `FR-A05` rather than `A05` or `FR-005`.
- `featureQualifier` MUST name an existing sibling feature directory. It **retargets** a token and never creates one.
- A token inside inline code, a fenced or indented code block, an existing link's label or href, an autolink, image alt text, or a bare URL MUST NOT exist at all — excluded at the AST before scanning (FR-005, FR-006, R-026 stage 0).

**State**

```
candidate ──(pattern + boundaries)──&gt; token ──(index lookup)──&gt; resolved
     │                                  │                          │
     └─&gt; discarded                      └─&gt; unresolved             └─&gt; decorated
         (resume at start+1)                (plain prose, FR-010)       (unless self-ref, FR-014)
```

Resume offset is part of the model, not an implementation detail: **rejection resumes at `start + 1`**, acceptance resumes at `end`. The first prevents a real ID hiding inside a rejected span (`versionFR-001`); the second is what makes maximal munch protect compound interiors so `CORE` in `C-CORE-3` is never a candidate.

---

## DefinitionSite

Where an ID is declared. Extracted host-side by line-scanning raw markdown.

| Field | Type | Notes |
|---|---|---|
| `id` | string | for `userStoryHeading`, synthesized as `US<n>` — the token appears nowhere in the text |
| `fsPath` | string | absolute path of the owning artifact |
| `line` | number | 0-based, **raw file coordinates** |
| `kind` | DefinitionKind | one of six |
| `headingText` | string? | present for heading kinds, for the text-anchored reveal |

**`line` is host-side only.** It MUST NOT be sent to the webview as a navigation instruction. Content is rewritten twice on its way in — `applyBlankLinePolicy` in `strip` mode collapses blank runs, `wrapFrontmatterForWebview` inserts two lines — so measured against the corpus, **~6.5% of files (7 of 503 with collapsed blanks, 26 with frontmatter) would carry a silently wrong line number**. `line` is for definition ordering and for the plain-text-editor fallback, where raw coordinates are correct by construction.

### DefinitionKind — six syntaxes

| Kind | Shape | Trap |
|---|---|---|
| `bullet` | `- **FR-001**: …` | **the trailing colon is optional** — `- **BR-1** HTTP and HTTPS MUST…` |
| `checkboxBare` | `- [x] T027 [P] [US1] …` | ID is not bolded; the trailing `[P]` is a parallel marker, not a priority |
| `checkboxBold` | `- [ ] **US8-1**: …` | a distinct form, not a variant of the above |
| `heading` | `## R-001: …` / `## R2. …` / `## C1 — …` / `## D1 — …` | separator is `:`, `.`, `—`, or nothing |
| `tableRow` | `\| R-001 \| … \|` | ID may be bare, backticked, **or** bolded — matching only bare loses the whole `P-` family |
| `paragraphBold` | `**AD-4 — …**` / `**AD-5** When…` / `**AD-6 (BR-17)** All…` | opens a paragraph, not a list item. Missing this caps `AD-#` resolution at 50% and `OQ-#` at 71% |

**Validation rules**

- All six MUST tolerate leading indentation — `AS#` definitions are nested bullets.
- Fenced code MUST be skipped during **extraction** as well as recognition (FR-005), or a documentation example becomes a phantom target. Reuse the existing fence state machine at `src/shared/blankLinePolicy.ts:3-9`; do not write a second one.
- A `userStoryHeading` site is derived from `### User Story <n> - <title> (Priority: P<n>)`. The `(Priority: P<n>)` fragment is a definition ornament, never a token.

---

## FeatureScope

Resolved per document, from its path alone.

| Field | Type | Notes |
|---|---|---|
| `featureRoot` | string \| null | nearest ancestor whose basename matches `/^\d{3}-/` |
| `specsRoot` | string \| null | parent of `featureRoot` |
| `artifacts` | string[] | every `.md` under `featureRoot`, recursively |
| `briefsDir` | string \| null | `<specsRoot>/briefs` when present |

**Validation rules**

- Identified by the **numbered folder name, never by the presence of `spec.md`**. Three of 45 real feature folders have no `spec.md`, and one of them still defines `US8-1`.
- Recursion into subfolders is required, not optional: `FR-EX-###` lives in a sidecar, `C-*` lives in `contracts/`.
- `document.uri.scheme !== 'file'` → `featureRoot` is null → nothing links (FR-019).
- No matching ancestor → null → nothing links (FR-019).
- `.specify/feature.json` MUST NOT be used for discovery. It records one active feature, so it would mis-resolve 44 of 45 folders, and it is absent in non-spec-kit workspaces.
- Every path MUST pass a containment check against `featureRoot` ∪ `specsRoot` before being read, so a hostile cross-feature qualifier cannot escape. `getAllowedFileRoots` is the **wrong** gate — `briefs/` can legitimately sit outside the workspace.

---

## DefinitionIndex

Host-side, one per feature root, shared across every panel in that folder.

| Field | Type | Notes |
|---|---|---|
| `revision` | number | monotonic; the webview ignores a stale or duplicate revision |
| `files` | Map&lt;fsPath, DefinitionSite[]&gt; | invalidated one file at a time |
| `byId` | Map&lt;id, DefinitionSite[]&gt; | derived lookup |

**Validation rules**

- Owned by the single provider instance, **not** the per-panel closure — two documents in one feature folder must share one index.
- Duplicate ID **within one artifact** → first definition wins.
- Duplicate ID **across two artifacts** → the feature-folder definition wins over `briefs/`; local scope is authoritative.
- An unqualified token MUST NEVER fall through to another feature (FR-018). Cross-feature search is not a fallback anywhere.
- Dropped when the feature root's last panel disposes.
- The webview MUST treat "no index yet" and "revision went backwards" as *link nothing*, never as continuity — a webview can be reloaded even with `retainContextWhenHidden`.

**Freshness — both mechanisms, they cover disjoint cases**

| Mechanism | Covers | Misses |
|---|---|---|
| one global `onDidChangeTextDocument` | dirty edits in any open document | files nobody has open |
| `FileSystemWatcher` on `featureRoot` and `briefsDir` | disk changes, including by external tools | unsaved buffers |

Neither alone satisfies the spec. A disk-only index fails User Story 5's own acceptance scenario, because editing `spec.md` leaves a dirty buffer and disk stays stale. An events-only index breaks on `git checkout` and on first open. `onDidSaveTextDocument` adds nothing either misses — omit it.

The existing per-panel `onDidChangeTextDocument` is filtered to its own document and **cannot** be reused; N panels would mean N listeners each blind to the others. Follow the unfiltered workspace-wide listener in `src/features/wordCount.ts:112` instead.

**Cost, measured**: extraction is 3.5ms for the largest real feature folder (14 files, 416KB, 854 definitions) and 45ms for all 508 corpus files. Extraction is not the bottleneck. The costs are file reads and a ~60KB payload per revision. Debounce at 500ms, reusing the existing sync cadence; re-extract only the changed file, which is ~0.3ms steady-state.

---

## Resolution

Transient, computed in the webview per token.

| Field | Type | Notes |
|---|---|---|
| `token` | IdToken | — |
| `site` | DefinitionSite \| null | null → plain prose, no styling, no error (FR-010) |
| `isSelfReference` | boolean | true → stays plain text (FR-014) |

`isSelfReference` is decided **locally** from block shape — the webview already knows whether a token is the first inline content of a list item, heading, table cell, or paragraph. Deciding it locally is what removes the last reason to map raw lines to editor positions.

---

## Decoration

View-only. The reason the feature can exist at all.

| Field | Type | Notes |
|---|---|---|
| `from`, `to` | number | ProseMirror positions |
| `nodeName` | `'a'` | — |
| `class` | `'markdown-link'` | the existing link class; appearance and click dispatch both come free |
| `data-speckit-id` | string | dispatch key for the click branch |

**Validation rules**

- MUST be a `Decoration.inline`, never a mark or node. A mark lives in `state.doc` and would be serialized to the file.
- MUST carry **no `href`**. An unrecognized href shape falls through to the local-file branch, which cannot carry a position, opens the plain text editor, and raises a warning dialog on a miss — three requirement violations at once.
- The decoration plugin MUST NEVER dispatch a doc-changing transaction. This is what makes the refresh loop terminate, and FR-024 requires it regardless.
- MUST be stripped from export output. `collectExportContent` clones the live editor DOM, and the export sanitizer is a denylist that passes `class` through untouched, so an exported PDF would otherwise carry dead `<a>` tags.

---

## Look-alike

Not a runtime structure — a **test-fixture obligation**. Nothing in the code enumerates these; they are all rejected structurally by the closed vocabulary and the boundary predicates. Fixtures must prove it.

| Class | Examples | Rejected by |
|---|---|---|
| Named constants | `HS256`, `AES-256`, `ES2022`, `SHA-256`, `SHA-1`, `DNS-1123`, `DNS-01`, `HTTP-01`, `UTF-8`, `UTF-16`, `RS256`, `VT323`, `PGRST116`, `TS7016`, `ISO-8601`, `X-Kong-Upstream-Latency` | closed vocabulary |
| Unlisted constants | `Route53`, `Auth0`, `Base64`, `PG16`, `WebGL2`, `Qwen3`, `GPT-5`, `Deno-2`, `Tailwind-4`, `A11y`, `IX1`, `K8s`, `S256`, commit hashes | closed vocabulary |
| Priority markers | `(Priority: P1)`, `(P1)`, `P1→P3`, `P1/P2`, `P1–P3`, bare prose `P1` | bare `P<digits>` is never an ID |
| Postgres error | `P0001` | same rule |
| Line references | `file.ts:120-140`, `path#L257`, `~L116-121`, bare `L76` | no family starts with a digit; `#`/`~` left-rejects; `L` out of vocabulary |
| Compound fragments | `CORE`, `UI`, `GUARD`, `VD`, `EX`, the `G` of `FR-G12` | maximal munch, no digits, left-hyphen predicate |
| Filename tails | `T038-login-screen.txt`, `T016-scaffolding`, `T041f-era` | right predicate |
| Placeholders | `XYZ-999`, `DRAFT-4242`, `MARKER-039` | closed vocabulary |
| Vacant ID | a retired `FR-015` | recognized, unresolved, stays plain (FR-010) — not a grammar case |

Measured against the corpus: **0 false positives** across all of these, **12 false negatives (0.064%)**, 109/109 on a 33-accept/76-reject suite.
