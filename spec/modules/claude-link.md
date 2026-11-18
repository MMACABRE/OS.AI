# Module: claude-link

## Purpose

Makes HSOS aware of Claude Code. It learns, for every Claude session running in an HSOS terminal, what the session is doing, which subagents it has, how much of the usage limits is spent, and which files it edits. It uses only Claude Code's documented extension points and never slows Claude down.

## Interface

`contracts/channels/claude-link.ts`.

- Runs in: `link-service`. It has no panel; `hud`, `activity`, `skills` and `mcp` show its data.
- Third-party packages allowed: `zod`. The HTTP server uses Node's built-in `http` module.

## How Claude Code reports to HSOS

Verified against the Claude Code hooks, statusline and CLI documentation on 2026-11-17.

| Mechanism | What HSOS uses it for |
|---|---|
| HTTP hooks | Claude Code posts each hook event's JSON to a URL. A connection failure, a non-2xx status or a timeout is a non-blocking error: Claude carries on. |
| Hook header interpolation | Header values may contain `$VAR`; only names in `allowedEnvVars` are filled in. The URL is fixed text. |
| Plugin hooks | A plugin's `hooks/hooks.json` adds hooks that merge with the owner's own hooks. `claude --plugin-dir <dir>` loads a plugin for one session. |
| Statusline command | Claude Code runs a command with session JSON on stdin, including `rate_limits`, and shows what it prints. |
| `claude --settings <file>` | Overrides chosen settings keys for one session. Used for `statusLine` only. |

### Files HSOS generates

Written under `linkDir` at every launch, atomically. They are HSOS's own data.

| File | Content |
|---|---|
| `plugin\.claude-plugin\plugin.json` | `{ "name": "hsos-link", "version": "<app version>", "description": "Reports session activity to HSOS" }` |
| `plugin\hooks\hooks.json` | One HTTP hook per event in the table below |
| `session-settings.json` | `{ "statusLine": { "type": "command", "command": "<statusline command>" } }` |
| `shell-init.ps1` | Defines the `claude` wrapper function (LINK-4) |
| `mcp.json` | The HSOS MCP server entry (MCP-2). Written only when `mcp` is enabled. |

`session-settings.json` and `hooks.json` contain the port. `session-settings.json` also contains the launch token, because a statusline command cannot read HSOS's environment portably. This is the one exception to P-8: the file is rewritten at every launch, lives under the owner's profile, and the token is useless after HSOS exits.

### Hook entry

Every hook HSOS registers has this form, with `<Event>` in the path:

```json
{
  "type": "http",
  "url": "http://127.0.0.1:<port>/hook/<Event>",
  "timeout": 2,
  "headers": {
    "Authorization": "Bearer $HSOS_LINK_TOKEN",
    "X-HSOS-Terminal": "$HSOS_TERMINAL_ID"
  },
  "allowedEnvVars": ["HSOS_LINK_TOKEN", "HSOS_TERMINAL_ID"]
}
```

The `PreToolUse` hook for file edits uses `"timeout": 3` (LINK-30). No hook sets `onFailure`, so every failure is non-blocking.

### Events registered

| Event | Matcher | Used for |
|---|---|---|
| `SessionStart` | none | Register the session; read `source`, `model`, `session_title` |
| `SessionEnd` | none | Mark the session ended |
| `UserPromptSubmit` | none | Activity `working`; title from `prompt` when no title exists |
| `PreToolUse` | none | `currentTool`; subagent spawn details; snapshot before edit |
| `PostToolUse` | none | Clear `currentTool`; record file edits |
| `PostToolUseFailure` | none | Clear `currentTool`; record the failure |
| `PermissionRequest` | none | Activity `needs-you` |
| `Notification` | none | Activity `needs-you` for chosen types |
| `SubagentStart` | none | Add a subagent |
| `SubagentStop` | none | End a subagent |
| `Stop` | none | Activity `done` or `background`; `lastMessage` |
| `StopFailure` | none | Activity `needs-you` with the error |

### Statusline command

```
curl.exe -s -m 1 -X POST -H "Authorization: Bearer <token>" -H "Content-Type: application/json" --data-binary @- http://127.0.0.1:<port>/statusline
```

