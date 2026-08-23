# Tasks: Example Feature

Fixture. Structures are real; prose is written fresh. See ../../PROVENANCE.md.

## Phase 1: Setup

- [X] T001 Create the storage folder layout
- [X] T002 [P] Configure the reader
- [ ] T003 [P] Wire the status area

## Phase 2: Foundational

- [ ] T012 Establish the handle registry
- [ ] T019a Read path, first slice
- [ ] T019b Read path, second slice
- [ ] T019l Read path, final slice
- [ ] T027 [P] [US1] Render a stored document
- [ ] T042 [US1] Restore scroll position
- [ ] T080 [US2] Reopen the last folder

## Phase 3: User Story 1

- [ ] T101 [US1] Satisfies FR-001 and SC-001
- [ ] T102 [P] [US1] Satisfies FR-014, SC-004
- [ ] T103 [US1] Covers FR-005a and FR-005b

Nested assertion scenarios, indented rather than top level:

- [ ] T104 [US1] Verify the read path
  - [ ] **AS1**: A stored document renders on first open.
  - [ ] **AS2**: A second open reuses the handle.

## Phase 4: User Story 2

- [ ] T110 [US2] Satisfies FR-002 per the decision in research D1
- [ ] T111 [US2] Blocked on 002 FR-004, which lives in the second feature
- [ ] T112 [US2] Also depends on 002 T210 and spec 002 SC-010
- [ ] T113 [US2] Mirrors 002's FR-006

## Notes

Tagged references appear as [US1], [US2] and [US8-1].

File references that must never link: see spec.md:41-58 for the requirement,
and the handler at editor.ts:1852. Line refs L76 and L153 are not identifiers.

Filename tails must not link either: the screenshot T038-login-screen.txt and
the folder T016-scaffolding are not references to tasks T038 or T016.

Placeholder identifiers used in negative tests: XYZ-999, DRAFT-4242.
