# Contract: Example Storage Interface

Fixture. Structures are real; prose is written fresh. See ../../../PROVENANCE.md.

Namespaces below are lowercase, camelCase, multi-segment kebab, and uppercase in
turn. All four forms occur in the corpus. The middle segment is never an
identifier on its own — `CORE`, `UI`, `GUARD` and `VD` must never link.

## Lowercase namespace

- **C-read-1**: A read returns the whole document or fails.
- **C-read-2**: A read never returns a partial document.
- **C-ws-1**: A workspace handle is stable for its lifetime.
- **C-ws-4**: Two handles for one workspace compare equal.

## camelCase namespace

- **C-readFile-1**: Reading a missing file rejects rather than returning empty.
- **C-readFile-2**: Reading a directory rejects.
- **C-writeFile-3**: A write creates parent folders as needed.
- **C-createFolder-2**: Creating an existing folder is not an error.

## Multi-segment kebab namespace

- **C-git-write-2**: A write records an author.
- **C-git-error-1**: A failed write leaves no partial commit.
- **C-git-upstream-3**: Upstream is resolved once per session.

## Uppercase namespace

- **C-UI-1**: The status area reflects the folder in use.
- **C-CORE-3**: The core layer never touches the user interface.
- **C-GUARD-2**: A guard rejects before any side effect.
- **C-VD-1**: Validation runs before a write.
- **C-P-4**: A precondition failure names the unmet condition.
- **C-E-2**: An error carries a stable code.

## Bare and single-hyphen forms, heading-defined

## C1 Storage scope is one folder

## C4 — Handles are opaque

## C-7: Reconnect re-issues handles

## Table-defined contract entries

| Contract | Requirement |
|---|---|
| C-9 | A cancelled read releases its handle |
| `C-11` | A handle is safe to compare |
| **C-12** | Handles are never reused after release |

## Notes

Cited elsewhere as C-read-1, C-readFile-2, C-UI-1, C1, C-4 and C-12.
The PKCE method S256 and the curve P-256 are not identifiers.
