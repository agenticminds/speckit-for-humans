# Feature Specification: Spec Kit ID Links

**Feature Branch**: `001-speckit-id-links`

**Created**: 2026-08-20

**Status**: Draft

**Input**: User description: "Make the WYSIWYG markdown editor 'speckit aware'. When the editor sees a navigation token like FR-G12 (or FR-001, etc.) in the document text, it should recognize it as a reference to a functional requirement ID defined in the feature's spec.md, and render that token as a clickable hyperlink (visually, in the WYSIWYG view) that navigates to the matching requirement in spec.md. The raw markdown source should stay plain text (no raw markdown link syntax written into the file) — this is a rendering/navigation affordance layered on top of TipTap/ProseMirror, not a change to the saved markdown."

**Grounding**: Scope was set by a field survey of a real spec-kit corpus (508 files, 45 features, ~18,000 ID references). See [id-conventions-survey.md](./id-conventions-survey.md). Every family, count, and look-alike named below is evidenced there. The survey overturned the original assumption that only `FR-` and `SC-` exist.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Jump from a reference to its definition (Priority: P1)

A person is reading or editing a document inside a spec-kit feature folder. It mentions a requirement, a success criterion, a task, or a user story by ID. Each of those reads as a link, exactly like an ordinary markdown link in this editor. The person activates one and lands on that ID's definition — which may be in a different file. Text that merely *looks* like an ID, such as `AES-256` or `(Priority: P1)`, is left alone.

**Why this priority**: The four families in this slice — `FR-###`, `SC-###`, `T###`, `US#` — carry about 13,000 of the corpus's ~18,000 references. Recognition without rejection is worse than nothing, because ~150 look-alike constants and 367 priority markers would become dead links, so both halves ship together as one viable MVP.

**Independent Test**: Open a feature folder's `plan.md`, `tasks.md`, and `spec.md`. Confirm `FR-`, `SC-`, `T`, and `US` references link to their definitions, and that a fixture paragraph of look-alike constants links nothing.

**Acceptance Scenarios**:

1. **Given** `plan.md` references `FR-001` and the folder's `spec.md` defines it as `- **FR-001**: …`, **When** the person activates the reference, **Then** `spec.md` opens and that bullet is brought into view.
2. **Given** `plan.md` references `T042` and the folder's `tasks.md` defines it as `- [ ] T042 …`, **When** the person activates it, **Then** `tasks.md` opens at that checkbox item.
3. **Given** `tasks.md` references `US2` and `spec.md` contains the heading `### User Story 2 - <title> (Priority: P2)`, **When** the person activates it, **Then** `spec.md` opens at that heading — even though the literal token `US2` appears nowhere in that file.
4. **Given** `spec.md` references `FR-G12` and defines `- **FR-G12**: …`, **When** the person activates it, **Then** the view moves to that bullet in the same file.
5. **Given** a paragraph containing `AES-256`, `HS256`, `ES2022`, `SHA-256`, `DNS-1123`, `PGRST116`, `UTF-8`, and `(Priority: P1)`, **When** the person views it, **Then** none of those become links.
6. **Given** any of the above documents, **When** the person saves, **Then** the bytes on disk are unchanged.

---

### User Story 2 - The remaining ID families (Priority: P2)

The same person works in `contracts/`, `research.md`, `quickstart.md`, and the `briefs/` folder. Contract IDs, research IDs, clarification questions, preconditions, assumptions, and brief-stage IDs all link to their definitions too — including the families whose definitions live in headings or table rows rather than bullets.

**Why this priority**: Roughly 2,000 further references, and the families most likely to be hunted for by hand because they are scattered across many small files. Story 1 is fully usable without this.

**Independent Test**: Open a `contracts/*.md`, a `research.md`, and a `briefs/*.md`. Confirm `C-*`, `R-###`, `R#`, `Q#`, `AS#`, `BR-#`, `AD-#`, `OQ-#`, `A-#`, and `P-APP-DIR`-style IDs resolve.

**Acceptance Scenarios**:

1. **Given** `research.md` defines `## R-001: <title>`, **When** another file references `R-001`, **Then** activating it lands on that heading.
2. **Given** a `research.md` that instead defines `## R2. <title>`, **When** a file references `R2`, **Then** activating it lands on that heading — the unhyphenated spelling resolves as its own family.
3. **Given** a `research.md` table row `| R-029 | … |`, **When** a file references `R-029`, **Then** activating it lands on that row.
4. **Given** `contracts/fs-adapter.contract.md` defines `C-readFile-1`, **When** a file references it, **Then** it resolves — a camelCase middle segment does not break recognition.
5. **Given** a table defining `P-APP-DIR`, **When** a file references `P-APP-DIR`, **Then** it resolves, despite the ID carrying no digits.
6. **Given** `briefs/multibase-ingress.md` defines `BR-4`, **When** a numbered feature folder's document references `BR-4`, **Then** it resolves to the brief, which sits outside every feature folder.

