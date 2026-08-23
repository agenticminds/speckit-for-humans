---
name: implementation-loop
description: Autonomously drive /speckit-implement one phase at a time across tasks.md —
  committing each completed phase, enforcing the project quality/completeness gate, and
  resuming across invocations via .implementation-loop-state.md. Gated on a GO verdict from
  implementation-preflight, which it auto-runs first if the readiness file is missing or
  NO-GO, so it needs no human once a GO is in hand — halting again only on a withheld action
  or a genuine design/plan/requirements problem.
compatibility: Requires spec-kit project structure with .specify/ directory
metadata:
  author: local
  source: split from speckit-implement-loop; consumes implementation-preflight
disable-model-invocation: true
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty). The user may name a
phase to start at (e.g. `Phase 4` or `T017`) or pass notes for the implementer.

## Purpose

This skill is the **autonomous** half of the implementation flow — a **loop driver** over
the `speckit-implement` skill. It works through `tasks.md` one phase at a time, delegating
each phase to `speckit-implement`, committing each fully-completed phase, and continuing
until all phases are done.

The human gate lives in `implementation-preflight`. This skill needs a GO (or
GO-WITH-PAUSES) verdict in `.implementation-preflight.md`; if the file is missing or its
verdict is NO-GO, it **runs `implementation-preflight` first** to obtain one — that is the
single point where the loop engages the developer. Once it holds a GO it runs **unattended**.
It pauses again only when something genuinely needs a human — a *withheld* action the
developer chose not to authorize, or a real design/architecture/planning/requirements miss.
It does **not** negotiate authorizations or provision services mid-run; if a phase needs
something the preflight didn't authorize, it stops cleanly and points back to the preflight.

## Tooling & autonomy

You are expected to **use real dev tools**, not just reason about them — within the bounds
the preflight authorized. You may start and stop backend processes, front-end dev servers,
and databases; run `docker`, `kubectl`, `bun`, `git`, `gh`, `supabase`, and cloud CLIs; and
drive a browser via the Chrome DevTools automation tools (`mcp__chrome-devtools__*`) for
manual testing, front-end verification, and debugging. Prefer the project's own
scripts/skills for launching the app when they exist. Clean up anything you start (stop dev
servers, tear down throwaway containers) before finishing. The preflight already proved
these tools have what they need; the reach-it notes tell you how to bring them up.

## Outline

### 1. Resolve feature paths and tasks.md

Run from the repo root and parse the output (paths are absolute):

```sh
.specify/scripts/bash/check-prerequisites.sh --json --paths-only
```

Capture `BRANCH`, `FEATURE_DIR`, `TASKS`. Then `FEATURE_ID` = the leading numeric prefix of
`BRANCH` (e.g. `027`) — the `NNN` used in commit messages. If the script errors (not on a
feature branch, missing `plan.md`/`tasks.md`), surface it verbatim and **stop** — never
guess a tasks file or hard-code a path. Confirm you are on a real feature branch, never the
default branch (`001-base-react-package`).

Define two feature-local files, both gitignored and hidden:

- `PREFLIGHT = FEATURE_DIR/.implementation-preflight.md` — the readiness contract written
  by `implementation-preflight`. **Read-only here**; never edit it.
- `STATE = FEATURE_DIR/.implementation-loop-state.md` — this skill's durable memory across
  invocations. `tasks.md` only records which tasks are `[X]`, not the commit it stopped on,
  the blocker, or the gotchas learned. The loop owns this file.

Ensure the repo `.gitignore` contains both `specs/*/.implementation-preflight.md` and
`specs/*/.implementation-loop-state.md` (append any missing) so `git add -A` never stages
them.

### 2. Preflight gate (auto-runs pre-flight if needed)

Read `PREFLIGHT` and find its **verdict** — the first token under the `## Verdict` heading,
exactly one of `GO`, `GO-WITH-PAUSES`, or `NO-GO`. Then:

- **File missing** → no readiness has been established yet. **Invoke the
  `implementation-preflight` skill inline** (run `/implementation-preflight`) to create it.
- **Verdict NO-GO** → blockers were left unresolved. **Invoke
  `/implementation-preflight --refresh` inline** to re-run the checklist and try to clear
  them.
