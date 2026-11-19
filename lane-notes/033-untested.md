## 033 Git, changes, feedback and activity

Code: `src/modules/git/panel/` (`ChangesStatus.tsx`, `actions.ts` with `gitMessage` and `runGitCommand`, `use-repo.ts`), `src/modules/git/register.ui.ts`, `src/modules/review/panel/` (`ChangesView.tsx`, `FeedbackTray.tsx` with `targetLabel`, `DiffPanel.tsx`, `DiffView.tsx` with `numberRows`, `rowsFor`, `targetOf`, `line-diff.ts`, `data.ts`, `TrayCount.tsx`, `use-repo.ts`, `helpers.ts`), `src/modules/review/register.ui.ts`, `src/modules/activity/panel/` (`Timeline.tsx` with `sectionsOf`, `Artifacts.tsx`, `PinDialog.tsx`, `format.ts`, `use-project.ts`), `src/modules/activity/register.ui.ts`, `src/ui/module-list.ts`. Feature: none in this card.

The component rows are the ones `review.md` and `activity.md` list under "component"; `git.md` has none. Jsdom has no CSS animation, so rows check text and roles. Panels take `ctx.bus` as a prop: pass a fake `Bus` that answers `call` from a map by channel name and records `on` listeners. Wrap in `ToastProvider` (ui-kit). `Dialog` portals into `document.body`.

`tests/review/changes.ui.test.tsx`:

| Rule   | Given | When | Then |
| ------ | ----- | ---- | ---- |
| REV-12 | the Changes view with `listChanges` returning `[a.ts, b.ts]`, `b.ts` selected | `changesInvalidated` for the project, and `listChanges` now returns `[a.ts, b.ts, c.ts]` | `b.ts` still has `aria-selected="true"`; `c.ts` is listed |
| REV-14 | `git.getStatus` returns a repo with `operation: 'merge'`, one changed file | the Changes view renders (base "Since last commit") | the "Commit" and "Commit and Sync" buttons are disabled |
| REV-14 | the same with `operation: 'none'`, a message from `git.suggestMessage` | the view renders | the message field shows the suggestion; "Commit" is enabled |
| REV-14 | the same, "Commit" pressed | `git.commit` | it receives every listed file's relative path and the message; the rows refresh |
| REV-10 | the base select | "Session: fix login" chosen | `listChanges` is called with `{ kind: 'session-start', sessionId }`; the commit box is gone |
| REV-11 | three files, `+120 −45` in sum | the view renders | the summary reads "3 files · +120 −45"; each row has its letter with the word in its accessible name (for example `M` with `Modified`) |
| REV-15 | a file row selected, "Show History" | it runs | `openHistory` is called with that file's absolute path |
| REV-34 | comments are sent (the tray shows "Sent. Clear comments?") | the tray renders | the comments are still listed; "Clear" and "Keep" show |
| REV-33 | one comment, a live Claude session with `liveTerminalId`, "Send to Claude" pressed | the view runs | `review.composePrompt` runs, then `terminal.write` with `\u001b[200~`, the prompt and `\u001b[201~`; the data has no carriage return; `source` is `owner` |
| REV-31 | a comment whose target is a `before` diff line, the prompt | the tray lists it | the label ends with `(removed line)` |
| state  | `listChanges` pending for more than 150 ms | the view renders | a skeleton "Reading changes" |
| state  | `listChanges` fails | the view renders | "Changes could not be read. <reason>" with Retry |
| state  | a folder that is not a repo, base "Since last commit" | the view renders | "This folder is not a git repository. Choose a Claude session to see its changes." |

`tests/review/diff.ui.test.tsx`:

| Rule   | Given | When | Then |
| ------ | ----- | ---- | ---- |
| REV-20 | a diff of 300 lines | the file gains three lines at the top and the diff refreshes | the same content line is still in view (checked by `data-row` order, the first visible row keeps its text); no scroll reset is asserted yet (see progress) |
| REV-23 | a diff with a changed line `out[i] = cap` at after-line 121 | the line gets focus, `C` is pressed, the text `Keep the cap` is typed, `Ctrl+Enter` | `review.addComment` is called with `{ kind: 'diff-line', path, line: 121, side: 'after', quote: 'out[i] = cap' }` and `text: 'Keep the cap'` |
| REV-23 | the same, Escape pressed in the box | | the box closes; no call |
| REV-22 | a run of 12 unchanged lines between two changes | the diff renders | one "⋯ 12 unchanged lines" button; pressing it shows the 12 lines |
| REV-22 | F7 pressed in the diff | | the cursor moves to the first changed row (`data-row` of that row is scrolled to) |
| REV-25 | `getDiff` returns `isBinary: true` | the panel renders | "Binary file changed." |
| state  | the diff of identical sides | the panel renders | "No differences." |

`tests/activity/timeline.ui.test.tsx`:

| Rule   | Given | When | Then |
| ------ | ----- | ---- | ---- |
| ACT-15 | a timeline with 40 entries, the list scrolled down by 300 px | an `activity.entryAdded` event arrives | the scroll position is unchanged (`scrollTop` still 300); a button "1 new changes" shows |
| ACT-15 | the list at the top | the same event | the new entry is the first row; no chip shows |
| ACT-11 | seven `claude` entries of one session within 40 s, then one `owner` entry | the timeline renders | one group row "refactor parser · 7 files" (the session title, cut to 24) and one single row "You"; the group row toggles its members (`aria-expanded`) |
| ACT-10 | entries from today and yesterday | the timeline renders | the day headings "Today" and "Yesterday" |
| ACT-14 | a row's context menu, "Restore the version before this change" | it is chosen | `history.getPrevious` is called; a confirm dialog shows; Confirm calls `history.restore` with the previous id |
| ACT-14 | the same, "Pin comment" | it is chosen | the pin dialog opens; Pin calls `review.addComment` with `kind: 'file-line'` and `line: 1` |
| ACT-33 | tiles `a/report.html` and `b/chart.png` | the search field gets `rep` | `activity.listArtifacts` is called with `query: 'rep'`; one tile shows |
| ACT-31 | an artifact tile of kind `html` | it is activated | `shell.openPath` is called with its path |
| ACT-31 | an image tile | it is activated | `ctx.openPanel` for `files.viewer` gets its path (through the `openFile` prop) |
| state  | `listTimeline` returns `[]` | the timeline renders | "No changes recorded yet. Changes to files in this project appear here." |
| state  | `listArtifacts` returns `[]` with an empty query | the artifacts view renders | "Pages, PDFs and images Claude makes in this project appear here." |
| state  | `listTimeline` fails | the timeline renders | "Activity could not be read. <reason>" with Retry |
