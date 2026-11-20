# Test lane C progress

Helpers shared by all sections: tests/fakes/stub-bus.ts (Bus with answers by channel, recorded calls, listeners), fake-ui-context.ts (UiContext recorder), fixtures.ts, history-fixtures.ts, editor.ts (CodeMirror access).

## 030 Files viewer and history

- tests/files/files-tree.ui.test.tsx: FILE-60 (x2), FILE-61, FILE-63 (x2, one through register.ui openPanel), FILE-1, state rows (loading, error+Retry, empty+New file, no project), FILE-64 (Delete with confirm; right click on a second row).
- tests/files/file-viewer.ui.test.tsx: FILE-73, FILE-74 (x3), FILE-72, FILE-75, FILE-78, FILE-70 (binary, too-large), state rows (loading, failure+Retry, empty file).
- tests/history/timeline.ui.test.tsx: HIST-40 (x2), HIST-41 (diff, Compare), HIST-42 (confirm, cancel), HIST-43, state rows (empty, error, binary, loading diff).
- Skipped / moved: FILE-61 "files.rescanNeeded reloads the root" is a bug (see bugs file). The FILE-61 changed row asserts "src reloaded, docs not" as in files.md; it does not assert a root reload (files.md says only src is listed again, untested.md says "src and the root").
- tests/history/line-diff.test.ts: not written. `diffLines` and history/panel/line-diff.ts do not exist any more (the lead fixes moved diffs to ui-kit `diffRows`). Rows are covered in tests/ui-kit/diff-rows.test.ts (HIST-41 same/removed/added order via UI-DIFF-1). The "before empty, after a" row is a bug (bugs file). The "2000 by 2000 lines gives null" row is not testable deterministically: diffRows returns null only on a 1000 ms timeout.

