# Stage 4: Browser

At the end of this stage HSOS has a browser panel in its own profile, and Claude drives it through the HSOS MCP server while the owner watches and can stop it.

---

## 075 Browser tabs

**Goal.** Page views in an isolated profile, placed over their panels.

**Stage.** 4

**Read first.** `spec/modules/browser.md` "How a tab is built", BROW-1 to BROW-10, `spec/contracts/channels/browser.ts`.

**Files.** `src/modules/browser/service/tab-manager.ts`, `src/modules/browser/service/browser-session.ts`, `src/modules/browser/service/navigation-rules.ts`, `src/modules/browser/register.service.ts`, `src/main/module-list.ts`.

**Steps.** Implement tab creation, bounds, the session (BROW-5 to BROW-7), events (BROW-8), crash handling (BROW-9), and the owner-facing channels.

**Tests.** `tests/browser/navigation-rules.test.ts`: BROW-4, BROW-5 as pure functions. `tests/e2e/browser-tabs.e2e.ts`: BROW-5, BROW-6, BROW-7, the "Profile" row, BROW-9.

**Done when.** Tests pass.

**Commit.** `feat(browser): open pages in an isolated profile`

---

## 076 Browser panel

**Goal.** The toolbar, address field and overlay handling.

**Stage.** 4

**Read first.** `spec/modules/browser.md` BROW-1 to BROW-4, BROW-10, "Commands", "States".

**Files.** `src/modules/browser/panel/BrowserPanel.tsx`, `src/modules/browser/panel/BrowserPanel.module.css`, `src/modules/browser/panel/use-view-bounds.ts`, `src/modules/browser/panel/hide-under-overlays.ts`, `src/modules/browser/register.ui.ts`, `src/ui/module-list.ts`.

**Steps.** Build the panel. `hide-under-overlays.ts` uses `ui-kit`'s `useOverlayOpen` (card 022) to apply BROW-3.

**Tests.** `tests/browser/browser-panel.ui.test.tsx`: the address field submits the parsed URL; hidden panels send width 0. `tests/e2e/browser-panel.e2e.ts`: BROW-3.

**Done when.** Tests pass. Feature `F-041` passes.

**Commit.** `feat(browser): add the browser panel`

---

## 077 Agent page reading and input

**Goal.** Claude can read the page and click and type in it.

**Stage.** 4

**Read first.** `spec/modules/browser.md` BROW-30 to BROW-34, BROW-39, BROW-44.

**Files.** `src/modules/browser/service/cdp.ts`, `src/modules/browser/service/accessibility-snapshot.ts`, `src/modules/browser/service/agent-input.ts`, `src/modules/browser/register.service.ts`, `tests/fixtures/pages/form.html`.

**Steps.** `cdp.ts` wraps `webContents.debugger` with typed `send(method, params)` and a timeout. Implement the rules. `form.html` has a textbox, a submit button, a click counter and a password field.

**Tests.** `tests/browser/accessibility-snapshot.test.ts`: reduction and numbering on a recorded `getFullAXTree` result. `tests/e2e/browser-agent.e2e.ts`: BROW-31, BROW-32 rows, BROW-33, BROW-44.

**Done when.** Tests pass.

**Commit.** `feat(browser): let the agent read and use pages`

---

## 078 Agent navigation and owner control

**Goal.** Claude navigates under the host rules, and the owner always sees and can stop it.

**Stage.** 4

**Read first.** `spec/modules/browser.md` BROW-35 to BROW-38, BROW-40 to BROW-43.

**Files.** `src/modules/browser/service/agent-navigation.ts`, `src/modules/browser/service/agent-control.ts`, `src/modules/browser/service/page-logs.ts`, `src/modules/browser/panel/AgentIndicator.tsx`, `src/modules/browser/panel/HostPermissionBar.tsx`, `src/modules/browser/register.service.ts`.

**Steps.** Implement the rules.

**Tests.** `tests/browser/agent-control.test.ts`: BROW-40, BROW-42 with a fake clock. `tests/e2e/browser-agent-control.e2e.ts`: BROW-36 rows, BROW-38, BROW-41, BROW-42.

**Done when.** Tests pass. Feature `F-042` passes.

**Commit.** `feat(browser): control agent navigation`

---

## 079 Element capture

**Goal.** Pick an element on a page and send its code to Claude or the feedback tray.

**Stage.** 4

**Read first.** `spec/modules/browser.md` BROW-50 to BROW-52.

**Files.** `src/modules/browser/service/element-capture.ts`, `src/modules/browser/service/capture-script.ts`, `src/modules/browser/panel/CapturePopover.tsx`, `src/modules/browser/register.service.ts`, `src/modules/browser/register.ui.ts`.

**Steps.** `capture-script.ts` exports the script text run in the isolated world. Implement the rules.

