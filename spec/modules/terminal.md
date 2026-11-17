# Module: terminal

## Purpose

The centre of HSOS: real terminals that run PowerShell and Claude Code correctly, never lose a running shell to a UI fault, and come back with their history after a restart.

## Interface

`contracts/channels/terminal.ts`. Reference code: `reference/ring-buffer.ts`.

- Runs in: `pty-host` (shells), `ui` (terminal panels).
- Third-party packages allowed: `node-pty` (service only), `@xterm/xterm` and the `@xterm/addon-*` packages in `03-stack.md` (panel only), `zod`.

## Parts

| Part | Where | Does |
|---|---|---|
| Terminal registry | `pty-host` | Owns every shell: create, write, resize, kill, list |
| Output pump | `pty-host` | Batches output, numbers it, keeps the replay buffer, applies flow control |
| Scrollback store | `pty-host` | Saves and returns serialised scrollback files |
| Terminal panel | `ui` | An xterm view bound to one terminal id |

`pty-host` talks to ConPTY only through `PtyFactory`. The real implementation wraps `node-pty`; tests use `FakePty`.

## Behaviour

### Creating shells

- **TERM-1.** `create` starts the shell from settings (`shellPath`, `shellArgs`) in `cwd` with the given size and returns `TerminalInfo`. With `shellPath` empty, it uses `pwsh.exe` when that is found on `PATH`, else `powershell.exe`.
- **TERM-2.** The shell's environment is the environment of the HSOS process, plus `TERM_PROGRAM=HSOS`, `HSOS_TERMINAL_ID=<id>`, `COLORTERM=truecolor`, plus every variable set through `setExtraEnv`.
- **TERM-3.** If `cwd` does not exist, the shell starts in the project folder and the terminal's first line is a notice: `HSOS: folder not found, started in <project folder>`.
- **TERM-4.** If the shell cannot start, `create` returns `TERM_SPAWN_FAILED` with the system's reason. No terminal is recorded.
- **TERM-5.** When `launch` is set, that text followed by a carriage return is written to the shell 300 ms after its first output, or after 2 000 ms if there is no output.
- **TERM-6.** When a shell exits, its terminal becomes `exited` with the exit code, `exited` is emitted, and the terminal stays in the registry until `kill` is called so the panel can still show its last output.

### Output

- **TERM-10.** Output from a shell is collected and emitted as one `data` event at most every 8 ms, or sooner when 65 536 bytes are waiting.
- **TERM-11.** Each `data` event of a terminal carries `seq`, starting at 1 and rising by 1.
- **TERM-12.** Output is forwarded as raw bytes. `pty-host` never decodes, inspects or changes it (P-6).

### Reattach

- **TERM-20.** `pty-host` keeps the last `replayBufferBytes` of each terminal's output in a `RingBuffer`.
- **TERM-21.** `attach` returns the terminal's info, a snapshot of the buffer, and the `seq` of the last chunk in it. The panel writes the replay into a fresh xterm, then applies only `data` events with a higher `seq`.
- **TERM-22.** The replay never starts inside an escape sequence or a character: when the buffer has wrapped, the snapshot begins after its first line feed (see the reference code).
- **TERM-23.** After writing a replay, the panel resizes the terminal to one row fewer and then back to the true size, 50 ms apart. A full-screen program such as Claude Code redraws itself in response.
- **TERM-24.** A panel that mounts with a saved `terminalId`:
  1. calls `attach`. On success it follows TERM-21 and TERM-23.
  2. on `NOT_FOUND`, calls `takeScrollback`. If text comes back it writes that text, then the divider line `── restored from last session ──` in `color.text.muted`, then creates a new shell in the saved `cwd` and stores the new id in its state.
  3. with no scrollback, it creates a new shell in the saved `cwd`.
- **TERM-25.** When `pty-host` itself restarts, every panel shows a one-line banner inside the terminal area: "This shell ended because the terminal service restarted." with a "Start new shell" button. The earlier output stays visible above it.

### Flow control

