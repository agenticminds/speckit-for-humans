# Brief: Example Storage

Fixture. Structures are real; prose is written fresh. See ../../PROVENANCE.md.

This folder is a **sibling of the numbered feature folders, not inside one**.
Brief-stage identifiers are defined here and cited from feature folders, so a
tool scoped only to `NNN-*` directories never finds their definitions (FR-016).

## Brief requirements

Bullets here carry a bolded identifier with **no trailing colon**, which is the
form a colon-anchored matcher misses entirely.

- **BR-1** Storage MUST be addressable without a path.
- **BR-2** A handle MUST survive a rename.
- **BR-4** When a reconnect occurs the handle MUST be re-issued.
- **BR-17** Every write MUST record an author.

## Architecture decisions

Defined as a **bolded identifier opening a paragraph**, not as a list item. This
is the sixth definition syntax, and the one whose absence held resolution for
this family down to half.

**AD-4 — The storage layer owns handle allocation**

Allocating elsewhere would let two callers mint the same handle.

**AD-5** When a handle is released it is never re-issued.

Reuse would let a stale reference address a live folder.

**AD-6 (BR-17)** All writes carry an author, without exception.

The exception case was considered and rejected.

## Open questions

- **OQ-1** Should a released handle be reported to the caller?
- **OQ-2** Is a reconnect visible to the reader?
- **OQ-8** *(never answered, and never defined elsewhere — resolves to nothing)*

## Clarification questions

- **Q1** What does the reader see while a read is in flight?
- **Q4** Should a cancelled read be retried automatically?

## Assumptions

- **A-1** Storage is reachable for the duration of a session.
- **A-3** A folder is not renamed while open.
- **A-9** The reader has permission to read every listed folder.

## Preconditions

Digit-free identifiers, defined in a table. Any rule requiring a trailing digit
rejects this whole family.

| Precondition | Meaning |
|---|---|
| **P-APP-DIR** | Run from an application root |
| `P-PLATFORM-LINK` | The platform link is present |
| P-PLATFORM-INSTALLED | The platform is installed |
| P-K8S | A cluster is reachable |
| P-BUN | Bun is on the path |

## Notes

Out-of-scope single-letter families appear here deliberately and must NOT link:
contract L10, variant V1, scenario S3, unit U2, batch B14, edge E9, group G1,
milestone M7, item I4, heading H4, window W11, note N2, and template TM3.

Real but unhyphenated A1 is also out of scope, while hyphenated A-1 above is in.
