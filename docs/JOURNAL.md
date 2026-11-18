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

### Step 15. Six decisions confirmed by the owner

The owner said yes to all six recommendations. The tickets are closed and indexed on the map.

1. **What puts HSOS a step above.** Seven capabilities in the first build: an all-pane HUD, HSOS as an MCP server, shells that survive a UI crash, local history with restore, a graph that includes Claude's files, live theming, per-project workspaces.
2. **Agent HUD scope.** Everything the existing mod shows, plus context used, cost and current tool per agent.
3. **File safety rules.** No permanent delete, no overwrite of a changed file without asking, no writes to the vault from the graph, no history-rewriting git commands.
4. **GitHub sync behaviour.** Fetch and fast-forward pull are automatic. Commit and push are one click. Auto commit-and-push is opt-in per repo.
5. **Customisation model.** JSON settings and themes, drag and drop layout per project, in-codebase modules, no marketplace.
6. **Spec format and implementer protocol.** The file set from the research on writing specs for weak models.

Two tickets remain: Visual direction, and Module map and build order.

### Step 16. Reference app from the owner

The owner pointed to an existing app they like, shown in a browser tab with a transcript. The Chrome extension was not connected, so it has not been reviewed yet. It feeds the Visual direction ticket.

### Step 17. Capability map drafted

A first draft of the module map and build order is in `docs/drafts/capability-map.md`: five processes, sixteen modules with one-way dependencies, and seven build stages that each end with a working packaged app. It is a proposal. The ticket "Module map and build order" stays open until the owner confirms it.

The reference app could not be viewed: no browser was running on the owner's computer, and the owner was away from it. The owner offered to send screenshots of the transcript instead.

### Step 18. Reference tool reviewed from a transcript

The owner pasted the transcript of a video about another person's "agentic OS" and asked for the parts about the tool. Fourteen features are listed and compared with HSOS in `docs/drafts/reference-agentic-os.md`. The app itself has not been seen, so its look is still unknown. Which of its features join HSOS is a question for the owner.

### Step 19. Owner delegated every decision

The owner said to decide everything and ask no questions until the spec is complete. From here each decision is made by the spec author and logged.

Decisions made at once:

- **Reference tool features.** Added to the first build: cache state in the HUD, skills deck with background runs, artifacts inbox, activity timeline, element capture. Later: home dashboard with micro apps, usage by skill, 3D graph. Left out: calendar, email, routines view, notes backlog, recommendations app, cache keep-warm pings.
- **Module map.** Seventeen modules, the draft's sixteen plus `activity`. Four service process kinds plus the UI. Seven build stages.
- **Visual direction.** "Graphite": dark-first, warm near-black surfaces, hairline borders, one amber signal colour, compact density, Geist type. Decided without a prototype because the owner asked for no questions.

All map tickets are closed. The remaining work is writing the spec itself.

### Step 20. Spec foundation written

New files under `spec/`: `README.md`, `00-principles.md`, `01-capability-map.md`, `02-architecture.md`, `03-stack.md`, `04-implementer-protocol.md`, `05-testing.md`. Also `GLOSSARY.md` at the root.

Choices recorded in them:

- Package versions were read from the npm registry today and pinned exactly.
- Six risky third-party APIs get spike tasks in stage 0 before anything depends on them.
- The implementer writes test code from test tables in each module spec, tests first. The spec author does not ship test code for every module, only reference code for the hardest parts. This changes the earlier research recommendation, which had the spec author writing all tests.
- Twelve fault tests define the reliability bar.

### Step 21. Recent agentic coding tools researched

At the owner's request, the spec author looked at what changed agentic coding in recent months. The main source was Claude Code's official weekly digest. Findings and choices are in `docs/drafts/recent-tools.md`.

Six additions to HSOS, each built on parts already planned:

1. Attention board in the HUD: sessions grouped as needs you, working, done.
2. Windows notifications when a session needs the owner or finishes.
3. Session recap for a terminal that was out of view.
4. Worktree sessions: start Claude in a new git worktree; terminals grouped by worktree.
5. Changes panel: a live diff that refreshes as Claude edits.
6. Feedback tray: pinned comments on diffs, files, artifacts and page elements, sent to a terminal as one prompt.

Items 5 and 6 form a new module, `review`. The capability map now has eighteen modules. Left out, with reasons: session kanban, cross-session messaging, voice dictation, auto-continue after a limit, usage by skill, rewind.

