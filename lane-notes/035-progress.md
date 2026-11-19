## 035 Dashboard
Status: done (untested)
Date: 2026-11-19
Did: Built the dashboard page (`dashboard.screens`, shown by the Dashboard page): pure placement rules (`placement.ts`: fits, overlaps, first free place, resize limits, file validation, reflow on a changed grid, the DASH-22 default layout), the layout store with a 500 ms debounced save and load through `dashboard.load`/`dashboard.save` (`dashboard-store.ts`), and the page with screens and dots, hold-to-edit, move and resize by pointer, edit toolbar, remove with Undo, add widget and screens dialogs, keys (arrows, Shift+arrows, Delete, Enter, Escape, Ctrl+PageDown/Up). Contributed the eleven catalog widgets through `dashboardWidgets`: hud (ribbon, sessions, usage, context, quickBar, skills, mascot), sessions.recent, git.status, activity.recent, graph.mini. Added the dashboard to `src/ui/module-list.ts` after browser. No tests written, per the owner's rule; the test plan is in `lane-notes/035-untested.md`.
Checks: typecheck ok, lint ok, deps ok, test 27 passed (existing tests only), build ok (electron-vite build)
Deviations:
- `dashboard.screens` is registered as a `dock` panel. As a `side` panel, Pages.tsx would list it as a Code page side tab.
- Not built, DASH-1: swipe and wheel between screens (dots, keys and drag on empty space are not all there; only dots and keys).
- Not built, DASH-5: right-click "Edit dashboard" menu (the command `dashboard.edit` and the hold work).
- Not built, DASH-6: dragging a preview from the Add sheet, and edge hold to move to the next screen. Screens cannot be reordered by drag (DASH-10).
- DASH-8: the Add sheet lists types without live previews; `dashboard.addWidget` only turns edit mode on.
- DASH-9: the Undo toast uses `TOAST_MS` (4 s), not 5 s.
- DASH-11: arrows move focus between widgets in DOM order, not by position.
- DASH-12: no stagger on each show, no hover surface tone; widgets keep the default scale on hover. Values roll only where `RollingNumber` is used.
- DASH-13: no view transition (MOT-6 is not built).
- DASH-20 service side (`register.service.ts` for the file) is not in this card; the renderer calls `dashboard.load`/`save`, which the demo answers.
- Widget config: `configSchema` is `z.unknown()` and `setConfig` is a no-op; no widget has settings yet.
- Widgets: `hud.ribbon` has no 2×1 compact mode; `hud.skills` shows the full deck at every size; `hud.usage` and `hud.context` open the HUD panel (no popover); `hud.context` shows the cache state but not the Context popover; `hud.sessions` ignores its 2×2 filter; `sessions.recent` lists rows and "All" opens Session History; `git.status` has no repo link or Sync; `activity.recent` opens the Activity timeline; `graph.mini` is a still SVG of the local graph (no drift, no steam, no pointer), and its activation opens the graph view on the current page.
- Module-wide: the page reads the grid from `dashboard` settings (`columns`, `rows`) and reflows on change (DASH-23).
Blocked questions:
1. Widgets that go to another page (`graph.mini`: "Goes to the Notes page"; `hud.ribbon`: "the Code page") cannot switch pages: a module may not import workspace's `goToPage`, and UiContext has no command runner. The widgets open their panel only. A page-switch hook is needed in the UI context.
2. Undo window: DASH-9 says 5 s, ui-kit's toast lasts `TOAST_MS` = 4 s. Which wins?
3. The page's panel kind is not in the spec; I chose `dock` (see Deviations).
4. Widget activation for `hud.ribbon` and `hud.mascot` focuses the target terminal's input only when it is on screen; the spec says "goes to that session's terminal on the Code page".
Anything that looks wrong: the dashboard's Ctrl+PageDown/Ctrl+PageUp commands run even when another page is visible (they are not gated on the page being shown). `npm run test` prints the node-pty "AttachConsole failed" stack before passing; it is environmental.
Next: 036
