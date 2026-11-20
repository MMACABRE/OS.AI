# Module: review

## Purpose

Makes reviewing Claude's work fast: see exactly what changed as it changes, point at the parts that need work, and send all the feedback back to Claude in one go.

## Interface

`contracts/channels/review.ts`. Uses `git`, `history`, `claude-link` and `terminal` through their channels.

- Runs in: `workspace-service` (change lists, diffs, comments), `ui` (Changes view, diff panel, feedback tray).
- Third-party packages allowed: `diff` (service), `write-file-atomic`, `zod`.

## Data

`reviewCommentsFile(projectId)`: `{ "version": 1, "comments": [PinnedComment, ...] }`. Written atomically on every change.

## Behaviour

### Change lists

- **REV-1.** Base `last-commit`: the files are those in `git.getStatus`, mapped to `ReviewFile`. `before` is the file at HEAD (`git.getFileDiff`), `after` is the working file. For a project that is not a repo, `listChanges` returns an empty list and the view offers the session base.
- **REV-2.** Base `session-start`: the files are the distinct paths of that session's `file-edit` events. For each, `before` is the content of the newest snapshot taken before the session's first edit of that path (normally the `baseline` snapshot from LINK-30), or null when there is none, which means the session created the file. `after` is the current file, or null when it is gone.
- **REV-3.** A file whose `before` and `after` are equal is left out of the list.
- **REV-4.** `linesAdded` and `linesRemoved` come from a line diff. Binary files and files above 1 MB have nulls and `isBinary: true` for binary.
- **REV-5.** `changesInvalidated` is emitted 300 ms after any `files.changed` batch, after `git.statusChanged`, and after a `file-edit` session event.

### Changes view

Side view `review.changes`.

- **REV-10.** A base select at the top: "Since last commit" and one entry per Claude session of this project that has edited files: "Session: <title>". The choice is saved in the view state.
- **REV-11.** Below it, the file list: change letter with a word in its accessible name (`A` added, `M` modified, `D` deleted, `R` renamed, `!` conflicted), relative path, `+n −m`. A header line sums it: "7 files · +120 −45".
- **REV-12.** The list refreshes on `changesInvalidated`, keeping the selection when the file is still present.
- **REV-13.** Activating a file opens it in the diff panel. A single diff panel is reused for single clicks; a double click opens a separate one.
- **REV-14.** With base "Since last commit" and a repo present, a commit box sits under the list: a message field pre-filled by `git.suggestMessage`, a "Commit" button (`git.commit` with all listed files) and a "Commit and Sync" button. Both are disabled while `operation` is not `none` (GIT-26).
- **REV-15.** The file row menu: Open File, Open Diff, Show History, Restore Version Before This Change (session base: writes the `before` snapshot back through `history.restore` after confirmation). There is no "discard changes" for the last-commit base, because that would need a git command HSOS does not run (P-5); the menu instead offers "Show History".

### Diff panel

Dock panel `review.diff`. State: `{ path: AbsPath, base: ReviewBase, mode: 'inline' | 'split' }`.

- **REV-20.** Shows `DiffView` for `getDiff`. It refreshes when a `changesInvalidated` arrives and the file's content has changed, keeping the scroll position by anchoring on the first visible line.
- **REV-21.** While the file is being edited by Claude, the diff updates live, at most twice a second.
- **REV-22.** `F7` and `Shift+F7` move to the next and previous change. A change is one hunk: a run of removed and added rows with no unchanged row between them, so a replaced line is one stop. `Alt+Z` switches inline and split. Unchanged stretches longer than 8 lines fold to a "⋯ 42 unchanged lines" row that expands on activation.
- **REV-23.** Hovering or focusing a line shows a "+" control in the gutter. Activating it, or pressing `C` on a focused line, opens a small text box under the line. `Ctrl+Enter` adds a `diff-line` comment; Escape cancels.
- **REV-24.** Lines with comments show a marker in the gutter. Activating it shows the comment with Edit and Remove.
- **REV-25.** Binary files show "Binary file changed" with both sizes.

### Feedback tray

- **REV-30.** The tray is a strip at the bottom of the Changes view, and a status item `review.tray` (left) reading `n comments` when `n` is above zero. Pressing the status item opens the Changes view with the tray expanded.
- **REV-31.** `composePrompt` builds this text, comments in the order they were added:

```
Review feedback (3 comments):

1. src/app.ts line 42
   > const x = 1
   Rename this to `count`.

2. report.html (artifact)
   The chart title is cut off.

3. Element on http://localhost:3000/ matching `button.primary`
   HTML: <button class="primary">Save</button>
   Styles: font-size: 12px; padding: 4px 8px
   Make this button larger.
```

  - A `diff-line` on the `before` side reads `src/app.ts line 42 (removed line)`.
  - Paths are relative to the project, with forward slashes.
  - Comment text and quotes are inserted as written. Line breaks inside a comment are indented to match.
- **REV-32.** The tray lists comments with their target and text. Each can be edited or removed. "Clear all" asks for confirmation.
- **REV-33.** "Send to Claude" writes the composed prompt to the target terminal using xterm's paste path, so bracketed paste applies and the text is not run line by line. It does not press Enter: the owner reads it and sends it. The target is chosen as in HUD-31; with several Claude sessions, a select in the tray picks one.
- **REV-34.** After sending, the tray shows "Sent. Clear comments?" with "Clear" and "Keep". Nothing is cleared automatically.
- **REV-35.** "Copy" puts the composed prompt on the clipboard instead.
- **REV-36.** `addComment` is also called by other modules: `browser` (element capture, BROW-50), `activity` (artifact and file comments), and the file viewer's gutter (a `file-line` comment, with the same "+" control as REV-23).
- **REV-37.** At most 100 comments are kept per project. Adding beyond that returns `BAD_REQUEST` with the message "The feedback tray is full. Send or clear comments first."

## Commands

| Id | Title | Default key |
|---|---|---|
| `review.showChanges` | Show Changes | `Ctrl+Shift+G` |
| `review.nextChange` | Next Change | `F7` |
| `review.previousChange` | Previous Change | `Shift+F7` |
| `review.commentOnLine` | Comment on Line | `C` when a diff line has focus |
| `review.sendFeedback` | Send Feedback to Claude | `Ctrl+Shift+Enter` when the Changes view has focus |

## States

| Panel | Loading | Empty | Error |
|---|---|---|---|
| Changes | skeleton rows | "No changes since the last commit." or "This session has not changed any files." | "Changes could not be read." with the reason and "Retry" |
| Diff | skeleton lines | "No differences." | "This diff could not be shown." with "Retry" |

## Tests

| Rule | Level | Given | When | Then |
|---|---|---|---|---|
| REV-1 | integration | a temp repo with one modified and one new file | `listChanges` with `last-commit` | two files, `modified` and `added`, with line counts |
| REV-1 | integration | a folder that is not a repo | `listChanges` with `last-commit` | an empty list, no error |
| REV-2 | integration | history: file F baseline `a`, then external `b`; session S has a `file-edit` for F | `getDiff` with `session-start` S | before `a`, after `b` |
| REV-2 | integration | a file created by the session, no earlier snapshot | `getDiff` | before null |
| REV-3 | integration | a session edited a file and then edited it back | `listChanges` | the file is absent |
| REV-5 | integration | fake clock | 20 file batches in 200 ms | `changesInvalidated` fires once |
| REV-12 | component | a list with file B selected | the list refreshes with B still present | B is still selected |
| REV-14 | component | a merge in progress | the Changes view renders | both commit buttons are disabled |
| REV-20 | component | a diff scrolled to line 200 | the file gains 3 lines at the top | the same line is still first visible |
| REV-23 | component | a focused diff line | `C`, typing, `Ctrl+Enter` | `addComment` was called with kind `diff-line`, that line and its text |
| REV-31 | unit | three comments of kinds diff-line, artifact, element | `composePrompt` | the output equals the example text exactly |
| REV-31 | unit | a diff-line comment on the `before` side | `composePrompt` | its heading ends with `(removed line)` |
| REV-31 | unit | a comment with two lines of text | `composePrompt` | the second line is indented three spaces |
| REV-33 | component | one comment and a Claude terminal | "Send to Claude" | the terminal's paste was called with the composed prompt; no carriage return was written |
| REV-34 | component | after sending | the tray renders | comments are still listed and the "Clear" choice shows |
| REV-37 | integration | 100 comments | `addComment` | `BAD_REQUEST` |
| P-5 | integration | every test above with a recording git runner | all finish | no forbidden git command was run |
