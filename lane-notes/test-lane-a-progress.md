# Test lane A progress

## 011 Supervisor

- File: tests/shell/supervisor.test.ts
- Covered: SHELL-3 (getServiceStatus), SHELL-4, SHELL-7 (stop, kill after 3000 ms), SHELL-10 (death reported, deliberate kill not a death, unit part only), SHELL-12, SHELL-13 (six deaths, restart, restartService, 60 s window).
- Skipped: tests/e2e/supervisor.e2e.ts rows SHELL-10 (kill workspace-service, crash file) and SHELL-14 (renderer crash reload): e2e, Playwright not run in this lane.

## 012 Logging
- File: tests/diagnostics/logging.test.ts
- Covered: DIAG-1 (incl. readRecent across rotation, createBusLogger), DIAG-2 (rotation, four kept), DIAG-3 (unwritable folder, unserialisable record, bus logger never throws), DIAG-4, DIAG-5, DIAG-6.
- Skipped: none.
