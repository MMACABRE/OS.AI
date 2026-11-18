# HSOS

Spec of HSOS (Windows 11 desktop app built around a terminal running Claude Code), and later the app built from it.

**Status (2026-11-18):** spec complete except one open change: Claude session recovery (no session lost after a crash or power cut, auto-resume). Design is in `docs/drafts/session-recovery.md`, not yet in `spec/`. Added on 2026-11-18: terminal input (JOURNAL step 33), and stage 7 with spoken alerts, a Claude setup view and the graph's agent view (step 34).

**Next:** spec author writes that draft into `spec/` and `tasks/` (new module `sessions`, cards after 055, renumber; stage 7 cards 091 to 094 move with it). Implementation not started; after that comes task card 001 in `tasks/stage-0.md`.

## Before any work

The owner edits this repo from more than one device. At the start of every session, run `git fetch --prune` and `git status -sb`, then `git pull --ff-only` if behind and the tree is clean. If it has diverged or has local changes, report that instead of merging. Push finished work.

## If you are the implementer

You build HSOS from the spec. You do not design it.

1. Run `pwsh scripts/init.ps1` (skip until task 001 has created it).
2. Read `spec/04-implementer-protocol.md` once per session. It is the loop you run.
3. Do the lowest-numbered card in `tasks/` that `PROGRESS.md` does not list as done. One card, then stop.

Rules:

- `spec/contracts/` is real TypeScript. Import it as `@hsos/contracts/...`. Never retype a contract.
- Copy files in `spec/reference/` exactly where the card says.
- Tests first, from the module spec's test table. Each test name starts with its rule id.
- Change only the files the card lists. Report anything else in `PROGRESS.md` under `Deviations`.
- Spec silent or contradictory: stop, write a `blocked` entry in `PROGRESS.md`. Do not choose.
- No test may run the real `claude` command with a prompt. It spends the owner's usage.

The pre-commit hook `scripts/guard.mjs` enforces the file rules. It guards against mistakes. Never bypass it.

## If you are changing the spec

You are the spec author. Log every decision in `docs/JOURNAL.md` and push after each step. Commit spec changes with the hook off: `git -c core.hooksPath= commit`. Keep `spec/contracts/` compiling: copy it with `spec/reference/` into a scratch folder with `zod@4.6.7` and `typescript@7.0.2`, run `tsc` under the settings in `spec/03-stack.md`.

## Where things are

- `spec/README.md`: reading order
- `GLOSSARY.md`: terms
- `features.json`: features and pass flags
- `docs/JOURNAL.md`: how the spec was made
- branch `research/round-1`, `docs/research/`: research findings. Newer findings are in `docs/research/` on `main`.
