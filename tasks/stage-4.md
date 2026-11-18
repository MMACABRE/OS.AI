# Stage 4: Browser

At the end of this stage HSOS has a browser panel in its own profile, and Claude drives it through the `hsos` command while the owner watches and can stop it.

---

## 087 Browser tabs

**Goal.** Page views in an isolated profile, placed over their panels.

**Stage.** 4

**Read first.** `spec/modules/browser.md` "How a tab is built", BROW-1 to BROW-10, `spec/contracts/channels/browser.ts`.

**Files.** `src/modules/browser/service/tab-manager.ts`, `src/modules/browser/service/browser-session.ts`, `src/modules/browser/service/navigation-rules.ts`, `src/modules/browser/register.service.ts`, `src/main/module-list.ts`.

**Steps.** Implement tab creation, bounds, the session (BROW-5 to BROW-7), events (BROW-8), crash handling (BROW-9), and the owner-facing channels.

**Tests.** `tests/browser/navigation-rules.test.ts`: BROW-4, BROW-5 as pure functions. `tests/e2e/browser-tabs.e2e.ts`: BROW-5, BROW-6, BROW-7, the "Profile" row, BROW-9.

**Done when.** Tests pass.

**Commit.** `feat(browser): open pages in an isolated profile`

---

## 088 Browser panel

**Goal.** The toolbar, address field and overlay handling.

**Stage.** 4

**Read first.** `spec/modules/browser.md` BROW-1 to BROW-4, BROW-10, "Commands", "States".

**Files.** `src/modules/browser/panel/BrowserPanel.tsx`, `src/modules/browser/panel/BrowserPanel.module.css`, `src/modules/browser/panel/use-view-bounds.ts`, `src/modules/browser/panel/hide-under-overlays.ts`, `src/modules/browser/register.ui.ts`, `src/ui/module-list.ts`.

**Steps.** Build the panel. `hide-under-overlays.ts` uses `ui-kit`'s `useOverlayOpen` (card 022) to apply BROW-3.

**Tests.** `tests/browser/browser-panel.ui.test.tsx`: the address field submits the parsed URL; hidden panels send width 0. `tests/e2e/browser-panel.e2e.ts`: BROW-3.

**Done when.** Tests pass. Feature `F-041` passes.

**Commit.** `feat(browser): add the browser panel`

---

## 089 Agent page reading and input

**Goal.** Claude can read the page and click and type in it.

**Stage.** 4

**Read first.** `spec/modules/browser.md` BROW-30 to BROW-34, BROW-39, BROW-44.

**Files.** `src/modules/browser/service/cdp.ts`, `src/modules/browser/service/accessibility-snapshot.ts`, `src/modules/browser/service/agent-input.ts`, `src/modules/browser/register.service.ts`, `tests/fixtures/pages/form.html`.

**Steps.** `cdp.ts` wraps `webContents.debugger` with typed `send(method, params)` and a timeout. Implement the rules. `form.html` has a textbox, a submit button, a click counter and a password field.

**Tests.** `tests/browser/accessibility-snapshot.test.ts`: reduction and numbering on a recorded `getFullAXTree` result. `tests/e2e/browser-agent.e2e.ts`: BROW-31, BROW-32 rows, BROW-33, BROW-44.

**Done when.** Tests pass.

**Commit.** `feat(browser): let the agent read and use pages`

---

## 090 Agent navigation and owner control

**Goal.** Claude navigates under the host rules, and the owner always sees and can stop it.

**Stage.** 4

**Read first.** `spec/modules/browser.md` BROW-35 to BROW-38, BROW-40 to BROW-43.

**Files.** `src/modules/browser/service/agent-navigation.ts`, `src/modules/browser/service/agent-control.ts`, `src/modules/browser/service/page-logs.ts`, `src/modules/browser/panel/AgentIndicator.tsx`, `src/modules/browser/panel/HostPermissionBar.tsx`, `src/modules/browser/register.service.ts`.

**Steps.** Implement the rules.

**Tests.** `tests/browser/agent-control.test.ts`: BROW-40, BROW-42 with a fake clock. `tests/e2e/browser-agent-control.e2e.ts`: BROW-36 rows, BROW-38, BROW-41, BROW-42.

**Done when.** Tests pass. Feature `F-042` passes.

**Commit.** `feat(browser): control agent navigation`

---

## 091 Element capture

**Goal.** Pick an element on a page and send its code to Claude or the feedback tray.

**Stage.** 4

**Read first.** `spec/modules/browser.md` BROW-50 to BROW-52.

**Files.** `src/modules/browser/service/element-capture.ts`, `src/modules/browser/service/capture-script.ts`, `src/modules/browser/panel/CapturePopover.tsx`, `src/modules/browser/register.service.ts`, `src/modules/browser/register.ui.ts`.

**Steps.** `capture-script.ts` exports the script text run in the isolated world. Implement the rules.

**Tests.** `tests/browser/selector.test.ts`: the selector rules on a jsdom document. `tests/e2e/element-capture.e2e.ts`: BROW-51 row; "Add comment" creates an `element` comment.

**Done when.** Tests pass. Feature `F-043` passes.

**Commit.** `feat(browser): capture page elements`

---

## 092 The hsos command

**Goal.** Claude Code in an HSOS terminal can run `hsos` without a permission prompt, and HSOS answers it.

**Stage.** 4

