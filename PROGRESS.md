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

## 019 Key bindings
Status: done (untested)
Date: 2026-11-18
Did: `keyFromEvent` turns a key press into the SET-19 format (physical keys by `code`, so Shift keeps a comma a comma) and `normalizeBinding` canonicalises typed bindings. `resolveBindings` gives each command its file override or default (SET-18) and lets the later command win a shared key, naming both in a conflict (SET-20). `createKeyDispatcher` is the one window listener (UI-20) with the terminal (UI-21), text-input (UI-22) and chord (UI-23, 1 500 ms) rules. `createKeybindingsStore` reads, validates and writes keybindings.json atomically; the settings module serves `getKeybindings`, `setKeybinding` and `keybindingsChanged`, reloads on a file change and merges its problems. The renderer resolves bindings over its registered commands and follows changes.
Checks: typecheck ok, lint ok, deps ok, test 27 passed, e2e not run
Deviations: Tests not written (owner's rule), plan in `untested.md`. Effective bindings and SET-20 conflicts are resolved in the renderer, because command defaults are registered there; conflicts are logged at `warn` and the settings screen (card 024) shows them; they are not in `getProblems`, which main answers. Focus inside an element with `data-hsos-terminal` counts as inside a terminal; the terminal card must set it. The pending chord part is passed to `onPending` for the status bar (card 028). Files outside the list: `src/ui/index.tsx`.
Next: 020

## 020 Base components
Status: done (untested)
Date: 2026-11-18
Did: `Button` (primary, default, ghost, danger; small and normal), `IconButton` (24 by 24, accessible name, tooltip with key binding), `TextField` (invalid message beneath), `NumberField` (stepper, arrow keys, clamping), `Switch` (pixel track), `Select`, `Tooltip` (Radix, 500 ms), `Kbd`, `Badge` and `StatusDot`, all styled only with theme tokens. Pressables compose one shared lift (hover lift with `button.lift`, press sink and flash, accent glow for primary, no movement under reduced motion) and the keyboard focus ring from `ui-kit/motion/lift.module.css`. `eslint-rules/no-raw-css-values.js` rejects hex colours, colour functions and px other than 0, 1px and 2px in CSS modules, and `npm run lint` runs it (UI-1).
Checks: typecheck ok, lint ok (CSS rule clean over src, and it reports the 3 raw values in its fixture), deps ok, test 27 passed, e2e not run
Deviations: Tests not written (owner's rule), plan in `untested.md`. `Select` is a native select styled to the theme: `@radix-ui/react-select` is not a dependency and adding one needs the owner. Spacing in CSS modules uses rem steps equal to the spec's pixel scale (0.25rem is 4 px), because UI-1 forbids px above 2. The pointer tilt reads `--hsos-rx` and `--hsos-ry`; setting them from the pointer is left to the motion card (027). Extra optional props beyond the table: `keyBinding` and `disabled` on `IconButton`, `label` and `disabled` on fields, `hideLabel` on `Switch`, tone `neutral` on `Badge` and `StatusDot`. Files outside the list: `src/modules/ui-kit/motion/lift.module.css`, `src/modules/ui-kit/components/cx.ts`, `package.json` (lint script, allowed by the card), `tests/fixtures/css/raw-values.module.css`.
Next: 021

## 021 Panel frame, lists and trees
Status: done (untested)
Date: 2026-11-18
Did: `PanelFrame` draws the box of the visual direction (2 px frame, corner brackets, uppercase title with an 8 by 8 pixel icon and an optional status light, a dithered strip made as an SVG mask, a hard pixel offset) and the four states (P-40): `Skeleton` after 150 ms with a cyan pixel bar, `EmptyState`, `ErrorState` (frame turns `state.danger`, Retry, Show log), and children only when ready. `List` and `Tree` share fixed-height windowing above 200 rows (UI-7), arrow, Home, End and Page keys, Enter and type-ahead; `Tree` expands and collapses with Right and Left. `Tabs` (roving focus), `SplitView` (1 px line, 4 px hit area, drag and arrow keys, minimum sizes) and `ProgressBar` (scaleX fill, accessible label).
Checks: typecheck ok, lint ok (CSS rule clean), deps ok, test 27 passed, e2e not run
Deviations: Tests not written (owner's rule), plan in `untested.md`. "Show log" calls `openLog` from `UiKitActionsContext`, which the app frame provides (the ui-kit has no bus). `List` rows carry `text` for type-ahead and the accessible name; `SplitView` sizes are shares of the space. Extra optional props: `title` and `secondaryAction` on `EmptyState`, `settingsAction` on `ErrorState`, `label` on `Skeleton`, `light` on `PanelFrame`, `label` on `List`, `Tree`, `Tabs` and `SplitView`. Blink and sweep durations are multiples of motion tokens. Panel state CSS is shared in `PanelStates.module.css`.
Next: 022

## 022 Overlays and icons
Status: done (untested)
Date: 2026-11-18
Did: `Dialog` on Radix (open while mounted, focus trapped, Escape closes, focus returns to the opener), `ConfirmDialog` (Cancel focused first with `danger`), `Menu` for dropdown and context menus on Radix with icons, key bindings and danger items, `Toast` with `useToast` (bottom right, 4 s, at most 3, errors stay), `Icon`, and `useOverlayOpen` with `useAnyOverlayOpen` so the browser panel can hide its page views while an overlay is open (BROW-3). Overlays sit on the overlay surface over a 62 percent dim, and fade only under reduced motion. The 49 icons of the set are 8 by 8 pixel drawings, one file per name.
Checks: typecheck ok, lint ok (CSS rule clean), deps ok, test 27 passed, e2e not run
Deviations: Tests not written (owner's rule), plan in `untested.md`. Icons are pixel drawings in square cells, not the 1.5 px stroke icons ui-kit.md describes: visual-direction.md (which wins over the other design texts) says icons are 8 by 8 or 16 by 16 pixel drawings and forbids icons that are not pixel drawings. `Icon` sizes are 8, 16, 24 or 32 px (whole-number scales). `Menu` takes its trigger as children and a `kind`; `Dialog` takes optional `danger` and `initialFocus`. The icon files were generated from one table by a throwaway script.
Next: 023

## 023 Command palette
Status: done (untested)
Date: 2026-11-18
Did: `rankCommands` filters by fuzzy match and ranks prefix, then word-start, then subsequence matches, recent commands first among equals (UI-11). `createCommandRegistry` holds every registered command (UI-10), recent use and provider modes (UI-12); `registerCommand` in the ui context now adds to it. `CommandPalette` (560 wide, 20 percent from the top, overlay surface and shadow) lists commands with their effective keys, moves with the arrows, runs on Enter and closes, shows an error toast when a command rejects (UI-13), switches from a provider mode to commands on `>`, announces itself as an overlay, and returns focus to where it was (UI-14). The renderer mounts it in a small root with the toast provider and the ui-kit's log action, and registers `shell.commandPalette` on `Ctrl+Shift+P`.
Checks: typecheck ok, lint ok (CSS rule clean), deps ok, test 27 passed, e2e not run
Deviations: Tests not written (owner's rule), plan in `untested.md`. The palette is built on the Radix dialog with its own list rather than `cmdk`, because UI-11 needs its own ranking and `cmdk` would only add keyboard handling. `Ctrl+P` file mode waits for the files module to register its mode. Files outside the list: `src/ui/app-root.tsx`, `src/ui/index.tsx` (the root and the palette command), `src/modules/ui-kit/index.ts`. The plain text line the card 005 and 010 e2e checks read is kept in the root.
Next: 024

## 024 Settings screen
Status: done (untested)
Date: 2026-11-18
Did: `SettingsScreen` lists Appearance first, then each module's section in module order, then Key bindings and Themes; a search field filters sections and keys; each key is a row with the control its schema asks for (switch, select, number with stepper, text, path with Browse through `pickFolder`) and a Reset link only when the value differs from the default; a valid edit saves 400 ms after the last change and invalid input shows the schema's message and saves nothing; a banner lists problems with "Open file" (reveals the file in Explorer); loading, ready, ready-with-problems and error states. Key bindings: select a row and press keys; a key another command holds is shown as a conflict with "Use it here" before saving. Themes: every theme, the active one with a swatch row of the colour jobs, Use and Duplicate. The settings module registers the dock panel `settings.screen` and the command `settings.open` (`Ctrl+,`); until card 028 the renderer shows an opened panel over the whole window, closed with Escape.
Checks: typecheck ok, lint ok (CSS rule clean), deps ok, test 27 passed, build ok, e2e not run
Deviations: Tests not written (owner's rule), plan in `untested.md`. The screen has no approved mockup; CLAUDE.md asks for layout options shown to the owner first, but the owner asked for no questions until the end of the run, so this one Phosphor layout is built and options come to the card 037 gate. "Open file" reveals the file in Explorer, because `openPath` refuses `.json` (SHELL-27). The diagnostics `debug` key is not on the screen: its section is declared in the module, not the contracts, and the renderer cannot import service code. Theme swatches show only for the active theme (no channel gives other themes' tokens), and Duplicate copies the active theme. Files outside the list: `src/modules/ui-kit/palette/command-context.ts` and its export, `src/ui/app-root.tsx`, `src/ui/app-root.css` (base page styles).
Next: 025

## 025 Stage 0 checks
Status: done (untested)
Date: 2026-11-19
Did: `electron-builder.yml` with app id `local.hsos.app`, product `HSOS`, an NSIS installer with `oneClick: false`, `perMachine: false` and `allowToChangeInstallationDirectory: true`, `asarUnpack` for node-pty and better-sqlite3, the built-in themes copied to `<resources>\themes` (card 018 reads them there) and the font licences beside them. `resources/icon.ico`: 256 by 256, `HS` in Jersey 10, `#FF003C` on `#0B0A09`, corner radius 48, drawn without anti-aliasing. `npm run dist` produced `dist/HSOS Setup 0.1.0.exe` (140 MB, unsigned).
Checks: typecheck ok, lint ok, deps ok, test 27 passed, dist ok (installer built), e2e not run
Deviations: Tests not written (owner's rule): `tests/e2e/stage-0.e2e.ts` is described in `untested.md`, so F-010 stays failing. `npmRebuild: false`, because `postinstall` already builds the native modules for Electron and this worktree shares `node_modules` with the main checkout. The icon was drawn with System.Drawing from the bundled Jersey 10 file by a throwaway script.
Next: 026

## 026 Demo backend
Status: done (untested)
Date: 2026-11-19
Did: `createDemoTransport` answers every request from fixtures after 80 to 400 ms and emits fixture events on timers; a request with no fixture answers `INTERNAL` "No demo data". Hand-written fixtures for every module describe the owner's world (two projects, three terminals, four Claude sessions in every activity, two subagents, usage at 58 % and 21 %, 30 skills in all four states, a repo with `webUrl` and five changed files, activity and artifacts, a 40-note vault around CLAUDE.md, recent sessions across both projects); channels without one get a value built from their schema. Every static fixture is parsed with its schema when the demo starts and a failure is logged. `terminal-claude.bin` is a recorded Claude-style session (colour, tool calls, a diff, long answers) that terminals replay at its speed and loop; typed keys are echoed. With `--hsos-demo` or `HSOS_DEMO=1`, main starts no service and loads the renderer with `?demo=1`, which uses the demo transport. `npm run demo` builds and starts it.
Checks: typecheck ok, lint ok, deps ok, test 27 passed, build ok (demo split into its own chunks), e2e not run, npm run demo not launched
Deviations: Tests not written (owner's rule), plan in `untested.md`. The terminal recording is synthetic: no test or tool may run the real `claude` command, so it was generated by a throwaway script in the same record format. Channels without a hand fixture are filled from their schemas by `mock-from-schema.ts`, so every request channel has data; a one-off check found all 155 fixtures valid. Vite treats `*.bin` as an asset (`assetsInclude` in `electron.vite.config.ts` and `vitest.config.ts`). Files outside the list: `src/demo/all-channels.ts`, `src/demo/mock-from-schema.ts`, `src/demo/fixtures/world.ts` and `index.ts`, `src/main/window/main-window.ts` (`loadRenderer` takes `demo`), `src/ui/index.tsx` (picks the bus), the two configs.
Next: 027

## 027 Motion, glass and the background
Status: done (untested)
Date: 2026-11-19
Did: `motion/` holds the shared motion: `motion.module.css` (enter with the MOT-3 stagger, leave, pop at the anchor, dialog scale from 0.94 over `motion.slow`, and their reduced fades of at most `motion.quick`), `useLift` (pointer tilt up to `button.tilt`, half on rows wider than 200 px, and the spring release of MOT-2), `staggerDelayMs`, `useEntering` and `useReducedMotion`. `Surface` (UI-31) draws each role's colour at its alpha with optional blur; terminal and reading surfaces never go below `surface.text.minAlpha`, and `applyTheme` raises a lower value and returns it as a problem. `RollingNumber` rolls only the changed digits (MOT-8). `backdrop/` runs the scene in a module worker on an `OffscreenCanvas` (frame cap from `backdrop.fps`, at most 30, paused while hidden, one still frame under reduced motion), with the `still` and `phosphor-dust` scenes, the barrel bend inside the worker, a luminance cap at 0.6 of `color.accent`, pointer moves once per frame, puffs on empty space, steam sources at 10 a second through `useBackdropSource`, and the still CRT overlay. Existing components now use the shared motion: overlays, menus and tooltips, the list and tree stagger, the three pulses of MOT-9, and no colour transitions (MOT-1). `eslint-rules/no-layout-animation.js` is an ESLint rule that checks every CSS module a source file imports, and the modules it composes from.
Checks: typecheck ok, lint ok (new rule clean over src; a throwaway fixture with `width`, `height` and `all` was reported), deps ok, test 27 passed, build ok (worker emitted as its own chunk), e2e not run
Deviations: Tests not written (owner's rule), plan in `untested.md`. The scene grid is 120 by 75 cells of 5 by 5 glyphs on a 6 pixel pitch (720 by 450), as in the approved preview: `background.md` says 480 by 300, which cannot hold 5 pixel glyphs on 120 cells. UI-34 caps brightness "0.6 of color.accent per channel (relative luminance 0.29)": a per-channel cap would turn cyan green (accent blue is 59), so the cap is on relative luminance, at the luminance of 0.6 of the accent per channel; a throwaway run of 300 frames with three full sources and puffs peaked at 0.2911 against a limit of 0.2911. The canvas is shown at opacity 0.8 over `color.bg.app`, as in the preview (no token). Raised surface alphas are returned by `applyTheme` but not yet shown: `register.ui.ts` and the theme store are outside this card. The `Backdrop` is not mounted yet; the app frame (card 028) mounts it. The worker's CPU budget (UI-32, under 3 % of a core) is unmeasured: a throwaway run took about 3 ms a frame in Node including a full-frame luminance check, so the real cost is likely near the budget. Files outside the list: `src/modules/ui-kit/index.ts` (exports), `List.tsx`, `Tree.tsx`, `Button.tsx`, `IconButton.tsx`, `NumberField.tsx`, `Tabs.tsx` (the card's step 4 gives every component its motion), `src/modules/ui-kit/palette/CommandPalette.module.css`.
Next: 028

## 028 App frame and pages
Status: done (untested)
Date: 2026-11-19
Did: `AppFrame` draws the window of `layout.md` over the `Backdrop`, mounted once: the title bar (breathing wordmark with its light band, clock with blinking colon and seconds on hover, project switcher with recent projects, "Open folder" and "Close project", repo button from `webUrl` that opens the GitHub page, page switcher, palette hint; the bar drags the window and leaves the native window controls their overlay), the three pages and the status bar of registered items. Pages mount the first time they are shown and stay mounted; hidden pages are `inert` and skip rendering, and `usePageVisible()` tells their panels (WS-41). `goToPage` runs the switch through `document.startViewTransition`: the root is not captured, so the background, title bar and status bar keep running live (MOT-7); the page area slides toward the side of the switcher it leaves to, the switcher's marker moves as a shared element, a second switch skips the first, clicks pass through, and focus returns to what last had it on the page (MOT-5, MOT-6, MOT-11, WS-45). `shareForTransition` gives an element its shared name for one transition. The Code page has the side view tabs with settings last (WS-30), the side area and the dock; the Notes page has the notes list slot and its own dock (WS-43); the Dashboard shows its screens when the dashboard module registers them. Both docks run on `dockview`, each panel rendered through a portal inside its own error boundary (WS-13), and `allowMultiple: false` focuses the open panel (WS-11). `workspace.pageDashboard`, `pageCode`, `pageNotes`, `pagePrevious` and `pageNext` are global commands on `Ctrl+1` to `Ctrl+3` and `Ctrl+Alt+Left` and `Right` (WS-40).
Checks: typecheck ok, lint ok, deps ok, test 27 passed, build ok, e2e 2 passed and 1 skipped (cards 005 and 010 read their line from the status bar now), demo launched through Playwright: the three pages switch with Ctrl+1 to Ctrl+3, settings opens as a dock tab, one background canvas throughout
Deviations: Tests not written (owner's rule), plan in `untested.md`. The root stays in `src/ui/app-root.tsx`, which now mounts `AppFrame`, instead of a new `src/ui/App.tsx` that would only re-export it. `usePageVisible` and `PageVisibleContext` live in the ui-kit (`components/page-visible.ts`), because other modules' panels may import only the ui-kit. The installed `dockview` 8.9.0 has no React component, so the dock host uses `createDockview` and renders panels through React portals into dockview's elements. Left for later workspace cards: saving and restoring the workspace and `activePage` (WS-20 to WS-24, WS-44), resizing and collapse by width (WS-31, WS-33), the dock key bindings (WS-34), moving side views between areas (WS-15), the welcome view (WS-5) and saved side view state. The HUD goes to the right area by its `hud.` type prefix until areas are saved per project. The window controls are drawn by Windows in the title bar overlay (card 015). Files outside the list: `src/ui/app-root.tsx`, `src/modules/ui-kit/components/page-visible.ts`, `src/modules/ui-kit/index.ts`.
Next: 029

## 029 Terminal panel, ribbon and mascot
Status: done (untested)
Date: 2026-11-19
Did: `terminal.shell` is a dock panel with a see-through xterm (`allowTransparency`, background `color.term.background` at `surface.terminal.alpha`, floored at `surface.text.minAlpha`; text, cursor and selection opaque, TERM-76) under the header slot (TERM-75), which draws the first contribution to `terminalHeader` that renders content and refits the rows when its height changes. The panel creates or attaches its shell (TERM-21, the TERM-23 one-row nudge), writes `data` by `seq`, acks every 100 000 drawn bytes (TERM-30), fits on resize debounced 50 ms (TERM-53) and when its page shows again (TERM-54), follows theme changes (TERM-51), uses WebGL with a logged fallback (TERM-52), and shows "Starting shell…", the exit line with Restart, and the error state with Retry and "Terminal settings". `terminal.new` (`Ctrl+Shift+T`) opens a terminal; at start a panel reattaches to each running shell of the project, and a second terminal stacks below the first (layout C). The HUD contributes the session ribbon (HUD-80 to HUD-83): mascot that expands it, chat name with the activity word in its tooltip, model and effort, mode (presses Shift+Tab as a quick command), folder with `~`, repo and branch, context bar and rolling percentage toned at 70 and 90 (HUD-9), the agents count, mini mascots (at most 5, then `+n`), and expanded rows per subagent sliding open with `clip-path`; parts drop by container width in the order of HUD-81; the ribbon is a steam source in `color.live`, or `color.brand` while the session needs the owner. The mascot (HUD-90 to HUD-93) plays the sprite sheet copied to `resources/art/`, with the 3-frame turn on a state change, the loop rules of the frame map, `working` on the Code page and `reading` on Notes, the first frame only under reduced motion, and a placeholder of coloured blocks with a logged problem when the sheet is missing.
Checks: typecheck ok, lint ok, deps ok, test 27 passed, build ok, demo launched through Playwright: three terminals replay the recorded session, two show ribbons with mascots and subagents, the expanded ribbon lists both subagents. Step 4: VT323 in xterm drew the replay's box-drawing and status characters through the Cascadia Mono fallback with no missing glyph seen; the rounded box corners render as plain corners.
Deviations: Tests not written (owner's rule), plan in `untested.md`. `UiContext` has no `contribute`, so UI extension points such as `terminalHeader` are filled through a small store in the ui-kit (`contributeUi`, `useUiContributions`), the one module both terminal and hud may import; for the spec author, `UiContext` could gain `contribute` and `contributions` like `ServiceContext`. The ribbon's expanded state is kept per terminal in memory, not in the terminal's panel state (that belongs to the terminal module, which knows nothing of the header). The model menu (HUD-62) and the Context popover (HUD-61) come with the HUD in card 031; until then the model is plain text and the context is not pressable. The chat name opens `sessions.history` and the folder opens `files.view` once those panels exist (lane B). The terminal font is the `terminal` settings default, 13 px, because renderer settings still read defaults; `visual-direction.md` names 19 px as the default, which the settings contract does not. The tab title is "Terminal" until TERM-56. Files outside the list: `src/modules/ui-kit/components/contributions.ts` and its export, `src/modules/workspace/panel/DockHost.tsx` (a second panel of a kind opens below the first), `src/ui/module-list.ts`.
Next: 030

## 031 HUD
Status: done (untested)
Date: 2026-11-19
Did: The HUD side view `hud.panel` (right area) floats over the background: the quick bar (HUD-60 to HUD-68: title of the target session, Usage and Context popovers, Skills, the model and effort menu, the mode button that presses Shift+Tab without taking focus, Compact and Clear dialogs with Cancel focused, More with `quickCommands`), then Sessions, Usage, Skills and Skills repo, each with a collapsing title row and its own error boundary. Commands go through `sendToSession` (HUD-63): nothing for a session that needs the owner, Enter only when nothing was typed since Claude's last reply, else typed without Enter with a toast. Sessions (HUD-1 to HUD-9): project filter with "Show all projects", board order, dot and word per activity, second line, model and toned context, cache warmth, subagents beneath, activation focuses the terminal and marks seen, the needs-you pulse. Usage (HUD-25 to HUD-27): toned bars with reset times, "No data yet", the stale note, and the `5h` and `7d` status items. Skills deck (HUD-30 to HUD-37): word search, favourites first, state and source filters, state chips, star toggle, `/name ` to the target terminal, background runs with the run dialog, report, Cancel and Dismiss, and the row menu with the four states and their lines. Skills repo row (HUD-40, HUD-41) with every state and a confirmed Sync. The Claude setup view `hud.setup` (HUD-50 to HUD-55): counts, search, "Not used in 30 days", sort, sections with "Last used" and its counter tooltip, "Open file", "Ask Claude to remove", read errors, Refresh, and a re-read on focus after 10 s. Alerts (HUD-10 to HUD-16): notifications while the window is unfocused and spoken alerts unless the owner is looking at that terminal, each at most once per session per 10 s, with the first-sentence rule; the `hud.attention` status item; commands `hud.show`, `hud.focusNextAttention`, `hud.searchSkills`, `hud.openSetup`, `hud.toggleSpokenAlerts`, `hud.testVoice`, `hud.chooseVoice` with its voice dialog.
Checks: typecheck ok, lint ok, deps ok, test 27 passed, build ok, demo launched through Playwright: the HUD shows the quick bar, three sessions in board order with subagents, both usage bars, runs and favourite skills, and the status items `1 need you`, `5h 58%`, `7d 21%`
Deviations: Tests not written (owner's rule), plan in `untested.md`. Added to the ui-kit, outside the list: a `Popover` (Radix, the HUD may not import Radix itself) and an optional `action` button on toasts (HUD-31, HUD-35 and HUD-63 toasts carry one). The terminal panel now carries `data-terminal-id`, so the HUD can find the target terminal (HUD-31) and focus it; `UiContext` gives no way to focus a panel or run another module's command, so "Session history", "Find session" and "Show what loads at start" stay disabled or hidden until those commands can be found, and `focusPanel` of notifications is null. `hud.toggleSpokenAlerts` writes the setting but shows no toast (commands run outside React); the result is logged. The run dialog offers sonnet, opus and haiku until the skills settings reach the renderer. The voice dialog is mounted with the HUD panel. Section collapse is kept in the panel and passed to `setState`, but the frame does not save side view state yet. Note for the spec author, from the owner on 2026-11-19: the skills repo is now named `Core`, not `SKILLS`, and it is private, so syncing needs a credential. `SkillsSettings.repoDir` in `spec/contracts/channels/skills.ts` still defaults to `Documents\GitHub\SKILLS`, and the skills spec does not say how a private repo authenticates (Git Credential Manager or a token); the HUD row itself names no repo, so this card is unaffected. Files outside the list: `src/modules/terminal/panel/TerminalPanel.tsx` (`data-terminal-id`), `src/modules/ui-kit/components/Popover.tsx`, `Toast.tsx`, `Overlay.module.css` and `index.ts`, `src/modules/workspace/panel/Frame.module.css` (the right area scrolls only down).
Next: 030 (lane B), then 032 to 037

## Owner amendments 2026-11-19 (before lane B merge)
Status: done
Date: 2026-11-19
Did: Two owner fixes from `docs/handoff.md`. The HUD's Skills repo row now sits at the top of the Skills section, above the skills search; the separate "Skills repo" section is gone. In the terminal panel, Ctrl + mouse wheel makes the text larger (up) or smaller (down), clamped to 8 to 32, kept in `TerminalPanelState.fontSizeDelta` over the settings font size, then the view refits and sends `terminal.resize`; the wheel event's default is stopped so the page does not zoom.
Checks: typecheck ok, lint ok, deps ok, test 27 passed
Deviations: Both change the look the owner reviews at the 037 gate; note them for that review. Tests not written (owner's rule), plan in `untested.md`. The `repo` id stays in `HudPanelState.collapsed` so saved panel state still parses; nothing sets it now. Files: `src/modules/hud/panel/HudPanel.tsx`, `src/modules/terminal/panel/TerminalPanel.tsx`.
Next: lane B review and merge (030, 032, 033)

## 030 Files, viewer and history
Status: done (untested)
Date: 2026-11-19
Did: Built the Files view (side view `files.tree`: lazy folders on demo data, four states, context menu with delete confirmation and new file), the file viewer (dock `files.viewer`: text editor with Ctrl+S, dirty marker, changed-on-disk and deleted bars, binary, too-large and image notices) and the history timeline (dock `history.timeline`: version list, diff against the previous version, compare with the current file, restore with confirmation). Registered both modules in `src/ui/module-list.ts`.
Checks: typecheck ok, lint ok, deps ok, build ok, test not run (implementer rule), e2e not run
Deviations:
- ui-kit has no `CodeView`, `DiffView` or `MarkdownView` yet (ui-kit.md lists them; they are not in `src/modules/ui-kit/index.ts`). The viewer uses a plain monospace `textarea`; the history panel has its own `DiffView` (inline only) and `line-diff.ts`. The review module (card 033) will need the same diff, so the Lead should move `DiffView` into ui-kit. Until then it is a copy.
- No `diff` or `codemirror` package is imported in the panels: the lane rule allows only contracts, ui-kit and the module's own files.
- Viewer, not built: markdown preview toggle (FILE-70), "Compare" on the changed-on-disk bar (FILE-74), line wrap (`wordWrap`), image preview (no `hsos-file:` scheme yet), dirty-close prompt (FILE-76; the dock has no close hook), focus of an already-open file (FILE-78; the dock API does not expose it, so every open adds a viewer), syntax colours, dirty dot on the tab (the marker is in the frame header).
- Files view, not built: rename, new folder, Ctrl+N, Ctrl+C, drag to terminal and into folders, Delete key, dirty dots (FILE-66), "Open to the Side", "Open Terminal Here", "Send Path to Terminal". The view keeps its expanded folders and selection in component state, not in the view's saved state (FILE-60 asks for saved state; side views have no saved state yet).
- History, not built: "+n lines" change (the timeline shows the byte change, `+812 B`, because line counts need every version read); Undo action on the restore toast (ui-kit's toast has no action); the `history.showForActiveFile` and `history.pruneNow` commands; "Compare" reads the file with `files.read`, so binary files show "Binary file changed."
- The three helper files (`use-project.ts`, `helpers.ts`, `format.ts`) are small copies that the other modules also need (`useProject` for the open project, `relativeTime`). They belong in ui-kit or in `workspace`. The Lead should decide where.
- The Files view and the viewer open the history timeline through `ctx.openPanel('history.timeline', ...)`, not by import. The timeline opens the file's history through `ctx.openPanel` only from the files module; no import crosses modules.
- Paths in tree node ids and listings are absolute paths, joined with `\`. `DirEntry.relPath` is not used, because the contract says only "relative to the root that was listed" and the fixture uses the project root.
- `src/ui/module-list.ts` was edited (the Lead asked for it), though the card's file list does not name it.
Merge: written by a Haiku coder on `lane-b-030-033`, merged by the Lead on 2026-11-19; gap fixes follow in their own commits.
Next: 032

## 032 Sessions
Status: done (untested)
Date: 2026-11-19
Did: Built the session picker (command `sessions.find`, a dialog with search, rows with state chip and backup badge, the first action on Enter), Session History (dock `sessions.history`: project and state selects, search, folder groups, checkbox and Shift-click selection, Ctrl+A, row menu, "Delete n", refresh on changes debounced 500 ms) and the transcript reader (dock `sessions.transcript`: the last 200 items, "Show earlier", growth check every 2 s while visible, Resume, Rename, Edit note). Rename, note and delete dialogs are shared. Registered the module in `src/ui/module-list.ts`.
Checks: typecheck ok, lint ok, deps ok, build ok, test not run (implementer rule), e2e not run
Deviations:
- "Resume here" (SESS-32) is not built: it needs the focused terminal's prompt state (TERM-71), which the terminal module owns and the renderer does not expose yet.
- "Go to terminal" (SESS-32) is shown but disabled. Nothing in the contracts focuses an existing terminal panel from another module, and `ctx.openPanel('terminal.shell')` would open a new one (the terminal panel allows several).
- "Resume in new terminal" runs `terminal.create`, `sessions.bind` and `terminal.write` as SESS-32 says, but it does not open a terminal panel for the new shell. The terminal module should open it; the panel state shape for `terminal.shell` is not in the spec excerpts I read.
- The picker is a dialog with its own React root (`createRoot` on a div in `document.body`, wrapped in ui-kit's `ToastProvider`), because a command cannot mount a dialog inside the app tree. The Dialog's Radix portal still renders into `document.body`. The rename field is not pre-selected (ui-kit's `TextField` has no select-on-focus).
- The transcript shows plain text with line breaks, not `MarkdownView` (ui-kit has no `MarkdownView` yet). Raw HTML is therefore shown as text, which satisfies SESS-51.
- The note field is a native `textarea` (ui-kit has no multi-line field); it is not a ui-kit component.
- Session History rows use plain list markup with native checkboxes, not ui-kit's `List`, because the rows are grouped by folder and `List` has no group headers. Arrow keys do not move the selection in this list; Tab moves between rows, and Enter, F2, Delete and Ctrl+A work.
- The project select shows the folder name only; the full path tooltip (SESS-71) is not shown (ui-kit's `Select` takes no tooltip).
- The reader keeps the session fields it was opened with (title, note, live terminal). Rename and note refresh the title and note from `sessions.list`; the live terminal does not refresh until the reader is opened again.
- Auto-resume (SESS-41, SESS-42) and the Settings section are not part of this card and are not built here.
- `use-project.ts` and `format.ts` are copies of the files module's helpers (see card 030 progress); the Lead should move them to a shared place.
Merge: written by a Haiku coder on `lane-b-030-033`, merged by the Lead on 2026-11-19; gap fixes follow in their own commits.
Next: 033

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
Merge: written by a Haiku coder on `lane-b-030-033`, merged by the Lead on 2026-11-19; gap fixes follow in their own commits.
Next: the card after 033 (the 037 gate is later; the coordinator decides)

## Lead fixes after the lane B merge: ui-kit views
Status: done (untested)
Date: 2026-11-19
Did: Added `DiffView` (the `diff` package, inline and split, folds, F7 and Shift+F7, a line action and content under a line), `CodeView` (CodeMirror 6 with a token theme, Ctrl+S, reveal line, reload that keeps the cursor line and scroll) and `MarkdownView` (`micromark`, raw HTML escaped, links handed to the caller) to the ui-kit (ui-kit.md). History and review now use the one `DiffView`; their copies and both `line-diff.ts` files are gone. The review diff panel keeps the diff on screen while it refreshes (REV-20), has a "Side by side" switch, and keeps its comment box and comments under the line through `renderBelow`. The file viewer uses `CodeView`; markdown files get a Preview switch and Ctrl+Shift+V and start in preview when `markdownPreviewFirst` (FILE-70); links follow FILE-79 (relative paths open a viewer, https opens externally); the changed-on-disk bar has Compare (FILE-74); a silent reload keeps the cursor line and scroll (FILE-73) and keeps the clean buffer if the reload fails; a second Ctrl+S while a save is in flight is ignored. History's "Compare with current file" now diffs the selected version against the file (HIST-41).
Checks: typecheck ok, lint ok, deps ok, test 27 passed, build ok
Deviations: `CodeView` takes `language` but no CodeMirror language packages are in the stack, so every file shows without syntax colours (FILE-70 asks for them); for the spec author. `CodeView` and `DiffView` have props beyond ui-kit.md: `revealLine` and `label` on CodeView (FILE-78 and an accessible name), `label`, `lineActionLabel` and `renderBelow` on DiffView (REV-23, REV-24). Wiki links in a preview wait for the graph module. The split switch is not saved with the panel.
Next: more lane B fixes

## Lead fixes after the lane B merge: feedback paste
Status: done (untested)
Date: 2026-11-19
Did: "Send to Claude" (REV-33) no longer writes its own bracketed paste markers through `terminal.write`. The ui-kit holds a paste registry (`registerTerminalPaste`, `pasteToTerminal`, `sanitizePaste`); each terminal panel registers xterm's `paste` for its terminal id, after removing escape and other control characters (P-6), so a comment holding `ESC[201~` cannot end the paste early and run the rest as typed input. When the program has not turned on bracketed paste and the text has line breaks, the paste is refused and the tray says to use Copy, because each line would run on its own. A terminal with no panel open gets a toast.
Checks: typecheck ok, lint ok, deps ok, test 27 passed
Deviations: TERM-43 (ask before a long paste) and the rest of TERM-46 are terminal cards still to come; until then this path refuses instead of asking. Files outside any card: `src/modules/ui-kit/components/terminal-paste.ts`, `src/modules/ui-kit/index.ts`, `src/modules/terminal/panel/TerminalPanel.tsx`.
Next: more lane B fixes

## Owner amendment 2026-11-19: strawberry app icon
Status: done
Date: 2026-11-19
Did: The owner's strawberry logo (2048 px pixel art, kept as `resources/art/strawberry-logo.png`) is now the app icon. `resources/icon.ico` holds 16 to 256 px sizes (nearest-neighbour up to 64 px so the pixels stay sharp, bicubic above to keep the glow) and is used by electron-builder for the exe, installer, uninstaller and shortcuts; `resources/icon.png` is a 512 px copy. In development the window and taskbar take `resources/icon.ico` too.
Checks: typecheck ok, lint ok, deps ok, test 27 passed
Deviations: Owner's request, outside any card. Files: `resources/icon.ico`, `resources/icon.png`, `resources/art/strawberry-logo.png`, `src/main/window/main-window.ts`.
Next: more lane B fixes

## Lead fixes after the lane B merge: sessions
Status: done (untested)
Date: 2026-11-19
Did: Fixed the ten review findings on card 032 in `src/modules/sessions/`: Ctrl+A in the search field, row key handling and Up/Down navigation, the picker toast that vanished at close, Resume opening a `terminal.shell` panel, the project filter fallback and reset, explicit newest-first sorting, the reader growth poll and scroll anchor, the reader's live state, the all-running Delete dialog, and PowerShell escaping with a copy error toast.
Checks: typecheck ok, lint ok, deps ok, test not run (implementer rule), e2e not run
Deviations:
- The panel API (`PanelProps`, `PanelDefinition`) has no way to set a panel's title after registration, so the transcript panel title stays "Transcript". The reader header shows the session title.
- No contract maps a session's folder to a project id. Resume uses the open project's id for `terminal.create` even for a session from another folder, and shows an error toast when no project is open. SESS-32 is silent on this.
- The terminal panel state is written out in `register.ui.ts` (shape of `TerminalPanelState`), because a module may not import the terminal module.
- Up and Down move focus between rows of Session History; they do not change the selection (SESS-72 is silent). The row list is still plain markup, not `List`.
- A selection of only running sessions opens a "Nothing to move" dialog with a Close button. SESS-76 gives no text for this case.
- The picker's toast provider now stays mounted for the toast time after the dialog closes.
- The reader's Resume stays hidden while the session has a live terminal; "Go to terminal" is still missing (known gap).
Merge: written by the Sonnet agent on `lane-d-032-fixes`, reviewed and merged by the Lead.
Next: more lane B fixes

## 034 Notes page and browser panel
Status: done (untested)
Date: 2026-11-19
Did: Built the graph panels (`graph.view` dock with sigma canvas, CLAUDE.md pinned at the centre, drift and pointer push, toolbar, details and hover cards, agent view; `graph.notes` notes tree; `graph.local` local graph with backlinks) on a shared `graph-store` fed by `graph.getGraph` and `graph.graphChanged`, plus the commands graph.open, graph.agentView, graph.showLocal and graph.reindex. Built the `browser.tab` dock panel (toolbar, address parsing, page area bounds to `browser.setBounds`, agent indicator and Stop) and its commands. Added both modules to `src/ui/module-list.ts` after hud. No tests written, per the owner's rule; the test plan is in `lane-notes/034-untested.md`.
Checks: typecheck ok, lint ok, deps ok, test 27 passed (existing tests only), build ok (electron-vite build)
Deviations:
- graphology typings: `graphology-types` (a peer of graphology 0.26) is not in the lockfile, so graphology's class has no methods under typecheck. Fix in `src/modules/graph/panel/graph-canvas.ts`: a minimal `CanvasGraph` type and one cast per package. The Lead should add `graphology-types` and drop the cast.
- sigma 4 options: `labelFont`, `labelSize`, `labelColor`, `defaultEdgeColor`, `renderEdgeLabels` are not in sigma 4's options, so label font and colour are sigma's defaults, not tokens. Camera limits and double-click zoom are set under `settings` (`minCameraRatio`, `maxCameraRatio`, `doubleClickZoomingRatio`). Hidden nodes use `visibility: 'hidden'`. Edge colours are set per edge.
- Layout runs synchronously on the main thread (200 iterations), not in a web worker (GRAPH-20).
- When nodes are added, the whole graph is laid out again; existing positions are not kept (GRAPH-27 asks to keep them).
- Not built, GRAPH-22 to 29 and 50 to 53: the 5 000 and 50 000 node modes (GRAPH-29); the 1.8x label rule is built, but the search "camera fits the matches" step is not; filters for kinds, roots, tags, orphans and unresolved (GRAPH-26) are not built, only "Changed in last 24 hours", colour by community and agent view; the pixel bracket of GRAPH-53 is approximated by the accent colour; the open note glow is not built (no focused-viewer channel).
- GRAPH-52 steam sources are not built: ui-kit exports only `useBackdropSource` (needs a DOM element), and graph nodes are canvas pixels. A canvas source API is needed in ui-kit.
- GRAPH-44 card preview is plain text in a `<pre>`, not `MarkdownView` (no markdown renderer in ui-kit).
- GRAPH-30 local graph is a radial SVG of the note and its neighbours, not a sigma layout; it does not stop at CLAUDE.md.
- Opening notes calls `openPanel('files.viewer', { path, line })`. `files.viewer` is card 030 (lane B), not on this branch, so the call logs `workspace.unknown_panel` until 030 is merged. "Open to the Side" and "Send Path to Terminal" are not built.
- Notes list groups files by the name of their parent folder, because `GraphNode` carries no folder path or root folder. Files directly in a root show under "Top level".
- Local graph follows the note selected in the graph or the list (`selectedPath`), since no channel says which viewer is focused.
- Browser: the page area shows the tab's title and URL, not a fixture screenshot. The demo has no screenshot channel for this panel, and the panel cannot tell demo mode; the fixture is not built. BROW-3 screenshot-on-overlay is not built (capture is main's). Panel title is the static "Browser" (BROW-8 wants the page title; `PanelDefinition.title` is static).
- Browser commands: `browser.clearData` is not registered (no channel in the contract). BROW-9 crash state is not built (no crash event in the contract).
- Side views open on the Code page (existing workspace rule), so "Show Local Graph" from the Notes page switches to Code.
- The Notes page does not open `graph.view` on its own. `Pages.tsx` (workspace, not in this card's list) gives the notes dock no graph; the layout C arrangement of `layout.md` (graph beside the note) needs that decision.
Blocked questions:
1. Notes page arrangement: `layout.md` "Pages" says the graph fills the space between the list and the notes dock, but `graph.view` is a dock panel that the notes dock hosts. Who opens it on the Notes page, and does the graph run behind the dock or beside it? (Built as a dock panel; not opened by default.)
2. BROW-8 says the browser panel's title is the page title, but `PanelDefinition.title` is static. Is a dynamic title in the contract, or is the title static?
3. `files.viewer` state shape: FILE-78 says `state.line`; no contract gives the viewer's state. Built as `{ path, line }`.
4. GRAPH-30 follows "the file open in the focused viewer"; no channel reports the focused viewer. Built with the selected note.
5. GRAPH-42 counts "notes" as nodes of kind `note`. Skills, memory and CLAUDE.md files are not counted in the reach total. Assumed from the spec's wording.
Anything that looks wrong: `graphology-types` missing from the lockfile (see Deviations). `npm run test` prints a node-pty "AttachConsole failed" stack from `conpty_console_list_agent.js` before the tests pass; it is environmental, and the run still exits 0.
Merge: written by a Haiku coder on `lane-c-034`, merged by the Lead on 2026-11-19. The Lead fixed a crash on open (the node reducer read `sigma` before the constructor returned), paused the drift loop on a hidden page (WS-41), and set the label colour and font through sigma 4's `styles`. The Notes page does not yet match the approved layout C mockup (`design-round/notes/phosphor-notes.html?layout=c`); the Lead brings it there in the next commit.
Next: 034 look pass

## Lead fixes after the lane B merge: right click selects its row
Status: done (untested)
Date: 2026-11-19
Did: `List` and `Tree` in the ui-kit now select a row on right click as well as on click. The Files tree, Changes, Activity and Artifacts open their context menus on the selected row, so before this a right click on another row ran Delete, Restore or Pin on the row selected earlier.
Checks: typecheck ok, lint ok, deps ok, test 27 passed
Deviations: none. Files: `src/modules/ui-kit/components/List.tsx`, `Tree.tsx`.
Next: 034 look pass

## 034 look pass (Lead)
Status: done (untested)
Date: 2026-11-19
Did: Brought the Notes page toward the approved layout C mockup (`design-round/notes/phosphor-notes.html?layout=c`). The page is now three columns: the notes list floating on the left, the graph free in the middle as a page layer (not a dock tab), and the notes dock on the right holding the open note. The graph draws square pixel nodes (sigma's `sdfSquare`), each with a halo in its own colour; CLAUDE.md is the largest node with a strong orange halo and a yellow frame, and the view opens and fits (Fit, double click, `0`) with CLAUDE.md in the centre (GRAPH-51); the open note glows yellow. The toolbar is a row of toggle buttons (24 h, Communities, Agent view, Only not reached, Fit) instead of switches; the ui-kit `Button` takes `pressed` for this. The notes list has a thin scrollbar in the border colour instead of the bright default.
Checks: typecheck ok, lint ok, deps ok, test 27 passed, build ok, demo screenshot of the Notes page with a note open
Deviations: Still short of the mockup, for the 037 review: graph nodes are not yet steam sources for the background (GRAPH-52; the ui-kit backdrop source hook takes DOM elements); no Kinds, Roots and Tags filters; labels are smaller than the mockup's; the note sheet sizes to its content instead of filling the column; the graph's hover card shows plain text, not `MarkdownView`; `graph.open` still opens a second graph as a dock tab. Files outside the card: `src/modules/workspace/panel/Pages.tsx`, `Frame.module.css`, `src/modules/ui-kit/components/Button.tsx`.
Next: 035

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
Merge: written by the Sonnet agent on `lane-e-030-033-fixes`, merged by the Lead on 2026-11-19.
Next: 035

## 036 Settings, themes and every state (part 1: settings and welcome view)
Status: in progress
Date: 2026-11-19
Did: The settings screen follows layout A, Ledger, which the owner chose on 2026-11-19 from three options (`design-round/settings/phosphor-settings.html?layout=a|b|c`, recorded in `design-round/design-rounds.md`): search and a corner-box section list with key counts on the left, the open section filled yellow; on the right the problems in a yellow bar and the section's rows as label (with the schema's description as a hint), control and a Reset column, a yellow dot after a changed label and Reset in lavender. The welcome view (WS-5) is built: "Open a project", one primary "Open folder" (`shell.pickFolder`), recent projects newest first with their age, a missing folder muted with "Remove from list"; with no project open it is the Dashboard's first screen (WS-44).
Checks: typecheck ok, lint ok, deps ok, test 27 passed, build ok, demo screenshot of the settings screen
Deviations: The welcome view could not be seen in the demo, because the demo transport does not emit `projectChanged` with null on "Close project". `WelcomeView.module.css` is new beside the listed `WelcomeView.tsx`; `Pages.tsx` and `AppFrame.tsx` changed to show it. The state gallery (step 3) waits for card 035's widgets.
Next: 035 merge, then 036 part 2 (gallery)

## 035 Dashboard
Status: done (untested)
Date: 2026-11-19
Did: Built the dashboard page (`dashboard.screens`, shown by the Dashboard page): pure placement rules (`placement.ts`: fits, overlaps, first free place, resize limits, file validation, reflow on a changed grid, the DASH-22 default layout), the layout store with a 500 ms debounced save and load through `dashboard.load`/`dashboard.save` (`dashboard-store.ts`), and the page with screens and dots, hold-to-edit, move and resize by pointer, edit toolbar, remove with Undo, add widget and screens dialogs, keys (arrows, Shift+arrows, Delete, Enter, Escape, Ctrl+PageDown/Up). Contributed the eleven catalog widgets through `dashboardWidgets`: hud (ribbon, sessions, usage, context, quickBar, skills, mascot), sessions.recent, git.status, activity.recent, graph.mini. Added the dashboard to `src/ui/module-list.ts` after browser. No tests written, per the owner's rule; the test plan is in `lane-notes/035-untested.md`.
Checks: typecheck ok, lint ok, deps ok, test 27 passed (existing tests only), build ok (electron-vite build)
Deviations:
- `dashboard.screens` is registered as a `dock` panel. As a `side` panel, Pages.tsx would list it as a Code page side tab.
- Not built, DASH-1: swipe and wheel between screens (dots, keys and drag on empty space are not all there; only dots and keys).
- Not built, DASH-5: right-click "Edit dashboard" menu (the command `dashboard.edit` and the hold work).
- Not built, DASH-6: dragging a preview from the Add sheet, and edge hold to move to the next screen. Screens cannot be reordered by drag (DASH-10).
- DASH-8: the Add sheet lists types without live previews; `dashboard.addWidget` only turns edit mode on.
- DASH-9: the Undo toast uses `TOAST_MS` (4 s), not 5 s.
- DASH-11: arrows move focus between widgets in DOM order, not by position.
- DASH-12: no stagger on each show, no hover surface tone; widgets keep the default scale on hover. Values roll only where `RollingNumber` is used.
- DASH-13: no view transition (MOT-6 is not built).
- DASH-20 service side (`register.service.ts` for the file) is not in this card; the renderer calls `dashboard.load`/`save`, which the demo answers.
- Widget config: `configSchema` is `z.unknown()` and `setConfig` is a no-op; no widget has settings yet.
- Widgets: `hud.ribbon` has no 2×1 compact mode; `hud.skills` shows the full deck at every size; `hud.usage` and `hud.context` open the HUD panel (no popover); `hud.context` shows the cache state but not the Context popover; `hud.sessions` ignores its 2×2 filter; `sessions.recent` lists rows and "All" opens Session History; `git.status` has no repo link or Sync; `activity.recent` opens the Activity timeline; `graph.mini` is a still SVG of the local graph (no drift, no steam, no pointer), and its activation opens the graph view on the current page.
- Module-wide: the page reads the grid from `dashboard` settings (`columns`, `rows`) and reflows on change (DASH-23).
Blocked questions:
1. Widgets that go to another page (`graph.mini`: "Goes to the Notes page"; `hud.ribbon`: "the Code page") cannot switch pages: a module may not import workspace's `goToPage`, and UiContext has no command runner. The widgets open their panel only. A page-switch hook is needed in the UI context.
2. Undo window: DASH-9 says 5 s, ui-kit's toast lasts `TOAST_MS` = 4 s. Which wins?
3. The page's panel kind is not in the spec; I chose `dock` (see Deviations).
4. Widget activation for `hud.ribbon` and `hud.mascot` focuses the target terminal's input only when it is on screen; the spec says "goes to that session's terminal on the Code page".
Anything that looks wrong: the dashboard's Ctrl+PageDown/Ctrl+PageUp commands run even when another page is visible (they are not gated on the page being shown). `npm run test` prints the node-pty "AttachConsole failed" stack before passing; it is environmental.
Merge: written by a Haiku coder on `lane-f-035`, merged by the Lead on 2026-11-19. The Dashboard works but does not yet match the approved mockup (`design-round/dashboard/phosphor.html`): widgets have no corner boxes, the layout puts the graph on the right instead of the centre, and the mini graph is a placeholder with round nodes. The Lead brings it there in a look pass.
Next: 035 look pass, then 036 part 2
