# Progress

## 001 Project skeleton
Status: done
Date: 2026-11-18
Did: Created the project configuration, the guard hook, init script, empty main, preload, renderer and three service entries, and the smoke test. The window opens showing HSOS.
Checks: typecheck ok, lint ok, deps ok, test 1 passed, e2e 0 passed
Deviations: TypeScript 7.0.2 has no JavaScript compiler API, and typescript-eslint 8.73.0 and dependency-cruiser 18.8.0 refuse it. `scripts/typescript6.mjs` (a file not in the card) is a resolve hook that gives those two tools the official `@typescript/typescript6` 6.0.2 package; `tsc` stays on 7.0.2. `.npmrc` sets `legacy-peer-deps=true` so the two TypeScript versions install side by side. `package.json` also lists packages the stack table does not name but later cards need and cannot add (only this card may change `package.json`): `@typescript/typescript6`, `@vitejs/plugin-react`, `typescript-eslint`, `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`, `@types/node`, `@types/react`, `@types/react-dom`, `@types/better-sqlite3`, `@types/write-file-atomic`, and the Radix siblings `react-dropdown-menu` 2.2.1, `react-tooltip` 1.4.1, `react-popover` 1.3.1, `react-context-menu` 2.4.1. The preload builds to `out/preload/index.cjs` because a sandboxed preload must be CommonJS. `tsconfig.node.json` includes the DOM lib because the preload uses `window`. `.gitignore` also ignores `.crew/`, `test-results/` and `playwright-report/`; Playwright only matches `*.e2e.ts`. Building node-pty for Electron needs the Visual Studio component `VC.14.51.x86.x64.Spectre` (installed by the owner), and `npm ci` fails under a shell that sets `NoDefaultCurrentDirectoryInExePath` (node-pty's `GetCommitHash.bat`).
Next: 002

## 002 Spike: node-pty in a utility process
Status: done
Date: 2026-11-18
Did: `createNodePtyFactory` wraps node-pty as `PtyProcess`. pty-host starts powershell.exe, echoes `spike-ok` and exits after 3 seconds; main forks the services as utility processes and forwards their output. The built app logs `spike-ok` from pty-host.
Checks: typecheck ok, lint ok, deps ok, test 2 passed, e2e 0 passed
Deviations: pwsh is not installed here, so the spike and test use powershell.exe as the card allows. Main forks all three services in a loop so card 003's service also starts without changing main again. Killing the shell makes node-pty's console-list helper print "AttachConsole failed" to stderr; the test still passes and the exit event arrives.
Next: 003

## 003 Spike: SQLite in a utility process
Status: done
Date: 2026-11-18
Did: workspace-service opens a database in the temp folder, writes and reads a row, logs it and deletes the file. The built app logs `{"id":1,"text":"sqlite-ok"}`; the same runs in plain Node in the test.
Checks: typecheck ok, lint ok, deps ok, test 3 passed, e2e 0 passed
Deviations: none
Next: 004

## 004 Spike: file watcher on Windows
Status: done
Date: 2026-11-18
Did: `createParcelFileWatcher` implements `FileWatcher` with @parcel/watcher, mapping create, update and delete, with `exclude` as `ignore`. Create, change, rename (as delete plus create) and delete in `a/b/` arrive within 2 seconds; nothing arrives under `node_modules`.
Checks: typecheck ok, lint ok, deps ok, test 4 passed, e2e 0 passed
Deviations: none
Next: 005

## 005 Spike: message ports to a utility process
Status: done
Date: 2026-11-18
Did: main creates a `MessageChannelMain` once the page loads, posts one end to pty-host and the other through the preload to the page. pty-host sends 1 000 numbered 10 000-byte `Uint8Array` messages; the page checks order and size and shows `ports-ok 10000000`.
Checks: typecheck ok, lint ok, deps ok, test 4 passed, e2e 1 passed
Deviations: pty-host no longer exits after 3 seconds (it now holds the port); the card 002 shell is still killed after 3 seconds.
Next: 006

## 006 Spike: page view and DevTools Protocol
Status: done
Date: 2026-11-18
Did: A `WebContentsView` in session `persist:hsos-browser-spike` loaded `<h1>spike</h1>`, the debugger attached with 1.3, and `Page.captureScreenshot` returned data (the e2e test passed). As the card says, the spike code is removed from main and the test is kept with `test.skip`.
Checks: typecheck ok, lint ok, deps ok, test 4 passed, e2e 1 passed, 1 skipped
Deviations: the view loads the HTML as a `data:` URL directly instead of `about:blank` first.
Next: 007

## 007 Spike: dock layout round trip
Status: done
Date: 2026-11-18
Did: In jsdom, a dockview with two groups and three panels goes through `toJSON` and a second dockview's `fromJSON`; panel ids and their groups match.
Checks: typecheck ok, lint ok, deps ok, test 5 passed, e2e 1 passed, 1 skipped
Deviations: jsdom has no `ResizeObserver`; the test defines an inert one, since dockview only needs it to exist.
Next: 008

## 008 Contract helpers
Status: done
Date: 2026-11-18
Did: Pinned ok, err (with and without details), newId (length, alphabet, injected random), toAbsPath, toRelPath and tokenToCssVariable.
Checks: typecheck ok, lint ok, deps ok, test 14 passed, e2e 1 passed, 1 skipped
Deviations: none
Next: 009

## 009 Bus core
Status: done
Date: 2026-11-18
Did: `createBus` routes by channel owner, runs own-process calls directly with the same validation, validates requests, responses and events, converts throws to INTERNAL, times out with the injected clock, and resolves pending calls with SERVICE_DOWN through `failPending`. `createLoopbackTransport`, `FakeClock` and `FakeBus` support the tests.
Checks: typecheck ok, lint ok, deps ok, test 27 passed, e2e 1 passed, 1 skipped
Deviations: `Transport.onMessage` listeners also receive the sending peer, so `meta.from` comes from the transport (BUS-7). `createBus` returns `BusClient`, the `Bus` plus `failPending(owner)`, which the supervisor needs for BUS-4. `BusOptions.owns` lets the fake bus handle channels of any owner. Batch 1 Tester findings for the spec author: `scripts/guard.mjs` checks removed lines only in `*.test.ts(x)`, so lines removed from `tests/e2e/*.e2e.ts` pass; and it runs from the working tree. The reference file is copied unchanged as the card says.
Next: 010

## 010 Bus between processes
Status: done
Date: 2026-11-18
Did: `createPortTransport` runs the bus over a browser or Electron message port. The broker in main routes requests to their channel's owner (an owner index built from every channel declaration in the contracts), answers back to the sender, and fans events out. `startServiceRuntime` builds each service's bus on its parent port and on the renderer's port and sends `ready`. The renderer bus picks main (IPC) or a service (its port) by channel owner and swaps a service's port when a new one arrives. The renderer calls `shell.ping` on all three services and gets three answers.
Checks: typecheck ok, lint ok, deps ok, test 27 passed, e2e 2 passed, 1 skipped
Deviations: For the spec author: a `MessagePort` cannot cross the context bridge as an argument (it arrives as a plain object without `postMessage`), so `onServicePort` cannot hand the port over. The preload posts each port to its own window with `window.postMessage` (target `*`, because a `file:` page has an opaque origin), the renderer bus takes it only when `event.source === window`, and `onServicePort` only gives the service name. Files outside the card's list: `src/main/index.ts` (broker wiring), `src/ui/index.tsx` (renderer bus, `?e2e=1` ping view), the three service entries (now on `startServiceRuntime`; the card 002 and 003 spikes leave the entries, their tests stay), `src/modules/shell/bus/ping-channel.ts` (the test-only channel), `src/modules/shell/system-clock.ts` (the real `Clock`). The card 005 e2e test still passes: pty-host sends its raw messages beside the bus, which ignores non-envelopes. A utility process with only a parent port listener exits at once, so the runtime holds an interval timer. Main passes `--hsos-version` and `--hsos-packaged` to the preload for `platform`.
Next: 011

## 011 Supervisor
Status: done (untested)
Date: 2026-11-18
Did: `createSupervisor` starts the three services through a `ProcessLauncher`, marks each `ready` on `{ type: 'ready' }` (SHELL-3), kills and restarts a service that misses the 5 000 ms deadline and marks a second miss `down` with `needsManualRestart` (SHELL-4), restarts a dead service at once and reports the death (SHELL-10), fails pending calls with `failPending` (SHELL-12), stops automatic restart at the sixth death in 60 seconds (SHELL-13), sends `stop` and kills after 3 000 ms (SHELL-7), and handles `getServiceStatus`, `restartService` and `serviceStatusChanged`. Main sends a fresh service port when a service becomes ready (SHELL-11), reloads a lost renderer and asks Reload or Quit on the third loss in 60 seconds (SHELL-14), and reloads a renderer unresponsive for 10 seconds (SHELL-15).
Checks: typecheck ok, lint ok, deps ok, test 27 passed, build ok, e2e not run
Deviations: Owner's rule from this session: implementers write code only, no tests written or run. The card's tests (`tests/shell/supervisor.test.ts`, `tests/e2e/supervisor.e2e.ts`) are described in the new root file `untested.md` for a later testing agent, so F-004 stays `passes: false`. `untested.md` is outside the card's file list. `reportDeath` only logs `service_death` until card 013 writes the crash report. Service ports are now sent when a service is ready or when the renderer finishes loading, not on every load for every started service. A renderer reloaded for being unresponsive is crashed first with `forcefullyCrashRenderer` (Electron's documented way to reload a hung renderer); that crash does not count as a loss.
Next: 012

