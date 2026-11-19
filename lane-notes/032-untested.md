## 032 Sessions

Code: `src/modules/sessions/panel/` (`SessionPicker.tsx`, `SessionHistory.tsx`, `SessionReader.tsx`, `SessionDialogs.tsx`, `actions.ts` with `loadSessions`, `resumeInNewTerminal`, `copyResumeCommand`, `rowMenu`, `matchesSearch`, `use-project.ts`, `format.ts`), `src/modules/sessions/register.ui.ts`, `src/ui/module-list.ts`. Feature: none in this card.

The picker mounts its own React root (`register.ui.ts`, `openPicker`), so a test can call the command's `run` and then query `document.body`. The panels read the bus through `ctx.bus` and take it as a prop: pass a fake `Bus` whose `call` answers from a map by channel name. Wrap components in `ToastProvider` (ui-kit) to see toasts.

`tests/sessions/picker.ui.test.tsx`:

| Rule   | Given | When | Then |
| ------ | ----- | ---- | ---- |
| SESS-31 | rows titled `fix login flow` and `write tests` | the picker renders, then the search field gets `flow fix` | only `fix login flow` shows |
| SESS-31 | the same | the search field gets `FLOW` | `fix login flow` shows (case ignored) |
| SESS-31 | a row with an empty title | the picker renders | the title reads "Untitled session" |
| SESS-31 | a row with `hasOriginal: false, hasBackup: true` | the picker renders | a "Backup only" badge shows on that row, and the state chip reads its state word |
| SESS-31 | a row with `messages: 12`, `lastActiveAt` 5 minutes ago | the picker renders | the row reads "5 min ago · 12 messages" |
| SESS-31 | arrow keys | `ArrowDown` after the first row is selected | the second row is selected (`aria-selected`) |
| SESS-31 | rows listed | Enter on a selected row without `liveTerminalId` | `terminal.create` is called first (see SESS-32) |
| SESS-32 | a row with `liveTerminalId: 't1'` | the picker renders, the row is selected | the footer shows "Go to terminal" (disabled) and "Open transcript"; no "Resume in new terminal" |
| SESS-32 | a row without a live terminal, the focused terminal at state `running` | the picker renders | "Resume in new terminal" and "Copy resume command" show; no "Resume here" (not built, see progress) |
| SESS-32 | "Resume in new terminal" | it runs | in order: `terminal.create` with `launch: null` and `cwd` of the session, `sessions.bind` with the new id, `terminal.write` with `claude --resume <id>\r` and `source: 'owner'` |
| SESS-32 | the same, with `hasOriginal: false` | it runs | `sessions.restoreTranscript` is called before `terminal.create` |
| SESS-32 | "Copy resume command" | it runs | `shell.writeClipboard` gets `cd "<cwd>"; claude --resume <id>` |
| state  | `sessions.list` pending for more than 150 ms | the picker renders | a skeleton with "Loading sessions" |
| state  | `sessions.list` returns `[]` | the picker renders | "No Claude sessions in this project yet." |
| state  | a non-empty list and a search that matches nothing | the picker renders | "No session matches." |
| state  | `sessions.list` fails | the picker renders | "Sessions could not be read. <reason>" with Retry; Retry calls `sessions.list` again |
| state  | no project (`getCurrentProject` returns null) | the picker renders | "Open a project to find its sessions." |

`tests/sessions/history.ui.test.tsx`:

| Rule    | Given | When | Then |
| ------- | ----- | ---- | ---- |
| SESS-71 | the open project `C:\code\hsos` and two folders in the list | the history renders | the project select shows the open project; rows of other folders are hidden |
| SESS-71 | the state select set to `interrupted` | the history renders | only interrupted rows show |
| SESS-72 | "All projects" chosen; rows in two folders | the history renders | two groups, each headed by its folder name; newest first within each |
| SESS-72 | rows 0 to 4 | a click on row 1 then a Shift-click on row 3 | rows 1 to 3 are selected (`aria-selected`) |
| SESS-72 | rows listed | Ctrl+A on the list | every visible row is selected; "Delete 5" shows in the toolbar |
| SESS-73 | a selected row | F2 | the rename dialog opens with the current title |
| SESS-73 | a selected row | the Delete key | the "Move 1 session to the Recycle Bin?" dialog opens |
| SESS-73 | a row with a note whose first line is `Kept for notes` | the history renders | the note's first line shows, muted |
| SESS-74 | rename dialog with `fix login` | the field is changed to `fix login flow` and Save | `sessions.rename` is called with the trimmed title; the dialog closes; the copy under the field reads "Claude Code's own session list shows this name too." for an ended session and "Claude Code shows this name after the session ends." for a live one |
| SESS-74 | a title of 81 characters | the field is read | Save is disabled; "Use 80 characters or fewer." shows |
| SESS-75 | note dialog | Ctrl+Enter after typing | `sessions.setNote` is called once with the text; Enter alone adds a line |
| SESS-76 | two sessions selected, one `running` | "Delete 2" then the confirm dialog | the body names the running one under "Still running, will be skipped:"; Cancel has focus; Confirm calls `sessions.trash` with the ended one only |
| SESS-76 | the same, `sessions.trash` returns `{ trashed: [a], failed: [{ sessionId: b, message: 'Locked' }] }` | Confirm | a toast reads "1 moved to the Recycle Bin"; a second toast reads "Locked" |
| SESS-70 | the history is open | `sessions.recordChanged` fires three times within 300 ms | `sessions.list` is called once more after 500 ms (debounced) |
| state   | `sessions.list` returns `[]` | the history renders | "No Claude sessions found." |
| state   | a filter that matches nothing | the history renders | "No session matches." |
| state   | `sessions.list` fails | the history renders | "Sessions could not be read. <reason>" with Retry |

`tests/sessions/reader.ui.test.tsx`:

| Rule   | Given | When | Then |
| ------ | ----- | ---- | ---- |
| SESS-50 | a transcript of a user prompt, an assistant text, a tool item `Bash npm run check` | the reader renders | "You" and "Claude" items show their text; the tool item is one muted line |
| SESS-50 | 250 items in the transcript | the reader renders | 200 items show; "Show earlier" shows; pressing it calls `readTranscript` with `beforeIndex` of the oldest shown item and `limit: 200` |
| SESS-50 | the reader is visible, the transcript grows from 3 to 4 items | 2 s pass (fake timers) | the fourth item appears; no duplicate of the first three |
| SESS-50 | the reader is on a hidden page (`PageVisibleContext` false) | 2 s pass | no `readTranscript` call after the first |
| SESS-51 | a prompt whose text is `<b>bold</b> and <script>x</script>` | the reader renders | the text shows literally; no `<b>` element exists |
| SESS-50 | the transcript has 0 items | the reader renders | "This session has no messages yet." |
| state  | `readTranscript` fails with `FILE_NOT_FOUND` | the reader renders | "The transcript could not be read. <reason>" with Retry |
| state  | `readTranscript` pending | the reader renders | the skeleton "Reading the transcript" |
