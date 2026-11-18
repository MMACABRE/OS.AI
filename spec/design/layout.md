# Window layout

## Anatomy

```
┌──────────────────────────────────────────────────────────────────────────┐
│ title bar  [project ▾] [branch ⇅]            [palette hint]      [─ □ ✕] │ 36
├────┬──────────────┬──────────────────────────────────┬───────────────────┤
│ r  │ side panel   │ dock                             │ right panel       │
│ a  │              │  ┌ tabs ───────────────────────┐ │                   │
│ i  │ (one of:     │  │ terminal │ file │ browser   │ │ (HUD by default)  │
│ l  │  Files       │  ├─────────────────────────────┤ │                   │
│    │  Changes     │  │                             │ │                   │
│ 44 │  Graph       │  │   panels: split and tabbed  │ │                   │
│    │  Activity    │  │   freely by drag and drop   │ │                   │
│    │  Artifacts)  │  │                             │ │                   │
│    │              │  └─────────────────────────────┘ │                   │
├────┴──────────────┴──────────────────────────────────┴───────────────────┤
│ status bar  [branch ↑1 ↓0] [3 changes]      [5h 42%] [7d 18%] [2 need you]│ 24
└──────────────────────────────────────────────────────────────────────────┘
```

## Pages

The title bar holds a page switcher: Dashboard, Code, Notes (WS-40). The drawing above is the Code page. The Dashboard fills the space between the title bar and the status bar with widget screens (DASH-1); the Notes page fills it with its own dock. The background runs behind all three and is seen through glass surfaces (UI-30, UI-31). Page changes move as `motion.md` says.

```
┌ [project ▾]  ( Dashboard | Code | Notes )                 [─ □ ✕] ┐
│                                                                   │
│   ┌──────────┐ ┌─────────────────────┐ ┌──────────┐               │
│   │ session  │ │ usage        context│ │  mascot  │   widgets on  │
│   │ ribbon   │ │ ███████░░░   41%    │ │   ▟▙     │   a grid,     │
│   └──────────┘ └─────────────────────┘ └──────────┘   resizable   │
│   ┌─────────────────────┐ ┌──────────┐                            │
│   │ sessions board      │ │ notes    │                 • ○ ○      │
│   └─────────────────────┘ └──────────┘           screen dots      │
├ status bar ───────────────────────────────────────────────────────┤
```

## Areas

| Area | Holds | Size | Rules |
|---|---|---|---|
| Title bar | Project switcher, branch and sync button, window controls | 36 high | The window is frameless. The bar is a drag region except over its controls. |
| Activity rail | One icon per side view, settings at the bottom | 44 wide | Selecting the active icon collapses the side panel. A dot on an icon signals new content. |
| Side panel | One side view at a time | 280 wide by default, 200 to 480, resizable | Collapsible to 0. Width is saved per project. |
| Dock | Dock panels | Fills the rest | Panels split, tab, move and float by drag and drop. |
| Right panel | The HUD, or any side view the owner moves there | 300 wide by default, 240 to 480 | Collapsible. |
| Status bar | Status items registered by modules | 24 high | Left group is about the project, right group about Claude. Each item is a button. |

## Panel kinds

| Kind | Lives in | Examples | How many |
|---|---|---|---|
| Side view | Side panel or right panel | Files, Changes, Graph, Activity, Artifacts, HUD | One instance each |
| Dock panel | Dock | Terminal, File viewer, Browser, Diff, Graph (full), Settings | Any number |

A module registers each of its panels with a kind, a title, an icon and a factory (`contracts/module.ts`).

## Default layout for a new project

- Side panel: Files.
- Dock: one terminal, started in the project folder.
- Right panel: HUD.

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

- Below 1100 wide the right panel collapses to its icon in the rail.
- Below 800 wide the side panel also collapses.
- The dock never shrinks below 480 wide. The minimum window size is 640 by 400.

## Key bindings, defaults

All are settings in `keybindings.json`.

| Key | Command |
|---|---|
| `Ctrl+Shift+P` | Command palette |
| `Ctrl+P` | Go to file |
| `` Ctrl+` `` | Focus or create a terminal |
| `Ctrl+Shift+T` | New terminal |
| `Ctrl+B` | Toggle side panel |
| `Ctrl+Alt+B` | Toggle right panel |
| `Ctrl+Shift+E` | Files |
| `Ctrl+Shift+G` | Changes |
| `Ctrl+Shift+H` | HUD |
| `Ctrl+,` | Settings |
| `Ctrl+S` | Save file |
| `Ctrl+K Ctrl+T` | Pick theme |
| `Ctrl+1`, `Ctrl+2`, `Ctrl+3` | Dashboard, Code, Notes page |
| `Ctrl+Alt+Left`, `Ctrl+Alt+Right` | Previous, next page |

Keys pressed inside a focused terminal go to the shell, except the bindings whose command is marked `global: true`. By default only `Ctrl+Shift+P`, `` Ctrl+` ``, `Ctrl+Tab`, `Alt+Arrow`, the page keys and `Ctrl+Alt+Arrow` are global.
