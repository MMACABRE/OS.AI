# Stage U: The look

The owner reviews how all of HSOS looks and moves before any backend is built (JOURNAL step 37). This stage comes right after stage 0, which gives the window, the bus, the theme engine and the base components the UI is drawn with. It builds the panel side of every module, every page and every widget, running on a demo backend that answers every channel from fixtures. It ends at card 037, where the implementer stops until the owner approves.

Before card 026 starts, the design round must be finished: `spec/design/visual-direction.md`, `spec/design/themes/` and `spec/reference/art/` hold the direction the owner chose (`spec/design/direction-brief.md`). If `spec/reference/art/` does not exist yet, stop with a `blocked` entry saying the design round is not done.

Rules for this stage, on top of `spec/04-implementer-protocol.md`:

- Panels get data only through the bus, as in the finished app. Only the transport differs: in demo mode `src/demo/demo-transport.ts` answers requests and emits events from fixtures.
- Every fixture is parsed with its channel's schema from `@hsos/contracts` when the demo starts. A fixture that fails is a failing test, never a silent default.
- Tests are the `component` rows of each module's test table for the rules a card names, run against the fake bus. Service rules wait for their own cards.
- `npm run demo` must start the window with demo data after every card of this stage.

---

## 026 Demo backend

**Goal.** `npm run demo` opens HSOS with believable data in every channel, without starting any service.

**Stage.** U

**Read first.** `spec/02-architecture.md` §2, `spec/contracts/bus.ts`, `spec/05-testing.md` "Fakes".

**Files.** `src/demo/demo-transport.ts`, `src/demo/fixtures/` (one file per module, named after it, and `terminal-claude.bin`), `src/demo/terminal-replay.ts`, `src/ui/bus.ts`, `src/main/index.ts`, `package.json` (the `demo` script only).

**Steps.**
1. `demo-transport.ts`: a `Transport` (card 009) that answers each request from the fixture of its channel, with a delay of 80 to 400 ms so loading states show, and emits each fixture event on a timer. A request with no fixture answers `INTERNAL` "No demo data", so a missing fixture is visible.
2. Fixtures for every module's channels, written as the owner's world: two projects, four Claude sessions in every activity, two subagents, usage at 58 % and 21 %, 30 skills in all four states, a repo with `webUrl`, changed files, activity, a vault of 40 linked notes, recent sessions across both projects.
3. `terminal-replay.ts`: in demo mode the terminal channels replay `terminal-claude.bin`, a recorded Claude Code session with colour and a long conversation, at its recorded speed, then loop. Keys typed are echoed and go nowhere.
4. With `HSOS_DEMO=1`, `main` starts no service process and `src/ui/bus.ts` uses the demo transport. `npm run demo` sets it.

**Tests.** `tests/demo/fixtures.test.ts`: every fixture parses with its channel's schema; every request channel in `@hsos/contracts` has a fixture. `tests/demo/demo-transport.test.ts`: a request without a fixture answers `INTERNAL`.

**Done when.** Tests pass. `npm run demo` opens the window.

**Commit.** `feat(demo): run the UI on fixture data`

---

## 027 Motion, glass and the background

**Goal.** Every component moves as `motion.md` says, surfaces are glass, and the background runs.

**Stage.** U

**Read first.** `spec/design/motion.md`, `spec/modules/ui-kit.md` UI-6, UI-30 to UI-33, `spec/design/visual-direction.md`, `spec/contracts/theme.ts`.

**Files.** `src/modules/ui-kit/motion/`, `src/modules/ui-kit/backdrop/` (with `scenes/still.ts`, `scenes/phosphor-dust.ts` from `spec/reference/art/background.md`, the CRT overlay and `useBackdropSource`), `src/modules/ui-kit/components/` (`Surface`, `RollingNumber`, and the motion of every existing component), `src/modules/settings/panel/apply-theme.ts`, `eslint-rules/no-layout-animation.js`, `eslint.config.js`.