---

### User Story 3 - Compressed references (Priority: P3)

Authors write groups and ranges instead of listing IDs one by one. Every ID named inside such a group is individually linked, not just the first.

**Why this priority**: 132 confirmed occurrences of slash groups and dash ranges. A per-token matcher silently links only the first ID and leaves the rest looking broken, which is a visible correctness bug once Story 1 ships.

**Independent Test**: A document containing `FR-009/010`, `FR-012/013/014`, `SC-004/005`, `FR-017–FR-021`, `C-1…C-12`, and `[US1]`. Confirm every ID named is separately activatable.

**Acceptance Scenarios**:

1. **Given** the text `FR-009/010`, **When** the person views it, **Then** both `FR-009` and `010` are individually activatable and each resolves to its own definition.
2. **Given** the text `FR-017–FR-021`, **When** the person views it, **Then** both endpoints are activatable.
3. **Given** a task line containing the tag `[US1]`, **When** the person activates it, **Then** it resolves to User Story 1, and the surrounding brackets are not part of the link.

---

### User Story 4 - Cross-feature references (Priority: P4)

A document cites an ID belonging to a *different* feature, written as that feature's three-digit number, then a space, then the ID — optionally with a lead word or possessive, as in `spec 014 FR-028` or `026's FR-030`. Activating it crosses into that feature's folder.

**Why this priority**: The narrowest slice and the one that most complicates resolution, since it breaks the one-document-one-feature rule that Stories 1–3 rely on. Low volume, so it ships last among the linking stories.

**Independent Test**: In feature `045`, a `tasks.md` containing `008 FR-P07`, `013 T080`, `019 FR-010`, `spec 014 FR-028`, and `026's FR-030`. Confirm each opens the named feature's artifact, not `045`'s.

**Acceptance Scenarios**:

1. **Given** feature `045`'s `tasks.md` references `008 FR-P07`, **When** the person activates it, **Then** feature `008`'s `spec.md` opens at `FR-P07`.
2. **Given** the same file references a bare `FR-004` that `045`'s own `spec.md` does not define, **When** the person views it, **Then** it stays plain prose — an unqualified reference never silently falls through to another feature.

---

### User Story 5 - References keep up while artifacts are edited (Priority: P5)

A person has several of a feature's documents open. As IDs are added, renamed, or removed in `spec.md`, `tasks.md`, or `research.md`, references in the other open documents change state on their own, with no need to refocus or reopen them.

**Why this priority**: Quality of life during the busiest part of spec work. Every earlier story is fully usable if refreshing only happened on reopen.

**Independent Test**: Open two documents from one feature side by side. Add, rename, and remove an ID in the defining file and confirm the other document's references change state without being touched.

**Acceptance Scenarios**:

1. **Given** `tasks.md` references `FR-010` that `spec.md` does not define, **When** the person adds that definition to `spec.md`, **Then** the reference in `tasks.md` becomes a link without the person switching focus to it.
2. **Given** `tasks.md` references `FR-010` that `spec.md` defines, **When** the person renames the definition to `FR-011`, **Then** the `FR-010` reference reverts to plain prose.

---

### Edge Cases

**Recognition**

- An ID inside an inline code span or a fenced code block — documentation showing `FR-001` as an example — stays plain text.
- An ID the author already wrote as part of a markdown link is left exactly as written.
- An ID in a heading, table cell, list item, blockquote, or bolded run is ordinary text and is treated the same as one in a paragraph.
- An ID followed by punctuation — `see FR-001.` or `(FR-001)` — is recognized, with the punctuation outside the link.
- A revised ID such as `FR-005a`, `SC-003b`, or `T001c` is a distinct ID, not `FR-005` plus a stray letter.
- A three-segment ID such as `FR-EX-001` is one ID, not `FR-EX` plus `001`.
- Case and shape variants that are not real IDs — `fr-001`, `FR001`, a bare `FR-` — are not recognized.
- Correcting a typo inside an auto-linked ID is no harder than editing the text of an ordinary markdown link.

**Rejection**