**Tests.** `tests/browser/selector.test.ts`: the selector rules on a jsdom document. `tests/e2e/element-capture.e2e.ts`: BROW-51 row; "Add comment" creates an `element` comment.

**Done when.** Tests pass. Feature `F-043` passes.

**Commit.** `feat(browser): capture page elements`

---

## 080 MCP server

**Goal.** Claude Code connects to HSOS's own MCP server.

**Stage.** 4

**Read first.** `spec/modules/mcp.md` "Connection", MCP-1 to MCP-5, MCP-12, MCP-13, `spec/contracts/channels/mcp.ts`, `spec/modules/claude-link.md` LINK-4.

**Files.** `src/modules/mcp/service/mcp-server.ts`, `src/modules/mcp/service/tool-registry.ts`, `src/modules/mcp/register.service.ts`, `src/modules/claude-link/service/generated-files.ts`, `src/services/link-service/module-list.ts`.

**Steps.**
1. First prove the SDK: a test creates the server with the SDK's Streamable HTTP server transport mounted on the link server, and the SDK's client lists one test tool. If the transport class names differ in the installed SDK, use the installed ones and record it.
2. Implement MCP-1 to MCP-5, MCP-12, MCP-13. Write `mcp.json` and set `HSOS_MCP_CONFIG`. The wrapper already passes `--mcp-config` when that variable is set (LINK-4).

**Tests.** `tests/mcp/mcp-server.test.ts`: MCP-1, MCP-2, MCP-3, MCP-12.

**Done when.** Tests pass.

**Commit.** `feat(mcp): serve HSOS tools to Claude Code`

---

## 081 MCP browser tools

**Goal.** Claude drives the browser panel through MCP.

**Stage.** 4

**Read first.** `spec/modules/mcp.md` "Browser group", MCP-4, MCP-10, MCP-11.

**Files.** `src/modules/mcp/service/tools/browser-tools.ts`, `src/modules/mcp/service/tools/format-snapshot.ts`, `src/modules/mcp/register.service.ts`.

**Steps.** One tool per row, with the exact descriptions. Each calls the matching `browser.agent*` channel.

**Tests.** `tests/mcp/browser-tools.test.ts` with a fake bus: each tool's input is validated and mapped to its channel; MCP-4 row. `tests/mcp/format-snapshot.test.ts`: the indented text form.

**Done when.** Tests pass. Feature `F-044` passes.

**Commit.** `feat(mcp): add browser tools`

---

## 082 MCP workspace and review tools

**Goal.** Claude can show files and diffs to the owner and read pinned feedback.

**Stage.** 4

**Read first.** `spec/modules/mcp.md` "Workspace group", "Review group", MCP-10, MCP-11, `spec/modules/workspace.md` WS-36, WS-37.

**Files.** `src/modules/mcp/service/tools/workspace-tools.ts`, `src/modules/mcp/service/tools/review-tools.ts`, `src/modules/workspace/service/open-panel-relay.ts`, `src/modules/workspace/panel/open-in-background.ts`, `src/modules/workspace/register.ui.ts`, `src/modules/mcp/register.service.ts`.

**Steps.**
1. WS-36 and WS-37: `open-panel-relay.ts` in `main`, `open-in-background.ts` in the UI.
2. The workspace tools call `workspace.requestOpenPanel` with `focus: false`, `workspace.listOpenPanels`, and `shell.notify` (with a toast through the same event path). `hsos_notify` keeps its own 30-second limit per session.
3. The review tool returns `review.composePrompt`.

**Tests.** `tests/mcp/workspace-tools.test.ts` with a fake bus: each tool maps to its channel; the `hsos_notify` row; the MCP-10 row for all tools so far. `tests/workspace/open-in-background.ui.test.tsx`: WS-36 keeps focus. `tests/e2e/mcp-open-file.e2e.ts`: MCP-11.

**Done when.** Tests pass. Feature `F-045` passes.

**Commit.** `feat(mcp): add workspace and review tools`

---

## 083 Stage 4 checks

**Goal.** Stage 4 works end to end.

**Stage.** 4

**Read first.** `spec/modules/browser.md` "Tests", `spec/modules/mcp.md` "Tests".

**Files.** `tests/e2e/stage-4.e2e.ts`, `tests/fixtures/pages/app.html`.

**Steps.** Start a local static server on a free port serving `tests/fixtures/pages/`. Through the SDK client against the real MCP server: `browser_navigate` to the page, `browser_snapshot`, `browser_type` and submit, `browser_console`, `browser_screenshot`, `browser_release`. Check the panel showed the agent indicator during the run and not after. Check "Stop" makes the next call fail.

**Tests.** That file.

**Done when.** Tests pass. Feature `F-046` passes. Leave the manual check in `mcp.md` for the owner.

**Commit.** `test: prove stage 4 end to end`
