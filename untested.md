# Untested work

The owner's rule from 2026-11-18 (resuming the run at card 011): implementers write the code only. They do not write or run the card's tests. Each card's test plan goes here, for a testing agent the owner runs later over all the work. Features whose tests are listed here stay `passes: false` in `features.json` until that agent's tests pass.

Each entry names the test file the card asks for, the rule ids, and what each test must show. Test names start with the rule id (protocol rule). Rows come from the module spec's test table.

## 011 Supervisor

Code: `src/main/supervisor/supervisor.ts` (`createSupervisor`), `src/main/supervisor/service-process.ts` (`ServiceProcess`, `ProcessLauncher`, `utilityProcessLauncher`), `src/main/index.ts` (wiring, renderer recovery, stop on quit). Feature F-004.

How to test the supervisor without Electron: pass a fake `ProcessLauncher` that returns objects with `postMessage`, `kill`, `onMessage` and `onExit`, where the test can send `{ type: 'ready' }` and fire exit. Use `createFakeClock` from `tests/fakes/fake-clock.ts` and a real `createBus` on a loopback transport (or `FakeBus`) for `bus`. `hooks` can be plain recorders.

`tests/shell/supervisor.test.ts` (fake launcher, fake clock):

| Rule     | Given                                                 | When                                             | Then                                                                                                                                                                    |
| -------- | ----------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SHELL-4  | a fake service that never sends `ready`               | `start()`, then advance the clock 5 000 ms twice | the launcher was called twice, the first process was killed, and the status is `down` with `needsManualRestart: true`                                                   |
| SHELL-12 | main's bus with a request pending to the fake service | the service exits                                | the request resolves with `SERVICE_DOWN`                                                                                                                                |
| SHELL-13 | a fake service that exits at once each time it starts | `start()` with a fake clock                      | after the sixth death no further launch happens and `needsManualRestart` is true; `shell.restartService` (or `restart(name)`) launches it again and `recentDeaths` is 0 |

`tests/e2e/supervisor.e2e.ts`:

| Rule     | Given              | When                                                                                            | Then                                                                                                                                                                          |
| -------- | ------------------ | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SHELL-10 | the app is running | `workspace-service` is killed (find its pid, kill it)                                           | a crash file appears and the service reaches `ready` again within 5 s. The crash file needs card 013 (DIAG-7); until then, check the restart and the `service_death` log line |
| SHELL-14 | the app is running | the renderer is killed (`webContents.forcefullyCrashRenderer()` through `electronApp.evaluate`) | the window reloads and the `?e2e=1` ping view shows all three services again                                                                                                  |

Also worth a test (not in the card): SHELL-7, `stop()` sends `{ type: 'stop' }` and kills a process still alive after 3 000 ms; a process killed on purpose (ready miss, manual restart) is not counted as a death; `getServiceStatus` lists the three services.
