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