**Read first.** `spec/modules/cli.md` "How Claude reaches it", "Requests", CLI-1 to CLI-9, `spec/contracts/channels/cli.ts`, `spec/reference/hsos-cli.sh`, `spec/modules/claude-link.md` "Files HSOS generates", LINK-2, LINK-4.

**Files.** `src/modules/cli/service/cli-route.ts`, `src/modules/cli/service/arg-parser.ts`, `src/modules/cli/service/command-registry.ts`, `src/modules/cli/register.service.ts`, `src/modules/claude-link/service/generated-files.ts`, `src/modules/claude-link/service/hsos-cli.sh`, `src/services/link-service/module-list.ts`.

**Steps.**
1. Copy `spec/reference/hsos-cli.sh` to `src/modules/claude-link/service/hsos-cli.sh` unchanged. `generated-files.ts` writes it to `linkDir\bin\hsos`, the CLI-2 skill file and the CLI-3 permission rule, and sets `HSOS_BIN_DIR` (LINK-2). The wrapper already puts it on `PATH` (LINK-4).
2. `arg-parser.ts`: CLI-6 as a pure function from the argument list and the command table to a parsed command or a usage error.
3. `cli-route.ts`: CLI-4, CLI-5, CLI-7, CLI-8, CLI-9 on the `/cli` mount point of the link server. Register the `help` command; the groups come in cards 093, 094 and 099.

**Tests.** `tests/cli/hsos-cli.test.ts`: the three CLI-1 rows, run in Git Bash against a test server. `tests/cli/arg-parser.test.ts`: CLI-6 rows. `tests/cli/cli-route.test.ts`: CLI-2, CLI-3, CLI-4, CLI-5, CLI-9. Never start the real `claude` here.

**Done when.** Tests pass.

**Commit.** `feat(cli): serve the hsos command to Claude Code`

---

## 093 Browser commands

**Goal.** Claude drives the browser panel through `hsos browser`.

**Stage.** 4

**Read first.** `spec/modules/cli.md` "browser", CLI-7, CLI-10, CLI-11, CLI-12.

**Files.** `src/modules/cli/service/commands/browser-commands.ts`, `src/modules/cli/service/commands/format-snapshot.ts`, `src/modules/cli/service/screenshots.ts`, `src/modules/cli/register.service.ts`.

**Steps.** One command per row, with the exact usage lines. Each calls the matching `browser.agent*` channel. `screenshots.ts`: save the PNG under `linkDir\shots`, print its path, and CLI-12 at start.

**Tests.** `tests/cli/browser-commands.test.ts` with a fake bus: each command's arguments are validated and mapped to its channel; the CLI-7 row. `tests/cli/format-snapshot.test.ts`: the indented text form. `tests/cli/screenshots.test.ts`: CLI-12.

**Done when.** Tests pass. Feature `F-044` passes.

**Commit.** `feat(cli): add browser commands`

---

## 094 Workspace and review commands

**Goal.** Claude can show files and diffs to the owner and read pinned feedback.

**Stage.** 4

**Read first.** `spec/modules/cli.md` "workspace", "review", CLI-8, CLI-10, CLI-11, `spec/modules/workspace.md` WS-36, WS-37.

**Files.** `src/modules/cli/service/commands/workspace-commands.ts`, `src/modules/cli/service/commands/review-commands.ts`, `src/modules/workspace/service/open-panel-relay.ts`, `src/modules/workspace/panel/open-in-background.ts`, `src/modules/workspace/register.ui.ts`, `src/modules/cli/register.service.ts`.

**Steps.**
1. WS-36 and WS-37: `open-panel-relay.ts` in `main`, `open-in-background.ts` in the UI.
2. The workspace commands call `workspace.requestOpenPanel` with `focus: false`, `workspace.listOpenPanels`, and `shell.notify` (with a toast through the same event path). `workspace notify` keeps its own 30-second limit per session. Relative paths resolve as the cli spec says.
3. The review command prints `review.composePrompt`.

**Tests.** `tests/cli/workspace-commands.test.ts` with a fake bus: each command maps to its channel; the `notify` row; the CLI-8 row; the CLI-10 row for all commands so far. `tests/workspace/open-in-background.ui.test.tsx`: WS-36 keeps focus. `tests/e2e/cli-open-file.e2e.ts`: CLI-11.

**Done when.** Tests pass. Feature `F-045` passes.

**Commit.** `feat(cli): add workspace and review commands`

---

## 095 Stage 4 checks

**Goal.** Stage 4 works end to end.

**Stage.** 4

**Read first.** `spec/modules/browser.md` "Tests", `spec/modules/cli.md` "Tests".

**Files.** `tests/e2e/stage-4.e2e.ts`, `tests/fixtures/pages/app.html`.

**Steps.** Start a local static server on a free port serving `tests/fixtures/pages/`. In Git Bash with the environment of an HSOS terminal, run the generated `linkDir\bin\hsos` against the real link service: `browser navigate` to the page, `browser snapshot`, `browser type` with `--submit`, `browser console`, `browser screenshot` (the printed path is a PNG), `browser release`. Check the panel showed the agent indicator during the run and not after. Check "Stop" makes the next call exit with code 1.

**Tests.** That file.

**Done when.** Tests pass. Feature `F-046` passes. Leave the manual check in `cli.md` for the owner.

**Commit.** `test: prove stage 4 end to end`
