# Module: hud

## Purpose

One glance tells the owner: which Claude sessions need them, what each is doing, how much of the usage limits is left, and which skill to reach for. It replaces the owner's `agent-hud` mod and covers every session in every terminal at once.

## Interface

No channels of its own. It reads `contracts/channels/claude-link.ts`, `skills.ts` and `terminal.ts`, and calls `shell.notify`.

- Runs in: `ui`. Its `register.service.ts` runs in `main` and does one thing: it registers `hudSection` from `contracts/channels/hud.ts`.
- Third-party packages allowed: `zustand`, `zod`.

## Panel

Side view `hud.panel`, in the right area by default. One column, four sections in this order. Each section has a title row that collapses it; the collapsed set is saved in the panel state.

```
┌ SESSIONS ───────────────────────────────┐
│ ● needs you   fix login flow            │
│   Permission: Bash            opus  41% │
│ ◐ working     refactor parser           │
│   Edit · 2 agents             fable 63% │
│     ├ Explore        haiku   Grep       │
│     └ general-purpose        Read       │
│ ○ done        write tests      warm 52m │
├ USAGE ──────────────────────────────────┤
│ 5 hours   ████████░░░░░░  58%  resets 2h 10m │
│ 7 days    ███░░░░░░░░░░░  21%  resets Thu    │
├ SKILLS ─────────────────────────────────┤
│ [ search skills…                      ] │
│ ★ caveman            Ultra-compressed…  │
│ ☆ graphify           Turn any folder…   │
├ SKILLS REPO ────────────────────────────┤
│ ✓ In sync                     [ Check ] │
└─────────────────────────────────────────┘
```

## Behaviour

### Sessions (the attention board)

- **HUD-1.** The section lists sessions of the open project: those whose `cwd` is the project folder, inside it, or inside one of its worktrees. A toggle in the section menu, "Show all projects", lists every session.
- **HUD-2.** Order: `needs-you` first, then `working`, `background`, `done`, `idle`, `ended`. Within a group, newest change first.
- **HUD-3.** Each session row shows:

| Part | Content |
|---|---|
| Dot and word | by activity, from the table below |
| Title | session title, one line, cut with an ellipsis |
| Second line, left | `attentionReason` when `needs-you`; else `currentTool` and, when subagents are running, `· n agents`; else the last message's first line |
| Second line, right | model short name and context percentage |
| Cache | for `done` and `idle` sessions: `warm 52m` (minutes of warmth left) or `cold`, from `lastResponseAt` and `cacheWarmMinutes` (HUD-8) |

| Activity | Dot | Word | Tone |
|---|---|---|---|
| `needs-you` | filled | needs you | `accent` |
| `working` | half | working | `state.info` |
| `background` | half, outlined | background | `state.info` |
| `done` | ring | done | `state.ok` |
| `idle` | ring, muted | idle | `text.muted` |
| `ended` | none | ended | `text.muted` |

- **HUD-4.** Running subagents are listed under their session, indented: agent type, model when known, and current tool. A subagent that ended is removed after it has shown "done" for 60 seconds (LINK-29).
- **HUD-5.** Activating a row (click or Enter) focuses that session's terminal panel and calls `link.markSeen`. A session with no terminal in HSOS does nothing on activation and shows "outside HSOS" in place of the model.
- **HUD-6.** A session that changes to `needs-you` pulses its dot once (motion rules in `visual-direction.md`).
- **HUD-7.** A terminal panel gaining focus calls `link.markSeen` for the sessions bound to it.
- **HUD-8.** Cache state is computed in the UI every 30 seconds: minutes left = `cacheWarmMinutes` − minutes since `lastResponseAt`. Above zero shows `warm <n>m`; otherwise `cold`. A tooltip explains: "After this time the next message re-reads the whole conversation at full cost."
- **HUD-9.** Context percentage is toned `state.warn` from 70 and `state.danger` from 90. Cost is shown in the row's tooltip, not in the row.

### Notifications

