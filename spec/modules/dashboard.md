# Module: dashboard

## Purpose

The home page of HSOS: screens of widgets the owner arranges, resizes and swipes between, like a phone home screen (Samsung One UI). Each widget is a live view of one part of the app, and opening it moves seamlessly to that part (MOT-6).

## Interface

`contracts/channels/dashboard.ts`. Draws the `dashboard` page (WS-40).

- Runs in: `ui` (the page and the grid), `main` (the file, through `register.service.ts`).
- Extension point `dashboardWidgets`: other modules contribute widget types. The dashboard knows nothing about what a widget shows.
- Uses: `workspace` (pages), `ui-kit` (`Surface`, motion helpers).
- Third-party packages allowed: `zod`, `write-file-atomic` (main).

## Screens and grid

- **DASH-1.** The page shows one screen at a time, of 1 to 8 screens, with a row of dots under the grid for the screens (the current one filled). The owner changes screen by a horizontal swipe on the touchpad or a drag on empty grid space, by `Ctrl+PageDown` and `Ctrl+PageUp` while the page has focus, or by pressing a dot. The screens slide over `motion.page` with `motion.ease.spring`, following the finger during a swipe and settling when it lifts.
- **DASH-2.** Each screen is a grid of `columns` by `rows` cells (settings; default 8 by 6). The grid fills the page with a 12 px gap; cells stretch with the window, and widgets keep their cells, so a resize never rearranges anything.
- **DASH-3.** A widget instance has a `type`, a `screen`, a cell position `x`, `y` and a size `w`, `h` in cells, and its own `config`. Instances never overlap and never leave the grid. Each type declares its smallest and largest size.
- **DASH-4.** Widgets are `Surface role="widget"` (UI-31) with `radius.panel`. Each is its own error boundary and draws the four states of P-40 inside its frame.

## Edit mode

- **DASH-5.** Edit mode starts by holding the pointer still (within 6 px) on a widget or an empty cell for 500 ms, by "Edit dashboard" in the right-click menu of empty space, or by the command `dashboard.edit`. It ends with "Done", Escape, or a click on empty space outside the grid. In edit mode the screen scales to 0.94 over `motion.slow`, the cells show as faint dots, each widget shows a frame with corner and edge handles and a remove button, and a toolbar shows "Add widget", "Screens" and "Done". Widgets gently sway (a 1.5° rotation loop, out of phase) until the owner touches one; MOT-12 turns this off.
- **DASH-6.** Moving: a widget dragged in edit mode follows the pointer, lifted (scale 1.04, `shadow.overlay`). An outline snaps to the nearest cell position: in `color.accent` where the widget fits, in `color.state.danger` where it would overlap or leave the grid. Dropping on a fitting place springs the widget into it over `motion.slow` with `motion.ease.spring`; elsewhere it springs back. Held at the left or right edge for 600 ms, the drag moves to the screen beside it, adding a screen after the last when there are fewer than 8.
- **DASH-7.** Resizing: dragging a handle grows or shrinks the widget by whole cells, between its type's smallest and largest size and up to the next widget or the grid edge. During the drag the frame shows the new size as an outline and the content scales with `transform`; on release the widget lays out for its new size (MOT-1).
- **DASH-8.** "Add widget" opens a sheet listing every contributed type, grouped by the module that gives it, each with a live preview at its default size. Dragging a preview onto the grid places it where dropped (DASH-6 rules). Pressing it places it at the first free position of the current screen that fits its default size, scanning rows top to bottom; with none, a toast says "No room on this screen. Make space or add a screen."
- **DASH-9.** The remove button, or Delete on a focused widget, removes it with a fade and shrink over `motion.normal`; a toast with "Undo" stays 5 seconds.
- **DASH-10.** "Screens" shows the screens side by side, small: drag to reorder, "Add screen" (up to 8), and a remove button on each screen. Removing a screen that holds widgets asks first: "Remove this screen and its <n> widgets?"
- **DASH-11.** Keyboard (P-41): in edit mode, Tab moves between widgets, the arrow keys move the focused one by a cell, Shift with the arrows resizes it, Delete removes it, Enter or Escape ends edit mode. Out of edit mode, the arrow keys move focus between widgets and Enter activates one.

