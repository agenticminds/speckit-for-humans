# Glossary

House vocabulary. Every term used in an explanation, spec, or plan must be in here, standard in the field, or described in plain words. If a term is missing, **add it** rather than improvising a label.

Ordered by topic, not alphabetically, because related terms explain each other.

---

## Build and release

**GitHub Actions** — GitHub's service that runs commands automatically whenever code is pushed. Configured in `.github/workflows/`.

**Continuous integration (CI)** — the practice of running the linter, tests, and build on every push so breakage is caught immediately. This project's CI workflow is `.github/workflows/ci.yml`.

**Runner** — the throwaway virtual machine GitHub Actions rents to execute a workflow. It starts empty, so every tool the workflow needs must be installed by a step in that workflow.

**Action** — a reusable step in a GitHub Actions workflow, published by someone else. This project pins every action to an exact commit fingerprint rather than a version tag, so the code being run cannot change under it.

**Bun** — the tool this project uses to install dependencies and run scripts. Replaced npm on 2026-08-21. Its lockfile is `bun.lock`.

**`bun run test` vs `bun test`** — not the same thing, and the difference matters. `bun run test` executes the `test` script in `package.json`, which runs Jest. `bun test` is Bun's own built-in test runner, which does not understand this project's Jest setup. Always the former.

**vsix** — the single file a VS Code extension is packaged into for distribution. Built by `bun run package:release`.

**`.vscodeignore`** — the list of files excluded from the vsix. A file not listed here ships to every user who installs the extension.

**Gate** — an automated check that must pass cleanly before work counts as done. This project's gates are the linter, the test suite, the type checker, and the build. Defined in `.specify/memory/constitution.md`.

**Phase checkpoint** — the point in a piece of work where every gate is run and must come back clean. The project rules place gate enforcement here, not at every intermediate step.

---

## VS Code extension anatomy

**Extension host** — the Node.js process where the extension's own code runs. It can read files, call the VS Code API, and reach the network.

**Webview** — a sandboxed browser frame the extension displays content in. This project renders its editor inside one. A webview **cannot read files**; it can only exchange messages with the extension host.

**Content Security Policy (CSP)** — the browser rule set restricting what a webview may load. This project's webview is set to `default-src 'none'`, meaning no outside resource loads at all.

**`postMessage`** — the only channel between the extension host and the webview. Every piece of data crossing between them travels this way.

**Custom text editor** — the VS Code mechanism that lets an extension replace the normal text editor for a file type while VS Code still owns saving and undo. This project's is registered under the identifier `markdownForHumans.editor`.

**Priority `option`** — a setting on a custom editor meaning "do not open by default". Because this project uses it, `.md` files open in the normal text editor unless the user explicitly chooses otherwise.

**Extension Development Host** — a second VS Code window, launched by pressing F5, running the extension from source. The only place extension behavior can genuinely be observed.

---

## Editor internals

**TipTap** — the editor framework this project builds on. A friendlier layer over ProseMirror.

**ProseMirror** — the document-editing engine underneath TipTap. Holds the document as a structured tree, not as text.

**Document / `state.doc`** — ProseMirror's in-memory tree for the file being edited. **Anything stored here gets written to the file when saved.**

**Mark** — formatting attached to a span of text inside the document, such as bold or a link. Because it lives in the document, a mark **is saved to the file**.

**Decoration** — a visual overlay drawn on top of the document without being part of it. Because it lives outside the document, a decoration is **never saved to the file**. This is the distinction the ID-links feature depends on entirely.

**Position** — a numeric offset into a ProseMirror document. Only meaningful inside the exact document that produced it; it cannot be sent to another document or derived from a line number.

**Transaction** — one change applied to the editor. A transaction that alters the document reports `docChanged` as true; one that only attaches a decoration reports false, and therefore never triggers a save.

**Serialization** — converting the ProseMirror document back into markdown text for saving.

---

## Spec Kit

**Spec Kit** — the planning workflow this project uses. Produces a numbered folder per feature under `specs/`, holding a specification, plan, research, and task list.

**Feature folder** — one such numbered folder, e.g. `specs/001-speckit-id-links/`. Identified by its numbered name, **not** by containing any particular file.

**Constitution** — the project's binding rules, at `.specify/memory/constitution.md`. Overrides plans and habits.

**ID token** — a short code in a document that refers to a requirement, task, or decision defined elsewhere. `FR-001`, `T042`, `US2`, `D13`. The subject of feature 001.

**Family** — one naming scheme for ID tokens: its shape, which file defines it, and the syntax those definitions use. Nineteen are in scope.

**Definition site** — the exact place a given ID is declared, such as the bullet reading `- **FR-001**: …`. The destination a link points at.

**Look-alike** — text shaped like an ID that must never become a link. `AES-256`, `SHA-256`, `(Priority: P1)`, `spec.md:120-140`.

**Corpus** — the body of real spec files at `~/bl/dev/specs`, used as evidence for what conventions actually exist. 508 files. Private, so its contents are never copied into this public repository.

---

## Testing

**Jest** — the test runner. Configured in `jest.config.js`.

**Worker** — a separate process Jest spawns to run test files in parallel.

**Force-exit warning** — Jest's message that a worker did not shut down in time. It can mean a test left something running, **or** that Jest's own shutdown deadline was too short. The two look identical from the message alone.

**Open handle** — something still running when a test finishes, such as an uncancelled timer or an unclosed listener, which keeps the process alive.

**Mock** — a stand-in replacing a real dependency during a test. This project substitutes the entire VS Code API with `src/__mocks__/vscode.ts`.

**Fixture** — a sample input file a test runs against. Kept in `src/__tests__/fixtures/`.

**Flaky test** — a test that passes or fails inconsistently without any code change. The project rules treat one as a gate failure, not something to re-run past.
