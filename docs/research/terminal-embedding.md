# Terminal embedding on Windows

Ticket: "Terminal embedding on Windows". Researched 2026-11-17 in the main session.

Marks: **[V]** checked against the named source today. **[U]** from the researcher's own knowledge, not re-checked.

## Summary

1. Every modern Windows terminal host talks to the shell through ConPTY, the Windows pseudoconsole API. It needs Windows 10 1809 or later. [V]
2. For a web-based UI the proven pair is xterm.js for drawing and node-pty for the ConPTY side. VS Code uses exactly this. [V]
3. xterm.js is at 6.0.0. It has a WebGL renderer and official addons for fit, search, links, images, clipboard, serialising scrollback and Unicode graphemes. [V]
4. node-pty is at 1.1.0. It supports ConPTY only. winpty support is removed. The repo carries its own copy of ConPTY under `third_party/conpty`, which avoids bugs in the older system copy. [V]
5. node-pty is not thread safe and should run in one dedicated process. [V]
6. To let shells outlive a UI crash, run the PTYs in a separate host process and let the UI reattach. VS Code does this. [U]
7. Native options exist in Rust (alacritty_terminal, wezterm's portable-pty) but mean building the renderer by hand. Ghostty has no Windows release. [V for Ghostty having no GitHub release, U for the rest]

## Parts

| Part | Role | Status |
|---|---|---|
| ConPTY | Windows API that connects a console program to a pipe | Windows 10 1809+ [V] |
| node-pty 1.1.0 | Node binding for ConPTY | Used by VS Code, Hyper, Theia [V] |
| xterm.js 6.0.0 | Terminal emulator and renderer in the browser | Used by VS Code, Tabby, Hyper, Wave [V] |
| `@xterm/addon-webgl` | GPU drawing | Official [V] |
| `@xterm/addon-serialize` | Saves and restores screen and scrollback | Official [V] |
| `@xterm/addon-unicode-graphemes` | Correct emoji and combined character width | Official, marked experimental [V] |
| `@xterm/addon-fit`, `-search`, `-web-links`, `-image`, `-clipboard` | Resize, find, links, inline images, clipboard | Official [V] |
| portable-pty | Rust PTY crate from wezterm | For a Rust core [U] |
| alacritty_terminal | Rust terminal state machine | Warp lists Alacritty as a dependency [V] |

## What Claude Code needs from the terminal

Claude Code is a full-screen style program. It needs true colour, mouse reporting, correct resize, wide character handling, bracketed paste, fast handling of long output, and a way to enter a newline with Shift+Enter. xterm.js supports the display features [V for CJK, emoji, IME and GPU]. The Shift+Enter mapping is a key binding the host must send. [U]

## Reliability design

- **One PTY host process.** It owns every ConPTY handle. The UI process only sends input and receives output over a message channel.
- **Reattach.** The PTY host keeps a ring buffer of recent output per terminal. When a UI reloads, it asks for the buffer and redraws.
- **Flow control.** node-pty supports pause and resume (`handleFlowControl`) so a flood of output cannot freeze the UI. [V]
- **Same permission level.** Programs started by node-pty run with the same rights as the app. [V]
- **Restore after restart.** Save each terminal's working folder and serialised scrollback on exit. A restarted shell is a new process, so restored scrollback must be marked as history.

## Recommendation

- **Web-based UI (Electron or Tauri):** xterm.js 6 with the WebGL addon. With Electron, node-pty in a utility process. With Tauri, portable-pty in the Rust core.
- **Native UI:** only with a team able to build a renderer. Not suitable for this project.

## Not settled

- Throughput and latency numbers. No first-party figures were read.
- The exact node-pty option that selects the bundled ConPTY.
- Claude Code's own published terminal requirements were not re-read today.

## Sources

- https://github.com/microsoft/node-pty
- https://github.com/xtermjs/xterm.js
- https://github.com/warpdotdev/Warp
- GitHub REST API release data, 2026-11-17