**Steps.**
1. `motion/`: helpers for MOT-2 to MOT-4 and MOT-8, the stagger of MOT-3, and the reduced form of MOT-12 from `data-motion`.
2. `Surface` (UI-31) and the alpha floor of P-45. `RollingNumber` (MOT-8).
3. `backdrop/`: the worker, the `OffscreenCanvas`, the scene registry, the frame cap and the pause (UI-30, UI-32, UI-33); the `phosphor-dust` scene with its barrel bend and brightness cap, the still CRT overlay (UI-34), pointer and puff forwarding (UI-33) and steam sources (UI-35).
4. Give every existing ui-kit component its motion. `apply-theme.ts` sets `data-motion` (SET-15).
5. The lint rule of MOT-1.

**Tests.** `tests/ui-kit/motion.ui.test.tsx`: MOT-2, MOT-3, MOT-4, MOT-8, MOT-12 rows. `tests/ui-kit/backdrop.ui.test.tsx`: UI-30, UI-33, UI-34, UI-35. `tests/ui-kit/phosphor-dust.test.ts`: the UI-34 unit row. `tests/ui-kit/surface.test.ts`: UI-31. `tests/lint/no-layout-animation.test.ts`: MOT-1.

**Done when.** Tests pass. Feature `F-065` passes.

**Commit.** `feat(ui-kit): add motion, glass surfaces and the background`

---

## 028 App frame and pages

**Goal.** The window has its frame, the three pages, and seamless transitions between them.

**Stage.** U

**Read first.** `spec/design/layout.md`, `spec/modules/workspace.md` "Frame", "Pages", `spec/design/motion.md` MOT-5 to MOT-7, MOT-11.

**Files.** `src/modules/workspace/panel/` (title bar with wordmark, clock and repo button, page switcher, side view tabs, status bar, dock host, the three page hosts, `page-transition.ts`), `src/modules/workspace/register.ui.ts`, `src/ui/App.tsx`, `src/ui/module-list.ts`.

**Steps.**
1. The frame of `layout.md` with its title bar (wordmark, clock, page switcher of WS-40, project switcher, repo button), the side view tabs (WS-30) and the background mounted once (UI-30).
2. Pages that stay mounted (WS-41), focus moving with the page (WS-45), and `usePageVisible()`.
3. `page-transition.ts`: MOT-5, MOT-6 and MOT-11 through `document.startViewTransition`, with a helper that gives an element its shared `view-transition-name` for one transition.
4. The `code` and `notes` docks with `dockview` (card 007), holding the demo panels registered so far.

**Tests.** `tests/workspace/pages.ui.test.tsx`: WS-40, WS-43, WS-45 rows. `tests/e2e/demo-pages.e2e.ts` in demo mode: MOT-5, MOT-7, MOT-11, WS-41 rows.

**Done when.** Tests pass. Feature `F-066` passes.

**Commit.** `feat(workspace): add the app frame, pages and page transitions`

---

## 029 Terminal panel, ribbon and mascot

**Goal.** The Code page's terminals look finished, with the session ribbon and the mascot always in view.

**Stage.** U

**Read first.** `spec/modules/terminal.md` "View", TERM-75, TERM-76, `spec/modules/hud.md` "Session ribbon", "Mascot", `spec/design/motion.md` MOT-10.

