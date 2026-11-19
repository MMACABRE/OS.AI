## Lead fixes after the lane B merge: files, history, git, review, activity
Status: done (untested)
Date: 2026-11-19
Did: Refreshes keep the old data on screen in Changes, Activity, the history timeline and the Files tree (loading shows only for a first read or a project or file switch). The controls stay visible when a list is empty. Changes opens diffs on activation, offers only sessions that edited files, resets on a project switch, guards commit and maps paths to repo-relative. Git status is one shared subscription per module; git.sync stops during a merge, rebase or cherry-pick; the status item shows the operation and "Offline" and opens the Changes view. The Files tree no longer shows stale or late listings; Activity pages without skipping entries; Artifacts debounce, show open errors and reset per project; the tray edits in a textarea and clears "Sent"; the restore toast has Undo; show Changes, Activity and Artifacts commands are registered.
Checks: typecheck ok, lint ok, deps ok, test not run (implementer rule), e2e not run
Deviations:
- History still shows the size change in bytes: `Snapshot` has no line count (HIST-40 asks for lines).
- Undo on the restore toast restores the row under the new "restore" row of `listForFile`; the contract has no call that returns the pre-restore snapshot id.
- `review.nextChange`, `review.previousChange`, `review.commentOnLine`, `review.sendFeedback` and `activity.pinActiveFile` are still not registered (they need the focused diff or active file, which a module cannot read).
- Activity paging asks `before = last.time + 1` and drops known ids, because `before` takes only a time. It stops paging when a page adds nothing new.
- The session list for the Changes base reads `link.getSessionEvents` for every session of the project, on each refresh.
- The ChangesView and git hooks are two copies of one store, one per module, because a module may not import another.
- `review.showChanges` has no shortcut conflict check against other modules (`Ctrl+Shift+G` is the spec's).
Next: Lead review and merge