- **TERM-30.** The panel writes each `data` chunk to xterm and, from xterm's write callback, counts the bytes drawn. It sends `ack` each time 100 000 more bytes are drawn.
- **TERM-31.** `pty-host` tracks bytes sent minus bytes acknowledged per terminal. Above 1 000 000 it pauses that shell's output. At or below 250 000 it resumes.
- **TERM-32.** A terminal with no attached panel is never paused. Its output goes only to the replay buffer.
- **TERM-33.** Flow control for one terminal never delays another terminal.

### Input

- **TERM-40.** Keys typed in a focused terminal are sent with `write`, except global key bindings (UI-21).
- **TERM-41.** Special keys:

| Key | Action |
|---|---|
| `Shift+Enter` | sends `shiftEnterSequence` |
| `Ctrl+C` | copies the selection when there is one, else sends `\x03` |
| `Ctrl+V`, `Ctrl+Shift+V`, `Shift+Insert` | pastes the clipboard through xterm's paste, which applies bracketed paste when the program asked for it |
| `Ctrl+Shift+C` | copies the selection |
| `Ctrl+F` | opens find in terminal |
| `Ctrl+Plus`, `Ctrl+Minus`, `Ctrl+0` | changes or resets this terminal's font size |
| Right click | pastes when `rightClickPastes`, else opens the context menu |

- **TERM-42.** Closing a terminal panel whose shell `isBusy` asks "A program is still running in this terminal. Close it anyway?" when `confirmCloseWhenBusy` is on. Closing calls `kill`.
- **TERM-43.** A paste longer than 5 000 characters or containing more than 20 line breaks asks for confirmation first, showing the first 3 lines and the line count.
- **TERM-44.** Dropping files from the file tree or from Windows Explorer onto a terminal types their paths, each quoted when it contains a space, separated by spaces.

### View

- **TERM-50.** On each workspace save and at stop, the panel serialises its scrollback with the serialize addon and sends `storeScrollback`. `pty-host` writes it to `terminalRestoreFile` atomically.
- **TERM-51.** xterm is created with the font, cursor and scrollback settings and a colour theme built from the `color.term.*` tokens. A settings or theme change is applied to open terminals at once, without restarting shells.
- **TERM-52.** The WebGL renderer is used when `useWebgl` is on. If the WebGL context is lost or cannot start, the panel falls back to xterm's default renderer and logs a warning. The terminal keeps working.
- **TERM-53.** The view is fitted to its panel on mount and on every panel resize, debounced 50 ms, followed by `resize`.
- **TERM-54.** A hidden terminal (a background tab) keeps receiving and buffering output. It is fitted when it becomes visible.
- **TERM-55.** URLs in output are links. Ctrl+click opens `https:` and `http://localhost` URLs in a browser panel when the `browser` module is present, otherwise through `shell.openExternal`. File paths with a line number, such as `src\a.ts:12`, open in the file viewer at that line.
- **TERM-56.** The tab title is the program title reported by the shell, else the shell's file name. A worktree terminal shows the worktree name as a badge before the title.
- **TERM-57.** An exited terminal shows `[process exited with code N]` and a "Restart" button that starts a new shell in the same folder.

### Projects

- **TERM-60.** With `keepShellsAcrossProjects` on, opening another project leaves the previous project's shells running in `pty-host`. Returning to that project reattaches to them. With it off, they are killed when the project closes.
- **TERM-61.** When the app stops, every shell is killed after scrollback is stored (TERM-50).

## Commands

