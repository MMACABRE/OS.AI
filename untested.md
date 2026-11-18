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

## 012 Logging

Code: `src/modules/diagnostics/service/redact.ts` (`redact`, `truncate`), `src/modules/diagnostics/service/file-logger.ts` (`createFileLogger`, `logFile`, `readRecent`), `src/modules/diagnostics/panel/bus-logger.ts` (`createBusLogger`), `src/modules/diagnostics/register.service.ts` (`write` and `getRecent` handlers, `diagnosticsSettings`).

Use a temp folder for `logsDir` and `createFakeClock` for the 500 ms flush timer, or call `flush()` directly.

`tests/diagnostics/logging.test.ts`:

| Rule   | Given                                                             | When                                  | Then                                                                 |
| ------ | ----------------------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------- |
| DIAG-1 | a temp logs folder                                                | a logger writes 3 records and flushes | `<process>.log` has 3 lines, each parses as `LogRecord`              |
| DIAG-2 | a log file of 5 MB (`ROTATE_BYTES`)                               | one more record is flushed            | `<process>.1.log` exists and the live file holds only the new record |
| DIAG-3 | the logs folder is made read-only (or `logsDir` points at a file) | a record is logged and flushed        | no exception, `flush()` resolves, the process continues              |
| DIAG-4 | data `{ authToken: 'abc', nested: { Cookie: 'x' }, name: 'ok' }`  | `redact` runs                         | both secret values are `[redacted]`; `name` is unchanged             |
| DIAG-5 | a 5 000 character string value                                    | `redact` (or `truncate`) runs         | length is 2 000 and it ends with `…`                                 |
| DIAG-6 | `debug` returns false                                             | a debug record is logged and flushed  | nothing is written                                                   |

Also worth a test: `readRecent` returns the newest N records oldest first across `<process>.log` and `<process>.1.log`; `createBusLogger` sends `diagnostics.write` with process `ui` and never throws when the bus call rejects.

## 013 Crash reports and health (blocked on wiring, see PROGRESS.md)

Code: `src/modules/diagnostics/service/crash-reports.ts` (`writeCrashReport`, `cleanCrashReports`, `crashFileName`), `src/modules/diagnostics/service/health.ts` (`toHealth`), `src/modules/diagnostics/register.service.ts` (cleanup at start), `src/services/shared/service-main.ts` (DIAG-8 handlers, `CRASH_EXIT_CODE`).

`tests/diagnostics/crash-reports.test.ts` (temp folders):

| Rule    | Given                                                             | When                                           | Then                                                                                                          |
| ------- | ----------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| DIAG-7  | 300 records logged for `pty-host` and flushed to a temp `logsDir` | `writeCrashReport` runs for a `pty-host` death | `crashDir\<time>-pty-host.json` exists with exactly the last 200 records, the exit code, time and app version |
| DIAG-10 | 60 crash files, 5 of them 40 days old (time in the name)          | `cleanCrashReports(crashDir, now)` runs        | 50 remain and none is older than 30 days                                                                      |

Also worth a test: `toHealth` turns a working set of 2 048 KB into 2 MB and uptime into `now - createdAt`; a service that throws an uncaught exception exits with 70 (needs the app, e2e).

## 013 Crash reports and health, wiring (done with card 014)

The block is resolved with extension points: `processDeathReporters` and `processMetricsSources` in `src/modules/diagnostics/register.service.ts`, re-exported by `src/main/module-list.ts`. main's supervisor calls every death reporter (diagnostics writes the crash file); main contributes a metrics source built from `app.getAppMetrics()` and `getHealth` reads it.

Extra tests for the later agent: with a contribution store, `register` from diagnostics contributes one death reporter, and calling it writes a crash file (DIAG-7 end to end); `getHealth` returns the rows of a contributed fake metrics source (DIAG-9). The SHELL-10 e2e row of card 011 can now check the crash file.

## 014 Module loader and contexts

