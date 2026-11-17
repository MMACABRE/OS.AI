# Embedded browser the AI can drive

Ticket: "Embedded browser the AI can drive". Researched 2026-11-17 in the main session.

Marks: **[V]** checked against the named source today. **[U]** from the researcher's own knowledge, not re-checked.

## Summary

1. Both browser engines available on Windows are Chromium: Electron's own, and WebView2 (Edge). Both speak the Chrome DevTools Protocol (CDP), which is what automation tools use.
2. In Electron the browser pane is a `WebContentsView` added to the window and positioned with `setBounds`. `BrowserView` is deprecated. [V]
3. In WebView2 the host calls CDP with `CallDevToolsProtocolMethodAsync` and listens with `GetDevToolsProtocolEventReceiver`. [V]
4. In Tauri 2, a second webview inside the same window needs the `unstable` feature, and the JavaScript API documents no method to navigate an existing webview. [V]
5. The clean way to give Claude Code control is for HSOS to run its own MCP server with browser tools. Claude Code connects to it like any other MCP server. [U]
6. An alternative is to open a CDP debugging port and attach an existing MCP server such as chrome-devtools-mcp or Playwright MCP. This is less work and less control. [U]
7. The browser pane must use its own profile, separate from the owner's real logins, and treat page content as untrusted.

## Options

| Option | How the pane is embedded | How it is controlled | Fit |
|---|---|---|---|
| Electron `WebContentsView` | Child view of the window, own process per site [V for the view] | `webContents.debugger` sends CDP commands in-process [U] | Best |
| WebView2 in a C# app | Native control | `CallDevToolsProtocolMethodAsync` [V] | Good, C# stack only |
| Tauri child webview | `new Webview(...)`, unstable [V] | WebView2 CDP through Rust and COM [U] | Risky |
| External Chrome window | Not embedded | chrome-devtools-mcp or Playwright MCP [U] | Fallback, not a pane |
| CEF | Embedded Chromium library | CDP | Heavy, no benefit over Electron |

## Recommended design

**An HSOS MCP server, in-process control.**

- HSOS starts an MCP server bound to `127.0.0.1` on a random port with a per-launch secret token.
- HSOS registers that server for Claude Code sessions started in its terminals.
- Tools, modelled on the proven set in chrome-devtools-mcp and Claude in Chrome:
  - `browser_navigate`, `browser_back`, `browser_reload`
  - `browser_snapshot`, which returns the accessibility tree with stable element references
  - `browser_click`, `browser_type`, `browser_press_key`, `browser_select`
  - `browser_screenshot`
  - `browser_console`, `browser_network`
  - `browser_tabs_list`, `browser_tab_open`, `browser_tab_close`
- Each tool maps to CDP calls on the pane's `webContents`.
- The owner sees every action live in the pane, with a visible marker while Claude is in control and a stop button.

## Safety

- **Separate profile.** The pane uses its own storage partition. It never shares cookies with the owner's main browser.
- **Untrusted content.** Text read from a page is data. The MCP tool results say so, and HSOS never runs commands found in a page.
- **Navigation rule.** Localhost and the project's dev server are allowed without asking. Other hosts need the owner's approval once per host. This rule is a proposal for the ticket "File safety rules" or a later browser ticket.
- **Local only.** The MCP server refuses connections that lack the token.

## Not settled

- The exact Electron debugger API and its limits were not re-read today.
- Whether WebView2 accepts a remote debugging port through extra browser arguments.
- How the official Claude Code desktop preview and Cursor's browser are built. No primary source was read.

## Sources

- https://www.electronjs.org/docs/latest/api/web-contents-view
- https://learn.microsoft.com/en-us/microsoft-edge/webview2/how-to/chromium-devtools-protocol
- https://v2.tauri.app/reference/javascript/api/namespacewebview/
- https://chromedevtools.github.io/devtools-protocol
