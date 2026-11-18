# Stage 3: Claude awareness

At the end of this stage HSOS knows every Claude session in its terminals: who needs the owner, what each is doing, its subagents, the usage limits, what it changed and what it produced. The owner reviews changes, sends feedback, runs skills, syncs with GitHub and starts sessions in worktrees.

`FakeClaude` (`spec/05-testing.md` "Fakes") is built in card 051 and used by every later card in this stage.

---

## 051 Link listener and generated files

**Goal.** `link-service` listens on localhost, writes the plugin, settings and wrapper files, and gives shells the variables.

**Stage.** 3

**Read first.** `spec/modules/claude-link.md` "How Claude Code reports to HSOS", "Files HSOS generates", "Hook entry", "Events registered", "Statusline command", LINK-1 to LINK-7, LINK-10, LINK-13, `spec/modules/terminal.md` TERM-7, `spec/reference/shell-init.ps1`.

**Files.** `src/modules/claude-link/service/link-server.ts`, `src/modules/claude-link/service/generated-files.ts`, `src/modules/claude-link/service/shell-init.ps1` (copy of the reference), `src/modules/claude-link/register.service.ts`, `src/services/link-service/module-list.ts`, `tests/fakes/fake-claude.ts`.

**Steps.**
1. `link-server.ts`: `http.createServer` on `127.0.0.1`, port search, token check, body size limit, routes `/hook/<Event>`, `/statusline`, and a mount point for `/mcp` used in card 080.
2. `generated-files.ts`: writes the four files atomically from the tables. Copy `spec/reference/shell-init.ps1` unchanged, import it as text with Vite's `?raw` suffix, and write it as `shell-init.ps1` (LINK-4).
3. Pass the variables to `terminal.setExtraEnv`. The terminal registry already loads `HSOS_SHELL_INIT` (TERM-7, card 030).
4. `FakeClaude`: posts fixture JSON from `tests/fixtures/claude/` to the server with the right headers. Create the fixtures from the examples in the Claude Code hooks and statusline documentation: one file per event in the "Events registered" table, plus `statusline.json`.

**Tests.** `tests/claude-link/link-server.test.ts`: LINK-1, LINK-2, LINK-6, LINK-10, LINK-13. `tests/claude-link/shell-init.test.ts`: LINK-4 rows.

**Done when.** Tests pass.

**Commit.** `feat(claude-link): listen for Claude Code on localhost`

---

## 052 Hook payloads

**Goal.** Every hook body is validated against a lenient schema and answered at once.

**Stage.** 3

**Read first.** `spec/modules/claude-link.md` LINK-11, LINK-12, LINK-14, "Events registered".

**Files.** `src/modules/claude-link/service/hook-schemas.ts`, `src/modules/claude-link/service/clean-text.ts`, `src/modules/claude-link/service/link-server.ts`.

**Steps.** One zod schema per event with only the fields used in LINK-20 to LINK-60, each using `.passthrough()` style that allows unknown keys. `clean-text.ts` implements LINK-14.

**Tests.** `tests/claude-link/hook-schemas.test.ts`: every fixture parses; a fixture with an extra unknown field parses; LINK-11, LINK-12, LINK-14 rows.

**Done when.** Tests pass.

**Commit.** `feat(claude-link): validate hook payloads`

---

## 053 Session registry

**Goal.** HSOS tracks each Claude session's activity.

**Stage.** 3

**Read first.** `spec/modules/claude-link.md` LINK-20 to LINK-27, `ClaudeSession` and `SessionActivity` in `spec/contracts/channels/claude-link.ts`.

**Files.** `src/modules/claude-link/service/session-registry.ts`, `src/modules/claude-link/service/apply-hook.ts`, `src/modules/claude-link/register.service.ts`.

**Steps.** `apply-hook.ts` is a pure function `(session, event) => session` implementing the LINK-21 table. The registry holds sessions, throttles events (LINK-27), and handles `markSeen`, `listSessions`, terminal exits and retention.

**Tests.** `tests/claude-link/apply-hook.test.ts`: LINK-21 (every row), LINK-22, LINK-24. `tests/claude-link/session-registry.test.ts`: LINK-20, LINK-25, LINK-26, LINK-27.

