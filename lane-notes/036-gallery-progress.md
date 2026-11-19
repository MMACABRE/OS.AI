## 036 Settings, themes and every state (part 2: state gallery)
Status: done (untested)
Date: 2026-11-19
Did: Built `src/demo/gallery.tsx` for `npm run demo -- --gallery`. It loads the UI modules four times, one pass per state (loading, empty, error, ready). Each pass has its own registry and bus. Loading never answers; empty answers each request with the first of [], null or {} that fits the response schema; error answers each request with an INTERNAL error; ready uses the demo transport and fixtures. The page groups every registered panel and every dashboard widget by module, one row each, with four tiles per row. A tile error boundary keeps one throwing panel from breaking the page. The widgets of each pass are found by diffing `uiContributions(dashboardWidgets)` around the pass.
Checks: typecheck ok, lint ok, deps ok, test 27 passed (existing tests only), build ok (electron-vite build). The gallery was not opened in Electron.
Deviations:
- Files outside `src/demo`: `src/main/index.ts` (reads `--gallery` from argv, passes `gallery` to `loadRenderer`), `src/main/window/main-window.ts` (`loadRenderer` option `gallery` adds `&gallery=1` to the search string), `src/ui/index.tsx` (`?gallery=1` renders the gallery instead of the app). `package.json` is unchanged: `npm run demo -- --gallery` forwards `--gallery` to `electron . --hsos-demo`.
- Shared module stores: the module stores (hud-data, graph-store, dashboard-store, and others) are singletons, so the four passes write the same stores. A column can show another state's data. A per-state store would fix this; I did not change the modules.
- Panels are shown with their `initialState`, the widgets with their `defaultSize` and `defaultConfig`, and `setState`/`setConfig` are no-ops.
- Tiles are 26 by 18 rem, panels 36 by 24 rem. Panels that need a dock (DockHost) are shown without it.
- The gallery is not reachable from the app menu; it is opened only by the flag.
Blocked questions: none.
Anything that looks wrong: the four passes start every module's loaders four times (graph, hud, dashboard, and others) against the demo transport, so the demo does four times the requests on this page. Acceptable for a gallery, but it is not a production path.
Next: 037
