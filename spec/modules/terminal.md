# Module: terminal

## Purpose

The centre of HSOS: real terminals that run PowerShell and Claude Code correctly, never lose a running shell to a UI fault, and come back with their history after a restart.

## Interface

`contracts/channels/terminal.ts`. Reference code: `reference/ring-buffer.ts`, `reference/terminal-init.ps1`. Background: `docs/research/terminal-best-of-both.md`.

- Runs in: `pty-host` (shells), `ui` (terminal panels).
- Third-party packages allowed: `node-pty` (service only), `write-file-atomic` (service only), `@xterm/xterm` and the `@xterm/addon-*` packages in `03-stack.md` (panel only), `zod`.

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
- **TERM-2.** The shell's environment is the environment of the HSOS process, minus the variables that name another terminal, plus `TERM_PROGRAM=HSOS`, `TERM_PROGRAM_VERSION=<HSOS version>`, `HSOS_TERMINAL_ID=<id>`, `COLORTERM=truecolor`, plus `HSOS_TERMINAL_INIT=<terminalInitFile>` when `shellIntegration` is on, plus every variable set through `setExtraEnv`. The removed variables are `WT_SESSION`, `WT_PROFILE_ID`, `TERMINAL_EMULATOR`, and every name that starts with `VSCODE_`, `KITTY_`, `WEZTERM_`, `ALACRITTY_` or `GHOSTTY_`, compared without regard to case. Claude Code picks its keyboard handling by terminal, so a variable inherited from the terminal HSOS was started from must not reach it.
- **TERM-3.** If `cwd` does not exist, the shell starts in the project folder and the terminal's first line is a notice: `HSOS: folder not found, started in <project folder>`.
- **TERM-4.** If the shell cannot start, `create` returns `TERM_SPAWN_FAILED` with the system's reason. No terminal is recorded.
- **TERM-5.** When `launch` is set, that text followed by a carriage return is written to the shell 300 ms after its first output, or after 2 000 ms if there is no output.
- **TERM-6.** When a shell exits, its terminal becomes `exited` with the exit code, `exited` is emitted, and the terminal stays in the registry until `kill` is called so the panel can still show its last output.

- **TERM-7.** When the shell's file name is `pwsh.exe` or `powershell.exe` and its environment holds `HSOS_TERMINAL_INIT` or `HSOS_SHELL_INIT`, the shell is started with the configured `shellArgs` followed by `-NoExit`, `-Command` and this loader, as one argument:

  ```powershell
  foreach ($f in @($env:HSOS_TERMINAL_INIT, $env:HSOS_SHELL_INIT)) { if ($f -and (Test-Path -LiteralPath $f)) { . ([ScriptBlock]::Create([IO.File]::ReadAllText($f))) } }
  ```

  The loader reads each file as text and runs it as a script block, so it works under any execution policy, including `Restricted`, the Windows PowerShell default on a machine where no policy is set. Dot-sourcing the file by path fails under `Restricted`. For any other shell the variables are passed and nothing else changes. See LINK-3, LINK-4 and TERM-70.
- **TERM-8.** At start, `pty-host` writes `terminalInitFile` atomically with the content of `src/modules/terminal/service/terminal-init.ps1`, a copy of `spec/reference/terminal-init.ps1`, so the file always matches the running HSOS version.

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
  2. on `NOT_FOUND`, calls `takeScrollback`. If text comes back it writes that text, then the divider line `── restored from last session ──` in `color.text.muted`.
  3. asks every `terminalRecovery` contribution, in order, for an offer for the saved `terminalId`; the first non-null one is used.
  4. creates a new shell in the saved `cwd` with no `launch` and stores the new id in its state.
  5. with an offer whose `auto` is true: writes the offer's `notice` in `color.text.muted`, awaits `accepted(newId)`, then writes the offer's `launch` and `\r` to the shell after its first output, or after 2 000 ms with none (as TERM-5). With an offer whose `auto` is false: shows a one-line banner at the top of the terminal area with the offer's `label` as a button and "Not now". Pressing the button does the same as the auto case; either choice removes the banner.

  A failure of `accepted` writes `HSOS: could not resume: <reason>` in `color.state.warn` and leaves the plain shell.
