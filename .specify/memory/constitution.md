<!--
SYNC IMPACT REPORT
==================
Version change: 1.6.0 → 2.0.0 (MAJOR)

Bump rationale: this amendment REMOVES and REDEFINES governing obligations that were
inherited verbatim from an unrelated repository. Per this constitution's own amendment
rules, "incompatible removals or redefinitions of governing principles" require a MAJOR
bump. No new principles were added.

Modified principles:
- "Benchmark Integrity and Measurable Gates" — retained; removed the audio/PCM
  sample-count timing mandate, which has no referent in this repository.
- "Startup and Observability Discipline" → "Lazy Loading and Observability Discipline"
  — retained and retargeted; the "heavy ML imports and model loading" mandate is
  replaced by this project's real analogue (deferring heavy optional renderers such as
  diagram and math libraries out of initial bundle/startup cost).
- "Runtime Verification" — retained; made enforceable for a VS Code extension by
  naming the Extension Development Host and the editor webview as the target runtime,
  rather than assuming a standalone web server.
- "Consumer Documentation Integrity" — retained; consumer surface clarified for an
  editor extension (settings, commands, keybindings, README, wiki) alongside the
  existing public-API language.

Added sections: none.

Removed content:
- Audio-specific benchmark timing rule (canonical PCM sample-count vs container-byte
  progress).
- ML-specific startup rule (heavy ML imports and model loading deferral).
- Both Python/`uv` operational mandates (package installation, script execution,
  linting, type checking, tests, local server startup, and `uv run python` invocation).
  This repository contains no Python.

Retained with an owned exception:
- The Bun tooling mandate is KEPT. This repository is currently npm-based
  (`package-lock.json`, every `package.json` script invokes `npm run`), which would
  have violated the rule on day one. Rather than weaken the rule, the gap is recorded
  as an explicit, owned, time-boxed exception under the Governance compliance rules,
  and the migration is scheduled as the first task of feature
  `001-speckit-id-links`. The exception expires when that task lands.

Deferred / follow-up TODOs:
- Ratified date reset to 2026-08-20, the date this constitution was adopted for THIS
  project. The prior 2026-03-27 date belonged to the source repository. Change it back
  if continuity with that history is intended.
- "Provenance-Backed Test Assets" was left intact; it is neither audio- nor
  Python-specific, but confirm it is wanted for a markdown editor before relying on it
  as a gate.
-->

# Markdown-For-Humans

Constitution

## Core Principles

### Verification Before Completion

Every delivery phase MUST define a runnable verification checkpoint before
implementation for that phase is considered complete. Tests and other verification
artifacts MUST define done for the phase before implementation depends on them.
Contract tests MUST lock interfaces before downstream implementation depends on
those interfaces. Existing tests passing is necessary but never sufficient evidence
for new behavior. Documentation updates required to run, verify, or operate the
feature MUST be completed as part of the same work and MUST NOT be deferred as
optional follow-up.

### Real Validation Over Green-Looking Shortcuts

Work MUST be validated by executing the behavior actually under test. The project
MUST NOT treat skipped tests, xfailed tests, loose assertions, implementation-
mirroring tests, placeholder artifacts, or mocked-away core dependencies as proof
of correctness. Contributors MUST NOT edit tests to match broken behavior, choose
an easier implementation path that violates the requirement, report green results
that hide incomplete verification, or mark work complete before long-running
verification reaches its natural end state. Linter and type-checker success are
supporting evidence only and MUST NOT be reported as behavioral validation.

Shipped runtime code MUST NOT simulate successful interaction with a core
boundary when the claim being made is that the integration itself works. Core
boundaries include the VS Code extension API, the extension-to-webview message
channel, the document synchronization path, the file system, and other
dependencies whose real behavior is central to the story being delivered. Mock
responses, fake callbacks, stubbed success paths, bypass switches, or similar
shortcuts MAY exist in tests or in clearly isolated non-production harnesses, but
they MUST NOT sit on the shipped runtime path and MUST NOT be used as evidence
that the real integration is done.

### Benchmark Integrity and Measurable Gates

Benchmark and gate metrics MUST remain stable as inputs grow unless a deliberate,
documented re-baselining decision is made. Threshold definition and enforcement
status MUST be tracked separately. A story, milestone, or gate counts as active only
when every required metric has a numeric target, the correct comparison operator, and
active enforcement status. Benchmark reports MUST state whether each metric was
enforced or merely recorded.

