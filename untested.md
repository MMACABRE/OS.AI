# Untested work

The owner's rule from 2026-11-18 (resuming the run at card 011): implementers write the code only. They do not write or run the card's tests. Each card's test plan goes here, for a testing agent the owner runs later over all the work. Features whose tests are listed here stay `passes: false` in `features.json` until that agent's tests pass.

Each entry names the test file the card asks for, the rule ids, and what each test must show. Test names start with the rule id (protocol rule). Rows come from the module spec's test table.

## Open bugs found by the tester lanes (2026-11-20)

The tests for these are in `lane-notes/test-lane-c-bugs.md` (full code, src location, failure message). Fix src, then add the test back.

1. UI-MENU-1: `Menu` cannot open from an `IconButton` trigger; `IconButton` drops the props Radix passes. Breaks HUD-1 "Show all projects", HUD-34 skill row menu, HUD-37 locked-skill reason.
2. HUD-65: compact dialog `initialFocus` returns the wrapping span, so Cancel does not get focus.
3. FILE-61 / FILE-43: `FilesTree` never listens to `files.rescanNeeded`, so nothing reloads.
4. HIST-41: `diffRows('', 'a')` returns a phantom removed empty line.
5. REV-21: F7 stops on both rows of one replaced line. Spec unclear whether a "change" is a hunk or a row; owner to decide.
6. WS-44: with no project open the page store starts on `code`, so the welcome view is not shown at start.

Not yet covered in lane C's area: HUD-37 "For this project only" with a chosen state; the HUD-16 "Spoken alerts on/off" toast. The `#` test plans below were not assigned this round.

## 011 Supervisor (e2e left)

Unit tests done (`tests/shell/supervisor.test.ts`). Left:

`tests/e2e/supervisor.e2e.ts`:

| Rule     | Given              | When                                                                                            | Then                                                                                                                                                                          |
| -------- | ------------------ | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SHELL-10 | the app is running | `workspace-service` is killed (find its pid, kill it)                                           | a crash file appears and the service reaches `ready` again within 5 s. The crash file needs card 013 (DIAG-7); until then, check the restart and the `service_death` log line |
| SHELL-14 | the app is running | the renderer is killed (`webContents.forcefullyCrashRenderer()` through `electronApp.evaluate`) | the window reloads and the `?e2e=1` ping view shows all three services again                                                                                                  |

## 013 Crash reports and health (e2e left)

Unit tests done (`tests/diagnostics/crash-reports.test.ts`). Left: DIAG-8, a service that throws an uncaught exception exits with 70 (needs the app, e2e).

## 015 Window (e2e left)

Unit tests done (`tests/shell/bounds.test.ts`, `tests/shell/system-channels.test.ts`). Left: `tests/e2e/window.e2e.ts`: SHELL-1 (a second launch exits and the first window gets focus; one window exists), SHELL-24 (`window.location.href = 'https://x.test'` and `window.open(...)` from the page leave the URL unchanged and open no window). F-005 also needs: move the window, restart, it reopens in the same place.

## 018 Themes (e2e left)

Unit tests done (`tests/settings/theme-store.test.ts`, `tests/settings/apply-theme.ui.test.tsx`). Left: F-007 (e2e, card 025 covers it): copy `test-light.json` into `themesDir`, set `theme`, `--color-bg-app` changes without a reload.

## 023 Command palette (e2e left)

Unit tests done. Left: F-008 (e2e, card 025 covers it): press Ctrl+Shift+P, type "set", "Open Settings" runs from the list. Note: "set" is a subsequence of "Open Settings" only; the old row's "Restart service" example was wrong.

## 024 Settings screen (open question, e2e left)

Unit tests done (`tests/settings/settings-screen.ui.test.tsx`). Open: SET-6, a typed number above max (400 into terminal font size, max 32) is clamped and saved by `NumberField`, but the spec says invalid input shows the schema message and saves nothing. Owner to decide clamp or reject; the failing test is in `lane-notes/test-lane-b-bugs.md`. Left: F-009 (e2e, card 025 covers it): press Ctrl+, , change a value, invalid input shows a message and is not saved.

