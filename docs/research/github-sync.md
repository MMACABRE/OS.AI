# GitHub login and sync mechanics

Ticket: "GitHub login and sync mechanics". Researched 2026-11-17 in the main session.

Marks: **[V]** checked against the named source today. **[U]** from the researcher's own knowledge, not re-checked.

## Summary

1. The owner's machine already has the GitHub CLI logged in, with its token in the Windows keyring. [V, `gh auth status` on this machine]
2. The simplest login is to reuse that. `gh auth token` prints the token and refreshes it when needed. HSOS then needs no login screen of its own when `gh` is present. [V]
3. When `gh` is missing or logged out, the OAuth device flow is the right fallback. The app shows an 8-character code, the owner enters it at `https://github.com/login/device`, and the app polls for a token. No client secret is needed. [V]
4. Git operations should run the real `git.exe`, not a git library. It behaves exactly as the owner's own terminal does, with the same credential helper, hooks and config. VS Code works this way. [U]
5. "Seamless sync" must never rewrite or discard work. The safe automatic set is fetch, status, and fast-forward pull. Commit and push stay one click, or become automatic only on an opt-in rule.
6. VS Code's model is a good base: a sync action that pulls before it pushes, and conflicts resolved in an inline or three-way merge editor. [V]

## Login

### Path A: reuse the GitHub CLI [V]

- `gh auth status` reports whether an account is logged in.
- `gh auth token` outputs the token for the active account. Flags: `--hostname`, `--user`, `--no-refresh`.
- HSOS keeps the token in memory only and asks `gh` again when it needs one.

### Path B: OAuth device flow [V]

1. `POST https://github.com/login/device/code` with `client_id` and `scope`.
2. Response: `device_code`, `user_code`, `verification_uri` (`https://github.com/login/device`), `expires_in` 900 seconds, `interval` 5 seconds.
3. Show the `user_code` and open the verification page.
4. Poll `POST https://github.com/login/oauth/access_token` with `client_id`, `device_code` and `grant_type=urn:ietf:params:oauth:grant-type:device_code`, no faster than `interval`.
5. Handle errors: `authorization_pending` (keep polling), `slow_down` (add 5 seconds), `expired_token` (start again), `access_denied` (stop).

Requirements: an OAuth app registered by the owner with device flow enabled. Store the token in Windows Credential Manager. [U for the storage choice]

## Git operations

| Approach | For | Against |
|---|---|---|
| Run `git.exe` | Identical behaviour to the terminal, uses Git Credential Manager, supports every feature [U] | Must parse text output; use porcelain formats |
| isomorphic-git or libgit2 bindings | No dependency on installed git [U] | Missing features, different behaviour, native build problems [U] |

Recommendation: run `git.exe` with machine-readable flags such as `status --porcelain=v2 --branch`.

## Sync behaviour options

| Action | Risk | Proposed default |
|---|---|---|
| Fetch | None | Automatic on a timer and on window focus |
| Show ahead, behind, changed files | None | Always visible |
| Pull, fast-forward only | Low | Automatic when the working tree is clean |
| Pull that needs a merge or rebase | Medium | Ask |
| Commit | Low, local | One click, with a generated message the owner can edit |
| Push | Medium, public | One click |
| Auto commit and push | Medium | Off by default; opt in per repo |
| Force push, reset, clean | High | Never offered by HSOS |

Conflicts: show the conflicted files, open each in a merge view, and offer "abort" at every step.

The existing `agent-hud` mod already has a skills-repo sync row built on these ideas: it compares local and remote, shows ahead and behind, and commits and pushes on a button. [V]

## Not settled

- VS Code's `git.autofetch` period and setting names were not confirmed today.
- How GitHub Desktop and GitButler handle automatic commits.
- Whether the owner wants to register an OAuth app, or rely on `gh` only.

## Sources

- https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
- https://cli.github.com/manual/gh_auth_token
- https://code.visualstudio.com/docs/sourcecontrol/overview
- https://github.com/MMACABRE/SKILLS/tree/main/mods/agent-hud
