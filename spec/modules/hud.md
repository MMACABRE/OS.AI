# Module: hud

## Purpose

One glance tells the owner: which Claude sessions need them, what each is doing, how much of the usage limits is left, and which skill to reach for. It replaces the owner's `agent-hud` mod and covers every session in every terminal at once.

## Interface

No channels of its own. It reads `contracts/channels/claude-link.ts`, `skills.ts` and `terminal.ts`, and calls `shell.notify`, `shell.speak`, `shell.listVoices`, `shell.revealInExplorer`, `terminal.write`, `terminal.getLastOwnerInput`, `skills.setState` and `skills.openSkillsFolder`. Background: `docs/research/agent-map-setup-voice.md`.

- Runs in: `ui`. Its `register.service.ts` runs in `main` and does one thing: it registers `hudSection` from `contracts/channels/hud.ts`.
- Third-party packages allowed: `zustand`, `zod`.

## Panel

Side view `hud.panel`, in the right area by default. One column: the quick bar, then four sections in this order. Each section has a title row that collapses it; the collapsed set is saved in the panel state.

```
┌ fix login flow ─────────────────────────┐
│ [Usage 58%] [Context 41%] [Skills]      │
│ [Opus 5.5 · high ▾] [Plan ⇄] [Compact]  │
│ [Clear] [More ▾]                        │
├ SESSIONS ───────────────────────────────┤
│ ● needs you   fix login flow            │
│   Permission: Bash            opus  41% │
│ ◐ working     refactor parser           │
│   Edit · 2 agents             fable 63% │
│     ├ Explore        haiku   Grep       │
│     └ general-purpose        Read       │
│ ○ done        write tests      warm 52m │
├ USAGE ──────────────────────────────────┤
│ 5 hours   ████████░░░░░░  58%  resets 2h 10m │
│ 7 days    ███░░░░░░░░░░░  21%  resets Thu    │
├ SKILLS ─────────────────────────────────┤
│ [ search skills…                      ] │
│ ★ caveman            Ultra-compressed…  │
│ ☆ graphify           Turn any folder…   │
├ SKILLS REPO ────────────────────────────┤
│ ✓ In sync                     [ Check ] │
└─────────────────────────────────────────┘
```

## Behaviour

### Quick bar

Claude Code's most used slash commands as buttons, so the owner does not have to type them. Each acts on the **target session**: the session of the HUD-31 target terminal.

