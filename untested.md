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

## 019 Key bindings

Code: `src/modules/ui-kit/keys/parse-key.ts` (`keyFromEvent`, `normalizeKeyPart`, `normalizeBinding`), `src/modules/ui-kit/keys/key-dispatcher.ts` (`resolveBindings`, `createKeyDispatcher`, `CHORD_WAIT_MS`, `TERMINAL_ATTRIBUTE`), `src/modules/settings/service/keybindings-store.ts` (`createKeybindingsStore`, `isKeyString`), channels in `src/modules/settings/register.service.ts`, `startKeys` in `src/ui/index.tsx`.

`tests/settings/keybindings.test.ts`:

| Rule   | Given                                                       | When              | Then                                                                 |
| ------ | ----------------------------------------------------------- | ----------------- | -------------------------------------------------------------------- |
| SET-18 | a command with default `Ctrl+B`; overrides map it to `null` | `resolveBindings` | the command has no key (`byCommand` is null, `byKey` lacks `Ctrl+B`) |
| SET-20 | two commands on `Ctrl+B`                                    | `resolveBindings` | the later one holds the key; one conflict names both                 |

Also: `keyFromEvent` gives `Ctrl+Shift+P` for code `KeyP` with Ctrl and Shift, `Ctrl+,` for `Comma`, null for a lone Shift; `normalizeBinding('ctrl+shift+p')` is `Ctrl+Shift+P`, `ctrl+k ctrl+t` is `Ctrl+K Ctrl+T`; the store reports a malformed key as a problem and `set` refuses one with `SET_INVALID`.

`tests/ui-kit/key-dispatcher.ui.test.tsx` (jsdom, `createFakeClock`):

| Rule  | Given                                                                                         | When                                        | Then                                                                           |
| ----- | --------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------ |
| UI-21 | focus inside an element with `data-hsos-terminal`; `Ctrl+B` not global, `Ctrl+Shift+P` global | both keys are pressed                       | only the palette command runs                                                  |
| UI-22 | focus in an `<input>`; bindings `F2` and `Ctrl+S`                                             | both are pressed                            | only `Ctrl+S` runs                                                             |
| UI-23 | binding `Ctrl+K Ctrl+T`, fake clock                                                           | `Ctrl+K`, then 2 000 ms pass, then `Ctrl+T` | the command does not run (and it does run when `Ctrl+T` comes within 1 500 ms) |

## 020 Base components

Code: `src/modules/ui-kit/components/` (`Button`, `IconButton`, `TextField`, `NumberField`, `Switch`, `Select`, `Tooltip`, `Kbd`, `Badge`, `StatusDot`, each `.tsx` plus `.module.css`; `cx.ts`), `src/modules/ui-kit/motion/lift.module.css` (shared lift and focus ring), `src/modules/ui-kit/index.ts`, `eslint-rules/no-raw-css-values.js` (`findRawValues`, run by `npm run lint`), fixture `tests/fixtures/css/raw-values.module.css`.

`tests/ui-kit/base-components.ui.test.tsx` (jsdom, Testing Library), for each component:

- UI-2: it can be reached with Tab and operated with the keyboard alone (Button and IconButton with Enter and Space; Switch toggles with Space; NumberField steps with ArrowUp and ArrowDown and clamps to min and max; Select changes with the arrow keys; TextField takes typing and calls `onChange`), and its focusable element carries the shared `focusRing` class (`:focus-visible` cannot be checked in jsdom).
- UI-3: `IconButton` has the accessible name `label` and, on focus, the tooltip shows the label and the `Kbd` of its `keyBinding` (Radix opens on focus).
- Also: `TextField` with `invalidMessage` sets `aria-invalid` and shows the message with `role="alert"`; `StatusDot` has `role="img"` and the label as its name; `Kbd` renders `Ctrl+K Ctrl+T` as four key caps.

`tests/ui-kit/no-raw-css.test.ts`:

- UI-1: `findRawValues` on `tests/fixtures/css/raw-values.module.css` reports exactly 3 problems (hex on line 2, `rgba(` on line 3, `4px` on line 4) and nothing for `2px 1px 0`, the comment, or `var(--size-row)`; running the script over `src` exits 0.

## 021 Panel frame, lists and trees

Code: `src/modules/ui-kit/components/` `PanelFrame` (with `PanelViewState`), `EmptyState`, `ErrorState`, `Skeleton` (`SKELETON_DELAY_MS`), `List`, `Tree`, `Tabs`, `SplitView`, `ProgressBar`, shared `PanelStates.module.css`, `virtual-rows.ts` (`useVirtualRows`, `useTypeAhead`, `VIRTUALISE_ABOVE`), `ui-kit-actions.ts` (`UiKitActionsContext` for "Show log"); exports in `src/modules/ui-kit/index.ts`.

`tests/ui-kit/panel-frame.ui.test.tsx`:

- P-40: `PanelFrame` with each state. `loading` shows nothing for 150 ms, then the loading line (fake timers); `empty` shows the title, message and action button; `error` shows the message, Retry calls `onRetry`, "Show log" calls `openLog` from a provided `UiKitActionsContext`, and the frame gets the error class; `ready` renders the children, and the children are absent in the other three states.

`tests/ui-kit/list.ui.test.tsx`:

- UI-7: with 1 000 rows of height 26 in a 260 px container, fewer than 60 `option` elements are in the DOM; with 150 rows, all 150 are.
- Keyboard: ArrowDown, ArrowUp, Home, End move `onSelect`; Enter calls `onActivate` with the selected id.
- Type-ahead: typing `b` then `e` quickly selects the first row whose text starts with "be".

`tests/ui-kit/tree.ui.test.tsx`:

- Right on a collapsed folder calls `onToggle`; Right on an expanded folder selects its first child; Left on an expanded folder calls `onToggle`; Left on a child selects its parent; rows carry `aria-level` and `aria-expanded`.

Also worth tests: `Tabs` arrow keys change and focus the tab; `SplitView` arrow keys on the separator change `aria-valuenow` and respect `minSizes`; `ProgressBar` clamps 1.4 to `aria-valuenow` 100.

## 022 Overlays and icons

Code: `src/modules/ui-kit/components/` `Dialog`, `ConfirmDialog`, `Menu` (dropdown and context, `MenuItem`), `Toast` (`ToastProvider`, `useToast`, `TOAST_MS`, `MAX_TOASTS`), `Icon`, `overlay-state.ts` (`useOverlayOpen`, `useAnyOverlayOpen`), `Overlay.module.css`; `src/modules/ui-kit/icons/` (49 `<name>.svg.tsx` pixel grids, `index.ts` with `ICONS` and `IconName`, `pixel-grid.ts`).

`tests/ui-kit/overlays.ui.test.tsx` (jsdom, Testing Library, fake timers where noted):

- Escape closes a `Dialog` (calls `onClose`) and focus returns to the button that opened it.
- `ConfirmDialog` with `danger` focuses Cancel on open; without `danger`, the first focusable element.
- At most 3 toasts: showing 4 leaves the last 3; a non-error toast is gone after 4 000 ms; an error toast stays until Dismiss.
- SET-15 for a dialog: under `data-motion="reduced"` on the root, the dialog's animation is the fade (check the class or computed `animation-name` where jsdom allows).
- `useAnyOverlayOpen` is true while a `Dialog` or an open `Menu` is mounted and false after (BROW-3).

Also: every name in `ICONS` is 8 rows of 8 cells; `Icon` renders one `rect` per `#`.

## 023 Command palette

Code: `src/modules/ui-kit/palette/rank-commands.ts` (`matchScore`, `rankCommands`), `command-registry.ts` (`createCommandRegistry`, `PaletteMode`, `PaletteItem`), `CommandPalette.tsx` (+ `.module.css`, `COMMAND_MODE`), the registry in `src/modules/shell/loader/ui-context.ts` (`commandRegistry`), `src/ui/app-root.tsx` (`AppRoot`, palette and message controls), the `shell.commandPalette` command (`Ctrl+Shift+P`, global) in `src/ui/index.tsx`. Feature F-008.

`tests/ui-kit/rank-commands.test.ts`:

- UI-11: titles "Settings: Open", "Open Settings", "Toggle Side Bar", "Restart service"; query `set` ranks the prefix match "Settings: Open" first, then the word-start match "Open Settings", then any subsequence ("Restart service"); "Toggle Side Bar" is excluded. Among equal scores the id in `recent` comes first, then registration order.

`tests/ui-kit/palette.ui.test.tsx` (jsdom, inside `ToastProvider`):

- UI-13: with a command whose `run` rejects with "Boom", typing and pressing Enter closes the palette and shows an error toast "Boom"; a resolving command runs once and is marked used.
- UI-14: focus a button, open the palette, press Escape: focus is back on the button.
- Also UI-12: with a provider mode of prefix '' opened as `initialMode`, typing `>` switches to the commands list.

