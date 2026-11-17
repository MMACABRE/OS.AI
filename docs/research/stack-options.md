# Stack options for a Windows exe

Ticket: "Stack options for a Windows exe". Researched 2026-11-17 in the main session.

Marks: **[V]** checked against the named source today. **[U]** from the researcher's own knowledge, not re-checked.

## Summary

1. Two stacks can carry all seven HSOS parts today: Electron and Tauri 2. Both draw the UI with web technology.
2. Electron ranks first. The terminal (xterm.js with node-pty), the browser pane (a real Chromium view) and the UI all use one language, TypeScript, and VS Code, Wave and Tabby prove the combination on Windows.
3. Tauri 2 ranks second. It is lighter, and its Rust core is strict. It needs two languages, and placing several webviews in one window is still behind an `unstable` flag. [V]
4. C# with WinUI 3 or WPF plus WebView2 ranks third. WebView2 gives first-class DevTools Protocol access [V], but there is no mature native terminal control, so the terminal would still be xterm.js inside a webview.
5. Native Rust GUI (gpui, iced, egui) and Flutter are ruled out. Neither has an embeddable browser or a finished terminal widget on Windows, and a weak model would have to build both.
6. A weak implementer does best in TypeScript with strict types. One language across the whole app removes a class of cross-language mistakes.
7. The main cost of Electron is memory. For a personal tool on one machine that cost is acceptable.

## Comparison

| | Electron 45 | Tauri 2.12 | WinUI 3 / WPF + WebView2 | Native Rust GUI | Flutter |
|---|---|---|---|---|---|
| Current version | v45.3.3, 2026-11-14 [V] | tauri-cli 2.12.5, 2026-11-16 [V] | WinUI 3 release 2026-11-11 [V] | iced 0.14, egui 0.37 [V] | active [V] |
| Languages | TypeScript only | Rust and TypeScript | C# and TypeScript for the terminal | Rust | Dart |
| Terminal | xterm.js + node-pty, same as VS Code [V] | xterm.js + a Rust PTY crate [U] | xterm.js in WebView2 [U] | build from alacritty_terminal [U] | none mature [U] |
| Browser pane | `WebContentsView`, a real Chromium view per pane [V] | WebView2 child webview, `unstable` flag [V] | WebView2 control, stable [V] | none | weak on Windows [U] |
| AI control of browser | DevTools Protocol through `webContents.debugger` or a debugging port [U] | WebView2 CDP through Rust COM calls [U] | `CallDevToolsProtocolMethodAsync` [V] | none | none |
| Crash isolation | Separate processes for main, renderer, utility processes and each web view [U] | Core process plus webview processes [V] | Webview processes separate, UI in app process [U] | single process | single process |
| Memory and startup | Highest memory, slower start [U] | Lower, uses system WebView2 [U] | Low to medium [U] | Lowest [U] | Medium [U] |
| Visual ceiling | Full CSS, WebGL, any web animation library | Same as Electron | XAML for chrome, web for content | High with great effort | Medium |
| Weak-model fit | Best. Largest training corpus, one language | Medium. Rust compiler catches errors but is hard to satisfy | Medium | Poor | Poor |
| Proof on Windows | VS Code, Wave, Tabby, Crystal [V] | GitButler, opcode [V] | Windows Terminal is C++ [V] | Zed, Warp, each with a custom framework [V] | few |
| Packaging | electron-builder, NSIS or portable exe [U] | NSIS or MSI built in [V] | MSIX or unpackaged [U] | cargo plus installer | built in |

## Ranked recommendation

1. **Electron + TypeScript + React.** Split into four process kinds: a small main process that supervises, a PTY host utility process, one renderer for the UI, and one `WebContentsView` per browser pane.
   - Main risk: memory use and frequent Electron major versions. Mitigation: pin the version, upgrade on a schedule, measure memory in tests.
2. **Tauri 2 + Rust + TypeScript.**
   - Main risk: the browser pane depends on an unstable API, and a Haiku-class implementer writing async Rust, COM calls for WebView2 and a PTY bridge is likely to stall.

The choice is the owner's and belongs to the ticket "Choose the stack".

## Open points this research did not settle

- Measured memory and startup numbers for each stack on Windows 11. No first-party benchmark was read.
- Whether Tauri plans to stabilise multi-webview soon.
- The exact Electron API for the DevTools Protocol was not re-read today.

## Sources

- GitHub REST API release data, 2026-11-17
- https://v2.tauri.app/concept/process-model/
- https://v2.tauri.app/reference/javascript/api/namespacewebview/
- https://www.electronjs.org/docs/latest/api/web-contents-view
- https://learn.microsoft.com/en-us/microsoft-edge/webview2/how-to/chromium-devtools-protocol
- https://github.com/xtermjs/xterm.js
- https://github.com/microsoft/node-pty