- **Verdict GO or GO-WITH-PAUSES** → proceed straight to step 3.

Run the auto-invoked pre-flight **inline, not as a subagent** — it is interactive and must
talk to the developer (this is the one moment the loop legitimately needs a human; once it
has a GO it runs unattended). When it returns, **re-read `PREFLIGHT` and re-evaluate the
verdict exactly once**:

- Now GO / GO-WITH-PAUSES → proceed.
- Still NO-GO (the developer could not or chose not to clear the blockers) → **stop**; show
  the unresolved ❌ blockers from the file. Do **not** invoke pre-flight a second time — never
  loop on the gate.

Once the verdict is GO / GO-WITH-PAUSES, load the **authorized-actions list**, the
**withhold list**, and the **readiness checklist with reach-it notes** from `PREFLIGHT` —
these drive the whole run and are passed to every phase subagent. For GO-WITH-PAUSES, note
the expected pause so it isn't mistaken for a failure when it arrives.

### 3. Git hygiene gate (runs on every invocation)

Strict commit discipline is a goal of this skill: every line of source must trace back to
the phase commit (`NNN - Phase N, …`) that introduced it. Because each phase is committed
with `git add -A`, the working tree must contain *only* the current phase's work at commit
time. Run `git status --porcelain` (the `STATE` and `PREFLIGHT` files are gitignored, so
they never show):

- **Clean** → proceed.
- **Dirty, and `STATE` records a `BLOCKED_HUMAN` / in-progress phase** → the pending
  changes are that phase's own uncommitted work; expected, proceed (the resume will commit
  them as Phase N).
- **Dirty otherwise** → do not absorb unrelated changes into a phase commit. Show
  `git status` / `git diff` and **offer to help clear the tree** via `AskUserQuestion`:
  (a) commit them on the developer's behalf with a message they approve, (b) `git stash`
  them (note the stash ref in your summary), (c) discard them (`git checkout`/`git restore`
  — only on explicit confirmation), or (d) stop so they handle it manually. Carry out the
  chosen option, then re-check the tree is clean before continuing. Never auto-commit
  changes you didn't produce for a phase *without* the developer approving the message.

### 4. Resume or start fresh

**If `STATE` exists** (a prior run wrote it): this is a **resume**. Read it. Then:

1. Show a short resume summary: where the last run stopped, the pending blocker (if any) and
   its steps.
2. **Re-verify the environment cheaply** — `PREFLIGHT`'s reach-it notes say what was
   provisioned and how to reach it (service URLs, key paths, env names). Confirm those
   services/tools are still up; restart any local services you're authorized to if they're
   down. Don't re-provision what's already recorded ready.
3. If the last run stopped `BLOCKED_HUMAN`, check whether the manual steps are now satisfied
   (e.g. the secret is now set, the resource now exists). If still not, re-present the steps
   and stop again.

**If `STATE` does not exist**: this is a fresh start. Create `STATE` from the template at
the end of this file (pointer to `PREFLIGHT`, empty current-status to be filled as phases
run), then continue.

### 5. Parse tasks.md → phases and completion state

Read `TASKS`. Identify:

- **Phases**: headings `## Phase N: <title>` (document order).
- **Tasks**: `- [ ] TNNN ...` (incomplete) vs `- [X]`/`- [x] TNNN ...` (complete).

For each phase record: number `N`, title, ordered task IDs, count incomplete. Survey:

```sh
awk '/^## Phase /{print "PHASE: " $0} /^- \[[ xX]\] T[0-9]/{print "  " $0}' "$TASKS"
```

### 6. Pick the next phase

The **next phase** is the first phase (document order) with at least one incomplete
(`- [ ]`) task. Respect any phase the user named in `$ARGUMENTS`.

- If **no** phase has incomplete tasks → all done. Report a final summary and **stop**;
  commit nothing.
- Otherwise capture `N`, the title, and the inclusive task-ID range `Tfirst – Tlast`.

### 7. Delegate the phase to speckit-implement (subagent)

Spawn **one subagent** (Agent tool, `general-purpose`) to implement **only this phase** —
fresh, isolated context per phase, not inline. The subagent prompt MUST:

