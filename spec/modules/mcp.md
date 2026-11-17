# Module: mcp

## Purpose

Lets Claude use HSOS itself: drive the browser panel, open a file or a diff in front of the owner, find notes in the graph, and read the owner's pinned feedback. Claude Code connects to it like any MCP server, and only sessions started in HSOS terminals see it.

## Interface

`contracts/channels/mcp.ts`. Calls `browser`, `files`, `workspace`, `graph`, `review` and `shell` through their channels.

- Runs in: `link-service`, sharing the HTTP listener of `claude-link` at the path `/mcp`.
- Third-party packages allowed: `@modelcontextprotocol/sdk` (its Streamable HTTP server transport), `zod`.
- Spike: the stage 4 spike task proves the SDK's server transport and Claude Code's connection to it before the tools are built.

## Connection

- **MCP-1.** The server is mounted at `http://127.0.0.1:<port>/mcp` on the `claude-link` listener. Requests need the launch token (LINK-10); others get 401 (`MCP_UNAUTHORISED` in logs).
- **MCP-2.** `claude-link` writes `linkDir\mcp.json` at every launch:

```json
{
  "mcpServers": {
    "hsos": {
      "type": "http",
      "url": "http://127.0.0.1:<port>/mcp",
      "headers": { "Authorization": "Bearer <token>" }
    }
  }
}
```

  The `claude` wrapper (LINK-4) adds `--mcp-config <linkDir>\mcp.json`. The owner's other MCP servers still load, because `--strict-mcp-config` is not passed.
- **MCP-3.** Server name `hsos`, version the app version. Tool list holds only the groups in `groups`. With `enabled` false the path answers 404 and `mcp.json` is not written.
- **MCP-4.** Every tool call is answered within its own timeout. A failure becomes an MCP tool result with `isError: true` and the `AppError` message as text. The server never crashes on a bad call.
- **MCP-5.** Every tool records the calling session from the `X-HSOS-Terminal` header when present, and the call appears in the activity of that session as a `tool` event (via `claude-link`).

## Tools

Descriptions are written for Claude and kept short, because they sit in every session's context. Each input schema is a zod object converted with the SDK.

### Browser group

| Tool | Input | Does | Output |
|---|---|---|---|
| `browser_navigate` | `url`, `tab_id?` | BROW-35 and BROW-36 | tab id, URL, title |
| `browser_snapshot` | `tab_id` | BROW-31 | the tree as indented text: `- button "Save" [ref=e12]` |
| `browser_click` | `tab_id`, `ref` | BROW-32 | "Clicked" |
| `browser_type` | `tab_id`, `ref`, `text`, `submit?` | BROW-33 | "Typed" |
| `browser_press_key` | `tab_id`, `key` | BROW-34 | "Pressed" |
| `browser_screenshot` | `tab_id`, `full_page?` | BROW-37 | an MCP image content block |
| `browser_console` | `tab_id`, `only_errors?` | BROW-38 | one line per entry |
| `browser_network` | `tab_id`, `only_failed?` | BROW-38 | one line per entry: `GET 404 /api/x 12ms` |
| `browser_wait_for` | `tab_id`, `text`, `timeout_ms?` | waits until the text appears | "Found" or "Not found" |
| `browser_tabs` | none | lists tabs | id, URL, title, one per line |
| `browser_release` | `tab_id` | ends agent control | "Released" |

Tool descriptions, exactly:

- `browser_navigate`: "Open a URL in the HSOS browser panel the user can see. Localhost is allowed; other sites may ask the user first."
- `browser_snapshot`: "Get the page's accessibility tree with element refs. Take a new snapshot after any navigation."
- `browser_click`: "Click an element by ref from the latest snapshot."
- `browser_type`: "Type into a field by ref. Set submit to press Enter after."
- `browser_press_key`: "Press a key such as Enter, Tab, Escape or Ctrl+A."
- `browser_screenshot`: "Screenshot the page."
- `browser_console`: "Recent console messages."
- `browser_network`: "Recent network requests."
- `browser_wait_for`: "Wait until text appears on the page."
- `browser_tabs`: "List open browser tabs."
- `browser_release`: "Hand the tab back to the user when done."

### Workspace group

| Tool | Input | Does |
|---|---|---|
| `hsos_open_file` | `path`, `line?` | Opens the file in a viewer without taking focus from the terminal. Paths outside the file roots fail (FILE roots). |
| `hsos_show_diff` | `path` | Opens the diff panel for the file against the last commit. |
| `hsos_reveal_in_tree` | `path` | Selects the file in the Files view. |
| `hsos_notify` | `message` (at most 200 characters) | Shows a toast in HSOS, and a Windows notification when HSOS is not focused. At most one per 30 seconds per session; more return "Skipped: too frequent". |
| `hsos_list_panels` | none | Lists open panels: type, title, and the path or URL they show. |

### Graph group

| Tool | Input | Does |
|---|---|---|
| `graph_search` | `query`, `limit?` | `graph.search`; returns label, kind and path per line |
| `graph_backlinks` | `path` | `graph.backlinks`; returns note and line context per line |
| `graph_focus` | `path` | Opens the graph view and selects that node, for the user to see |

### Review group

| Tool | Input | Does |
|---|---|---|
| `review_list_comments` | none | Returns `review.composePrompt`, so Claude can read the owner's pinned feedback when asked. It does not clear it. |

## Behaviour rules for all tools

- **MCP-10.** No tool runs a command, writes a file, sends a message outside the machine, or changes git. The tools show things to the owner, read HSOS state, or drive the browser panel under BROW rules. Writing files is Claude Code's own job, under its own permissions.
- **MCP-11.** No tool takes focus away from the terminal the owner is typing in (P-44). Panels open in the background tab of their group.
- **MCP-12.** Text results are plain text, at most 20 000 characters, cut with a final line `[truncated]`.
- **MCP-13.** Input fields are validated with their zod schema. Unknown fields are ignored.

## Tests

| Rule | Level | Given | When | Then |
|---|---|---|---|---|
| MCP-1 | integration | the server running | a request without the token | 401 |
| MCP-2 | integration | the service starts | `mcp.json` is read | it parses and names the current port and token |
| MCP-3 | integration | `groups: ['graph']` | the tool list is requested through the SDK client | only the three graph tools |
| MCP-4 | integration | `browser_click` with a stale ref | it is called through the SDK client | a result with `isError: true` and the message "Take a new snapshot." |
| MCP-10 | unit | the tool table | each tool's handler is inspected in a test with a recording fake bus | no handler calls a channel outside the allowed list: browser agent channels, `files.read`, `workspace` open requests, `graph`, `review.composePrompt`, `shell.notify` |
| MCP-11 | e2e | a focused terminal | `hsos_open_file` is called | the viewer opens and the terminal still has focus |
| MCP-12 | unit | a 50 000 character result | it is returned | 20 000 characters plus `[truncated]` |
| hsos_notify | integration | fake clock | two calls 5 seconds apart from one session | the second returns "Skipped: too frequent" |
| end to end | manual, run by the owner only, because it spends usage | Claude Code installed, a test project and a local test page | a scripted `claude -p` asks to open the page and report its heading | the browser panel shows the page and the reply contains the heading |