**Done when.** Tests pass. Feature `F-027` passes.

**Commit.** `feat(claude-link): track Claude sessions`

---

## 054 Subagents and snapshot before edit

**Goal.** Subagents with their model when known, and a snapshot of every file before Claude edits it.

**Stage.** 3

**Read first.** `spec/modules/claude-link.md` LINK-23, LINK-28 to LINK-30, `history.snapshotNow` in `spec/contracts/channels/history.ts`, HIST-7.

**Files.** `src/modules/claude-link/service/subagents.ts`, `src/modules/claude-link/service/snapshot-before-edit.ts`, `src/modules/claude-link/service/apply-hook.ts`, `src/modules/claude-link/service/link-server.ts`.

**Steps.** Implement LINK-23, LINK-28, LINK-29, LINK-30. The pre-edit hook route awaits the snapshot with a 1 500 ms limit before replying.

**Tests.** `tests/claude-link/subagents.test.ts`: LINK-23, LINK-28 rows, LINK-29. `tests/claude-link/snapshot-before-edit.test.ts`: LINK-30 rows, using a real `workspace-service` history store in one process.

**Done when.** Tests pass. Feature `F-028` passes.

**Commit.** `feat(claude-link): track subagents and snapshot before edits`

---

## 055 Usage, statusline and session events

**Goal.** Usage limits, context and cost arrive, and each session's events are kept.

**Stage.** 3

**Read first.** `spec/modules/claude-link.md` LINK-40 to LINK-43, LINK-50, LINK-60, LINK-61.

**Files.** `src/modules/claude-link/service/statusline.ts`, `src/modules/claude-link/service/usage-limits.ts`, `src/modules/claude-link/service/session-events.ts`, `src/modules/claude-link/register.service.ts`.

**Steps.** Implement the rules and the channels `getUsageLimits`, `usageLimitsChanged`, `getSessionEvents`, `sessionEvent`, `getStatus`.

**Tests.** `tests/claude-link/statusline.test.ts`: LINK-41 rows, LINK-42, LINK-43. `tests/claude-link/session-events.test.ts`: each LINK-60 row; LINK-61 keeps 2 000.

**Done when.** Tests pass. Feature `F-029` passes.

**Commit.** `feat(claude-link): read usage limits and session events`

---

## 056 Session records and launches

**Goal.** Every Claude session started in an HSOS terminal has a record on disk before Claude starts, so no crash can lose it.

**Stage.** 3

**Read first.** `spec/modules/sessions.md` "What Claude Code does", "Files", SESS-1 to SESS-6, `spec/contracts/channels/sessions.ts`, `spec/reference/shell-init.ps1`, `spec/modules/claude-link.md` LINK-2, LINK-4.

**Files.** `src/modules/sessions/service/record-store.ts`, `src/modules/sessions/service/launch-ingest.ts`, `src/modules/sessions/register.service.ts`, `src/services/link-service/module-list.ts`, `tests/fixtures/claude/stub-claude.cmd`.

**Steps.**
1. `record-store.ts`: SESS-5 and SESS-6. Load at start, write with `write-file-atomic`, coalesce the timed writes.
2. `launch-ingest.ts`: SESS-2 and SESS-3.
3. Register `sessionsSection` and add `sessions` after `claude-link` in the link-service module list.
4. `stub-claude.cmd`: a batch file named `claude` that prints `ARGS: ` and its arguments and exits. The wrapper itself is already in place from card 051.

**Tests.** `tests/sessions/wrapper.test.ts`: the three SESS-1 rows, running `powershell.exe` with the stub first on `PATH`; the test fails at once if `Get-Command claude -CommandType Application` does not resolve to the stub, so the real `claude` can never run. `tests/sessions/records.test.ts`: SESS-2, SESS-3, SESS-5, SESS-6 rows.

**Done when.** Tests pass.

**Commit.** `feat(sessions): record every Claude launch before it starts`

---

## 057 Session states and transcript backup

**Goal.** Records follow each session through its hooks, and HSOS keeps its own copy of every transcript.

