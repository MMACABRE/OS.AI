# HSOS

Spec of HSOS (Windows 11 desktop app built around a terminal running Claude Code), and later the app built from it.

**Status (2026-11-19):** spec complete (20 modules, 118 cards). Build order look first: stage 0, Stage U (demo data, ends at owner approval in card 037), then stages 1 to 9 (JOURNAL 36, 37). Built on `main`: cards 001 to 029 and 031, untested by owner's rule (see `PROGRESS.md`, `untested.md`). Cards 030, 032, 033 on branch `lane-b-030-033`, not merged. Handoff: `docs/handoff.md`.

**Look profile: Phosphor** (`spec/design/visual-direction.md`, JOURNAL 38; mockups in `design-round/`, start at `index.html`, decisions in `design-round/design-rounds.md`). CRT pixel art; one colour per job (orange `#FF7A3D` structure, yellow `#F5FF3B` values and focus, red `#FF003C` attention and brand, cyan `#00F0FF` live, lavender `#C77DFF` knowledge, magenta `#FF00FF` memory); breathing HSOS and cyan clock top left; corner boxes; floating zoomable graph with CLAUDE.md pinned centre; strawberry mascot; dust-and-steam background; every button lifts in 3D. Screens without a mockup (settings, palette, file viewer, diff, browser, git changes, history) get their own layout, shown to the owner as options first. Phosphor is the only built-in theme.

**Next:** first the owner's two fixes in `docs/handoff.md` (Skills repo row above the skills search; Ctrl+wheel font size in the terminal), then review and merge lane B (030, 032, 033), then cards 034 to 036, then stop at the 037 gate.

## Before any work

The owner edits this repo from more than one device. At the start of every session, run `git fetch --prune` and `git status -sb`, then `git pull --ff-only` if behind and the tree is clean. If it has diverged or has local changes, report that instead of merging. Push finished work. If git has no identity on the device, commit with `-c user.name=... -c user.email=...` taken from `git log -1 --format='%an <%ae>'`; do not change the git config.

## If you are the implementer

You build HSOS from the spec. You do not design it.

1. Run `pwsh scripts/init.ps1`. Without PowerShell 7: `powershell -ExecutionPolicy Bypass -File scripts/init.ps1` (works on this device).
2. Read `spec/04-implementer-protocol.md` once per session. It is the loop you run.
3. Do the lowest-numbered card in `tasks/` that `PROGRESS.md` does not list as done. One card, then stop. Card 037 is a gate: after it, wait for the owner's approval (protocol "Look first").

Rules:

- `spec/contracts/` is real TypeScript. Import it as `@hsos/contracts/...`. Never retype a contract.
- Copy files in `spec/reference/` exactly where the card says.
- Tests first, from the module spec's test table. Each test name starts with its rule id.
- Change only the files the card lists. Report anything else in `PROGRESS.md` under `Deviations`.
- Spec silent or contradictory: stop, write a `blocked` entry in `PROGRESS.md`. Do not choose.
- No test may run the real `claude` command with a prompt. It spends the owner's usage. Before a test calls `claude`, check that `Get-Command claude -CommandType Application` resolves to the stub: Git Bash can reorder `PATH`.

The pre-commit hook `scripts/guard.mjs` enforces the file rules. It guards against mistakes. Never bypass it.

Build gotchas (found in cards 001 to 010):

- node-pty builds from source for Electron and needs the Visual Studio component `Microsoft.VisualStudio.Component.VC.14.51.x86.x64.Spectre` (installed on this device).
- Claude Code's shell sets `NoDefaultCurrentDirectoryInExePath=1`, which breaks node-pty's `GetCommitHash.bat`. Run `npm ci` as `env -u NoDefaultCurrentDirectoryInExePath npm ci` there.
- TypeScript 7 has no JS API: ESLint and dependency-cruiser get `@typescript/typescript6` through `scripts/typescript6.mjs`.
- Never run Prettier over existing tests: the guard rejects any changed test line. Format new files only.
- Bash heredocs in Claude Code's shell can turn a double backslash into one and a backslash-r into a raw CR. Write files that hold backslashes with the Write or Edit tool.

### Parallel coder subagents: when and where