**Files.** `src/modules/terminal/panel/` (`TerminalPanel.tsx`, its CSS, `create-xterm.ts`, `xterm-theme.ts`, `header-slot.tsx`), `src/modules/hud/panel/ribbon/`, `src/modules/hud/panel/mascot/`, `resources/art/` (the chosen direction's sprite sheet and frame map), `src/modules/hud/register.ui.ts`, `src/modules/terminal/register.ui.ts`.

**Steps.**
1. The terminal panel drawing the demo replay with the see-through background of TERM-76, and the header slot of TERM-75.
2. The ribbon (HUD-80 to HUD-83) contributed to `terminalHeader`.
3. The mascot (HUD-90 to HUD-93) from the sprite sheet, copied from `spec/reference/art/`, with the placeholder of HUD-91 when the sheet is missing.
4. Check VT323 in xterm: render the demo replay's box-drawing and status characters and confirm each falls back to Cascadia Mono rather than a missing glyph. Record any character that does not in `PROGRESS.md` under `Deviations`.

**Tests.** `tests/terminal/header-slot.ui.test.tsx`: TERM-75, TERM-76. `tests/hud/ribbon.ui.test.tsx`: HUD-80 to HUD-83 rows. `tests/hud/mascot.ui.test.tsx`: HUD-90 to HUD-93 rows.

**Done when.** Tests pass. Feature `F-067` passes.

**Commit.** `feat(hud): add the session ribbon and the mascot`

---

## 030 Files, viewer and history

**Goal.** The Files view, the file viewer and the history timeline look finished.

**Stage.** U

**Read first.** `spec/modules/files.md` "Files view", "Viewer", `spec/modules/history.md` "Timeline for one file", `spec/modules/ui-kit.md` "Components".

**Files.** `src/modules/files/panel/`, `src/modules/history/panel/`, `src/modules/files/register.ui.ts`, `src/modules/history/register.ui.ts`.

**Steps.** Build the panels of those sections on demo data, with their four states and their motion.

**Tests.** The `component` rows of `files.md` and `history.md` for those sections, in `tests/files/*.ui.test.tsx` and `tests/history/*.ui.test.tsx`.

**Done when.** Tests pass.

**Commit.** `feat(files): build the files, viewer and history panels`

---

## 031 HUD

**Goal.** The HUD looks finished: quick bar, sessions, usage, skills deck, repo row and the Claude setup view.

**Stage.** U

**Read first.** `spec/modules/hud.md` "Panel", "Quick bar", "Sessions", "Usage", "Skills deck", "Skills repo", "Claude setup view".

**Files.** `src/modules/hud/panel/` (every section, the quick bar, its dialogs and popovers, the setup view), `src/modules/hud/register.ui.ts`.

**Steps.** Build each section on demo data, each its own error boundary, with the motion of `motion.md`.

**Tests.** The `component` rows of `hud.md` for HUD-1 to HUD-16, HUD-25 to HUD-27, HUD-30 to HUD-41, HUD-50 to HUD-55, HUD-60 to HUD-68.

**Done when.** Tests pass. Feature `F-068` passes.

**Commit.** `feat(hud): build every HUD section`

---

## 032 Sessions

**Goal.** The session picker, Session History and the transcript reader look finished.

**Stage.** U

**Read first.** `spec/modules/sessions.md` SESS-31, SESS-32, SESS-50, SESS-51, SESS-70 to SESS-77.

**Files.** `src/modules/sessions/panel/`, `src/modules/sessions/register.ui.ts`.

**Steps.** Build the picker, the history panel, the reader and the dialogs on demo data.

**Tests.** The `component` rows of `sessions.md` for those rules.

**Done when.** Tests pass.

**Commit.** `feat(sessions): build the picker, history and reader`

---

## 033 Git, changes, feedback and activity

**Goal.** The git controls, the Changes view, diffs, the feedback tray, Activity and Artifacts look finished.

**Stage.** U

**Read first.** `spec/modules/git.md` "UI", `spec/modules/review.md`, `spec/modules/activity.md`.

**Files.** `src/modules/git/panel/`, `src/modules/review/panel/`, `src/modules/activity/panel/`, `src/modules/git/register.ui.ts`, `src/modules/review/register.ui.ts`, `src/modules/activity/register.ui.ts`.

**Steps.** Build the panels and status items on demo data.

**Tests.** The `component` rows of `git.md`, `review.md` and `activity.md`.

**Done when.** Tests pass.

**Commit.** `feat(review): build git, changes, feedback and activity panels`

---

## 034 Notes page and browser panel

**Goal.** The Notes page looks finished, with its graph, viewer and agent view, and the browser panel has its frame.

**Stage.** U

**Read first.** `spec/modules/graph.md` "Graph view", "Local graph and backlinks", "Agent view", `spec/modules/browser.md` "Tabs and the panel", `spec/modules/workspace.md` WS-43.

**Files.** `src/modules/graph/panel/`, `src/modules/browser/panel/`, `src/modules/graph/register.ui.ts`, `src/modules/browser/register.ui.ts`.

**Steps.**
1. The graph view, local graph, backlinks, agent view and hover cards on the demo vault, opening notes in the `notes` dock; the camera, drift, steam and selection of GRAPH-50 to GRAPH-53; the notes list `graph.notes` (GRAPH-55); the Notes page arrangement of `layout.md` (Pages).
2. The browser panel's frame, tabs and agent indicator. In demo mode the page area shows a fixture screenshot, since no page view exists yet.

**Tests.** The `component` rows of `graph.md` and of `browser.md` for its panel.

**Done when.** Tests pass. Feature `F-069` passes.

**Commit.** `feat(graph): build the notes page and the browser frame`

---

## 035 Dashboard

**Goal.** The Dashboard works like a phone home screen: widgets snap, resize and move between screens.

**Stage.** U

**Read first.** `spec/modules/dashboard.md`, `spec/contracts/channels/dashboard.ts`, `spec/design/motion.md`.

**Files.** `src/modules/dashboard/panel/`, `src/modules/dashboard/register.ui.ts`, `src/modules/hud/panel/widgets/`, `src/modules/sessions/panel/widgets/`, `src/modules/git/panel/widgets/`, `src/modules/activity/panel/widgets/`, `src/modules/graph/panel/widgets/`.

**Steps.**
1. Screens, grid and placement (DASH-1 to DASH-4) as pure functions plus the page.
2. Edit mode, moving, resizing, adding, removing, screens and keys (DASH-5 to DASH-11).
3. Every widget of the catalog, each contributed by its own module's `register.ui.ts`, with its sizes and activation (DASH-12, DASH-13). Saving goes to the demo transport until card 116.

**Tests.** `tests/dashboard/placement.test.ts`: DASH-3, DASH-22, DASH-23. `tests/dashboard/dashboard.ui.test.tsx`: DASH-1, DASH-2, DASH-5 to DASH-12 rows. `tests/e2e/demo-dashboard.e2e.ts`: DASH-13.

**Done when.** Tests pass. Feature `F-070` passes.

**Commit.** `feat(dashboard): add the widget dashboard`

---

## 036 Settings, themes and every state

**Goal.** The settings screen and theme editor look finished, and every panel's four states can be seen in one place.

**Stage.** U

**Read first.** `spec/modules/settings.md` "Settings screen", `spec/modules/workspace.md` WS-5, `spec/design/visual-direction.md` "Panel states".

**Files.** `src/modules/settings/panel/`, `src/modules/workspace/panel/WelcomeView.tsx`, `src/demo/gallery.tsx`, `src/modules/settings/register.ui.ts`.

**Steps.**
1. Bring the settings screen to the chosen direction, with the sections of every module so far and the theme editor's look (the editor's saving comes in card 101).
2. The welcome view.
3. `gallery.tsx`: opened by `npm run demo -- --gallery`, it shows every registered panel and widget in its loading, empty, error and ready states side by side.

