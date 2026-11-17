# HSOS spec journal

A running log of every step taken toward the HSOS spec. Newest entry at the bottom.

## 2026-11-16

### Step 1. Repo set up

Cloned `MMACABRE/OS.AI` into the working folder. The repo held one commit and a one-line README.

### Step 2. Goal recorded

The owner's brief, as given:

- Produce a very detailed spec that a weak coding model (Haiku-class) can follow to build HSOS.
- HSOS is a Windows desktop app (`.exe`) built around a terminal that runs Claude Code.
- Parts named so far:
  - terminal
  - file sidebar and file viewing, like VS Code
  - GitHub login and sync
  - a built-in browser the AI can drive
  - an Obsidian-style view of linked markdown files
  - an agent HUD showing usage limits and the agents and subagents running on the device
  - quick access to the owner's personal skills
- Priorities: customisable, exceptional looks, code that is easy to change and extend, and reliable enough to trust with real files.
- Method: research agents gather how similar apps were built and which languages fit, before the spec is written.

### Step 3. Skills loaded

- `hsluck` bundle: 10 of 10 loaded.
- `hs24skills` bundle: 12 of 24 loaded. The other 12 are switched off for model use in settings: interview-me, idea-refine, constraint-driven-development, planning-and-task-breakdown, context-engineering, doubt-driven-development, security-and-hardening, ci-cd-and-automation, deprecation-and-migration, documentation-and-adrs, observability-and-instrumentation, shipping-and-launch.
- Task skills added: research, codebase-design, writing-for-agents, prototype.

### Step 4. Skill search started

Searched the skills registry for 20 topics. Results are listed in `docs/SKILLS.md` once the search is complete.

### Step 5. Wayfinder charting started

The work follows the wayfinder method: name the destination, list the open decisions, create a map and tickets, then run research agents on the research tickets. The first act is a round of questions to the owner to pin down the destination.

### Step 6. Destination fixed

The owner answered yes to all eight round-one questions:

1. The effort ends at a spec set (capability map, one spec per module, build order). No app code.
2. The map and tickets live as GitHub Issues on this repo.
3. HSOS is a personal tool for one owner on Windows 11. No public release.
4. The terminal is a general PowerShell terminal with tabs and split panes. Claude Code is the first-class use.
5. Files: a tree plus a viewer with light editing. Not a full IDE.
6. Markdown graph: read-mostly, over the open project and one vault folder.
7. The agent HUD ports the existing mod at `MMACABRE/SKILLS` under `mods/agent-hud`.
8. Six research agents approved.

The owner added one standing instruction: aim one step above every comparable tool, and prefer the more capable design over the minimal one.

### Step 7. Map and tickets created

- Map: [HSOS spec map](https://github.com/MMACABRE/OS.AI/issues/1).
- Nine research tickets: comparable tools, stack options, terminal embedding, AI-driven browser, agent HUD data sources, specs for weak models, markdown link graph, GitHub login and sync, file protection and crash survival.
- Eight grilling tickets: choose the stack, what puts HSOS a step above, agent HUD scope, file safety rules, GitHub sync behaviour, customisation model, spec format and implementer protocol, module map and build order.
- One prototype ticket: visual direction.
- Every ticket is a sub-issue of the map. Each grilling and prototype ticket is blocked by the research or decision it waits on.

### Step 8. Research agents launched

Six background agents are running, one per approved research ticket. Each writes to `docs/research/<name>.md` on its own `research/<name>` branch, pushes the branch, and comments on its ticket. The other three research tickets (markdown link graph, GitHub login and sync, file protection) wait for the owner's approval to spawn.

## 2026-11-17

### Step 9. Research agents resumed

All six research agents stopped on 2026-11-16 when the account hit its 5-hour usage limit. None had finished. After the limit reset, each agent was resumed from its saved state with the same brief. No findings are recorded yet.

### Step 10. Research agents stopped

The owner asked for all six research agents to be stopped. All six were stopped before finishing. Their saved state remains, so each can be resumed later. The six research tickets stay open.

### Step 11. Research moved into the main session

The owner decided that the main session does the research itself. Subagents are allowed only for very simple tasks, on Haiku 5.5. The six stopped agents are abandoned.

### Step 12. Six research tickets resolved

Findings are on the branch `research/round-1` under `docs/research/`. Each file marks which claims were checked against a source and which were not.

| Ticket | Answer in one line | File |
|---|---|---|
| How comparable tools were built | No tool combines all seven parts. Wave is closest in shape, opcode in Claude awareness. | `comparable-tools.md` |
| Stack options for a Windows exe | Electron with TypeScript recommended. Tauri 2 second. | `stack-options.md` |
| Terminal embedding on Windows | xterm.js 6 with node-pty over ConPTY, PTYs in a separate host process. | `terminal-embedding.md` |
| Embedded browser the AI can drive | A Chromium view controlled over CDP, exposed through an MCP server HSOS runs. | `ai-browser.md` |
| Claude Code data sources for the agent HUD | Limits from the statusline input, activity from HTTP hooks. | `agent-hud-data.md` |
| Writing specs a weak model follows | Feature list, progress log, start script, one task per session, tests written in advance. | `spec-for-weak-models.md` |

The six tickets are closed and indexed on the map. Four grilling tickets are now unblocked: Choose the stack, What puts HSOS a step above, Agent HUD scope, Spec format and implementer protocol.

Still open research: Markdown link graph at scale, GitHub login and sync mechanics, Protecting files and surviving crashes.

### Step 13. Last three research tickets resolved

| Ticket | Answer in one line | File on `research/round-1` |
|---|---|---|
| Markdown link graph at scale | Obsidian's link grammar, a SQLite index outside the vault, sigma.js on graphology. | `markdown-graph.md` |
| GitHub login and sync mechanics | Reuse the GitHub CLI login, device flow as fallback, run real `git.exe`. | `github-sync.md` |
| Protecting files and surviving crashes | Atomic writes, change detection before save, Recycle Bin, local history, supervised processes. | `file-safety.md` |

All nine research tickets are closed.

### Step 14. Stack chosen

The owner restated that this effort produces only the spec, and that the spec author carries the quality. On that basis the spec author chose the stack: Electron, TypeScript in every process, React, xterm.js with node-pty, and Electron's Chromium view for the browser pane. The decision is recorded in `docs/adr/0001-electron-and-typescript.md`. The owner can switch to Tauri 2 until the module specs are written.

Open decision tickets, all now unblocked except where noted:

- What puts HSOS a step above
- Agent HUD scope
- File safety rules
- GitHub sync behaviour
- Customisation model
- Spec format and implementer protocol
- Visual direction (waits on "What puts HSOS a step above")
- Module map and build order (waits on "What puts HSOS a step above" and "Spec format and implementer protocol")
