## 030 Files, viewer and history

Code: `src/modules/files/panel/` (`FilesTree.tsx`, `FileViewer.tsx`, `use-project.ts`, `helpers.ts`), `src/modules/files/register.ui.ts`, `src/modules/history/panel/` (`Timeline.tsx`, `DiffView.tsx`, `line-diff.ts` with `diffLines`, `format.ts`), `src/modules/history/register.ui.ts`, `src/ui/module-list.ts`. No feature flag in this card.

Jsdom computes no CSS animations, so the state rows check the rendered text and roles. The panels read the bus through `ctx.bus`: pass a fake `Bus` whose `call` answers from a map and whose `on` records listeners. `useToast` needs a `ToastProvider` around the component. `ConfirmDialog` and `Dialog` portal into `document.body`, so query them with `screen`.

`tests/files/files-tree.ui.test.tsx`:

| Rule    | Given | When | Then |
| ------- | ----- | ---- | ---- |
| FILE-60 | a project whose root lists `src/` (dir) and `README.md` (file) | the view renders | the root shows both, folders first; `src` has `aria-expanded="false"` |
| FILE-60 | `src` collapsed and not loaded | `ArrowRight` on `src` | `files.listDir` is called once with `src`'s absolute path; the children appear |
| FILE-61 | folder `src` expanded, `docs` collapsed | `files.changed` with `docs\x.md` and `src\y.ts` | `listDir` is called for `src` and for the root only; not for `docs` |
| FILE-61 | the same | `files.rescanNeeded` | the root reloads (no error) |
| FILE-63 | `README.md` selected | `Enter` | `ctx.openPanel` gets `files.viewer` with `{ path, line: null }` (through the `openFile` prop) |
| FILE-1  | entries `b.txt`, `A` (dir), `node_modules` (dir, `isDimmed: true`) | the root renders | row order is `A`, `node_modules`, `b.txt`; the `node_modules` label has the dimmed class |
| state   | `listDir` pending for more than 150 ms | the view renders | a skeleton with the label "Loading files" appears (the label is the frame's text) |
| state   | `listDir` returns `{ ok: false, error: { message: 'Access denied' } }` | the view renders | "The folder could not be read. Access denied" with a "Retry" button; Retry calls `listDir` again |
| state   | root listing is `[]` | the view renders | "This folder is empty." with a "New file" button; the button opens the New file dialog |
| state   | no project (`getCurrentProject` returns null) | the view renders | "No project open" |
| Delete  | `confirmTrash()` true, a file selected, context menu "Delete" | it is chosen | the "Move to Recycle Bin?" dialog shows; Confirm calls `files.trash` with that path |

`tests/files/file-viewer.ui.test.tsx`:

| Rule   | Given | When | Then |
| ------ | ----- | ---- | ---- |
| FILE-73 | a clean viewer on `a.ts` with text `one` | `files.changed` with `a.ts` `changed`, and `files.read` now returns `two` | the editor shows `two`; no element with role `alert` |
| FILE-74 | a dirty viewer (text typed: `one x`) | `files.changed` with `a.ts` `changed` | the alert shows "This file changed on disk."; the editor still has `one x`; `files.save` was not called |
| FILE-74 | the same, then the owner presses Ctrl+S | `files.save` returns `FILE_CHANGED_ON_DISK` | the alert is still shown; no save with `overwrite: true` was sent |
| FILE-74 | the same bar | "Overwrite" pressed | `files.save` is called with `overwrite: true` and the editor text |
| FILE-72 | a clean viewer, text `one` changed to `one x` | Ctrl+S | `files.save` gets `baseHash` of the loaded version, `format` of the loaded file, `content` `one x` |
| FILE-75 | a viewer | `files.changed` `deleted` | "This file was deleted." with "Save to recreate"; the editor keeps its text |
| FILE-78 | a viewer opened with `line: 3` on a 5-line file | the text loads | the caret is at the start of line 3 (`selectionStart` equals the offset of line 3) |
| FILE-70 | `files.read` returns kind `binary` | the viewer renders | "This file is not text." and "Reveal in Explorer" (calls `shell.revealInExplorer`) |
| FILE-70 | kind `too-large` | the viewer renders | "This file is too large to edit here." with the size |
| state  | `files.read` pending | the viewer renders | the loading skeleton with "Opening a.ts" after 150 ms |
| state  | `files.read` fails | the viewer renders | "This file could not be opened. <reason>" with Retry; Retry reads again |
| state  | an empty text file | the viewer renders | a normal empty editor, no error |

`tests/history/timeline.ui.test.tsx`:

| Rule    | Given | When | Then |
| ------- | ----- | ---- | ---- |
| HIST-40 | three snapshots for one path, newest first, sources `external`, `hsos-save`, `baseline` | the timeline renders | rows read "Changed outside HSOS", "Saved in HSOS", "Before first change", newest first |
| HIST-40 | the same | the timeline renders | each row names the size change against the older row (`+37 B` style, see the note in `progress`) |
| HIST-41 | a selected snapshot and the previous one | the diff loads | `history.getPrevious` and `history.readText` ran for both; the diff shows the added and removed lines |
| HIST-41 | "Compare with current file" switched on | the diff loads | `files.read` provides the right-hand side |
| HIST-42 | a timeline with a selected snapshot | "Restore this version", then Confirm | `history.restore` is called once with the snapshot id; a toast with "is back at the version from" shows |
| HIST-42 | the same | Cancel | `history.restore` is not called |
| HIST-43 | a timeline for `a.ts` | `history.snapshotAdded` for `a.ts` | `history.listForFile` is called again; a snapshot for `b.ts` does not reload |
| state   | `history.listForFile` returns `[]` | the timeline renders | "No earlier versions of this file yet. Versions appear here after the file changes." |
| state   | `history.listForFile` fails | the timeline renders | "History could not be read. <reason>" with Retry |
| state   | the selected snapshot's `readText` returns `FILE_BINARY` | the diff loads | "Binary file changed." |
| state   | the diff is loading | the timeline renders | the skeleton "Loading the difference" |

`tests/history/line-diff.test.ts` (unit, no React):

| Rule    | Given | When | Then |
| ------- | ----- | ---- | ---- |
| HIST-41 | before `a b c`, after `a x c` | `diffLines` runs | `same a`, `removed b`, `added x`, `same c` in that order |
| HIST-41 | before empty, after `a` | `diffLines` runs | one `added a` |
| HIST-41 | a 2 000 by 2 000 line pair | `diffLines` runs | `null` (too large) |
