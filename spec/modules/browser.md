# Module: browser

## Purpose

A real Chromium browser inside HSOS, in its own profile, that the owner uses to look at what they are building and that Claude can drive through MCP while the owner watches.

## Interface

`contracts/channels/browser.ts`.

- Runs in: `main` (page views and their control, because `WebContentsView` and `webContents.debugger` exist only there), `ui` (the browser panel's toolbar and frame).
- Third-party packages allowed: `electron` (service side only, the one exception in `03-stack.md`), `zod`.
- Spike: task "Spike: page view and DevTools Protocol" proves the Electron APIs named here before this module is built. If a name differs in Electron 45, use the installed equivalent and record it (`03-stack.md`).

## How a tab is built

- Each tab is one `WebContentsView` added to the main window's content view, positioned over its panel's page area with `setBounds`.
- Every tab uses the session from `session.fromPartition('persist:hsos-browser')`, or `'hsos-browser-temp'` with no `persist:` prefix when `persistProfile` is off. This profile never shares cookies, logins or storage with the owner's own browser or with the HSOS window.
- Web preferences: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, no preload.
- Control uses the Chrome DevTools Protocol through `webContents.debugger`, attached at tab creation with protocol version `1.3`. The domains `Page`, `Runtime`, `DOM`, `Accessibility`, `Input`, `Network` and `Log` are enabled.

## Behaviour

### Tabs and the panel

- **BROW-1.** Dock panel `browser.tab`, `allowMultiple: true`. State: `{ tabId: BrowserTabId | null, url: string }`. On mount it calls `openTab` with its saved URL, or `homeUrl`.
- **BROW-2.** The panel draws a toolbar: back, forward, reload or stop, an address field, a "Capture element" button, a "Developer tools" button, and the agent indicator (BROW-41). Below the toolbar is an empty area whose screen rectangle the panel reports with `setBounds` on mount, on every resize or move (debounced 16 ms), and with width 0 when hidden.
- **BROW-3.** Because the page view is drawn above the window's own content, HSOS menus, the palette and dialogs would be hidden under it. While any overlay is open, the renderer sends `setBounds` with width 0 for every tab and restores them after. The panel shows a static screenshot of the page in its area meanwhile (`capturePage`, taken when the overlay opens), so nothing visibly disappears.
- **BROW-4.** The address field accepts a URL or plain words. Text without a scheme that contains a dot and no spaces becomes `https://<text>`; `localhost` and `127.0.0.1` with or without a port become `http://`; anything else becomes a search on `https://duckduckgo.com/?q=`.
- **BROW-5.** Allowed schemes are `http`, `https`, `file` (only for paths inside the project, used for artifacts) and `about:blank`. Navigation to any other scheme is refused with `BROW_NAVIGATION_BLOCKED`.
- **BROW-6.** A page's request to open a new window opens a new browser tab beside it. Downloads are cancelled and a toast says "Downloads are turned off in the HSOS browser."
- **BROW-7.** Permission requests from pages (camera, microphone, location, notifications, clipboard read) are denied without asking.
- **BROW-8.** `tabChanged` is emitted on navigation, title change, load start and end, and error. The panel title is the page title.
- **BROW-9.** A tab whose page crashes (`render-process-gone`) shows "This page stopped working." with "Reload" in the panel. Other tabs and the app are unaffected.
- **BROW-10.** Workspace restore reopens each tab at its saved URL.

### Agent control

- **BROW-30.** Agent requests come only from the `mcp` module. They act on a tab that is visible to the owner; an agent never controls a hidden page.
- **BROW-31.** `agentSnapshot` returns the page's accessibility tree from `Accessibility.getFullAXTree`, reduced to nodes with a role other than `none`, `generic` and `InlineTextBox`, or with a name. Each node gets a ref `e<n>`, numbered in tree order and kept in a map to its `backendDOMNodeId` until the next snapshot or navigation. Names are cut to 200 characters. The tree is cut at 2 000 nodes, with a final node `{ role: 'note', name: 'Truncated' }`.
- **BROW-32.** `agentClick(ref)` scrolls the node into view (`DOM.scrollIntoViewIfNeeded`), reads its box (`DOM.getBoxModel`), and sends a mouse press and release at its centre (`Input.dispatchMouseEvent`). An unknown or stale ref returns `BROW_ELEMENT_NOT_FOUND` with "Take a new snapshot."
- **BROW-33.** `agentType(ref, text, submit)` focuses the node (`DOM.focus`), selects its current content, inserts `text` with `Input.insertText`, and presses Enter when `submit`.
- **BROW-34.** `agentPressKey` accepts `Enter`, `Tab`, `Escape`, `Backspace`, `Delete`, the arrow keys, `PageUp`, `PageDown`, `Home`, `End`, and those with `Ctrl+`, `Shift+` or `Alt+`.
- **BROW-35.** `agentNavigate(tabId, url)` with a null `tabId` uses the most recently focused browser tab, or opens a new browser panel when none exists. It waits for the load to end or 30 seconds.
- **BROW-36.** Navigation rule for the agent:
  - `localhost`, `127.0.0.1`, `[::1]`, any host ending `.localhost`, and hosts in `agentAllowedHosts` are allowed.
  - `file:` inside the project is allowed.
  - Any other host, with `askBeforeAgentNavigates` on, shows a bar in the panel: "Claude wants to open <host>." with "Allow once", "Always allow <host>" (adds it to `agentAllowedHosts`) and "Block". The request waits for the answer. "Block", or no answer within 10 minutes, returns `BROW_NAVIGATION_BLOCKED`.
- **BROW-37.** `agentScreenshot` uses `Page.captureScreenshot` in PNG, of the viewport or, with `fullPage`, the full page up to 8 000 pixels tall.
- **BROW-38.** The tab keeps the last 500 console entries and the last 500 network entries from `Log`, `Runtime.consoleAPICalled`, `Runtime.exceptionThrown` and the `Network` events. Values are cut to the contract's lengths. Request and response bodies, cookies and headers are never kept.
- **BROW-39.** Every text sent back to Claude from a page (names in the tree, console text) is page content, and Claude Code treats tool results as data. HSOS adds no instruction around it and never acts on it (P-6).

### Owner stays in charge

- **BROW-40.** A tab becomes agent-controlled on its first agent request and stays so until `agentRelease`, `revokeAgentControl`, or 60 seconds with no agent request.
- **BROW-41.** While agent-controlled, the panel shows a 2 px `color.accent` frame around the page area and an indicator in the toolbar: "Claude is using this tab" with a "Stop" button.
- **BROW-42.** "Stop" calls `revokeAgentControl`. Pending and later agent requests for that tab return `BROW_CONTROL_STOPPED` until the owner presses "Let Claude continue" in the same place, or 5 minutes pass.
- **BROW-43.** The owner can use the tab while Claude controls it. Owner input is never blocked.
- **BROW-44.** HSOS never fills passwords or payment details for Claude. Agent `agentType` into a field whose `type` is `password`, or whose autocomplete attribute begins with `cc-`, returns `BAD_REQUEST` with "HSOS does not type into password or card fields. Ask the owner."

### Element capture

- **BROW-50.** "Capture element" (or `startCapture`) creates an isolated world with `Page.createIsolatedWorld` and runs the capture script there with `Runtime.evaluate`, so the page's own scripts cannot see or alter it. Hovering outlines elements in `color.accent`; a click picks the element and ends capture; Escape cancels.
- **BROW-51.** The pick produces: a CSS selector (id when unique, else tag and classes, else an `nth-of-type` path from the nearest element with an id, at most 6 levels), the outer HTML cut to 4 000 characters, and these computed styles as `property: value` lines: `display`, `position`, `width`, `height`, `margin`, `padding`, `font-family`, `font-size`, `font-weight`, `line-height`, `color`, `background-color`, `border`, `border-radius`, `box-shadow`, `gap`, `grid-template-columns`, `flex-direction`, `justify-content`, `align-items`.
- **BROW-52.** After the pick, a popover in the panel offers: "Add comment" (a text field, then `review.addComment` with an `element` target), "Copy" (the HTML and styles to the clipboard) and "Send to Claude" (pastes them as one block into the target terminal without Enter, as REV-33).

## Commands

| Id | Title | Default key |
|---|---|---|
| `browser.newTab` | New Browser Tab | `Ctrl+Shift+B` |
| `browser.focusAddress` | Focus Address Bar | `Ctrl+L` when a browser panel has focus |
| `browser.captureElement` | Capture Element | `Ctrl+Shift+X` when a browser panel has focus |
| `browser.reload` | Reload Page | `F5` when a browser panel has focus |
| `browser.devTools` | Page Developer Tools | `F12` when a browser panel has focus |
| `browser.clearData` | Clear Browser Data | none; asks for confirmation |

## States

| State | Shows |
|---|---|
| Loading | toolbar with a progress line under it; the page area keeps the old page |
| Ready | the page |
| Error | in the page area: "This page could not be loaded." with the error and "Retry" |
| Crashed | BROW-9 |

## Tests

| Rule | Level | Given | When | Then |
|---|---|---|---|---|
| BROW-4 | unit | `example.com`, `localhost:3000`, `how to center a div` | address parsing | `https://example.com`, `http://localhost:3000`, a search URL |
| BROW-5 | e2e | a browser tab | navigate to `ms-settings:` | `BROW_NAVIGATION_BLOCKED`; the page is unchanged |
| BROW-3 | e2e | a browser tab open | the command palette opens | the palette is visible above the page area |
| BROW-6 | e2e | a page that starts a download | it runs | no file appears in the Downloads folder; a toast shows |
| BROW-7 | e2e | a page asking for location | it runs | the page receives a denial |
| Profile | e2e | a cookie set by a page in the HSOS browser | the HSOS window's own session is read | the cookie is absent there |
| BROW-31 | e2e | a local test page with a form | `agentSnapshot` | the tree has a textbox and a button with refs |
| BROW-32 | e2e | that snapshot | `agentClick` on the button | the page's click counter reads 1 |
| BROW-32 | e2e | a ref from before a navigation | `agentClick` | `BROW_ELEMENT_NOT_FOUND` |
| BROW-33 | e2e | the textbox ref | `agentType` with `hello` and submit | the page shows "submitted: hello" |
| BROW-36 | e2e | `agentNavigate` to `https://example.com` | the bar shows and "Block" is chosen | `BROW_NAVIGATION_BLOCKED` |
| BROW-36 | e2e | `agentNavigate` to `http://localhost:<test port>` | it runs | no bar; the page loads |
| BROW-38 | e2e | a page logging an error and fetching a missing file | `agentConsole` and `agentNetwork` with only errors and failures | one console error and one network entry with status 404 |
| BROW-41 | e2e | an agent request | it runs | the indicator shows |
| BROW-42 | e2e | "Stop" pressed | another agent request arrives | `BROW_CONTROL_STOPPED` |
| BROW-44 | e2e | a password field ref | `agentType` | `BAD_REQUEST`; the field is empty |
| BROW-51 | e2e | a test page with `<button id="go" class="primary">Go</button>` | capture picks it | selector `#go`, HTML matches, styles include `font-size` |
| BROW-9 | e2e | a page | its renderer is killed with `forcefullyCrashRenderer` | the panel shows the crash state; another tab still works |
