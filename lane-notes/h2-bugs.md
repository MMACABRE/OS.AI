# Lane H2: e2e bugs (src not fixed by this lane)

Each entry: rule id, src location, the failing test (fixme in the e2e file), and the failure message seen.

## DASH-13: ribbon click does not put focus in the session's terminal
- Src: `src/modules/hud/panel/widgets/hud-widgets.tsx` (`focusTarget`, calls `focusTerminal`), `src/modules/hud/panel/send-command.ts` (`focusTerminal`).
- Test: `tests/e2e/demo-dashboard.e2e.ts`, `test.fixme('DASH-13: ...')`. Expect poll `document.activeElement?.closest('[data-hsos-terminal]') !== null`.
- Failure: `Expected: true, Received: false` (Timeout 3000ms exceeded while waiting on the predicate).
- Observed: after the click the Code section is shown, but `document.activeElement` is the ribbon's own DIV (`aria-label="Session ribbon"`). Likely `focusTerminal` runs before the page switch makes the terminal focusable.

## UI-32: background worker keeps drawing while the window is minimised
- Src: `src/modules/ui-kit/backdrop/backdrop-client.ts` (visibility from `document.hidden` only, `onVisibility`).
- Test: `tests/e2e/background.e2e.ts`, `test.fixme('UI-32: a minimised window ...')`.
- Failure: `Expected: 54, Received: 114` (frames grew by 60 in 2 s while minimised).
- Observed: after `BrowserWindow.minimize()`, `document.hidden === false` and `visibilityState === 'visible'`, so the worker never gets `visibility: hidden`.

## UI-32 / MOT-12: reduced motion does not stop the background after one frame
- Src: `src/modules/ui-kit/backdrop/backdrop-client.ts` (`refreshSettings` runs on `data-motion` mutations, reads `reduced`), worker side in `src/modules/ui-kit/backdrop/backdrop.worker.ts` (not read this round).
- Test: `tests/e2e/background.e2e.ts`, `test.fixme('UI-32: with reduced motion ...')`.
- Failure: `Expected: <= 2, Received: 16` (16 frames in 500 ms after setting `data-motion="reduced"`).

## DIAG-9: process health cannot identify the services
- Src: `src/main/index.ts` line ~60 (`SERVICES.find((name) => name === metric.serviceName)`).
- Observed (probe, Electron 45): utility processes report `serviceName: "node.mojom.NodeService"`; the service name is in `metric.name` (`pty-host`, `workspace-service`, `link-service`). So `processMetrics()` never matches a service. The e2e helper uses `name`.
- Not covered by a failing test yet (no e2e row checks health). Lead to decide.

## SHELL-6 (window placement): size drifts at 120 % display scale
- Src: `src/main/window/main-window.ts` (`toRect(window.getNormalBounds())` saved, `new BrowserWindow({...placement.bounds})`).
- Test: `tests/e2e/window.e2e.ts`, F-005. Position is exact; size is allowed a 10 px drift. Without that allowance the test failed with `Expected: 1100, Received: 1107`.
- Observed: `setBounds` of 1100x720 read back 1102x721 at scale 1.2; after restart 1107x726. Grows each restart. Position restore is correct.

## F-007 / settings: Themes list is read once on open
- Src: `src/modules/settings/panel/ThemesSection.tsx` (lists on mount; subscribes only to `activeThemeChanged`).
- Observed: a theme file added while the settings screen is open does not appear until the screen is reopened. The test waits 1.5 s, then opens the screen (SET-8 re-reads the folder within one second). Spec silent on live list refresh; owner to decide.

## F-007 / settings: inactive theme name has zero width in its row
- Src: `src/modules/settings/panel/SettingsScreen.module.css` / `ThemesSection.tsx` row grid (class `_label_`).
- Observed: `getByText('test-light')` is attached but `boundingBox().width === 0`, so the name is invisible; only the swatch-less row buttons show. Active theme (Phosphor) shows its name.
- Test uses `toBeAttached` for this row, with a comment pointing here.

## F-009 / SET (zAbsPath): a relative path is accepted for an absolute-path setting
- Src: `spec/contracts/schemas.ts` line 26 (`zAbsPath = z.string().min(3).max(32_000)`), used by `AppearanceSettings.vaultPath`.
- Observed: `vaultPath` set to `relative/vault` passes validation and is saved. Test uses `ab` (fails the length check) instead.
- Contract is shared, so this is a spec/contract decision, not a src edit.

## Observations (not failing tests)
- Fresh profile, non-demo launch with `HSOS_E2E=1`: the HUD shows "Something stopped / Claude Code link is off ... It is restarting" in the Sessions and Usage areas. No crash file is written and `%LOCALAPPDATA%\HSOS` is never created in that run. Cause not found this round; no page errors in the console.
- Fresh non-demo profile: no `%LOCALAPPDATA%\HSOS\logs` folder was created during a 6 s run. DIAG-8 log check could not be run because of the DIAG-8 harness gap below.

## Harness gap: DIAG-8 (not a src bug)
- `tests/e2e/supervisor.e2e.ts`, `test.fixme('DIAG-8: ...')`. Playwright sets `NODE_OPTIONS` for its own loader, so the `tests/e2e/support/throw-once.cjs` hook never loads in the app's processes (verified: marker never written). The app has no other way to make a service throw. Needs a trigger from the owner or spec author.
