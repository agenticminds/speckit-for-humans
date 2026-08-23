# Research: Example Feature

Fixture. Structures are real; prose is written fresh. See ../../PROVENANCE.md.

Four heading separator forms appear below — colon, full stop, em dash, and
nothing at all. A matcher keyed on any single delimiter finds only a quarter of
these.

## R-001: How is a folder handle obtained

**Decision**: Ask the storage layer, do not construct one.

## R-002: What happens to a handle after a reconnect

**Decision**: It is re-issued, not reused.

## R-011. Migration order for stored folders

**Decision**: Oldest first, so a partial run leaves the newest intact.

## D1 — Storage is addressed by handle, not by path

**Decision**: Handles survive a rename; paths do not.

## D7 — Reads are cancellable

**Decision**: Cancellation is cooperative, checked between slices.

## D13 Progress is reported per slice

**Decision**: Per slice, not per byte, so the cost is bounded.

## Q1 What does the reader see while a read is in flight

Open question, carried from the brief.

## Q4 Should a cancelled read be retried automatically

Open question.

## Unhyphenated research entries

The corpus spells the same concept two ways. Both forms below are distinct
identifiers and must resolve independently.

## R2. Handles are opaque to the caller

**Decision**: Callers never parse a handle.

## R10. Reconnect backoff is capped

**Decision**: Capped at a fixed ceiling.

## Table-defined entries

First cell bare, backticked, and bolded in turn — all three forms occur.

| ID | Question | Status |
|---|---|---|
| R-029 | Does a handle survive a process restart | Resolved |
| `R-030` | Is a handle safe to log | Resolved |
| **R-031** | Can two handles address one folder | Open |

## Preconditions, defined in a table with no digits in the identifier

| Precondition | Meaning |
|---|---|
| `P-APP-DIR` | Run from an application root |
| **P-PLATFORM-LINK** | The platform link is present |
| P-SOPS | Secrets tooling is available |

## Notes

References in prose: R-001 and R-002 are settled; R2 and R10 are the
unhyphenated family. Decisions D1, D7 and D13 are cited from the plan. The
cross-feature decision 002 D3 lives elsewhere.

Error codes that must never link: PGRST116 from the database layer, TS7016 from
the compiler, and P0001 raised by a trigger.
