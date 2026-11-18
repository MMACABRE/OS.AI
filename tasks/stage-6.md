# Stage 6: Finish

At the end of this stage HSOS meets the reliability bar in `spec/05-testing.md`, the owner can design their own theme live, and an installer is ready.

---

## 101 Theme editor

**Goal.** The owner edits a theme and sees every change at once.

**Stage.** 6

**Read first.** `spec/modules/settings.md` "Themes" (SET-11 to SET-16), "Settings screen" (the Themes section), `spec/design/visual-direction.md`.

**Files.** `src/modules/settings/panel/ThemeEditor.tsx`, `src/modules/settings/panel/ThemeEditor.module.css`, `src/modules/settings/panel/token-groups.ts`, `src/modules/settings/panel/contrast.ts`, `src/modules/settings/panel/ThemesSection.tsx`.

**Steps.**
1. "Duplicate" on a theme creates `<name> copy` and opens the editor on it. Built-in themes are not editable.
2. The editor lists tokens in groups (Surfaces, Text, Accent and states, Terminal, Graph, Type, Shape, Motion) from `token-groups.ts`. Colour tokens have a colour field and a hex field; others a text field.
3. Every edit applies to the live window within 100 ms, then saves through `saveTheme` 400 ms after the last edit.
4. `contrast.ts` computes WCAG contrast. Each text colour shows its ratio against `color.bg.panel` and a warning icon with the word "Low" below 4.5 (P-43).
5. "Revert" restores the values the editor opened with.

**Tests.** `tests/settings/contrast.test.ts`: `#FFFFFF` on `#000000` is 21; `#777777` on `#FFFFFF` is about 4.48. `tests/settings/theme-editor.ui.test.tsx`: an edit sets the CSS variable before saving; a low-contrast text colour shows "Low"; built-in themes have no edit action.

**Done when.** Tests pass. Feature `F-050` passes.

**Commit.** `feat(settings): add the live theme editor`

---

## 102 Fault tests

**Goal.** Every fault in the reliability bar is tested against the packaged app.

**Stage.** 6

**Read first.** `spec/05-testing.md` "Reliability bar".

**Files.** `tests/e2e/reliability.e2e.ts`, `tests/e2e/helpers/kill-process.ts`, `tests/e2e/helpers/launch-app.ts`.

**Steps.** `launch-app.ts` starts the built app with a temp `%APPDATA%` and `%LOCALAPPDATA%` and returns process ids by service name from `diagnostics.getHealth`. `kill-process.ts` kills a pid with `taskkill /F /PID`. Write REL-1 to REL-10 as tests, reusing earlier test steps where they exist.

**Tests.** That file.

**Done when.** All ten pass three runs in a row. Feature `F-051` passes.

**Commit.** `test: cover the reliability bar`

---

## 103 Property and soak tests

**Goal.** The data-loss invariant holds under random sequences, and the app holds steady for two hours.

**Stage.** 6

**Read first.** `spec/05-testing.md` REL-11, REL-12.

**Files.** `tests/history/history-property.test.ts`, `scripts/soak.mjs`, `package.json`.

**Steps.**
1. Extend the REL-12 property test from card 062 with service kills between steps. Run 500 sequences of up to 40 steps.
2. `soak.mjs` launches the built app, opens 4 terminals running a loop that prints 200 KB every 5 seconds, writes 10 files a second in the project, posts `FakeClaude` events every second, samples `diagnostics.getHealth` every minute for 2 hours, and fails when REL-11 is broken. Add the script `soak` to `package.json`.

**Tests.** Those files. The soak is run by `npm run soak`, not by `npm test`.

**Done when.** The property test passes. One soak run passes and its memory samples are pasted into `PROGRESS.md`. Feature `F-052` passes.

**Commit.** `test: add property and soak tests`

---

## 104 Performance budgets

**Goal.** Every budget in the architecture is measured and recorded.

**Stage.** 6

**Read first.** `spec/02-architecture.md` §10, `spec/05-testing.md`.

**Files.** `tests/e2e/performance.e2e.ts`, `tests/e2e/helpers/measure.ts`.

**Steps.** Measure each row of §10 on the packaged app. Fail the test only when a value is more than 50 percent over budget; record all values in `PROGRESS.md` with the budget beside each.

**Tests.** That file.

**Done when.** The test passes and the table is in `PROGRESS.md`. Feature `F-053` passes.

**Commit.** `test: measure performance budgets`

---

## 105 Installer and first run

**Goal.** An installer the owner can run, and a first launch that explains itself.

**Stage.** 6

**Read first.** `spec/modules/workspace.md` WS-5, `spec/modules/claude-link.md` "What HSOS cannot know".

**Files.** `electron-builder.yml`, `src/modules/workspace/panel/WelcomeView.tsx`, `src/modules/workspace/panel/first-run-checks.ts`, `resources/installer/license.txt`.

**Steps.**
1. The welcome view on first run lists checks, each with a check mark or a fix: Git installed (`git --version`), Claude Code installed (`link.getStatus.claudeFound`), GitHub CLI signed in (`git.getGitHubAccount`), PowerShell 7 found. A missing item shows one sentence and a link to its official download page through `shell.openExternal`.
2. The installer installs per user, adds a Start menu entry and an optional desktop shortcut, and never asks for administrator rights.
3. `license.txt` says HSOS is personal software for its owner.

**Tests.** `tests/workspace/first-run.ui.test.tsx`: each check's missing state shows its sentence. `tests/e2e/installer.e2e.ts`: `npm run dist` output exists and is above 50 MB.

**Done when.** Tests pass. Feature `F-054` passes.

**Commit.** `build: add the installer and first-run checks`

---

## 106 Final review

**Goal.** Confirm HSOS matches its spec before the owner relies on it.

**Stage.** 6

**Read first.** `spec/00-principles.md`, `features.json`.

**Files.** `PROGRESS.md` only.

**Steps.**
1. Run `npm run check`, `npm run e2e`, and confirm every feature in `features.json` passes.
2. For each rule in `00-principles.md`, name the test that proves it, or write "no test" with a reason. Put the list in `PROGRESS.md`.
3. List every `Deviations` entry from earlier sessions in one place.

**Tests.** None new.

**Done when.** The list is written. Every feature passes. The owner is told the build is ready.

**Commit.** `docs: record the final review`