Code: `src/modules/shell/loader/load-modules.ts` (`loadModules`, `ModuleEntry`), `src/modules/shell/loader/service-context.ts` (`createServiceContext`, `createContributionStore`, `createDataPaths`, `environmentDataPaths`, `defaultSettingsReader`), `src/modules/shell/loader/ui-context.ts` (`createUiContext`, `createUiRegistry`), the module lists `src/main/module-list.ts`, `src/services/*/module-list.ts`, `src/ui/module-list.ts`, and `runService` in `src/services/shared/service-main.ts`.

`tests/shell/loader.test.ts`:

| Rule            | Given                                                        | When                                                 | Then                                                                                                                    |
| --------------- | ------------------------------------------------------------ | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| SHELL-20        | a list of three modules where the second's `register` throws | `loadModules` runs with a recording logger           | modules one and three registered, in order; one `error` record names the second; the return value is the two loaded ids |
| extension point | a contribution store                                         | two modules contribute `'a'` then `'b'` to one point | `contributions(point)` returns `['a', 'b']`                                                                             |

Also worth a test: `createUiRegistry` throws on a second panel, command or status item with the same id; `createDataPaths('C:\cfg', 'C:\loc').workspaceFile(id)` is `C:\cfg\workspaces\<id>.json`; `registerSettings` returns the section defaults until card 016.

## 015 Window

Code: `src/main/window/bounds.ts` (`restorePlacement`, `centredDefault`, `readPlacement`, `writePlacement`), `src/main/window/main-window.ts` (`createMainWindow`, `loadRenderer`), `src/main/system/system-channels.ts` (`registerSystemChannels`, `OPENABLE_EXTENSIONS`, `createLaunchToken`), `src/main/index.ts` (single-instance lock). Feature F-005.

`tests/shell/bounds.test.ts`:

| Rule    | Given                             | When                    | Then                                                                  |
| ------- | --------------------------------- | ----------------------- | --------------------------------------------------------------------- |
| SHELL-6 | saved bounds outside all displays | `restorePlacement` runs | the result is 1280 by 800, centred on the primary display's work area |

Also: saved bounds on a second display are kept; `writePlacement` keeps other keys of `app.json`, writes `app.json.bak`, and refuses a file whose `version` is higher than 1.

`tests/shell/system-channels.test.ts` (a `FakeBus` or a real bus on a loopback transport, fakes for `ShellApi` and `WindowApi`):

| Rule     | Given                           | When                                                               | Then                                                                                            |
| -------- | ------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| SHELL-21 | the fake shell                  | `openExternal` with `http://x.test` and with `file:///C:/x`        | both return `BAD_REQUEST`; `https://x.test` calls the fake's `openExternal`                     |
| SHELL-26 | a token passed as `launchToken` | `getLaunchToken` called with `meta.from` `ui`, then `link-service` | `ui` gets `BAD_REQUEST`; `link-service` gets the token; the token never appears in a log record |
| SHELL-27 | the fake shell                  | `openPath` with `C:\a\run.exe`, `C:\a\x.ps1`, `C:\a\doc.PDF`       | the first two return `BAD_REQUEST` and the fake is not called; the PDF opens                    |

Also: SHELL-22 a failing `trashItem` returns `FILE_WRITE_FAILED`; SHELL-23 `notify` does nothing while the window is focused and, when clicked, focuses and emits `workspace.focusPanelRequested`; SHELL-30 `openFolder` refuses a file.

`tests/e2e/window.e2e.ts`: SHELL-1 (a second launch exits and the first window gets focus; one window exists), SHELL-24 (`window.location.href = 'https://x.test'` and `window.open(...)` from the page leave the URL unchanged and open no window). F-005 also needs: move the window, restart, it reopens in the same place.

## 016 Settings files

Code: `src/modules/settings/service/atomic-json.ts` (`readJson`, `writeJsonAtomic`), `src/modules/settings/service/settings-store.ts` (`createSettingsStore`), `src/modules/settings/register.service.ts` (channels, `CONTRACT_SECTIONS`, `settingsStorePoint`), `registerSettings` in `service-context.ts`, main's start in `src/main/index.ts`.

