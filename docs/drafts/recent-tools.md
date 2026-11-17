# Recent tools that changed agentic coding

Researched 2026-11-17 in the main session, at the owner's request. Question: which tools from the last few months changed the workflow, and which ideas fit HSOS.

Marks: **[V]** read today in Claude Code's official weekly digest. **[S]** from secondary sources (blogs, roundups), not confirmed.

## What changed

| Shift | Evidence |
|---|---|
| One screen for all sessions, sorted by who needs attention | `claude agents` agent view shows what is running, blocked on you, and done. Rows carry a state word and a headline. [V] |
| Many sessions in parallel, each in its own git worktree | `--worktree`, worktree settings, background sessions, `/fork` into a background session. [V] Third-party managers do the same (Superset, Crystal, Claude Squad). [S] |
| Review became the bottleneck | `/diff` opens a live panel that refreshes as Claude edits. `/code-review` runs in the background. [V] Roundups name review of parallel agents as the limiting step. [S] |
| Knowing what happened while away | Session recap shows what happened while a terminal was unfocused. Push notifications when a task ends or needs you. [V] |
| Rewind | `/rewind` restores earlier states and can summarise earlier context. [V] |
| Cost made visible | `/usage` breaks down limits by skill, subagent, plugin and MCP server. `/skill-doctor` shows each skill's context cost and use count. [V] |
| The app shows what Claude builds | In-app browser, simulator pane, artifacts, `/design` artboards in Claude Code Desktop. [V] |
| Giving feedback outside the chat | Review apps with pinned comments copied back to Claude, from the owner's reference video. [S] |
| Limits handled for you | Auto-continue when the limit resets, in Claude Code Desktop. [V] |
| Kanban boards of agent sessions | Vibe Kanban, amux and others. [S] |

## Added to HSOS

Chosen because each one builds on parts already planned.

| # | Addition | Module | Builds on |
|---|---|---|---|
| 1 | **Attention board.** The HUD groups sessions as "needs you", "working", "done", with the reason. Selecting one focuses its terminal. | `hud` | Hook events already received |
| 2 | **Notifications.** A Windows notification when a session needs the owner or finishes while HSOS is not focused. | `hud` | Hook events |
| 3 | **Session recap.** A terminal that was out of view shows a short summary on return: prompts answered, files changed, tools used, last message. | `hud` | Hook events, activity timeline |
| 4 | **Worktree sessions.** "New Claude session in a worktree" creates the worktree and opens a terminal in it. Terminals are grouped by worktree. | `terminal`, `git` | Real `git.exe` |
| 5 | **Changes panel.** A live diff of what changed since the last commit, or since a session began, refreshing as Claude edits. | `review` (new) | `git`, `history` |
| 6 | **Feedback tray.** The owner pins comments on a diff line, a file line, an artifact or a captured page element. The tray sends them to a chosen terminal as one prompt. | `review` (new) | Changes panel, element capture, artifacts inbox |

## Considered and left out

| Idea | Why not |
|---|---|
| Kanban of sessions | The attention board covers the need with less to build. |
| Cross-session messaging | Claude Code's own feature, and the digest lists it for macOS and Linux only. |
| Voice dictation | Claude Code and the owner's own tools already provide it. |
| Auto-continue after a limit | It would run unattended work that spends the owner's usage. The HUD shows the reset time instead. |
| Usage by skill | `/usage` and `/skill-doctor` already give it inside Claude Code. |
| Rewind | Claude Code's own feature. HSOS's local history covers files. |

## Sources

- https://code.claude.com/docs/en/whats-new
- Secondary: https://nimbalyst-website.pages.dev/blog/best-tools-for-agentic-coding/
- Secondary: https://openalternative.co/blog/best-ai-coding-agent-orchestrators
- Secondary: https://leaddev.com/technical-direction/the-rise-of-coding-with-parallel-agents
- Secondary: https://docs.kanaries.net/topics/AICoding/parallel-code-agents