- **HUD-10.** When a session changes to `needs-you`, or to `done` after working for at least 30 seconds, and the HSOS window is not focused, `shell.notify` is called with the session title and the reason or "Finished". Its `focusPanel` is the session's terminal panel.
- **HUD-11.** At most one notification per session per 10 seconds. Settings: `hud.notifyOnNeedsYou` and `hud.notifyOnDone`, both default true.
- **HUD-12.** Status item `hud.attention` (right): `n need you` in accent when `n` is above zero, hidden otherwise. Pressing it focuses the first `needs-you` session's terminal.

### Session recap

- **HUD-20.** A terminal panel that has been hidden or unfocused for at least 60 seconds while its session produced events shows a recap strip at its top edge when it regains focus.
- **HUD-21.** The strip is one line, built from `link.getSessionEvents` since the panel lost focus: `While you were away: 2 prompts answered · 7 files edited · 14 tool calls · 1 failed`. Zero counts are left out.
- **HUD-22.** Pressing the strip opens the Activity view filtered to that session. Any key press in the terminal, or the strip's close button, removes it. It never takes focus and never covers terminal rows: the terminal is resized to make room and resized back.

### Usage

- **HUD-25.** Two bars from `link.getUsageLimits`: "5 hours" and "7 days". Each shows the percentage, a bar toned by the thresholds `hud.warnAt` (default 60) and `hud.dangerAt` (default 85), and the reset time: as a duration when under 24 hours (`resets 2h 10m`), else as a weekday and time (`resets Thu 14:00`).
- **HUD-26.** A window that is null shows a muted bar and "No data yet". When `updatedAt` is older than 10 minutes the section title shows "updated 14m ago".
- **HUD-27.** Status items `hud.usage5h` and `hud.usage7d` (right) show `5h 58%` and `7d 21%`, toned the same way, hidden while null. Pressing either opens the HUD.

### Skills deck

- **HUD-30.** A search field filters `skills.list` by name and description, matching every typed word in any order, case ignored. Favourites come first in starred order, then the rest by name.
- **HUD-31.** Activating a skill writes `/<name> ` (with the trailing space, no Enter) to the target terminal and focuses it. The target is the most recently focused terminal that has a Claude session not `ended`. With none, a toast says "Start a Claude session first" with the action "New Claude Session".
- **HUD-32.** Each row has a star toggle and a "Run in background" action. That action opens a dialog: skill name, an arguments field, a model select (`runModels`, default `runModel`), an effort select when `runEfforts` is not empty, and the line "This starts a separate Claude run on <model> and uses your plan's usage." The primary button is "Run".
- **HUD-33.** Runs appear beneath the search field while any exists: skill, state, elapsed time, and for finished runs "View report" (opens the report in a dialog as `MarkdownView`) and "Dismiss". A running run has "Cancel".
- **HUD-34.** The row menu has "Open SKILL.md", which opens the file in a viewer.

### Skills repo

- **HUD-40.** One row from `skills.getRepoSync`:

| State | Row |
|---|---|
| `not-configured` | "Skills repo not found" and "Settings" |
| `checking`, `syncing` | "Checking…" or "Syncing…" |
| `in-sync` | check mark, "In sync" |
| `out-of-sync` | "3 changed · 1 new · 2 only in repo · ↑1 ↓0", and the button "Sync" |
| `error` | the error sentence and "Retry" |

- **HUD-41.** "Sync" calls `skills.pushToRepo` after a confirmation that lists the folders to be pushed. "Check" calls `checkRepoSync`. Folders only in the repo are listed in the row's tooltip.

## Settings section

| Key | Type | Default |
|---|---|---|
| `notifyOnNeedsYou` | boolean | `true` |
| `notifyOnDone` | boolean | `true` |
| `warnAt` | number 1 to 99 | `60` |
| `dangerAt` | number 1 to 100 | `85` |
| `showRecap` | boolean | `true` |

## States

