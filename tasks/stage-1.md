# Stage 1: Terminal

At the end of this stage the owner opens a project and works in PowerShell and Claude Code in tabs and splits. Shells survive a UI reload, and the layout and terminal history come back after a restart. Stage 1 alone is usable as a daily terminal.

---

## 038 Projects

**Goal.** Open, switch and remember projects.

**Stage.** 1

**Read first.** `spec/modules/workspace.md` WS-1 to WS-6, `spec/contracts/channels/workspace.ts`, `spec/02-architecture.md` §5 (`projectId`).

**Files.** `src/modules/workspace/service/project-store.ts`, `src/modules/workspace/service/project-id.ts`, `src/modules/workspace/register.service.ts`, `src/main/module-list.ts`.

**Steps.** Implement WS-1 to WS-3 and the project channels. `project-id.ts` computes `ProjectId` from a path.

**Tests.** `tests/workspace/project-store.test.ts`: WS-1, WS-2 rows; `projectId` of `c:/Work/App/` equals that of `C:\Work\App`.

**Done when.** Tests pass.

**Commit.** `feat(workspace): open and remember projects`

---

## 039 App frame

**Goal.** The title bar, side view tabs, side and right areas, and status bar.

**Stage.** 1

**Read first.** `spec/design/layout.md` "Anatomy", "Areas", "Narrow windows", `spec/modules/workspace.md` WS-5, WS-6, WS-30 to WS-33.

**Files.** `src/modules/workspace/panel/AppFrame.tsx`, `src/modules/workspace/panel/AppFrame.module.css`, `src/modules/workspace/panel/TitleBar.tsx`, `src/modules/workspace/panel/ActivityRail.tsx`, `src/modules/workspace/panel/StatusBar.tsx`, `src/modules/workspace/panel/WelcomeView.tsx`.

**Steps.** Build the frame from the layout. The title bar's drag region uses `-webkit-app-region: drag` except over controls. The welcome view shows when no project is open.

**Tests.** `tests/workspace/app-frame.ui.test.tsx`: WS-30, WS-31 (double-click resets width), WS-32, WS-33; the welcome view lists recent projects and Enter opens one.

**Done when.** Tests pass.

**Commit.** `feat(workspace): add the app frame`

---

## 040 Dock and panel registry

**Goal.** Panels open, split, tab and move in the dock.

**Stage.** 1

**Read first.** `spec/modules/workspace.md` WS-10 to WS-15, WS-34, WS-35, "Commands", `spec/design/layout.md` "Dock behaviour", `PanelDefinition` in `spec/contracts/module.ts`.

**Files.** `src/modules/workspace/panel/Dock.tsx`, `src/modules/workspace/panel/Dock.module.css`, `src/modules/workspace/panel/panel-registry.ts`, `src/modules/workspace/panel/PanelHost.tsx`, `src/modules/workspace/register.ui.ts`, `src/modules/settings/register.ui.ts`.

**Steps.** Wrap `dockview`. `PanelHost` gives each panel its props and an error boundary (WS-13). Register the workspace commands. Turn the settings screen into the dock panel `settings.screen`.

