# Lane H4 progress

Branch lane-h4, worktree C:\Users\H.2\Desktop\OS.AI-lane-h4. Task: empty untested.md (prune, fix the src bugs the lanes found, write the missing rows, leave the rest for the Lead).

## Items (one commit each)

- HUD-37 "For this project only" saves the chosen state: fixed in SkillsSection.tsx (chosen state kept per skill). Test added to tests/hud/hud.ui.test.tsx. Commit 0f93f7e.
- HUD-16 spoken alerts toggle toast: register.ui.ts shows "Spoken alerts on/off" (error toast when the save fails). ui-kit gets showToast (toasts from outside React go to the most recently mounted ToastProvider). Test added. Commit 3bfa360.
- DASH-9 Undo for 5 s: ToastInput takes duration; DashboardPage removal toast sets UNDO_MS (5000). ui-kit default stays 4 s (Lead decision). Test added. Commit 3838a4e.
- DASH-13 ribbon focus: the session widgets (ribbon, mascot) open the session's terminal panel and focus it once the Code page is shown. DockHost shows an existing terminal panel instead of opening a second one. Test: e2e un-fixmed, plus a new e2e (no second panel). Commit 67102c3.

## Choices and notes

- HUD-37: the two scope items stay gated on stateSource 'default' (spec). The state picked is remembered per skill, so "For this project only" saves it.
- HUD-16: showToast uses a stack of mounted providers; the sessions picker mounts its own provider, so a toast from a command goes to the picker's provider while the picker is open.
- DASH-13: the e2e waits for the running terminals to be reopened at start (added line). Without it the startup restore (terminal register, async openPanel) switches the page back to Code about 300 ms after Ctrl+1. Recorded in lane-notes/h4-bugs.md.
- Flaky under load (not owned by this lane): tests/files/parcel-file-watcher.test.ts (expected), tests/sessions/sessions-fixes.ui.test.tsx (SESS-71 order), tests/demo/gallery.ui.test.tsx (5 s default timeout once), tests/files/file-viewer.ui.test.tsx (a CodeMirror measure error once). The commit helper retries on these.

- UI-32 reduced motion: worker loop checks a running flag, so a queued frame cannot draw after a stop. e2e row un-fixmed; it waits for the theme settings first. Commit 4f025f0.
- UI-32 minimised: NOT fixed. Measured: a minimised window still presents frames intermittently (renderer rAF stops ~2.7 s, then bursts ~1.3 s), and document.visibilityState stays visible. A renderer-only stall detector flapped and did not hold. The only minimise signal, shell.windowState, has no minimised flag and spec/contracts is spec's. Row stays test.fixme. Left for the Lead.
- DIAG-9: process mapping moved to processMetricsFrom (diagnostics/service/health.ts), matches by metric.name. Unit test added. Commit 392dfc6.
- DIAG-8: un-fixmed. Launcher (main/supervisor/service-process.ts) gives HSOS_E2E_THROW_SERVICE to the first launch only, never in a packaged app; service-main throws once after ready. Test body rewritten to use the variable (the NODE_OPTIONS hook is gone). tests/e2e/support/throw-once.cjs is now unused, but the guard refuses to delete it, so it stays. Commit 11b2ed3.
- SHELL-6: NOT fixed. Content-based save fixes the size but moves the outer x by 1 px, which breaks F-005 (existing test). Outer-position-plus-measured-border variants gave 1101 and 1104. Test added as test.fixme. Commit fc60093. Left for the Lead.
- Themes (ThemesSection live refresh, zero-width inactive names): NOT started.
- GRAPH-29, GRAPH-52: NOT started.
- MOT-6 shared-element transition: not built (feature, not a bug fix).
- Prune of untested.md, deletion of test-lane-b/c-bugs.md, final untested.md rewrite, dist run: NOT done.

## Startup race (src bug, not fixed)
The terminal register's async openPanel of running terminals (src/modules/terminal/register.ui.ts) runs after start. In demo it lands about 300 ms after the first Ctrl+1 and switches the page back to Code. DASH-13's e2e waits for the restored terminals before switching pages.

## Flaky under load (not owned by this lane)
parcel-file-watcher (expected, fails most full runs), sessions-fixes SESS-71 (order), gallery.ui 5 s timeout (once), file-viewer.ui CodeMirror error (once). The commit helper retried them.

## Test runs at the last full check
- vitest full: 82 files, 638 of 639 pass; only parcel-file-watcher fails (known flaky).
- playwright: supervisor 3/3, window 3 pass + 1 skipped (SHELL-6 fixme), background 1 pass + 1 skipped, demo-dashboard 2/2, stage-0 and demo-pages passing at baseline.
- claude: Get-Command claude resolves to C:\Users\H.2\.local\bin\claude.exe, not a repo stub. No e2e test opens a terminal in non-demo mode, so no test spawns claude. There is no repo stub file.