| Section | Loading | Empty | Error |
|---|---|---|---|
| Sessions | skeleton rows | "No Claude sessions. Start one with Ctrl+Shift+A." | when the link is not listening: "Claude Code link is off." with the reason and "Retry" |
| Usage | muted bars | "No data yet. Limits appear after a session's first reply." | same as Sessions |
| Skills | skeleton rows | "No skills found." or, when filtering, "No skill matches." | "Skills could not be read." with "Retry" |
| Skills repo | "Checking…" | `not-configured` row | error row |

A fault in one section leaves the other three working (P-12): each section is its own error boundary.

## Commands

| Id | Title | Default key |
|---|---|---|
| `hud.show` | Show HUD | `Ctrl+Shift+H` |
| `hud.focusNextAttention` | Go to Next Session That Needs You | `Ctrl+Shift+U` (global) |
| `hud.searchSkills` | Search Skills | `Ctrl+Shift+K` |

## Tests

All component tests use a fake bus fed with `ClaudeSession`, `UsageLimits`, `SkillInfo` and `RepoSync` values.

| Rule | Level | Given | When | Then |
|---|---|---|---|---|
| HUD-1 | component | sessions in the project, in a worktree of it, and elsewhere | the panel renders | the first two are listed; the third only with "Show all projects" |
| HUD-2 | component | sessions `idle`, `needs-you`, `working`, `done` | the panel renders | the order is needs-you, working, done, idle |
| HUD-3 | component | a `needs-you` session with reason `Permission: Bash` | it renders | the row shows the words "needs you" and the reason |
| HUD-4 | component | a session with two running subagents, one with model `haiku` | it renders | both are listed; the second line reads `· 2 agents`; one shows `haiku` |
| HUD-5 | component | a session bound to a terminal panel | its row is activated | that panel is focused and `markSeen` was called |
| HUD-8 | component | `lastResponseAt` 8 minutes ago, `cacheWarmMinutes` 60, fake clock | it renders, then 53 minutes pass | first `warm 52m`, then `cold` |
| HUD-9 | component | context 92 | it renders | the percentage has the danger tone and an accessible label saying "92 percent of context used" |
| HUD-10 | component | the window is unfocused | a session becomes `needs-you` | `shell.notify` was called once with its title |
| HUD-10 | component | the window is focused | a session becomes `needs-you` | `shell.notify` was not called |
| HUD-10 | component | a session worked for 5 seconds | it becomes `done` | no notification |
| HUD-11 | component | fake clock | a session flips to `needs-you` three times in 5 seconds | one notification |
| HUD-12 | component | two `needs-you` sessions | the status item renders | it reads `2 need you` |
| HUD-21 | unit | events: 2 prompts, 7 file edits, 14 tools, 1 failed | the recap text is built | it matches the example line |
| HUD-21 | unit | events with no failures | the text is built | no "failed" part |
| HUD-22 | component | a recap strip is showing | a key is pressed in the terminal | the strip is gone and the key reached the terminal |
| HUD-25 | unit | 58 percent, reset in 2 h 10 min | formatting | `58%`, `resets 2h 10m`, tone ok |
| HUD-25 | unit | reset in 3 days, on a Thursday at 14:00 | formatting | `resets Thu 14:00` |
| HUD-26 | component | both windows null | it renders | "No data yet" shows |
| HUD-30 | unit | skills `caveman`, `caveman-commit`, `graphify`; favourite `graphify`; query `cave com` | filtering | result is `caveman-commit` only; with an empty query `graphify` is first |
| HUD-31 | component | a focused Claude terminal | a skill is activated | `terminal.write` got `/caveman ` and no line break |
| HUD-31 | component | no Claude session | a skill is activated | a toast with "New Claude Session" shows; nothing is written |
| HUD-32 | component | the run dialog | it opens | the usage line names the selected model; "Run" calls `startRun` with the fields |
| HUD-40 | component | each `RepoSync` state | the row renders | it matches the table |
| P-12 | component | the skills list request fails | the panel renders | Sessions and Usage still render; Skills shows its error state |
