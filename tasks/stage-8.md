# Stage 8: Claude controls

At the end of this stage the owner manages Claude Code from buttons instead of typed commands: past sessions of every project can be renamed, noted and deleted; skills can be turned on and off and their folder opened; and the HUD quick bar changes model, effort and mode, compacts, clears, and opens Claude's own screens.

---

## 099 Rename, notes and delete for sessions

**Goal.** Any past session, from any project, can be renamed, given a note, or moved to the Recycle Bin.

**Stage.** 8

**Read first.** `spec/modules/sessions.md` "What Claude Code does", SESS-5, SESS-23, SESS-30, SESS-60 to SESS-63, `spec/contracts/channels/sessions.ts`, `spec/modules/claude-link.md` LINK-6.

**Files.** `src/modules/sessions/service/manage-sessions.ts`, `src/modules/sessions/service/trash-paths.ts`, `src/modules/sessions/service/list-sessions.ts`, `src/modules/sessions/service/record-store.ts`, `src/modules/sessions/service/hook-handler.ts`, `src/modules/sessions/register.service.ts`.

**Steps.**
1. `list-sessions.ts`: `projectPath: null` (every project folder, skipping anything that is not a `.jsonl` file directly inside one), the new title order, and `note`.
2. `trash-paths.ts`: the SESS-62 path check as a pure function. Every move goes through it.
3. `manage-sessions.ts`: SESS-60 to SESS-63 and the `rename`, `setNote` and `trash` handlers.
4. `hook-handler.ts`: when a record leaves `running` with `pendingTitleLine`, append the title line (SESS-61).

**Tests.** `tests/sessions/manage-sessions.test.ts`: SESS-60, SESS-61, SESS-62 and SESS-63 rows. `tests/sessions/trash-paths.test.ts`: the SESS-62 unit row. `tests/sessions/list-sessions.test.ts`: the new SESS-30 rows. Update the SESS-23 row's test to skip SESS-62 tests.

**Done when.** Tests pass.

**Commit.** `feat(sessions): rename, note and delete sessions`

---

## 100 Session history panel

**Goal.** One panel lists the sessions of every project and manages them.

**Stage.** 8

**Read first.** `spec/modules/sessions.md` SESS-31, SESS-32, SESS-50, SESS-70 to SESS-77, "Commands", "States", `spec/design/` for the danger and warning tones.

**Files.** `src/modules/sessions/panel/SessionHistory.tsx`, `src/modules/sessions/panel/SessionHistory.module.css`, `src/modules/sessions/panel/history-filter.ts`, `src/modules/sessions/panel/RenameDialog.tsx`, `src/modules/sessions/panel/NoteDialog.tsx`, `src/modules/sessions/panel/TranscriptPanel.tsx`, `src/modules/sessions/register.ui.ts`.

**Steps.**
1. `history-filter.ts`: the SESS-71 search and filters and the SESS-72 grouping, as pure functions.
2. `SessionHistory.tsx`: SESS-70, SESS-72, SESS-73 and SESS-76, reusing the SESS-32 row actions from the picker.
3. The two dialogs (SESS-74, SESS-75), also used by the reader header (SESS-77).

**Tests.** `tests/sessions/history.ui.test.tsx`: SESS-71, SESS-72, SESS-74, SESS-76 rows.

**Done when.** Tests pass. Feature `F-062` passes.

**Commit.** `feat(sessions): add session history panel`

---

## 101 Skill state and skills folder

**Goal.** The skills deck can turn a skill on or off the way `/skills` does, and opens the skills folder.

**Stage.** 8

**Read first.** `spec/modules/skills.md` SKILL-7 to SKILL-10, `spec/contracts/channels/skills.ts`, `spec/modules/shell.md` SHELL-30, `spec/modules/hud.md` HUD-34 to HUD-37, `spec/modules/claude-link.md` LINK-6.

**Files.** `src/modules/skills/service/skill-state.ts`, `src/modules/skills/service/edit-settings-file.ts`, `src/modules/skills/service/skill-index.ts`, `src/modules/skills/register.service.ts`, `src/main/system/system-channels.ts`, `src/modules/hud/panel/SkillsSection.tsx`, `src/modules/hud/panel/SkillStateMenu.tsx`.

