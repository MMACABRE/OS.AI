## 033 Git, changes, feedback and activity
Status: done (untested)
Date: 2026-11-19
Did: Built the git changes status item (`git.changes`, count of changed files), the sync and fetch commands, the Changes side view (base select, changed-file list with change letters and counts, context menu, commit box with the suggested message, Commit and Commit and Sync), the feedback tray (comments with edit and remove, Clear all, target select among live Claude sessions, Send to Claude as a bracketed paste with no Enter, Copy), the diff panel (`review.diff`: inline diff, folds, F7 and Shift+F7, a comment box on a line from its "+" control or C, comments shown under their line), the tray count (`review.tray`), the Activity side view (day sections, group rows, cause and session filters, new-entry chip, load more on scroll, context menu with restore before and pin) and the Artifacts side view (search, tiles, tile menu). Registered git, review and activity in `src/ui/module-list.ts`.
Checks: typecheck ok, lint ok, deps ok, build ok, test not run (implementer rule), e2e not run
Deviations:
- git: the title bar button (branch, ↑n ↓n, sync, offline tooltip) is not built. Modules have no title-bar slot; `workspace/panel/TitleBar.tsx` owns it.
- git: the `git.changes` status item opens the first changed file's diff, not the Changes side view. A module cannot switch side views (the side store is in `workspace`). The Lead should add a way for a module to show a side view, then point the item at it.
- git: only `git.sync` and `git.fetch` are registered. Commit All Changes (Ctrl+Enter), New Claude Session in Worktree, Sign in and Initialize are not built.
- git: failures of the sync and fetch commands go to a Windows notification (`shell.notify`), because commands run outside the React tree and have no toast. GIT_AUTH_REQUIRED has no sign-in action.
- review: the `review.tray` status item only shows "n comments"; it is not a button (see the side-view note above). `review.showChanges`, `review.nextChange`, `review.previousChange` and `review.sendFeedback` are not registered as commands. F7 and Shift+F7 work inside the diff panel only.
- review: the base select lists every session of the project, not only those that edited files (REV-10). Finding edited files needs `link.getSessionEvents` for each session; not done.
- review: "Restore Version Before This Change" (REV-15, session base) is not built. The review data gives no snapshot ids.
- review: the diff panel has no inline and split toggle (Alt+Z, REV-22) and does not poll at two updates a second while Claude edits (REV-21). It refreshes on `changesInvalidated`. It does not keep the scroll position across a refresh (REV-20 asks for it); the test row for it is therefore not a pass yet.
- review: every open of a changed file adds a diff panel (`allowMultiple: true`); the single reused preview panel of REV-13 needs a dock API the renderer does not expose.
- review: binary files show "Binary file changed." without the sizes (REV-25), because `getDiff` gives no sizes.
- review: the feedback tray is at the foot of the Changes view, not a strip reached from the status item (REV-30). Edit uses an inline field; Escape does not cancel it.
- review and history: the diff code is a copy (`line-diff.ts`, `DiffView.tsx`). The spec puts one `DiffView` in ui-kit. The Lead should move it there.
- review: the `use-repo.ts`, `helpers.ts` and `data.ts` (with `gitMessage` and `loadSessions`) are copies of helpers in git and sessions. The Lead should move the shared ones.
- activity: the Activity tab dot (ACT-34) is not built. The commands `activity.showTimeline`, `activity.showArtifacts` and `activity.pinActiveFile` are not registered (they cannot switch side views either).
- activity: artifacts have no thumbnails. Images show the image icon, not the picture; the `hsos-file:` scheme does not exist yet. An image opens in the file viewer, which shows its notice.
- activity: the artifact grid uses `minmax(9rem, 1fr)` columns, not the "two across, one under 260 px" rule (ACT-30).
- activity: "Pin comment" asks for the comment text in a small dialog first (the review service needs text); the spec does not say how the text is given.
- activity: the session select lists the sessions in the loaded page only.
- Shared files: `src/ui/module-list.ts` was edited (the Lead asked for it), though the card's file list does not name it.
Next: the card after 033 (the 037 gate is later; the coordinator decides)