**Stage.** 3

**Read first.** `spec/modules/sessions.md` SESS-10 to SESS-15, SESS-20 to SESS-23, `spec/modules/claude-link.md` LINK-15, `spec/contracts/channels/claude-link.ts` (`hookObservers`).

**Files.** `src/modules/claude-link/service/link-server.ts`, `src/modules/sessions/service/hook-handler.ts`, `src/modules/sessions/service/transcript-backup.ts`, `src/modules/sessions/service/restore-transcript.ts`, `src/modules/sessions/register.service.ts`.

**Steps.**
1. LINK-15 in `link-server.ts`: after answering a hook, call each `hookObservers` contribution.
2. `hook-handler.ts`: SESS-10 to SESS-15, validating each payload with its own zod schema.
3. `transcript-backup.ts`: SESS-20, SESS-21. `restore-transcript.ts`: SESS-22 and the `restoreTranscript` handler.
4. `bind` handler (SESS-11).

**Tests.** `tests/sessions/hooks.test.ts`: SESS-10 to SESS-15 rows with `FakeClaude`. `tests/sessions/backup.test.ts`: SESS-20 to SESS-23 rows. `tests/claude-link/link-server.test.ts`: LINK-15 row.

**Done when.** Tests pass.

**Commit.** `feat(sessions): track session states and back up transcripts`

---

## 058 Resume after restore

**Goal.** A terminal that comes back without its shell resumes the Claude session it was running.

**Stage.** 3

**Read first.** `spec/modules/sessions.md` SESS-40 to SESS-43, `spec/modules/terminal.md` TERM-24, TERM-25, TERM-57, `spec/contracts/channels/terminal.ts` (`terminalRecovery`).

**Files.** `src/modules/sessions/service/resume-offer.ts`, `src/modules/sessions/panel/recovery.ts`, `src/modules/sessions/register.ui.ts`, `src/ui/module-list.ts`, `src/modules/terminal/panel/attach-or-restore.ts`, `src/modules/terminal/panel/TerminalPanel.tsx`, `tests/e2e/session-recovery-fault.e2e.ts`.

**Steps.**
1. `resume-offer.ts`: SESS-40 and SESS-43, and the `getResumeOffer` handler.
2. `recovery.ts`: SESS-41 and SESS-42, contributed to `terminalRecovery` from `register.ui.ts`.
3. TERM-24 steps 3 to 5, and the offer buttons of TERM-25 and TERM-57, in the terminal panel. These edits to the terminal module are part of this card.
4. The fault test: a second stub, `tests/fixtures/claude/stub-claude-wait.cmd`, prints its arguments and then waits (`ping -n 600 127.0.0.1 >nul`). The test puts it first on `PATH` as `claude`, starts a session through the wrapper, posts its `SessionStart` with `FakeClaude`, kills the whole app tree with `taskkill /F /T /PID <main pid>`, starts the app again, and reads the restored terminal.

**Tests.** `tests/sessions/resume-offer.test.ts`: SESS-13 (`lost-terminal`) and SESS-40 rows. `tests/sessions/recovery.ui.test.tsx`: SESS-41, SESS-42 rows. `tests/terminal/attach.ui.test.tsx`: the new TERM-24, TERM-25 and TERM-57 rows. `tests/e2e/session-recovery-fault.e2e.ts`: the SESS-40, REL-13 row. Leave the manual rows for the owner.

**Done when.** Tests pass. Feature `F-060` passes.

**Commit.** `feat(sessions): resume interrupted Claude sessions on restore`

---

## 059 Session picker and transcript reader

**Goal.** Every session of a project can be found, read and resumed.

**Stage.** 3

**Read first.** `spec/modules/sessions.md` SESS-30 to SESS-32, SESS-50, SESS-51, "Commands", "States".

**Files.** `src/modules/sessions/service/list-sessions.ts`, `src/modules/sessions/service/read-transcript.ts`, `src/modules/sessions/panel/SessionPicker.tsx`, `src/modules/sessions/panel/SessionPicker.module.css`, `src/modules/sessions/panel/TranscriptPanel.tsx`, `src/modules/sessions/panel/TranscriptPanel.module.css`, `src/modules/sessions/register.ui.ts`.

