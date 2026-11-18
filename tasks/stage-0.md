# Stage 0: Skeleton

At the end of this stage HSOS opens a themed, empty window with a command palette and a settings screen, survives a renderer crash, and packages to an exe. Every risky third-party API has been proven.

---

## 001 Project skeleton

**Goal.** A project that installs, type checks, lints, tests, builds and opens an empty window, with the guard hook in place.

**Stage.** 0

**Read first.** `spec/03-stack.md` (all), `spec/04-implementer-protocol.md` (all), `spec/02-architecture.md` §4.

**Files.**
- `package.json`: exact versions from `03-stack.md`; scripts `dev`, `typecheck`, `lint`, `deps`, `test`, `e2e`, `check`, `build`, `dist`; `"main": "out/main/index.js"`; `postinstall` running `electron-builder install-app-deps`
- `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json`: compiler options from `03-stack.md`; path alias `@hsos/contracts/*` to `spec/contracts/*` and `@hsos/ui-kit` to `src/modules/ui-kit/index.ts`
- `electron.vite.config.ts`: builds `src/main/index.ts`, `src/preload/index.ts`, `src/ui/index.html`, and the three service entries `src/services/<name>/index.ts` as extra main-process inputs; same aliases
- `eslint.config.js`: TypeScript rules, `eslint-plugin-boundaries` set up with the rules in `03-stack.md` "Boundaries"
- `.dependency-cruiser.cjs`: forbids cycles and the imports `03-stack.md` forbids
- `.prettierrc.json`: `{ "singleQuote": true, "printWidth": 110, "trailingComma": "all" }`
- `vitest.config.ts`: tests in `tests/**/*.test.ts(x)`, environment `node`, jsdom for files ending `.ui.test.tsx`, retries 0
- `playwright.config.ts`: tests in `tests/e2e`, retries 0, one worker
- `.gitignore`: `node_modules/`, `out/`, `dist/`, `*.log`, `.env*`
- `scripts/guard.mjs`: copy `spec/reference/guard.mjs`
- `scripts/init.ps1`: copy `spec/reference/init.ps1`
- `scripts/hooks/pre-commit`: two lines, `#!/bin/sh` and `node scripts/guard.mjs`
- `src/main/index.ts`: creates one 1280 by 800 window loading the renderer
- `src/preload/index.ts`: empty `contextBridge.exposeInMainWorld('hsos', {})`
- `src/ui/index.html`, `src/ui/index.tsx`: renders the text `HSOS`
- `src/services/pty-host/index.ts`, `src/services/workspace-service/index.ts`, `src/services/link-service/index.ts`: empty entries that log their name
- `tests/smoke/smoke.test.ts`: imports `ok` from `@hsos/contracts/result` and checks `ok(1).ok === true`
- `PROGRESS.md`: the line `# Progress`

**Steps.**
1. Create the files above.
2. Run `npm install`, then commit `package-lock.json` with the rest.
3. `npm run check` passes. `npm run dev` opens a window showing `HSOS`.
4. Run `git config core.hooksPath scripts/hooks`.

**Tests.** `tests/smoke/smoke.test.ts`.

**Done when.** `pwsh scripts/init.ps1` exits 0. `npm run build` succeeds. Feature `F-001` passes.

**Commit.** `chore: create project skeleton`

---

## 002 Spike: node-pty in a utility process

**Goal.** Prove that a shell runs through `node-pty` inside an Electron utility process.

**Stage.** 0

**Read first.** `spec/03-stack.md` "Third-party APIs", `spec/contracts/channels/terminal.ts` (`PtyProcess`, `PtyFactory`).

**Files.** `src/modules/terminal/service/node-pty-factory.ts`, `src/services/pty-host/index.ts`, `src/main/index.ts`.

**Steps.**
1. Implement `PtyFactory` with `node-pty`'s `spawn`, wrapping its result as `PtyProcess`.
2. In the `pty-host` entry, on start, spawn `pwsh.exe` (or `powershell.exe`), write `echo spike-ok\r`, log every output chunk, and exit after 3 seconds.
3. In `main`, start `pty-host` with `utilityProcess.fork` after `app` is ready.