### Step 22. Design and base contracts written

- `spec/design/visual-direction.md`: the Graphite direction, the list of forbidden looks, type, colour roles, spacing, motion, focus, and the four panel states.
- `spec/design/layout.md`: window anatomy, panel kinds, dock behaviour, command palette, default key bindings.
- `spec/design/themes/`: three theme files, Graphite (dark, default), Paper (light), Ink (high contrast).
- `spec/contracts/`: `result.ts`, `ids.ts`, `bus.ts`, `module.ts`, `paths.ts`, `theme.ts`. These are real TypeScript files the app imports.

Next: one spec and one channel contract per module, stage by stage.

### Step 23. Stage 0 module specs written

Four module specs with numbered behaviour rules and test tables: `diagnostics` (10 rules), `shell` (25 rules), `settings` (20 rules), `ui-kit` (component list, icon set, palette and key handling rules). Channel contracts added: `schemas.ts`, `channels/shell.ts`, `channels/settings.ts`, `channels/diagnostics.ts`.

Decision: panels may import `ui-kit` directly. Every other module is reached only through contracts.

### Step 24. Stage 1 module specs written

- `spec/modules/workspace.md` (35 rules): projects, panels, save and restore, the app frame.
- `spec/modules/terminal.md` (61 rules): creating shells, output batching, reattach, flow control, input, view, projects.
- `spec/contracts/channels/workspace.ts` and `terminal.ts`.
- `spec/reference/ring-buffer.ts`: finished code for the replay buffer. Its self-check was run and passed.

Decisions:

- Shells of a project keep running when another project is opened, and reattach on return. A setting turns this off.
- After a reattach the terminal is resized by one row and back, so a full-screen program redraws.
- Scrollback is serialised by the view and stored by the PTY host, so history returns after a restart.
- The working folder restored for a terminal is the folder it was started in. Tracking folder changes inside the shell is left out.

### Step 25. Stage 2 module specs written

- `spec/modules/files.md` (rules FILE-1 to FILE-79): reading, saving, watching, search, the file tree and the viewer.
- `spec/modules/history.md` (rules HIST-1 to HIST-43): snapshots, restore, retention, the per-file timeline.
- `spec/contracts/channels/files.ts` and `history.ts`.

A design flaw was found and fixed while writing. The first draft had `files` calling `history` directly, which reversed the dependency direction in the capability map. The fix is a general mechanism added to `contracts/module.ts`: an extension point. `files` declares a slot for write observers, and `history` fills it. `files` never imports `history`.

Decisions:

- A file keeps its original encoding and line endings when saved.
- A changed-on-disk file is never overwritten without the owner choosing "Overwrite" in a bar that also offers "Compare" and "Reload".
- Just before Claude edits a file, HSOS snapshots it. This uses Claude Code's pre-tool hook, so the version before Claude's change is always kept, even for a file HSOS had never seen. `claude-link` therefore depends on `history`.
- History stores each distinct content once, by hash, outside the project.

### Step 26. Claude link module specified

`spec/modules/claude-link.md` (rules LINK-1 to LINK-61) and `spec/contracts/channels/claude-link.ts`.

Before writing it, the spec author read the rest of Claude Code's hooks reference and the CLI reference. Facts confirmed today:

- HTTP hooks post each event's JSON to a URL. A connection failure, a non-2xx status or a timeout is a non-blocking error.
- Header values can take environment variables listed in `allowedEnvVars`. The URL cannot.
- Hooks from different sources merge. A plugin's hooks are added to the owner's own.
- `claude --plugin-dir` loads a plugin for one session. `claude --settings` overrides chosen settings keys for one session.
- `SubagentStart` carries `agent_id` and `agent_type` only. The `Agent` tool's input carries the model when one is named.
- `Stop` carries the last assistant message and the list of background tasks.

Decisions:

- HSOS never edits the owner's Claude Code settings. Inside HSOS terminals, a small PowerShell function wraps `claude` and adds `--plugin-dir` and `--settings` pointing at files HSOS generates at each launch. Sessions outside HSOS are untouched.
- The statusline command is a single `curl.exe` call that posts the statusline JSON to HSOS and prints the reply. Usage limits come from that JSON.
- HSOS answers every hook with an empty success reply. It never blocks or alters what Claude does.
- A subagent's model is shown when it was named at spawn. Otherwise the HUD shows the agent type.
- Before Claude writes or edits a file, HSOS snapshots it, waiting at most 1.5 seconds.

