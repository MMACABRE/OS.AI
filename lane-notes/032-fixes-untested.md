# Untested: card 032 fixes

Test file for all rows: `tests/sessions/sessions-fixes.ui.test.tsx`. Each name starts with its rule id.

| Rule | Kind | Given | When | Then |
|---|---|---|---|---|
| SESS-71 | component | Session History with rows, focus in the search field | Ctrl+A | the field's text is selected by the browser; no row is selected |
| SESS-72 | component | Session History with three rows | Ctrl+A with a row focused | all three rows are selected |
| SESS-73 | component | a row whose "more" button is focused | Enter, F2 or Delete | the row's handlers do not run; the menu opens on Enter |
| SESS-72 | component | three rows, the first focused | ArrowDown, then ArrowUp | focus moves to the second row, then back to the first |
| SESS-31, SESS-32 | component | the picker with a resumable row | Resume succeeds | the toast "Resumed ..." is in the document after the dialog is gone, and stays for the toast time |
| SESS-32 | component | a stub bus whose `terminal.create` returns id T1 | Resume in new terminal | `openPanel('terminal.shell', { terminalId: T1, cwd, worktree: null, launch: null, fontSizeDelta: 0 })` is called, then the success toast |
| SESS-32 | component | no project open | Resume in new terminal | an error toast "Open a project first, then resume the session." and no `terminal.create` call |
| SESS-32 | component | `terminal.create` fails | Resume | an error toast with the message and no panel is opened |
| SESS-71 | component | the open project has no sessions, other folders have | the history opens | the project select reads "All projects" and all groups show |
| SESS-71 | component | a project filter chosen | `workspace.projectChanged` fires | the filter is back at its default |
| SESS-72 | component | sessions of two folders with mixed activity times | All projects chosen | groups are ordered by their newest row; rows inside each group newest first |
| SESS-50 | component | an open reader with 200 items, total 200 | the next poll reports total 650 | all items 200 to 649 are shown, with no gap |
| SESS-50 | component | an open reader scrolled to the top | "Show earlier" | the first previously visible item stays at the same screen position |
| SESS-32, SESS-43 | component | a reader whose session has no live terminal | `sessions.recordChanged` makes the list report a live terminal | the Resume button is gone; when the terminal exits it returns |
| SESS-76 | component | a selection of only running sessions | Delete | the dialog "Nothing to move" lists them and has a Close button; no "Move 0" title and no `trash` call |
| SESS-76 | component | a selection of one idle and one running session | Delete | the title reads "Move 1 session to the Recycle Bin?" and the running one is listed |
| SESS-32 | unit | cwd `C:\dir $x\`y` | copy resume command | the clipboard text is `cd "C:\dir `$x\``y"; claude --resume <id>` |
| SESS-32 | component | `shell.writeClipboard` fails | Copy resume command | an error toast with the message |