**Tests.** `tests/terminal/node-pty-factory.test.ts`: in plain Node, spawn the shell, write `echo spike-ok\r`, wait for output containing `spike-ok`, resize to 100 by 30 without error, kill, and see the exit event.

**Done when.** The test passes and `npm run dev` logs `spike-ok` from `pty-host`. If `node-pty` fails to load in the utility process, stop and write a `blocked` entry naming the error. The fallback, for the spec author to choose, is running `pty-host` as a `child_process.fork` of Electron's Node.

**Commit.** `test(terminal): prove node-pty in a utility process`

---

## 003 Spike: SQLite in a utility process

**Goal.** Prove `better-sqlite3` works after the Electron rebuild, inside a utility process.

**Stage.** 0

**Read first.** `spec/03-stack.md` "Third-party APIs".

**Files.** `src/services/workspace-service/index.ts`.

**Steps.** On start, open a database in `os.tmpdir()`, create a table, insert a row, read it back, log the row, close and delete the file.

**Tests.** `tests/history/sqlite-spike.test.ts`: the same in plain Node.

**Done when.** The test passes and `npm run dev` logs the row. On failure write a `blocked` entry with the error.

**Commit.** `test(history): prove SQLite in a utility process`

---

## 004 Spike: file watcher on Windows

**Goal.** Prove `@parcel/watcher` reports create, change, rename and delete in nested folders.

**Stage.** 0

**Read first.** `spec/contracts/channels/files.ts` (`FileWatcher`).

**Files.** `src/modules/files/service/parcel-file-watcher.ts`.

**Steps.** Implement `FileWatcher` with `@parcel/watcher`'s `subscribe`, mapping its `create`, `update`, `delete` to `created`, `changed`, `deleted`, passing `exclude` as its `ignore` option.

**Tests.** `tests/files/parcel-file-watcher.test.ts`: in a temp folder, create `a/b/c.txt`, change it, rename it to `d.txt`, delete it; within 2 seconds of each action the matching events arrive. Paths under an excluded `node_modules` produce no events.

**Done when.** The test passes.

**Commit.** `test(files): prove the file watcher on Windows`

---

## 005 Spike: message ports to a utility process

**Goal.** Prove a renderer and a utility process can exchange large binary messages through `MessageChannelMain`.

**Stage.** 0

**Read first.** `spec/02-architecture.md` §2.2.

**Files.** `src/main/index.ts`, `src/preload/index.ts`, `src/services/pty-host/index.ts`, `src/ui/index.tsx`.

**Steps.**
1. `main` creates a `MessageChannelMain`, posts `port1` to `pty-host` and `port2` to the renderer through the preload (`ipcRenderer.on` with ports, then `window.postMessage` to the page).
2. `pty-host` sends 1 000 messages of 10 000 bytes each, numbered, as `Uint8Array`.
3. The renderer checks order and total size and shows `ports-ok 10000000`.

**Tests.** `tests/e2e/ports-spike.e2e.ts`: launch the app; the page shows `ports-ok 10000000` within 10 seconds.

**Done when.** The test passes.

**Commit.** `test(shell): prove message ports between renderer and service`

---

## 006 Spike: page view and DevTools Protocol

**Goal.** Prove a `WebContentsView` can load a page in an isolated session and return a screenshot through `webContents.debugger`.

**Stage.** 0

**Read first.** `spec/modules/browser.md` "How a tab is built".

**Files.** `src/main/index.ts`.

**Steps.** After the window loads, add a `WebContentsView` with session `persist:hsos-browser-spike`, load `about:blank` with an HTML data page containing `<h1>spike</h1>`, attach the debugger with `1.3`, call `Page.captureScreenshot`, and log the length of the returned data. Remove the view.

**Tests.** `tests/e2e/browser-spike.e2e.ts`: launch; the main process log contains a screenshot length above 1 000.

**Done when.** The test passes. Remove the spike code from `src/main/index.ts` in the same commit after the test has passed once, and keep the test skipped with `test.skip` and a comment naming this card. On failure write a `blocked` entry with the API names that did not exist.

