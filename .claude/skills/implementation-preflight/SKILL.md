---
name: implementation-preflight
description: Interactively pre-flight a spec-kit feature with the developer — surface and
  clear every blocker an unattended run could hit, negotiate authorizations for real
  actions, pre-provision services/keys/fixtures, and record the readiness verdict to
  .implementation-preflight.md so the autonomous implementation-loop can later run to
  completion with no human.
compatibility: Requires spec-kit project structure with .specify/ directory
metadata:
  author: local
  source: split from speckit-implement-loop; feeds implementation-loop
disable-model-invocation: true
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty). The user may pass
notes/scope for the run, or `--refresh` to re-run the full checklist and re-confirm
authorizations even when a `.implementation-preflight.md` already exists.

## Purpose

This is the **interactive, human-in-the-loop** half of the implementation flow. Its single
job: examine the plan and tasks, surface *everything* that could later block an unattended
run, and work **with the developer** to pre-provision and authorize it up front — then
record a readiness verdict to `.implementation-preflight.md`.

That file is the contract consumed by the `implementation-loop` skill. The goal of doing
this work here, with a human, is precisely so the loop **never needs a human** once it
starts. If the loop later halts for a person, it should only ever be on a *withheld* action
you deliberately chose not to authorize here — never on something you simply forgot to set
up.

This skill **does not implement tasks and does not commit**. It only inspects, provisions,
authorizes, and writes the readiness file. Implementation is `implementation-loop`'s job.

## Tooling & autonomy

During pre-flight you are expected to **use real dev tools**, not just reason about them.
You may start and stop backend processes, front-end dev servers, and databases; run
`docker`, `kubectl`, `bun`, `git`, `gh`, `supabase`, and cloud-provider CLIs; and drive a
browser via the Chrome DevTools automation tools (`mcp__chrome-devtools__*`) to *verify*
that a service can actually come up, a key actually works, a fixture actually loads. Prefer
the project's own scripts/skills for launching the app when they exist. Clean up anything
you start (stop dev servers, tear down throwaway containers) before finishing — the loop
will bring up what it needs from the reach-it notes you record.

The point of the pre-flight is to get every credential, service, account, and fixture the
loop will rely on ready and *proven* up front.

## Outline

### 1. Resolve feature paths and tasks.md

Run from the repo root and parse the output (paths are absolute):

```sh
.specify/scripts/bash/check-prerequisites.sh --json --paths-only
```

Capture `BRANCH`, `FEATURE_DIR`, `TASKS`. Then `FEATURE_ID` = the leading numeric prefix of
`BRANCH` (e.g. `027`). If the script errors (not on a feature branch, missing
`plan.md`/`tasks.md`), surface it verbatim and **stop** — never guess a tasks file or
hard-code a path. Confirm you are on a real feature branch, never the default branch
(`001-base-react-package`).

Define the **readiness file**: `PREFLIGHT = FEATURE_DIR/.implementation-preflight.md`. Keep
it out of commits: ensure the repo `.gitignore` contains `specs/*/.implementation-preflight.md`
(append it if missing) so `git add -A` never stages it. The leading dot keeps it hidden.

### 2. Existing readiness file?

If `PREFLIGHT` already exists and `--refresh` is **not** in `$ARGUMENTS`: show its current
verdict and offer (via `AskUserQuestion`) to (a) re-verify the environment cheaply and
refresh the file, (b) re-run the full pre-flight from scratch, or (c) leave it as-is and
exit. Don't silently clobber a prior verdict.

Otherwise (no file, or `--refresh`): run the full pre-flight below and write the file.

### 3. Read everything relevant

Read everything in `FEATURE_DIR`: `plan.md`, `tasks.md`, and any of `research.md`,
`data-model.md`, `quickstart.md`, `contracts/`, plus `spec.md` for requirements. Also read
the package READMEs the tasks touch. You cannot pre-flight blockers you haven't read for.

### 4. Enumerate likely blockers

List everything an unattended agent could **not** satisfy on its own. Look specifically for:

- Secrets / credentials / API keys / age or SOPS keys / `.env` values.
- External accounts or services that must exist (Supabase project/env, cloud resources,
  email/provider accounts, DNS, OAuth apps).
- Tools that must be installed and on PATH (e.g. `sops`, `age`, `deno`, `docker`,
  `kubectl`, cloud CLIs) and their auth/login state.
- Local services that must be running for tests (DB, dev servers, emulators). **You are
  permitted to start these yourself** — bring them up now to prove they work. Only escalate
  to the developer if a service can't start without something only they can supply (a
  secret, account, or license).
- Tasks whose **verification requires a real action** (deploy to the local cluster, send a
  test email, run the quickstart end-to-end, full gate). Many of these are perfectly doable
  by the agent — they are **not automatically blockers**. Treat them as actions to get
  **authorization** for in step 5, so the loop can perform them unattended.
- Fixtures, seed data, or test recipients that must be provisioned.