### Step 27. Git and skills modules specified

- `spec/modules/git.md` (rules GIT-1 to GIT-61), `spec/contracts/channels/git.ts`.
- `spec/reference/git-status-parser.ts`: finished parser. Its self-check passed, and its expected format was compared with the output of the real `git` on this machine.
- `spec/modules/skills.md` (rules SKILL-1 to SKILL-34), `spec/contracts/channels/skills.ts`.

Decisions:

- HSOS runs the installed `git.exe` and never holds a GitHub token. Push and pull use git's own credential helper. Signing in means running `gh auth login` in a terminal. The OAuth device flow from the research is dropped: it needed the owner to register an OAuth app and added nothing.
- Every git command passes a safety check that refuses a fixed list of history-rewriting arguments and any subcommand outside a short allowed list.
- Commit messages are built from file names by default. Asking Claude for a message is an option, off by default, because it spends usage.
- Automatic commit and push stays off unless a repo is listed for it, and waits while a Claude session in the project is working.
- Background skill runs default to Haiku, one at a time, and start only from a dialog that names the model.
- Skills sync only pushes local skills to the repo. It never copies from the repo to this computer and never deletes a skill folder.

### Step 28. HUD, activity and review specified

- `spec/modules/hud.md` (rules HUD-1 to HUD-41) and `spec/contracts/channels/hud.ts` (settings only).
- `spec/modules/activity.md` (rules ACT-1 to ACT-34) and `spec/contracts/channels/activity.ts`.
- `spec/modules/review.md` (rules REV-1 to REV-37) and `spec/contracts/channels/review.ts`.
- `shell` gained `openPath`, limited to a list of document and media extensions so HSOS can never launch a program.

Decisions:

- The attention board orders sessions by who needs the owner first. Selecting a session focuses its terminal and marks it seen.
- Cache state is shown as minutes of warmth left, computed in the UI from the time of Claude's last reply. Nothing is spent to keep a cache warm.
- Windows notifications fire only when HSOS is not focused, at most one per session per 10 seconds.
- Who changed a file is decided by matching each snapshot with Claude's edit events within a few seconds. Unmatched changes are "Outside".
- Artifacts are files of chosen types that Claude created, or that appeared while a Claude session was working. They are listed, never moved or deleted.
- Feedback is pasted into the terminal without pressing Enter, so the owner reads it before it is sent. Comments are never cleared automatically.
- The Changes view has no "discard changes" action, because that would need a git command HSOS does not run.

Model note: from this step on the spec is written by Claude Opus 5.5. The owner switched models in the CLI.

### Step 29. Browser, graph and MCP specified

- `spec/modules/browser.md` (rules BROW-1 to BROW-52), `spec/contracts/channels/browser.ts`.
- `spec/modules/graph.md` (rules GRAPH-1 to GRAPH-32), `spec/contracts/channels/graph.ts`.
- `spec/reference/markdown-links.ts`: finished parser for Obsidian links, tags, headings and frontmatter. Its self-check passed.
- `spec/modules/mcp.md` (rules MCP-1 to MCP-13), `spec/contracts/channels/mcp.ts`: twenty tools in four groups.

Decisions:

- The browser runs in the main process because Electron's page views and DevTools access live there. It uses its own profile, denies page permission requests and downloads, and refuses typing into password and card fields.
- Because page views are drawn above the window, HSOS hides them while a menu or dialog is open and shows a still image of the page meanwhile.
- Claude may open localhost without asking. Other sites ask the owner once per host. A visible frame and a "Stop" button show whenever Claude controls a tab.
- Bare note names resolve to the closest file by folder, then the shortest path. A project note can link to a skill by name.
- MCP tools only show things, read HSOS state or drive the browser. None writes files, runs commands or touches git; that stays with Claude Code and its own permissions. Tool groups can be turned off to save Claude's context.
- No automated test runs the real Claude Code with a prompt, because that spends usage. Those checks are marked manual.

### Step 30. Implementer tooling and task cards written

