# Handoff: hsdevloop run over cards 001 to 037

Updated 2026-11-19 end of session. Read this, `CLAUDE.md`, last `PROGRESS.md` entries (incl. "Lead handoff note").

## First thing next session (owner, 2026-11-19)

**Dashboard nothing like design.** Owner: app Dashboard "nothing like how we designed it in the UI grilling session". Agent in that session gave owner HTML file owner liked. Next session:

1. Find that HTML with owner. Likely `design-round/dashboard/phosphor.html` (approved 2026-11-18; round 2 in `phosphor-r2.html`; log `design-round/design-rounds.md`) (verify with owner). Also check other sessions' scratchpads under `C:\Users\H.2\AppData\Local\Temp\claude\f592d3287f5ebc25\*\scratchpad\` if owner means another file.
2. Render mockup and app side by side (headless Edge `?still=1`; app via Playwright `_electron` `--hsos-demo`), list every difference, close gap. Same check for Code and Notes pages vs `design-round/code/phosphor-code.html?layout=c` and `design-round/notes/phosphor-notes.html?layout=c`.
3. Known Dashboard gaps: layout follows spec DASH-22 (ribbon, usage, mascot top; sessions, context, mini graph middle; quick bar bottom), mockup has graph free in centre, session + sessions boxes left edge, mascot top right, usage + context bottom right, quick bar under graph. Memory said mockup layout not binding; owner now wants Dashboard to match. DASH-22 vs mockup = spec contradiction: write `blocked` or ask owner/spec author before changing layout. Also: usage big numbers + red segments, mini graph = drifting steam graph, box dither strips + status lights + pixel icons.

## Where the run stands

- `main`: cards 001 to 036 "done (untested)". Lanes B to G merged; no lane branches needed (old local branches `lane-*` can be deleted).
- Owner amendments done: Skills repo row above skills search; Ctrl+wheel terminal font (8 to 32); strawberry logo = app icon (`resources/icon.ico`, `resources/art/strawberry-logo.png`); settings layout A.
- Lead fixes after lane B review: ui-kit `DiffView` (`diff`), `CodeView` (CodeMirror), `MarkdownView` (micromark); safe paste `pasteToTerminal` (REV-33, P-6); `List`/`Tree` select on right click; all review findings fixed (PROGRESS entries).
- Look passes: Notes page layout C (graph page layer, square nodes, CLAUDE.md centre); Dashboard boxes, mascot, mini graph, context. Remaining gaps in PROGRESS "034 look pass", "035 look pass".
- Card 037 not started: needs `HSOS Demo` package target + `tests/e2e/demo-tour.e2e.ts`. Tour is a test; owner rule says no tests: ask owner before.

## Open gaps

Git title bar button (needs title bar slot); "Go to terminal" (SESS-32); `graph.open` opens 2nd graph as dock tab; page switch from module (widgets to Notes/Code); demo transport doesn't emit `projectChanged` null (welcome view unseen); graph steam (GRAPH-52); Kinds/Roots/Tags filters; no CodeMirror language packages (FILE-70 colours); gallery shares module singleton stores across states; notes sheet doesn't fill column.

## Subagents

- Ask owner before each spawn. Reuse via SendMessage until 7 prompts, then replace (memory `subagent-reuse-seven-prompts`). Ids don't carry across sessions.
- Worktree + junction workflow, junction removal: see `CLAUDE.md` "Parallel lane rules".

## Run rules

- Build 001 to 037, stop at 037 gate.
- No tests from implementers (owner 2026-11-18); plans in `untested.md`; features stay `passes: false`.
- Lead does look work; coders the rest; only Lead writes `PROGRESS.md`, `features.json`, `untested.md`.
- Screens without mockup: options to owner first.
- End each reply with % of plan done (memory `report-percent-done`).

## Environment

- No `pwsh`: `powershell -ExecutionPolicy Bypass -File scripts/init.ps1`, then `env -u NoDefaultCurrentDirectoryInExePath npm ci`.
- App screenshots: `npm run build`, Playwright `_electron.launch({ args: ['.', '--hsos-demo'] })` (add `'--gallery'` for state gallery); click page names, run palette commands via "Show all commands".
- Mockups: `msedge --headless=new --screenshot=<png> --window-size=1600,950 <file url>?still=1`.
- `npm run demo` opens demo; `npm run demo -- --gallery` state gallery.
- Skills disabled here, skipped on owner's word: interview-me, idea-refine, context-engineering, ci-cd-and-automation, deprecation-and-migration, documentation-and-adrs, surgical-patch, verify-and-stop, babysit, handoff.
