# How comparable tools were built

Ticket: "How comparable tools were built". Researched 2026-11-17 in the main session.

Marks: **[V]** means checked against the named source today. **[U]** means from the researcher's own knowledge and not re-checked.

## Summary

1. No existing tool combines all seven HSOS parts. Each covers two or three.
2. Wave Terminal is the closest in shape: terminal, editor, web browser and AI blocks in one window. It is Electron with a Go backend. It knows nothing about Claude Code sessions, usage limits or skills. [V]
3. opcode is the closest in Claude Code awareness: sessions, agents, usage dashboard, checkpoints. It is Tauri 2 with React. It has no real terminal, and its last release is from August 2025. [V]
4. The web stack dominates this category. Wave, Tabby, Crystal, VS Code and Hyper all use Electron with xterm.js. opcode and GitButler use Tauri. [V]
5. The native Rust tools (Warp, Zed) each wrote their own UI framework. That is years of work by funded teams. [V]
6. The official Claude Code desktop app already runs parallel sessions in git worktrees on Windows. HSOS should not compete on that feature alone. [secondary sources only]
7. The gap HSOS can own: a terminal that understands Claude Code, an app that Claude can drive through MCP, and a knowledge graph that includes the project's notes, skills and memory.

## Facts per tool

Repository data read from the GitHub API on 2026-11-17. [V]

| Tool | Stack | Stars | Latest release | Licence | Notes |
|---|---|---|---|---|---|
| Wave Terminal | Electron, Go backend, TypeScript UI | 22.7K | v0.14.5, 2026-04-16 | Apache-2.0 | Drag and drop blocks: terminal, editor, browser, AI. `wsh` CLI controls the workspace from the shell. Windows 10 1809+. |
| Tabby | Electron, TypeScript | 75.5K | v1.0.238, 2026-10-07 | MIT | Plugin-based terminal. Uses xterm.js. |
| Warp | Rust, own `warpui` crates | 66.0K | 2026-06-03 stable | AGPL-3.0, UI crates MIT | Client is now open source. Depends on Alacritty code, Tokio, NuShell. Repo keeps `specs/`, `agents/specs/` and `AGENTS.md`. |
| Zed | Rust, own `gpui` framework | 95.2K | v1.28.1, 2026-11-11 | mixed | Ships a Windows installer (Inno Setup). |
| opcode (was Claudia) | Tauri 2, React 18, TypeScript, Vite 6, Tailwind 4, shadcn/ui, SQLite | 22.5K | v0.2.0, 2025-08-31 | AGPL-3.0 | Reads `~/.claude/projects/`. Usage dashboard, custom agents, MCP manager, checkpoints with fork and diff. No prebuilt Windows exe. |
| Crystal | Electron, TypeScript | 3.1K | v0.3.5, 2026-02-26 | MIT | Parallel Claude Code sessions in worktrees [U]. Quiet since February 2026. |
| claudecodeui | Web app, TypeScript | 14.6K | v1.37.9, 2026-11-16 | AGPL-3.0 | Browser UI for Claude Code. Very active. |
| GitButler | Tauri, Rust, Svelte | 22.0K | 0.23.4, 2026-11-11 | source-available | Proof that Tauri carries a serious git client. |
| VS Code | Electron, TypeScript | n/a | n/a | MIT | Integrated terminal is xterm.js with node-pty. Listed as a principal xterm.js user. |

Other wrappers surfaced by search and not checked: Code Bar (Tauri, PTY per session), Claudette, Canopy, ittop, Claude Squad (Go TUI over tmux, awkward on Windows). [U]

## What each does well

- **Wave.** The block layout. Any pane can be a terminal, file preview, editor or web page, and the layout is drag and drop. Its AI can read terminal scrollback and edit files with backups and approval. [V]
- **Warp.** Command blocks and a polished input editor. Agent management. [U]
- **Zed.** Speed and visual quality from GPU rendering. [U]
- **opcode.** Session history, usage and cost charts, checkpoints with a timeline and diff. [V]
- **VS Code.** Reliability pattern: terminals run in a separate PTY host process, so a window reload does not kill shells. [U]

## Known weak points

- Wave's public releases slowed in 2026 (last release April). [V]
- opcode and Crystal are stale. Wrappers that parse Claude Code's private files break when the format changes. [V for staleness, U for cause]
- Electron apps use more memory than native ones. [U]
- None of the wrappers show the 5-hour and 7-day limits live inside a real terminal workflow. The owner's `agent-hud` mod does, but only inside Claude Code's own TUI. [V, from the mod's notes]

## What would put HSOS one step above

1. **Claude-aware terminal.** HSOS installs its own hooks and statusline forwarder, so every Claude Code session started in an HSOS terminal reports its state. The HUD then shows limits, sessions and subagents for all panes at once.
2. **HSOS is an MCP server.** Claude can drive the app: open a file in the viewer, navigate the browser pane, focus a graph node, read the layout. No comparable tool exposes its whole UI this way.
3. **Sessions survive the UI.** Shells live in a supervisor process. A UI crash or reload reattaches to running shells with scrollback intact.
4. **Local history for everything Claude changes.** Every file write inside a project is snapshotted, with a timeline and one-click restore, independent of git.
5. **A graph of the whole working memory.** Notes, `CLAUDE.md` files, skills and memory files appear in one link graph next to the vault.
6. **Live theming.** Every colour, radius, font and motion value is a token the owner can change while the app runs.
7. **Per-project workspaces.** Layout, open panes, browser tabs and terminal working folders restore when a project opens.

## Sources

- GitHub REST API, repos listed above, read 2026-11-17
- https://github.com/wavetermdev/waveterm
- https://github.com/getAsterisk/opcode
- https://github.com/warpdotdev/Warp
- https://github.com/xtermjs/xterm.js
- https://github.com/microsoft/node-pty
- https://github.com/MMACABRE/SKILLS/tree/main/mods/agent-hud