`tests/settings/settings-store.test.ts` (temp folder for the settings file, `createFakeClock`): every row SET-2 to SET-7 of the spec's test table (SET-2 merge over defaults; SET-3 bad `fontSize` gives the default and one problem at `values.terminal.fontSize`; SET-4 unknown key kept on disk after `setValue` plus one "Unknown setting"; SET-5 `{ not json` leaves bytes unchanged with one problem, and `setValue` then writes `settings.json.invalid-*` and a valid file; SET-6 a value over max returns `SET_INVALID` and the file is unchanged; SET-7 `settings.json.bak` holds the old content and the reader's listener fired once). Also: a missing file is created as `{ "version": 1, "values": {} }`; a value equal to the default is removed from the file; `version: 2` is not loaded.

## 017 Settings live reload

Code: `src/modules/settings/service/settings-watcher.ts` (`watchSettingsFiles`, `QUIET_MS`), `src/modules/settings/service/remote-settings.ts` (`createRemoteSettingsReader`), the watcher in `src/modules/settings/register.service.ts`, `registerSettings` in `runService` (`src/services/shared/service-main.ts`). Feature F-006.

`tests/settings/live-reload.test.ts`:

| Rule  | Given                                                                 | When                                                             | Then                                                                                                   |
| ----- | --------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| SET-8 | a store and `watchSettingsFiles` on a temp config folder (real clock) | `settings.json` is rewritten on disk                             | `onChange('settings')` runs once, and after `store.load()` the reader's listener fires within 1 000 ms |
| SET-9 | two registered sections                                               | only the first one's values change on disk and the store reloads | only the first section's listener fires                                                                |

Also: several writes within 200 ms give one `onChange`; `createRemoteSettingsReader` on a `FakeBus` returns defaults, then the `getSection` value, then follows `sectionChanged` for its own module only, and ignores a value that fails the schema.

## 018 Themes

Code: `resources/themes/phosphor.json`, `tests/fixtures/themes/test-light.json`, `resources/fonts/` (VT323, Jersey 10, OFL texts), `src/ui/fonts.css`, `src/modules/settings/service/theme-store.ts` (`createThemeStore`, `resolveTheme`, `themeSlug`), `src/modules/settings/panel/apply-theme.ts` (`applyTheme`, `applyMotion`), `src/modules/settings/register.ui.ts`, theme channels in `register.service.ts`, main's background and zoom in `src/main/index.ts`. Feature F-007.

`tests/settings/theme-store.test.ts` (temp `themesDir`, `builtInDir` pointing at `resources/themes`):

| Rule   | Given                                   | When                                    | Then                                                               |
| ------ | --------------------------------------- | --------------------------------------- | ------------------------------------------------------------------ |
| SET-11 | `theme: "Nope"`                         | `active('Nope')` and `problems('Nope')` | Phosphor is active; one problem                                    |
| SET-12 | a theme setting only `color.accent`     | `resolveTheme`                          | `color.accent` is the theme's; every other token equals Phosphor's |
| SET-14 | a token value `red; background: url(x)` | `resolveTheme`                          | the token keeps Phosphor's value; one problem                      |
| SET-16 | a theme named "Phosphor"                | `save`                                  | `SET_INVALID`; no file written                                     |

Also: `save` of "My Theme 2" writes `my-theme-2.json`; `load` copies `phosphor.json` into `themesDir` overwriting an edited copy.

`tests/settings/apply-theme.ui.test.tsx` (jsdom):

| Rule   | Given                                                            | When          | Then                                                                      |
| ------ | ---------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------- |
| SET-13 | the resolved test-light theme                                    | `applyTheme`  | `--color-bg-app` on `:root` is `#F4F1EA` and `data-theme-kind` is `light` |
| SET-15 | `reduceMotion: 'on'`; then `'off'` with the system preference on | `applyMotion` | the root has `data-motion="reduced"`; then `data-motion="full"`           |

F-007 (e2e, card 025 covers it): copy `test-light.json` into `themesDir`, set `theme`, `--color-bg-app` changes without a reload.
