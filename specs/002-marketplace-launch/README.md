# Marketplace Launch — Remaining Steps

Status: in progress
Owner: Agentic Minds
Last updated: 2026-08-23

Goal: publish **Speckit for Humans** to the VS Code Marketplace and Open VSX
without exposing any personal contact details, and make every `.vsix` a
downloadable asset on a GitHub Release.

---

## 1. Name scrub — DONE

The old company (`concretio`) and the old product name (`Markdown for Humans` /
`MD4H`) were removed from the shipping code and docs.

| What | Where | Result |
| --- | --- | --- |
| Publisher ID | `package.json` | `concretio` → `agenticminds` |
| Install ID and store links | `README.md`, `src/editor/MarkdownEditorProvider.ts`, `docs/BUILD.md`, `docs/RELEASE_CHECKLIST.md` | `concretio.speckit-for-humans` → `agenticminds.speckit-for-humans` |
| Old product name | `wiki/Spec-Kit-ID-Links.md` | `Markdown for Humans` → `Speckit for Humans` |
| Console log tag | 234 sites across `src/**` | `[MD4H]` → `[Speckit]` |
| Personal file path | `specs/001-speckit-id-links/quickstart.md` | `/Users/marty/...` → `/path/to/...` |

Verified after the scrub: lint clean, 1507 tests pass, `bun run build:release`
passes build verification.

### Deliberately left alone

- `.github/workflows/ai-review.yml` still calls the third-party action
  `concretios/ai-pr-reviewer`. That is an outside tool, not our branding.
  Changing it breaks AI review on PRs. Replace it only if we drop that reviewer.
- The CSS class prefix `md4h-` is still used across `src/webview/**`. Users
  never see it, and renaming it risks silently breaking styles. Cosmetic only.

---

## 2. Privacy — do not dox the maintainer

The VS Code Marketplace does **not** require a home address or a phone number.
A public listing shows only the publisher display name, the icon, and the
links already set in `package.json` (`repository`, `bugs`, `homepage`). All of
those point at `agenticminds.ai` and the `agenticminds` GitHub org.

The legal docs (`EULA.md`, `PRIVACY_POLICY.md`, `TERMS_OF_USE.md`,
`CODE_OF_CONDUCT.md`) already use `legal@`, `privacy@` and `support@` at
`agenticminds.ai`. No postal address appears in any of them.

Two real leaks remain. Both are outside this repo.

- [ ] **Enable WHOIS privacy on `agenticminds.ai`.** Without it the registrar
      publishes the registrant address. This is the single biggest exposure.
- [ ] **Stop committing a personal email.** Commits currently carry
      `marty.saxton@gmail.com`, which is public on a public repo. Fix with:
      ```bash
      git config user.email "<id>+martysaxton@users.noreply.github.com"
      ```
      Get the exact noreply address from GitHub → Settings → Emails.
- [ ] Optional: consider whether the GitHub profile name and org owner list
      should stay public.

Open VSX note: publishing there requires an Eclipse Foundation account and a
signed Eclipse Contributor Agreement, which uses a legal name. ECA signatories
are listed publicly. If that is unacceptable, ship to the VS Code Marketplace
only and let people sideload the `.vsix` from GitHub Releases (see §4).

---

## 3. Pre-publish checklist

- [ ] Register the publisher ID `agenticminds` at
      <https://marketplace.visualstudio.com/manage>. Needs a free Microsoft
      account and an Azure DevOps organisation. That account data stays private.
- [ ] Create a Personal Access Token with the **Marketplace → Manage** scope.
- [ ] Optional but recommended: claim the **Verified Publisher** badge by adding
      one DNS TXT record for `agenticminds.ai`. It reveals only the domain.
- [ ] Commit the in-flight soft-break work (currently modified:
      `CHANGELOG.md`, `package.json`, `src/editor/MarkdownEditorProvider.ts`,
      `src/webview/editor.css`, `src/webview/editor.ts`, plus the new
      `src/webview/utils/softBreakFlow.ts` and its test).
- [ ] Turn the `## [Unreleased]` section of `CHANGELOG.md` into `## [0.4.0]`
      with a date, and set `"version": "0.4.0"` in `package.json`.
- [ ] Delete the stale artifact `markdown-for-humans-0.3.0.vsix`. It carries the
      old name.
- [ ] Re-check the store assets in `marketplace-assets/` for the old name.
- [ ] Run `bun run validate` one last time.

---

## 4. How releases work

### Today (before this change)

Everything is manual, described in `docs/RELEASE_CHECKLIST.md`:

1. Edit `CHANGELOG.md` (single source of truth — never create
   `RELEASE_NOTES_*.md`).
2. `bun run validate`.
3. `vsce publish` → pushes to the VS Code Marketplace and auto-bumps the version.
4. `ovsx publish` → pushes to Open VSX for Cursor, Windsurf and VSCodium.
5. Tag by hand, then create a GitHub Release by hand in the web UI.

`.github/workflows/ci.yml` already packages a `.vsix` on every push and PR, but
only as a **build artifact with 7-day retention**. It is not a release download
and it disappears.

### New: `.github/workflows/release.yml`

Added in this change. Pushing a `v*` tag now produces a real GitHub Release with
the `.vsix` attached as a permanent download.

```bash
# after the version bump is committed and merged to main
git tag v0.4.0
git push origin v0.4.0
```

The workflow then:

1. Checks out, installs with `bun install --frozen-lockfile`.
2. Runs `bun run lint` and `bun run test`.
3. Runs `bun run package:release` (which chains
   `vscode:prepublish` → `build:release` → `verify-build` → `vsce package`).
4. Fails loudly if the tag version and `package.json` version disagree.
5. Creates the release with the preinstalled `gh` CLI and uploads the `.vsix`.

Design notes:

- `permissions: contents: write` is the only grant. Everything else is denied at
  the top level, matching the posture of `ci.yml`.
- The release is created with `gh release create --verify-tag` instead of a
  third-party release action, so there is no new supply-chain dependency to pin.
- Existing actions stay pinned to the same commit SHAs already used in `ci.yml`.

### Recommended order for a release

1. Bump `CHANGELOG.md` and `package.json`, commit, merge to `main`.
2. `vsce publish` and `ovsx publish` from a clean checkout of `main`.
3. `git tag vX.Y.Z && git push origin vX.Y.Z` → the workflow builds the release
   and attaches the `.vsix`.
4. Edit the generated release notes if you want the polished, emoji version from
   `CHANGELOG.md`.

Publishing to the stores is still deliberately manual. Automating it would mean
storing a Marketplace PAT as a repository secret, which is a larger blast radius
than the current AI-review secret. Revisit once release cadence justifies it.

---

## 5. Post-release verification

- [ ] Listing live at
      <https://marketplace.visualstudio.com/items?itemName=agenticminds.speckit-for-humans>
- [ ] Listing live at
      <https://open-vsx.org/extension/agenticminds/speckit-for-humans>
- [ ] GitHub Release shows the `.vsix` under Assets and it installs with
      `code --install-extension speckit-for-humans-X.Y.Z.vsix`
- [ ] README badges resolve (they point at the new publisher).
- [ ] Install from the store in a clean VS Code profile and open a `.md` file.
