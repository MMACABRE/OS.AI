# Terminal: the best of Windows Terminal and the VS Code terminal

Asked by the owner on 2026-11-18. Researched the same day by the spec author, in the main session.

Marks: **[V]** checked today against the named source, or run on this machine. **[U]** not re-checked.

## The owner's two observations

1. In the VS Code terminal, Shift+Enter starts a new line in Claude Code. In Windows Terminal it did not.
2. Wispr Flow dictation lands in Windows Terminal on its own. In the VS Code terminal it does not, so the owner copies and pastes every dictation by hand.

HSOS must do both, and take whatever else each terminal does better.

## Finding 1: why Shift+Enter differs

- A terminal has to send Claude Code something that is different from plain Enter. Claude Code's docs list the terminals where Shift+Enter works with no setup: Ghostty, Kitty, iTerm2, WezTerm, Warp and Windows Terminal 1.25 or later. VS Code needs `/terminal-setup` once. Windows Terminal before 1.25 cannot do it. [V, Claude Code terminal-config docs]
- Windows Terminal 1.25 (stable on 2026-10-02) gained the kitty keyboard protocol, which reports modifiers such as Shift on Enter. [V, Windows Terminal 1.25 preview blog post] So the owner's "Windows Terminal can't" was true for 1.24 and earlier.
- `/terminal-setup` in VS Code adds a keybinding that sends a fixed sequence on Shift+Enter. It also sets `terminal.integrated.gpuAcceleration` to `"off"` "to prevent garbled text". [V, same docs]
- `@xterm/xterm` 6.0.0, the version HSOS pins, has no kitty keyboard protocol. Its options and typings have no such setting, and its key encoder sends nothing for Shift+Insert or Ctrl+Insert, leaving those to the browser. [V, package source]
- HSOS already sends `ESC CR` (`\x1b\r`) for Shift+Enter (TERM-41). Claude Code reads that as Meta+Enter, which inserts a newline. [U for Claude Code's reading; the spec chose it earlier]

### What `ESC CR` does in PowerShell

Run on this machine with node-pty 1.1.0, ConPTY and Windows PowerShell 5.1.26100 with PSReadLine 2.0.0 [V]:

| Setup | Typed | Result |
|---|---|---|
| No key binding | `echo AAA1`, ESC CR, `echo BBB2`, Enter | One line `echo AAA1echo BBB2` runs. The two lines are glued together. |
| `Set-PSReadLineKeyHandler -Chord 'Alt+Enter' -Function AddLine` | the same | A `>>` continuation line opens, then both commands run: `AAA1`, `BBB2` |
| `Set-PSReadLineKeyHandler -Chord 'F12,c' -Function AddLine` | `echo AAA1`, `ESC [24~ c`, `echo BBB2`, Enter | Both commands run |

ConPTY turns `ESC CR` into Alt+Enter, which PSReadLine leaves unbound. One binding makes the same Shift+Enter sequence work in both Claude Code and PowerShell, with no need for HSOS to know which program is in front.

VS Code solves the same problem differently: in PowerShell with shell integration it sends `ESC [24~ c` (F12, then c) and its PowerShell script maps `F12,c` to whatever Shift+Enter was bound to. [V, VS Code source: `terminal.sendSequence.contribution.ts`, `shellIntegration.ps1`] That needs the terminal to know whether PowerShell or Claude Code is reading keys. The Alt+Enter binding does not.

## Finding 2: why Wispr Flow fails in the VS Code terminal

How Wispr Flow inserts text on Windows:

- It writes the transcript to the clipboard, sends a paste key press, and restores the old clipboard about half a second after the target reads it. [V, Wispr Flow docs "Using Flow with Linux, WSL, and Terminal Applications"]
- The key it sends is chosen by a server flag. Users found `"shift-insert": { "enabled": true }` in Flow's feature-flag cache, so the key is Shift+Insert, not Ctrl+V. [V, comments in anthropics/claude-code#93782; not stated by Wispr]
- Wispr's docs list the VS Code terminal and Windows Terminal as "direct paste: yes". There is no allow-list; "the target must accept the paste". [V, Wispr docs]
- Windows blocks input from a lower-privilege app to a higher one. If the terminal runs as administrator, Flow must too. [V, Wispr docs]
- Flow cannot read text back out of an xterm.js terminal, so its "dictated text not found" log means nothing there. [V, issue #93782 comments]

Why it breaks in VS Code, from anthropics/claude-code#93782 (community analysis, several independent confirmations, no maintainer reply) [V]:

1. Claude Code 2.1.269 and later asks every terminal whether it supports the kitty keyboard protocol and turns it on when the terminal answers. The VS Code terminal answers.
2. With the protocol on, VS Code's xterm.js encodes Shift+Insert as the key sequence `CSI 2;2~` and cancels the browser event. The browser paste never fires. Claude Code has no binding for that sequence, so nothing is inserted.
3. A real Ctrl+V still works because VS Code handles its paste command before the terminal sees the key.
4. Windows Terminal binds Shift+Insert to paste by default, so the same key press pastes there.

| Setup | Result |
|---|---|
| Claude Code 2.1.268, VS Code terminal | works |
| Claude Code 2.1.269 and later, VS Code terminal | dropped |
| the same, with `terminal.integrated.enableKittyKeyboardProtocol: false` | works |
| the same, with Shift+Insert bound to `workbench.action.terminal.paste` | works |
| Claude Code 2.1.269 and later, Windows Terminal, Wispr | works |
| a plain shell in the VS Code terminal | works |

This matches the owner's report. The owner runs Opus 5.5, which needs Claude Code 2.1.280 or later (issue #93782), so they are on an affected version.

A related failure: in Windows Terminal with copy-on-select, a selection can overwrite the clipboard before Flow's paste reads it. [V, issue #93782]

An older regression (anthropics/claude-code#38620, 2.1.83 to about 2.1.116) also dropped simulated pastes on Windows. No root cause was published. [V]

### Fix for the owner's VS Code today

Until HSOS exists, either of these in VS Code fixes dictation:

```json
// %APPDATA%\Code\User\keybindings.json
{ "key": "shift+insert", "command": "workbench.action.terminal.paste", "when": "terminalFocus" }
```

```json
// settings.json (loses the extra Claude Code shortcuts the protocol gives)
"terminal.integrated.enableKittyKeyboardProtocol": false
```

## What each terminal does better

Only features that matter to the owner's work, Claude Code in PowerShell, are listed.

| Area | Windows Terminal | VS Code terminal | HSOS before this change |
|---|---|---|---|
| Shift+Enter in Claude Code | 1.25+: yes, native | yes, after `/terminal-setup` | yes (`ESC CR`) |
| Shift+Enter in PowerShell | yes, native key events | yes, with shell integration (`F12,c`) | no: lines are glued |
| Dictation (Wispr Flow) | works: Shift+Insert, Ctrl+V and Ctrl+Shift+V all paste | broken with Claude Code 2.1.269+ | not specified for Shift+Insert from other apps |
| Paste safety | warns above 5 KiB and on multi-line paste; trims trailing whitespace on paste (all on by default) | warns on multi-line paste | warns above 5 000 characters or 20 line breaks |
| Shell integration (prompt marks, jump between commands, exit status, live folder) | marks and `scrollToMark` from OSC 133 | full: decorations, Ctrl+Up/Down, sticky scroll, recent commands, live folder | none |
| Links to files with line numbers | URLs only | files and URLs | files and URLs (TERM-55) |
| Shells survive a UI reload | no | yes | yes |
| Admin shells | per-profile "run as administrator" | no | no |
| Input methods and Windows voice typing (Win+H) | yes, through Windows Text Services Framework | yes, through Chromium | xterm.js composition, not specified |

Sources: Windows Terminal interaction settings (Microsoft Learn) [V], VS Code shell integration docs [V], VS Code source [V], Claude Code docs [V].

## Risks found in the existing spec

1. **Execution policy.** TERM-7 and LINK-3 start PowerShell with `-Command ". $env:HSOS_SHELL_INIT"`. On this machine every execution policy scope is `Undefined`, so Windows PowerShell 5.1 uses `Restricted`, and dot-sourcing the file fails with "running scripts is disabled on this system". [V, run here] Loading the file's text as a script block, `. ([ScriptBlock]::Create([IO.File]::ReadAllText($path)))`, works under the same policy. [V, run here] The owner has no `pwsh.exe`, so HSOS falls back to Windows PowerShell 5.1 on this machine.
2. **Inherited terminal identity.** TERM-2 passes HSOS's whole environment to shells. If HSOS is started from a Windows Terminal or VS Code shell, `WT_SESSION` or `VSCODE_*` reach Claude Code, which picks keyboard behaviour by terminal. Claude Code 2.1.268 turned the kitty protocol on for a fixed list of terminals, Windows Terminal included. [V, issue #93782]
3. **Ctrl+V.** xterm.js turns Ctrl+V into the control character `0x16` and cancels the browser paste. VS Code avoids this by handling its paste command before xterm sees the key. TERM-41 says Ctrl+V pastes, but not that the key must be taken before xterm encodes it. [V, package source; VS Code behaviour from issue #93782]
4. **Paste guard and dictation.** TERM-43 asks before a paste of more than 5 000 characters. A long dictation, about 800 words, would open a dialog. When the program has turned on bracketed paste, as Claude Code does, the pasted lines are not run one by one, so the reason for the warning is gone. [U that Claude Code always enables bracketed paste; its docs describe collapsing large pastes]
5. **GPU renderer.** Claude Code's `/terminal-setup` turns VS Code's GPU acceleration off to prevent garbled text. HSOS uses the WebGL renderer by default (TERM-52). Not changed now; stage 6 checks should watch for it. [V for the VS Code setting; U whether it affects HSOS]
6. **Very large pastes.** Claude Code's docs say the VS Code terminal can drop characters from very large pastes. No cause was found in VS Code's or node-pty's source, which write input in one call. [V that neither chunks; U for the cause] An end-to-end test now checks a 20 000-character paste arrives whole.

## Decisions

Recorded in `docs/JOURNAL.md` step 33 and written into `spec/modules/terminal.md`.

1. Paste keys (Ctrl+V, Ctrl+Shift+V, Shift+Insert) are taken before xterm encodes them, and the browser's own paste does the read. The clipboard is read once, during the key press, which is what Wispr Flow's clipboard restore expects.
2. Every paste goes through one pipeline: one clipboard read, trailing whitespace trimmed only when the program has not asked for bracketed paste, the guard of TERM-43 relaxed under bracketed paste.
3. Shift+Enter keeps sending `ESC CR`. A shell init script binds Alt+Enter to AddLine in PSReadLine, so it works in PowerShell too.
4. The shell init script also emits OSC 133 prompt marks and OSC 7 for the current folder. HSOS uses them for Ctrl+Up and Ctrl+Down between commands, and to restart or restore a terminal in the folder it was really in.
5. Both init scripts load as script blocks, so they run under Restricted.
6. Variables that name another terminal are removed from the shell environment.
7. When HSOS runs as administrator, the terminal says once that dictation apps and Explorer drag and drop cannot reach it.
8. Input-method and voice-typing text is written once, as typed text.

Not taken: Windows Terminal's quake mode and per-profile admin shells, VS Code's command decorations, sticky scroll, recent-command picker and terminal IntelliSense. They solve problems the owner has not raised.

## Sources

- Claude Code, Configure your terminal: https://code.claude.com/docs/en/terminal-config
- Windows Terminal Preview 1.25 release: https://devblogs.microsoft.com/commandline/windows-terminal-preview-1-25-release/
- Windows Terminal interaction settings: https://learn.microsoft.com/en-us/windows/terminal/customize-settings/interaction
- VS Code shell integration: https://code.visualstudio.com/docs/terminal/shell-integration
- VS Code source, Shift+Enter in PowerShell: https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/terminalContrib/sendSequence/browser/terminal.sendSequence.contribution.ts
- VS Code source, PowerShell integration script: https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/terminal/common/scripts/shellIntegration.ps1
- VS Code source, pty input: https://github.com/microsoft/vscode/blob/main/src/vs/platform/terminal/node/terminalProcess.ts
- node-pty source, Windows write: https://github.com/microsoft/node-pty/blob/main/src/windowsTerminal.ts
- `@xterm/xterm` 6.0.0 package: https://registry.npmjs.org/@xterm/xterm/-/xterm-6.0.0.tgz
- Wispr Flow, terminals: https://docs.wisprflow.ai/articles/6478598909-Using-Flow-with-Linux,-WSL,-and-Terminal-Applications
- Wispr Flow, text not pasting: https://docs.wisprflow.ai/articles/7971211038-fix-text-not-pasting-after-dictation
- Claude Code issue, dictation dropped in VS Code since 2.1.269: https://github.com/anthropics/claude-code/issues/93782
- Claude Code issue, simulated paste broken since 2.1.83: https://github.com/anthropics/claude-code/issues/38620
- OpenCode issue, Wispr Flow in the VS Code terminal: https://github.com/anomalyco/opencode/issues/34499