`curl.exe` ships with Windows. The command reads the statusline JSON from stdin, posts it, and prints HSOS's reply, which is the text to show.

## Behaviour

### Setup

- **LINK-1.** At start `link-service` asks `main` for the launch token, then listens on `127.0.0.1` at `port`. If the port is taken it tries the next 20 in turn. With none free, `isListening` is false and the HUD shows the reason.
- **LINK-2.** After listening, it writes the generated files, then calls `terminal.setExtraEnv` with:

| Variable | Value |
|---|---|
| `HSOS_LINK_TOKEN` | the launch token |
| `HSOS_LINK_PORT` | the port |
| `HSOS_PLUGIN_DIR` | `linkDir\plugin` |
| `HSOS_SESSION_SETTINGS` | `linkDir\session-settings.json` |
| `HSOS_SHELL_INIT` | `linkDir\shell-init.ps1` |

- **LINK-3.** When `HSOS_SHELL_INIT` is set and the shell is `pwsh.exe` or `powershell.exe`, `terminal` loads the file through the loader of TERM-7, which reads it as text and runs it as a script block, so it works under the `Restricted` execution policy. This rule is implemented in `terminal`'s spawn step and listed here because `claude-link` supplies the variable.
- **LINK-4.** `shell-init.ps1` defines a function `claude` that finds the real `claude` executable with `Get-Command claude -CommandType Application`, and runs it with `--plugin-dir $env:HSOS_PLUGIN_DIR --settings $env:HSOS_SESSION_SETTINGS`, then `--mcp-config $env:HSOS_MCP_CONFIG` when that variable is set and the file exists, then the owner's own arguments. `HSOS_MCP_CONFIG` is set by LINK-2 to `linkDir\mcp.json` when `mcp` is enabled. If no executable is found it prints `Claude Code is not installed or not on PATH.` The owner's profile script still runs first, because `-NoExit -Command` runs after the profile.
- **LINK-5.** With `enabled` false, no server listens, no variables are set, and shells start without the wrapper.
- **LINK-6.** HSOS never edits `~/.claude/settings.json`, the project's `.claude` folder, or any other Claude Code file.
- **LINK-7.** `getStatus` reports whether `claude` is on `PATH` and its version, found by running `claude --version` once at start with a 5 000 ms timeout.

### Receiving

- **LINK-10.** Every request must carry `Authorization: Bearer <launch token>`. Others get status 401 and are logged once per minute at most (P-7).
- **LINK-11.** The request body is parsed as JSON and validated against the schema for its event in `src/modules/claude-link/service/hook-schemas.ts`. Schemas require only the fields HSOS uses and allow unknown fields. An invalid body gets status 200 with an empty body and is logged at `warn`: a fault in HSOS must never surface in Claude.
- **LINK-12.** Every hook request is answered with status 200 and an empty body within 50 ms, except the pre-edit snapshot (LINK-30). HSOS never returns a decision, so it never blocks, allows or alters anything Claude does.
- **LINK-13.** Bodies above 5 MB are refused with status 413.
- **LINK-14.** Text from hook payloads is data (P-6). It is cut to the lengths in the contract, has control characters other than line breaks removed, and is only ever displayed.

### Sessions

- **LINK-20.** A session is created on the first event carrying an unknown `session_id`, not only on `SessionStart`, so a session is picked up even if HSOS started after it. `terminalId` comes from the `X-HSOS-Terminal` header when it names a live terminal.
- **LINK-21.** Activity changes:

| Event | New activity | Other changes |
|---|---|---|
| `UserPromptSubmit` | `working` | clears `attentionReason` |
| `PreToolUse` | `working` | `currentTool` set (main agent or the subagent named by `agent_id`) |
| `PostToolUse`, `PostToolUseFailure` | unchanged | `currentTool` cleared |
| `PermissionRequest` | `needs-you` | `attentionReason` = `Permission: <tool_name>` |
| `Notification` with type `permission_prompt`, `elicitation_dialog`, `elicitation_url_dialog` or `agent_needs_input` | `needs-you` | `attentionReason` = the `message` |
| `Notification` of other types | unchanged | |
| `Stop` with `background_tasks` empty | `done` | `lastMessage`, `lastResponseAt` set |
| `Stop` with `background_tasks` not empty | `background` | `lastMessage`, `lastResponseAt` set |
| `StopFailure` | `needs-you` | `attentionReason` = the `error` text |
| `SessionEnd` | `ended` | all subagents ended |