## 025 Stage 0 checks (e2e left)

Unit test done (`tests/stage0/packaging.test.ts`). Left:

`tests/e2e/stage-0.e2e.ts` (Playwright with Electron, a temp `APPDATA` and `LOCALAPPDATA` so the owner's real settings are never touched):

1. REL-7 and P-32: write `{ not json` to `%APPDATA%\HSOS\settings\settings.json` before launch; the window opens; `Ctrl+,` opens the settings screen and its problems banner lists the file.
2. F-008: `Ctrl+Shift+P` opens the palette; type `set`; "Open Settings" is in the list and Enter opens the settings screen.
3. F-007: copy `tests/fixtures/themes/test-light.json` into `%APPDATA%\HSOS\themes`, set `theme` to `test-light` (through the settings screen's Themes "Use", or by writing settings.json), and `getComputedStyle(document.documentElement).getPropertyValue('--color-bg-app')` becomes `#F4F1EA` without a reload (keep a marker on `window` and check it survives).
4. SHELL-14: kill the renderer (`webContents.forcefullyCrashRenderer()` through `electronApp.evaluate`); the window reloads and the `?e2e=1` ping line shows all three services again.
5. `npm run dist` produces an installer `dist/HSOS Setup 0.1.0.exe` (check once, outside the e2e run).

Also F-005 (move the window, restart, same place), F-006 (edit settings.json on disk, the change applies within a second) and F-004 (kill workspace-service, a crash file appears in `%LOCALAPPDATA%\HSOS\crash`, the service is ready again within 5 s) can join this file.

## 027 Motion, glass and the background (e2e left)

Unit tests done. Left: UI-32, the worker draws no frame while `visibility` is hidden and exactly one under `reduced` (needs the app, e2e).

## 028 App frame and pages (e2e left)

Unit tests done (`tests/workspace/pages.ui.test.tsx`). Left:

`tests/e2e/demo-pages.e2e.ts` (launch with `--hsos-demo`):

| Rule   | Given | When | Then |
| ------ | ----- | ---- | ---- |
| MOT-5  | the Code page | `Ctrl+1` | `startViewTransition` ran once (wrap it in `page.evaluate`); the Dashboard shows after `motion.page` |
| MOT-7  | the background running | three page changes | the canvas is the same node and `backdropStats()` frames never go down |
| MOT-11 | a page transition in progress | a key is pressed in a focused input on the new page | the input has the character before the transition finishes |
| WS-41  | the demo on `code` | Dashboard for 3 s and back | the code section is the same node |

# Untested: card 032 fixes

Test file for all rows: `tests/sessions/sessions-fixes.ui.test.tsx`. Each name starts with its rule id.

| Rule | Kind | Given | When | Then |
|---|---|---|---|---|
| SESS-71 | component | Session History with rows, focus in the search field | Ctrl+A | the field's text is selected by the browser; no row is selected |
| SESS-72 | component | Session History with three rows | Ctrl+A with a row focused | all three rows are selected |
| SESS-73 | component | a row whose "more" button is focused | Enter, F2 or Delete | the row's handlers do not run; the menu opens on Enter |
| SESS-72 | component | three rows, the first focused | ArrowDown, then ArrowUp | focus moves to the second row, then back to the first |
| SESS-31, SESS-32 | component | the picker with a resumable row | Resume succeeds | the toast "Resumed ..." is in the document after the dialog is gone, and stays for the toast time |
| SESS-32 | component | a stub bus whose `terminal.create` returns id T1 | Resume in new terminal | `openPanel('terminal.shell', { terminalId: T1, cwd, worktree: null, launch: null, fontSizeDelta: 0 })` is called, then the success toast |
| SESS-32 | component | no project open | Resume in new terminal | an error toast "Open a project first, then resume the session." and no `terminal.create` call |
| SESS-32 | component | `terminal.create` fails | Resume | an error toast with the message and no panel is opened |
| SESS-71 | component | the open project has no sessions, other folders have | the history opens | the project select reads "All projects" and all groups show |
| SESS-71 | component | a project filter chosen | `workspace.projectChanged` fires | the filter is back at its default |
| SESS-72 | component | sessions of two folders with mixed activity times | All projects chosen | groups are ordered by their newest row; rows inside each group newest first |
| SESS-50 | component | an open reader with 200 items, total 200 | the next poll reports total 650 | all items 200 to 649 are shown, with no gap |
| SESS-50 | component | an open reader scrolled to the top | "Show earlier" | the first previously visible item stays at the same screen position |
| SESS-32, SESS-43 | component | a reader whose session has no live terminal | `sessions.recordChanged` makes the list report a live terminal | the Resume button is gone; when the terminal exits it returns |
| SESS-76 | component | a selection of only running sessions | Delete | the dialog "Nothing to move" lists them and has a Close button; no "Move 0" title and no `trash` call |
| SESS-76 | component | a selection of one idle and one running session | Delete | the title reads "Move 1 session to the Recycle Bin?" and the running one is listed |
| SESS-32 | unit | cwd `C:\dir $x\`y` | copy resume command | the clipboard text is `cd "C:\dir `$x\``y"; claude --resume <id>` |
| SESS-32 | component | `shell.writeClipboard` fails | Copy resume command | an error toast with the message |

# 034 Notes page and browser panel: test plan (untested)

Code: `src/modules/graph/panel/` (GraphView, GraphCards, NotesList, LocalGraph, graph-model, graph-store, graph-canvas, graph-colour), `src/modules/graph/register.ui.ts`, `src/modules/browser/panel/` (BrowserTab, address), `src/modules/browser/register.ui.ts`. Feature F-069.

The card names the `component` rows of `graph.md` and `browser.md` for these panels. `browser.md` has no component row for the panel; the nearest rows are the unit row BROW-4 (address parsing, implemented in `address.ts`) and the e2e rows, which need the main process and are not listed here.

Suggested files and rows (the testing agent may group them differently):

`tests/graph/graph-view.test.tsx` (component, fake bus with graph fixtures; WebGL is absent in jsdom, so the test mocks `sigma` or runs in the e2e level where noted):

| Rule | Given | When | Then |
| --- | --- | --- | --- |
| GRAPH-20 | a graph with saved positions in the panel state | the panel mounts | nodes take the saved positions before layout runs (ForceAtlas2 is not run when every node has a saved position) |
| GRAPH-23 | a node with two neighbours | it is hovered | non-neighbour nodes have reduced opacity (the node reducer returns an rgba colour at 0.15 alpha) |
| GRAPH-26 | nodes changed 2 hours and 3 days ago | "Changed in last 24 hours" is switched on | only the first is drawn (`isRecent`, reducer `visibility` hidden for the other) |
| GRAPH-29 | 6 000 nodes | the view renders | only hovered and matched labels show. NOT BUILT: the view labels the 30 largest nodes and every label from 1.8x zoom; the 5 000-node rule is not implemented. Expect this row to fail until added. |
| GRAPH-30 | a note `a.md` selected, linked from `b.md` on line 4 | the local graph renders | it lists `b` with that line's text (`graph.backlinks` fixture) |
| GRAPH-50 | the graph view at 1x | wheel up 20 notches at a node, then a double-click on empty space | zoom stops at 5x (sigma `minCameraRatio` 0.2) and the double-click resets the camera. The wheel-at-pointer part depends on sigma's captor; the test may check only the limits. |
| GRAPH-51 | fake clock; the pointer sweeps at 300 px/s, then at 900 px/s past a node | each sweep | the node moves only on the second sweep and is back within 2 000 ms; with `CLAUDE.md` in the graph it never moves (the pinned node is skipped by the drift loop) |
| GRAPH-52 | fake backdrop; 3 nodes, one the open note | one source tick | 3 sources; the open note's strength is 3 times the others'. NOT BUILT: no steam source is registered for graph nodes (ui-kit exports only `useBackdropSource`, which needs an element). Expect a failure until a canvas source API exists. |
| GRAPH-42 | start files of 120 and 90 lines and a memory index of 260 lines | the agent view turns on | the summary says `Loaded at every start: 3 files, 410 lines` (memory counted at 200) and the memory badge shows |

`tests/graph/agent-view.test.tsx` (component):

| Rule | Given | When | Then |
| --- | --- | --- | --- |
| GRAPH-43 | `CLAUDE.md` → `a` → `b`; an unlinked note `c` | the agent view turns on | `a` is 1 hop, `b` 2 hops, `c` muted; `c`'s card says "No link reaches this note. An agent finds it only by searching."; `b`'s card shows `CLAUDE.md`, `a`, `b` (`agentReach`, `chainTo`) |
| GRAPH-43 | the same graph | "Only not reached" is switched on | only `c` is drawn (reached nodes get `visibility` hidden) |
| GRAPH-44 | a node | it is hovered for 400 ms | the card shows the preview (`graph.preview`, 12 lines, "…" when cut); focus has not moved; Escape closes it. NOTE: the preview is plain text, not MarkdownView. |
| GRAPH-42 | a `claudeMd` note of 260 lines | the agent view is on | the badge "Over 200 lines: Claude follows long files less well" shows on its card |

`tests/graph/notes-list.test.tsx` (component):

| Rule | Given | When | Then |
| --- | --- | --- | --- |
| GRAPH-55 | an index with `a.md` (degree 4) and `notes/b.md` | the notes list renders | a tree with `a.md` and a count of 4, and `notes/b.md` under its folder; no `graph.readFile`/disk call was made (the list reads only `useGraphData`) |

`tests/browser/address.test.ts` (unit, BROW-4, `normalizeAddress`):

| Rule | Given | When | Then |
| --- | --- | --- | --- |
| BROW-4 | `example.com`, `localhost:3000`, `how to center a div` | the address is normalised | `https://example.com`, `http://localhost:3000`, `https://duckduckgo.com/?q=how%20to%20center%20a%20div` |

`tests/browser/browser-tab.test.tsx` (component, optional; the spec has no row for it):

| Rule | Given | When | Then |
| --- | --- | --- | --- |
| BROW-2 | a browser panel mounted with a page area of 800 by 600 | the panel mounts and resizes | `browser.setBounds` is sent with the area's rectangle, debounced 16 ms; with width 0 when the page is hidden (`usePageVisible` false) or an overlay is open (BROW-3) |
| BROW-41 | a tab whose `isAgentControlled` is true | the panel renders | the "Claude is using this tab" indicator and the "Stop" button show, and the page area has the 2 px accent frame |
| BROW-1 | a panel with `tabId` null and `url` empty | it mounts | `browser.openTab` is called with the home URL from settings and the tab id is saved in the panel state |

Not in this plan: the demo fixture screenshot (not built, see progress), BROW-3 screenshot overlay, BROW-9 crash state (no channel in the contract), and the e2e rows of `browser.md`.

# Untested: cards 030 and 033 fixes

Test files: `tests/review/changes-fixes.ui.test.tsx`, `tests/activity/activity-fixes.ui.test.tsx`, `tests/files/tree-fixes.ui.test.tsx`, `tests/history/timeline-fixes.ui.test.tsx`, `tests/git/status-fixes.ui.test.tsx`.

| Rule | Kind | Given | When | Then |
|---|---|---|---|---|
| REV-12, P-40 | component | Changes with a focused commit message field | `changesInvalidated` fires | the field keeps focus and text; no skeleton shows |
| REV-10, P-40 | component | a clean repo, 0 files | the view shows | the base select is visible with "No changes since the last commit." |
| REV-10 | component | two sessions, one with a `file-edit` event | the base select opens | only that session is listed |
| REV-10 | component | a session base chosen | `projectChanged` fires | base is "Since last commit", selection and sessions are cleared |
| REV-13 | component | a changed file row | Enter or double click | `openDiff` runs, not `openFile` |
| REV-14 | component | a commit in flight | Commit pressed twice | `git.commit` is called once |
| REV-14 | unit | project `C:\repo\app`, repo root `C:\repo`, file `src/a.ts` | commit | the path sent is `app/src/a.ts` |
| GIT-26 | component | `operation: 'merge'` | `git.sync` runs | no `git.sync` call; a notification says "Merge in progress. Finish it in a terminal, then sync again." |
| GIT-26 | component | `operation: 'merge'`, 0 files | the status item renders | it reads "Merge in progress" |
| GIT-26 | component | `isOffline: true`, 2 files | the status item renders | it reads "2 changed · Offline" |
| git UI | component | 2 files | the status item is pressed | `openPanel('review.changes')` |
| GIT-11 | component | ChangesView, DiffPanel and TrayCount mounted together | the project opens | `git.getStatus` is called once |
| ACT-12, P-40 | component | Activity, filter "You" returns 0 entries | the list shows | both filters stay visible with "No change matches these filters." |
| ACT-12 | component | a session chosen, then the cause changed | the list reloads | the session option is still in the select and still chosen |
| ACT-15, P-40 | component | Activity with scroll position set | `entryAdded` and a refresh | no skeleton; scroll position kept |
| ACT-16 | component | page 1 ends with two entries at time T | scroll to the end | page 2 is asked from T+1; the second entry at T shows once |
| ACT-16 | component | a page that adds only known ids | scroll to the end | no more requests |
| ACT-33 | component | the Artifacts search | typing "a", "ab", "abc" within 300 ms | one `listArtifacts` call with "abc" |
| ACT-31 | component | `shell.openPath` fails | a PDF tile is opened | an error toast with the message |
| ACT-30 | component | Artifacts with tiles | `projectChanged` fires | search is empty and old tiles are gone |
| REV-32 | component | a comment in edit mode | the text has two lines and Ctrl+Enter | `updateComment` is called with both lines |
| REV-34 | component | "Sent. Clear comments?" showing | a comment is added | the Send and Copy buttons are back |
| FILE-61 | component | `src` expanded then collapsed | a change in `src/y.ts`, then `src` expanded | the new entry is listed |
| FILE-60, P-40 | component | root listed | `files.changed` in the root | no skeleton; the tree keeps scroll and open menu |
| FILE-60 | component | a listing in flight | the project changes | the late result is not shown |
| HIST-43, P-40 | component | a history timeline with a version selected | `snapshotAdded` | no skeleton; selection and diff scroll kept |
| HIST-42 | component | a restore that succeeds | the toast shows | it has an "Undo" action; pressing it calls `history.restore` with the row under the new restore row |
| ACT/REV commands | unit | the modules registered | the command list is read | `review.showChanges` (Ctrl+Shift+G), `activity.showTimeline`, `activity.showArtifacts` exist and open their side views |

# 035 Dashboard: test plan (untested)

Code: `src/modules/dashboard/panel/` (placement.ts, dashboard-store.ts, DashboardPage.tsx, Dashboard.module.css), `src/modules/dashboard/register.ui.ts`; widgets in `src/modules/hud/panel/widgets/hud-widgets.tsx`, `src/modules/sessions/panel/widgets/RecentWidget.tsx`, `src/modules/git/panel/widgets/StatusWidget.tsx`, `src/modules/activity/panel/widgets/RecentWidget.tsx`, `src/modules/graph/panel/widgets/MiniGraph.tsx`. Feature F-070.

Suggested files and rows (from dashboard.md "Tests"; the testing agent may regroup):

`tests/dashboard/placement.test.ts` (unit, pure functions in `placement.ts`):

| Rule | Given | When | Then |
| --- | --- | --- | --- |
| DASH-3 | two instances sharing a cell; one at `x: 7, w: 2` on 8 columns | the placement check runs (`canPlace` / `insideGrid`) | both are refused |
| DASH-21 | a file with an overlapping instance and one of an unknown type | `validateFile` runs | the overlapping one is dropped (in `dropped`); the unknown-type one is kept in `file.widgets` (the page does not draw it) |
| DASH-22 | no file | `DEFAULT_LAYOUT` is validated on 8 by 6 | no overlaps, nothing outside the grid |
| DASH-23 | the default layout | `reflow` with columns 6 | every widget is placed, none overlaps, and the count is unchanged |
| DASH-7 | a `hud.usage` widget (largest 4×3) at 0,0 with a widget at 3,0 | `resizeTarget` with a want of 6 wide | width is 3 |
| DASH-8 | a full screen (no free cell of the default size) | `firstFit` | null (the page then shows "No room on this screen. Make space or add a screen.") |

`tests/dashboard/dashboard.ui.test.tsx` (component, fake bus with the `dashboard` fixtures; store reset between tests):

| Rule | Given | When | Then |
| --- | --- | --- | --- |
| DASH-1 | 3 screens, the first shown | `Ctrl+PageDown` twice, then once more | screen 3 shows and the third dot is filled; the last press does nothing |
| DASH-2 | an 8×6 grid in a 1600×900 page, then 1200×700 | it renders | every widget keeps its `x`, `y`, `w`, `h` (grid placement is by cell, not pixels) |
| DASH-4 | a widget type whose component throws, beside a healthy widget | the screen renders | the broken one shows "… stopped working." in its frame; the other renders |
| DASH-4 | a `free` and a `box` widget | the screen renders | only the `box` one has a `widget` surface |
| DASH-5 | fake clock | the pointer is held on an empty cell for 499 ms, then for 500 ms | edit mode starts only the second time (`HOLD_MS`) |
| DASH-5 | `data-motion="reduced"` | edit mode starts | no widget has the `sway` class |
| DASH-6 | edit mode, a 2×2 widget, a free 2×2 area and an occupied one | it is dragged over each | the outline is accent over the free area and danger over the occupied one; dropping on the occupied one leaves it where it was |
| DASH-7 | as in placement | its right handle is dragged 4 cells | its width stops at 3 |
| DASH-8 | a full screen | "Add widget" then a type | the "No room" toast shows and nothing was added |
| DASH-9 | a widget removed | "Undo" within 5 s | it is back in the same place (the toast lasts 4 s, `TOAST_MS`; see progress) |
| DASH-10 | a screen with 2 widgets | its remove button | the confirmation reads "Remove this screen and its 2 widgets?" |
| DASH-11 | edit mode, a focused 2×2 widget at 0,0 | Right, then Shift+Down | it is at 1,0 and 2×3 |
| DASH-12 | a `hud.usage` widget | it is resized from 1×1 to 2×2 | it shows one number, then both bars |

`tests/e2e/demo-dashboard.e2e.ts` (e2e, `npm run demo`):

| Rule | Given | When | Then |
| --- | --- | --- | --- |
| DASH-13 | a `hud.ribbon` widget for a session in terminal `t1` | it is activated | the Code page shows with `t1` focused (`focusTerminal`), through one view transition. NOTE: the view transition is not built (MOT-6); expect the focus check to pass only. |

Not in this plan (no channel or not built): DASH-20 (save and load over the service, integration; the service side is card 116), the swipe gesture of DASH-1, the drag-from-sheet of DASH-8, the edge hold of DASH-6.

# 036 state gallery: test plan (untested)

Code: `src/demo/gallery.tsx`, `src/demo/gallery.module.css`; flag wiring in `src/main/index.ts`, `src/main/window/main-window.ts` (`loadRenderer` option `gallery`), `src/ui/index.tsx` (`?gallery=1` renders the gallery).

Test (card 036, step 3):

| File | Rule | Level | Given | When | Then |
| --- | --- | --- | --- | --- | --- |
| `tests/demo/gallery.ui.test.tsx` | every registered panel and widget renders all four states without throwing | component | the gallery's four passes over the demo transport (`Gallery`) | the page renders | every registered panel (`ready.registry.panels`) and every dashboard widget (`uiContributions(dashboardWidgets)`) has a tile in loading, empty, error and ready; no tile shows "threw:" from its boundary |

Notes for the testing agent:
- Module stores are singletons (hud-data, graph-store, dashboard-store, and others). The four passes write them in turn, so a column can show data from another state. The test checks rendering and no throw, not that each column shows its own state.
- Loading never answers, so loading tiles show the panel's own loading view or nothing. Empty and error answer after 120 ms.
