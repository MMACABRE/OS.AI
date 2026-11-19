## 034 Notes page and browser panel
Status: done (untested)
Date: 2026-11-19
Did: Built the graph panels (`graph.view` dock with sigma canvas, CLAUDE.md pinned at the centre, drift and pointer push, toolbar, details and hover cards, agent view; `graph.notes` notes tree; `graph.local` local graph with backlinks) on a shared `graph-store` fed by `graph.getGraph` and `graph.graphChanged`, plus the commands graph.open, graph.agentView, graph.showLocal and graph.reindex. Built the `browser.tab` dock panel (toolbar, address parsing, page area bounds to `browser.setBounds`, agent indicator and Stop) and its commands. Added both modules to `src/ui/module-list.ts` after hud. No tests written, per the owner's rule; the test plan is in `lane-notes/034-untested.md`.
Checks: typecheck ok, lint ok, deps ok, test 27 passed (existing tests only), build ok (electron-vite build)
Deviations:
- graphology typings: `graphology-types` (a peer of graphology 0.26) is not in the lockfile, so graphology's class has no methods under typecheck. Fix in `src/modules/graph/panel/graph-canvas.ts`: a minimal `CanvasGraph` type and one cast per package. The Lead should add `graphology-types` and drop the cast.
- sigma 4 options: `labelFont`, `labelSize`, `labelColor`, `defaultEdgeColor`, `renderEdgeLabels` are not in sigma 4's options, so label font and colour are sigma's defaults, not tokens. Camera limits and double-click zoom are set under `settings` (`minCameraRatio`, `maxCameraRatio`, `doubleClickZoomingRatio`). Hidden nodes use `visibility: 'hidden'`. Edge colours are set per edge.
- Layout runs synchronously on the main thread (200 iterations), not in a web worker (GRAPH-20).
- When nodes are added, the whole graph is laid out again; existing positions are not kept (GRAPH-27 asks to keep them).
- Not built, GRAPH-22 to 29 and 50 to 53: the 5 000 and 50 000 node modes (GRAPH-29); the 1.8x label rule is built, but the search "camera fits the matches" step is not; filters for kinds, roots, tags, orphans and unresolved (GRAPH-26) are not built, only "Changed in last 24 hours", colour by community and agent view; the pixel bracket of GRAPH-53 is approximated by the accent colour; the open note glow is not built (no focused-viewer channel).
- GRAPH-52 steam sources are not built: ui-kit exports only `useBackdropSource` (needs a DOM element), and graph nodes are canvas pixels. A canvas source API is needed in ui-kit.
- GRAPH-44 card preview is plain text in a `<pre>`, not `MarkdownView` (no markdown renderer in ui-kit).
- GRAPH-30 local graph is a radial SVG of the note and its neighbours, not a sigma layout; it does not stop at CLAUDE.md.
- Opening notes calls `openPanel('files.viewer', { path, line })`. `files.viewer` is card 030 (lane B), not on this branch, so the call logs `workspace.unknown_panel` until 030 is merged. "Open to the Side" and "Send Path to Terminal" are not built.
- Notes list groups files by the name of their parent folder, because `GraphNode` carries no folder path or root folder. Files directly in a root show under "Top level".
- Local graph follows the note selected in the graph or the list (`selectedPath`), since no channel says which viewer is focused.
- Browser: the page area shows the tab's title and URL, not a fixture screenshot. The demo has no screenshot channel for this panel, and the panel cannot tell demo mode; the fixture is not built. BROW-3 screenshot-on-overlay is not built (capture is main's). Panel title is the static "Browser" (BROW-8 wants the page title; `PanelDefinition.title` is static).
- Browser commands: `browser.clearData` is not registered (no channel in the contract). BROW-9 crash state is not built (no crash event in the contract).
- Side views open on the Code page (existing workspace rule), so "Show Local Graph" from the Notes page switches to Code.
- The Notes page does not open `graph.view` on its own. `Pages.tsx` (workspace, not in this card's list) gives the notes dock no graph; the layout C arrangement of `layout.md` (graph beside the note) needs that decision.
Blocked questions:
1. Notes page arrangement: `layout.md` "Pages" says the graph fills the space between the list and the notes dock, but `graph.view` is a dock panel that the notes dock hosts. Who opens it on the Notes page, and does the graph run behind the dock or beside it? (Built as a dock panel; not opened by default.)
2. BROW-8 says the browser panel's title is the page title, but `PanelDefinition.title` is static. Is a dynamic title in the contract, or is the title static?
3. `files.viewer` state shape: FILE-78 says `state.line`; no contract gives the viewer's state. Built as `{ path, line }`.
4. GRAPH-30 follows "the file open in the focused viewer"; no channel reports the focused viewer. Built with the selected note.
5. GRAPH-42 counts "notes" as nodes of kind `note`. Skills, memory and CLAUDE.md files are not counted in the reach total. Assumed from the spec's wording.
Anything that looks wrong: `graphology-types` missing from the lockfile (see Deviations). `npm run test` prints a node-pty "AttachConsole failed" stack from `conpty_console_list_agent.js` before the tests pass; it is environmental, and the run still exits 0.
Next: 035