- **LINK-22.** A `needs-you` session returns to `working` on the next `PreToolUse`, `PostToolUse` or `UserPromptSubmit`.
- **LINK-23.** Events with an `agent_id` update that subagent, not the main agent, for `currentTool`.
- **LINK-24.** `markSeen` turns `done` into `idle`. It has no effect on other activities.
- **LINK-25.** When a terminal exits, every session bound to it becomes `ended`.
- **LINK-26.** Ended sessions beyond `keepEndedSessions` are removed, oldest first, with `sessionRemoved`.
- **LINK-27.** `sessionChanged` is emitted at most once per 100 ms per session, carrying the latest state.

### Subagents

- **LINK-28.** A `PreToolUse` whose `tool_name` is `Agent` stores its `tool_input` fields `subagent_type`, `model` and `description` as a pending spawn for that session. The next `SubagentStart` with a matching `agent_type` takes the oldest pending spawn's `model` and `description`. Without a match, both are null.
- **LINK-29.** `SubagentStop` sets `endedAt`. Ended subagents stay listed for 60 seconds, then are dropped.

### Snapshot before edit

- **LINK-30.** For a `PreToolUse` whose `tool_name` is `Write`, `Edit`, `MultiEdit` or `NotebookEdit`, with `snapshotBeforeEdit` on, the receiver calls `history.snapshotNow` with `tool_input.file_path` and source `baseline` before answering. It answers when the snapshot returns or after 1 500 ms, whichever is first. A failure is logged and never changes the answer.

### Usage and statusline

- **LINK-40.** A statusline post updates the session's `model`, `contextUsedPercentage` and `costUsd` from `model.display_name`, `context_window.used_percentage` and `cost.total_cost_usd`.
- **LINK-41.** `rate_limits.five_hour` and `rate_limits.seven_day`, when present, replace the stored `UsageLimits` and set `updatedAt`. `resets_at` arrives in seconds and is stored in milliseconds. A window whose `resetsAt` has passed is set to null by a timer.
- **LINK-42.** The reply to a statusline post is one line of plain text: `HSOS · <model> · ctx <n>%`, and ` · 5h <n>%` when known. It is produced within 50 ms.
- **LINK-43.** Statusline posts do not create sessions and do not change activity.

### Cache state

- **LINK-50.** `lastResponseAt` is set by `Stop`, and by `SessionStart` with source `resume` using `seconds_since_last_response` when present. The cache state shown by the HUD is derived from it and `cacheWarmMinutes`; `claude-link` stores only the time.

### Session events

- **LINK-60.** Each hook that matters to the owner is also recorded as a `SessionEvent` and emitted:

| Hook | Kind | Label | Path |
|---|---|---|---|
| `UserPromptSubmit` | `prompt` | first 120 characters of the prompt | null |
| `PostToolUse` of `Write`, `Edit`, `MultiEdit`, `NotebookEdit` | `file-edit` | tool name | `tool_input.file_path` |
| `PostToolUse` of other tools | `tool` | tool name | null |
| `PostToolUseFailure` | `tool-failed` | tool name | null |
| `SubagentStart`, `SubagentStop` | `subagent-start`, `subagent-stop` | agent type | null |
| `Stop` | `stop` | `Turn finished` | null |
| change to `needs-you` | `attention` | the reason | null |

- **LINK-61.** The newest 2 000 events per session are kept in memory. They are not written to disk.

### Setup inventory

`getSetup` answers the Claude setup view (HUD-50 to HUD-55). It only reads (LINK-6).

- **LINK-70.** `getSetup({ projectPath })` reads these sources. `~` is `%USERPROFILE%`.

