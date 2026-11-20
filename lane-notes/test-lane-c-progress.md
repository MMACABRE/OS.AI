# Test lane C progress

Helpers shared by all sections: tests/fakes/stub-bus.ts (Bus with answers by channel, recorded calls, listeners), fake-ui-context.ts (UiContext recorder), fixtures.ts, history-fixtures.ts, editor.ts (CodeMirror access).

## 030 Files viewer and history

- tests/files/files-tree.ui.test.tsx: FILE-60 (x2), FILE-61, FILE-63 (x2, one through register.ui openPanel), FILE-1, state rows (loading, error+Retry, empty+New file, no project), FILE-64 (Delete with confirm; right click on a second row).
- tests/files/file-viewer.ui.test.tsx: FILE-73, FILE-74 (x3), FILE-72, FILE-75, FILE-78, FILE-70 (binary, too-large), state rows (loading, failure+Retry, empty file).
- tests/history/timeline.ui.test.tsx: HIST-40 (x2), HIST-41 (diff, Compare), HIST-42 (confirm, cancel), HIST-43, state rows (empty, error, binary, loading diff).
- Skipped / moved: FILE-61 "files.rescanNeeded reloads the root" is a bug (see bugs file). The FILE-61 changed row asserts "src reloaded, docs not" as in files.md; it does not assert a root reload (files.md says only src is listed again, untested.md says "src and the root").
- tests/history/line-diff.test.ts: not written. `diffLines` and history/panel/line-diff.ts do not exist any more (the lead fixes moved diffs to ui-kit `diffRows`). Rows are covered in tests/ui-kit/diff-rows.test.ts (HIST-41 same/removed/added order via UI-DIFF-1). The "before empty, after a" row is a bug (bugs file). The "2000 by 2000 lines gives null" row is not testable deterministically: diffRows returns null only on a 1000 ms timeout.


## Lead fixes: ui-kit views, and right click selects its row

- tests/ui-kit/diff-rows.test.ts: UI-DIFF-1, UI-DIFF-2, REV-22 (fold of 20 lines, expanded), HIST-41 (the empty-before row failed: bug).
- tests/ui-kit/views.ui.test.tsx: UI-5, UI-5b, REV-20, REV-21 (three pure additions), REV-23 (C and Ctrl+C), FILE-73 (CodeView cursor and scroll), FILE-72 (CodeView Ctrl+S once, default prevented), UI-LIST-1 (Tree right click), UI-LIST-2 (List right click). jsdom does not scroll, so scrollTop is a stored value on the element in these tests.
- tests/files/viewer.ui.test.tsx: FILE-70 (markdown preview first, Ctrl+Shift+V; source when off), FILE-74 (Compare), FILE-72 (double Ctrl+S sends one files.save), FILE-79 (relative link to C:\p\b.md, https link to shell.openExternal, through register.ui).
- tests/history/timeline.ui.test.tsx already holds the HIST-41 Compare row (section 030 commit). FILE-64 right click then Delete is in tests/files/files-tree.ui.test.tsx.
- Bug: REV-21 F7 on replaced lines (bugs file).


## 031 HUD

- tests/hud/hud.ui.test.tsx: HUD-1 (state-driven), HUD-2, HUD-3/9, HUD-4, HUD-5, HUD-6 (pulse class; the 3 x 400 ms animation itself is CSS, not computed by jsdom), HUD-7, HUD-8, HUD-10/11, HUD-13, HUD-14, HUD-16 (through register.ui and the panel), HUD-25/26, HUD-27, HUD-30, HUD-31 (toast and write), HUD-35, HUD-36 (chip and filter), HUD-40/41, HUD-60, HUD-61, HUD-62, HUD-63 (4 cases, through sendToSession), HUD-64, HUD-65 (typed text), HUD-66, HUD-67, HUD-68 (cleanFreeText and the settings schema), OWNER-1, Section boundary, tokensText, firstSentence.
- tests/hud/setup-view.ui.test.tsx: HUD-50, HUD-51, HUD-53, HUD-54, HUD-55.
- OWNER-2a to 2d are in tests/terminal/terminal-panel.ui.test.tsx (committed with the feedback paste section); xterm is replaced by a fake through vi.mock of create-xterm, since jsdom cannot run it.
- Bugs (bugs file): UI-MENU-1 (a Menu cannot open from an IconButton; this kills the HUD-1 menu item, HUD-34 and HUD-37 row menu), HUD-65 (Cancel does not get focus in the compact dialog). HUD-1 menu path, HUD-34, HUD-37 lock reason moved there.
- Not tested: HUD-37 "For this project only" with a chosen state (not in the untested.md table; the code applies the current state, see bugs file note). HUD-16 toast "Spoken alerts on/off" is not in the table; the command only logs.


## Lead fixes: feedback paste (tests/terminal/terminal-panel.ui.test.tsx)

- P-6 (sanitizePaste), REV-33 (xterm paste got the text without ESC; tray never calls terminal.write), REV-33b (bracketed paste off, two lines: not pasted, error toast mentions Copy), REV-33c (no panel: toast says to open the terminal), REV-34 (Sent. Clear comments? with Clear and Keep, comments still listed), OWNER-2a to 2d.
- The older 033 row "REV-33 ... terminal.write with ESC[200~ ... ESC[201~" is obsolete: the tray now pastes through the terminal panel (this section replaces it). Not tested as written.