- `FR-P07` must resolve while the 367 `(Priority: P1)` markers must not, even though a bare `P07` is indistinguishable from `P7` once split off.
- Middle segments of compound IDs — `CORE`, `UI`, `GUARD`, `VD` from `C-CORE-3` and friends — never link on their own; they have zero standalone uses.
- The group letter of a grouped ID — the `G` in `FR-G12` — never links on its own.
- Deliberate placeholders never link: `XYZ-999`, `DRAFT-4242`, `MARKER-039`, and an ID a spec intentionally leaves vacant.
- `file:line-line` spans (482 of them) and bare line references such as `L76` never link.

**Targets**

- An ID defined twice in one artifact (an authoring mistake) links to the first definition.
- The same ID legitimately defined in two different artifacts — once in the feature folder and once in the shared briefs folder — resolves to the feature folder's definition, because local scope is authoritative.
- The occurrence of an ID on its own defining line is the destination, not a reference, so it stays plain text.
- An ID referenced but never defined anywhere reachable stays plain prose, with no error.
- A feature folder missing the artifact that would define a family — no `tasks.md`, no `contracts/` — leaves that family's references plain, with no error.
- A document not yet saved to disk, or outside any feature folder, has nothing to resolve against, so nothing in it links.
- An artifact with several hundred definitions must not make opening or typing in a referencing document feel slower.

## Requirements *(mandatory)*

### Functional Requirements

#### Recognition

- **FR-001**: The visual editor MUST recognize ID tokens belonging to every family evidenced in the survey: `FR-###`, grouped `FR-<letter>##`, three-segment `FR-EX-###`, revision-suffixed `FR-###a`, `SC-###` and its variants, `T###` and `T###a`, `US#`, `US#-#`, namespaced contract IDs `C-<ns>-#` including camelCase and uppercase namespaces, bare `C#` and `C-#`, `R-###`, unhyphenated `R#`, `Q#`, `AS#`, `BR-#`, `AD-#`, `OQ-#`, `A-#`, and digit-free precondition IDs of the `P-<CAPS-KEBAB>` form.
- **FR-001a**: The recognized prefix vocabulary MUST be closed and enumerated. A token whose letter prefix is not a declared family prefix MUST NOT be linked, and the prefix MUST be matched greedily so that `TS7016` yields prefix `TS` rather than `T`, and `PGRST116` yields `PGRST` rather than `P`.
- **FR-001b**: The vocabulary MUST also include `D#`, the research-decision family, defined by headings in `research.md` and cross-referenced from other artifacts. It is the nineteenth family and carries more references than eight of the others combined.
- **FR-001c**: No other single-letter family may be admitted. `L#`, `V#`, `A#`, `S#`, `U#`, `B#`, `E#`, `G#`, `M#`, `I#`, `H#`, `W#`, `N#`, and `TM#` are real conventions in the corpus but MUST stay unrecognized, because admitting the general single-letter form reintroduces two collisions with no shape-level discriminator: `L#` against line references, and `P#` against priority markers.
- **FR-002**: Recognition MUST treat a hyphenated family and its unhyphenated counterpart as separate families that resolve independently, because the corpus spells one concept both ways — `R-001` alongside `R1`, and `C-1` alongside `C1`.
- **FR-003**: Recognition MUST NOT depend on a token ending in digits, because the `P-<CAPS-KEBAB>` family carries none.
- **FR-004**: A group, range, or tag containing several IDs MUST yield one independently activatable link per ID named in it, covering slash groups, en-dash and ellipsis ranges, and bracketed tag forms.
- **FR-005**: ID tokens inside inline code spans and fenced code blocks MUST NOT be linked, and MUST NOT be treated as definitions either. An ID shown as an example inside a fenced block must not become a navigation target.
- **FR-006**: ID tokens the author already wrote as part of a markdown link MUST be left unchanged.

#### Rejection

- **FR-007**: Recognition MUST reject every look-alike class the survey enumerated — cryptographic and hash constants, language and font versions, DNS and HTTP challenge labels, character encodings, database and compiler error codes, `file:line` spans, and bare line references — so that none of them is presented as a link.
- **FR-008**: Recognition MUST reject bare priority markers of the `(Priority: P#)` form while still resolving the `FR-P##` namespace, whose tail is textually identical.
- **FR-009**: Recognition MUST reject the interior segments of a compound ID — a namespace segment, a group letter, or a numeric tail — as standalone tokens.
- **FR-010**: A token matching no definition MUST be presented as ordinary prose, with no link, no distinguishing "broken reference" styling, and no error message, dialog, or other interruption.

#### Definition targets

