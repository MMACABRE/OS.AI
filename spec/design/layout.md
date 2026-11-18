# Window layout

## Anatomy

The Code page, as approved in the design round (`design-round/code/phosphor-code.html?layout=c`). Parts in parentheses float over the background without a box (`visual-direction.md`, Open air).

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ HSOS 14:07 ( Dashboard | Code | Notes ) [project ▾] [owner/repo main ↑1] [palette] [─ □ ✕] │ 56
├───────────────┬──────────────────────────────────────────┬───────────────────┤
│ [tabs ... ⚙]  │ ┌ ribbon: mascot · chat · model · repo ┐ │ (mascot  word)    │
│ (Files tree)  │ │ terminal 1 (focused, yellow brackets) │ │ (quick bar)       │
│               │ └────────────────────────────────────────┘ │ (usage)           │
│               │ ┌ ribbon ────────────────────────────────┐ │ (sessions)        │
│               │ │ terminal 2 (needs you, red brackets)   │ │ ┌ skills deck ──┐ │
│               │ └────────────────────────────────────────┘ │ └───────────────┘ │
│               │                                            │ (skills repo)     │
├───────────────┴──────────────────────────────────────────┴───────────────────┤
│ status bar  [branch ↑1 ↓0] [3 changes]          [5h 42%] [7d 18%] [2 need you] │ 26
└──────────────────────────────────────────────────────────────────────────────┘
```

## Title bar

Left to right, 56 px high (`size.titlebar`):

| Part | Content | Pressing it |
|---|---|---|
| Wordmark | `HSOS` in `font.display`, `color.brand`. It breathes (scale 1 to 1.035 and a glow toward `color.memory`, a 7 s loop), and a light band sweeps across it (`clip-path`) on hover, on press and every 6 to 15 s | nothing; it is part of the drag region |
| Clock | local time `HH:MM` in `color.live` with a blinking colon; seconds and a brighter glow on hover | nothing |
| Page switcher | Dashboard, Code, Notes (WS-40) | switches page |
| Project switcher | the project name | the project menu |
| Repo | `owner/repo` from `webUrl` (GIT-14), the branch and ahead/behind; hidden when the project has no remote | opens `webUrl` with `shell.openExternal` |
| Palette hint | `Ctrl+Shift+P` | opens the command palette |
| Window controls | minimise, maximise, close | |

The repo button replaces the earlier branch and sync button; sync stays in the status bar and the Changes view. Under reduced motion the wordmark and the clock do not move or blink (MOT-12).

## Pages

The page switcher in the title bar shows one of three pages (WS-40). The drawing above is the Code page. The Dashboard fills the space between the title bar and the status bar with widget screens (DASH-1). The background runs behind all three and is seen through glass surfaces (UI-30, UI-31). Page changes move as `motion.md` says.

The Notes page, as approved (`design-round/notes/phosphor-notes.html?layout=c`):

```
┌ HSOS 14:07 ( Dashboard | Code | Notes ) [project ▾] [owner/repo]     [─ □ ✕] ┐
│ (search)       │                                │ ┌ hud.md ───────────────┐ │
│ (notes list)   │      (graph, CLAUDE.md pinned   │ │ the note in the notes │ │
│ spec           │       in the centre, nodes      │ │ dock: see-through,    │ │
│ modules   12   │       breathe steam)            │ │ corner brackets,      │ │
│ CLAUDE.md  9   │                                │ │ backlinks at the foot │ │
│                │      [graph toolbar]            │ └───────────────────────┘ │
├ status bar ──────────────────────────────────────────────────────────────────┤
```

The notes list is the side view `graph.notes` (GRAPH-55), floating on the left. The graph view fills the space between the list and the notes dock, so it never runs behind the note. The notes dock (WS-43) is on the right.

## Areas

| Area | Holds | Size | Rules |
|---|---|---|---|
| Title bar | The parts above | 56 high | The window is frameless. The bar is a drag region except over its controls. |
| Side view tabs | One button per side view, settings last | 30 by 30 buttons in a row at the top of the side area | They replace the activity rail. Pressing the active view's button collapses the side area to its tab row. A dot on a button signals new content. |
| Side area | One side view at a time | 214 wide by default, 200 to 480, resizable | Collapsible to its tab row. Width is saved per project. Lists in it float without a box. |
| Dock | Dock panels | Fills the rest | Panels split, tab, move and float by drag and drop. |
| Right area | The HUD, or any side view the owner moves there | 318 wide by default, 240 to 480 | Collapsible. HUD parts float without a box, except the Skills deck, which holds an input. |
| Status bar | Status items registered by modules | 26 high | Left group is about the project, right group about Claude. Each item is a button. |

## Panel kinds

| Kind | Lives in | Examples | How many |
|---|---|---|---|
| Side view | Side area or right area | Files, Changes, Graph, Activity, Artifacts, HUD | One instance each |
| Dock panel | Dock | Terminal, File viewer, Browser, Diff, Graph (full), Settings | Any number |

A module registers each of its panels with a kind, a title, an icon and a factory (`contracts/module.ts`).

## Default layout for a new project

- Side area: Files.
- Dock: one terminal, started in the project folder. A second terminal goes below it (layout C stacks terminals full width).
- Right area: HUD.

## Dock behaviour

- Dragging a tab onto another panel's edge splits it. Dragging onto its centre adds a tab.
- A dragged tab shows a drop preview in `color.accent` at 20 percent opacity.
- Closing the last panel in a group removes the group. The dock may be empty; it then shows the empty state with "New terminal" and "Open file".
- `Ctrl+\` splits the focused panel to the right. `Ctrl+Shift+\` splits down.
- `Ctrl+Tab` cycles tabs in the focused group. `Alt+Arrow` moves focus between groups.
- `Ctrl+W` closes the focused panel. A terminal with a running Claude session asks before closing.
- `Ctrl+Shift+Enter` toggles the focused panel to fill the dock.

## Command palette

- Opens with `Ctrl+Shift+P`, 560 wide, 20 percent from the top, on `color.bg.overlay` with `shadow.overlay`.
- `Ctrl+P` opens it in file mode: fuzzy search of project files.
- Lists every command registered by every module, with its key binding.
- Arrow keys move, Enter runs, Escape closes and returns focus to where it was.

## Narrow windows

- Below 1100 wide the right area collapses to a button at the end of the side view tabs.
- Below 800 wide the side area also collapses to its tab row.
- The dock never shrinks below 480 wide. The minimum window size is 640 by 400.

## Key bindings, defaults

All are settings in `keybindings.json`.

| Key | Command |
|---|---|
| `Ctrl+Shift+P` | Command palette |
| `Ctrl+P` | Go to file |
| `` Ctrl+` `` | Focus or create a terminal |
| `Ctrl+Shift+T` | New terminal |
| `Ctrl+B` | Toggle side area |
| `Ctrl+Alt+B` | Toggle right area |
| `Ctrl+Shift+E` | Files |
| `Ctrl+Shift+G` | Changes |
| `Ctrl+Shift+H` | HUD |
| `Ctrl+,` | Settings |
| `Ctrl+S` | Save file |
| `Ctrl+K Ctrl+T` | Pick theme |
| `Ctrl+1`, `Ctrl+2`, `Ctrl+3` | Dashboard, Code, Notes page |
| `Ctrl+Alt+Left`, `Ctrl+Alt+Right` | Previous, next page |

Keys pressed inside a focused terminal go to the shell, except the bindings whose command is marked `global: true`. By default only `Ctrl+Shift+P`, `` Ctrl+` ``, `Ctrl+Tab`, `Alt+Arrow`, the page keys and `Ctrl+Alt+Arrow` are global.
