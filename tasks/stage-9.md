# Stage 9: Dashboard and pages, wired

At the end of this stage the Dashboard, the pages and the session ribbon built in Stage U run on real data and are saved.

---

## 116 Dashboard file and saved pages

**Goal.** The dashboard layout and the active page survive a restart.

**Stage.** 9

**Read first.** `spec/modules/dashboard.md` "The file", `spec/contracts/channels/dashboard.ts`, `spec/modules/workspace.md` WS-43, WS-44.

**Files.** `src/modules/dashboard/service/dashboard-store.ts`, `src/modules/dashboard/register.service.ts`, `src/main/module-list.ts`, `src/modules/dashboard/panel/use-dashboard-file.ts`, `src/modules/workspace/panel/save-workspace.ts`, `src/demo/fixtures/dashboard.ts`.

**Steps.**
1. `dashboard-store.ts`: DASH-20 and DASH-21, writing with `write-file-atomic` and keeping a `.bak` as `settings` does, and the `load` and `save` handlers in `main`.
2. `use-dashboard-file.ts`: load at start, save 500 ms after a change, DASH-23 on a grid change.
3. Save `activePage` and `notesDock` with the workspace (WS-43, WS-44).

**Tests.** `tests/dashboard/dashboard-store.test.ts`: DASH-20, DASH-21 rows. `tests/workspace/pages-saved.e2e.ts`: WS-44.

**Done when.** Tests pass.

**Commit.** `feat(dashboard): save the dashboard and the active page`

---

## 117 Repo link and the ribbon on real sessions

**Goal.** The ribbon shows each real session's model, effort, folder, repo and subagents.

**Stage.** 9

**Read first.** `spec/modules/git.md` GIT-4, GIT-14, `spec/modules/hud.md` "Session ribbon", `spec/contracts/channels/git.ts`.

**Files.** `src/modules/git/service/remote-url.ts`, `src/modules/git/service/git-status.ts`, `src/modules/git/service/assert-safe.ts`, `src/modules/hud/panel/ribbon/use-ribbon-data.ts`.

**Steps.**
1. `remote-url.ts`: GIT-14 as a pure function from the raw URL to `remoteUrl` and `webUrl`, and the read at project open and after each fetch. Allow `remote get-url origin` in `assert-safe.ts` (GIT-4).
2. `use-ribbon-data.ts`: the ribbon's values from `link.sessionChanged`, `git.statusChanged` and the session record's title, replacing the demo source.

**Tests.** `tests/git/remote-url.test.ts`: GIT-14 rows. `tests/hud/ribbon-data.ui.test.tsx`: HUD-81 rows with the real channel shapes.

**Done when.** Tests pass. Feature `F-071` passes.

**Commit.** `feat(git): read the repo link for the session ribbon`

---

## 118 Stage 9 checks

**Goal.** The look runs on the real app within its budgets.

**Stage.** 9

**Read first.** `spec/02-architecture.md` §10, `spec/design/motion.md` "Tests", `spec/modules/ui-kit.md` UI-32.

**Files.** `tests/e2e/stage-9.e2e.ts`, `tests/e2e/helpers/measure.ts`.

**Steps.** On the packaged app with `FakeClaude`: two sessions with subagents; check each terminal's ribbon; move a widget, restart, and check it stayed; switch pages 20 times while a terminal prints, and check no output was lost and the MOT and background rows of §10 hold (MOT-6, MOT-11, UI-32).

**Tests.** That file.

**Done when.** Tests pass. Feature `F-072` passes. `npm run dist` produces an installer.

**Commit.** `test: prove stage 9 end to end`
