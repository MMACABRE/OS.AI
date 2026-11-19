# Untested: cards 030 and 033 fixes

Test files: `tests/review/changes-fixes.ui.test.tsx`, `tests/activity/activity-fixes.ui.test.tsx`, `tests/files/tree-fixes.ui.test.tsx`, `tests/history/timeline-fixes.ui.test.tsx`, `tests/git/status-fixes.ui.test.tsx`.

| Rule | Kind | Given | When | Then |
|---|---|---|---|---|
| REV-12, P-40 | component | Changes with a focused commit message field | `changesInvalidated` fires | the field keeps focus and text; no skeleton shows |
| REV-10, P-40 | component | a clean repo, 0 files | the view shows | the base select is visible with "No changes since the last commit." |
| REV-10 | component | two sessions, one with a `file-edit` event | the base select opens | only that session is listed |
| REV-10 | component | a session base chosen | `projectChanged` fires | base is "Since last commit", selection and sessions are cleared |
| REV-13 | component | a changed file row | Enter or double click | `openDiff` runs, not `openFile` |
| REV-14 | component | a commit in flight | Commit pressed twice | `git.commit` is called once |
| REV-14 | unit | project `C:\repo\app`, repo root `C:\repo`, file `src/a.ts` | commit | the path sent is `app/src/a.ts` |
| GIT-26 | component | `operation: 'merge'` | `git.sync` runs | no `git.sync` call; a notification says "Merge in progress. Finish it in a terminal, then sync again." |
| GIT-26 | component | `operation: 'merge'`, 0 files | the status item renders | it reads "Merge in progress" |
| GIT-26 | component | `isOffline: true`, 2 files | the status item renders | it reads "2 changed · Offline" |
| git UI | component | 2 files | the status item is pressed | `openPanel('review.changes')` |
| GIT-11 | component | ChangesView, DiffPanel and TrayCount mounted together | the project opens | `git.getStatus` is called once |
| ACT-12, P-40 | component | Activity, filter "You" returns 0 entries | the list shows | both filters stay visible with "No change matches these filters." |
| ACT-12 | component | a session chosen, then the cause changed | the list reloads | the session option is still in the select and still chosen |
| ACT-15, P-40 | component | Activity with scroll position set | `entryAdded` and a refresh | no skeleton; scroll position kept |
| ACT-16 | component | page 1 ends with two entries at time T | scroll to the end | page 2 is asked from T+1; the second entry at T shows once |
| ACT-16 | component | a page that adds only known ids | scroll to the end | no more requests |
| ACT-33 | component | the Artifacts search | typing "a", "ab", "abc" within 300 ms | one `listArtifacts` call with "abc" |
| ACT-31 | component | `shell.openPath` fails | a PDF tile is opened | an error toast with the message |
| ACT-30 | component | Artifacts with tiles | `projectChanged` fires | search is empty and old tiles are gone |
| REV-32 | component | a comment in edit mode | the text has two lines and Ctrl+Enter | `updateComment` is called with both lines |
| REV-34 | component | "Sent. Clear comments?" showing | a comment is added | the Send and Copy buttons are back |
| FILE-61 | component | `src` expanded then collapsed | a change in `src/y.ts`, then `src` expanded | the new entry is listed |
| FILE-60, P-40 | component | root listed | `files.changed` in the root | no skeleton; the tree keeps scroll and open menu |
| FILE-60 | component | a listing in flight | the project changes | the late result is not shown |
| HIST-43, P-40 | component | a history timeline with a version selected | `snapshotAdded` | no skeleton; selection and diff scroll kept |
| HIST-42 | component | a restore that succeeds | the toast shows | it has an "Undo" action; pressing it calls `history.restore` with the row under the new restore row |
| ACT/REV commands | unit | the modules registered | the command list is read | `review.showChanges` (Ctrl+Shift+G), `activity.showTimeline`, `activity.showArtifacts` exist and open their side views |
