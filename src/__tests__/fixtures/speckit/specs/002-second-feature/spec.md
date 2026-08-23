# Feature Specification: Second Feature

Fixture. Exists so cross-feature references from feature 001 have somewhere real
to resolve to. See ../../PROVENANCE.md.

Feature 001's `tasks.md` cites `002 FR-004`, `002 T210`, `spec 002 SC-010` and
`002's FR-006`. All four are defined here.

## Requirements

### Functional Requirements

- **FR-004**: The second feature MUST expose a folder listing.
- **FR-006**: The listing MUST be stable across reads.
- **FR-008**: An empty folder MUST list as empty, not as an error.

## Success Criteria

- **SC-010**: A listing returns within one read cycle.

## Notes

Feature 001 also has an `FR-004`, with different text. An unqualified `FR-004`
appearing in a feature 001 document must resolve to feature 001's, never to this
one (FR-018). Only a qualified reference crosses the boundary.
