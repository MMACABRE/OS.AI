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

