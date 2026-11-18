# Module: workspace

## Purpose

Turns a folder into a place to work: opens projects, arranges panels in the window, and puts everything back exactly as it was when the owner returns.

## Interface

`contracts/channels/workspace.ts`, the panel types in `contracts/module.ts`, and `design/layout.md`.

- Runs in: `main` (projects, workspace files), `ui` (the app frame and dock).
- Third-party packages allowed: `dockview`, `zustand`, `zod`, `write-file-atomic`.

## Parts

| Part | Where | Does |
|---|---|---|
| Project store | `main` | Current project, recent list, workspace file load and save |
| App frame | `ui` | Title bar, activity rail, side panel, right panel, status bar |
| Dock | `ui` | Dock panels with split, tab and drag, on `dockview` |
| Panel registry | `ui` | Panel definitions registered by modules |
| Welcome view | `ui` | Shown when no project is open |

## Behaviour

### Projects

- **WS-1.** One project is open at a time. `openProject` checks that the path is an existing folder, computes `ProjectId` (architecture §5), records it in the recent list and emits `projectChanged`.
- **WS-2.** The recent list keeps the 20 most recently opened projects in `appStateFile`, newest first. A project whose folder is gone stays listed with `exists: false`.
- **WS-3.** At start the last open project is opened again. If its folder is gone, the welcome view shows.
- **WS-4.** Opening another project first saves the current workspace, then closes every panel, then loads the new project's workspace.
- **WS-5.** The welcome view lists recent projects and has one primary button, "Open folder", which uses `shell.pickFolder`. Enter on a recent row opens it. A row with `exists: false` is muted and offers "Remove from list".
- **WS-6.** The title bar shows the project name. Selecting it opens a menu: recent projects, "Open folder", "Close project".

### Panels

- **WS-10.** A panel exists only if its `type` is registered. Opening an unknown type logs a warning and does nothing.
- **WS-11.** `openPanel(type, state)` for a dock panel:
  - `allowMultiple: false` and one exists: focus it. If `state` was given, replace its state.
  - otherwise: create it as a new tab in the focused group, or in a new group when the dock is empty, and focus it.
- **WS-12.** `openPanel` for a side view makes it the active view of the area it is assigned to (left by default) and expands that area.
- **WS-13.** Each panel is wrapped in an error boundary. A panel that throws while rendering shows the error state inside its own frame with "Reload panel". Other panels are unaffected (P-12).
- **WS-14.** A panel's `setState` updates the saved state in memory and schedules a workspace save.
- **WS-15.** A side view can be moved between the left and right areas from its title menu. The assignment is saved per project.

### Save and restore

- **WS-20.** The workspace is saved 1 000 ms after the last change to layout, panel state, area sizes or focus, and again when the project closes and when the app stops.
- **WS-21.** Saving writes `workspaceFile(projectId)` atomically, keeping the previous file as `.bak` (P-3).
- **WS-22.** Loading validates the file with `WorkspaceFile`. Each panel's `state` is then validated with that panel type's `stateSchema`.
  - A panel whose type is not registered is dropped from the layout.
  - A panel whose state fails validation is opened with its `initialState`.
  - A file that fails `WorkspaceFile` is ignored; if `.bak` is valid it is used; otherwise the default layout is used. The bad file is renamed `<name>.invalid-<time>`.
- **WS-23.** A project with no saved workspace opens with the default layout from `design/layout.md`.
- **WS-24.** After restore, focus goes to `focusedPanel` if it still exists, else to the first terminal, else to the first panel.
- **WS-25.** Restoring never blocks on a panel. Each panel mounts in its loading state and fills in on its own.

### Frame

- **WS-30.** The activity rail shows one icon per registered side view, in registration order, and the settings icon at the bottom. Selecting the icon of the active view collapses its area. Selecting another switches to it.
- **WS-31.** The side and right areas resize by dragging their inner edge, within the limits in `SideAreaState`. Double-clicking the edge resets to the default width.
- **WS-32.** The status bar renders items registered with `registerStatusItem`, grouped by `side`, sorted by `order`.
- **WS-33.** Window width below 1100 collapses the right area; below 800 the left area too. Widening again restores the areas that were open before the automatic collapse, and only those.
- **WS-34.** Dock key bindings and drag behaviour follow `design/layout.md`.
- **WS-35.** On `focusPanelRequested`, the panel is brought to the front of its group and focused.
- **WS-36.** `requestOpenPanel` is re-emitted by `main` as `openPanelRequested`. The UI handles it as `openPanel`, except that with `focus: false` the panel is added behind the active tab of the focused group and focus does not move.
- **WS-37.** `listOpenPanels` is answered by `main` from the last list the UI reported. The UI reports the list 300 ms after any dock change. `target` is the panel's file path or URL when it has one.

### Pages

The window shows one of three pages at a time. The title bar, the status bar and the background (UI-30) stay; everything between them belongs to the page.

| Page | Holds | Default layout |
|---|---|---|
| `dashboard` | The widget screens of the `dashboard` module (DASH-1) | its own |
| `code` | The activity rail, side and right areas and the dock described above | `design/layout.md` |
| `notes` | A second dock, for the notes of the vault and the project: the full graph and markdown viewers | the full graph on the left two thirds, the viewer of the selected note on the right |