**Steps.**
1. `list-sessions.ts`: SESS-30 with the in-memory cache, and the `list` handler.
2. `read-transcript.ts`: SESS-50's items, and the `readTranscript` handler.
3. `SessionPicker.tsx`: the `sessions.find` dialog, SESS-31 and SESS-32. `TranscriptPanel.tsx`: dock panel `sessions.transcript`, SESS-50 and SESS-51.

**Tests.** `tests/sessions/list.test.ts`: SESS-30 rows. `tests/sessions/transcript.test.ts`: SESS-50 row. `tests/sessions/picker.ui.test.tsx`: SESS-31, SESS-32 rows. `tests/sessions/reader.ui.test.tsx`: SESS-51 row.

**Done when.** Tests pass. Feature `F-061` passes.

**Commit.** `feat(sessions): find, read and resume any Claude session`

---

## 060 Git runner and status

**Goal.** Safe git commands and an accurate status.

**Stage.** 3

**Read first.** `spec/modules/git.md` "Running git", GIT-10 to GIT-13, `spec/reference/git-status-parser.ts`, `spec/contracts/channels/git.ts`.

**Files.** `src/modules/git/service/git-runner.ts`, `src/modules/git/service/assert-safe.ts`, `src/modules/git/service/map-git-error.ts`, `src/modules/git/service/git-status-parser.ts` (copy of the reference), `src/modules/git/service/repo-status.ts`, `src/modules/git/register.service.ts`.

**Steps.** Implement GIT-1 to GIT-7 and GIT-10 to GIT-12. The runner spawns `git` with `child_process.spawn`, an argument array, `windowsHide: true`, and the timeout.

**Tests.** `tests/git/assert-safe.test.ts`: GIT-3 rows including the property test, GIT-4. `tests/git/map-git-error.test.ts`: GIT-7. `tests/git/repo-status.test.ts` with real temp repos: GIT-10, GIT-11, GIT-12. `tests/git/git-status-parser.test.ts`: the reference self-check cases.

**Done when.** Tests pass.

**Commit.** `feat(git): run git safely and read status`

---

## 061 Sync with GitHub

**Goal.** Fetch, pull, push and sync, automatic where safe.

**Stage.** 3

**Read first.** `spec/modules/git.md` GIT-20 to GIT-26, GIT-40 to GIT-42.

**Files.** `src/modules/git/service/sync.ts`, `src/modules/git/service/auto-fetch.ts`, `src/modules/git/service/auto-sync.ts`, `src/modules/git/register.service.ts`.

**Steps.** Implement the rules. `auto-sync.ts` reads session activity from `link.listSessions` and `link.sessionChanged`.

**Tests.** `tests/git/sync.test.ts` with a temp repo and a temp bare remote: GIT-21 rows, GIT-22, GIT-23, GIT-25 rows, GIT-26. `tests/git/auto-sync.test.ts`: GIT-40 rows, GIT-41.

**Done when.** Tests pass. Feature `F-030` passes.

**Commit.** `feat(git): sync with GitHub`

---

## 062 Commits, worktrees and sign-in

**Goal.** Commit with a suggested message, create worktree sessions, and sign in to GitHub.

**Stage.** 3

**Read first.** `spec/modules/git.md` GIT-30 to GIT-32, GIT-50 to GIT-53, GIT-60, GIT-61, `ClaudeRunner` in `spec/contracts/channels/skills.ts`.

**Files.** `src/modules/git/service/commit.ts`, `src/modules/git/service/suggest-message.ts`, `src/modules/git/service/worktrees.ts`, `src/modules/git/service/github-account.ts`, `src/modules/git/register.service.ts`.

**Steps.** Implement the rules. `suggest-message.ts` with `messageGenerator: 'claude'` uses a `ClaudeRunner`; tests use a fake runner only.

**Tests.** `tests/git/commit.test.ts`: GIT-30 rows, GIT-31. `tests/git/worktrees.test.ts`: GIT-50, GIT-52. `tests/git/suggest-message.test.ts`: the `claude` path with a fake runner that fails falls back to the summary.