- **FR-011**: The editor MUST locate definitions written in every syntax the corpus uses: a plain bullet whose first inline element is the bolded ID, a checkbox bullet carrying a bare ID, a checkbox bullet carrying a bolded ID, a heading, a table row, and a bolded ID opening a paragraph. Recognition of these MUST tolerate the variations the corpus actually contains — an optional trailing colon after a bolded ID, any of several separators after the ID including a dash or an opening parenthesis or nothing at all, a table cell whose ID is bare or backticked or bolded, and leading indentation for nested definitions.
- **FR-012**: For the user-story family, whose token has zero literal definition sites anywhere in the corpus, the editor MUST derive the target from the corresponding `### User Story <n> …` heading.
- **FR-013**: Every located definition MUST be reachable as a navigation target. Targets MUST be established when documents are viewed and MUST NOT be written into any file on disk.
- **FR-014**: The occurrence of an ID on its own defining line MUST stay plain text; only references elsewhere become links.

#### Resolution scope

- **FR-015**: A token MUST resolve against the artifact that owns its family within the document's own feature folder — requirements and success criteria and user stories in `spec.md`, tasks in `tasks.md`, research and questions in `research.md`, contracts under `contracts/`, and preconditions, assumptions, and exits where the feature defines them.
- **FR-016**: Brief-stage families MUST resolve into the shared `briefs/` folder, which sits outside every feature folder, because that is where their definitions live and they are cited from inside feature folders.
- **FR-017**: A reference qualified with another feature's number MUST resolve into that feature's folder.
- **FR-018**: An unqualified reference MUST NEVER fall through to another feature's folder. If the document's own feature does not define it, it stays plain prose.
- **FR-019**: A document not inside a recognizable feature folder, including one not yet saved to disk, MUST have all of its ID tokens left as plain text, however many spec-kit folders exist elsewhere in the workspace.

#### Presentation and navigation

- **FR-020**: A resolvable token MUST be presented using the editor's existing link appearance — the same treatment an author-written markdown link receives — not a style invented for this feature.
- **FR-021**: A link MUST be activated by the same gesture that already activates an ordinary markdown link in this editor. No new, extra, or different gesture may be introduced.
- **FR-022**: Activating a link MUST show the artifact that defines the ID and bring the definition into view, opening that artifact first if it is not already open.
- **FR-023**: The source (plain markdown) view MUST be unaffected, showing exactly the text stored in the file.

#### Integrity

- **FR-024**: The feature MUST NOT alter saved markdown at either end. A referencing token stays plain text on disk, and no defining artifact gains anchors or markup. Only on-screen presentation changes.

#### Liveness

- **FR-025**: When definitions are added, renamed, or removed in any defining artifact, every other open document that resolves against it MUST update its links to match, without the person refocusing, closing, or reopening those documents.

### Key Entities

- **ID Token**: An occurrence in a document's text of a recognized family's identifier. Either resolvable or unresolvable.
- **ID Family**: One recognized naming scheme — its token shape, the artifact that owns its definitions, and the syntax those definitions are written in. Eighteen families are in scope.
- **Definition Site**: The place in an artifact that declares an ID. Written as a plain bullet, a checkbox bullet, a heading, or a table row — or, for user stories, implied by a heading that never names the token.
- **Navigation Target**: The addressable position of a Definition Site, established while viewing and never stored in a file.
- **Feature Folder**: The folder holding one feature's artifacts. Determines which definitions a document's unqualified tokens may resolve against.
- **Look-alike**: A token matching an ID's shape that must never be linked — a constant, version, error code, line reference, priority marker, compound-ID fragment, or deliberate placeholder.

### Core Integration Boundaries

Per the project constitution, these story boundaries require verification against the real boundary and MUST NOT be satisfied by mocks or simulated success:

- Opening a defining artifact and bringing a definition into view (User Stories 1–4) crosses the extension-to-webview message channel and the editor's real navigation path.
- Reading definitions out of artifacts the person is not currently editing (all stories) touches the real file system.
- Live refresh across open documents (User Story 5) depends on real document-change events, not simulated ones.
- Leaving files byte-identical (FR-024) must be verified against files actually written to disk.

### Out of Scope

- A link appearance or activation gesture that differs from the editor's existing links.
- A distinguishing appearance for unresolvable IDs.
- Hover previews or tooltip cards showing a definition without navigating.
- Reverse lookup — finding every document that references a given ID.
- Suggesting or autocompleting IDs as the person types.
- Renaming an ID across every document that references it.
- Linking issues, which this corpus identifies by filename rather than by an in-text ID.
- Inventing IDs for families the corpus does not use, including `CHK`, `NFR`, `ADR`, `RISK`, `DEC`, `INV`, `UC`, and `TC`, all of which have zero occurrences — as do `P-<digits>`, `E-<digits>`, and grouped `SC-<letter>##`, which earlier drafts listed in error.
- The thirteen other single-letter families named in FR-001c. They are real, they total roughly 600 further references, and they are deliberately excluded — see FR-001c for why.
- Synthesizing the intermediate IDs of a range. `FR-017–FR-021` contains only two ID substrings; linking `FR-018` would require inserting characters into the document, which FR-023 and FR-024 forbid.
- Cross-feature references written with a slash, such as `003/FR-004`. That form has zero occurrences in the corpus, and supporting it would add parse risk to the 132 real abbreviated slash groups.