| Id | Title | Default key |
|---|---|---|
| `terminal.new` | New Terminal | `Ctrl+Shift+T` |
| `terminal.focus` | Focus Terminal | `` Ctrl+` `` (global) |
| `terminal.newClaude` | New Claude Session | `Ctrl+Shift+A` |
| `terminal.clear` | Clear Terminal | `Ctrl+K Ctrl+L` |
| `terminal.find` | Find in Terminal | `Ctrl+F` when a terminal has focus |
| `terminal.restart` | Restart Shell | none |

`terminal.newClaude` creates a terminal with `launch: "claude"`. `terminal.focus` focuses the most recently focused terminal, creating one if none exists.

## Panel

Type `terminal.shell`, kind `dock`, `allowMultiple: true`.

```ts
type TerminalPanelState = {
  terminalId: TerminalId | null;
  cwd: AbsPath;
  worktree: string | null;
  launch: string | null;
  fontSizeDelta: number;
};
```

| State | Shows |
|---|---|
| Loading | The terminal background with a muted "Starting shell…" after 150 ms |
| Ready | The terminal |
| Exited | Last output, the exit line and "Restart" |
| Error | "The shell could not start" with the system reason, "Retry", and "Terminal settings" |

There is no empty state: a terminal panel always has or is starting a shell.

## Tests

`FakePty` stands in for ConPTY in all levels except e2e and fault.

| Rule | Level | Given | When | Then |
|---|---|---|---|---|
| TERM-2 | integration | `setExtraEnv({ A: '1' })` was called | `create` | the spawn options' env has `A`, `TERM_PROGRAM` and `HSOS_TERMINAL_ID` |
| TERM-3 | integration | a `cwd` that does not exist | `create` | the shell starts in the project folder and the first data event holds the notice |
| TERM-4 | integration | a factory that throws on spawn | `create` | `TERM_SPAWN_FAILED`; `list` is empty |
| TERM-5 | integration | `launch: 'claude'`, fake clock, the fake emits output | 300 ms pass | `claude\r` was written once |
| TERM-6 | integration | a running terminal | the fake exits with code 3 | `exited` is emitted with 3; `list` shows state `exited` |
| TERM-10 | integration | fake clock | the fake emits 10 chunks within 5 ms | one `data` event is emitted after 8 ms holding all bytes in order |
| TERM-10 | integration | fake clock | the fake emits 70 000 bytes at once | a `data` event is emitted without waiting 8 ms |
| TERM-11 | integration | a terminal | three batches are emitted | their `seq` values are 1, 2, 3 |
| TERM-21 | integration | a terminal that emitted "hello" in batch 1 | `attach` | `replay` decodes to "hello" and `lastSeq` is 1 |
| TERM-21 | component | a panel attached with `lastSeq` 5 | data events with seq 4, 5, 6 arrive | only seq 6 is written to the view |
| TERM-22 | unit | covered by the reference self-check | | |
| TERM-24 | component | saved `terminalId` unknown to the service; stored scrollback "old" | the panel mounts | the view shows "old", then the divider, and a new terminal id is saved |
| TERM-31 | integration | an attached terminal | 1 000 001 bytes are emitted with no ack | the fake is paused; after acks bring the gap to 250 000 it is resumed |
| TERM-32 | integration | a terminal with no attach | 5 MB are emitted | the fake is never paused |
| TERM-33 | integration | two attached terminals, the first paused | the second emits output | its `data` events arrive |
| TERM-41 | component | text is selected | `Ctrl+C` | the clipboard holds the text and nothing is written to the shell |
| TERM-41 | component | nothing is selected | `Ctrl+C` | `\x03` is written |
| TERM-41 | component | default settings | `Shift+Enter` | `\x1b\r` is written |
| TERM-43 | component | a 30-line clipboard | paste | a confirmation shows; nothing is written until confirmed |
| TERM-44 | component | a drop of `C:\a b\c.txt` and `C:\d.txt` | drop | `"C:\a b\c.txt" C:\d.txt` is written |
| TERM-52 | component | WebGL creation throws | the panel mounts | the terminal renders and a warning is logged |
| TERM-1 | e2e | a project is open | a new terminal runs `echo hsos-ok` | the text `hsos-ok` appears in the terminal |
| TERM-23, REL-1 | fault | a terminal running a loop that prints a counter | the renderer is killed and reloads | the terminal shows earlier lines and the counter keeps rising |
| TERM-25, REL-4 | fault | two terminals | `pty-host` is killed | both show the banner; "Start new shell" gives a working shell |
| TERM-50, TERM-24 | e2e | a terminal that printed `marker-123` | the app is closed and reopened | `marker-123` is visible above the divider |
| TERM-60 | e2e | project A with a terminal printing a counter | project B is opened, then A again | the counter in A has advanced |