**Commit.** `test(browser): prove page view and DevTools Protocol`

---

## 007 Spike: dock layout round trip

**Goal.** Prove `dockview` can serialise a layout to JSON and restore it.

**Stage.** 0

**Read first.** `spec/modules/workspace.md` "Save and restore".

**Files.** `tests/workspace/dockview-spike.ui.test.tsx` only.

**Steps.** In jsdom, create a dockview with two groups and three panels, call `toJSON`, create a new dockview, call `fromJSON` with the result, and compare the panel ids and their groups.

**Tests.** That file.

**Done when.** The test passes.

**Commit.** `test(workspace): prove dock layout round trip`

---

## 008 Contract helpers

**Goal.** Tests that pin the behaviour of the helper functions in the contracts.

**Stage.** 0

**Read first.** `spec/contracts/result.ts`, `spec/contracts/ids.ts`, `spec/contracts/theme.ts`.

**Files.** `tests/contracts/helpers.test.ts` only.

**Steps.** Test `ok`, `err` (with and without details), `newId` (length 12, alphabet, deterministic with an injected random), `toAbsPath` (`c:/a/b/` becomes `C:\a\b`; `C:\` stays), `toRelPath` (`\a\b` becomes `a/b`), `tokenToCssVariable` (`color.bg.app` becomes `--color-bg-app`).

**Tests.** That file.

**Done when.** The tests pass.

**Commit.** `test(contracts): pin helper behaviour`

---

## 009 Bus core

**Goal.** The `Bus` implementation that every process uses, tested in one process.

**Stage.** 0

**Read first.** `spec/02-architecture.md` §2 and §3, `spec/contracts/bus.ts`, `spec/modules/shell.md` SHELL-16 to SHELL-19.

**Files.** `src/modules/shell/bus/create-bus.ts`, `src/modules/shell/bus/transport.ts`, `tests/fakes/fake-bus.ts`, `tests/fakes/fake-clock.ts`.

**Steps.**
1. `transport.ts`: a type `Transport` with `send(envelope)` and `onMessage(listener)`, and `createLoopbackTransport()` for tests.
2. `createBus({ process, transport, clock, log })` returns a `Bus`. It routes by `channel.owner`: calls to a channel owned by `process` run the handler directly (SHELL-17).
3. Implement BUS-1 to BUS-7 and SHELL-18, SHELL-19.
4. `FakeClock` implements `Clock` with `advance(ms)`. `FakeBus` is `createBus` over a loopback transport with handlers registrable for any owner.

**Tests.** `tests/shell/bus.test.ts`: the BUS and SHELL-16 to SHELL-19 rows of `shell.md`.

**Done when.** Tests pass. Feature `F-002` passes.

**Commit.** `feat(shell): add the typed message bus`

---

## 010 Bus between processes

**Goal.** Requests and events flow between the renderer, `main` and the three services, with ports recreated after a restart.

**Stage.** 0

**Read first.** `spec/02-architecture.md` §2.2, `spec/modules/shell.md` "Preload API", SHELL-11.

**Files.** `src/main/bus/broker.ts`, `src/modules/shell/bus/port-transport.ts`, `src/preload/index.ts`, `src/ui/bus.ts`, `src/services/shared/service-main.ts`.

**Steps.**
1. `port-transport.ts`: a `Transport` over a `MessagePort` or `MessagePortMain`.
2. `broker.ts`: owns one channel per service and forwards service-to-service messages by channel owner.
3. `preload`: exposes exactly the API in `shell.md` (SEC-3).
4. `src/ui/bus.ts`: builds the renderer bus, routing each owner to its port, and swapping a port on `shell.servicePort`.
5. `service-main.ts`: shared start code for a service entry: builds the bus on the parent port, sends `{ type: 'ready' }` when told its modules are registered, handles `{ type: 'stop' }`.

**Tests.** `tests/e2e/bus.e2e.ts`: a test-only channel `shell.ping` owned by each service answers `pong`; the renderer calls all three and gets three answers.

**Done when.** The test passes. Feature `F-003` passes.

**Commit.** `feat(shell): connect the bus across processes`

---

## 011 Supervisor

**Goal.** Services are started, watched and restarted by `main` as `shell.md` says.

**Stage.** 0

**Read first.** `spec/modules/shell.md` SHELL-2 to SHELL-15, `spec/02-architecture.md` §6 to §8, `spec/contracts/channels/shell.ts`.

**Files.** `src/main/supervisor/supervisor.ts`, `src/main/supervisor/service-process.ts`, `src/main/index.ts`.

**Steps.**
1. `ServiceProcess` wraps one utility process behind an interface `ProcessLauncher` so tests can use a fake.
2. `Supervisor` implements SHELL-3, SHELL-4, SHELL-7, SHELL-10 to SHELL-13, the `getServiceStatus`, `restartService` and `serviceStatusChanged` channels.
3. Renderer handling in `main`: SHELL-14, SHELL-15.

**Tests.** `tests/shell/supervisor.test.ts` (fake launcher, fake clock): SHELL-4, SHELL-12, SHELL-13. `tests/e2e/supervisor.e2e.ts`: SHELL-10, SHELL-14.

**Done when.** Tests pass. Feature `F-004` passes.

**Commit.** `feat(shell): supervise and restart services`

---

## 012 Logging

**Goal.** Every process logs to its own file with secrets removed.

**Stage.** 0

**Read first.** `spec/modules/diagnostics.md` DIAG-1 to DIAG-6, `spec/contracts/channels/diagnostics.ts`, `Logger` in `spec/contracts/module.ts`.

**Files.** `src/modules/diagnostics/service/file-logger.ts`, `src/modules/diagnostics/service/redact.ts`, `src/modules/diagnostics/panel/bus-logger.ts`, `src/modules/diagnostics/register.service.ts`.

**Steps.** Implement DIAG-1 to DIAG-6 and the `diagnostics.write` and `getRecent` handlers.

**Tests.** `tests/diagnostics/logging.test.ts`: rows DIAG-1 to DIAG-6.

**Done when.** Tests pass.

**Commit.** `feat(diagnostics): add process logs`

---

## 013 Crash reports and health

**Goal.** A crash leaves a report, and process health is visible.

**Stage.** 0

**Read first.** `spec/modules/diagnostics.md` DIAG-7 to DIAG-10, "UI".

**Files.** `src/modules/diagnostics/service/crash-reports.ts`, `src/modules/diagnostics/service/health.ts`, `src/modules/diagnostics/register.service.ts`, `src/services/shared/service-main.ts`.

**Steps.** Implement DIAG-7 to DIAG-10. `service-main.ts` installs the handlers of DIAG-8. The supervisor (card 011) calls the crash report on each death.

**Tests.** `tests/diagnostics/crash-reports.test.ts`: DIAG-7, DIAG-10.

**Done when.** Tests pass.

**Commit.** `feat(diagnostics): write crash reports`

---

## 014 Module loader and contexts

**Goal.** Modules register through `ServiceContext` and `UiContext`, a failing module does not stop the others, and extension points work.

**Stage.** 0

**Read first.** `spec/contracts/module.ts`, `spec/02-architecture.md` §4, SHELL-20.

**Files.** `src/modules/shell/loader/load-modules.ts`, `src/modules/shell/loader/service-context.ts`, `src/modules/shell/loader/ui-context.ts`, `src/main/module-list.ts`, `src/services/workspace-service/module-list.ts`, `src/ui/module-list.ts`.

**Steps.**
1. Build `ServiceContext` and `UiContext`. `registerSettings` is a stub returning defaults until card 016. `registerPanel` stores definitions in a registry the workspace reads later.
2. `contribute` and `contributions` store per point id.
3. `loadModules(list, makeContext, log)` implements SHELL-20.
4. Create the module-list files with `diagnostics` only. Lists in `pty-host` and `link-service` are created by later cards.

**Tests.** `tests/shell/loader.test.ts`: SHELL-20; extension point: two contributions are returned in order.

**Done when.** Tests pass.

**Commit.** `feat(shell): load modules with contexts`

---

## 015 Window

**Goal.** A frameless, single-instance window that remembers its place and refuses navigation.

**Stage.** 0

**Read first.** `spec/modules/shell.md` SHELL-1, SHELL-5, SHELL-6, SHELL-21 to SHELL-27, `spec/02-architecture.md` §9, `spec/design/layout.md` "Anatomy".

**Files.** `src/main/window/main-window.ts`, `src/main/window/bounds.ts`, `src/main/system/system-channels.ts`, `src/main/index.ts`.

**Steps.**
1. `bounds.ts`: pure function for SHELL-6.
2. `main-window.ts`: creates the window (frameless, title bar overlay for native buttons, background from the theme once card 018 exists, `#100F0E` until then), applies SEC-1 and SEC-2, saves bounds.
3. `system-channels.ts`: handlers for `pickFolder`, `trashItem`, `openExternal`, `openPath`, `revealInExplorer`, `notify`, `writeClipboard`, `windowAction`, `windowState`, `getLaunchToken` (SHELL-26).

**Tests.** `tests/shell/bounds.test.ts`: SHELL-6. `tests/shell/system-channels.test.ts`: SHELL-21, SHELL-26, SHELL-27 with fakes for Electron's `shell`. `tests/e2e/window.e2e.ts`: SHELL-1, SHELL-24.

**Done when.** Tests pass. Feature `F-005` passes.

**Commit.** `feat(shell): add the main window and system actions`

---

## 016 Settings files

**Goal.** Settings load, validate and report problems without ever breaking the app.

**Stage.** 0

**Read first.** `spec/modules/settings.md` "Files", SET-1 to SET-7, `spec/contracts/channels/settings.ts`.

**Files.** `src/modules/settings/service/settings-store.ts`, `src/modules/settings/service/atomic-json.ts`, `src/modules/settings/register.service.ts`, `src/modules/shell/loader/service-context.ts`, `src/main/module-list.ts`.

**Steps.**
1. `atomic-json.ts`: read and validate a JSON file with a schema; write atomically with a `.bak` copy (P-3). Other modules reuse it through their own copies of this small function only if their card says so; otherwise they use `write-file-atomic` directly.
2. `settings-store.ts`: SET-1 to SET-7, `getSection`, `setValue`, `getProblems`, events.
3. `registerSettings` in the service context now uses the store.

**Tests.** `tests/settings/settings-store.test.ts`: rows SET-2 to SET-7.

**Done when.** Tests pass.

**Commit.** `feat(settings): load and validate settings`

---

## 017 Settings live reload

**Goal.** Edits to the settings file apply within a second, in every process.

**Stage.** 0

**Read first.** `spec/modules/settings.md` SET-8 to SET-10.

**Files.** `src/modules/settings/service/settings-watcher.ts`, `src/modules/settings/service/remote-settings.ts`, `src/modules/settings/register.service.ts`, `src/services/shared/service-main.ts`.

**Steps.** Watch the three settings locations with `fs.watch` plus a 200 ms quiet period, re-read and apply (SET-8, SET-9). `remote-settings.ts` gives utility processes a `SettingsReader` fed by `getSection` and `sectionChanged` (SET-10).

**Tests.** `tests/settings/live-reload.test.ts`: SET-8, SET-9.

**Done when.** Tests pass. Feature `F-006` passes.

**Commit.** `feat(settings): apply settings changes live`

---

## 018 Themes

**Goal.** The active theme's tokens are CSS variables in the renderer, and switching themes needs no reload.

**Stage.** 0

**Read first.** `spec/modules/settings.md` SET-11 to SET-17, `spec/contracts/theme.ts`, `spec/design/visual-direction.md`.

**Files.** `resources/themes/phosphor.json` (a copy of `spec/design/themes/phosphor.json`), `tests/fixtures/themes/test-light.json`, `src/modules/settings/service/theme-store.ts`, `src/modules/settings/panel/apply-theme.ts`, `src/modules/settings/register.ui.ts`.

**Steps.** Copy the themes. Implement SET-11 to SET-17 and the theme channels. `apply-theme.ts` sets the variables on `:root` and `data-theme-kind`. Bundle VT323 and Jersey 10 (SIL Open Font License, with their licence files) in `resources/fonts/` with `@font-face` rules in `src/ui/fonts.css` (this card may add those two paths). `test-light.json` is a test theme of kind `light` that sets only `color.bg.app` and `color.text.primary`, for the switch test.

**Tests.** `tests/settings/theme-store.test.ts`: SET-11, SET-12, SET-14, SET-16. `tests/settings/apply-theme.ui.test.tsx`: SET-13, SET-15.

**Done when.** Tests pass. Feature `F-007` passes.

**Commit.** `feat(settings): resolve and apply themes`

---

## 019 Key bindings

**Goal.** Effective key bindings with chords and conflict reporting.

**Stage.** 0

**Read first.** `spec/modules/settings.md` SET-18 to SET-20, `spec/modules/ui-kit.md` UI-20 to UI-23.

**Files.** `src/modules/settings/service/keybindings-store.ts`, `src/modules/ui-kit/keys/parse-key.ts`, `src/modules/ui-kit/keys/key-dispatcher.ts`, `src/modules/settings/register.service.ts`.

**Steps.** Store and channels for SET-18 to SET-20. `parse-key.ts` turns a `KeyboardEvent` into the SET-19 format. `key-dispatcher.ts` implements UI-20 to UI-23.

**Tests.** `tests/settings/keybindings.test.ts`: SET-18, SET-20. `tests/ui-kit/key-dispatcher.ui.test.tsx`: UI-21, UI-22, UI-23.

**Done when.** Tests pass.

**Commit.** `feat(settings): resolve key bindings`

---

## 020 Base components

**Goal.** The first `ui-kit` components and the lint rule that keeps raw values out of CSS.

**Stage.** 0

**Read first.** `spec/modules/ui-kit.md` UI-1 to UI-6, "Components", `spec/design/visual-direction.md`.

**Files.** `src/modules/ui-kit/index.ts`, `src/modules/ui-kit/components/` (`Button`, `IconButton`, `TextField`, `NumberField`, `Switch`, `Select`, `Tooltip`, `Kbd`, `Badge`, `StatusDot`, each a `.tsx` and a `.module.css`), `eslint-rules/no-raw-css-values.js`, `eslint.config.js`.

**Steps.** Build each component to the table and the visual direction. Add the lint rule for UI-1 (implemented as a small script run by `npm run lint` over `*.module.css`; this card may add it to `package.json` scripts).

**Tests.** `tests/ui-kit/base-components.ui.test.tsx`: UI-2, UI-3 for each. `tests/ui-kit/no-raw-css.test.ts`: UI-1 with a fixture file.

**Done when.** Tests pass.

**Commit.** `feat(ui-kit): add base components`

---

## 021 Panel frame, lists and trees

**Goal.** Every panel can show its four states, and long lists stay fast.

**Stage.** 0

**Read first.** `spec/modules/ui-kit.md` "Components" (`PanelFrame`, `EmptyState`, `ErrorState`, `Skeleton`, `List`, `Tree`, `Tabs`, `SplitView`, `ProgressBar`), UI-7, `spec/design/visual-direction.md` "Panel states".

**Files.** `src/modules/ui-kit/components/` (those components), `src/modules/ui-kit/index.ts`.

**Steps.** Build them. `List` and `Tree` virtualise above 200 rows with a fixed row height.

**Tests.** `tests/ui-kit/panel-frame.ui.test.tsx`: P-40. `tests/ui-kit/list.ui.test.tsx`: UI-7, keyboard movement, type-ahead. `tests/ui-kit/tree.ui.test.tsx`: expand and collapse with Left and Right.

**Done when.** Tests pass.

**Commit.** `feat(ui-kit): add panel frame, list and tree`

---

## 022 Overlays and icons

**Goal.** Dialogs, menus, toasts and the icon set.

**Stage.** 0

**Read first.** `spec/modules/ui-kit.md` "Components" (`Menu`, `Dialog`, `ConfirmDialog`, `Toast`, `Icon`), "Icons".

**Files.** `src/modules/ui-kit/components/` (those components), `src/modules/ui-kit/icons/` (one file per icon name), `src/modules/ui-kit/index.ts`.

**Steps.** Build them on Radix. Draw each icon as described. Overlays announce themselves through a small `useOverlayOpen` hook in `ui-kit` that later cards use (BROW-3).

**Tests.** `tests/ui-kit/overlays.ui.test.tsx`: Escape closes a dialog and focus returns to the opener; `ConfirmDialog` with `danger` focuses Cancel; at most 3 toasts; SET-15 for a dialog.

**Done when.** Tests pass.

**Commit.** `feat(ui-kit): add dialogs, menus, toasts and icons`

---

## 023 Command palette

**Goal.** Every command is one search away.

**Stage.** 0

**Read first.** `spec/modules/ui-kit.md` UI-10 to UI-14, `spec/design/layout.md` "Command palette".

**Files.** `src/modules/ui-kit/palette/CommandPalette.tsx`, `src/modules/ui-kit/palette/CommandPalette.module.css`, `src/modules/ui-kit/palette/rank-commands.ts`, `src/modules/ui-kit/palette/command-registry.ts`, `src/modules/shell/loader/ui-context.ts`.

**Steps.** Implement UI-10 to UI-14. `registerCommand` adds to the registry. The palette opens on `Ctrl+Shift+P`.

**Tests.** `tests/ui-kit/rank-commands.test.ts`: UI-11. `tests/ui-kit/palette.ui.test.tsx`: UI-13, UI-14.

**Done when.** Tests pass. Feature `F-008` passes.

**Commit.** `feat(ui-kit): add the command palette`

---

## 024 Settings screen

**Goal.** The owner can change every setting, key binding and theme from inside HSOS.

**Stage.** 0

**Read first.** `spec/modules/settings.md` "Settings screen", "States".

**Files.** `src/modules/settings/panel/SettingsScreen.tsx`, `src/modules/settings/panel/SettingsScreen.module.css`, `src/modules/settings/panel/schema-control.tsx`, `src/modules/settings/panel/KeybindingsSection.tsx`, `src/modules/settings/panel/ThemesSection.tsx`, `src/modules/settings/register.ui.ts`.

**Steps.** Build the screen as described. Until card 028 exists, the screen opens as a full-window view from the command `settings.open` (`Ctrl+,`); card 028 turns it into the dock panel `settings.screen`.

**Tests.** `tests/settings/settings-screen.ui.test.tsx`: an invalid number shows the message and nothing is saved; "Reset" appears only for changed values; the problems banner lists problems.

**Done when.** Tests pass. Feature `F-009` passes.

**Commit.** `feat(settings): add the settings screen`

---

## 025 Stage 0 checks

**Goal.** Stage 0 is proven end to end and packages to an exe.

**Stage.** 0

**Read first.** `spec/05-testing.md` REL-7, `spec/01-capability-map.md` "Build stages".

**Files.** `electron-builder.yml`, `resources/icon.ico`, `tests/e2e/stage-0.e2e.ts`.

**Steps.**
1. `electron-builder.yml`: app id `local.hsos.app`, product name `HSOS`, Windows target `nsis` with `oneClick: false`, `perMachine: false`, `allowToChangeInstallationDirectory: true`; `asarUnpack` for `node-pty` and `better-sqlite3`.
2. Icon: a 256 by 256 `.ico` of the letters `HS` in Jersey 10, `#FF003C` on `#0B0A09`, radius 48, drawn at whole pixels.
3. E2E: the app starts with a corrupt `settings.json` (REL-7, P-32), the palette opens, the settings screen opens, a switch to the theme `test-light` (copied into `themesDir` by the test) changes `--color-bg-app` without reload, killing the renderer reloads it.

**Tests.** `tests/e2e/stage-0.e2e.ts`.

**Done when.** Tests pass. `npm run dist` produces an installer in `dist/`. Feature `F-010` passes.

**Commit.** `test: prove stage 0 end to end`