### 5. Negotiate authorizations and pre-provision — *with the developer*

Two things happen here, and both require the human; this is the whole reason the skill is
interactive.

- **Authorize real actions (so the loop won't have to halt for them).** For each
  verification-requires-a-real-action item, ask the developer (via `AskUserQuestion`) to
  authorize the agent to do it autonomously during the loop, and capture the scope. Default
  to letting the loop do anything safely reversible in a dev/local context — e.g. deploy to
  the **local** cluster (`kubectl`/`docker`), run local migrations, send test emails to a
  sandbox/test recipient, run the quickstart against local services. Get explicit per-item
  sign-off for anything with real-world side effects or cost — deploying to a
  **shared/prod** environment, sending real email to real recipients, creating billable
  cloud resources, anything destructive. Record the result as an **authorized-actions
  list** (what the loop may do unattended) and a **withhold list** (what must pause for the
  developer).
- **Pre-provision/configure** every remaining item: install/verify tools, generate keys,
  set env values, stand up or log into services, seed fixtures — and *prove each works*.
  For anything only the developer can do (enter a production secret, approve a cloud
  spend), ask precisely and wait.

### 6. Produce the readiness checklist and verdict

Mark each potential blocker ✅ ready / ⚠️ deferred-with-plan / ❌ unresolved, noting what was
done and **how the loop reaches it** (service URLs, key/file *paths*, env var *names* —
pointers, never the secret values). For each verification-requires-a-real-action item, mark
it authorized-and-unattended or withheld-will-pause.

Then set an overall **verdict** — this is the **go/no-go signal** that `implementation-loop`
reads to decide whether it may run. It MUST be exactly one of these three tokens, written as
the **first line under the `## Verdict` heading** in the form `<TOKEN> — <reason>`. The loop
matches this token literally, so be precise:

- **GO** — no ❌ blockers remain that would stall an unattended run. The loop runs to completion.
- **GO-WITH-PAUSES** — the loop can start, but withheld actions or a deferred ⚠️ item mean
  it will legitimately stop at a known phase as `BLOCKED_HUMAN`. Note where.
- **NO-GO** — unresolved ❌ blockers would stall the run. The loop must not start; if it is
  invoked against a NO-GO file it will re-run this pre-flight to try to clear them.

If ❌ blockers remain, present them and ask the developer whether to resolve now or accept a
NO-GO / GO-WITH-PAUSES verdict. Use `AskUserQuestion`. **Never write GO while a ❌ blocker
that would stall the loop is unresolved** — the loop trusts this token without re-checking
the work.

### 7. Write `.implementation-preflight.md`

Write the file using the template at the end of this document: the verdict, the
authorized-actions list, the withhold list, and the readiness checklist with reach-it
notes. **Record pointers, never secret values** (key file paths and env var *names* are
fine; the secrets themselves are not). This file is read-only input for the loop — the loop
maintains its *own* progress journal in `.implementation-loop-state.md` and never edits this
one.

## Reporting

State the **verdict token** plainly, then present the readiness checklist behind it, then
the explicit next step:

- **GO / GO-WITH-PAUSES** → run `/implementation-loop` to implement the feature
  unattended (note any expected pause for GO-WITH-PAUSES).
- **NO-GO** → list the unresolved ❌ blockers and what's needed to clear them; do not start
  the loop.

If this pre-flight was **auto-invoked by `implementation-loop`** (because the readiness file
was missing or NO-GO), the verdict you write to `.implementation-preflight.md` is exactly
what the loop re-reads to decide whether to continue — the file *is* the handoff, so make the
verdict token accurate before returning control.

## Readiness file template

Write this to `FEATURE_DIR/.implementation-preflight.md` (gitignored; hidden). It is the
contract the `implementation-loop` skill reads. **Pointers, never secret values.**

```markdown
# implementation-preflight — <FEATURE_ID> (<BRANCH>)

Feature: <one line>
Scope decided with developer (<date>): <e.g. run to completion, phases 1→N>

## Verdict
<GO | GO-WITH-PAUSES | NO-GO> — <one-line justification>

Expected pauses (if GO-WITH-PAUSES): <which phase/task and why>

## Authorized actions (loop may do these unattended)
- <e.g. boot/stop a LOCAL Supabase stack via `supabase start`/`stop`; apply local migrations>
- <e.g. send test email to sandbox recipient <addr>>
- <e.g. run the full gate: lint / typecheck / test for the affected packages>

## Withheld actions (loop must pause as BLOCKED_HUMAN)
- <e.g. real email to real recipients — requires Mailgun key + recipient>
- <e.g. deploy to shared/prod; push to remote; publish/release the package>

## Readiness checklist (reach-it notes — pointers, never secrets)
- ✅ <tool installed; key at <path>; service up at <url>; env var NAMES: <NAMES>>
- ⚠️ <deferred item + the plan to satisfy it, and which task needs it>
- ❌ <unresolved item + what's required to clear it>
```