## 012 Logging
Status: done (untested)
Date: 2026-11-18
Did: `redact` replaces every string under a key naming a secret, at any depth, with `[redacted]` and cuts other strings to 2 000 characters (DIAG-4, DIAG-5). `createFileLogger` buffers records and appends them to `<process>.log` every 500 ms and on `close`, rotates at 5 MB up to `.4.log` (DIAG-1, DIAG-2), swallows every write failure (DIAG-3) and drops `debug` records unless the setting is on (DIAG-6). `readRecent` reads the newest records back across rotations. The renderer's `createBusLogger` sends records with `diagnostics.write`. `register` adds the `diagnostics` settings section and handles `write` (into `ui.log`) and `getRecent`.
Checks: typecheck ok, lint ok, deps ok, test 27 passed, e2e not run
Deviations: Tests not written (owner's rule, see card 011); the test plan is in `untested.md`. `register.service.ts` imports `zod` for its settings schema although the module spec allows no third-party package; every settings section needs a zod schema (`SettingsSection.schema`). No process uses the file logger yet: wiring it into main and the services is outside this card's files (card 014's `ServiceContext.log` is the natural place). For card 014: `register` handles main-owned channels, so if `diagnostics` is also in `workspace-service`'s module list, `bus.handle` throws there (SHELL-18) and the loader skips the module (SHELL-20).
Next: 013

## 013 Crash reports and health
Status: blocked
Date: 2026-11-18
Did: `writeCrashReport` writes `crashDir\<time>-<process>.json` with process, exit code, time, app version and the last 200 records read from the log files (DIAG-7). `cleanCrashReports` removes crash files older than 30 days, then all but the newest 50; `register` runs it at start (DIAG-10). `startServiceRuntime` logs an uncaught exception or unhandled rejection with its stack and exits with 70 (DIAG-8). `toHealth` maps per-process metrics to `ProcessHealth` rows (DIAG-9).
Checks: typecheck ok, lint ok, deps ok, test 27 passed, e2e not run
Blocked: the spec does not say how main's supervisor reaches the diagnostics module, and I did not choose. (1) The card says the supervisor calls the crash report on each death, but no channel or extension point for it exists in the contracts, and architecture §4 allows main to name a module only in `module-list.ts`. The supervisor's `reportDeath` hook in `src/main/index.ts` still only logs. (2) `getHealth` (DIAG-9) needs every process's pid, memory and start time, which only Electron's `app.getAppMetrics()` in main gives; diagnostics may import no package (module spec), and `ServiceContext` has no such source. The `getHealth` handler is therefore not registered. Options for the spec author: an extension point in `contracts/channels/shell.ts` (for example `serviceDeathObservers` and a `processMetrics` source) that diagnostics fills from `register` and main reads; or a main-only channel such as `diagnostics.reportDeath` called by the supervisor over main's own bus, plus the app version and metrics given to diagnostics through the context.
Deviations: Tests not written (owner's rule); the test plan is in `untested.md`. Crash file names use the time in epoch milliseconds.
Next: 013 (unblock), then 014

## 013 Crash reports and health
Status: done (untested)
Date: 2026-11-18
Did: Resolved the block above by my own choice (the owner asked for no questions until the end of the project): diagnostics declares two extension points in its `register.service.ts`, `processDeathReporters` (diagnostics contributes the crash file writer; main's supervisor calls each reporter on a death, DIAG-7) and `processMetricsSources` (main contributes a source built from `app.getAppMetrics()`; `getHealth` reads it, DIAG-9). `src/main/module-list.ts` re-exports both, so main still names the module only in its module list. A crashing service flushes its log file synchronously before exiting with 70, so the crash file holds the stack (DIAG-8).
Checks: typecheck ok, lint ok, deps ok, test 27 passed, build ok, e2e not run
Deviations: For the spec author: the extension points belong in the contracts (`contracts/channels/diagnostics.ts`); declaring them in the module was the only place open to the implementer. `FileLogger.flushSync` added for DIAG-8. main does not install the DIAG-8 handlers: nothing restarts main.
Next: 014

## 014 Module loader and contexts
Status: done (untested)
Date: 2026-11-18
Did: `loadModules` registers a process's modules in list order and logs and skips one whose `register` throws (SHELL-20). `createServiceContext` gives the bus, a per-module file logger, the clock, `DataPaths`, defaults-only settings until card 016, `contribute` and `contributions` on a per-process store, and `onStop`. `createUiContext` stores panels, commands and status items in a registry the workspace reads later. main, the three services and the renderer load their module lists: main and the renderer load `diagnostics`, the service lists are empty. Every process now writes its own log file (main, the services through `runService`, the renderer through `diagnostics.write`). main also handles `diagnostics.openLogFolder` with Electron's `shell.openPath`, and starts in the order of architecture §6 (modules, services, window).
Checks: typecheck ok, lint ok, deps ok, test 27 passed, build ok, e2e not run
Deviations: Tests not written (owner's rule), plan in `untested.md`. `diagnostics` is not in `workspace-service`'s list although the card says so: its service side handles main-owned channels, so `bus.handle` would throw there (SHELL-18). `pty-host` and `link-service` module lists are created now (empty) so their processes get a file logger. The module lists also export the process logger factory and the diagnostics extension points, because they are the only files allowed to name a module. `DataPaths` is built in `service-context.ts` from `APPDATA` and `LOCALAPPDATA`; `hotExitDir` has no location in architecture §5, so it is `%LOCALAPPDATA%\HSOS\hot-exit\<projectId>`. Files outside the card's list: `src/main/index.ts`, `src/services/*/index.ts`, `src/services/shared/service-main.ts`, `src/ui/index.tsx`, `src/modules/diagnostics/register.service.ts`, `src/modules/diagnostics/register.ui.ts` (the "Open log folder" command), `src/modules/diagnostics/service/file-logger.ts`.
Next: 015

## 015 Window
Status: done (untested)
Date: 2026-11-18
Did: `restorePlacement` keeps a saved placement that overlaps a display and otherwise centres 1280 by 800 on the primary display (SHELL-6); `readPlacement` and `writePlacement` keep it in `app.json` with `.bak` and `version`. `createMainWindow` makes a frameless window with the native controls overlay (SHELL-25), background `#100F0E`, refuses navigation, redirects, webviews and new windows (SHELL-24, SEC-2), shows on `shell.uiReady` or after 3 000 ms (SHELL-5), saves its placement on move and resize (500 ms debounce), maximise and close, and emits `windowState`. `registerSystemChannels` handles pickFolder, trashItem (SHELL-22), openExternal (SHELL-21), openPath (SHELL-27), openFolder (SHELL-30), revealInExplorer, notify (SHELL-23), writeClipboard, windowAction and getLaunchToken (SHELL-26, a 32-byte hex token). main takes the single-instance lock and focuses the window on a second launch (SHELL-1). The renderer sends `uiReady` after its modules register.
Checks: typecheck ok, lint ok, deps ok, test 27 passed, build ok, e2e not run
Deviations: Tests not written (owner's rule), plan in `untested.md`. `src/ui/index.html` now carries the SEC-1 policy exactly (it lacked `unsafe-inline` styles, `img-src` and `connect-src 'none'`), and `src/ui/index.tsx` sends `uiReady`; both outside the card's list. `openFolder` is handled too (SHELL-30), though the card's step 3 does not name it. `speak` and `listVoices` are left to their own card (stage 7).
Next: 016

## 016 Settings files
Status: done (untested)
Date: 2026-11-18
Did: `readJson` and `writeJsonAtomic` (`write-file-atomic` plus a `.bak` copy, P-3). `createSettingsStore` resolves each section over its defaults key by key, records a problem for each invalid or unknown key (SET-2 to SET-4), refuses a non-JSON or too-new file without touching it and copies it to `settings.json.invalid-<time>` on the first `setValue` (SET-5), validates `setValue` (SET-6), writes atomically and stores only non-default values (SET-7), and notifies only sections whose value changed (SET-9). main creates and loads the store before any module, so every `registerSettings` reads it; the settings module registers every section declared in the contracts and serves `getSection`, `setValue`, `getProblems`, `sectionChanged` and `problemsChanged`.
Checks: typecheck ok, lint ok, deps ok, test 27 passed, e2e not run
Deviations: Tests not written (owner's rule), plan in `untested.md`. main validates every contract section, since a zod schema cannot cross the bus to main for sections registered in utility processes (SET-10). The store reaches the module through the extension point `settings.store`, filled by main through its module list. `settings.openFolder` is left to the settings screen card. Files outside the list: `src/main/index.ts`.
Next: 017

## 017 Settings live reload
Status: done (untested)
Date: 2026-11-18
Did: `watchSettingsFiles` watches the folders of settings.json and keybindings.json and the themes folder, and reports each kind after a 200 ms quiet period; the settings module re-reads the store on a change (SET-8, P-16), and the store notifies only changed sections (SET-9). `createRemoteSettingsReader` gives modules in utility processes a reader fed by `getSection` and `sectionChanged` (SET-10); `runService` uses it for `registerSettings`.
Checks: typecheck ok, lint ok, deps ok, test 27 passed, e2e not run
Deviations: Tests not written (owner's rule), plan in `untested.md`. Folders are watched instead of files because an atomic write replaces the file. Key binding and theme reloads are no-ops until cards 018 and 019.
Next: 018

## 018 Themes
Status: done (untested)
Date: 2026-11-18
Did: `resources/themes/phosphor.json` copied from the spec; VT323 and Jersey 10 with their OFL licences in `resources/fonts/` and `@font-face` rules in `src/ui/fonts.css`; the `test-light` fixture. `createThemeStore` copies built-in themes into `themesDir` at start, reads every theme, resolves the active one over Phosphor (SET-11, SET-12), ignores and reports unknown tokens and unsafe values (SET-14), and saves themes under a slug, refusing built-in names (SET-16). main loads it before the window, opens the window on the theme's `color.bg.app` (SET-17) and applies `uiScale` as the zoom factor (SET-15). The settings module serves `listThemes`, `getActiveTheme`, `saveTheme` and `activeThemeChanged` and reloads themes on a change in `themesDir`. The renderer sets every token as a CSS variable with `data-theme-kind` (SET-13) and keeps `data-motion` in step (SET-15).
Checks: typecheck ok, lint ok, deps ok, test 27 passed, build ok (fonts bundled), e2e not run
Deviations: Tests not written (owner's rule), plan in `untested.md`. Fonts downloaded from the google/fonts repository. Files outside the list: `src/main/index.ts`, `src/main/module-list.ts`, `src/modules/settings/register.service.ts`, `src/ui/index.tsx` (imports fonts.css), `src/ui/module-list.ts`, `src/ui/vite-env.d.ts` (Vite's types for CSS imports). The packaged app reads built-in themes from `<resources>\themes`; card 025's builder config must copy `resources/themes` there.
Next: 019