**Steps.**
1. `skill-state.ts`: SKILL-8 as a pure function from the parsed settings files and the skill list. Watch the three files.
2. `edit-settings-file.ts`: SKILL-9 steps 3 to 7. It is the only code in HSOS that writes a Claude Code settings file, and it only ever changes `skillOverrides[name]`.
3. `openSkillsFolder` (SKILL-7), and `openFolder` in `system-channels.ts` (SHELL-30).
4. The deck: HUD-34 to HUD-37.

**Tests.** `tests/skills/skill-state.test.ts`: SKILL-8 rows. `tests/skills/edit-settings-file.test.ts`: SKILL-9 and SKILL-10 rows, on temp files only. `tests/skills/open-folder.test.ts`: SKILL-7. `tests/shell/open-folder.test.ts`: SHELL-30. `tests/hud/skills-deck.ui.test.tsx`: HUD-35 to HUD-37 rows. Never touch the real `%USERPROFILE%\.claude` folder in a test.

**Done when.** Tests pass. Feature `F-063` passes.

**Commit.** `feat(skills): set skill state and open the skills folder`

---

## 102 Quick bar

**Goal.** Claude's common commands are buttons in the HUD, and none of them can send a half-typed prompt.

**Stage.** 8

**Read first.** `spec/modules/hud.md` "Quick bar", HUD-60 to HUD-68, `spec/modules/terminal.md` TERM-74, `spec/modules/claude-link.md` LINK-40, LINK-44, `spec/contracts/channels/claude-link.ts` (`ClaudeSession`), `spec/contracts/channels/hud.ts`.

**Files.** `src/modules/claude-link/service/statusline.ts`, `src/modules/claude-link/service/apply-hook.ts`, `src/modules/terminal/service/terminal-registry.ts`, `src/modules/terminal/register.service.ts`, `src/modules/hud/panel/QuickBar.tsx`, `src/modules/hud/panel/QuickBar.module.css`, `src/modules/hud/panel/send-quick-command.ts`, `src/modules/hud/panel/QuickDialogs.tsx`, `src/modules/hud/panel/HudPanel.tsx`.

**Steps.**
1. LINK-40's new fields in `statusline.ts`; LINK-44 in `apply-hook.ts`.
2. TERM-74: the `source` field on `write` and `getLastOwnerInput`.
3. `send-quick-command.ts`: HUD-63 as one function that takes the session, the last owner input and the command, and returns what to write and whether to toast. Every button goes through it, except the mode button (HUD-64).
4. `QuickBar.tsx` and `QuickDialogs.tsx`: HUD-60 to HUD-62 and HUD-64 to HUD-67.

**Tests.** `tests/claude-link/statusline.test.ts`: the LINK-40 row. `tests/claude-link/apply-hook.test.ts`: LINK-44. `tests/terminal/owner-input.test.ts`: TERM-74. `tests/hud/send-quick-command.test.ts`: the HUD-63 rows. `tests/hud/quick-bar.ui.test.tsx`: HUD-60 to HUD-62, HUD-64 to HUD-68 rows.

**Done when.** Tests pass. Feature `F-064` passes.

**Commit.** `feat(hud): add the quick bar of Claude commands`

---

## 103 Stage 8 checks

**Goal.** Stage 8 works end to end.

**Stage.** 8

**Read first.** `spec/modules/sessions.md`, `skills.md` and `hud.md` "Tests".

**Files.** `tests/e2e/stage-8.e2e.ts`.

**Steps.** An end-to-end run with `FakeClaude`, a temp home and a fake Recycle Bin: two projects with one session each; open Session History with "All projects" and check both rows; rename one and check its transcript's last line; delete the other and check its four paths went to the fake bin and its row is gone; set a skill to "Off" from the deck and check only `skillOverrides` changed in the temp user settings file; with an `idle` session, press the model button's `sonnet` and check the stub terminal received `/model sonnet\r`; type a character into that terminal and press it again, and check no `\r` was written.

**Tests.** That file.

**Done when.** Tests pass. The stage-8 app packages with `npm run dist`.

**Commit.** `test: prove stage 8 end to end`
