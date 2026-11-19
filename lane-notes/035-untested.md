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
