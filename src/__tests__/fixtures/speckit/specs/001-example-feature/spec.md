# Feature Specification: Example Feature

Fixture. Structures are real; prose is written fresh. See ../../PROVENANCE.md.

## User Scenarios & Testing

### User Story 1 - Open a stored document (Priority: P1)

A reader opens a document that was saved earlier and sees it rendered.

**Acceptance Scenarios**:

1. **Given** a stored document, **When** the reader opens it, **Then** it renders.

---

### User Story 2 - Reopen the last folder (Priority: P2)

The tool reopens whatever folder was last in use.

---

### User Story 3 - Recover from a bad path (Priority: P3)

A path that no longer resolves fails quietly.

---

### User Story 8 - Per-app storage (Priority: P4)

Each application gets its own storage area.

- [ ] **US8-1**: Storage is created on first write, not at startup.
- [ ] **US8-2**: Two applications never share an area.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST render a stored document on open.
- **FR-002**: The system MUST reopen the folder last in use.
- **FR-003**: The system MUST fail quietly on a path that no longer resolves.
- **FR-005a**: The system MUST retry a transient read once before failing.
- **FR-005b**: The system MUST NOT retry a permission failure.
- **FR-009**: The system MUST record which folder was last in use.
- **FR-010**: The system MUST tolerate a folder that was deleted between sessions.
- **FR-012**: The system MUST report progress for a read longer than one second.
- **FR-013**: The system MUST cancel an in-flight read when the reader navigates away.
- **FR-014**: The system MUST keep the reader's scroll position across a reopen.
- **FR-015**: *(withdrawn — deliberately left vacant, mirroring a real corpus case)*
- **FR-017**: The system MUST expose the folder in use to the status area.
- **FR-021**: The system MUST accept a folder supplied on the command line.
- **FR-022**: The system MUST prefer a command-line folder over the stored one.
- **FR-G01**: Grouped requirement: the storage layer MUST be addressable by handle.
- **FR-G12**: Grouped requirement: a handle MUST outlive a single read.
- **FR-W03**: Grouped requirement: a write MUST be atomic.
- **FR-A01**: Grouped requirement: authorisation MUST precede a read.
- **FR-A05**: Grouped requirement: authorisation MUST be re-checked after a reconnect.
- **FR-P01**: Grouped requirement: a precondition failure MUST name the unmet condition.
- **FR-P07**: Grouped requirement: preconditions MUST be evaluated in declaration order.
- **FR-T01**: Grouped requirement: a task MUST be resumable.
- **FR-T03**: Grouped requirement: a cancelled task MUST leave no partial state.
- **FR-D02**: Grouped requirement: a document MUST carry its own encoding.
- **FR-D04**: Grouped requirement: an unknown encoding MUST be reported, not guessed.
- **FR-EX-001**: Example-app requirement: the sample MUST run with no configuration.
- **FR-EX-002**: Example-app requirement: the sample MUST not write outside its own folder.

Reference forms in prose: see FR-001. Also (FR-002) and `FR-003` shown as code.
The withdrawn FR-015 is still referenced here and must stay plain, because it
resolves to nothing. Compare per-FR-022, which must resolve despite the hyphen.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A reader opens a stored document in one action.
- **SC-002**: Reopening restores the previous folder in every session.
- **SC-003a**: A deleted folder produces no error dialog.
- **SC-004**: Scroll position is preserved across a reopen.
- **SC-006**: A read longer than one second reports progress.
- **SC-009**: A cancelled read leaves nothing behind.
- **SC-EX-001**: The sample application starts with no configuration.

## Notes

Look-alikes that appear in ordinary prose here and must never link: the
transport uses AES-256 with SHA-256 digests over UTF-8, tokens are signed
HS256, the build targets ES2022, and hostnames follow DNS-1123. Priority
markers such as (Priority: P1) and bare (P2) are not identifiers.
