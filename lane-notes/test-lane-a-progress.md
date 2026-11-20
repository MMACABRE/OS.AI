# Test lane A progress

## 011 Supervisor

- File: tests/shell/supervisor.test.ts
- Covered: SHELL-3 (getServiceStatus), SHELL-4, SHELL-7 (stop, kill after 3000 ms), SHELL-10 (death reported, deliberate kill not a death, unit part only), SHELL-12, SHELL-13 (six deaths, restart, restartService, 60 s window).
- Skipped: tests/e2e/supervisor.e2e.ts rows SHELL-10 (kill workspace-service, crash file) and SHELL-14 (renderer crash reload): e2e, Playwright not run in this lane.

## 012 Logging
- File: tests/diagnostics/logging.test.ts
- Covered: DIAG-1 (incl. readRecent across rotation, createBusLogger), DIAG-2 (rotation, four kept), DIAG-3 (unwritable folder, unserialisable record, bus logger never throws), DIAG-4, DIAG-5, DIAG-6.
- Skipped: none.

## 013 Crash reports and health (both sections)
- File: tests/diagnostics/crash-reports.test.ts
- Covered: DIAG-7 (200 records, exit code, time, version; no log; unwritable folder; death reporter wiring end to end), DIAG-9 (toHealth, getHealth with a contributed metrics source), DIAG-10 (50 left, none older than 30 days; cleanup at register).
- Skipped: "a service that throws an uncaught exception exits with 70" (DIAG-8): needs the app (e2e).

## 014 Module loader and contexts
- File: tests/shell/loader.test.ts
- Covered: SHELL-20 (throwing register skipped, order, ids returned, error record names the module), extension point contributions order, createUiRegistry duplicate panel/command/status item, createDataPaths workspaceFile, registerSettings defaults, openPanel before opener.
- Skipped: none. (Rule id of the "extension point" row is not in the card table; tests use SHELL-20 as the loader rule id.)