- `spec/reference/guard.mjs`: the pre-commit guard. It blocks edits to the spec and tasks, any change to `features.json` other than flipping a feature to passing, rewriting `PROGRESS.md`, and removing or changing existing test lines. It was tested in a scratch repo against eight allowed and blocked cases, all correct.
- `spec/reference/init.ps1`: the session start script.
- `CLAUDE.md`: instructions for the implementer, and for a spec author changing the spec.
- `tasks/stage-0.md` to `tasks/stage-6.md`: 90 task cards, each with the files it may touch, steps, tests, the command that proves it done, and its commit message. Six spike cards in stage 0 prove the risky Electron and native-module APIs first.
- `features.json`: 54 features, each flipped by one named card.

Two design gaps were found and fixed while writing the cards:

- A rule needed to know which process sent a request. The bus contract now gives every handler the caller's identity, set by the receiving side from the port, never from the payload (BUS-7).
- MCP tools needed to open panels without stealing focus. The workspace contract gained `requestOpenPanel` and `listOpenPanels` (WS-36, WS-37).

### Step 31. Spec checked and complete

Checks run on the finished spec:

- All contracts compile under TypeScript 7.0.2 and zod 4.6.7 with the strict settings the implementer must use.
- The three reference parsers pass their self-checks. The git status parser's expected format matches real git output on this machine.
- All 471 rule ids referenced anywhere are defined, and every one has a test row.
- Every feature id is flipped by exactly the card it names. Card numbers run 001 to 090 with no gaps.

The destination of the map is reached: a spec set a Haiku-class model can follow. The map issue is closed.

Known limits, recorded for the owner:

- The visual direction was chosen without a prototype, because the owner asked for no questions. The owner should look at the running app after stage 0 and may change any token in a theme file.
- Third-party API names were checked in documentation only where noted. The spike cards exist to catch the rest before anything depends on them.
- The performance budgets are targets, measured in stage 6, not yet proven.

### Step 32. Session recovery requested, design drafted

The owner asked that no Claude session is ever lost to a terminal crash, a power cut or a quit, because running `claude` again starts an empty chat. Findings: transcripts are never deleted on a crash, plain `claude` just starts a new session; `--session-id <uuid>` lets HSOS choose the id before launch. Design: new module `sessions` with an fsynced append-only ledger, auto-resume on terminal restore, transcript backup and a picker. It's drafted in `docs/drafts/session-recovery.md`. Paused at the owner's request before writing it into `spec/`.

### Step 33. Terminal input: the best of Windows Terminal and VS Code

The owner reported two things. Shift+Enter makes a new line in Claude Code in the VS Code terminal but not in Windows Terminal. Wispr Flow dictation lands in Windows Terminal but not in the VS Code terminal, so every dictation is copied and pasted by hand. The owner asked for both, plus anything else either terminal does better, researched and written into the spec without questions. Findings and sources are in `docs/research/terminal-best-of-both.md`.

Findings:

- Wispr Flow puts the text on the clipboard, presses Shift+Insert through Windows, and restores the old clipboard about half a second after the first read. Since Claude Code 2.1.269 turns on the kitty keyboard protocol in the VS Code terminal, VS Code's xterm.js encodes Shift+Insert as a key sequence and the browser paste never fires. Windows Terminal binds Shift+Insert to paste, so it works there.
- Windows Terminal 1.25 added the kitty protocol, so Shift+Enter now works there too. The owner's observation was true for 1.24 and earlier.
- HSOS's `ESC CR` for Shift+Enter glues two lines into one command in PowerShell. Tested in ConPTY on this machine: ConPTY reports it as Alt+Enter, which PSReadLine leaves unbound. Binding Alt+Enter to `AddLine` fixes it, so one sequence serves both Claude Code and PowerShell.
- A bug in the existing spec: TERM-7 and LINK-3 dot-sourced the init script by path. Under Windows PowerShell's default `Restricted` policy, which applies on this machine, that fails. Loading the file's text as a script block works. The owner has no PowerShell 7, so HSOS runs Windows PowerShell 5.1 here.

Decisions:

- Paste keys are taken before xterm encodes them and the browser's own paste reads the clipboard, once, during the key press (TERM-41, TERM-46). A later xterm with the kitty protocol cannot break dictation.
- One paste pipeline for every source. Trailing whitespace is trimmed only when the program has not asked for bracketed paste, as Windows Terminal does. Under bracketed paste the confirmation threshold rises to 100 000 characters, so long dictations into Claude Code never open a dialog (TERM-43, TERM-46).
- Synthetic key presses from other programs are treated as the owner's own (TERM-47). HSOS warns once when it runs elevated, because Windows then blocks dictation apps and Explorer drops (TERM-48). Input-method and Win+H text is written once (TERM-49).
- A new reference script, `spec/reference/terminal-init.ps1`, tested in ConPTY with Windows PowerShell 5.1: the Alt+Enter binding, OSC 133 prompt marks and OSC 7 for the folder. HSOS uses the marks for Ctrl+Up and Ctrl+Down between commands at a prompt, and the folder to restart or restore a terminal where it really was (TERM-70 to TERM-73). A `shellIntegration` setting turns it off. `pty-host` writes the script at every start (TERM-8).
- Variables that name another terminal (`WT_SESSION`, `VSCODE_*` and similar) are removed from shell environments, so Claude Code never thinks it runs in Windows Terminal or VS Code (TERM-2).
- Not taken: quake mode, admin profiles, command decorations, sticky scroll, a recent-command picker, terminal IntelliSense. The owner has not asked for them.
- `write-file-atomic` added to the terminal module's allowed packages. TERM-50 already required atomic writes without listing it.

Spec changes: `spec/modules/terminal.md` (TERM-2, TERM-7, TERM-8, TERM-41, TERM-43, TERM-45 to TERM-49, TERM-57, TERM-70 to TERM-73, two commands, tests), `spec/modules/claude-link.md` (LINK-3, LINK-4 test), `spec/contracts/channels/terminal.ts` (`shellIntegration`, `hostInfo`), `spec/contracts/paths.ts` (`terminalInitFile`), `spec/02-architecture.md` (data table), `spec/reference/terminal-init.ps1`, cards 030, 034, 036 and 051, features F-055 and F-056, glossary. 481 rules, 56 features. Contracts compile under TypeScript 7.0.2 and zod 4.6.7.

The owner can fix VS Code today, before HSOS exists, with one keybinding: `{ "key": "shift+insert", "command": "workbench.action.terminal.paste", "when": "terminalFocus" }`.

### Step 34. Spoken alerts, Claude setup view, agent view in the graph

The owner shared a summary of a video about an "AI OS" setup and asked for a judgement, then said to do whatever is most logical. The owner also said they like Obsidian-style linked notes because an agent can start at `CLAUDE.md` and follow links instead of loading everything, and they want a strong UI to see how the files connect. Findings and sources are in `docs/research/agent-map-setup-voice.md`.

Judgement on the video: two ideas taken (a map of the setup to prune unused parts, spoken alerts), the rest left out. Fish Audio was replaced by Windows' built-in voice: no key, offline, nothing leaves the machine. The hourly auto-reply email routine was rejected: email is already outside HSOS, and unreviewed replies in the owner's name are unsafe.

On linked notes: the idea holds, with one trap. Claude Code loads `CLAUDE.md`, its `@path` imports, rules without `paths` and the first 200 lines of `MEMORY.md` at every start. Everything else is read only when Claude follows a link or a search to it. Imports do not save context; links do. The graph module already gave the Obsidian-style view (wiki links, aliases, backlinks, local graph, communities). What was missing was the agent's point of view.

Decisions:

- Spoken alerts (HUD-13 to HUD-16, SHELL-28, SHELL-29). They speak on the same changes as HUD-10, but also when the window is focused and the owner is in another panel. Nothing is spoken when the owner is looking at that session's terminal. The text is the session title with "Finished" plus the first sentence of Claude's last message, or "Needs you" plus the reason. The voice is Windows `System.Speech` through `powershell.exe`, with the text on stdin. Tested on this machine with Zira. On by default, because the owner's problem is missing alerts; one command turns it off.
- Claude setup view (HUD-50 to HUD-55, LINK-70 to LINK-74). A dock panel lists MCP servers, plugins, skills, subagents, hooks and permission rules, each with its scope, file and last use. Last use comes from HSOS's own hook counts for MCP servers and subagents, and from Claude Code's undocumented `skillUsage` and `pluginUsage` counters for skills and plugins, read only when their shape matches. Read-only: "Ask Claude to remove" types a request into the Claude terminal without Enter. No secrets: only command file names and URL hosts are returned.
- Agent view in the graph (GRAPH-40 to GRAPH-45). `@path` imports become their own edge kind. Each note knows whether it loads at start and its line count. The view shows the start files with their total lines and warns about files over 200 lines. It colours notes by link hops from the start files, mutes notes no link reaches, and shows the chain of links that reaches each note. A hover card previews a note without opening it. The Claude root now also indexes `rules\**\*.md`.
- New stage 7 with cards 091 to 094, so no existing card is renumbered. The session recovery work may still renumber everything later.
- "Usage by skill and connector" moved out of "Later": stage 7 shows last use. Cost per skill stays later.
- Not taken: reading graphify's output into the graph. Graphify maps code, HSOS maps notes.