## Widgets in use

- **DASH-12.** A widget is told its size in cells and its pixel size, and lays out for them; each type in the catalog below says what it shows at which sizes. Live values roll (MOT-8). Widgets enter with the stagger of MOT-3 each time the page is shown; hovering lifts a widget's surface tone and scales it to 1.02 over `motion.instant`; pressing follows MOT-2.
- **DASH-13.** Activating a widget (click or Enter, out of edit mode) does what its catalog row says, and when that opens another page it is a shared-element transition (MOT-6, WS-42).

## Catalog

Each module in the first column contributes its widgets to `dashboardWidgets`. Sizes are in cells, width by height.

| Module | Type | Smallest, largest, default | Shows | Activating it |
|---|---|---|---|---|
| `hud` | `hud.ribbon` | 2×1, 8×3, 4×2 | The session ribbon (HUD-80) of the target session, or of the session chosen in its config. At 2×1: mascot, title and model only. | Goes to that session's terminal on the Code page |
| `hud` | `hud.sessions` | 2×2, 8×6, 4×3 | The attention board (HUD-1 to HUD-5); at 2×2 only the sessions that need the owner | A row: its terminal |
| `hud` | `hud.usage` | 1×1, 4×3, 2×2 | At 1×1 the higher of the two percentages; larger, both bars with reset times | Opens the Usage popover of HUD-61 |
| `hud` | `hud.context` | 1×1, 4×3, 2×2 | The target session's context: percentage, then tokens of the window, then the cache state as space allows | Opens the Context popover of HUD-61 |
| `hud` | `hud.quickBar` | 2×1, 8×2, 8×1 | The quick bar (HUD-60 to HUD-68), as many buttons as fit, the rest under "More" | Each button as in the HUD |
| `hud` | `hud.skills` | 2×2, 6×6, 4×4 | Favourite skills; from 3 rows high, the search field and the full deck (HUD-30 to HUD-37) | A skill: as HUD-31 |
| `hud` | `hud.mascot` | 1×1, 4×4, 2×2 | The mascot (HUD-90) of the target session, large, with its state word under it from 2×2 | Goes to the target session's terminal |
| `sessions` | `sessions.recent` | 2×2, 8×6, 4×3 | The newest sessions of every project (SESS-30 with `projectPath: null`), title, project and time | A row: its first SESS-32 action; "All" opens Session History |
| `git` | `git.status` | 2×1, 4×3, 2×2 | Branch, ahead and behind, number of changes; from 2×2 the repo link (GIT-14) and "Sync" | Opens the Changes view on the Code page |
| `activity` | `activity.recent` | 2×2, 8×6, 4×2 | The newest activity events | An event: as in the Activity view |
| `graph` | `graph.mini` | 2×2, 8×6, 2×3 | The local graph (GRAPH-30) around the last opened note, animated | Goes to the Notes page; the mini graph becomes the full graph (MOT-6) |

## The file

- **DASH-20.** The layout lives in `dashboardFile` (`%APPDATA%\HSOS\dashboard.json`) as `DashboardFile`. It is one dashboard for the whole app, not per project; widgets that show project data use the open project.
- **DASH-21.** It is saved 500 ms after the last change, atomically, keeping the previous file as `.bak` (P-3). Loading validates it: an instance that fails its schema, overlaps another or leaves the grid is dropped and logged; an instance whose type is not contributed is kept in the file and not drawn. A missing or invalid file with no valid `.bak` gives the default layout.
- **DASH-22.** The default layout, on an 8 by 6 grid:
  - screen 1: `hud.ribbon` at 0,0 size 4×2; `hud.usage` at 4,0 size 2×2; `hud.mascot` at 6,0 size 2×2; `hud.sessions` at 0,2 size 4×3; `hud.context` at 4,2 size 2×3; `graph.mini` at 6,2 size 2×3; `hud.quickBar` at 0,5 size 8×1;
  - screen 2: `hud.skills` at 0,0 size 4×4; `sessions.recent` at 4,0 size 4×4; `git.status` at 0,4 size 4×2; `activity.recent` at 4,4 size 4×2.