- **WS-40.** The title bar has a page switcher with three segments, "Dashboard", "Code" and "Notes", and a marker under the active one. `Ctrl+1`, `Ctrl+2` and `Ctrl+3` (global) switch to them; `Ctrl+Alt+Left` and `Ctrl+Alt+Right` (global) go to the page beside the current one.
- **WS-41.** Every page stays mounted once shown. Switching pages hides the others (`content-visibility: hidden`, `inert`), so terminals, viewers and the graph keep their state and a terminal keeps receiving output. A hidden page's panels are told through `usePageVisible()` and pause their own drawing.
- **WS-42.** A switch runs the page transition of MOT-5 and MOT-6. When the switch comes from a shared element (a session widget, the notes widget), that element is the one that moves.
- **WS-43.** The `notes` page's dock behaves like the `code` dock (WS-10 to WS-14, WS-34) and is saved in the same workspace file as `notesDock`. Opening a markdown file from the graph, a backlink or a wiki link while on the `notes` page opens it in this dock.
- **WS-44.** The active page is saved as `activePage` and restored at start. A project opened for the first time starts on `code`. With no project open, the `dashboard` page shows, with the welcome view (WS-5) as its first screen's empty state.
- **WS-45.** Focus moves with the page: after a switch, focus goes to the panel that last had it on that page, else the first terminal on `code`, the graph on `notes`, and the first widget on `dashboard`. A switch never happens on its own while the owner types (P-44).

## Commands

| Id | Title | Default key |
|---|---|---|
| `workspace.openFolder` | Open Folder | `Ctrl+K Ctrl+O` |
| `workspace.closeProject` | Close Project | none |
| `workspace.toggleLeft` | Toggle Side Panel | `Ctrl+B` |
| `workspace.toggleRight` | Toggle Right Panel | `Ctrl+Alt+B` |
| `workspace.splitRight` | Split Right | `Ctrl+\` |
| `workspace.splitDown` | Split Down | `Ctrl+Shift+\` |
| `workspace.closePanel` | Close Panel | `Ctrl+W` |
| `workspace.nextTab` | Next Tab | `Ctrl+Tab` (global) |
| `workspace.focusLeft`, `focusRight`, `focusUp`, `focusDown` | Focus Group Left, Right, Up, Down | `Alt+Left`, `Alt+Right`, `Alt+Up`, `Alt+Down` (global) |
| `workspace.toggleMaximize` | Maximize Panel | `Ctrl+Shift+Enter` |
| `workspace.resetLayout` | Reset Layout | none |
| `workspace.pageDashboard`, `pageCode`, `pageNotes` | Go to Dashboard, Code, Notes | `Ctrl+1`, `Ctrl+2`, `Ctrl+3` (global) |
| `workspace.pagePrevious`, `pageNext` | Previous Page, Next Page | `Ctrl+Alt+Left`, `Ctrl+Alt+Right` (global) |

## States

| Area | Loading | Empty | Error |
|---|---|---|---|
| Whole frame | Title bar and empty areas in `color.bg.app` until the project loads | Welcome view | "HSOS could not open this project" with the reason and "Choose another folder" |
| Dock | panels in their own loading states | "No panels open" with "New terminal" and "Open file" | per panel (WS-13) |

## Tests

| Rule | Level | Given | When | Then |
|---|---|---|---|---|
| WS-1 | integration | a temp folder | `openProject` | returns its `ProjectInfo`; the recent list starts with it |
| WS-1 | integration | a path to a file | `openProject` | `WS_PROJECT_MISSING` |
| WS-2 | integration | 25 projects opened in turn | the recent list is read | it has 20 entries, newest first |
| WS-2 | integration | a recent project whose folder was removed | the list is read | that entry has `exists: false` |
| WS-11 | component | a registered panel with `allowMultiple: false`, one open | `openPanel` again with new state | one panel exists, focused, with the new state |
| WS-13 | component | a panel component that throws | it mounts beside a healthy panel | the error state shows in its frame; the healthy panel still renders |
| WS-20 | component | fake clock | three layout changes within 500 ms | exactly one save happens, 1 000 ms after the last |
| WS-22 | unit | a workspace with a panel of an unregistered type | it loads | that panel is absent; the others are present |
| WS-22 | unit | a panel whose saved state fails its schema | it loads | it opens with `initialState` |
| WS-22 | integration | an invalid workspace file and a valid `.bak` | it loads | the `.bak` layout is used and an `.invalid-*` file exists |
| WS-23 | e2e | a project never opened before | it opens | Files is in the side panel, one terminal in the dock, HUD on the right |
| WS-24 | component | the saved focused panel no longer exists | restore finishes | the first terminal has focus |
| WS-33 | component | both areas open | the window narrows to 780 then widens to 1300 | both collapse, then both reopen |
| WS-40 | component | the `code` page | `Ctrl+3` while a terminal is focused | the `notes` page shows and the switcher marker is under "Notes" |
| WS-41 | e2e | a terminal printing a line every 100 ms | the owner goes to the Dashboard for 3 s and back | no output was lost and the terminal element is the same node |
| WS-42 | e2e | a session widget | it is activated | the `code` page shows with that terminal focused, through one view transition |
| WS-43 | component | the `notes` page | a note is opened from the graph | it opens in the `notes` dock, not the `code` dock |
| WS-44 | e2e | the `notes` page active | the app is closed and reopened | the `notes` page shows |
| WS-45 | component | a terminal had focus on `code` | Dashboard, then Code | that terminal has focus again |
| WS-4, WS-20 | e2e | a project with two splits and three tabs | the app is closed and reopened | the same splits and tabs appear with the same panel focused |