- Follow `.claude/skills/speckit-implement/SKILL.md`, **scoped to Phase N only** (tasks
  `Tfirst`–`Tlast`); it must NOT start any later phase.
- Receive the **pre-flight readiness notes** (from `PREFLIGHT`) so it knows what's already
  provisioned and how to reach it (service URLs, key locations, env names) — don't
  re-provision.
- Receive the **authorized-actions list and withhold list** (from `PREFLIGHT`). It MAY
  perform authorized real actions (e.g. deploy to the local cluster, send a sandbox test
  email, run the quickstart against local services) to complete and verify tasks
  unattended. It must NOT perform a withheld action, and must NOT invent a new
  authorization for itself — for either, it leaves the task `[ ]` and reports
  `BLOCKED_HUMAN`.
- Inherit the same tool latitude (browser automation, processes, docker/kubectl/bun/git/gh/
  cloud CLIs) for implementing, testing, and debugging this phase.
- Honor the phase's internal ordering (TDD: tests before code; `[P]` parallel vs
  sequential; same-file tasks serialized).
- **Mark each finished task `[X]` in `tasks.md`** as it goes.
- Run the project gate for whatever it touched before claiming success: `bun run lint`,
  typecheck, `bun test` for affected packages (plus `deno check` for touched Deno workers).
  Bar (per `.specify/memory/constitution.md`, "Clean Gate Checks"): zero warnings/errors,
  zero *unconditionally* skipped tests, `xfailed=0`, clean exit. A test excluded by a
  condition the runner evaluates on every run does **not** fail the gate — it counts as
  unverified rather than as passing, and the run must name its unmet condition. An
  exclusion written into the test as an unconditional directive still fails the gate.
- **Not fake** anything it cannot truly do or is not authorized to do (a withheld action, a
  live secret it lacks, a manual confirmation): leave such a task `[ ]` and report it as
  `BLOCKED_HUMAN`. (Authorized real actions it *should* perform, not skip.)
- **Halt rather than paper over a real problem.** If implementation reveals a design,
  architecture, planning, or requirements miss — the plan contradicts the code, a task is
  infeasible/ambiguous, an interface doesn't exist as specified, an assumption is wrong — it
  must STOP and report it as `FAILED` with specifics, not invent a workaround that diverges
  from the spec.

Require a closing **structured outcome block** (its return value):

```
OUTCOME: COMPLETE | BLOCKED_HUMAN | FAILED
PHASE: N
TASKS_DONE: <task IDs marked [X] this run>
TASKS_PENDING: <task IDs still [ ] and why>
SUMMARY: <one or two sentences>
MANUAL_STEPS: <numbered, copy-pasteable operator steps — required if BLOCKED_HUMAN>
UNBLOCK_STEPS: <numbered steps + root cause — required if FAILED>
ESCALATION: <if FAILED is a design/arch/plan/requirements miss: what's wrong + which artifact (spec/plan/tasks) needs amending; else "none">
GATE: <lint/typecheck/test result, e.g. "lint ok, 42 tests pass" or "n/a">
```

- **COMPLETE** — every phase task `[X]`, verified, no human action outstanding.
- **BLOCKED_HUMAN** — all agent-doable and *authorized* work is `[X]`, but a withheld action
  or manual operator step remains (in `MANUAL_STEPS`). Should be rare if the preflight
  authorized the doable real actions; expected only where the preflight verdict was
  GO-WITH-PAUSES.
- **FAILED** — could not complete: build/test failure, missing dependency, **or a
  design/architecture/planning/requirements miss** (fill `ESCALATION`).

### 8. Act on the outcome

**COMPLETE** → commit, update state, then loop.

1. Review: `git status`, `git diff --stat` (expect source changes + the `[X]` edits).
2. Commit on the **current feature branch** (never the default branch):
   ```sh
   git add -A
   git commit -m "$(cat <<'EOF'
   NNN - Phase N, Tfirst - Tlast <short description of the phase>

   <optional 1–3 bullet summary>

   Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
   EOF
   )"
   ```
   Fill real values: `NNN`=`FEATURE_ID`, `N`=phase number, `Tfirst - Tlast`=the phase's task
   range (e.g. `027 - Phase 3, T011 - T016 Provision system credential from git`). Keep the
   subject prefix exactly: `NNN - Phase N, Tfirst - Tlast `.