### Provenance-Backed Test Assets

External data and test artifacts MUST be traceable to real sources. Asset
acquisition work MUST record the exact source, selection criteria, transformation
steps, provenance checks, and content smoke tests. Benchmark and evaluation
artifacts MUST use real provenance-backed source material with enough diversity to
exercise realistic conditions for the behavior under test. If required external
material cannot be acquired, the task MUST fail or be marked blocked; synthetic
substitutes MUST NOT be silently introduced as replacements.

### Lazy Loading and Observability Discipline

Heavy optional dependencies SHOULD be deferred to first use rather than loaded at
startup or eagerly included in the initial bundle, unless there is a documented
reason not to. Performance-sensitive stages MUST emit structured per-stage timing or
latency data so regressions can be attributed to a specific stage. Observability
added for timing or progress reporting SHOULD remain lightweight, machine-readable,
and compatible with normal development workflows.

### Runtime Verification

When a deliverable includes user-facing runtime behavior, phase checkpoints MUST
verify that behavior in the target environment before declaring completion. CLI exit
codes and build success alone are insufficient evidence that the extension works. For
editor and webview behavior, contributors MUST load the extension in a real VS Code
Extension Development Host, open the affected document in the editor webview, and
confirm it renders and behaves without errors — optionally assisted by
browser-automation tooling against the webview. Error overlays, developer-console
errors, and broken UI states MUST be caught and resolved before a phase checkpoint
passes.

### Clean Gate Checks (Zero-Tolerance)

The project MUST NOT accumulate errors or warnings on any gate-check signal —
linter, type checker, test suite, build, or the gate runner process itself. Every
phase checkpoint MUST run these gates and they MUST come back fully clean: zero
linter warnings/errors, zero type errors, all required tests passing with
zero unconditionally skipped tests and xfailed = 0, and the runner process itself
exiting cleanly. A gate is NOT green merely because the assertion count passed:
unhandled runner errors, worker/IPC timeouts, hangs, leaked handles, or a non-zero
process exit each fail the gate and MUST be resolved, not ignored. Any new warning
or error introduced by a change MUST be fixed in the same change.

Pre-existing problems are in scope. When a contributor observes a failing,
flaky, hanging, or warning-emitting gate during a phase — whether or not their
change introduced it — resolving it is part of that phase's work, not a deferred
follow-up. Labeling a problem "pre-existing," "flaky," "infra," or "unrelated" is
NOT a valid reason to leave it unaddressed; the root cause MUST be found and fixed
(or, if genuinely out of scope, explicitly tracked with a written justification and
owner, never silently tolerated). Re-running until a result looks green, or
reporting a gate as passing while it emits errors, is prohibited.

Suppressing a warning (via inline directives or config changes) is permitted only
when the warning is a false positive or inapplicable to the specific context, and
the suppression MUST include a brief justification comment. Warnings or failures
inherited from project scaffolding MUST be resolved no later than the first phase
checkpoint.

Excluding a test from a run is permitted only when the exclusion is expressed as a
condition the runner evaluates on every run, the unmet condition is named in the
reported result, and the run emits a summary identifying every test excluded this
way. An exclusion written into the test as an unconditional directive is a skipped
test and fails the gate, and a justification comment does not make it permissible.
A conditional exclusion counts as unverified, never as passing.

### Consumer Documentation Integrity

Any consumer-facing surface this project exposes MUST keep its documentation
accurate and current as part of the same work that changes that surface. For this
extension the consumer surface includes configuration settings, commands,
keybindings, context-menu entries, and any public API, and its documentation
includes the README, the wiki, and equivalent guides. A feature MUST NOT be marked
complete while its consumer documentation still contains scaffold placeholders,
outdated instructions, or missing coverage of shipped behavior.

Consumer documentation MUST be reviewed and updated whenever any of the following
change:

- Public exports, commands, or entry points
- Configuration settings, types, or contracts used by consumers
- Required setup, installation, or bootstrap steps
- Consumer-visible behavior or defaults
- Development, test, or verification commands

Plans MUST include documentation tasks as required deliverables, not optional
polish. Task generation MUST produce documentation work items automatically when a
feature touches consumer-facing surface. This requirement is enforced by the
constitution and MUST NOT rely on per-feature reminders in individual specs or
plans.

