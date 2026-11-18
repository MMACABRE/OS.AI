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
