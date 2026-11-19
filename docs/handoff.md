# Handoff: hsdevloop run over cards 001 to 037

Updated 2026-11-19, when the owner paused the run after card 031. Read this, then `CLAUDE.md`, then the last entries of `PROGRESS.md`.

## First thing next session (owner's request, 2026-11-19)

Do these two before any card:

1. **HUD: move the Skills repo row above the skills search field.** Today the HUD shows the Skills section (search, filters, runs, list) and then a separate "Skills repo" section under it (`src/modules/hud/panel/HudPanel.tsx`, `SkillsRepoRow` in `SkillsSection.tsx`). Put the repo row at the top of the Skills section, above the search field.
2. **Terminal: Ctrl + mouse wheel changes the font size.** In the terminal panel (`src/modules/terminal/panel/TerminalPanel.tsx`), Ctrl+wheel up makes the text larger and down smaller, kept in the panel state's `fontSizeDelta` (`TerminalPanelState`), applied to xterm (`terminal.options.fontSize`) and followed by a refit and `terminal.resize`. Stop the wheel event's default so the page does not zoom. Clamp to the settings range (8 to 32).

Record both in `PROGRESS.md` as owner amendments (they change the look approved at the 037 gate, so note them for the review).

## Where the run stands

- `main` holds cards 001 to 031 except the lane B cards: 027 motion and background, 028 app frame and pages, 029 terminal, ribbon and mascot, 031 HUD (all "done (untested)").
- **Lane B, not merged:** branch `lane-b-030-033` (pushed) holds 030 files, viewer and history; 032 sessions; 033 git, changes, feedback and activity. Written by a Haiku coder subagent; each commit passed `npm run check`. Not yet reviewed by the Lead. Its PROGRESS entries and test plans are in `lane-notes/<card>-progress.md` and `lane-notes/<card>-untested.md` on that branch; copy them into `PROGRESS.md` and `untested.md` when merging, then delete `lane-notes/`.
- Lane B gaps to fix before or during the merge (from its report): no `DiffView`, `CodeView` or `MarkdownView` in the ui-kit (viewer is a textarea, history and review each copy a line diff: move one `DiffView` into the ui-kit); modules cannot open side views or add a title bar button (git button missing; Changes, Activity, Artifacts commands not registered); "Resume here" and "Go to terminal" (SESS-32) missing; command errors go to Windows notifications; duplicated helpers (`use-project`, `use-repo`, format helpers, `loadSessions`, line diff); diff panel loses scroll on refresh (REV-20) and has no inline/split toggle. `src/ui/module-list.ts` conflicts with `main` (both add modules): merge by hand, keeping card order.
- Next cards after the merge: 034 notes page and browser frame, 035 dashboard, 036 settings, welcome view and state gallery, then 037 (owner gate, stop).
- Checks at `7ee311e`: `npm run check` green (27 tests), `npm run e2e` 2 passed, 1 skipped. `npm run demo` shows the frame, background, terminals with ribbons and mascots, and the HUD.

## The run's rules

- Owner's instruction: build cards 001 to 037 and stop at the 037 gate (`CLAUDE.md`, "/hsdevloop amendments").
- **No tests from implementers** (owner, 2026-11-18): write each card's test plan in `untested.md`; features stay `passes: false`. A testing agent runs later.
- Lead writes the delicate look work itself; coder subagents (Haiku 5.5) only for parallel lanes, and only after the owner approves each spawn. Only the Lead writes `PROGRESS.md`, `features.json` and `untested.md`, and merges lanes in card order.
- Ask before deviating from the spec in a way the owner will see; otherwise record it under `Deviations`.

## Decisions a resuming session needs

- UI extension points: `UiContext` has no `contribute`, so the ui-kit holds a small store (`contributeUi`, `useUiContributions`); `terminalHeader` uses it. For the spec author.
- `usePageVisible`, `PageVisibleContext`, `Popover` and toast actions live in the ui-kit (modules may import only the ui-kit).
- `dockview` 8.9.0 has no React component: the dock host renders panels through portals into dockview's elements. A second panel of a kind opens below the first (layout C).
- The background scene uses a 6 px pitch (approved preview) and a luminance cap at 0.6 of `color.accent`; both are recorded deviations from `background.md` and UI-34.
- Terminal panels carry `data-terminal-id`; the HUD uses it to find and focus the target terminal.
- Skills repo (owner, 2026-11-19): it is now named `Core` (private, `MMACABRE/Core`) and needs a credential to sync. The spec still defaults `repoDir` to `Documents\GitHub\SKILLS` and does not say how a private repo authenticates; for the spec author.

## Environment on this device

- No `pwsh`: `powershell -ExecutionPolicy Bypass -File scripts/init.ps1`.
- Inside Claude Code's shell, run `env -u NoDefaultCurrentDirectoryInExePath npm ci`.
- A worktree can junction `node_modules` to the main checkout's (`mklink /J`); lockfile unchanged since card 001.
- Write files with backslashes or backticks with the Write or Edit tool, never through shell heredocs or `node -e`.
- Screenshots of the running app: Playwright's `_electron.launch({ args: ['.', '--hsos-demo'] })` after `npm run build`.
- Skills disabled on this device and skipped on the owner's word: interview-me, idea-refine, context-engineering, ci-cd-and-automation, deprecation-and-migration, documentation-and-adrs, surgical-patch, verify-and-stop, babysit.
