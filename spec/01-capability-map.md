# Capability map

## Modules

Module ids are fixed. They name folders, test files, rule prefixes and task cards.

| Module id | Rule prefix | Responsibility | Depends on |
|---|---|---|---|
| `contracts` | none | Shared TypeScript types, message schemas, result and error types | none |
| `diagnostics` | `DIAG` | Logging, crash reports, health checks | `contracts` |
| `shell` | `SHELL` | Main process, supervisor, message bus, window, module registry, app start and stop | `contracts`, `diagnostics` |
| `settings` | `SET` | Settings and theme files, schema checks, key bindings, live reload | `shell` |
| `ui-kit` | `UI` | Tokens to CSS variables, components, motion, command palette, panel frame | `settings` |
| `workspace` | `WS` | Projects, dock layout, panel tabs, per-project save and restore | `shell`, `settings`, `ui-kit` |
| `terminal` | `TERM` | PTY host, terminal panels, splits, reattach, scrollback restore, grouping by worktree | `workspace` |
| `files` | `FILE` | File tree, watcher, viewer, light editor, atomic save, change detection | `workspace` |
| `history` | `HIST` | Local history snapshots, per-file timeline, diff, restore | `files` |
| `claude-link` | `LINK` | Hook receiver, statusline forwarder, registry of Claude sessions and subagents, snapshot before Claude edits a file | `shell`, `terminal`, `history` |
| `git` | `GIT` | GitHub sign-in, status, fetch, pull, commit, push, worktrees, opt-in automatic sync | `files`, `claude-link` |
| `skills` | `SKILL` | Skill index, favourites, skill on/off state, skills folder, background runs, skills-repo sync | `files`, `git` |
| `hud` | `HUD` | HUD panel: quick bar of Claude commands, attention board of sessions, subagents, usage bars, context, cost, cache state, skills, notifications, session recap | `claude-link`, `skills`, `terminal`, `ui-kit` |
| `activity` | `ACT` | Activity timeline across files, artifacts inbox | `history`, `claude-link` |
| `review` | `REV` | Changes panel with live diff; feedback tray that sends pinned comments to a terminal | `git`, `history`, `terminal` |
| `browser` | `BROW` | Browser panels, tabs, isolated profile, DevTools Protocol control, element capture | `workspace`, `review` |
| `graph` | `GRAPH` | Markdown index, link resolution, graph view, backlinks | `files`, `ui-kit` |
| `cli` | `CLI` | The `hsos` command Claude runs: browser, file, graph and review commands | `browser`, `files`, `graph`, `workspace`, `review`, `claude-link` |
| `sessions` | `SESS` | Claude session records, transcript backup, auto-resume after a crash or restart, session picker, transcript reader, session history of every project with rename, notes and delete | `claude-link`, `terminal`, `workspace` |

Rules:

- Dependencies point one way. A cycle means two modules are one module.
- "Depends on" means "may import that module's contract". It never means importing its code.

## Process kinds

| Process | Electron kind | Hosts the service side of | Restart policy |
|---|---|---|---|
| `main` | main process | `shell`, `settings`, `diagnostics` | none; it is the supervisor |
| `pty-host` | utility process | `terminal` | restart at once; shells are lost and reported |
| `workspace-service` | utility process | `files`, `history`, `git`, `review`, `graph` index, `activity`, `skills` index | restart at once |
| `link-service` | utility process | `claude-link`, `sessions`, `cli` | restart at once |
| `ui` | renderer | the panel side of every module | reload on crash |
| browser views | `WebContentsView`, one per browser tab | page content | reload that tab |

`pty-host` is alone in its process so that nothing else can crash the shells.

## Build stages

Each stage ends with an app that starts, passes all tests and packages to an `.exe`.

| Stage | Modules | The app can now |
|---|---|---|
| 0. Skeleton | `contracts`, `diagnostics`, `shell`, `settings`, `ui-kit` | Open a themed empty window with a command palette and settings screen. Survive a renderer crash. |
| 1. Terminal | `workspace`, `terminal` | Open a project, run PowerShell and Claude Code in tabs and splits. Shells survive a UI reload. Layout restores. |
| 2. Files | `files`, `history` | Browse, view, edit, save safely. Restore any earlier version. |
| 3. Claude awareness | `claude-link`, `sessions`, `git`, `skills`, `hud`, `activity`, `review` | Never lose a Claude session: resume it after a crash or restart, find and read any past one. Show limits, sessions that need the owner, subagents, skills, what Claude changed and produced. Review changes and send feedback. Sync with GitHub. Start sessions in worktrees. |
| 4. Browser | `browser`, `cli` | Show a browser panel that Claude drives through the `hsos` command. |
| 5. Graph | `graph`, graph commands in `cli` | Show the link graph of notes, skills and memory files. |
| 6. Finish | theme editor, fault tests, soak tests, installer | Meet the reliability bar in `05-testing.md`. |
| 7. Awareness extras | spoken alerts in `hud` and `shell`, Claude setup view in `hud` and `claude-link`, agent view in `graph` | Say when a session finishes or needs the owner. Show the Claude Code setup with last use. Show what Claude loads at start and what links reach. |
| 8. Claude controls | session history in `sessions`, skill state and skills folder in `skills` and `shell`, quick bar in `hud` and `terminal` | Rename, note and delete past sessions of every project. Turn skills on and off and open the skills folder. Change model, effort and mode, compact and clear, and open Claude's own screens, from buttons. |

## Later, not in this spec

- Home dashboard with pinned local web apps.
- Cost by skill and connector. Stage 7 shows when each was last used, not what it cost.
- 3D graph view.

## Left out

Calendar, email, scheduled routines view, notes backlog, recommendations app, prompt cache keep-warm pings, a plugin marketplace, a debugger, language servers.
