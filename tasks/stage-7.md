# Stage 7: Awareness extras

At the end of this stage HSOS says aloud when a Claude session finishes or needs the owner, shows the owner's Claude Code setup with when each part was last used, and shows in the graph what Claude loads at every start and which notes links reach.

---

## 091 Spoken alerts

**Goal.** The owner hears when a session finishes or needs them, unless they are already looking at it.

**Stage.** 7

**Read first.** `spec/modules/shell.md` SHELL-28, SHELL-29, `spec/modules/hud.md` HUD-10, HUD-11, HUD-13 to HUD-16, `spec/contracts/channels/shell.ts`, `spec/contracts/channels/hud.ts`.

**Files.** `src/main/speech/speech-queue.ts`, `src/main/speech/list-voices.ts`, `src/main/system/system-channels.ts`, `src/modules/hud/panel/speak-on-change.ts`, `src/modules/hud/panel/spoken-text.ts`, `src/modules/hud/panel/VoiceDialog.tsx`, `src/modules/hud/register.ui.ts`.

**Steps.**
1. `speech-queue.ts`: SHELL-28. The process runner is a parameter, so tests pass a fake.
2. `list-voices.ts`: SHELL-29.
3. Add handlers for `shell.speak` and `shell.listVoices` to `system-channels.ts`.
4. `spoken-text.ts`: the HUD-14 text as a pure function. `speak-on-change.ts`: HUD-13 and HUD-15, beside HUD-10's `notify-on-change.ts`.
5. Commands `hud.toggleSpokenAlerts`, `hud.testVoice`, `hud.chooseVoice` (HUD-16).

**Tests.** `tests/shell/speech.test.ts`: SHELL-28 rows. `tests/shell/list-voices.test.ts`: SHELL-29 row. `tests/hud/spoken-text.test.ts`: HUD-14 rows. `tests/hud/speak.ui.test.tsx`: HUD-13, HUD-15, HUD-16 component rows. Leave the HUD-13 manual row for the owner.

**Done when.** Tests pass. Feature `F-057` passes.

**Commit.** `feat(hud): speak when a session finishes or needs you`

---

## 092 Claude setup view

**Goal.** One view lists the owner's MCP servers, plugins, skills, subagents, hooks and permission rules, with when each was last used.

**Stage.** 7

**Read first.** `spec/modules/claude-link.md` LINK-6, LINK-70 to LINK-74, `spec/modules/hud.md` "Claude setup view", HUD-50 to HUD-55, `spec/contracts/channels/claude-link.ts` (`ClaudeSetup`), `spec/contracts/paths.ts` (`linkUsageFile`).

**Files.** `src/modules/claude-link/service/read-setup.ts`, `src/modules/claude-link/service/setup-usage.ts`, `src/modules/claude-link/register.service.ts`, `src/modules/hud/panel/SetupPanel.tsx`, `src/modules/hud/panel/SetupPanel.module.css`, `src/modules/hud/panel/setup-filters.ts`, `src/modules/hud/register.ui.ts`.

**Steps.**
1. `read-setup.ts`: LINK-70, LINK-71, LINK-73, LINK-74. Every path comes from the home folder and `projectPath` passed in, so tests use a temp home.
2. `setup-usage.ts`: LINK-72, fed from the existing `PreToolUse` and `SubagentStart` handlers.
3. `getSetup` handler.
4. `SetupPanel.tsx`: register dock panel `hud.setup` and command `hud.openSetup`. HUD-50 to HUD-55. `setup-filters.ts` holds the HUD-53 search, filter and sort as pure functions.

**Tests.** `tests/claude-link/setup.test.ts`: LINK-70 to LINK-73 rows and the LINK-6 row of the same table. `tests/hud/setup.ui.test.tsx`: HUD-50 to HUD-55 rows.

**Done when.** Tests pass. Feature `F-058` passes.

**Commit.** `feat(hud): show the Claude Code setup with last use`

---

## 093 Agent view in the graph

**Goal.** The graph shows what Claude loads at every start, how far each note is from it by links, and which notes no link reaches.

**Stage.** 7

**Read first.** `spec/modules/graph.md` "Roots indexed", "Agent view", GRAPH-40 to GRAPH-45, `spec/contracts/channels/graph.ts`.

**Files.** `src/modules/graph/service/claude-imports.ts`, `src/modules/graph/service/loads-at-start.ts`, `src/modules/graph/service/note-index.ts`, `src/modules/graph/register.service.ts`, `src/modules/graph/panel/agent-view.ts`, `src/modules/graph/panel/NodePreviewCard.tsx`, `src/modules/graph/panel/GraphPanel.tsx`.

**Steps.**
1. `claude-imports.ts`: GRAPH-40 as a pure function from note text to import paths. Do not change `markdown-links.ts`; it is a copy of the reference.
2. `loads-at-start.ts`: GRAPH-41. The index stores `loadsAtStart` and `lineCount` per note; add the two columns to `notes` and rebuild the index when the stored schema is older (GRAPH-7 covers a failed open).
3. `preview` handler (GRAPH-45). Add `rules\**\*.md` to the Claude root.
4. `agent-view.ts`: hop counts, shortest chains and the summary of GRAPH-42 and GRAPH-43, as pure functions over the graph. Wire the toggle, the filter, the badges and the command `graph.agentView` into the panel.
5. `NodePreviewCard.tsx`: GRAPH-44, for graph nodes and for wiki links in the markdown preview.

**Tests.** `tests/graph/claude-imports.test.ts`: GRAPH-40 row. `tests/graph/loads-at-start.test.ts`: GRAPH-41 rows. `tests/graph/preview.test.ts`: GRAPH-45 row. `tests/graph/agent-view.ui.test.tsx`: GRAPH-42, GRAPH-43, GRAPH-44 rows.

**Done when.** Tests pass. Feature `F-059` passes.

**Commit.** `feat(graph): show what Claude loads at start and what links reach`

---

## 094 Stage 7 checks

**Goal.** Stage 7 meets its bar.

**Stage.** 7

**Read first.** `spec/02-architecture.md` §10.

**Files.** `tests/e2e/stage-7.e2e.ts`.

**Steps.** An end-to-end run with `FakeClaude` and a temp home: open a project whose `CLAUDE.md` imports one file and links to another; open the graph agent view and check the summary counts both start files and that the linked note is 1 hop; open the Claude setup view and check an MCP server from the temp `.mcp.json` is listed; send a `Stop` for a session whose terminal is in a background tab and check `shell.speak` was called, through a test hook on the speech queue, not real audio.

**Tests.** That file.

**Done when.** Tests pass. The stage-7 app packages with `npm run dist`.

**Commit.** `test: prove stage 7 end to end`