**Done when.** Tests pass.

**Commit.** `feat(git): commit, worktrees and GitHub sign-in`

---

## 063 Git in the window

**Goal.** The branch button, the changes count and the worktree command.

**Stage.** 3

**Read first.** `spec/modules/git.md` "UI", "Commands", GIT-53.

**Files.** `src/modules/git/panel/BranchButton.tsx`, `src/modules/git/panel/BranchButton.module.css`, `src/modules/git/panel/ChangesStatusItem.tsx`, `src/modules/git/panel/git-errors.ts`, `src/modules/git/panel/new-worktree-session.tsx`, `src/modules/git/register.ui.ts`.

**Steps.** The branch button is placed by `workspace`'s title bar through a status item with `side: 'left'` and `order: -1`; the title bar renders status items with negative order in its own left group. The worktree command opens a dialog for the name, then creates the terminal (GIT-53).

**Tests.** `tests/git/git-ui.ui.test.tsx`: the button text for ahead and behind; each error message from the table; GIT-53 creates a terminal with `worktree` and `launch` set.

**Done when.** Tests pass. Feature `F-031` passes.

**Commit.** `feat(git): show branch and sync in the window`

---

## 064 Skills index

**Goal.** Every skill on the machine, with favourites.

**Stage.** 3

**Read first.** `spec/modules/skills.md` SKILL-1 to SKILL-6, `spec/contracts/channels/skills.ts`.

**Files.** `src/modules/skills/service/skill-index.ts`, `src/modules/skills/service/frontmatter.ts`, `src/modules/skills/service/favourites.ts`, `src/modules/skills/register.service.ts`, `src/services/workspace-service/module-list.ts`.

**Steps.** Implement the rules. Directory junctions are followed with `fs.realpath`.

**Tests.** `tests/skills/skill-index.test.ts`: SKILL-1, SKILL-4, SKILL-5, SKILL-6. `tests/skills/frontmatter.test.ts`: SKILL-2 rows, SKILL-3.

**Done when.** Tests pass.

**Commit.** `feat(skills): index skills and favourites`

---

## 065 Background skill runs

**Goal.** Run a skill on a chosen model and read its report.

**Stage.** 3

**Read first.** `spec/modules/skills.md` SKILL-20 to SKILL-27.

**Files.** `src/modules/skills/service/skill-runs.ts`, `src/modules/skills/service/claude-runner.ts`, `src/modules/skills/register.service.ts`.

**Steps.** `claude-runner.ts` implements `ClaudeRunner` with `child_process.spawn` of `claude` (found on `PATH`), an argument array and `windowsHide: true`. `skill-runs.ts` implements the queue and the rules.

**Tests.** `tests/skills/skill-runs.test.ts` with a fake runner: SKILL-20 to SKILL-25 rows.

**Done when.** Tests pass.

**Commit.** `feat(skills): run skills in the background`

---

## 066 Skills repo sync

**Goal.** The skills folder stays in step with the owner's skills repo, pushing only.

**Stage.** 3

**Read first.** `spec/modules/skills.md` SKILL-30 to SKILL-34.

**Files.** `src/modules/skills/service/repo-sync.ts`, `src/modules/skills/service/hash-folder.ts`, `src/modules/skills/register.service.ts`.

**Steps.** Implement the rules using the `git` channels for fetch, status, pull, commit and push.

**Tests.** `tests/skills/repo-sync.test.ts` with temp folders and a temp remote: SKILL-30 rows, SKILL-32 rows, SKILL-33.

**Done when.** Tests pass.

**Commit.** `feat(skills): sync skills with their repo`

---

## 067 HUD sessions

**Goal.** The attention board, notifications and the status items.

**Stage.** 3

**Read first.** `spec/modules/hud.md` "Panel", HUD-1 to HUD-12, "States", `spec/contracts/channels/hud.ts`.