Spec changes: `spec/modules/shell.md`, `hud.md`, `claude-link.md`, `graph.md`, `spec/01-capability-map.md`, contracts `shell.ts`, `hud.ts`, `claude-link.ts`, `graph.ts`, `paths.ts`, `tasks/stage-7.md`, features F-057 to F-059, glossary. 504 rules, 59 features, 94 cards. Contracts compile under TypeScript 7.0.2 and zod 4.6.7.

### Step 35. Claude session recovery written into the spec

The owner asked for the session recovery design of step 32 to go into the spec. It is now module `sessions` (prefix `SESS`, 24 rules), service in `link-service`, panels in `ui`, built in stage 3 as cards 056 to 059. Cards 056 to 094 became 060 to 098; feature card numbers and every "card NNN" reference moved with them. Facts were re-checked with Claude Code 2.1.327: `--session-id <uuid>`, `-r/--resume`, `-c`, `--fork-session`, the subcommand list, the `SessionStart` sources, the `SessionEnd` reasons and the transcript line types.

Changes from the draft, and why:

- **One record file per session instead of one append-only ledger.** The `claude` wrapper and the service would both have appended to the same file from different processes. Windows does not promise that two appends from two processes land whole. Now the wrapper writes its own small launch file (flushed, then renamed), and only the service writes records, each with `write-file-atomic`. No torn lines, no compaction.
- **Ended or interrupted by the `SessionEnd` reason.** `clear`, `resume`, `logout` and `prompt_input_exit` are the owner's choice, so they end a session. Anything else, including `other` and no `SessionEnd` at all, is interrupted and gets resumed. This covers a killed Claude at app stop without having to order the stop sequence across processes.
- **The terminal does not import `sessions`.** It gained an extension point, `terminalRecovery`, that `sessions` fills from the ui process. So `terminal` stays in stage 1 and needs no knowledge of Claude. The restored shell starts without a launch, the offer binds the new terminal id to disk, then the resume command is typed. A second crash resumes the same session again.
- **`claude-link` passes every accepted hook to observers** (LINK-15) instead of `sessions` parsing hooks itself.
- **`transcript_path` is trusted only under `%USERPROFILE%\.claude\projects\`**, so a hook payload cannot make HSOS copy an arbitrary file.
- **The wrapper is now reference code**, `spec/reference/shell-init.ps1`, tested with a stub `claude` under Windows PowerShell 5.1 and the Restricted policy. Writing it found two bugs in LINK-4: `--mcp-config` takes several values, so an owner's prompt typed after it was read as a config file, and HSOS's flags in front of a subcommand such as `claude doctor` would be refused. `--mcp-config` now comes first and subcommands run as typed.
- **No project id in backup paths.** Session ids are unique, so backups are `transcripts\<sessionId>.jsonl`.

One test run during the research started the real `claude` instead of the stub, because Git Bash rewrote `PATH`. It stopped at once on a missing settings file and sent nothing. The wrapper test in card 056 now refuses to run unless the stub is the `claude` that `Get-Command` finds.

Spec changes: new `spec/modules/sessions.md`, `spec/contracts/channels/sessions.ts`, `spec/reference/shell-init.ps1`; `ids.ts` (`sessions`), `paths.ts` (`sessionsDir`), `terminal.ts` (`terminalRecovery`), `claude-link.ts` (`hookObservers`); `terminal.md` TERM-24, TERM-25, TERM-57; `claude-link.md` LINK-2, LINK-4, LINK-6, LINK-15; `01-capability-map.md`, `02-architecture.md`, `05-testing.md` REL-13; cards 051, 056 to 059, 074, 080; features F-060 and F-061; glossary. 19 modules, 530 rules, 61 features, 98 cards.