F-008 (e2e, card 025 covers it): press Ctrl+Shift+P, type "set", "Open Settings" runs from the list (needs card 024's `settings.open`).

## 024 Settings screen

Code: `src/modules/settings/panel/SettingsScreen.tsx` (+ `.module.css`, `SCREEN_SECTIONS`, `SAVE_DELAY_MS`, `keyLabel`), `schema-control.tsx` (`SchemaControl`, `fieldKindOf`), `KeybindingsSection.tsx`, `ThemesSection.tsx`, the `settings.screen` panel and `settings.open` command (`Ctrl+,`) in `src/modules/settings/register.ui.ts`; `CommandsContext` in `src/modules/ui-kit/palette/command-context.ts`; the full-window panel host in `src/ui/app-root.tsx` (+ `app-root.css`). Feature F-009.

`tests/settings/settings-screen.ui.test.tsx` (jsdom, `FakeBus` answering `getSection`, `getProblems`, `setValue`; fake timers):

- An invalid number (type 400 into the terminal font size with max 40, or text into a number-backed text field) shows the schema's message under the control and no `setValue` is sent after 400 ms.
- "Reset" appears only for a key whose value differs from its default; pressing it sends `setValue` with the default after 400 ms.
- The problems banner lists each problem from `getProblems` (and from a `problemsChanged` event) with an "Open file" button.

Also: `fieldKindOf` gives `boolean` for `z.boolean().default(true)`, `enum` with options, `number` with min and max for `z.number().int().min(8).max(40).default(14)`, `path` for `zAbsPath.nullable().default(null)`; a valid edit is sent once, 400 ms after the last change.

F-009 (e2e, card 025 covers it): press Ctrl+, , change a value, invalid input shows a message and is not saved.

## 025 Stage 0 checks

Code: `electron-builder.yml` (app id `local.hsos.app`, product `HSOS`, NSIS with `oneClick: false`, `perMachine: false`, `allowToChangeInstallationDirectory: true`, `asarUnpack` for node-pty and better-sqlite3, built-in themes copied to `<resources>\themes`, `npmRebuild: false`), `resources/icon.ico` (256 by 256, `HS` in Jersey 10, `#FF003C` on `#0B0A09`, radius 48, aliased). Feature F-010.

`tests/e2e/stage-0.e2e.ts` (Playwright with Electron, a temp `APPDATA` and `LOCALAPPDATA` so the owner's real settings are never touched):

1. REL-7 and P-32: write `{ not json` to `%APPDATA%\HSOS\settings\settings.json` before launch; the window opens; `Ctrl+,` opens the settings screen and its problems banner lists the file.
2. F-008: `Ctrl+Shift+P` opens the palette; type `set`; "Open Settings" is in the list and Enter opens the settings screen.
3. F-007: copy `tests/fixtures/themes/test-light.json` into `%APPDATA%\HSOS\themes`, set `theme` to `test-light` (through the settings screen's Themes "Use", or by writing settings.json), and `getComputedStyle(document.documentElement).getPropertyValue('--color-bg-app')` becomes `#F4F1EA` without a reload (keep a marker on `window` and check it survives).
4. SHELL-14: kill the renderer (`webContents.forcefullyCrashRenderer()` through `electronApp.evaluate`); the window reloads and the `?e2e=1` ping line shows all three services again.
5. `npm run dist` produces an installer `dist/HSOS Setup 0.1.0.exe` (check once, outside the e2e run).

Also F-005 (move the window, restart, same place), F-006 (edit settings.json on disk, the change applies within a second) and F-004 (kill workspace-service, a crash file appears in `%LOCALAPPDATA%\HSOS\crash`, the service is ready again within 5 s) can join this file.

## 026 Demo backend

Code: `src/demo/demo-transport.ts` (`createDemoTransport`, `buildFixtureTable`), `src/demo/all-channels.ts`, `src/demo/mock-from-schema.ts` (`mockFromSchema`, `DEMO_NOW`), `src/demo/terminal-replay.ts` (`parseReplay`, `createTerminalReplay`, `bytesFromDataUrl`), `src/demo/fixtures/` (one file per module, `world.ts`, `index.ts`, `terminal-claude.bin`), demo mode in `src/ui/bus.ts` (`isDemoMode`, `createDemoRendererBus`), `src/ui/index.tsx` and `src/main/index.ts`, the `demo` script.

`tests/demo/fixtures.test.ts`:

- `buildFixtureTable(ALL_FIXTURES, false)` reports no problems: every hand-written fixture parses with its channel's schema.
- With `generateMissing` on, every request channel in `REQUEST_CHANNELS` has an entry and there are no problems (155 channels at this commit).
- Every function fixture, called with a request built by `mockFromSchema` and parsed with the request schema, returns a value that parses with the response schema. A one-off check at this commit found none failing.

`tests/demo/demo-transport.test.ts` (`createFakeClock`, `random: () => 0`):

- A request for a channel with no fixture (`generateMissing: false`, a declared channel left out) answers `INTERNAL` with "No demo data".
- A request is answered after 80 ms with `random` 0 and 400 ms with `random` 1, not before.
- An event fixture with `everyMs` fires on the clock.

Also: `parseReplay` reads the records of `terminal-claude.bin` and stops at a truncated record; `npm run demo` opens the window with demo data (not launched in this run).

## 027 Motion, glass and the background

Code: `src/modules/ui-kit/motion/` (`motion.ts`, `motion.module.css`, `lift.module.css`), `src/modules/ui-kit/components/Surface.tsx`, `surface-alpha.ts` (`raiseReadingAlphas`), `RollingNumber.tsx` (`changedDigits`), `src/modules/ui-kit/backdrop/` (`Backdrop.tsx`, `backdrop-client.ts` with `startBackdrop` and `readBackdropSettings`, `backdrop.worker.ts`, `protocol.ts`, `sources.ts`, `scenes/`), `src/modules/settings/panel/apply-theme.ts`, `eslint-rules/no-layout-animation.js` (`findLayoutAnimations`, rule `hsos/no-layout-animation`). Feature F-065.

jsdom computes no CSS animations from CSS modules, so motion rows check the classes and inline delays, or run in Playwright against the built renderer. `startBackdrop` takes `createWorker`, so backdrop rows pass a fake worker that records `postMessage`; jsdom has no `transferControlToOffscreen`, so stub it on the canvas prototype to return a plain object.

`tests/ui-kit/motion.ui.test.tsx`:

| Rule   | Given                                                   | When                    | Then                                                                                                     |
| ------ | ------------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------- |
| MOT-2  | a `Button`                                              | pointer down, then up   | it has `data-released` after pointer up, and its class composes `lift` (scale 0.96 on `:active`)       |
| MOT-2  | `tiltToward` with a 100 by 30 box, pointer at the right edge, max 18 | it runs     | `ry` is 18 and `rx` is 0; the same box 300 wide gives 9                                                 |
| MOT-3  | a `List` of 12 rows                                     | it renders              | rows 0 to 7 have `animation-delay` 0 to 140 ms and rows 8 to 11 have 140 ms; after 360 ms the enter class is gone |
| MOT-4  | a `Dialog`                                              | it opens                | the dialog composes `dialogIn` (scale 0.94 to 1 over `motion.slow`) and the dim composes `dimIn`         |
| MOT-8  | a `RollingNumber` with value 41                         | it re-renders with 42   | only the last cell has the `in` and `out` spans; `changedDigits('41 %', '42 %')` is `[false, true, false, false]` |
| MOT-12 | `data-motion="reduced"` on the root                     | `useReducedMotion` runs | it returns true, and false again when the attribute becomes `full`                                       |

`tests/ui-kit/backdrop.ui.test.tsx` (fake worker):

| Rule  | Given                                                       | When                                        | Then                                                                                         |
| ----- | ----------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| UI-30 | `--backdrop-scene: unknown` on the root                     | `sceneFor('unknown')`, and `Backdrop` mounts | the scene is `still`; one canvas exists under `[data-hsos-backdrop]`                         |
| UI-33 | the `Backdrop`                                              | the accessibility tree is read              | no node comes from it (`aria-hidden` on the backdrop and the CRT overlay)                    |
| UI-33 | the pointer moves three times in one frame and clicks empty space | one animation frame passes          | the worker received one `pointer` and one `puff`; a click on a `button` sends no puff; a click after a 10 px drag sends none |
| UI-34 | the `Backdrop`                                              | it renders                                  | `[data-hsos-crt]` has `pointer-events: none` and no animation; no element has a `filter` with `url(` |
| UI-35 | two sources, one inside a `display: none` parent            | 1 000 ms pass (fake timers)                 | at most 10 `sources` messages, each holding only the visible source                          |

`tests/ui-kit/phosphor-dust.test.ts`:

| Rule  | Given                                                                       | When                       | Then                                                                    |
| ----- | --------------------------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------- |
| UI-34 | `createPhosphorDustScene` with Phosphor's colours and three sources at strength 1 | 300 frames are stepped and rendered | no pixel's `luminance` is above `brightnessLimit(color.accent)` |

`tests/ui-kit/surface.test.ts`:

| Rule  | Given                                                               | When                       | Then                                                                    |
| ----- | ------------------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------- |
| UI-31 | tokens with `surface.terminal.alpha: 0.3`, `surface.text.minAlpha: 0.85` | `raiseReadingAlphas` runs | the terminal alpha is `0.85` and one problem names `surface.terminal.alpha` |

`tests/lint/no-layout-animation.test.ts`:

| Rule  | Given                                                           | When                         | Then                    |
| ----- | --------------------------------------------------------------- | ---------------------------- | ----------------------- |
| MOT-1 | `.a { transition: width 1s }`, `@keyframes k { to { height: 0 } }`, `transition: all 1s` | `findLayoutAnimations` runs | three problems |
| MOT-1 | `transition: transform var(--motion-quick) var(--motion-ease-spring), filter 1s` | `findLayoutAnimations` runs | no problem |

Also worth a test: the worker draws no frame while `visibility` is hidden and draws exactly one under `reduced` (UI-32, needs the app, e2e); `applyTheme` sets `--surface-terminal-alpha` to the raised value.

## 028 App frame and pages

Code: `src/modules/workspace/panel/` (`AppFrame.tsx`, `TitleBar.tsx` with `repoName`, `Pages.tsx` with `useSideStore` and `areaOf`, `DockHost.tsx`, `StatusBar.tsx`, `page-store.ts` with `usePageStore` and `pageBeside`, `page-transition.ts` with `goToPage` and `shareForTransition`, `frame.css`), `src/modules/workspace/register.ui.ts`, `src/ui/app-root.tsx`, `src/ui/module-list.ts`, `src/modules/ui-kit/components/page-visible.ts`. Feature F-066.

jsdom has no `document.startViewTransition`, so component rows exercise the direct switch; stub it on `document` to check it is called once. dockview needs a `ResizeObserver` (see `tests/workspace/dockview-spike.ui.test.tsx`).

`tests/workspace/pages.ui.test.tsx`:

| Rule  | Given | When | Then |
| ----- | ----- | ---- | ---- |
| WS-40 | the frame on `code`, focus in an element with `data-hsos-terminal`, the key dispatcher over the workspace commands | `Ctrl+3` | the `notes` section is visible, `code` is `inert`, and the switcher's `aria-current` is on "Notes" |
| WS-40 | `pageBeside` | `code` with -1 and 1, `notes` with 1 | `dashboard`, `notes`, `dashboard` |
| WS-43 | the `notes` page with a dock panel type registered | `ctx.openPanel` of that type | it opens in the "Notes dock" section, not the "Code dock" |
| WS-45 | a button on `code` had focus | `goToPage('dashboard')`, then `goToPage('code')` | that button has focus again |
| WS-41 | the frame showed `dashboard` once | it goes back to `code` | the `dashboard` section is still in the DOM, hidden and `inert` |
| WS-11 | a dock panel with `allowMultiple: false`, open | it is opened again with new state | one dockview panel of that type exists |
| WS-13 | a dock panel component that throws, beside a healthy one | both open | the error state shows in the first; the second renders |
| UI-30 | the frame | the page changes twice | one canvas under `[data-hsos-backdrop]`, the same node throughout |

`tests/e2e/demo-pages.e2e.ts` (launch with `--hsos-demo`):

| Rule   | Given | When | Then |
| ------ | ----- | ---- | ---- |
| MOT-5  | the Code page | `Ctrl+1` | `startViewTransition` ran once (wrap it in `page.evaluate`); the Dashboard shows after `motion.page` |
| MOT-7  | the background running | three page changes | the canvas is the same node and `backdropStats()` frames never go down |
| MOT-11 | a page transition in progress | a key is pressed in a focused input on the new page | the input has the character before the transition finishes |
| WS-41  | the demo on `code` | Dashboard for 3 s and back | the code section is the same node |

Also worth a test: `repoName('https://github.com/a/b')` is `a/b`, and `null` for a bad URL; the repo button is absent when `webUrl` is null; the side tabs list registered side views in order with Settings last.

## 029 Terminal panel, ribbon and mascot

Code: `src/modules/terminal/panel/` (`TerminalPanel.tsx` with `createTerminalPanel`, `create-xterm.ts`, `xterm-theme.ts` with `xtermTheme`, `terminalAlpha` and `withAlpha`, `header-slot.tsx`), `src/modules/terminal/register.ui.ts`, `src/modules/hud/panel/ribbon/` (`Ribbon.tsx` with `createRibbon`, `shortFolder`, `listedAgents`, `elapsedSince`; `hud-data.ts` with `useHudData`, `sessionForTerminal`, `startHudData`), `src/modules/hud/panel/mascot/` (`Mascot.tsx`, `mascot-sheet.ts` with `loadMascotSheet`, `mascotStateFor`, `frameAt`), `src/modules/hud/register.ui.ts`, `src/modules/ui-kit/components/contributions.ts`. Feature F-067.

xterm needs a canvas; in jsdom mock `@xterm/xterm` with a fake `Terminal` that records its options and `write` calls, and mock `@xterm/addon-webgl` to throw (the fallback path). Use `FakeBus` for the bus.

`tests/terminal/header-slot.ui.test.tsx`:

| Rule   | Given | When | Then |
| ------ | ----- | ---- | ---- |
| TERM-75 | a contribution (through `contributeUi(terminalHeader, ...)`) returning a 28 px element for `t1`, then a 64 px one | the panel renders | `onHeightChange` is called with 28, then 64, and the panel refits (a `terminal.resize` call follows each) |
| TERM-75 | two contributions, the first returning null | the slot renders | the second one's content shows |
| TERM-76 | `--surface-terminal-alpha: 0.9`, `--surface-text-minAlpha: 0.78` on the root | the terminal is created | the fake `Terminal` got `allowTransparency: true` and a theme background `rgba(..., 0.9)`; with alpha 0.3 it is 0.78 |

`tests/hud/ribbon.ui.test.tsx` (seed `useHudData` directly):

| Rule   | Given | When | Then |
| ------ | ----- | ---- | ---- |
| HUD-80 | a session bound to `t1` with activity `working`, and one bound to `t2` that `ended` | the ribbon renders for each | `t1` shows a ribbon inside a `[data-surface="ribbon"]`; `t2` renders nothing |
| HUD-80 | the `t1` session becomes `needs-you` | the ribbon re-renders | `data-activity` is `needs-you` and the steam source colour is `color.brand` (spy on `addBackdropSource` or read the source registry) |
| HUD-81 | a session with title, model, effort `high`, mode `plan`, cwd under `C:\Users\x`, context 72 | it renders | the parts read in order: mascot, title, "Opus 5.5 · high", "Plan", `~\...`, repo, context bar and "72%" toned warn |
| HUD-82 | two running subagents and one that ended 30 s ago, another 90 s ago | the mascot button is pressed | three rows show, the 30 s one with "done"; with none, "No subagents running." |
| HUD-83 | the context goes from 41 to 42 | it re-renders | only the last digit of the percentage has the roll spans |

`tests/hud/mascot.ui.test.tsx` (fake timers):

| Rule   | Given | When | Then |
| ------ | ----- | ---- | ---- |
| HUD-90 | `mascotStateFor` | each activity on `code`, `notes`, `other` | working, background give `working`, `reading`, `dancing`; needs-you `waving`; done `cheering`; idle `resting`; ended and null `sleeping` |
| HUD-91 | a mascot `working` | the activity becomes `needs-you` | the strip shows row 5 (turn) for 3 frames at 12 fps, then row 1 |
| HUD-91 | `loadMascotSheet('not json')` | it runs | `kind` is `placeholder` with a problem; the component draws the two blocks and the reporter is called once |
| HUD-92 | seven running subagents | the ribbon renders | five mini mascots and `+2` |
| HUD-93 | `data-motion="reduced"` | a dancing mascot renders and 2 s pass | the strip stays at frame 0 of its row; the mascot has `aria-hidden` |

Also worth a test: `frameAt` for `from 4` (0 to 5, then 4, 5, 4) and `loop, hold frame 0` (frame 0 for `fps * 3` steps, then 1, 2, 3); `shortFolder` cuts the middle; `sessionForTerminal` picks the newest non-ended session; `elapsedSince` gives `42s`, `12m`, `3h 05m`.

## 031 HUD

Code: `src/modules/hud/panel/` (`HudPanel.tsx`, `Section.tsx`, `QuickBar.tsx` with `tokensText`, `SessionsSection.tsx` with `inProject`, `boardOrder`, `cacheState`, `contextToneClass`, `UsageSection.tsx` with `usageTone`, `resetsText`, `staleNote`, `SkillsSection.tsx` with `matchesSkill`, `deckOrder`, `SetupView.tsx` with `lastUsedText`, `matchesRow`, `setupSections`, `send-command.ts` with `sendToSession` and `cleanFreeText`, `hud-alerts.ts` with `firstSentence`, `spokenText`, `startHudAlerts`, `hud-data.ts` with `targetSession`, `VoiceChooser.tsx`, `AttentionStatus.tsx`), `src/modules/hud/register.ui.ts`, `src/modules/ui-kit/components/Popover.tsx`. Feature F-068.

Seed `useHudData.setState` directly in component tests and wrap them in `HudDepsContext.Provider` with a `FakeBus`. Use a fake clock for timers.

`tests/hud/hud.ui.test.tsx` (component rows of hud.md):

| Rule | Given | When | Then |
| ---- | ----- | ---- | ---- |
| HUD-1 | sessions in the project, in its `.claude\worktrees\x`, and elsewhere | the board renders, then "Show all projects" | first two, then all three |
| HUD-2 | one session of each activity with different change times | `boardOrder` | needs-you, working, background, done, idle, ended; newest first within a group |
| HUD-3, HUD-9 | a working session with tool `Edit`, two running agents, context 72 | it renders | second line "Edit · 2 agents", "72%" with the warn class; at 91 the danger class |
| HUD-4 | an agent that ended 30 s ago and one 90 s ago | it renders | only the 30 s one, with "done" |
| HUD-5 | a row with a terminal, and one with `terminalId: null` | each is activated | the first calls `link.markSeen` and focuses `[data-terminal-id] textarea`; the second does nothing and shows "outside HSOS" |
| HUD-6 | a session turns `needs-you` | it re-renders | its dot has the pulse class (three 400 ms iterations) |
| HUD-7 | focus moves into `[data-terminal-id="t1"]` | the `focusin` runs | `markSeen` for every session bound to `t1`; `focusOrder` starts with `t1` |
| HUD-8 | `lastResponseAt` 8 minutes ago | `cacheState` | `warm 52m`; 61 minutes ago gives `cold` |
| HUD-10, HUD-11 | window not focused (`document.hasFocus` false), a session working 40 s then `done`, then `needs-you` 3 s later | the alerts run | one `shell.notify` for done; the needs-you inside 10 s sends none |
| HUD-13 | window focused and the session's terminal focused | it turns `needs-you` | no `shell.speak`; with focus in another terminal one `shell.speak` |
| HUD-14 | `lastMessage` "Done. See ```x``` [docs](http://a) now." | `spokenText(done, summary on)` | `<title>. Finished. Done.`; needs-you gives `<title>. Needs you. <reason>.` |
| HUD-16 | `hud.chooseVoice` with voices A and B | B is chosen | `settings.setValue` `speakVoice` B and `shell.speak` with the test line and voice B |
| HUD-25, HUD-26 | five-hour 58 % resetting in 2 h 10 m, seven-day null, `updatedAt` 14 min ago | usage renders | "58%", `resets 2h 10m`, "No data yet" for 7 days, the note "updated 14m ago" |
| HUD-27 | the same | the status items render | `5h 58%` shows; `7d` is absent |
| HUD-30 | skills "caveman" (favourite) and "graphify" | query `turn folder` | only the one whose name or description has both words; favourites first |
| HUD-31 | no live session | a skill is activated | a toast "Start a Claude session first"; with a target, `terminal.write` of `/name ` without `\r` |
| HUD-36, HUD-37 | a skill `off` with `stateLock: 'policy'` | its row and menu render | chip "off" muted; the state choices are disabled with the lock reason |
| HUD-40, HUD-41 | `out-of-sync` with 3 changed, 1 added, 2 removed, ahead 1 | the row renders and Sync is pressed | the counts line, then a confirm dialog listing the folders; confirming calls `pushToRepo` |
| HUD-60 | no target session | the quick bar renders | the title reads "Start a Claude session first"; Compact, Clear and the model button are disabled; Usage, Context, Skills work |
| HUD-63 | target `idle`, last owner input before the last reply | `/status` is sent | `terminal.write` `/status\r` with `quick-command`; with input after the reply, `/status` as `owner` and a toast; `needs-you` writes nothing and toasts |
| HUD-64 | target `working` | the mode button is pressed | `terminal.write` `\x1b[Z` with `quick-command`; focus stays where it was |
| HUD-65 | the compact dialog with "keep\nthe tests" | Compact | `/compact keep the tests`; Cancel has focus when it opens |
| HUD-66 | the clear dialog | Clear | `/clear` |
| HUD-68 | `cleanFreeText('a\u0007b\nc')` | it runs | `a b c` |

`tests/hud/setup-view.ui.test.tsx`:

| Rule | Given | When | Then |
| ---- | ---- | ---- | ---- |
| HUD-50 | a setup with 2 MCP servers and 1 plugin | the view renders | the header counts each section; no "Show what loads at start" without `graph.agentView` |
| HUD-51 | a server last used 3 days ago by `claude`, one with null | it renders | `3 d ago` with "Counted by Claude Code"; `never seen` |
| HUD-53 | "Not used in 30 days" on, sort least recently used | it renders | only stale or unknown rows, unknown first |
| HUD-54 | a target session | "Ask Claude to remove" on MCP server `old-db` | `terminal.write` of the exact sentence without `\r` |
| HUD-55 | `errors` with one file | it renders | "Could not read <file>: <message>" in the warn class; focus after 11 s calls `getSetup` again |

Also worth a test: a section that throws shows its error state while the others render (Section boundary); `tokensText(41000, 200000)` is `41k of 200k tokens`; `firstSentence` cuts at 160 characters on a word boundary.

## Owner amendments 2026-11-19

Code: `src/modules/hud/panel/HudPanel.tsx`, `src/modules/terminal/panel/TerminalPanel.tsx` (`MIN_FONT_SIZE`, `MAX_FONT_SIZE`, the wheel listener). No rule ids in the spec yet; name the tests `OWNER-1` and `OWNER-2`.

| Test | Given | When | Then |
| --- | --- | --- | --- |
| OWNER-1 | the HUD panel with skills and a repo state | it renders | the Skills section holds the repo row before the search field, and no "Skills repo" section title exists |
| OWNER-2a | a terminal panel with font size 13 and delta 0 | a wheel event with `ctrlKey` and `deltaY < 0` | xterm's `fontSize` is 14, `setState` got `fontSizeDelta: 1`, `terminal.resize` was called, and the event's `defaultPrevented` is true |
| OWNER-2b | font size 32 | Ctrl+wheel up | the size stays 32 and `setState` is not called; at 8, Ctrl+wheel down likewise stays 8 |
| OWNER-2c | any size | a wheel event without `ctrlKey` | the size is unchanged and the default is not prevented (normal scrollback) |
| OWNER-2d | saved state with `fontSizeDelta: 3` and font size 13 | the panel opens | xterm starts at 16 |

## 030 Files, viewer and history

Code: `src/modules/files/panel/` (`FilesTree.tsx`, `FileViewer.tsx`, `use-project.ts`, `helpers.ts`), `src/modules/files/register.ui.ts`, `src/modules/history/panel/` (`Timeline.tsx`, `DiffView.tsx`, `line-diff.ts` with `diffLines`, `format.ts`), `src/modules/history/register.ui.ts`, `src/ui/module-list.ts`. No feature flag in this card.

Jsdom computes no CSS animations, so the state rows check the rendered text and roles. The panels read the bus through `ctx.bus`: pass a fake `Bus` whose `call` answers from a map and whose `on` records listeners. `useToast` needs a `ToastProvider` around the component. `ConfirmDialog` and `Dialog` portal into `document.body`, so query them with `screen`.

`tests/files/files-tree.ui.test.tsx`:

| Rule    | Given | When | Then |
| ------- | ----- | ---- | ---- |
| FILE-60 | a project whose root lists `src/` (dir) and `README.md` (file) | the view renders | the root shows both, folders first; `src` has `aria-expanded="false"` |
| FILE-60 | `src` collapsed and not loaded | `ArrowRight` on `src` | `files.listDir` is called once with `src`'s absolute path; the children appear |
| FILE-61 | folder `src` expanded, `docs` collapsed | `files.changed` with `docs\x.md` and `src\y.ts` | `listDir` is called for `src` and for the root only; not for `docs` |
| FILE-61 | the same | `files.rescanNeeded` | the root reloads (no error) |
| FILE-63 | `README.md` selected | `Enter` | `ctx.openPanel` gets `files.viewer` with `{ path, line: null }` (through the `openFile` prop) |
| FILE-1  | entries `b.txt`, `A` (dir), `node_modules` (dir, `isDimmed: true`) | the root renders | row order is `A`, `node_modules`, `b.txt`; the `node_modules` label has the dimmed class |
| state   | `listDir` pending for more than 150 ms | the view renders | a skeleton with the label "Loading files" appears (the label is the frame's text) |
| state   | `listDir` returns `{ ok: false, error: { message: 'Access denied' } }` | the view renders | "The folder could not be read. Access denied" with a "Retry" button; Retry calls `listDir` again |
| state   | root listing is `[]` | the view renders | "This folder is empty." with a "New file" button; the button opens the New file dialog |
| state   | no project (`getCurrentProject` returns null) | the view renders | "No project open" |
| Delete  | `confirmTrash()` true, a file selected, context menu "Delete" | it is chosen | the "Move to Recycle Bin?" dialog shows; Confirm calls `files.trash` with that path |

`tests/files/file-viewer.ui.test.tsx`:

| Rule   | Given | When | Then |
| ------ | ----- | ---- | ---- |
| FILE-73 | a clean viewer on `a.ts` with text `one` | `files.changed` with `a.ts` `changed`, and `files.read` now returns `two` | the editor shows `two`; no element with role `alert` |
| FILE-74 | a dirty viewer (text typed: `one x`) | `files.changed` with `a.ts` `changed` | the alert shows "This file changed on disk."; the editor still has `one x`; `files.save` was not called |
| FILE-74 | the same, then the owner presses Ctrl+S | `files.save` returns `FILE_CHANGED_ON_DISK` | the alert is still shown; no save with `overwrite: true` was sent |
| FILE-74 | the same bar | "Overwrite" pressed | `files.save` is called with `overwrite: true` and the editor text |
| FILE-72 | a clean viewer, text `one` changed to `one x` | Ctrl+S | `files.save` gets `baseHash` of the loaded version, `format` of the loaded file, `content` `one x` |
| FILE-75 | a viewer | `files.changed` `deleted` | "This file was deleted." with "Save to recreate"; the editor keeps its text |
| FILE-78 | a viewer opened with `line: 3` on a 5-line file | the text loads | the caret is at the start of line 3 (`selectionStart` equals the offset of line 3) |
| FILE-70 | `files.read` returns kind `binary` | the viewer renders | "This file is not text." and "Reveal in Explorer" (calls `shell.revealInExplorer`) |
| FILE-70 | kind `too-large` | the viewer renders | "This file is too large to edit here." with the size |
| state  | `files.read` pending | the viewer renders | the loading skeleton with "Opening a.ts" after 150 ms |
| state  | `files.read` fails | the viewer renders | "This file could not be opened. <reason>" with Retry; Retry reads again |
| state  | an empty text file | the viewer renders | a normal empty editor, no error |

`tests/history/timeline.ui.test.tsx`:

| Rule    | Given | When | Then |
| ------- | ----- | ---- | ---- |
| HIST-40 | three snapshots for one path, newest first, sources `external`, `hsos-save`, `baseline` | the timeline renders | rows read "Changed outside HSOS", "Saved in HSOS", "Before first change", newest first |
| HIST-40 | the same | the timeline renders | each row names the size change against the older row (`+37 B` style, see the note in `progress`) |
| HIST-41 | a selected snapshot and the previous one | the diff loads | `history.getPrevious` and `history.readText` ran for both; the diff shows the added and removed lines |
| HIST-41 | "Compare with current file" switched on | the diff loads | `files.read` provides the right-hand side |
| HIST-42 | a timeline with a selected snapshot | "Restore this version", then Confirm | `history.restore` is called once with the snapshot id; a toast with "is back at the version from" shows |
| HIST-42 | the same | Cancel | `history.restore` is not called |
| HIST-43 | a timeline for `a.ts` | `history.snapshotAdded` for `a.ts` | `history.listForFile` is called again; a snapshot for `b.ts` does not reload |
| state   | `history.listForFile` returns `[]` | the timeline renders | "No earlier versions of this file yet. Versions appear here after the file changes." |
| state   | `history.listForFile` fails | the timeline renders | "History could not be read. <reason>" with Retry |
| state   | the selected snapshot's `readText` returns `FILE_BINARY` | the diff loads | "Binary file changed." |
| state   | the diff is loading | the timeline renders | the skeleton "Loading the difference" |

`tests/history/line-diff.test.ts` (unit, no React):

| Rule    | Given | When | Then |
| ------- | ----- | ---- | ---- |
| HIST-41 | before `a b c`, after `a x c` | `diffLines` runs | `same a`, `removed b`, `added x`, `same c` in that order |
| HIST-41 | before empty, after `a` | `diffLines` runs | one `added a` |
| HIST-41 | a 2 000 by 2 000 line pair | `diffLines` runs | `null` (too large) |

## 032 Sessions

Code: `src/modules/sessions/panel/` (`SessionPicker.tsx`, `SessionHistory.tsx`, `SessionReader.tsx`, `SessionDialogs.tsx`, `actions.ts` with `loadSessions`, `resumeInNewTerminal`, `copyResumeCommand`, `rowMenu`, `matchesSearch`, `use-project.ts`, `format.ts`), `src/modules/sessions/register.ui.ts`, `src/ui/module-list.ts`. Feature: none in this card.

The picker mounts its own React root (`register.ui.ts`, `openPicker`), so a test can call the command's `run` and then query `document.body`. The panels read the bus through `ctx.bus` and take it as a prop: pass a fake `Bus` whose `call` answers from a map by channel name. Wrap components in `ToastProvider` (ui-kit) to see toasts.

`tests/sessions/picker.ui.test.tsx`:

| Rule   | Given | When | Then |
| ------ | ----- | ---- | ---- |
| SESS-31 | rows titled `fix login flow` and `write tests` | the picker renders, then the search field gets `flow fix` | only `fix login flow` shows |
| SESS-31 | the same | the search field gets `FLOW` | `fix login flow` shows (case ignored) |
| SESS-31 | a row with an empty title | the picker renders | the title reads "Untitled session" |
| SESS-31 | a row with `hasOriginal: false, hasBackup: true` | the picker renders | a "Backup only" badge shows on that row, and the state chip reads its state word |
| SESS-31 | a row with `messages: 12`, `lastActiveAt` 5 minutes ago | the picker renders | the row reads "5 min ago · 12 messages" |
| SESS-31 | arrow keys | `ArrowDown` after the first row is selected | the second row is selected (`aria-selected`) |
| SESS-31 | rows listed | Enter on a selected row without `liveTerminalId` | `terminal.create` is called first (see SESS-32) |
| SESS-32 | a row with `liveTerminalId: 't1'` | the picker renders, the row is selected | the footer shows "Go to terminal" (disabled) and "Open transcript"; no "Resume in new terminal" |
| SESS-32 | a row without a live terminal, the focused terminal at state `running` | the picker renders | "Resume in new terminal" and "Copy resume command" show; no "Resume here" (not built, see progress) |
| SESS-32 | "Resume in new terminal" | it runs | in order: `terminal.create` with `launch: null` and `cwd` of the session, `sessions.bind` with the new id, `terminal.write` with `claude --resume <id>\r` and `source: 'owner'` |
| SESS-32 | the same, with `hasOriginal: false` | it runs | `sessions.restoreTranscript` is called before `terminal.create` |
| SESS-32 | "Copy resume command" | it runs | `shell.writeClipboard` gets `cd "<cwd>"; claude --resume <id>` |
| state  | `sessions.list` pending for more than 150 ms | the picker renders | a skeleton with "Loading sessions" |
| state  | `sessions.list` returns `[]` | the picker renders | "No Claude sessions in this project yet." |
| state  | a non-empty list and a search that matches nothing | the picker renders | "No session matches." |
| state  | `sessions.list` fails | the picker renders | "Sessions could not be read. <reason>" with Retry; Retry calls `sessions.list` again |
| state  | no project (`getCurrentProject` returns null) | the picker renders | "Open a project to find its sessions." |

`tests/sessions/history.ui.test.tsx`:

| Rule    | Given | When | Then |
| ------- | ----- | ---- | ---- |
| SESS-71 | the open project `C:\code\hsos` and two folders in the list | the history renders | the project select shows the open project; rows of other folders are hidden |
| SESS-71 | the state select set to `interrupted` | the history renders | only interrupted rows show |
| SESS-72 | "All projects" chosen; rows in two folders | the history renders | two groups, each headed by its folder name; newest first within each |
| SESS-72 | rows 0 to 4 | a click on row 1 then a Shift-click on row 3 | rows 1 to 3 are selected (`aria-selected`) |
| SESS-72 | rows listed | Ctrl+A on the list | every visible row is selected; "Delete 5" shows in the toolbar |
| SESS-73 | a selected row | F2 | the rename dialog opens with the current title |
| SESS-73 | a selected row | the Delete key | the "Move 1 session to the Recycle Bin?" dialog opens |
| SESS-73 | a row with a note whose first line is `Kept for notes` | the history renders | the note's first line shows, muted |
| SESS-74 | rename dialog with `fix login` | the field is changed to `fix login flow` and Save | `sessions.rename` is called with the trimmed title; the dialog closes; the copy under the field reads "Claude Code's own session list shows this name too." for an ended session and "Claude Code shows this name after the session ends." for a live one |
| SESS-74 | a title of 81 characters | the field is read | Save is disabled; "Use 80 characters or fewer." shows |
| SESS-75 | note dialog | Ctrl+Enter after typing | `sessions.setNote` is called once with the text; Enter alone adds a line |
| SESS-76 | two sessions selected, one `running` | "Delete 2" then the confirm dialog | the body names the running one under "Still running, will be skipped:"; Cancel has focus; Confirm calls `sessions.trash` with the ended one only |
| SESS-76 | the same, `sessions.trash` returns `{ trashed: [a], failed: [{ sessionId: b, message: 'Locked' }] }` | Confirm | a toast reads "1 moved to the Recycle Bin"; a second toast reads "Locked" |
| SESS-70 | the history is open | `sessions.recordChanged` fires three times within 300 ms | `sessions.list` is called once more after 500 ms (debounced) |
| state   | `sessions.list` returns `[]` | the history renders | "No Claude sessions found." |
| state   | a filter that matches nothing | the history renders | "No session matches." |
| state   | `sessions.list` fails | the history renders | "Sessions could not be read. <reason>" with Retry |

`tests/sessions/reader.ui.test.tsx`:

| Rule   | Given | When | Then |
| ------ | ----- | ---- | ---- |
| SESS-50 | a transcript of a user prompt, an assistant text, a tool item `Bash npm run check` | the reader renders | "You" and "Claude" items show their text; the tool item is one muted line |
| SESS-50 | 250 items in the transcript | the reader renders | 200 items show; "Show earlier" shows; pressing it calls `readTranscript` with `beforeIndex` of the oldest shown item and `limit: 200` |
| SESS-50 | the reader is visible, the transcript grows from 3 to 4 items | 2 s pass (fake timers) | the fourth item appears; no duplicate of the first three |
| SESS-50 | the reader is on a hidden page (`PageVisibleContext` false) | 2 s pass | no `readTranscript` call after the first |
| SESS-51 | a prompt whose text is `<b>bold</b> and <script>x</script>` | the reader renders | the text shows literally; no `<b>` element exists |
| SESS-50 | the transcript has 0 items | the reader renders | "This session has no messages yet." |
| state  | `readTranscript` fails with `FILE_NOT_FOUND` | the reader renders | "The transcript could not be read. <reason>" with Retry |
| state  | `readTranscript` pending | the reader renders | the skeleton "Reading the transcript" |

## 033 Git, changes, feedback and activity

Code: `src/modules/git/panel/` (`ChangesStatus.tsx`, `actions.ts` with `gitMessage` and `runGitCommand`, `use-repo.ts`), `src/modules/git/register.ui.ts`, `src/modules/review/panel/` (`ChangesView.tsx`, `FeedbackTray.tsx` with `targetLabel`, `DiffPanel.tsx`, `DiffView.tsx` with `numberRows`, `rowsFor`, `targetOf`, `line-diff.ts`, `data.ts`, `TrayCount.tsx`, `use-repo.ts`, `helpers.ts`), `src/modules/review/register.ui.ts`, `src/modules/activity/panel/` (`Timeline.tsx` with `sectionsOf`, `Artifacts.tsx`, `PinDialog.tsx`, `format.ts`, `use-project.ts`), `src/modules/activity/register.ui.ts`, `src/ui/module-list.ts`. Feature: none in this card.

The component rows are the ones `review.md` and `activity.md` list under "component"; `git.md` has none. Jsdom has no CSS animation, so rows check text and roles. Panels take `ctx.bus` as a prop: pass a fake `Bus` that answers `call` from a map by channel name and records `on` listeners. Wrap in `ToastProvider` (ui-kit). `Dialog` portals into `document.body`.

`tests/review/changes.ui.test.tsx`:

| Rule   | Given | When | Then |
| ------ | ----- | ---- | ---- |
| REV-12 | the Changes view with `listChanges` returning `[a.ts, b.ts]`, `b.ts` selected | `changesInvalidated` for the project, and `listChanges` now returns `[a.ts, b.ts, c.ts]` | `b.ts` still has `aria-selected="true"`; `c.ts` is listed |
| REV-14 | `git.getStatus` returns a repo with `operation: 'merge'`, one changed file | the Changes view renders (base "Since last commit") | the "Commit" and "Commit and Sync" buttons are disabled |
| REV-14 | the same with `operation: 'none'`, a message from `git.suggestMessage` | the view renders | the message field shows the suggestion; "Commit" is enabled |
| REV-14 | the same, "Commit" pressed | `git.commit` | it receives every listed file's relative path and the message; the rows refresh |
| REV-10 | the base select | "Session: fix login" chosen | `listChanges` is called with `{ kind: 'session-start', sessionId }`; the commit box is gone |
| REV-11 | three files, `+120 −45` in sum | the view renders | the summary reads "3 files · +120 −45"; each row has its letter with the word in its accessible name (for example `M` with `Modified`) |
| REV-15 | a file row selected, "Show History" | it runs | `openHistory` is called with that file's absolute path |
| REV-34 | comments are sent (the tray shows "Sent. Clear comments?") | the tray renders | the comments are still listed; "Clear" and "Keep" show |
| REV-33 | one comment, a live Claude session with `liveTerminalId`, "Send to Claude" pressed | the view runs | `review.composePrompt` runs, then `terminal.write` with `\u001b[200~`, the prompt and `\u001b[201~`; the data has no carriage return; `source` is `owner` |
| REV-31 | a comment whose target is a `before` diff line, the prompt | the tray lists it | the label ends with `(removed line)` |
| state  | `listChanges` pending for more than 150 ms | the view renders | a skeleton "Reading changes" |
| state  | `listChanges` fails | the view renders | "Changes could not be read. <reason>" with Retry |
| state  | a folder that is not a repo, base "Since last commit" | the view renders | "This folder is not a git repository. Choose a Claude session to see its changes." |

`tests/review/diff.ui.test.tsx`:

| Rule   | Given | When | Then |
| ------ | ----- | ---- | ---- |
| REV-20 | a diff of 300 lines | the file gains three lines at the top and the diff refreshes | the same content line is still in view (checked by `data-row` order, the first visible row keeps its text); no scroll reset is asserted yet (see progress) |
| REV-23 | a diff with a changed line `out[i] = cap` at after-line 121 | the line gets focus, `C` is pressed, the text `Keep the cap` is typed, `Ctrl+Enter` | `review.addComment` is called with `{ kind: 'diff-line', path, line: 121, side: 'after', quote: 'out[i] = cap' }` and `text: 'Keep the cap'` |
| REV-23 | the same, Escape pressed in the box | | the box closes; no call |
| REV-22 | a run of 12 unchanged lines between two changes | the diff renders | one "⋯ 12 unchanged lines" button; pressing it shows the 12 lines |
| REV-22 | F7 pressed in the diff | | the cursor moves to the first changed row (`data-row` of that row is scrolled to) |
| REV-25 | `getDiff` returns `isBinary: true` | the panel renders | "Binary file changed." |
| state  | the diff of identical sides | the panel renders | "No differences." |

`tests/activity/timeline.ui.test.tsx`:

| Rule   | Given | When | Then |
| ------ | ----- | ---- | ---- |
| ACT-15 | a timeline with 40 entries, the list scrolled down by 300 px | an `activity.entryAdded` event arrives | the scroll position is unchanged (`scrollTop` still 300); a button "1 new changes" shows |
| ACT-15 | the list at the top | the same event | the new entry is the first row; no chip shows |
| ACT-11 | seven `claude` entries of one session within 40 s, then one `owner` entry | the timeline renders | one group row "refactor parser · 7 files" (the session title, cut to 24) and one single row "You"; the group row toggles its members (`aria-expanded`) |
| ACT-10 | entries from today and yesterday | the timeline renders | the day headings "Today" and "Yesterday" |
| ACT-14 | a row's context menu, "Restore the version before this change" | it is chosen | `history.getPrevious` is called; a confirm dialog shows; Confirm calls `history.restore` with the previous id |
| ACT-14 | the same, "Pin comment" | it is chosen | the pin dialog opens; Pin calls `review.addComment` with `kind: 'file-line'` and `line: 1` |
| ACT-33 | tiles `a/report.html` and `b/chart.png` | the search field gets `rep` | `activity.listArtifacts` is called with `query: 'rep'`; one tile shows |
| ACT-31 | an artifact tile of kind `html` | it is activated | `shell.openPath` is called with its path |
| ACT-31 | an image tile | it is activated | `ctx.openPanel` for `files.viewer` gets its path (through the `openFile` prop) |
| state  | `listTimeline` returns `[]` | the timeline renders | "No changes recorded yet. Changes to files in this project appear here." |
| state  | `listArtifacts` returns `[]` with an empty query | the artifacts view renders | "Pages, PDFs and images Claude makes in this project appear here." |
| state  | `listTimeline` fails | the timeline renders | "Activity could not be read. <reason>" with Retry |

## Lead fixes after the lane B merge: ui-kit views

Code: `src/modules/ui-kit/components/DiffView.tsx`, `diff-rows.ts` (`diffRows`, `foldRows`, `pairRows`), `CodeView.tsx`, `MarkdownView.tsx`; their users `src/modules/history/panel/Timeline.tsx`, `src/modules/review/panel/DiffPanel.tsx` (`targetOf`), `src/modules/files/panel/FileViewer.tsx`, `src/modules/files/register.ui.ts` (`openLink`).

`tests/ui-kit/diff-rows.test.ts` (pure):

| Rule | Given | When | Then |
| --- | --- | --- | --- |
| UI-DIFF-1 | `a\nb\nc` and `a\nB\nc` | `diffRows` | rows same 1/1, removed 2/null, added null/2, same 3/3 |
| REV-22 | 20 unchanged lines between two changes | `foldRows` with nothing expanded | one fold of 20; with its start expanded, 20 rows |
| UI-DIFF-2 | removed, removed, added | `pairRows` | pairs [r1,a1], [r2,null] |

`tests/ui-kit/views.ui.test.tsx` (jsdom):

| Rule | Given | When | Then |
| --- | --- | --- | --- |
| UI-5 | `MarkdownView` with source `<img src=x onerror=alert(1)>` | it renders | no `img` element; the text is shown |
| UI-5b | `MarkdownView` with `[x](javascript:alert(1))` and `[y](notes/a.md)` | click each link | `onLinkActivate` is never called with a `javascript:` href; it gets `notes/a.md` |
| REV-20 | `DiffView` scrolled to 400 px | `after` changes | the same element is in the DOM and `scrollTop` is still 400 |
| REV-21 | `DiffView` with three changes | F7 three times, then Shift+F7 | focus moves to change 1, 2, 3, then 2 |
| REV-23 | `DiffView` with `onLineAction` | C on a focused added line | `onLineAction` gets that row; Ctrl+C does nothing |
| FILE-73 | `CodeView` with the cursor on line 40 | `value` changes | the cursor is on line 40 and the scroll is unchanged |
| FILE-72 | `CodeView` with `onSave` | Ctrl+S inside the editor | `onSave` runs once and the browser save does not |

`tests/files/viewer.ui.test.tsx`: FILE-70 (a `.md` file opens in preview when `markdownPreviewFirst`, Ctrl+Shift+V shows the source), FILE-74 (Compare shows a diff of disk against the buffer, nothing is saved), FILE-79 (a link `../b.md` from `C:\p\docs\a.md` opens `C:\p\b.md`; an https link calls `shell.openExternal`), a double Ctrl+S sends one `files.save`.

`tests/history/timeline.ui.test.tsx`: HIST-41 (with Compare on, the diff's left side is the selected snapshot's text and the right side is the current file).

## Lead fixes after the lane B merge: feedback paste

Code: `src/modules/ui-kit/components/terminal-paste.ts`, `src/modules/terminal/panel/TerminalPanel.tsx` (the registering effect), `src/modules/review/panel/FeedbackTray.tsx` (`send`).

| Rule | Given | When | Then |
| --- | --- | --- | --- |
| P-6 | `sanitizePaste` | text `a\x1b[201~\rb\tc\n` | returns `a[201~\rb\tc\n` without the escape |
| REV-33 | a terminal panel whose xterm has bracketed paste on, and a comment holding `\x1b[201~rm -rf x\r` | "Send to Claude" | xterm's `paste` got the text without `\x1b`; `terminal.write` was not called by the tray; no carriage return outside the markers |
| REV-33b | bracketed paste off, composed text with two lines | "Send to Claude" | nothing is pasted; an error toast suggests Copy |
| REV-33c | no panel for the chosen terminal | "Send to Claude" | a toast says to open the terminal; nothing is written |

# Untested: card 032 fixes

Test file for all rows: `tests/sessions/sessions-fixes.ui.test.tsx`. Each name starts with its rule id.

| Rule | Kind | Given | When | Then |
|---|---|---|---|---|
| SESS-71 | component | Session History with rows, focus in the search field | Ctrl+A | the field's text is selected by the browser; no row is selected |
| SESS-72 | component | Session History with three rows | Ctrl+A with a row focused | all three rows are selected |
| SESS-73 | component | a row whose "more" button is focused | Enter, F2 or Delete | the row's handlers do not run; the menu opens on Enter |
| SESS-72 | component | three rows, the first focused | ArrowDown, then ArrowUp | focus moves to the second row, then back to the first |
| SESS-31, SESS-32 | component | the picker with a resumable row | Resume succeeds | the toast "Resumed ..." is in the document after the dialog is gone, and stays for the toast time |
| SESS-32 | component | a stub bus whose `terminal.create` returns id T1 | Resume in new terminal | `openPanel('terminal.shell', { terminalId: T1, cwd, worktree: null, launch: null, fontSizeDelta: 0 })` is called, then the success toast |
| SESS-32 | component | no project open | Resume in new terminal | an error toast "Open a project first, then resume the session." and no `terminal.create` call |
| SESS-32 | component | `terminal.create` fails | Resume | an error toast with the message and no panel is opened |
| SESS-71 | component | the open project has no sessions, other folders have | the history opens | the project select reads "All projects" and all groups show |
| SESS-71 | component | a project filter chosen | `workspace.projectChanged` fires | the filter is back at its default |
| SESS-72 | component | sessions of two folders with mixed activity times | All projects chosen | groups are ordered by their newest row; rows inside each group newest first |
| SESS-50 | component | an open reader with 200 items, total 200 | the next poll reports total 650 | all items 200 to 649 are shown, with no gap |
| SESS-50 | component | an open reader scrolled to the top | "Show earlier" | the first previously visible item stays at the same screen position |
| SESS-32, SESS-43 | component | a reader whose session has no live terminal | `sessions.recordChanged` makes the list report a live terminal | the Resume button is gone; when the terminal exits it returns |
| SESS-76 | component | a selection of only running sessions | Delete | the dialog "Nothing to move" lists them and has a Close button; no "Move 0" title and no `trash` call |
| SESS-76 | component | a selection of one idle and one running session | Delete | the title reads "Move 1 session to the Recycle Bin?" and the running one is listed |
| SESS-32 | unit | cwd `C:\dir $x\`y` | copy resume command | the clipboard text is `cd "C:\dir `$x\``y"; claude --resume <id>` |
| SESS-32 | component | `shell.writeClipboard` fails | Copy resume command | an error toast with the message |

# 034 Notes page and browser panel: test plan (untested)

Code: `src/modules/graph/panel/` (GraphView, GraphCards, NotesList, LocalGraph, graph-model, graph-store, graph-canvas, graph-colour), `src/modules/graph/register.ui.ts`, `src/modules/browser/panel/` (BrowserTab, address), `src/modules/browser/register.ui.ts`. Feature F-069.

The card names the `component` rows of `graph.md` and `browser.md` for these panels. `browser.md` has no component row for the panel; the nearest rows are the unit row BROW-4 (address parsing, implemented in `address.ts`) and the e2e rows, which need the main process and are not listed here.

Suggested files and rows (the testing agent may group them differently):

`tests/graph/graph-view.test.tsx` (component, fake bus with graph fixtures; WebGL is absent in jsdom, so the test mocks `sigma` or runs in the e2e level where noted):

| Rule | Given | When | Then |
| --- | --- | --- | --- |
| GRAPH-20 | a graph with saved positions in the panel state | the panel mounts | nodes take the saved positions before layout runs (ForceAtlas2 is not run when every node has a saved position) |
| GRAPH-23 | a node with two neighbours | it is hovered | non-neighbour nodes have reduced opacity (the node reducer returns an rgba colour at 0.15 alpha) |
| GRAPH-26 | nodes changed 2 hours and 3 days ago | "Changed in last 24 hours" is switched on | only the first is drawn (`isRecent`, reducer `visibility` hidden for the other) |
| GRAPH-29 | 6 000 nodes | the view renders | only hovered and matched labels show. NOT BUILT: the view labels the 30 largest nodes and every label from 1.8x zoom; the 5 000-node rule is not implemented. Expect this row to fail until added. |
| GRAPH-30 | a note `a.md` selected, linked from `b.md` on line 4 | the local graph renders | it lists `b` with that line's text (`graph.backlinks` fixture) |
| GRAPH-50 | the graph view at 1x | wheel up 20 notches at a node, then a double-click on empty space | zoom stops at 5x (sigma `minCameraRatio` 0.2) and the double-click resets the camera. The wheel-at-pointer part depends on sigma's captor; the test may check only the limits. |
| GRAPH-51 | fake clock; the pointer sweeps at 300 px/s, then at 900 px/s past a node | each sweep | the node moves only on the second sweep and is back within 2 000 ms; with `CLAUDE.md` in the graph it never moves (the pinned node is skipped by the drift loop) |
| GRAPH-52 | fake backdrop; 3 nodes, one the open note | one source tick | 3 sources; the open note's strength is 3 times the others'. NOT BUILT: no steam source is registered for graph nodes (ui-kit exports only `useBackdropSource`, which needs an element). Expect a failure until a canvas source API exists. |
| GRAPH-42 | start files of 120 and 90 lines and a memory index of 260 lines | the agent view turns on | the summary says `Loaded at every start: 3 files, 410 lines` (memory counted at 200) and the memory badge shows |

`tests/graph/agent-view.test.tsx` (component):

| Rule | Given | When | Then |
| --- | --- | --- | --- |
| GRAPH-43 | `CLAUDE.md` → `a` → `b`; an unlinked note `c` | the agent view turns on | `a` is 1 hop, `b` 2 hops, `c` muted; `c`'s card says "No link reaches this note. An agent finds it only by searching."; `b`'s card shows `CLAUDE.md`, `a`, `b` (`agentReach`, `chainTo`) |
| GRAPH-43 | the same graph | "Only not reached" is switched on | only `c` is drawn (reached nodes get `visibility` hidden) |
| GRAPH-44 | a node | it is hovered for 400 ms | the card shows the preview (`graph.preview`, 12 lines, "…" when cut); focus has not moved; Escape closes it. NOTE: the preview is plain text, not MarkdownView. |
| GRAPH-42 | a `claudeMd` note of 260 lines | the agent view is on | the badge "Over 200 lines: Claude follows long files less well" shows on its card |

`tests/graph/notes-list.test.tsx` (component):

| Rule | Given | When | Then |
| --- | --- | --- | --- |
| GRAPH-55 | an index with `a.md` (degree 4) and `notes/b.md` | the notes list renders | a tree with `a.md` and a count of 4, and `notes/b.md` under its folder; no `graph.readFile`/disk call was made (the list reads only `useGraphData`) |

`tests/browser/address.test.ts` (unit, BROW-4, `normalizeAddress`):

| Rule | Given | When | Then |
| --- | --- | --- | --- |
| BROW-4 | `example.com`, `localhost:3000`, `how to center a div` | the address is normalised | `https://example.com`, `http://localhost:3000`, `https://duckduckgo.com/?q=how%20to%20center%20a%20div` |

`tests/browser/browser-tab.test.tsx` (component, optional; the spec has no row for it):

| Rule | Given | When | Then |
| --- | --- | --- | --- |
| BROW-2 | a browser panel mounted with a page area of 800 by 600 | the panel mounts and resizes | `browser.setBounds` is sent with the area's rectangle, debounced 16 ms; with width 0 when the page is hidden (`usePageVisible` false) or an overlay is open (BROW-3) |
| BROW-41 | a tab whose `isAgentControlled` is true | the panel renders | the "Claude is using this tab" indicator and the "Stop" button show, and the page area has the 2 px accent frame |
| BROW-1 | a panel with `tabId` null and `url` empty | it mounts | `browser.openTab` is called with the home URL from settings and the tab id is saved in the panel state |

Not in this plan: the demo fixture screenshot (not built, see progress), BROW-3 screenshot overlay, BROW-9 crash state (no channel in the contract), and the e2e rows of `browser.md`.

## Lead fixes after the lane B merge: right click selects its row

| Rule | Given | When | Then |
| --- | --- | --- | --- |
| UI-LIST-1 | a `Tree` with rows a and b, a selected | right click on b | `onSelect` was called with b |
| UI-LIST-2 | a `List` with rows a and b, a selected | right click on b | `onSelect` was called with b |
| FILE-64 | the Files view with a.txt selected | right click on b.txt, then Delete, then confirm | `files.trash` got b.txt |

## 034 look pass (Lead)

| Rule | Given | When | Then |
| --- | --- | --- | --- |
| WS-43 | registered `graph.view`, `graph.notes` | the Notes page renders | the graph renders once as a page layer between the list and the dock; it is not a dock tab |
| GRAPH-51 | a graph with CLAUDE.md | the canvas opens, or Fit is pressed | the camera centre equals CLAUDE.md's display position |
| GRAPH-30 | a note selected in the notes list | the graph renders | that node's colour is `color.accent` and its halo blur is the focus blur |
| UI-BTN-1 | `Button` with `pressed` true | it renders | `aria-pressed="true"` and the primary class |

# Untested: cards 030 and 033 fixes

Test files: `tests/review/changes-fixes.ui.test.tsx`, `tests/activity/activity-fixes.ui.test.tsx`, `tests/files/tree-fixes.ui.test.tsx`, `tests/history/timeline-fixes.ui.test.tsx`, `tests/git/status-fixes.ui.test.tsx`.

| Rule | Kind | Given | When | Then |
|---|---|---|---|---|
| REV-12, P-40 | component | Changes with a focused commit message field | `changesInvalidated` fires | the field keeps focus and text; no skeleton shows |
| REV-10, P-40 | component | a clean repo, 0 files | the view shows | the base select is visible with "No changes since the last commit." |
| REV-10 | component | two sessions, one with a `file-edit` event | the base select opens | only that session is listed |
| REV-10 | component | a session base chosen | `projectChanged` fires | base is "Since last commit", selection and sessions are cleared |
| REV-13 | component | a changed file row | Enter or double click | `openDiff` runs, not `openFile` |
| REV-14 | component | a commit in flight | Commit pressed twice | `git.commit` is called once |
| REV-14 | unit | project `C:\repo\app`, repo root `C:\repo`, file `src/a.ts` | commit | the path sent is `app/src/a.ts` |
| GIT-26 | component | `operation: 'merge'` | `git.sync` runs | no `git.sync` call; a notification says "Merge in progress. Finish it in a terminal, then sync again." |
| GIT-26 | component | `operation: 'merge'`, 0 files | the status item renders | it reads "Merge in progress" |
| GIT-26 | component | `isOffline: true`, 2 files | the status item renders | it reads "2 changed · Offline" |
| git UI | component | 2 files | the status item is pressed | `openPanel('review.changes')` |
| GIT-11 | component | ChangesView, DiffPanel and TrayCount mounted together | the project opens | `git.getStatus` is called once |
| ACT-12, P-40 | component | Activity, filter "You" returns 0 entries | the list shows | both filters stay visible with "No change matches these filters." |
| ACT-12 | component | a session chosen, then the cause changed | the list reloads | the session option is still in the select and still chosen |
| ACT-15, P-40 | component | Activity with scroll position set | `entryAdded` and a refresh | no skeleton; scroll position kept |
| ACT-16 | component | page 1 ends with two entries at time T | scroll to the end | page 2 is asked from T+1; the second entry at T shows once |
| ACT-16 | component | a page that adds only known ids | scroll to the end | no more requests |
| ACT-33 | component | the Artifacts search | typing "a", "ab", "abc" within 300 ms | one `listArtifacts` call with "abc" |
| ACT-31 | component | `shell.openPath` fails | a PDF tile is opened | an error toast with the message |
| ACT-30 | component | Artifacts with tiles | `projectChanged` fires | search is empty and old tiles are gone |
| REV-32 | component | a comment in edit mode | the text has two lines and Ctrl+Enter | `updateComment` is called with both lines |
| REV-34 | component | "Sent. Clear comments?" showing | a comment is added | the Send and Copy buttons are back |
| FILE-61 | component | `src` expanded then collapsed | a change in `src/y.ts`, then `src` expanded | the new entry is listed |
| FILE-60, P-40 | component | root listed | `files.changed` in the root | no skeleton; the tree keeps scroll and open menu |
| FILE-60 | component | a listing in flight | the project changes | the late result is not shown |
| HIST-43, P-40 | component | a history timeline with a version selected | `snapshotAdded` | no skeleton; selection and diff scroll kept |
| HIST-42 | component | a restore that succeeds | the toast shows | it has an "Undo" action; pressing it calls `history.restore` with the row under the new restore row |
| ACT/REV commands | unit | the modules registered | the command list is read | `review.showChanges` (Ctrl+Shift+G), `activity.showTimeline`, `activity.showArtifacts` exist and open their side views |