## Operational Standards

- A task is not done unless its required verification executes and passes.
- Unconditionally skipped tests do not count as passing.
- A test excluded by a runner-evaluated condition counts as unverified, not as
passing, and the gate report MUST name the unmet condition.
- Xfailed tests do not count as done.
- "All tests pass" is only valid for a relevant task or gate when no test was
unconditionally skipped, xfailed = 0, and every conditional exclusion was
reported with its unmet condition named.
- Task checkboxes MAY be marked complete only after the required verification
actually ran and passed.
- Benchmark and test artifacts MUST identify whether they are enforced gates,
shadow or recorded metrics, or simple diagnostics.
- Long-running verification MUST be observed through completion. Starting a run is
not equivalent to finishing it.
- Phase checkpoints for editor or webview behavior MUST include a runtime-level
verification (screenshot or DOM inspection of the webview) confirming the feature
renders without errors or broken UI.
- Phase checkpoints MUST include a linter run (`bun run lint`, or `bun run lint` until
the Bun migration lands; either enforces `--max-warnings 0`) that produces zero
warnings and zero errors.
- Gate-check runs MUST exit cleanly as a process. An unhandled runner error, a
worker/IPC timeout, a hang, a leaked handle that prevents clean exit, or a
non-zero process exit code fails the gate even when every assertion passed.
- Any failing, flaky, hanging, or warning-emitting gate observed during a phase is
in-scope for that phase regardless of who introduced it. "Pre-existing,"
"flaky," "infra," or "unrelated" MUST NOT be used to defer it; either fix the
root cause now or record an explicit, owned, written exception. Re-running to get
a green-looking result without fixing the cause is prohibited.
- If a story claims success against a core boundary, its required verification
MUST exercise that real boundary through the shipped runtime path. Rendering
the UI around a simulated-success path does not satisfy that gate.
- Feature completion MUST be blocked until required consumer-facing documentation
accurately reflects the shipped settings, commands, setup instructions, and usage
examples. Scaffold or placeholder documentation inherited from project generators
counts as stale and MUST be replaced.
- Node package installation and package-run workflows MUST use Bun rather than npm or
yarn unless a documented exception is approved. No exception is currently open: the
repository migrated to Bun on 2026-08-21. Its dependency lockfile is `bun.lock`, the
npm lockfile is deleted, and every script in `package.json` invokes `bun run`.
- The combined local gate for this repository is `bun run validate`, which runs the
linter, the test suite, and a debug build. Release packaging is `bun run package:release`.

## Delivery Workflow

- Specs MUST define independently testable user scenarios and measurable outcomes.
- Plans MUST describe how the feature satisfies constitution checks, what
verification checkpoints will run, and what data or benchmark provenance is
required.
- Plans MUST include consumer documentation updates as required deliverable scope
whenever the feature adds or modifies consumer-facing surface.
- Specs, plans, and tasks MUST identify which story boundaries are core
integration boundaries and therefore require real-boundary verification rather
than mocks or simulated success paths.
- Tasks MUST include the verification, documentation, and operational work needed
to satisfy the feature, not just the code edits.
- Reviews for completion MUST confirm both behavior and verification integrity,
not just code presence.
- Feature-specific architecture, dependency choices, and tooling workflows belong in
feature plans unless they become recurring repo-wide policy.

## Governance

This constitution overrides conflicting local habits, feature plans, and task
shortcuts. Compliance MUST be checked during specification, planning, task
generation, implementation, and review.

Amendment rules:

- Amendments MUST describe the policy change, the reason for it, and any template
or workflow files that require synchronization.
- A MAJOR version bump is required for incompatible removals or redefinitions of
governing principles.
- A MINOR version bump is required for new principles, new mandatory sections, or
materially expanded policy guidance.
- A PATCH version bump is required for wording clarifications that do not change
project obligations.

Compliance rules:

- Plans and tasks that violate the constitution MUST either be corrected or record
an explicit, reviewable justification in their complexity or risk tracking.
- Completion claims MUST include the verification evidence needed by the relevant
task, gate, or phase.
- Constitution-level rules apply repo-wide; feature-specific exceptions MUST stay
in feature documents unless formally adopted here.

**Version**: 2.0.0 | **Ratified**: 2026-08-20 | **Last Amended**: 2026-08-20