**Files.** `src/modules/hud/panel/HudPanel.tsx`, `src/modules/hud/panel/HudPanel.module.css`, `src/modules/hud/panel/SessionsSection.tsx`, `src/modules/hud/panel/use-sessions.ts`, `src/modules/hud/panel/notify-on-change.ts`, `src/modules/hud/register.ui.ts`, `src/modules/hud/register.service.ts`.

**Steps.** Build the panel frame with four sections, each its own error boundary. Build the sessions section and the rules. Register `hud.attention`.

**Tests.** `tests/hud/sessions.ui.test.tsx`: HUD-1 to HUD-9 rows. `tests/hud/notify.ui.test.tsx`: HUD-10, HUD-11, HUD-12.

**Done when.** Tests pass. Feature `F-032` passes.

**Commit.** `feat(hud): show Claude sessions and who needs you`

---

## 068 HUD usage, skills deck and repo row

**Goal.** Usage bars, the skills deck and the skills repo row.

**Stage.** 3

**Read first.** `spec/modules/hud.md` HUD-25 to HUD-27, HUD-30 to HUD-34, HUD-40, HUD-41.

**Files.** `src/modules/hud/panel/UsageSection.tsx`, `src/modules/hud/panel/format-usage.ts`, `src/modules/hud/panel/SkillsSection.tsx`, `src/modules/hud/panel/RunSkillDialog.tsx`, `src/modules/hud/panel/RepoSection.tsx`, `src/modules/hud/register.ui.ts`.

**Steps.** Build the three sections and the two usage status items.

**Tests.** `tests/hud/format-usage.test.ts`: HUD-25 rows. `tests/hud/usage.ui.test.tsx`: HUD-26. `tests/hud/skills.ui.test.tsx`: HUD-30 to HUD-32 rows. `tests/hud/repo.ui.test.tsx`: HUD-40. `tests/hud/isolation.ui.test.tsx`: the P-12 row.

**Done when.** Tests pass. Features `F-033`, `F-034` pass.

**Commit.** `feat(hud): show usage, skills and the skills repo`

---

## 069 Session recap

**Goal.** Coming back to a terminal shows what happened while away.

**Stage.** 3

**Read first.** `spec/modules/hud.md` HUD-20 to HUD-22.

**Files.** `src/modules/hud/panel/recap-text.ts`, `src/modules/hud/panel/RecapStrip.tsx`, `src/modules/hud/panel/RecapStrip.module.css`, `src/modules/terminal/panel/TerminalPanel.tsx`.

**Steps.** `terminal` renders a slot above the xterm area filled through a `ui-kit` slot registry; `hud` fills it with the strip. Add `src/modules/ui-kit/slots.ts` for that (this card may create it). The terminal never imports `hud`.

**Tests.** `tests/hud/recap-text.test.ts`: HUD-21 rows. `tests/hud/recap.ui.test.tsx`: HUD-20, HUD-22.

**Done when.** Tests pass. Feature `F-035` passes.

**Commit.** `feat(hud): recap what a session did while away`

---

## 070 Activity timeline

**Goal.** One list of every change and who made it.

**Stage.** 3

**Read first.** `spec/modules/activity.md` ACT-1 to ACT-16, "States", `spec/contracts/channels/activity.ts`.

**Files.** `src/modules/activity/service/timeline.ts`, `src/modules/activity/service/match-cause.ts`, `src/modules/activity/panel/ActivityView.tsx`, `src/modules/activity/panel/ActivityView.module.css`, `src/modules/activity/register.service.ts`, `src/modules/activity/register.ui.ts`.

**Steps.** Implement the service rules and the view. `workspace-service` receives `link.sessionEvent` through the broker.

**Tests.** `tests/activity/timeline.test.ts`: ACT-1 to ACT-5 rows. `tests/activity/group.test.ts`: ACT-11. `tests/activity/activity-view.ui.test.tsx`: ACT-15, states.

**Done when.** Tests pass. Feature `F-036` passes.

**Commit.** `feat(activity): add the activity timeline`

---

## 071 Artifacts inbox

**Goal.** Everything Claude made, in one searchable place.

**Stage.** 3

**Read first.** `spec/modules/activity.md` ACT-20 to ACT-34.