- **HUD-60.** The bar's title row shows the target session's title. With no target, the speed dial still works and every other button is disabled with the tooltip "Start a Claude session first".
- **HUD-61.** Speed dial, always the first three buttons:
  - "Usage" shows the higher of the two `UsageLimits` percentages, toned as HUD-25. It opens a popover with the HUD-25 bars and "Open /usage in Claude", which sends `/usage` (HUD-63).
  - "Context" shows `contextUsedPercentage`, toned as HUD-9. It opens a popover with a bar, `contextTokens` of `contextWindowSize` written as `41k of 200k tokens`, the cache state of HUD-8, "Open /context in Claude" (sends `/context`, which shows Claude Code's own breakdown) and "Compact…" (HUD-65). Before the first statusline input it reads "No data yet".
  - "Skills" runs `hud.searchSkills`: it expands the Skills section, scrolls to it and focuses its search field.
- **HUD-62.** The model button shows `model` and, when `effort` is not null, `· <effort>`. Its menu lists `quickModels`, with the current one checked when `modelId` or `model` contains it, then a separator and `quickEfforts`, with `effort` checked. Choosing a model sends `/model <name>`; choosing an effort sends `/effort <level>`.
- **HUD-63.** Sending a command to the target terminal:
  - when the session's activity is `needs-you`, nothing is written, and a toast says "Claude is waiting for you in the terminal. Answer it first.", with "Go to terminal";
  - when the activity is `idle` or `done`, and `terminal.getLastOwnerInput` is null or earlier than the later of `lastResponseAt` and `startedAt`, the command and `\r` are written with `source: 'quick-command'`. Nothing has been typed into Claude's input since its last reply, so the input is empty and only the command runs;
  - otherwise the command is written without `\r` as an `owner` write, and a toast says "Typed <command>. Press Enter in the terminal to run it.";
  - in every case but the first, the target terminal is then focused.

  HSOS never presses Enter on text it did not write itself in the same call. That is the whole safety of this rule: a half-typed prompt is never sent.
- **HUD-64.** The mode button shows `permissionMode` as "Default", "Accept edits", "Plan", "Auto", "Don't ask" or "Bypass", and the raw value for anything else, with the tooltip "As Claude last reported it". Pressing it writes `\x1b[Z` (Shift+Tab, which cycles the mode in Claude Code) with `source: 'quick-command'`, unless the activity is `needs-you` or `ended`, where it does what HUD-63 does for `needs-you`. It does not take focus.
- **HUD-65.** "Compact" opens a dialog titled "Compact this conversation?" with the text "Claude replaces the conversation so far with a summary to free up context. Details from earlier messages can be lost, and writing the summary uses some of your plan's usage.", an optional field "Keep in the summary", and the buttons "Compact" (warning tone) and "Cancel", which has focus. "Compact" sends `/compact`, followed by a space and the field's text when it is not empty.
- **HUD-66.** "Clear" opens a dialog titled "Clear this conversation?" with the text "Claude starts a new, empty conversation in this terminal. The current one stays saved: you can resume it from Session History.", and the buttons "Clear" (danger tone) and "Cancel", which has focus. "Clear" sends `/clear`.
- **HUD-67.** "More" opens a menu: "Session history" (command `sessions.history`), "Find session" (command `sessions.find`), a separator, then one item per entry of `quickCommands`, each sending that command.
- **HUD-68.** Every command text HSOS sends is fixed by this spec or comes from `quickModels`, `quickEfforts` and `quickCommands`, each value matching `^/?[a-z][a-z0-9:._\[\]-]{0,60}$` (settings reject others), and the compact field, from which line breaks and control characters are removed before sending.

### Session ribbon

Claude Code prints its model, effort, folder and mascot at the top of the conversation, and they scroll out of sight as the chat grows. The ribbon keeps them in view above every Claude terminal.

- **HUD-80.** The HUD contributes to `terminalHeader` (TERM-75). For a terminal with a Claude session that is not `ended` (the newest bound session, SESS-11), it draws the ribbon; for any other terminal it returns null. It is `Surface role="ribbon"`, 32 px high when collapsed. A live ribbon is a steam source (UI-35) in `color.live`, or `color.brand` while its session needs the owner.
- **HUD-81.** Collapsed, from left to right:

| Part | Content | Pressing it |
|---|---|---|
| Mascot | HUD-90, 32 px high (the 16 by 16 cell at 2x) | expands or collapses the ribbon |
| Chat name | the session title (the custom title of SESS-61 when set), cut with an ellipsis, full in its tooltip | opens Session History (`sessions.history`) |
| Model and effort | `model` and `· <effort>` | the model menu of HUD-62 |
| Mode | the HUD-64 label, shown when not `default` | as HUD-64 |
| Folder | `cwd` with the home folder shown as `~`, middle-cut to fit | reveals it in the Files view |
| Repo | `owner/repo` from `webUrl` of the open project's git status, with the branch, when the session's `cwd` is inside that project or one of its worktrees; else hidden | opens `webUrl` with `shell.openExternal` |
| Context | a 40 px bar and the percentage (HUD-9 tones) | the Context popover of HUD-61 |
| Agents | `<n> agents` while subagents run, else hidden | expands the ribbon |

  Parts that do not fit are dropped from the right in this order: context bar (the number stays), folder, repo, mode. The chat name shrinks before anything is dropped.
- **HUD-82.** Expanded, the ribbon grows below its first line (the terminal resizes, TERM-75) to list each running subagent on one row: its own small mascot (HUD-92), agent type, model when known, its description, its current tool, and time since it started. Subagents that ended stay for 60 seconds with "done" (LINK-29). With none running it shows "No subagents running." The expanded state is saved per terminal in the panel state.
- **HUD-83.** Changes move (P-42): a new subagent row slides in (MOT-3), a changed value rolls (MOT-8), and expanding or collapsing slides the extra rows with `clip-path` over `motion.normal`, while the terminal resizes once at the end.

### Mascot

An original pixel-art character drawn for HSOS (`design/direction-brief.md`), not a copy of any other product's sprite. It shows at a glance what its session is doing.

- **HUD-90.** The mascot is drawn from a sprite sheet of 16 by 16 pixel cells at whole-number scale, with `image-rendering: pixelated`. Its state follows the session's activity:

| Activity | State | Loop |
|---|---|---|
| `working`, `background` | dancing | a dance of at least 6 frames at 8 frames a second |
| `needs-you` | waving | waves and hops; the waving arm is `color.accent` |
| `done` | cheering | one jump, then a slow bob |
| `idle` | resting | blinks every few seconds |
| `ended` or no session | sleeping | slow breathing with a small "z" |

  While the activity is `working` or `background`, a mascot shown on the Notes page uses the state reading (it reads a book) and one shown on the Code page uses working (it types on a laptop); everywhere else it dances. A page's mascot is on the page it is drawn on, so the same session can dance on the Dashboard while it types in its Code page ribbon.
- **HUD-91.** A change of state plays a 3-frame turn before the new loop. The sprite sheet is `resources/art/mascot.png` with its frame map `mascot.json`, copied from `spec/reference/art/`. The map names each state's row, frame count, frames a second and loop. A missing or unreadable sheet draws a placeholder of plain coloured blocks and records a problem.
- **HUD-92.** Each running subagent has a mini mascot, 16 px high (the cell at 1x), that follows the session's mascot in the ribbon and dances while its subagent runs. At most 5 are drawn; more show as `+<n>`.
- **HUD-93.** Under `data-motion="reduced"` each state shows its first frame and nothing loops (MOT-12). The mascot is decorative: it has no accessible name, and the state is also said in words wherever the mascot is the only sign of it (the ribbon's tooltip, the mascot widget's word).

### Sessions (the attention board)

- **HUD-1.** The section lists sessions of the open project: those whose `cwd` is the project folder, inside it, or inside one of its worktrees. A toggle in the section menu, "Show all projects", lists every session.
- **HUD-2.** Order: `needs-you` first, then `working`, `background`, `done`, `idle`, `ended`. Within a group, newest change first.
- **HUD-3.** Each session row shows:

| Part | Content |
|---|---|
| Dot and word | by activity, from the table below |
| Title | session title, one line, cut with an ellipsis |
| Second line, left | `attentionReason` when `needs-you`; else `currentTool` and, when subagents are running, `· n agents`; else the last message's first line |
| Second line, right | model short name and context percentage |
| Cache | for `done` and `idle` sessions: `warm 52m` (minutes of warmth left) or `cold`, from `lastResponseAt` and `cacheWarmMinutes` (HUD-8) |

| Activity | Dot | Word | Tone |
|---|---|---|---|
| `needs-you` | filled | needs you | `accent` |
| `working` | half | working | `state.info` |
| `background` | half, outlined | background | `state.info` |
| `done` | ring | done | `state.ok` |
| `idle` | ring, muted | idle | `text.muted` |
| `ended` | none | ended | `text.muted` |

- **HUD-4.** Running subagents are listed under their session, indented: agent type, model when known, and current tool. A subagent that ended is removed after it has shown "done" for 60 seconds (LINK-29).
- **HUD-5.** Activating a row (click or Enter) focuses that session's terminal panel and calls `link.markSeen`. A session with no terminal in HSOS does nothing on activation and shows "outside HSOS" in place of the model.
- **HUD-6.** A session that changes to `needs-you` pulses its dot as MOT-9 says.
- **HUD-7.** A terminal panel gaining focus calls `link.markSeen` for the sessions bound to it.
- **HUD-8.** Cache state is computed in the UI every 30 seconds: minutes left = `cacheWarmMinutes` − minutes since `lastResponseAt`. Above zero shows `warm <n>m`; otherwise `cold`. A tooltip explains: "After this time the next message re-reads the whole conversation at full cost."
- **HUD-9.** Context percentage is toned `state.warn` from 70 and `state.danger` from 90. Cost is shown in the row's tooltip, not in the row.

### Notifications

- **HUD-10.** When a session changes to `needs-you`, or to `done` after working for at least 30 seconds, and the HSOS window is not focused, `shell.notify` is called with the session title and the reason or "Finished". Its `focusPanel` is the session's terminal panel.
- **HUD-11.** At most one notification per session per 10 seconds. Settings: `hud.notifyOnNeedsYou` and `hud.notifyOnDone`, both default true.
- **HUD-12.** Status item `hud.attention` (right): `n need you` in accent when `n` is above zero, hidden otherwise. Pressing it focuses the first `needs-you` session's terminal.
- **HUD-13.** With `speakAlerts` on, the same two changes as HUD-10 also call `shell.speak` with `speakVoice` (null when empty) and `speakRate`, unless the HSOS window is focused and the session's terminal panel is the focused panel, because then the owner is already looking at it. This holds when the window is focused and the owner is in another panel or another terminal.
- **HUD-14.** The spoken text:
  - for `needs-you`: `<title>. Needs you. <reason>.`
  - for `done`: `<title>. Finished.`, followed, when `speakSummary` is on and `lastMessage` is not empty, by a space and the first sentence of `lastMessage`.

  `<title>` is the session title cut to 60 characters at a word boundary. The first sentence is found after turning the message into plain text: fenced code blocks are removed, line breaks become spaces, backticks, `#`, `*`, `_` and `>` markers are removed, a link `[text](url)` becomes `text`, and bare URLs are removed. It ends at the first `.`, `!` or `?` followed by a space or the end, and is cut to 160 characters at a word boundary. Text from the session is data (P-6).
- **HUD-15.** At most one spoken alert per session per 10 seconds, counted separately from HUD-11.
- **HUD-16.** Command `hud.toggleSpokenAlerts` flips `speakAlerts` and shows a toast "Spoken alerts on" or "Spoken alerts off". Command `hud.testVoice` speaks `This is how HSOS alerts sound.` with the current voice and rate. Command `hud.chooseVoice` opens a dialog listing "Windows default" and then the names from `shell.listVoices`, with the current one selected. Choosing one sets `speakVoice` (empty for "Windows default") and speaks the test line with it. An empty list leaves only "Windows default". The settings screen shows `speakVoice` as its normal text field.

### Session recap

- **HUD-20.** A terminal panel that has been hidden or unfocused for at least 60 seconds while its session produced events shows a recap strip at its top edge when it regains focus.
- **HUD-21.** The strip is one line, built from `link.getSessionEvents` since the panel lost focus: `While you were away: 2 prompts answered · 7 files edited · 14 tool calls · 1 failed`. Zero counts are left out.
- **HUD-22.** Pressing the strip opens the Activity view filtered to that session. Any key press in the terminal, or the strip's close button, removes it. It never takes focus and never covers terminal rows: the terminal is resized to make room and resized back.

### Usage

- **HUD-25.** Two bars from `link.getUsageLimits`: "5 hours" and "7 days". Each shows the percentage, a bar toned by the thresholds `hud.warnAt` (default 60) and `hud.dangerAt` (default 85), and the reset time: as a duration when under 24 hours (`resets 2h 10m`), else as a weekday and time (`resets Thu 14:00`).
- **HUD-26.** A window that is null shows a muted bar and "No data yet". When `updatedAt` is older than 10 minutes the section title shows "updated 14m ago".
- **HUD-27.** Status items `hud.usage5h` and `hud.usage7d` (right) show `5h 58%` and `7d 21%`, toned the same way, hidden while null. Pressing either opens the HUD.

### Skills deck

- **HUD-30.** A search field filters `skills.list` by name and description, matching every typed word in any order, case ignored. Favourites come first in starred order, then the rest by name.
- **HUD-31.** Activating a skill writes `/<name> ` (with the trailing space, no Enter) to the target terminal and focuses it. The target is the most recently focused terminal that has a Claude session not `ended`. With none, a toast says "Start a Claude session first" with the action "New Claude Session".
- **HUD-32.** Each row has a star toggle and a "Run in background" action. That action opens a dialog: skill name, an arguments field, a model select (`runModels`, default `runModel`), an effort select when `runEfforts` is not empty, and the line "This starts a separate Claude run on <model> and uses your plan's usage." The primary button is "Run".
- **HUD-33.** Runs appear beneath the search field while any exists: skill, state, elapsed time, and for finished runs "View report" (opens the report in a dialog as `MarkdownView`) and "Dismiss". A running run has "Cancel".
- **HUD-34.** The row menu has "Open SKILL.md", which opens the file in a viewer, and "Show in folder", which calls `shell.revealInExplorer` with the file.
- **HUD-35.** The section's title row has a folder button, "Open skills folder", which calls `skills.openSkillsFolder`. `NOT_FOUND` shows a toast with the message and "Settings", which opens the Skills settings.
- **HUD-36.** A row whose `state` is not `on` shows a chip: "name only", "you only" or "off", muted for "off". A filter row under the search field narrows the list by state (All, On, Name only, You only, Off) and by source (All, User, Project, Plugin).
- **HUD-37.** The row menu has "State", with four choices, the current one checked:

| Choice | `state` | Line under it |
|---|---|---|
| On | `on` | Claude sees it and can use it. |
| Name only | `name-only` | Claude sees the name but not the description, which saves context. |
| You only | `user-invocable-only` | Hidden from Claude. You can still run /name. |
| Off | `off` | Hidden from Claude and from you. |

  Under the choices a muted line names where it is saved: "Saved in <file>" for `local`, `project` and `user`. With `stateSource: 'default'` two more choices pick the `scope`: "For all projects" (`user`, the default) and "For this project only" (`project-local`). Choosing a state calls `skills.setState`. A `stateLock` disables the choices and shows its reason (SKILL-9) instead. A failure shows a toast with its message. A success shows "Saved. New Claude sessions use it; a running session may need restarting."

### Skills repo

- **HUD-40.** One row from `skills.getRepoSync`:

| State | Row |
|---|---|
| `not-configured` | "Skills repo not found" and "Settings" |
| `checking`, `syncing` | "Checking…" or "Syncing…" |
| `in-sync` | check mark, "In sync" |
| `out-of-sync` | "3 changed · 1 new · 2 only in repo · ↑1 ↓0", and the button "Sync" |
| `error` | the error sentence and "Retry" |

- **HUD-41.** "Sync" calls `skills.pushToRepo` after a confirmation that lists the folders to be pushed. "Check" calls `checkRepoSync`. Folders only in the repo are listed in the row's tooltip.

### Claude setup view

Dock panel `hud.setup`, single instance, title "Claude Setup". It shows what the owner's Claude Code setup holds so unused parts can be found and removed. It reads `link.getSetup` and `skills.list` and changes nothing (LINK-6).

```
┌ Claude Setup ─────────────────────────────── Refresh ┐
│ 3 MCP servers · 9 plugins · 43 skills · 2 subagents  │
│ 5 hooks · 14 permission rules     Show what loads at start │
│ [search…]  [ ] Not used in 30 days   Sort: Name ▾    │
├ MCP SERVERS ─────────────────────────────────────────┤
│ firecrawl   user     http  api.firecrawl.dev  3 d ago│
│ old-db      project  stdio node.exe       never seen │
├ PLUGINS ─────────────────────────────────────────────┤
│ agent-hud@mmacabre-skills  0.3.1  on      2 h ago   │
└──────────────────────────────────────────────────────┘
```

- **HUD-50.** The header line counts each section, then a "Show what loads at start" button that runs the command `graph.agentView` (GRAPH-43), shown only when that command is registered. Sections, each collapsible and each its own error boundary: MCP servers, Plugins, Skills, Subagents, Hooks, Permissions.
- **HUD-51.** Each row shows its name, scope, the section's own columns (transport and target for MCP servers, version and on/off for plugins, the source for skills, the event and handler count for hooks, the effect for permissions), and "Last used": a relative time such as `3 d ago`, or `never seen` when unknown. Its tooltip names the counter: "Counted by Claude Code" for `source: claude`, "Seen by HSOS, in HSOS terminals only" for `source: hsos`. Hooks and permissions have no "Last used" column.
- **HUD-52.** A skill's "Last used" comes from `skillUse[name]`, else `never seen`. Skills show the same rows as the skills deck (SKILL-1 to SKILL-4).
- **HUD-53.** The toolbar has a search field (matches name, target and file, every word, case ignored), the toggle "Not used in 30 days", which keeps rows whose last use is older than 30 days or unknown, in the sections that have "Last used", and a sort select: "Name" (default) or "Least recently used first", unknown first.
- **HUD-54.** Each row has "Open file", which opens its `file` in a viewer, and "Ask Claude to remove", which writes `Remove the <kind> "<name>" from my Claude Code setup in <file>. Tell me what else depends on it first.` without Enter to the target terminal of HUD-31 and focuses it. `<kind>` is `MCP server`, `plugin`, `skill`, `subagent`, `hook for <event>` or `permission rule`. With no Claude session, the HUD-31 toast shows.
- **HUD-55.** The view calls `getSetup` with the open project's folder when it opens, when "Refresh" is pressed, and when it gains focus more than 10 seconds after the last read. Each entry of `errors` shows as a line in `color.state.warn` above the sections: "Could not read <file>: <message>", with "Open file".

## Settings section

| Key | Type | Default |
|---|---|---|
| `notifyOnNeedsYou` | boolean | `true` |
| `notifyOnDone` | boolean | `true` |
| `warnAt` | number 1 to 99 | `60` |
| `dangerAt` | number 1 to 100 | `85` |
| `showRecap` | boolean | `true` |
| `speakAlerts` | boolean | `true` |
| `speakSummary` | boolean | `true` |
| `speakVoice` | string, a voice name or empty | empty (Windows default) |
| `speakRate` | number -10 to 10 | `1` |
| `quickModels` | list of model names | `default`, `opus`, `sonnet`, `haiku`, `fable` |
| `quickEfforts` | list of effort levels | `low`, `medium`, `high`, `xhigh`, `max` |
| `quickCommands` | list of slash commands for "More" | `/status`, `/memory`, `/mcp`, `/agents`, `/hooks`, `/permissions`, `/config`, `/doctor` |

## States

| Section | Loading | Empty | Error |
|---|---|---|---|
| Quick bar | buttons with no values | no target: HUD-60 | a button whose data failed shows "?" with the reason in its tooltip |
| Sessions | skeleton rows | "No Claude sessions. Start one with Ctrl+Shift+A." | when the link is not listening: "Claude Code link is off." with the reason and "Retry" |
| Usage | muted bars | "No data yet. Limits appear after a session's first reply." | same as Sessions |
| Skills | skeleton rows | "No skills found." or, when filtering, "No skill matches." | "Skills could not be read." with "Retry" |
| Skills repo | "Checking…" | `not-configured` row | error row |

A fault in one section leaves the others working (P-12): the quick bar and each section are their own error boundary.

| Claude setup view | Loading | Empty | Error |
|---|---|---|---|
| Each section | skeleton rows | "None configured." | "Could not read your Claude Code setup." with "Retry" |

## Commands

| Id | Title | Default key |
|---|---|---|
| `hud.show` | Show HUD | `Ctrl+Shift+H` |
| `hud.focusNextAttention` | Go to Next Session That Needs You | `Ctrl+Shift+U` (global) |
| `hud.searchSkills` | Search Skills | `Ctrl+Shift+K` |
| `hud.openSetup` | Show Claude Setup | none |
| `hud.toggleSpokenAlerts` | Turn Spoken Alerts On or Off | none |
| `hud.testVoice` | Test Alert Voice | none |
| `hud.chooseVoice` | Choose Alert Voice | none |

## Tests

All component tests use a fake bus fed with `ClaudeSession`, `UsageLimits`, `SkillInfo` and `RepoSync` values.

| Rule | Level | Given | When | Then |
|---|---|---|---|---|
| HUD-80 | component | terminal `t1` with a `working` session and `t2` with none | the header is asked for each | a ribbon for `t1`; null for `t2` |
| HUD-81 | component | a session with `cwd` inside the project, `webUrl` `https://github.com/o/r`, branch `main` | the ribbon renders | it shows `o/r` and `main`; pressing it calls `shell.openExternal` with the URL |
| HUD-81 | component | a 360 px wide terminal | the ribbon renders | the context bar, folder and repo are gone; the context number, model and chat name remain |
| HUD-82 | component | two running subagents | the mascot is pressed | the ribbon lists both with type, model and current tool, and the terminal was resized once |
| HUD-83 | component | an expanded ribbon | a subagent starts | its row enters with the MOT-3 motion |
| HUD-90 | component | a session going `working`, `needs-you`, `done`, `idle` | the mascot renders each | the dancing, waving, cheering and resting frames show in turn |
| HUD-90 | component | one `working` session; its mascot on the Dashboard, in its Code page ribbon and on the Notes page | they render | dancing, working and reading frames, in that order |
| HUD-91 | component | no sprite sheet in resources | the mascot renders | the placeholder sheet is used, a problem is recorded and nothing throws |
| HUD-92 | component | 7 running subagents | the ribbon renders | 5 mini mascots and `+2` |
| HUD-93 | component | `data-motion="reduced"` | a `working` session's mascot renders | one frame shows and no animation runs |
| HUD-60 | component | no Claude terminal | the bar renders | Usage, Context and Skills are enabled; the others are disabled with "Start a Claude session first" |
| HUD-61 | component | `contextTokens` 41 000 of 200 000 at 21 % | "Context" is pressed | the popover reads `41k of 200k tokens` |
| HUD-62 | component | a session with `modelId` `claude-opus-5-5`, `effort` `high` | the model menu opens | `opus` and `high` are checked; choosing `sonnet` sends `/model sonnet` |
| HUD-63 | component | an `idle` session, `lastResponseAt` 10:05, last owner input 10:02 | `/model sonnet` is sent | `terminal.write` got `/model sonnet\r` with `source: 'quick-command'` |
| HUD-63 | component | an `idle` session, `lastResponseAt` 10:05, last owner input 10:06 | `/model sonnet` is sent | `terminal.write` got `/model sonnet` with no `\r`, source `owner`; the "Press Enter" toast shows; the terminal is focused |
| HUD-63 | component | a `working` session | `/compact` is sent | no `\r` is written |
| HUD-63 | component | a `needs-you` session | any command | nothing is written; the "waiting for you" toast shows |
| HUD-64 | component | `permissionMode: 'plan'`, an `idle` session | the mode button is pressed | it reads "Plan"; `terminal.write` got `\x1b[Z` with `source: 'quick-command'`; focus did not move |
| HUD-65 | component | the compact dialog | it opens; then "Compact" with `keep the API notes` and a line break | "Cancel" has focus; then `/compact keep the API notes` is sent |
| HUD-66 | component | the clear dialog | Enter is pressed at once | the dialog closes and nothing is sent, because "Cancel" had focus |
| HUD-67 | component | `quickCommands` `['/status']` | "More" then "/status" | `/status` is sent through HUD-63 |
| HUD-68 | unit | the settings schema | `quickCommands: ['/x; rm -rf ~']` | it is rejected |
| HUD-34 | component | a skill row | "Show in folder" | `shell.revealInExplorer` got its `file` |
| HUD-35 | component | `openSkillsFolder` returns `NOT_FOUND` | the folder button is pressed | a toast with "Settings" shows |
| HUD-36 | component | skills `a` on, `b` off, `c` name-only | filter "Off" | only `b`, with the chip "off" |
| HUD-37 | component | a skill with `stateSource: 'default'` | "State" then "You only" with "For this project only" | `setState({ name, state: 'user-invocable-only', scope: 'project-local' })` |
| HUD-37 | component | a skill with `stateLock: 'plugin'` | "State" opens | the choices are disabled and "A plugin skill is managed with its plugin." shows |
| HUD-1 | component | sessions in the project, in a worktree of it, and elsewhere | the panel renders | the first two are listed; the third only with "Show all projects" |
| HUD-2 | component | sessions `idle`, `needs-you`, `working`, `done` | the panel renders | the order is needs-you, working, done, idle |
| HUD-3 | component | a `needs-you` session with reason `Permission: Bash` | it renders | the row shows the words "needs you" and the reason |
| HUD-4 | component | a session with two running subagents, one with model `haiku` | it renders | both are listed; the second line reads `· 2 agents`; one shows `haiku` |
| HUD-5 | component | a session bound to a terminal panel | its row is activated | that panel is focused and `markSeen` was called |
| HUD-8 | component | `lastResponseAt` 8 minutes ago, `cacheWarmMinutes` 60, fake clock | it renders, then 53 minutes pass | first `warm 52m`, then `cold` |
| HUD-9 | component | context 92 | it renders | the percentage has the danger tone and an accessible label saying "92 percent of context used" |
| HUD-10 | component | the window is unfocused | a session becomes `needs-you` | `shell.notify` was called once with its title |
| HUD-10 | component | the window is focused | a session becomes `needs-you` | `shell.notify` was not called |
| HUD-10 | component | a session worked for 5 seconds | it becomes `done` | no notification |
| HUD-11 | component | fake clock | a session flips to `needs-you` three times in 5 seconds | one notification |
| HUD-12 | component | two `needs-you` sessions | the status item renders | it reads `2 need you` |
| HUD-21 | unit | events: 2 prompts, 7 file edits, 14 tools, 1 failed | the recap text is built | it matches the example line |
| HUD-21 | unit | events with no failures | the text is built | no "failed" part |
| HUD-22 | component | a recap strip is showing | a key is pressed in the terminal | the strip is gone and the key reached the terminal |
| HUD-25 | unit | 58 percent, reset in 2 h 10 min | formatting | `58%`, `resets 2h 10m`, tone ok |
| HUD-25 | unit | reset in 3 days, on a Thursday at 14:00 | formatting | `resets Thu 14:00` |
| HUD-26 | component | both windows null | it renders | "No data yet" shows |
| HUD-30 | unit | skills `caveman`, `caveman-commit`, `graphify`; favourite `graphify`; query `cave com` | filtering | result is `caveman-commit` only; with an empty query `graphify` is first |
| HUD-31 | component | a focused Claude terminal | a skill is activated | `terminal.write` got `/caveman ` and no line break |
| HUD-31 | component | no Claude session | a skill is activated | a toast with "New Claude Session" shows; nothing is written |
| HUD-32 | component | the run dialog | it opens | the usage line names the selected model; "Run" calls `startRun` with the fields |
| HUD-40 | component | each `RepoSync` state | the row renders | it matches the table |
| P-12 | component | the skills list request fails | the panel renders | Sessions and Usage still render; Skills shows its error state |
| HUD-13 | component | the window is focused, the owner is in another terminal | a session becomes `needs-you` | `shell.speak` was called once |
| HUD-13 | component | the window is focused on the session's own terminal panel | the session becomes `done` after 40 s of work | `shell.speak` was not called |
| HUD-13 | component | `speakAlerts` off | a session becomes `needs-you` | `shell.speak` was not called |
| HUD-14 | unit | title `fix login flow`, `lastMessage` "## Done\n\nI fixed the **token** check in `auth.ts`. Then I ran the tests." | the `done` text is built | `fix login flow. Finished. Done I fixed the token check in auth.ts.` |
| HUD-14 | unit | a `needs-you` session with reason `Permission: Bash` | the text is built | `<title>. Needs you. Permission: Bash.` |
| HUD-14 | unit | a 300-character first sentence | the text is built | the sentence part is at most 160 characters and ends on a whole word |
| HUD-15 | component | fake clock | a session alternates `needs-you` and `working` 3 times within 5 s | `shell.speak` was called once |
| HUD-16 | component | `listVoices` returns `Microsoft Zira Desktop` | `hud.chooseVoice` runs and that voice is chosen | the dialog offered "Windows default" and that voice; `speakVoice` is set to it; `shell.speak` was called with it |
| HUD-50 | component | `graph.agentView` is not registered | the setup view renders | the "Show what loads at start" button is absent |
| HUD-51 | component | an MCP server with `lastUse { at: 3 days ago, source: 'hsos' }` | it renders | `3 d ago`, with the tooltip "Seen by HSOS, in HSOS terminals only" |
| HUD-52 | component | `skills.list` holds `caveman` and `x`; `skillUse` has `caveman` used 2 days ago | the Skills section renders | `caveman` shows `2 d ago`, `x` shows `never seen` |
| HUD-53 | component | skills used 2 days ago, 40 days ago and never | "Not used in 30 days" is turned on | the last two show |
| HUD-53 | component | the same skills | "Least recently used first" | order: never, 40 days, 2 days |
| HUD-54 | component | a focused Claude terminal; MCP server `old-db` from `C:\p\.mcp.json` | "Ask Claude to remove" | `terminal.write` got `Remove the MCP server "old-db" from my Claude Code setup in C:\p\.mcp.json. Tell me what else depends on it first.` with no line break |
| HUD-55 | component | `getSetup` returns one error | the view renders | the warning line names the file and the sections still render |
| HUD-13 | manual | HSOS running, a Claude session working in a background tab | the session finishes | the owner hears its title and "Finished" |
