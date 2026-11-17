# Claude Code data sources for the agent HUD

Ticket: "Claude Code data sources for the agent HUD". Researched 2026-11-17 in the main session.

Marks: **[V]** checked against the named source today. **[U]** from the researcher's own knowledge, not re-checked.

## Summary

1. The existing `agent-hud` mod runs inside Claude Code's own terminal UI. It draws a pane with the mod API (`$.ui.mount`, `$.state`, `$.store`, `$.command.list`, `$.agent.list`). That API does not exist outside Claude Code, so HSOS cannot reuse the code. It can copy the behaviour. [V]
2. The mod shows three things: the main session and running subagents with model and status, two usage bars (5-hour and 7-day) with reset times, and a skill finder with favourites. It also has a row that compares local skills with the SKILLS repo and can sync them. [V]
3. From outside, usage limits come from the statusline input. Claude Code passes `rate_limits.five_hour` and `rate_limits.seven_day`, each with `used_percentage` and `resets_at`, to the statusline command on stdin. [V]
4. Those fields exist only for Pro, Max and Ultra subscribers, and only after the first API response in a session. [V]
5. Session and subagent activity comes from hooks. There are 33 hook events, including `SessionStart`, `SessionEnd`, `SubagentStart`, `SubagentStop`, `Stop`, `PreToolUse` and `PostToolUse`. A hook can be an HTTP POST, so HSOS can receive events directly. [V]
6. Past sessions live as transcript files under `~/.claude/projects/`. opcode reads them. The format is not a documented API. [V for opcode reading them, U for stability]
7. Skills are folders with a `SKILL.md` file under `~/.claude/skills/`, in plugins, and in the project's `.claude/skills/`. [U]

## Part A. The existing mod

Source: `MMACABRE/SKILLS`, folder `mods/agent-hud`. [V]

- **Files.** `hooks/register.js` wires events to state. `hooks/view.js` draws rows. `hooks/repo-sync.js` checks and syncs the skills repo. `types/index.d.ts` declares the state.
- **State kept.** `skillQuery`, `favourites`, `mainStatus` (`idle` or `running`), `agentModels` (model per subagent id, newest 64), and `repoSync` (status, changed, added and removed skill folders, commits ahead and behind, offline flag, last sync sha, last check time).
- **Persistence.** Favourites are mirrored to a store so they survive restarts. Everything else lasts one session.
- **Rate limits.** Read from the mod API as entries with `kind` `five_hour` or `seven_day` and an optional `resetsAt`. Empty until the first API response.
- **Skills.** Command list entries whose source is `user` or `plugin`. Built-in and MCP commands are left out. Clicking a skill pastes `/name ` into the prompt.
- **Drawing rule.** One row is one line, never wider than the pane, never more rows than fit. Outside text is stripped of control characters before drawing.
- **Lessons recorded by the owner.** One broken section must never blank the whole HUD. On this machine `bash` resolves to WSL, not Git Bash.

## Part B. Sources outside Claude Code

### Statusline input [V]

Claude Code runs a configured command and passes JSON on stdin. Fields include:

- `session_id`, `transcript_path`
- `model.display_name`
- `workspace.git_worktree`, `worktree.name`, `worktree.path`, `worktree.branch`
- `cost.total_cost_usd`
- `context_window.used_percentage`, `context_window.remaining_percentage`
- `rate_limits.five_hour.used_percentage`, `rate_limits.five_hour.resets_at`
- `rate_limits.seven_day.used_percentage`, `rate_limits.seven_day.resets_at`
- `rate_limits.spend_limit.*` behind a gateway
- `agent` when the session runs as a named agent

`resets_at` is Unix epoch seconds. Each window can be absent.

### Hooks [V]

- Events: SessionStart, Setup, UserPromptSubmit, UserPromptExpansion, PreToolUse, PermissionRequest, PermissionDenied, PostToolUse, PostToolUseFailure, PostToolBatch, Notification, MessageDisplay, SubagentStart, SubagentStop, TaskCreated, TaskCompleted, Stop, StopFailure, TeammateIdle, InstructionsLoaded, ConfigChange, CwdChanged, DirectoryAdded, FileChanged, WorktreeCreate, WorktreeRemove, PreCompact, PostCompact, PreModelSwitch, PostModelSwitch, Elicitation, ElicitationResult, SessionEnd.
- Common input fields: `session_id`, `prompt_id`, `transcript_path`, `cwd`, `scratchpad_dir`, `permission_mode`, `effort`, `hook_event_name`, and `agent_id`, `agent_type` when they apply.
- `SessionStart` adds `source` and sometimes `model`. `Stop` and `SubagentStop` add `last_assistant_message`. Tool events add `tool_name`, `tool_input`, `tool_use_id`.
- Handler types: `command`, `http`, `prompt`, `agent`, `mcp_tool`.

Only the first third of the hooks page was read. The full field list for each event still needs reading.

## What the HUD shows and where it comes from

| HUD item | Best source | Freshness | Stability |
|---|---|---|---|
| 5-hour and 7-day usage, reset times | Statusline input, forwarded to HSOS by a small script | Each statusline refresh | Documented |
| Context used per session | Statusline input | Each refresh | Documented |
| Session cost | Statusline input | Each refresh | Documented, estimate only |
| Sessions running on this device | `SessionStart` and `SessionEnd` hooks, plus HSOS's own knowledge of its terminals | Immediate | Documented |
| Session busy or idle | `UserPromptSubmit` and `Stop` hooks | Immediate | Documented |
| Subagents running, with type | `SubagentStart` and `SubagentStop` hooks | Immediate | Documented |
| Subagent model | Not confirmed in the fields read | unknown | Needs the rest of the hooks page |
| Current tool per agent | `PreToolUse` and `PostToolUse` hooks | Immediate | Documented |
| Past sessions | Transcript files under `~/.claude/projects/` | On file change | Undocumented format |
| Skills list | Skill folders and their `SKILL.md` frontmatter | On file change | Documented layout [U] |
| Skills repo sync state | `git` commands on the local clone, as the mod does | On demand | Stable |

## Design consequence

HSOS installs two small things into Claude Code's settings for sessions it starts: a statusline command that forwards its stdin JSON to HSOS and then runs the owner's existing statusline, and HTTP hooks that post events to HSOS on localhost. Both are documented extension points, so the HUD does not depend on private file formats.

## Not settled

- The full per-event field lists (two thirds of the hooks page unread).
- Whether a subagent's model is visible to hooks.
- Whether usage limits can be read with no session running. The statusline source needs a live session.
- The transcript file format.

## Sources

- https://code.claude.com/docs/en/statusline
- https://code.claude.com/docs/en/hooks
- https://github.com/MMACABRE/SKILLS/tree/main/mods/agent-hud (`CLAUDE.md`, `note.md`, `types/index.d.ts`, `hooks/hooks.json`)
- https://github.com/getAsterisk/opcode