**Tests.** `tests/demo/gallery.ui.test.tsx`: every registered panel and widget renders all four states without throwing.

**Done when.** Tests pass.

**Commit.** `feat(settings): finish settings, welcome view and the state gallery`

---

## 037 Owner review of the look

**Goal.** The owner sees all of HSOS and approves the look before any backend is built.

**Stage.** U

**Read first.** `spec/04-implementer-protocol.md` "Look first".

**Files.** `electron-builder.yml` (a second target, `HSOS Demo`, that sets `HSOS_DEMO=1`), `tests/e2e/demo-tour.e2e.ts`.

**Steps.**
1. Package `HSOS Demo` with `npm run dist -- --demo`.
2. `demo-tour.e2e.ts` walks every page, opens every panel, enters and leaves dashboard edit mode, and saves a screenshot of each step to `test-results/tour/`.
3. Append a `PROGRESS.md` entry with `Status: waiting-for-owner`, the path of the demo installer and of the screenshots. Stop.

**Tests.** That file.

**Done when.** The owner, or the spec author on the owner's word, appends `## 037 Owner review of the look` with `Status: done` and `Approved: <date>`. Until then no later card starts (protocol "Look first"). Changes the owner asks for become spec changes and new Stage U cards before approval.

**Commit.** `test: package the demo for the owner's review`