- **TERM-25.** When `pty-host` itself restarts, every panel shows a one-line banner inside the terminal area: "This shell ended because the terminal service restarted." with a "Start new shell" button. The earlier output stays visible above it. When a `terminalRecovery` contribution has an offer for the panel's old terminal id, the banner also has the offer's `label` as a button, which starts the new shell and uses the offer as in TERM-24 step 5.

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
| `Shift+Enter` | sends `shiftEnterSequence`. In PowerShell this starts a new input line (TERM-45). |
| `Ctrl+C` | copies the selection when there is one, else sends `\x03` |
| `Ctrl+V`, `Ctrl+Shift+V`, `Shift+Insert` | pastes the clipboard (TERM-46) |
| `Ctrl+Shift+C` | copies the selection |
| `Ctrl+F` | opens find in terminal |
| `Ctrl+Plus`, `Ctrl+Minus`, `Ctrl+0` | changes or resets this terminal's font size |
| Right click | pastes when `rightClickPastes`, else opens the context menu |

- **TERM-42.** Closing a terminal panel whose shell `isBusy` asks "A program is still running in this terminal. Close it anyway?" when `confirmCloseWhenBusy` is on. Closing calls `kill`.
- **TERM-43.** A paste asks for confirmation first, showing the first 3 lines and the line count, when:
  - the program has not turned on bracketed paste (xterm's `modes.bracketedPasteMode` is false) and the text is longer than 5 000 characters or holds more than 20 line breaks, or
  - the program has turned on bracketed paste and the text is longer than 100 000 characters.

  Under bracketed paste the program receives the text as one block and does not run it line by line, so a long dictation into Claude Code goes straight in.
- **TERM-44.** Dropping files from the file tree or from Windows Explorer onto a terminal types their paths, each quoted when it contains a space, separated by spaces.
- **TERM-45.** Shift+Enter sends the same `shiftEnterSequence` whatever program is reading keys. With the default `ESC CR`, Claude Code inserts a newline. ConPTY reports `ESC CR` to a console program as Alt+Enter, and `terminal-init.ps1` binds Alt+Enter to PSReadLine's `AddLine`, so in PowerShell Shift+Enter opens a continuation line instead of gluing the next line onto the current one.
- **TERM-46.** Every paste, whether from a key in TERM-41, a right click (TERM-41) or the context menu, takes this one path:
  1. The paste keys are handled in xterm's custom key handler, which returns `false` for them without calling `preventDefault`. xterm then never encodes them as key sequences, and the browser performs its own paste on the focused terminal. This holds whatever keyboard protocol a later xterm version supports.
  2. The panel listens for the `paste` event in the capture phase on the terminal element, reads `clipboardData.getData('text/plain')` once, and calls `preventDefault` and `stopPropagation` so xterm's own handler never sees the event. A right click or the context menu, which fire no `paste` event, read the clipboard once with `navigator.clipboard.readText()`.
  3. An empty text does nothing.
  4. When bracketed paste is off, trailing spaces, tabs and line breaks are removed, so a copied command with a final line break does not run on its own.
  5. TERM-43 is checked against the result.
  6. The text is written with xterm's `paste`, which converts line breaks to `\r` and adds the bracketed paste markers when the program asked for them.

  The clipboard is read exactly once per paste, during the key press. Dictation apps such as Wispr Flow put their text on the clipboard, press a paste key, and put the previous clipboard back shortly after the first read, so a second read would get the wrong text.
- **TERM-47.** Key presses sent by another program through Windows (`SendInput`), as dictation and automation apps do, are handled exactly like the owner's own key presses. HSOS never ignores an event because it is synthetic, never rate-limits input, and never moves focus away from a focused terminal while it is receiving input (P-44).
- **TERM-48.** When the HSOS process runs elevated, the first terminal panel to mount shows a one-line notice inside the terminal area: "HSOS is running as administrator. Dictation apps and drag and drop from Explorer cannot reach it unless they run as administrator too." with a close button. It shows once per app run. `pty-host` reports elevation through `hostInfo`, found once at start by running `whoami /groups` with a 2 000 ms timeout and looking for the SID `S-1-16-12288` (high integrity). A timeout counts as not elevated.
- **TERM-74.** `pty-host` keeps, per terminal, the time of the last `write` whose `source` is `owner` (the default). Keys, pastes, drops, compositions and every module that types for the owner (HUD-31, HUD-54, SESS-32) are `owner` writes. Only the HUD quick bar writes with `source: 'quick-command'`, and only for a command it submits with `\r` (HUD-63). `getLastOwnerInput` returns that time, or null when there was none.
- **TERM-49.** Text committed by an input method or by Windows voice typing (`Win+H`) arrives as a composition. When the composition ends, the committed text is written once, as typed text. Text shown during the composition is never written.

### View

- **TERM-75.** A terminal panel has a header slot above its rows, filled through the extension point `terminalHeader`. A contribution's `render(terminalId)` returns content or null; the first non-null one is drawn. The header's height comes from the content; when it changes, the terminal is resized (TERM-31 path) so the header never covers a row. The terminal module knows nothing about what the header shows.
- **TERM-76.** The terminal itself is slightly see-through instead of plain black: its background is `color.term.background` at the opacity of `surface.terminal.alpha` (UI-31), drawn by xterm with `allowTransparency`, and the animated background (UI-30) runs on the layer behind it and shows through that tint. Nothing is ever drawn in front of the terminal's text. Text, cursor and selection colours stay fully opaque, and terminal text never animates (MOT-10).

- **TERM-50.** On each workspace save and at stop, the panel serialises its scrollback with the serialize addon and sends `storeScrollback`. `pty-host` writes it to `terminalRestoreFile` atomically.
- **TERM-51.** xterm is created with the font, cursor and scrollback settings and a colour theme built from the `color.term.*` tokens. A settings or theme change is applied to open terminals at once, without restarting shells.
- **TERM-52.** The WebGL renderer is used when `useWebgl` is on. If the WebGL context is lost or cannot start, the panel falls back to xterm's default renderer and logs a warning. The terminal keeps working.
- **TERM-53.** The view is fitted to its panel on mount and on every panel resize, debounced 50 ms, followed by `resize`.
- **TERM-54.** A hidden terminal (a background tab) keeps receiving and buffering output. It is fitted when it becomes visible.
- **TERM-55.** URLs in output are links. Ctrl+click opens `https:` and `http://localhost` URLs in a browser panel when the `browser` module is present, otherwise through `shell.openExternal`. File paths with a line number, such as `src\a.ts:12`, open in the file viewer at that line.
- **TERM-56.** The tab title is the program title reported by the shell, else the shell's file name. A worktree terminal shows the worktree name as a badge before the title.
- **TERM-57.** An exited terminal shows `[process exited with code N]` and a "Restart" button that starts a new shell in the panel's `cwd` (TERM-73). When a `terminalRecovery` contribution has an offer for that terminal, a second button with the offer's `label` restarts the shell and uses the offer as in TERM-24 step 5.

### Projects

- **TERM-60.** With `keepShellsAcrossProjects` on, opening another project leaves the previous project's shells running in `pty-host`. Returning to that project reattaches to them. With it off, they are killed when the project closes.
- **TERM-61.** When the app stops, every shell is killed after scrollback is stored (TERM-50).

### Shell integration

- **TERM-70.** With `shellIntegration` on, PowerShell shells load `terminal-init.ps1` (TERM-7, TERM-8). It does three things and nothing else:
  - binds Alt+Enter to `AddLine` (TERM-45);
  - wraps the prompt so each prompt prints `OSC 133;D;<0|1>` when a command ran before it (0 for success, 1 for failure), then `OSC 133;A`, then `OSC 7;file:///<folder>`, then the owner's own prompt text, then `OSC 133;B`;
  - wraps PSReadLine's line reader so `OSC 133;C` is printed when a command line is accepted.

  The script chains to the owner's prompt, keeps `$LASTEXITCODE`, and loads once per shell. With `shellIntegration` off, `HSOS_TERMINAL_INIT` is not set and none of this happens.
- **TERM-71.** The panel registers xterm OSC handlers for 133 and 7. They are read in the panel only, as data (P-6); `pty-host` still never inspects output (TERM-12). For each terminal the panel keeps:
  - an xterm marker at the line of every `133;A`, the last 1 000 of them;
  - a state, `prompt` from `133;B` until `133;C`, `running` from `133;C` until the next `133;A`, `unknown` before the first mark.
- **TERM-72.** With the state `prompt`, `Ctrl+Up` scrolls the view so the previous prompt marker above the top visible line is the top line, and `Ctrl+Down` does the same for the next marker below it, or to the bottom when there is none. Nothing is written to the shell. In any other state the keys go to the program as usual, so Claude Code and other programs keep them.
- **TERM-73.** An `OSC 7` whose text is a `file:///` URI of an absolute Windows path updates the panel's `cwd` state to that path, decoded. Any other `OSC 7` is ignored. The saved `cwd` is what TERM-24 restores into and what "Restart" (TERM-57) starts in, so a terminal comes back in the folder it was last in, not the one it was opened in.

## Commands

| Id | Title | Default key |
|---|---|---|
| `terminal.new` | New Terminal | `Ctrl+Shift+T` |
| `terminal.focus` | Focus Terminal | `` Ctrl+` `` (global) |
| `terminal.newClaude` | New Claude Session | `Ctrl+Shift+A` |
| `terminal.clear` | Clear Terminal | `Ctrl+K Ctrl+L` |
| `terminal.find` | Find in Terminal | `Ctrl+F` when a terminal has focus |
| `terminal.restart` | Restart Shell | none |
| `terminal.previousCommand` | Go to Previous Command | `Ctrl+Up` when a terminal at a prompt has focus (TERM-72) |
| `terminal.nextCommand` | Go to Next Command | `Ctrl+Down` when a terminal at a prompt has focus (TERM-72) |

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
| TERM-2 | integration | the HSOS process env holds `WT_SESSION`, `vscode_ipc_hook_cli` and `PATH` | `create` | the spawn env has `PATH` and neither of the other two |
| TERM-2 | integration | `shellIntegration` off | `create` | the spawn env has no `HSOS_TERMINAL_INIT` |
| TERM-3 | integration | a `cwd` that does not exist | `create` | the shell starts in the project folder and the first data event holds the notice |
| TERM-4 | integration | a factory that throws on spawn | `create` | `TERM_SPAWN_FAILED`; `list` is empty |
| TERM-5 | integration | `launch: 'claude'`, fake clock, the fake emits output | 300 ms pass | `claude\r` was written once |
| TERM-6 | integration | a running terminal | the fake exits with code 3 | `exited` is emitted with 3; `list` shows state `exited` |
| TERM-7 | integration | `shellIntegration` on, shell `powershell.exe` | `create` | the spawn args are `shellArgs`, then `-NoExit`, `-Command` and the loader text of TERM-7 |
| TERM-7 | integration | `shellIntegration` off, extra env with `HSOS_SHELL_INIT`, shell `pwsh.exe` | `create` | the spawn args end with `-NoExit`, `-Command` and the loader text |
| TERM-7 | integration | `shellIntegration` off, no `HSOS_SHELL_INIT`, shell `pwsh.exe` | `create` | the spawn args equal `shellArgs` |
| TERM-7 | integration | `shellIntegration` on, shell `cmd.exe` | `create` | the spawn args equal `shellArgs` |
| TERM-7 | e2e | the HSOS process started with `PSExecutionPolicyPreference=Restricted`, shell `powershell.exe` | a new terminal reaches its prompt | the panel's prompt state is `prompt` and no `running scripts is disabled` text appears |
| TERM-8 | integration | a temp `localRoot` | `pty-host` starts | `terminalInitFile` equals the bundled `terminal-init.ps1` byte for byte |
| TERM-10 | integration | fake clock | the fake emits 10 chunks within 5 ms | one `data` event is emitted after 8 ms holding all bytes in order |
| TERM-10 | integration | fake clock | the fake emits 70 000 bytes at once | a `data` event is emitted without waiting 8 ms |
| TERM-11 | integration | a terminal | three batches are emitted | their `seq` values are 1, 2, 3 |
| TERM-21 | integration | a terminal that emitted "hello" in batch 1 | `attach` | `replay` decodes to "hello" and `lastSeq` is 1 |
| TERM-21 | component | a panel attached with `lastSeq` 5 | data events with seq 4, 5, 6 arrive | only seq 6 is written to the view |
| TERM-22 | unit | covered by the reference self-check | | |
| TERM-24 | component | saved `terminalId` unknown to the service; stored scrollback "old" | the panel mounts | the view shows "old", then the divider, and a new terminal id is saved |
| TERM-24 | component | saved `terminalId` unknown; a recovery contribution returns an offer with `auto: true` and launch `claude --resume x` | the panel mounts and the new shell prints a prompt | the notice is shown; `accepted` was called with the new id before `claude --resume x\r` was written |
| TERM-24 | component | the same offer with `auto: false` | the panel mounts | the banner shows the label; nothing is written until the button is pressed |
| TERM-25 | component | a recovery offer for the old id | `pty-host` restarts | the banner has "Start new shell" and the offer's label |
| TERM-57 | component | an exited terminal and a recovery offer | it renders | "Restart" and the offer's label both show |
| TERM-31 | integration | an attached terminal | 1 000 001 bytes are emitted with no ack | the fake is paused; after acks bring the gap to 250 000 it is resumed |
| TERM-32 | integration | a terminal with no attach | 5 MB are emitted | the fake is never paused |
| TERM-33 | integration | two attached terminals, the first paused | the second emits output | its `data` events arrive |
| TERM-74 | integration | fake clock; a terminal | `write` of `a` at 10:00, `write` of `/model opus\r` with `source: 'quick-command'` at 10:01 | `getLastOwnerInput` returns 10:00 |
| TERM-75 | component | a contribution that returns a 28 px header for `t1`, then a 64 px one | the panel renders | the terminal's rows shrink to fit each time and no row is hidden under the header |
| TERM-75 | component | two contributions, the first returning null | the panel renders | the second one's header shows |
| TERM-76 | component | `surface.terminal.alpha: 0.9` | the terminal renders | xterm was created with `allowTransparency: true` and a background with alpha 0.9 |
| TERM-41 | component | text is selected | `Ctrl+C` | the clipboard holds the text and nothing is written to the shell |
| TERM-41 | component | nothing is selected | `Ctrl+C` | `\x03` is written |
| TERM-41 | component | default settings | `Shift+Enter` | `\x1b\r` is written |
| TERM-41 | component | a focused terminal | `Ctrl+V`, `Ctrl+Shift+V` and `Shift+Insert` keydowns, one at a time | the custom key handler returns `false` for each, `preventDefault` is not called, and nothing is written |
| TERM-43 | component | bracketed paste off, a 30-line clipboard | paste | a confirmation shows; nothing is written until confirmed |
| TERM-43 | component | bracketed paste on, a 30-line clipboard of 6 000 characters | paste | no confirmation; the text is written at once between `\x1b[200~` and `\x1b[201~` |
| TERM-43 | component | bracketed paste on, 150 000 characters | paste | a confirmation shows |
| TERM-45 | e2e | a `powershell.exe` terminal at its prompt | type `echo one`, `Shift+Enter`, `echo two`, `Enter` | the output has `one` and `two` on separate lines and no `oneecho` |
| TERM-46 | component | bracketed paste off | a `paste` event whose text is `dir\r\n` | `dir` is written; `getData` was called once; xterm's own paste handler did not run |
| TERM-46 | component | bracketed paste on | a `paste` event whose text is `hello ` | `\x1b[200~hello \x1b[201~` is written |
| TERM-46 | component | any | a `paste` event with empty text | nothing is written |
| TERM-46 | component | `rightClickPastes` on, clipboard `abc` | right click | `readText` was called once and `abc` is written |
| TERM-46, TERM-47 | e2e | a focused `powershell.exe` terminal running `$x = Read-Host; $x.Length` | a helper process sets the clipboard to a 20 000-character line, sends `Shift+Insert` with `SendInput`, then sets the clipboard to `old` 500 ms later | the terminal prints `20000` |
| TERM-46, TERM-47 | e2e | a focused `powershell.exe` terminal at its prompt | a helper process sets the clipboard to `echo dictated-123`, sends `Ctrl+V` with `SendInput`, then `Enter` | `dictated-123` appears on its own line |
| TERM-47 | manual | a Claude Code session in an HSOS terminal, Wispr Flow running at the same privilege level | the owner dictates a sentence | the sentence appears in Claude Code's prompt without a copy and paste |
| TERM-48 | component | `hostInfo` returns `elevated: true` | two terminal panels mount | the notice shows in the first panel only |
| TERM-48 | integration | a fake runner whose `whoami /groups` output holds `S-1-16-12288` | `hostInfo` | `elevated` is true; with output lacking it, false; on timeout, false |
| TERM-49 | component | a focused terminal | `compositionstart`, two `compositionupdate`s, then `compositionend` with `héllo` | `héllo` is written once and nothing else is written |
| TERM-44 | component | a drop of `C:\a b\c.txt` and `C:\d.txt` | drop | `"C:\a b\c.txt" C:\d.txt` is written |
| TERM-52 | component | WebGL creation throws | the panel mounts | the terminal renders and a warning is logged |
| TERM-1 | e2e | a project is open | a new terminal runs `echo hsos-ok` | the text `hsos-ok` appears in the terminal |
| TERM-23, REL-1 | fault | a terminal running a loop that prints a counter | the renderer is killed and reloads | the terminal shows earlier lines and the counter keeps rising |
| TERM-25, REL-4 | fault | two terminals | `pty-host` is killed | both show the banner; "Start new shell" gives a working shell |
| TERM-50, TERM-24 | e2e | a terminal that printed `marker-123` | the app is closed and reopened | `marker-123` is visible above the divider |
| TERM-60 | e2e | project A with a terminal printing a counter | project B is opened, then A again | the counter in A has advanced |
| TERM-70 | e2e | a `powershell.exe` terminal with `shellIntegration` on | run `cmd /c exit 3`, then `$LASTEXITCODE`, then `cd "C:\Program Files"` | the output stream holds `OSC 133;C`, `OSC 133;D;1`, then later `OSC 7;file:///C:/Program%20Files`; the second command prints `3` |
| TERM-71 | component | data holding `OSC 133;A`, then `OSC 133;B` | written to the view | the state is `prompt` and one marker exists; after `OSC 133;C` the state is `running` |
| TERM-72 | component | three prompts in scrollback, state `prompt`, view at the bottom | `Ctrl+Up` twice | the second prompt line is the top line; nothing was written |
| TERM-72 | component | state `running` | `Ctrl+Up` | `\x1b[1;5A` is written |
| TERM-73 | component | a panel with `cwd` `C:\a` | data holding `OSC 7;file:///C:/Program%20Files` | the panel state `cwd` is `C:\Program Files` |
| TERM-73 | component | a panel with `cwd` `C:\a` | `OSC 7;file://server/share/x`, then `OSC 7;relative` | `cwd` is still `C:\a` |
