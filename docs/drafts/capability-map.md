# Capability map (draft)

Status: draft by the spec author, 2026-11-17. Not yet confirmed by the owner. Ticket: "Module map and build order".

## Processes

| Process | Runs | May crash without data loss |
|---|---|---|
| main | Supervisor, windows, app lifecycle | no, kept minimal for that reason |
| pty-host | Every shell | yes, shells restart; scrollback restored as history |
| workspace-service | File watching, indexing, local history, git | yes |
| ui | The whole interface | yes, reattaches to running shells |
| browser views | One per browser pane | yes |

## Modules

| Module id | Responsibility | Depends on |
|---|---|---|
| `contracts` | Shared TypeScript types and message shapes between all modules | none |
| `diagnostics` | Logging, crash reports, health checks | `contracts` |
| `shell` | Main process, process supervisor, message bus, window, app start and stop | `contracts`, `diagnostics` |
| `settings` | Settings files, schema checks, theme tokens, keybindings, live reload | `shell` |
| `ui-kit` | Design system: tokens, components, motion, command palette | `settings` |
| `workspace` | Projects, pane layout, drag and drop, per-project save and restore | `shell`, `settings`, `ui-kit` |
| `terminal` | PTY host, terminal panes, tabs and splits, reattach, scrollback restore | `workspace` |
| `files` | File tree, watcher, viewer and light editor, atomic save, change detection | `workspace` |
| `history` | Local history snapshots, timeline, diff and restore | `files` |
| `claude-link` | Hook receiver, statusline forwarder, registry of Claude sessions and subagents | `shell`, `terminal` |
| `skills` | Index of installed skills, favourites, launch into a terminal, skills-repo sync state | `claude-link`, `git` |
| `hud` | The HUD panel: sessions, subagents, usage bars, context, cost, skills | `claude-link`, `skills`, `ui-kit` |
| `git` | GitHub login, status, fetch, pull, commit, push, conflict view | `files` |
| `browser` | Browser panes, tabs, isolated profile, control over the DevTools Protocol | `workspace` |
| `graph` | Markdown index, link resolution, graph view, backlinks | `files`, `ui-kit` |
| `mcp` | The MCP server Claude connects to: tools for browser, files, graph and layout | `browser`, `files`, `graph`, `workspace`, `claude-link` |

Rules:
- Dependencies point one way. Two modules that need each other become one module.
- A module talks to another only through `contracts`.

## Build order

| Stage | Modules | The app can now |
|---|---|---|
| 0. Skeleton | `contracts`, `diagnostics`, `shell`, `settings`, `ui-kit` | Open an empty themed window, build, test and package to an exe |
| 1. Terminal | `workspace`, `terminal` | Run Claude Code in tabs and splits; shells survive a UI reload |
| 2. Files | `files`, `history` | Browse, view, edit and save safely; undo any change |
| 3. Claude awareness | `claude-link`, `git`, `skills`, `hud` | Show limits, sessions, subagents and skills; sync with GitHub |
| 4. Browser | `browser`, `mcp` | Show a browser pane that Claude drives |
| 5. Graph | `graph`, graph tools in `mcp` | Show the link graph of notes, skills and memory files |
| 6. Finish | Theme editor, workspace polish, soak and fault tests | Meet the reliability bar |

Each stage ends with a working, packaged app. Stage 1 alone is already usable as a daily terminal.
