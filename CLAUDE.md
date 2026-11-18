# HSOS

Spec of HSOS (Windows 11 desktop app built around a terminal running Claude Code), and later the app built from it.

**Status (2026-11-18):** spec complete (20 modules, 118 cards). Build order look first: stage 0, Stage U (demo data, ends at owner approval in card 037), then stages 1 to 9 (JOURNAL 36, 37). Built: cards 001 to 010 (see `PROGRESS.md`). Handoff: `docs/handoff.md`.

**Look profile: Phosphor** (`spec/design/visual-direction.md`, JOURNAL 38; mockups in `design-round/`, start at `index.html`, decisions in `design-round/design-rounds.md`). CRT pixel art; one colour per job (orange `#FF7A3D` structure, yellow `#F5FF3B` values and focus, red `#FF003C` attention and brand, cyan `#00F0FF` live, lavender `#C77DFF` knowledge, magenta `#FF00FF` memory); breathing HSOS and cyan clock top left; corner boxes; floating zoomable graph with CLAUDE.md pinned centre; strawberry mascot; dust-and-steam background; every button lifts in 3D. Screens without a mockup (settings, palette, file viewer, diff, browser, git changes, history) get their own layout, shown to the owner as options first. Phosphor is the only built-in theme.

**Next:** card 011 (Supervisor) in `tasks/stage-0.md`, then 012 to 014 to finish round 2 of the hsdevloop run.

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
- 2026-11-18, round 2: run paused by the owner after card 010. Tester budget for the run: 5 uses, 1 used (batch 1, cards 001 to 007). Resume with `docs/handoff.md`.
