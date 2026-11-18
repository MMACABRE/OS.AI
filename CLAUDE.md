# HSOS

Spec of HSOS (Windows 11 desktop app built around a terminal running Claude Code), and later the app built from it.

**Status (2026-11-18):** spec complete: 20 modules, 118 cards (001 to 118). Build order is look first: stage 0, Stage U (every screen on demo data, ending at the owner's approval in card 037), then stages 1 to 9. Latest: dashboard, pages, session ribbon and mascot, motion as a hard rule, background and glass. See JOURNAL steps 36 and 37.

**Next:** the design round (`spec/design/direction-brief.md`): a designer agent shows the owner several directions, the owner picks one, the spec author writes it into `spec/design/`. Then implementation starts with card 001 in `tasks/stage-0.md`.

## Before any work

The owner edits this repo from more than one device. At the start of every session, run `git fetch --prune` and `git status -sb`, then `git pull --ff-only` if behind and the tree is clean. If it has diverged or has local changes, report that instead of merging. Push finished work. If git has no identity on the device, commit with `-c user.name=... -c user.email=...` taken from `git log -1 --format='%an <%ae>'`; do not change the git config.

## If you are the implementer

You build HSOS from the spec. You do not design it.

1. Run `pwsh scripts/init.ps1` (skip until task 001 has created it). Without PowerShell 7 use `powershell -ExecutionPolicy Bypass -File scripts/init.ps1` (verify).
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
