# Lane H2 progress: e2e rows (untested.md)

Branch lane-h2, worktree C:\Users\H.2\Desktop\OS.AI-lane-h2. Build: `npm run build` before `npx playwright test <file>`, one file at a time.

## Per item
- 015 Window: `tests/e2e/window.e2e.ts`: SHELL-1 (second launch exits, one window, focused), SHELL-24 (navigation and window.open refused), F-005 (moved, restarted, same place; size drift allowed 10 px, see h2-bugs). Committed in df784bb.
- 011 Supervisor: `tests/e2e/supervisor.e2e.ts`: SHELL-10 with F-004 (kill workspace-service, crash file `*-workspace-service.json`, new pid, ping answers within 5 s), SHELL-14 (forcefullyCrashRenderer, page reloads, three pongs). Committed in df784bb.
- 013 Crash reports: DIAG-8 is `test.fixme` (harness gap, see h2-bugs). Committed in df784bb (fixme).
- 025 Stage 0: `tests/e2e/stage-0.e2e.ts`: REL-7 with P-32, F-008, F-007, F-006, F-009. SHELL-14 is covered in supervisor.e2e.ts (same check as item 4 of the card). 5 of 5 pass. Committed 9e5030d.
- 018 Themes: F-007 in stage-0.e2e.ts.
- 023 Command palette: F-008 in stage-0.e2e.ts. Note from untested.md: the example is "set" matches "Open Settings".
- 024 Settings screen: F-009 in stage-0.e2e.ts. Uses a 2-char path (`ab`) as the invalid value, not a number above max, so the open SET-6 question (clamp or reject) is not touched.
- 027 Motion and background: `tests/e2e/background.e2e.ts`: UI-32 minimised and reduced rows are fixme (app bugs, see h2-bugs). The CPU budget row (reference machine, 60 s idle) was not run: needs the reference machine. Not covered.
- 028 App frame and pages: `tests/e2e/demo-pages.e2e.ts`: MOT-5 (one view transition per Ctrl+1, counted as a delta after startup), MOT-7 (canvas same node, frames never fall), MOT-11 (typed char reaches the input while the transition is still open), WS-41 (terminal node and output kept after Dashboard round trip; demo terminal does not print a line every 100 ms, so only the text kept is checked). 4 of 4 pass. Committed 769ba1f.
- 035 Dashboard: `tests/e2e/demo-dashboard.e2e.ts` (committed c852ede): DASH-13 is fixme (focus does not reach the terminal, see h2-bugs). View transition check (MOT-6) not built, not checked.
- 025 item 5 (`npm run dist`): SKIPPED, per the lead's instruction.
- 037 demo tour: SKIPPED, per the lead's instruction.

## Choices
- Helpers in `tests/e2e/support/app.ts` (profile, launch, backdrop probe). Not matched by testMatch.
- Worker stats come from a `Worker` wrapper installed with addInitScript, using the same `stats` message the app's client uses. No src change.
- After a renderer crash the Playwright page is lost, so SHELL-14 reads the page from the main process (`webContents.executeJavaScript`).
- Processes are identified by `metric.name`, because `serviceName` is wrong (see h2-bugs).

## Commit notes
- The pre-commit check failed on tests/files/parcel-file-watcher.test.ts (load-flaky). Each commit was retried after a 45 s wait, without touching the test or the hook. Commits went through as: df784bb (window, supervisor), 9e5030d (stage-0), 769ba1f (demo-pages), 41db64a (background), c852ede (demo-dashboard).

## Not done
- SET-6 open question: not an e2e row.
- UI-32 CPU budget: needs reference machine.
- DIAG-8: needs a trigger.
