## Lead fixes after the lane B merge: sessions
Status: done (untested)
Date: 2026-11-19
Did: Fixed the ten review findings on card 032 in `src/modules/sessions/`: Ctrl+A in the search field, row key handling and Up/Down navigation, the picker toast that vanished at close, Resume opening a `terminal.shell` panel, the project filter fallback and reset, explicit newest-first sorting, the reader growth poll and scroll anchor, the reader's live state, the all-running Delete dialog, and PowerShell escaping with a copy error toast.
Checks: typecheck ok, lint ok, deps ok, test not run (implementer rule), e2e not run
Deviations:
- The panel API (`PanelProps`, `PanelDefinition`) has no way to set a panel's title after registration, so the transcript panel title stays "Transcript". The reader header shows the session title.
- No contract maps a session's folder to a project id. Resume uses the open project's id for `terminal.create` even for a session from another folder, and shows an error toast when no project is open. SESS-32 is silent on this.
- The terminal panel state is written out in `register.ui.ts` (shape of `TerminalPanelState`), because a module may not import the terminal module.
- Up and Down move focus between rows of Session History; they do not change the selection (SESS-72 is silent). The row list is still plain markup, not `List`.
- A selection of only running sessions opens a "Nothing to move" dialog with a Close button. SESS-76 gives no text for this case.
- The picker's toast provider now stays mounted for the toast time after the dialog closes.
- The reader's Resume stays hidden while the session has a live terminal; "Go to terminal" is still missing (known gap).
Next: Lead review and merge