3. Update `STATE`: set current status to "Phase N committed (<sha>)", clear any pending
   blocker, record any gotchas learned. Then report the commit and **go back to step 5** to
   find and run the next phase.

**BLOCKED_HUMAN** → record state, then stop without committing. Update `STATE` current
status to `BLOCKED_HUMAN` on Phase N with the verbatim `MANUAL_STEPS` and the pending task
IDs (the work stays uncommitted so it folds into a single phase commit later). Print
`MANUAL_STEPS` clearly and tell the operator: do those steps, then re-run
`/implementation-loop` — the resume reads `STATE`, re-checks the steps, verifies the
satisfied tasks, marks them `[X]`, commits Phase N, and continues. If the block is a *new*
real-action the preflight never authorized, say so and recommend re-running
`/implementation-preflight --refresh` to authorize it rather than handling it ad hoc. Stop
the loop.

**FAILED** → record state, then stop without committing. Update `STATE` current status to
`FAILED` on Phase N with `UNBLOCK_STEPS` and `ESCALATION`. Present the root cause and
numbered `UNBLOCK_STEPS`. **If `ESCALATION` is non-empty** (a design/architecture/planning/
requirements miss), foreground it: explain what's wrong and which artifact needs amending,
and recommend `/speckit-reconcile-run` or a plan/tasks fix before resuming — do **not** keep
looping over a flawed plan. Stop the loop; suggest re-running once resolved.

### 9. Loop safety

- Track phases attempted this run. If a phase returns with **no new `[X]`** twice in a row,
  stop and report a stall (treat as FAILED) — never loop forever.
- Only advance forward; never re-open an all-`[X]` phase.
- One commit per fully-completed phase — never bundle two phases, never commit a
  partial/blocked phase.

### 9a. Never end a turn while a phase subagent is running

The loop is unattended by contract, so the developer must never have to poll it. After spawning a
phase subagent, **block on it** (`hub wait` with that job id and `timeoutMs: 0`) and do not yield
until it settles.

The trap: `hub wait` returns on the **first** of the job finishing, a message arriving, or the
window elapsing — so *any* message from the developer ends the wait, including one merely asking
for status. Answering and then yielding puts them straight back to polling, which reads as the loop
having stopped even while it is working.

Therefore: answer the interjection **and re-issue the wait in the same turn**. A turn may only end
while a watched job runs if the developer redirects the work.

Two failure modes this exists to prevent, both observed:
- **Narrating instead of acting** — ending a turn with "dispatching now" and no spawn. If the next
  action is a tool call, make the tool call; an announcement is not an action.
- **Asking permission to continue** work the readiness file already authorized. If its scope says
  run to completion, run to completion; a contentless "shall I proceed?" costs a round trip and
  contradicts the contract. Genuine pauses are only a withheld action or a real design miss.

## Reporting

Between phases, emit a short progress line (e.g. `✓ Phase 3 (T011–T016) committed`). At the
end (all done, blocked, or failed), give a compact summary: phases completed + committed,
the current status, and any operator action or escalation required.

## State file template

Write this to `FEATURE_DIR/.implementation-loop-state.md` (gitignored; hidden; the skill's
durable memory across invocations). Keep it current: update the **Current status** block on
every transition. **Record pointers, never secret values** (key file paths and env var
*names* are fine; the secrets themselves are not).

```markdown
# implementation-loop state — <FEATURE_ID> (<BRANCH>)

Readiness contract: .implementation-preflight.md (verdict + authorized/withheld lists live there)

## Current status
- Last run: Phase <N> — <COMPLETE|BLOCKED_HUMAN|FAILED>
- Last commit: <sha or none>
- Pending blocker: <none | the MANUAL_STEPS / UNBLOCK_STEPS / ESCALATION verbatim>
- Next phase: <Phase N+1 (Tfirst–Tlast) | all done>

## Notes / gotchas learned during the run
- <e.g. commit recipe, OOM avoidance, harness layout, lockfiles that move together>
```