## Success Criteria *(mandatory)*

### Measurable Outcomes

Per the project constitution, every criterion below carries a target, a comparison operator, and an enforcement status. **Enforced gate** means a phase checkpoint fails if the criterion fails. **Recorded** means the value is measured and reported but does not block. **Manual check** means a person confirms it in a real Extension Development Host.

| ID | Criterion | Target | Operator | Status |
|---|---|---|---|---|
| **SC-001** | A person moves from a reference to its definition in a single deliberate action, with no manual searching, including when the definition is in a different file. | 1 action | `=` | Manual check |
| **SC-002** | Recognized ID references that resolve to a definition, measured on the fixture corpus. A failure to resolve is acceptable only when the ID is genuinely undefined in reach — deliberately vacant, never defined, or in an out-of-scope family — and never because a definition exists and was missed. | 98% of references | `>=` | Enforced gate |
| **SC-002a** | Real references the recognizer fails to find, measured on the fixture corpus. | 0.1% of references | `<=` | Enforced gate |
| **SC-003** | Enumerated look-alikes presented as links — the constant occurrences, the 367 priority markers, the 482 `file:line` spans, and the four deliberate placeholders. | 0 | `=` | Enforced gate |
| **SC-004** | IDs named inside a compressed reference that are independently activatable, across all 132 surveyed group and range occurrences. | 132 of 132 | `=` | Enforced gate |
| **SC-005** | Bytes added to any file — referencing documents and defining artifacts alike — after being opened, browsed, navigated, and saved. | 0 bytes | `=` | Enforced gate |
| **SC-006** | After an ID is added, renamed, or removed, every other open document that resolves against that artifact shows the new link state with no action from the person. | 0 user actions | `=` | Manual check |
| **SC-007** | Error dialogs, warnings, badges, or interruptions produced by unresolvable references during a full editing session. | 0 | `=` | Enforced gate |
| **SC-008** | A reviewer shown an auto-linked ID and an author-written markdown link side by side can tell which is which from appearance or activation behavior. | cannot distinguish | `=` | Manual check |
| **SC-009** | With a feature folder holding 300 definitions, per-stage timings for tokenize, read, extract, resolve, and decorate. No numeric threshold is set — opening and typing must simply feel no slower than with the feature switched off. | none set | n/a | Recorded |

SC-009 is deliberately recorded rather than gated. A latency threshold would be an invented number, and an invented number in an enforced gate is worse than an honest measurement with no gate.

## Assumptions

- The eighteen families, their definition syntaxes, and the look-alike list are taken from the survey of `~/bl/dev/specs` and are treated as representative of spec-kit practice. A family absent from that corpus is out of scope until evidence appears.
- Feature folders follow the layout spec-kit creates — a numbered folder holding a feature's artifacts — and every markdown file in that tree is eligible for linking, including sidecar documents and files nested under subfolders. A feature folder is identified by its numbered name, not by the presence of `spec.md`: in the surveyed corpus three of 45 feature folders have no `spec.md` and one of those still defines IDs.
- The shared `briefs/` folder is a sibling of the numbered feature folders, as it is in the surveyed corpus.
- The editor already renders and activates links, including links to other files and to headings within them. This feature reuses that behavior rather than defining its own, so no new link interaction has to be designed, documented, or learned.
- Definitions are bullets, checkbox items, and table rows as often as they are headings, so the editor's existing heading-target mechanism does not already address them. Target-side support has to be supplied for the other three syntaxes, and supplied without writing anything into the defining artifact.
- The project previously tightened link detection to stop bare file extensions being auto-linked. This feature's rejection requirements follow that precedent: when a token is ambiguous, not linking is the correct outcome.
- No new user-facing setting is added for v1. Linking activates only inside recognizable feature folders, so documents in non-spec-kit projects are unaffected and need no opt-out.
- Only the visual (WYSIWYG) view changes. The plain markdown view and the files on disk are untouched.
- Two definitions sharing one ID is an authoring mistake, not a case this feature resolves beyond linking to the first.
- Per the constitution's documentation rule, README and wiki coverage of this behavior is required deliverable scope, not optional polish.