**Tests.** `tests/workspace/dock.ui.test.tsx`: WS-10, WS-11, WS-13, `Ctrl+W` closes, `Ctrl+\` splits.

**Done when.** Tests pass.

**Commit.** `feat(workspace): add the dock`

---

## 041 Save and restore

**Goal.** The workspace of each project comes back exactly as it was.

**Stage.** 1

**Read first.** `spec/modules/workspace.md` WS-20 to WS-25, `WorkspaceFile` in `spec/contracts/channels/workspace.ts`.

**Files.** `src/modules/workspace/service/workspace-files.ts`, `src/modules/workspace/panel/workspace-sync.ts`, `src/modules/workspace/panel/restore-workspace.ts`, `src/modules/workspace/register.ui.ts`.

**Steps.** Implement WS-20 to WS-25 and WS-4.

**Tests.** `tests/workspace/restore.test.ts`: WS-22 rows. `tests/workspace/workspace-sync.ui.test.tsx`: WS-20, WS-24. `tests/e2e/workspace.e2e.ts`: WS-23, and the "two splits and three tabs" row.

**Done when.** Tests pass. Features `F-011`, `F-012` pass.

**Commit.** `feat(workspace): save and restore workspaces`

---

## 042 Terminal registry

**Goal.** `pty-host` creates, writes to, resizes and kills shells.

**Stage.** 1

**Read first.** `spec/modules/terminal.md` TERM-1 to TERM-8, TERM-42, TERM-48, `spec/contracts/channels/terminal.ts`, `spec/reference/terminal-init.ps1`.

**Files.** `src/modules/terminal/service/terminal-registry.ts`, `src/modules/terminal/service/resolve-shell.ts`, `src/modules/terminal/service/shell-env.ts`, `src/modules/terminal/service/terminal-init.ps1` (copy of the reference), `src/modules/terminal/service/write-terminal-init.ts`, `src/modules/terminal/service/host-info.ts`, `src/modules/terminal/register.service.ts`, `src/services/pty-host/module-list.ts`, `src/services/pty-host/index.ts`, `tests/fakes/fake-pty.ts`.

**Steps.** Implement TERM-1 to TERM-8, `create`, `list`, `write`, `resize`, `kill`, `isBusy` (true when `powershell.exe -NoProfile -Command "(Get-CimInstance Win32_Process -Filter 'ParentProcessId=<pid>').Count"` prints a number above 0; started with an argument array and a 2 000 ms timeout; false on timeout), `setExtraEnv`, `hostInfo` (TERM-48, service side). `shell-env.ts` builds the TERM-2 environment. Copy `terminal-init.ps1` unchanged and import it as text with Vite's `?raw` suffix; `write-terminal-init.ts` writes it with `write-file-atomic`. `FakePty` implements `PtyProcess` and `PtyFactory`.

**Tests.** `tests/terminal/terminal-registry.test.ts`: TERM-2 to TERM-8 integration rows, TERM-48 integration row. `tests/e2e/terminal-init.e2e.ts`: TERM-7 e2e row.

**Done when.** Tests pass.

**Commit.** `feat(terminal): manage shells in pty-host`

---

## 043 Output and reattach buffer

**Goal.** Output is batched, numbered and kept for reattach.

**Stage.** 1

**Read first.** `spec/modules/terminal.md` TERM-10 to TERM-12, TERM-20 to TERM-22, `spec/reference/ring-buffer.ts`.

**Files.** `src/modules/terminal/service/ring-buffer.ts` (copy of the reference), `src/modules/terminal/service/output-pump.ts`, `src/modules/terminal/service/terminal-registry.ts`.

**Steps.** Copy the ring buffer. Implement the pump and `attach`.

**Tests.** `tests/terminal/output-pump.test.ts`: TERM-10, TERM-11, TERM-21 (service row). `tests/terminal/ring-buffer.test.ts`: the three cases of the reference self-check as vitest tests.

**Done when.** Tests pass.

**Commit.** `feat(terminal): batch output and keep a replay buffer`

---

## 044 Flow control

**Goal.** A flood of output cannot freeze the UI, and one terminal never slows another.

**Stage.** 1

**Read first.** `spec/modules/terminal.md` TERM-30 to TERM-33.

**Files.** `src/modules/terminal/service/flow-control.ts`, `src/modules/terminal/service/output-pump.ts`.

**Steps.** Implement TERM-31 to TERM-33 and the `ack` handler.

**Tests.** `tests/terminal/flow-control.test.ts`: TERM-31, TERM-32, TERM-33.

**Done when.** Tests pass.

**Commit.** `feat(terminal): apply flow control per terminal`

---

## 045 Terminal view

**Goal.** A terminal panel draws a shell with the theme's colours and the GPU renderer.

**Stage.** 1

**Read first.** `spec/modules/terminal.md` TERM-30, TERM-51 to TERM-54, TERM-56, TERM-57, "Panel".

**Files.** `src/modules/terminal/panel/TerminalPanel.tsx`, `src/modules/terminal/panel/TerminalPanel.module.css`, `src/modules/terminal/panel/create-xterm.ts`, `src/modules/terminal/panel/xterm-theme.ts`, `src/modules/terminal/register.ui.ts`, `src/ui/module-list.ts`.

**Steps.** Build the panel: on mount `create`, then stream `data` events into xterm with acks (TERM-30). Apply TERM-51 to TERM-54, TERM-56, TERM-57. Load the addons from `03-stack.md`.

**Tests.** `tests/terminal/terminal-panel.ui.test.tsx` with a fake bus and xterm in jsdom: TERM-52; a data event is written to the view; the exit line shows. `tests/e2e/terminal.e2e.ts`: TERM-1 row.

**Done when.** Tests pass. Feature `F-013` passes.

**Commit.** `feat(terminal): add the terminal panel`

---

## 046 Terminal input

**Goal.** Keys, paste and drops behave as a careful terminal should.

**Stage.** 1

**Read first.** `spec/modules/terminal.md` TERM-40 to TERM-49, TERM-55, `docs/research/terminal-best-of-both.md` "Finding 2".

**Files.** `src/modules/terminal/panel/terminal-keys.ts`, `src/modules/terminal/panel/paste-pipeline.ts`, `src/modules/terminal/panel/paste-guard.ts`, `src/modules/terminal/panel/drop-paths.ts`, `src/modules/terminal/panel/elevation-notice.tsx`, `src/modules/terminal/panel/TerminalPanel.tsx`, `tests/e2e/helpers/send-input.ps1`.

**Steps.** Implement the rules. `paste-pipeline.ts` is the one path of TERM-46; every paste source calls it. `send-input.ps1` is the e2e helper that sets the clipboard and presses keys through Windows: `Set-Clipboard`, then `Add-Type -AssemblyName System.Windows.Forms` and `[System.Windows.Forms.SendKeys]::SendWait('+{INSERT}')` or `('^v')`, then the optional second `Set-Clipboard` after the given delay. Links (TERM-55) use `@xterm/addon-web-links`; file-path links with a line number open through `workspace` `openPanel('files.viewer', { path, line })`, which exists after card 056. Until then they do nothing.

**Tests.** `tests/terminal/terminal-input.ui.test.tsx`: TERM-41, TERM-43, TERM-44, TERM-46, TERM-48 and TERM-49 component rows. `tests/e2e/terminal-input.e2e.ts`: TERM-45 and the two TERM-46, TERM-47 rows. Leave the TERM-47 manual row for the owner.

**Done when.** Tests pass. Features `F-014` and `F-055` pass.

**Commit.** `feat(terminal): handle keys, paste and drops`

---

## 047 Reattach and restore

**Goal.** Shells survive a UI reload, and history returns after a restart.

**Stage.** 1

**Read first.** `spec/modules/terminal.md` TERM-21 to TERM-25, TERM-50.

**Files.** `src/modules/terminal/panel/attach-or-restore.ts`, `src/modules/terminal/panel/TerminalPanel.tsx`, `src/modules/terminal/service/scrollback-store.ts`, `src/modules/terminal/register.service.ts`.

**Steps.** Implement TERM-21 (panel side), TERM-23 to TERM-25, TERM-50, `storeScrollback`, `takeScrollback`.

**Tests.** `tests/terminal/attach.ui.test.tsx`: TERM-21 panel row, TERM-24. `tests/e2e/terminal-restore.e2e.ts`: TERM-50 row. `tests/e2e/terminal-fault.e2e.ts`: TERM-23 and REL-1, TERM-25 and REL-4.

**Done when.** Tests pass. Features `F-015`, `F-016` pass.

**Commit.** `feat(terminal): reattach after reload and restore history`

---

## 048 Terminal commands and projects

**Goal.** Terminal commands, prompt marks, and shells that keep running across project switches.

**Stage.** 1

**Read first.** `spec/modules/terminal.md` "Commands", TERM-60, TERM-61, TERM-70 to TERM-73.

**Files.** `src/modules/terminal/register.ui.ts`, `src/modules/terminal/service/terminal-registry.ts`, `src/modules/terminal/panel/terminal-commands.ts`, `src/modules/terminal/panel/prompt-marks.ts`, `src/modules/terminal/panel/TerminalPanel.tsx`.

**Steps.** Register the commands. `terminal.newClaude` creates a terminal with `launch: "claude"`. Implement TERM-60, TERM-61. `prompt-marks.ts` registers the OSC 133 and OSC 7 handlers with `terminal.parser.registerOscHandler`, keeps the markers and the state, and updates the panel's `cwd` (TERM-71 to TERM-73). `terminal.previousCommand` and `terminal.nextCommand` implement TERM-72.

**Tests.** `tests/terminal/terminal-commands.ui.test.tsx`: `terminal.focus` with none open creates one. `tests/terminal/prompt-marks.ui.test.tsx`: TERM-71 to TERM-73 rows. `tests/e2e/terminal-projects.e2e.ts`: TERM-60 row. `tests/e2e/terminal-init.e2e.ts`: TERM-70 row.

**Done when.** Tests pass. Features `F-017` and `F-056` pass.

**Commit.** `feat(terminal): add terminal commands and keep shells across projects`

---

## 049 Stage 1 checks

**Goal.** Stage 1 meets its bar.

**Stage.** 1

**Read first.** `spec/02-architecture.md` §10.

**Files.** `tests/e2e/stage-1.e2e.ts`, `tests/e2e/helpers/measure.ts`.

**Steps.** An end-to-end run: open a project, open 4 terminals in splits, run `claude --version` in one, run a script printing 50 MB in another while typing in a third, measure key echo time and that the third stays under 50 ms per echo, close and reopen the app, check layout and history.

**Tests.** That file.

**Done when.** Tests pass. Record the measured launch-to-terminal time and median echo time in `PROGRESS.md`. Feature `F-018` passes.

**Commit.** `test: prove stage 1 end to end`