**Files.** `src/modules/activity/service/artifacts.ts`, `src/modules/activity/panel/ArtifactsView.tsx`, `src/modules/activity/panel/ArtifactsView.module.css`, `src/modules/activity/panel/artifact-actions.ts`, `src/modules/activity/register.service.ts`, `src/modules/activity/register.ui.ts`.

**Steps.** Implement the rules. Thumbnails use the `hsos-file:` protocol, which this card registers in `main` through `src/main/system/file-protocol.ts` (this card may create it), serving only files allowed by SEC-4.

**Tests.** `tests/activity/artifacts.test.ts`: ACT-20 rows, ACT-22, ACT-23, the P-4 row. `tests/activity/artifacts-view.ui.test.tsx`: ACT-33. `tests/shell/file-protocol.test.ts`: a path outside the allowed roots returns 403.

**Done when.** Tests pass. Feature `F-037` passes.

**Commit.** `feat(activity): add the artifacts inbox`

---

## 072 Changes and diffs

**Goal.** See what changed since the last commit or since a session began, live.

**Stage.** 3

**Read first.** `spec/modules/review.md` REV-1 to REV-5, REV-10 to REV-15, REV-20 to REV-25, `spec/contracts/channels/review.ts`.

**Files.** `src/modules/review/service/change-lists.ts`, `src/modules/review/panel/ChangesView.tsx`, `src/modules/review/panel/ChangesView.module.css`, `src/modules/review/panel/DiffPanel.tsx`, `src/modules/review/register.service.ts`, `src/modules/review/register.ui.ts`.

**Steps.** Implement the rules except comments (card 073).

**Tests.** `tests/review/change-lists.test.ts`: REV-1 to REV-5 rows. `tests/review/changes-view.ui.test.tsx`: REV-12, REV-14. `tests/review/diff-panel.ui.test.tsx`: REV-20.

**Done when.** Tests pass. Feature `F-038` passes.

**Commit.** `feat(review): show changes and live diffs`

---

## 073 Feedback tray

**Goal.** Pin comments and send them to Claude in one go.

**Stage.** 3

**Read first.** `spec/modules/review.md` REV-23, REV-24, REV-30 to REV-37.

**Files.** `src/modules/review/service/comments.ts`, `src/modules/review/service/compose-prompt.ts`, `src/modules/review/panel/FeedbackTray.tsx`, `src/modules/review/panel/LineCommentBox.tsx`, `src/modules/review/panel/DiffPanel.tsx`, `src/modules/review/register.ui.ts`.

**Steps.** Implement the rules. "Send to Claude" uses the terminal's paste path through a `terminal.paste` panel command that `terminal` registers in this card (`src/modules/terminal/panel/terminal-commands.ts` may be changed for it).

**Tests.** `tests/review/compose-prompt.test.ts`: REV-31 rows. `tests/review/comments.test.ts`: REV-37. `tests/review/tray.ui.test.tsx`: REV-23, REV-33, REV-34.

**Done when.** Tests pass. Feature `F-039` passes.

**Commit.** `feat(review): pin feedback and send it to Claude`

---

## 074 Stage 3 checks

**Goal.** Stage 3 works end to end with `FakeClaude`, and survives a `link-service` crash.

**Stage.** 3

**Read first.** `spec/05-testing.md` REL-5, "Tests that spend usage".

**Files.** `tests/e2e/stage-3.e2e.ts`, `tests/e2e/stage-3-fault.e2e.ts`.

**Steps.**
1. Put `tests/fixtures/claude/stub-claude.cmd` (card 056) first on `PATH` for the test app.
2. E2E: open a project; `terminal.newClaude`; the stub prints `--plugin-dir`, `--settings`, `--mcp-config` and `--session-id` arguments; `sessions.find` lists the session; `FakeClaude` posts a session that needs the owner; the HUD shows it first; the status item reads `1 need you`; a `file-edit` event and an outside write to that file appear in Activity as Claude's change; the Changes view lists the file; a pinned comment is pasted into the terminal.
3. Fault: REL-5.

**Tests.** Those files.

**Done when.** Tests pass. Feature `F-040` passes.

**Commit.** `test: prove stage 3 end to end`
