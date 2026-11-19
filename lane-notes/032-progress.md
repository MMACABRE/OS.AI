## 032 Sessions
Status: done (untested)
Date: 2026-11-19
Did: Built the session picker (command `sessions.find`, a dialog with search, rows with state chip and backup badge, the first action on Enter), Session History (dock `sessions.history`: project and state selects, search, folder groups, checkbox and Shift-click selection, Ctrl+A, row menu, "Delete n", refresh on changes debounced 500 ms) and the transcript reader (dock `sessions.transcript`: the last 200 items, "Show earlier", growth check every 2 s while visible, Resume, Rename, Edit note). Rename, note and delete dialogs are shared. Registered the module in `src/ui/module-list.ts`.
Checks: typecheck ok, lint ok, deps ok, build ok, test not run (implementer rule), e2e not run
Deviations:
- "Resume here" (SESS-32) is not built: it needs the focused terminal's prompt state (TERM-71), which the terminal module owns and the renderer does not expose yet.
- "Go to terminal" (SESS-32) is shown but disabled. Nothing in the contracts focuses an existing terminal panel from another module, and `ctx.openPanel('terminal.shell')` would open a new one (the terminal panel allows several).
- "Resume in new terminal" runs `terminal.create`, `sessions.bind` and `terminal.write` as SESS-32 says, but it does not open a terminal panel for the new shell. The terminal module should open it; the panel state shape for `terminal.shell` is not in the spec excerpts I read.
- The picker is a dialog with its own React root (`createRoot` on a div in `document.body`, wrapped in ui-kit's `ToastProvider`), because a command cannot mount a dialog inside the app tree. The Dialog's Radix portal still renders into `document.body`. The rename field is not pre-selected (ui-kit's `TextField` has no select-on-focus).
- The transcript shows plain text with line breaks, not `MarkdownView` (ui-kit has no `MarkdownView` yet). Raw HTML is therefore shown as text, which satisfies SESS-51.
- The note field is a native `textarea` (ui-kit has no multi-line field); it is not a ui-kit component.
- Session History rows use plain list markup with native checkboxes, not ui-kit's `List`, because the rows are grouped by folder and `List` has no group headers. Arrow keys do not move the selection in this list; Tab moves between rows, and Enter, F2, Delete and Ctrl+A work.
- The project select shows the folder name only; the full path tooltip (SESS-71) is not shown (ui-kit's `Select` takes no tooltip).
- The reader keeps the session fields it was opened with (title, note, live terminal). Rename and note refresh the title and note from `sessions.list`; the live terminal does not refresh until the reader is opened again.
- Auto-resume (SESS-41, SESS-42) and the Settings section are not part of this card and are not built here.
- `use-project.ts` and `format.ts` are copies of the files module's helpers (see card 030 progress); the Lead should move them to a shared place.
Next: 033