| Section | Source | Scope |
|---|---|---|
| MCP servers | `~\.claude.json` key `mcpServers` | `user` |
| MCP servers | `~\.claude.json` key `projects["<projectPath>"].mcpServers` | `local` |
| MCP servers | `<projectPath>\.mcp.json` key `mcpServers`; `enabled` is false when `projects["<projectPath>"].disabledMcpjsonServers` names it, true when `enabledMcpjsonServers` names it, else null | `project` |
| Plugins | `~\.claude\plugins\installed_plugins.json`, `plugins`: each key is an id, the first array entry gives `version`, `scope` and `installedAt`; `enabled` is the value of `enabledPlugins[id]` from the highest settings file that sets it (local, then project, then user), else false | as recorded |
| Subagents | `~\.claude\agents\*.md` and `<projectPath>\.claude\agents\*.md`; name from the frontmatter `name`, else the file name | `user`, `project` |
| Hooks | key `hooks` of the three settings files below; one row per event per file, counting its handlers | per file |
| Permissions | keys `permissions.allow`, `permissions.ask` and `permissions.deny` of the three settings files; one row per rule | per file |

  The settings files are `~\.claude\settings.json` (`user`), `<projectPath>\.claude\settings.json` (`project`) and `<projectPath>\.claude\settings.local.json` (`local`). A missing file is not an error. A file that is not valid JSON, or a key of the wrong shape, adds one entry to `errors` and its rows are left out; every other source is still read. `projectPath` is matched against the keys of `projects` with letter case ignored and `\` and `/` treated alike.
- **LINK-71.** Nothing secret leaves the service (P-8). For a stdio server, `target` is the file name of `command` only; for an http or sse server, the host of `url` only. Arguments, environment values, headers, URL paths, queries and user info are never read into the result. A server with neither `command` nor `url` has transport `unknown` and target `?`.
- **LINK-72.** HSOS counts uses it sees. A `PreToolUse` whose `tool_name` starts with `mcp__` records the server name, the text between `mcp__` and the next `__`, with the time. A `SubagentStart` records its `agent_type`. They are kept in memory and written to `linkUsageFile` as `{ "version": 1, "mcp": { "<name>": <ms> }, "agents": { "<name>": <ms> } }` atomically, at most once every 60 seconds and at stop. A file that cannot be read is replaced by an empty one and logged. These uses have `source: 'hsos'` and `count: null`.
- **LINK-73.** Claude Code's own counters are used when present: `skillUsage` and `pluginUsage` in `~\.claude.json`, each `{ "<name>": { "usageCount": <n>, "lastUsedAt": <ms> } }`. They are not documented, so an entry of any other shape is skipped without an error. They give `source: 'claude'`. Plugins and skills get a last use only from these counters; HSOS does not count them itself.
- **LINK-74.** `getSetup` reads every file fresh on each call and caches nothing. It answers within the 10 000 ms timeout; a source that is still being read at 8 000 ms is skipped with the error "Timed out".

## What HSOS cannot know

- Usage limits before any session has answered once. The HUD shows "No data yet".
- A subagent's model when it was not named at spawn. The HUD shows the agent type alone.
- Anything about a session started outside an HSOS terminal, unless the owner loads the `hsos-link` plugin there.

## Tests

`FakeClaude` posts fixture payloads to a real `link-service` on a free port.

| Rule | Level | Given | When | Then |
|---|---|---|---|---|
| LINK-1 | integration | the first port is taken | the service starts | it listens on the next port and `getStatus` reports it |
| LINK-2 | integration | a fake terminal channel | the service starts | `setExtraEnv` was called once with the five variables |
| LINK-4 | integration | the generated `shell-init.ps1` and a stub `claude.cmd` on PATH that prints its arguments | `powershell.exe -NoProfile -Command "<TERM-7 loader>; claude -p hi"` with `HSOS_SHELL_INIT` set to the file | output contains `--plugin-dir`, `--settings` and `-p hi` |
| LINK-6 | integration | a temp home folder with a `.claude\settings.json` | the service starts and stops | that file's bytes are unchanged |
| LINK-10 | integration | a request without the token | it is posted | status 401; no session exists |
| LINK-11 | integration | a `Stop` body that is not JSON | it is posted | status 200; no crash; one warning logged |
| LINK-12 | integration | any valid hook | it is posted | the reply has status 200, an empty body, and arrives within 50 ms |
| LINK-20 | integration | no sessions | a `PreToolUse` for an unknown session arrives with a terminal header | a session exists with that `terminalId` and activity `working` |
| LINK-21 | unit | a table of every row above | each event is applied to a session | the activity and fields match the row |
| LINK-22 | unit | a `needs-you` session | `PostToolUse` | activity is `working` and `attentionReason` is null |
| LINK-23 | unit | a session with one subagent | `PreToolUse` carrying that `agent_id` | the subagent's `currentTool` is set; the session's is not |
| LINK-24 | unit | a `done` session | `markSeen` | `idle` |
| LINK-25 | integration | a session bound to a terminal | `terminal.exited` for it | the session is `ended` |
| LINK-27 | integration | fake clock | 50 events in 100 ms for one session | `sessionChanged` fired at most twice |
| LINK-28 | unit | `PreToolUse` of `Agent` with model `haiku`, description `Find files`, type `Explore` | `SubagentStart` with type `Explore` | the subagent has model `haiku` and that description |
| LINK-28 | unit | no pending spawn | `SubagentStart` | model and description are null |
| LINK-30 | integration | a real file and a real history store | `PreToolUse` of `Edit` for that file | a `baseline` snapshot of the file exists before the reply is sent |
| LINK-30 | integration | a history store that never answers, fake clock | `PreToolUse` of `Write` | the reply is sent at 1 500 ms with status 200 |
| LINK-41 | unit | a statusline body with `resets_at: 1738425600` | it is applied | `resetsAt` is `1738425600000` |
| LINK-41 | unit | limits whose reset time passes, fake clock | the timer fires | that window is null |
| LINK-42 | integration | a statusline post | the reply is read | it is one line starting with `HSOS · ` |
| LINK-14 | unit | a prompt containing escape characters and 5 000 characters | it becomes a title | 80 characters, no control characters |
| REL-5 | fault | `FakeClaude` posting 20 hooks a second | `link-service` is killed | every post fails fast or succeeds; none takes longer than its timeout; sessions reappear within 5 s of restart as new events arrive |
| LINK-70 | integration | a temp home with `.claude.json` holding user server `a` and local server `b` for `C:\p`, and `C:\p\.mcp.json` holding `c`, listed in `disabledMcpjsonServers` | `getSetup({ projectPath: 'c:/P' })` | three servers with scopes `user`, `local`, `project`; `c` has `enabled: false` |
| LINK-70 | integration | `installed_plugins.json` with `x@m`; user settings `enabledPlugins { "x@m": true }`, local settings `{ "x@m": false }` | `getSetup` | plugin `x@m` with `enabled: false` |
| LINK-70 | integration | a project `settings.json` that is not valid JSON, and valid user settings with two allow rules | `getSetup` | one entry in `errors` naming the project file; two permission rows from the user file |
| LINK-71 | integration | a stdio server `{ command: 'C:\\tools\\node.exe', args: ['--token', 'abc'], env: { KEY: 'secret' } }` and an http server `{ url: 'https://u:p@api.example.com/v1?key=1' }` | `getSetup` | targets `node.exe` and `api.example.com`; the serialised result contains none of `abc`, `secret`, `u:p`, `v1`, `key=1` |
| LINK-72 | integration | fake clock; `PreToolUse` posts with `tool_name` `mcp__firecrawl__scrape` and `Bash`, and a `SubagentStart` with `agent_type` `Explore` | 60 s pass | `linkUsageFile` has `mcp.firecrawl` and `agents.Explore` and nothing for `Bash` |
| LINK-73 | integration | `.claude.json` with `skillUsage { caveman: { usageCount: 2, lastUsedAt: 1 }, bad: 3 }` | `getSetup` | `skillUse.caveman` is `{ at: 1, count: 2, source: 'claude' }`; there is no `bad` entry and no error |
| LINK-74 | integration | fake clock; a file reader whose read of `.mcp.json` never finishes | `getSetup` | it answers after 8 000 ms with an error "Timed out" for `.mcp.json` and the other sections filled |
| LINK-6 | integration | all `getSetup` tests | they finish | every file under the temp home and project has its original bytes and time |
