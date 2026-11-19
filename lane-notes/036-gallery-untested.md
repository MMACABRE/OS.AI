# 036 state gallery: test plan (untested)

Code: `src/demo/gallery.tsx`, `src/demo/gallery.module.css`; flag wiring in `src/main/index.ts`, `src/main/window/main-window.ts` (`loadRenderer` option `gallery`), `src/ui/index.tsx` (`?gallery=1` renders the gallery).

Test (card 036, step 3):

| File | Rule | Level | Given | When | Then |
| --- | --- | --- | --- | --- | --- |
| `tests/demo/gallery.ui.test.tsx` | every registered panel and widget renders all four states without throwing | component | the gallery's four passes over the demo transport (`Gallery`) | the page renders | every registered panel (`ready.registry.panels`) and every dashboard widget (`uiContributions(dashboardWidgets)`) has a tile in loading, empty, error and ready; no tile shows "threw:" from its boundary |

Notes for the testing agent:
- Module stores are singletons (hud-data, graph-store, dashboard-store, and others). The four passes write them in turn, so a column can show data from another state. The test checks rendering and no throw, not that each column shows its own state.
- Loading never answers, so loading tiles show the panel's own loading view or nothing. Empty and error answer after 120 ms.