## 032 Sessions

- tests/sessions/picker.ui.test.tsx: SESS-31 (search words, case, untitled, Backup only + state word, "5 min ago · 12 messages", ArrowDown, Enter starts the resume), SESS-32 (live row footer, non-live footer, order create/bind/write with the resume command as owner, restoreTranscript first for a backup-only row, copy command), state rows (loading, empty, no match, error+Retry, no project).
- tests/sessions/history.ui.test.tsx: SESS-71 (x2), SESS-72 (groups, Shift range, Ctrl+A with "Delete 5"), SESS-73 (F2, Delete, note line), SESS-74 (x3), SESS-75, SESS-76 (x2), SESS-70 (debounce, real timers), state rows (empty, no match, error+Retry).
- tests/sessions/reader.ui.test.tsx: SESS-50 (items, 250 with Show earlier, growth after 2 s with real timers, hidden page), SESS-51, empty, error+Retry, loading.
- Not in my sections: the "Untested: card 032 fixes" table (tests/sessions/sessions-fixes.ui.test.tsx) has a "#" heading, not "##"; it is outside the list I was given, so I did not write it.
- No bugs found in 032.


## 033 Git, changes, feedback and activity

- tests/review/changes.ui.test.tsx: REV-12, REV-14 (x3), REV-10, REV-11, REV-15, REV-31 (tray label and targetLabel), state rows (loading, error+Retry, not a repo).
- tests/review/diff.ui.test.tsx: REV-20 (same region element kept, new lines shown; scroll reset is not asserted, as the table says), REV-23 (C, type, Ctrl+Enter gives the exact diff-line target; Escape), REV-22 (fold of 12, F7), REV-25, "No differences.".
- tests/activity/timeline.ui.test.tsx: ACT-15 (x2), ACT-11, ACT-10, ACT-14 (restore with confirm, pin), ACT-33, ACT-31 (html and image), state rows (empty timeline, error+Retry, empty artifacts).
- REV-34 ("Sent. Clear comments?") is in tests/terminal/terminal-panel.ui.test.tsx (feedback paste section).
- Skipped: the 033 REV-33 row (terminal.write with ESC[200~ and ESC[201~) is obsolete since the Lead fix replaced it by the xterm paste path (see the feedback paste section: REV-33, 33b, 33c). git.md has no component rows.
- No bugs found in 033.


## 034 look pass (Lead)

- tests/workspace/pages.ui.test.tsx: WS-43 (the graph view renders once as a page layer, before the notes list, before the dock; not in the dock and no tab).
- tests/graph/graph-look.ui.test.tsx: GRAPH-51 (camera centre is CLAUDE.md display position on open and on Fit), GRAPH-30 (the selected note is color.accent and its halo blur equals the CLAUDE.md focus blur and is above a plain node's). sigma is replaced by a fake through vi.mock because jsdom has no WebGL; the reducers and the camera calls are the real view's.
- tests/ui-kit/button.ui.test.tsx: UI-BTN-1.
- Not in my list: the "034 Notes page and browser panel: test plan" (heading with one #) was not assigned.


## 035 look pass

- tests/dashboard/dashboard-look.ui.test.tsx: DASH-4 (box widget: frame, four corners, title row; free widget: none), DASH-12 (mascot scale 4 at 360 by 320 px, clamped to 1 and 4, 2 at 100 px), DASH-12b (22% and 4 of 20 segments on).
- Not in my list: the "035 Dashboard: test plan" (placement.test.ts, dashboard.ui.test.tsx, e2e demo-dashboard) has a heading with one #, so it was not assigned. The DASH-13 e2e row is skipped as an e2e row.


## 036 part 1: settings layout A and the welcome view

- tests/workspace/welcome.ui.test.tsx: WS-5 (missing project muted, row disabled, "Remove from list"; the other shows "3 days ago"), WS-5b (Enter opens), WS-5c (Open folder with a picked path and with null), WS-44 (Dashboard renders the welcome view with no project and the widget screens with one; rendered through AppFrame with the dashboard page shown).
- tests/settings/screen-layout.ui.test.tsx: section list with key counts (Appearance 4, Files 8, Claude sessions 2, Dashboard 2, none for Key bindings and Themes), data-changed and Reset on a changed key (and Reset sends the default), the description under a label. I used a new file because untested.md names tests/settings/screen.ui.test.tsx, which does not exist on this branch (card 024's file belongs to another lane), so adding to it would conflict at merge; the Lead can append these tests to it. The description row registers a description on the terminal fontSize schema through z.globalRegistry, because no contract schema uses .describe() yet.
- Bug: WS-44 "with no project open the Dashboard page shows" is not implemented (page store starts on code); moved to the bugs file.
- Flake, not mine: tests/files/parcel-file-watcher.test.ts (card 004) fails on the 2 s wait in the full run about half the time on this machine (alone it passes); the pre-commit hook then blocks. Retrying the commit gets through.