- **DASH-23.** Changing `columns` or `rows` to a smaller grid moves each widget that no longer fits to the first free place that fits it, on its screen or a new one; nothing is dropped.

## Settings section

| Key | Type | Default |
|---|---|---|
| `columns` | number 4 to 12 | `8` |
| `rows` | number 3 to 10 | `6` |

## Commands

| Id | Title | Default key |
|---|---|---|
| `dashboard.edit` | Edit Dashboard | none |
| `dashboard.addWidget` | Add Widget | none |
| `dashboard.nextScreen`, `previousScreen` | Next Screen, Previous Screen | `Ctrl+PageDown`, `Ctrl+PageUp` on the dashboard |

## States

| Part | Loading | Empty | Error |
|---|---|---|---|
| Page | the grid with skeleton widgets | a screen with no widgets: "This screen is empty." and "Add widget" | "The dashboard could not be loaded." with "Reset to default" |
| Widget | its own (DASH-4) | its own | its own, inside its frame |

## Tests

| Rule | Level | Given | When | Then |
|---|---|---|---|---|
| DASH-1 | component | 3 screens, the first shown | `Ctrl+PageDown` twice, then once more | screen 3 shows and the third dot is filled; the last press does nothing |
| DASH-2 | component | an 8×6 grid in a 1600×900 page, then 1200×700 | it renders | every widget keeps its `x`, `y`, `w`, `h` |
| DASH-3 | unit | the placement check | two instances sharing a cell; one at `x: 7, w: 2` on 8 columns | both refused |
| DASH-4 | component | a widget type whose component throws, beside a healthy widget | the screen renders | the broken one shows its error state in its frame; the other renders |
| DASH-5 | component | fake clock | the pointer is held on an empty cell for 499 ms, then for 500 ms | edit mode starts only the second time |
| DASH-5 | component | `data-motion="reduced"` | edit mode starts | no widget sways |
| DASH-6 | component | edit mode, a 2×2 widget, a free 2×2 area and an occupied one | it is dragged over each | the outline is accent over the free area and danger over the occupied one; dropping on the occupied one leaves it where it was |
| DASH-6 | component | fake clock, a drag held at the right edge of the last of 2 screens | 600 ms pass | a third screen exists and shows |
| DASH-7 | component | a `hud.usage` widget (largest 4×3) at 0,0 with a widget at 3,0 | its right handle is dragged 4 cells | its width stops at 3 |
| DASH-8 | component | a full screen | "Add widget" then a type | the "No room" toast shows and nothing was added |
| DASH-9 | component | a widget removed | "Undo" within 5 s | it is back in the same place |
| DASH-10 | component | a screen with 2 widgets | its remove button | the confirmation names 2 widgets |
| DASH-11 | component | edit mode, a focused 2×2 widget at 0,0 | Right, then Shift+Down | it is at 1,0 and 2×3 |
| DASH-12 | component | a `hud.usage` widget | it is resized from 1×1 to 2×2 | it shows one number, then both bars |
| DASH-13 | e2e | a `hud.ribbon` widget for a session in terminal `t1` | it is activated | the Code page shows with `t1` focused, through one view transition |
| DASH-20 | integration | the service | `save` then `load` | the same `DashboardFile` |
| DASH-21 | unit | a file with an overlapping instance and one of an unknown type | it loads | the overlapping one is dropped; the unknown one is kept in the data and not drawn |
| DASH-22 | unit | no file | it loads | the default layout, which has no overlaps |
| DASH-23 | unit | the default layout | `columns` becomes 6 | every widget is placed, none overlaps, and the count is unchanged |
