# Module: graph

## Purpose

Shows how the owner's notes, Claude's instructions, skills and memory connect, so the owner can see their working knowledge as one map and jump to any part of it. It reads files and never writes them.

## Interface

`contracts/channels/graph.ts`. Reference code: `reference/markdown-links.ts`.

- Runs in: `workspace-service` (index), `ui` (graph view, backlinks).
- Third-party packages allowed: `better-sqlite3` (service), `graphology`, `graphology-layout-forceatlas2`, `graphology-communities-louvain`, `sigma` (panel), `zod`.

## Roots indexed

| Root | Folder | Notes |
|---|---|---|
| `project` | the open project | all `.md` files |
| `vault` | the `vaultPath` setting, when set | all `.md` files |
| `claude` | `%USERPROFILE%\.claude`, when `includeClaudeFolder` | only `CLAUDE.md`, `skills\**\SKILL.md`, `projects\*\memory\*.md`, `agents\*.md`; skill folders reached through junctions are followed |

Folders named in `exclude` are skipped in every root.

## Index

`noteIndexFile(projectId)`, SQLite:

| Table | Columns |
|---|---|
| `notes` | `path` primary key, `root`, `kind`, `label`, `title`, `mtime`, `hash`, `tags` (JSON), `aliases` (JSON), `headings` (JSON) |
| `links` | `from_path`, `kind`, `target_text`, `heading`, `block_id`, `alias`, `line`, `context`, `resolved_path` (null when unresolved) |

Indexes on `links(from_path)` and `links(resolved_path)`.

## Behaviour

### Indexing

- **GRAPH-1.** At project open the index is opened (created when absent) and brought up to date: files whose `mtime` and size match the stored row are skipped; others are read, hashed, and parsed with `parseNote` when the hash differs.
- **GRAPH-2.** Kind: a file named `CLAUDE.md` or `AGENTS.md` (any letter case) is `claudeMd`; `SKILL.md` is `skill`; a file under a folder named `memory` is `memory`; any other `.md` is `note`.
- **GRAPH-3.** Label: the parsed title, else the file name without `.md`. For `SKILL.md`, the frontmatter `name`, else the folder name. For `CLAUDE.md`, `CLAUDE.md · <parent folder name>`.
- **GRAPH-4.** Files larger than `maxFileBytes` are indexed by name only, with no links.
- **GRAPH-5.** Indexing runs on a queue, 50 files per batch, yielding between batches, and reports progress through `statusChanged` at most 4 times a second (P-13).
- **GRAPH-6.** `files.changed` batches update only the affected files, 500 ms after the batch. `files.rescanNeeded` triggers GRAPH-1 again.
- **GRAPH-7.** A database that fails to open or is corrupt is renamed `<name>.invalid-<time>` and rebuilt from the files. The index is HSOS's own derived data.
- **GRAPH-8.** The graph never writes to any file in any root (P-4).

### Link resolution

Link text is resolved from the note that holds it, in this order. The first rule that finds an existing file wins.

- **GRAPH-10.** Empty target (`[[#Heading]]`): the note itself.
- **GRAPH-11.** A target with a `/`: a path from the root of the note's own root folder, then a path relative to the note's folder. `.md` is added when the target has no extension.
- **GRAPH-12.** A bare name: every file in the same root whose name without extension equals the target, ignoring letter case. With one match, that file. With several, the one whose folder shares the longest leading path with the note's folder; on a tie, the shortest path; on a further tie, the first in alphabetical order.
- **GRAPH-13.** Still unresolved: notes whose `aliases` include the target, ignoring case, using the same tie rules.
- **GRAPH-14.** Markdown links (`[text](path)`) are resolved as paths relative to the note's folder, then from the root.
- **GRAPH-15.** Links never resolve across roots, except that any root may resolve a target in `claude` by GRAPH-12 when nothing matches in its own root. This lets a project note link to a skill by name.
- **GRAPH-16.** Unresolved links keep `resolved_path` null and appear as `unresolved` nodes only when `showUnresolved` is on.
- **GRAPH-17.** When a file is added, renamed or removed, links whose resolution could change (same bare name, or alias) are resolved again.

### Graph view

Dock panel `graph.view`, single instance, and a compact local graph in the side view `graph.local`.

