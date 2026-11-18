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