Default: one coder, cards in number order. The build is a dependency chain, and nearly every card touches files other cards share: `PROGRESS.md` and `features.json` (every card; the guard allows append-only and `passes`-only changes), the `module-list.ts` files (19 cards), `register.*.ts` (44), `src/main/index.ts` (9) and `ui-kit/index.ts`. The guard also runs `npm run check` on the whole tree, so one coder's unfinished work blocks every commit in a shared tree.

| Cards | Parallel? | Lanes |
|---|---|---|
| 001 to 014 | No | Serial chain: skeleton, bus, supervisor, logging, loader. |
| 015 to 022 | Up to 2 | Settings, themes and keys (016 to 019); ui-kit components (020 to 022). Card 015 first. |
| 023 to 028 | No | Each needs both lanes above; 026 to 028 lay the demo backend, motion and app frame that all of Stage U uses. |
| 029 to 036 | Up to 2 or 3, only if the owner agrees | Module folders: terminal and HUD (029, 031); files, sessions, git (030, 032, 033); notes and dashboard (034, 035). One coder for 036. The look must read as one design for the 037 review, so serial is safer. |
| 037 | No | Owner gate. |
| 038 to 118 | Up to 2 or 3 | One module group per lane, for example files and history (050 to 062), claude-link and sessions (063 to 071), git (072 to 075), skills (076 to 078). Check each group's `Read first` for cards in another lane first. |

Rules when lanes run in parallel:

- Each coder has its own git worktree and branch, and its own `node_modules` (or a junction to the main one at the same lockfile).
- Only the Lead writes `PROGRESS.md` and `features.json`, and merges branches into `main` in card-number order. The Lead merges `module-list.ts` and `register.*.ts` additions by hand.
- A coder changes only its lane's module folders plus the card's listed files. A card that needs another lane's unfinished work waits.
- The Tester checks merged `main`, not lane branches, so each batch is one known commit.
- Ask the owner before starting parallel lanes (subagents cost usage, and the owner approves every spawn).

## If you are changing the spec

You are the spec author. Log every decision in `docs/JOURNAL.md` and push after each step. Commit spec changes with the hook off: `git -c core.hooksPath= commit`. Keep `spec/contracts/` compiling: copy it with `spec/reference/` into a scratch folder with `zod@4.6.7`, `typescript@7.0.2`, `@types/node` and `@types/react`, run `tsc` under the settings in `spec/03-stack.md`. Test PowerShell in Windows PowerShell 5.1 too: this device has no `pwsh` and the default `Restricted` policy, so scripts are loaded as script blocks (TERM-7).

Gotchas: working copies are CRLF (`core.autocrlf true`), so strip `\r` before scripted find-and-replace; `.sh` files stay LF (`.gitattributes`). Check Claude Code facts by searching the binary (`grep -a` on `~/.local/bin/claude.exe`), never by running `claude` with a prompt.

## Where things are

- `spec/README.md`: reading order
- `GLOSSARY.md`: terms
- `features.json`: features and pass flags
- `docs/JOURNAL.md`: how the spec was made
- branch `research/round-1`, `docs/research/`: first research round; newer findings in `docs/research/` on `main`
- `docs/drafts/`: design drafts; `session-recovery.md` is done and kept for history
- `design-round/`: throwaway HTML mockups of the design round, outside `src/`; `index.html` links every deliverable. Pages take `?layout=`, `?state=`, `?dialog=`, `?mode=`. Render stills with headless Edge and `?still=1` (headless runs only one animation frame; a resize clears canvases, so redraw on resize).

## /hsdevloop amendments

- 2026-11-18, before round 1: the owner asked for an hsdevloop run over cards 001 to 037, stopping at the 037 gate. This replaces "one card, then stop" for that run only. Each card still gets its own commit and `PROGRESS.md` entry. Why: owner's instruction.
- 2026-11-18, round 2: run paused by the owner after card 010. Resumed at 011 with a new owner rule: implementers write no tests; test plans go to `untested.md` for a later testing agent (replaces the Tester batches).
- 2026-11-19: run paused by the owner after card 031. Lane B (030, 032, 033) built by a Haiku coder on `lane-b-030-033`, awaiting Lead review and merge. Owner fixes to do first are in `docs/handoff.md`. Resume with `docs/handoff.md`.