- **GRAPH-20.** The view loads `getGraph` into a graphology graph and draws it with sigma. Layout runs ForceAtlas2 in a web worker, for at most 4 seconds or until it settles, and restarts briefly when nodes are added. Node positions are saved in the panel state and reused, so the map keeps its shape between visits.
- **GRAPH-21.** Node size grows with `degree`: radius 3 + 1.5 × √degree, capped at 14 px. Colour by kind from the `color.graph.node.*` tokens. A toggle "Colour by community" uses Louvain communities instead, coloured from a fixed list of 8 hues derived from the state tokens.
- **GRAPH-22.** Labels show for the 30 largest nodes at the current zoom, for the hovered node and its neighbours, and for search matches. Label text uses `font.ui` at `font.size.small` in `color.text.secondary`.
- **GRAPH-23.** Hovering a node fades all nodes and edges that are not it or its neighbours to 15 percent opacity.
- **GRAPH-24.** Clicking a node selects it and shows a details card in the panel corner: label, kind, path, tags, backlinks count, and the actions "Open", "Open to the Side", "Send Path to Terminal", "Show Local Graph".
- **GRAPH-25.** Double-click opens the note in a file viewer.
- **GRAPH-26.** A toolbar: search field (`graph.search`, matches highlighted and the camera fits them), filters (kinds, roots, tags, orphans, unresolved), "Changed in last 24 hours" which keeps only nodes with `modifiedAt` in that window and their links, "Colour by community", and "Fit".
- **GRAPH-27.** `graphChanged` updates the drawn graph in place: changed nodes and edges are replaced, removed ones dropped, positions of others kept.
- **GRAPH-28.** Keyboard: arrow keys move selection to the nearest neighbour in that direction; Enter opens; `/` focuses search; `0` fits the view.
- **GRAPH-29.** With more than 5 000 nodes, labels show only on hover and search, and edges are drawn at 50 percent opacity. More than 50 000 nodes shows the view with a notice "Large graph: filters are on" and only the `project` root until the owner changes the filter.

### Local graph and backlinks

- **GRAPH-30.** The side view `graph.local` follows the file open in the focused viewer. It shows that note and its neighbours to `localDepth`, laid out the same way, and below it a list of backlinks: the linking note's label and the line context. Activating a backlink opens that note at that line.
- **GRAPH-31.** For a file that is not a note, the side view shows "Open a markdown note to see its links."
- **GRAPH-32.** In the markdown preview, wiki links are resolved with `graph.resolve` (FILE-79). Unresolved ones show in `color.text.muted` with a dotted underline.

## Commands

| Id | Title | Default key |
|---|---|---|
| `graph.open` | Open Graph | `Ctrl+Shift+M` |
| `graph.showLocal` | Show Local Graph | none |
| `graph.reindex` | Rebuild Note Index | none |

## States

| Panel | Loading | Empty | Error |
|---|---|---|---|
| Graph view | "Indexing notes… 1 240 of 3 000" with a progress bar; nodes appear as batches finish | "No markdown notes found. Notes in this project and your vault appear here." with "Choose vault folder" | "The note index could not be read." with "Rebuild" |
| Local graph | skeleton | GRAPH-31 | same as the graph view |

## Tests

| Rule | Level | Given | When | Then |
|---|---|---|---|---|
| reference | unit | covered by the reference self-check | | |
| GRAPH-1 | integration | an indexed folder | one file changes and the index is opened again | only that file is parsed again |
| GRAPH-2 | unit | paths `a\CLAUDE.md`, `s\x\SKILL.md`, `p\memory\m.md`, `n.md` | kind is computed | `claudeMd`, `skill`, `memory`, `note` |
| GRAPH-5 | integration | 3 000 generated notes | indexing runs | no bus request to the service waits more than 100 ms |
| GRAPH-7 | integration | a corrupt index file | the project opens | an `.invalid-*` file exists and the index holds every note |
| GRAPH-8 | integration | all graph tests | they finish | every file in the roots has its original bytes and time |
| GRAPH-11 | integration | `docs/Spec.md`; a note `a/b.md` linking `[[docs/Spec]]` | resolve | `docs/Spec.md` |
| GRAPH-12 | integration | `x/Plan.md` and `y/z/Plan.md`; a note in `y/z/w/` linking `[[Plan]]` | resolve | `y/z/Plan.md` |
| GRAPH-12 | integration | `Plan.md` and `plan.md` in different folders at equal distance | resolve | the shorter path, then alphabetical |
| GRAPH-13 | integration | a note with `aliases: [Roadmap]`; a link `[[roadmap]]` with no file of that name | resolve | that note |
| GRAPH-15 | integration | a project note linking `[[caveman]]`; a skill folder `caveman` in the Claude root | resolve | the skill's `SKILL.md` |
| GRAPH-17 | integration | a link `[[New]]` unresolved | `New.md` is created | the link resolves within 1 000 ms and `graphChanged` names both nodes |
| GRAPH-20 | component | a graph with saved positions | the panel mounts | nodes take the saved positions before layout runs |
| GRAPH-23 | component | a node with two neighbours | it is hovered | non-neighbour nodes have reduced opacity |
| GRAPH-26 | component | nodes changed 2 hours and 3 days ago | "Changed in last 24 hours" | only the first is drawn |
| GRAPH-29 | component | 6 000 nodes | the view renders | only hovered and matched labels show |
| GRAPH-30 | component | a viewer on `a.md`, linked from `b.md` line 4 | the local view renders | it lists `b` with that line's text |
| perf | e2e | a vault of 5 000 generated notes | the graph is open and idle | frame rate measured over 3 s is at least 55 |
