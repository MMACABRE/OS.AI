# HSOS

This repo holds the specification of HSOS, a Windows 11 desktop app built around a terminal that runs Claude Code, and the app built from it.

## If you are the implementer

You build HSOS from the spec. You do not design it.

1. Run `pwsh scripts/init.ps1`. Before task 001 exists, skip this step.
2. Read `spec/04-implementer-protocol.md` once per session. It is the loop you run.
3. Open the lowest-numbered task card in `tasks/` that `PROGRESS.md` does not list as done. Do that one card, then stop.

Rules that hold everywhere:

- `spec/contracts/` is real TypeScript. Import it as `@hsos/contracts/...`. Never retype a contract.
- Copy files in `spec/reference/` exactly where the card says.
- Write the tests first, from the test table in the module spec. Each test name starts with its rule id.
- Change only the files the card lists. Report anything else in `PROGRESS.md` under `Deviations`.
- When the spec is silent or contradicts itself, stop and write a `blocked` entry in `PROGRESS.md`. Do not choose.
- No test may run the real `claude` command with a prompt. That spends the owner's usage.

The pre-commit hook `scripts/guard.mjs` enforces the file rules. It is a guard against mistakes. Never bypass it.

## If you are changing the spec

You are the spec author. Record every decision in `docs/JOURNAL.md` and push after each step. Spec commits are made with the hook off: `git -c core.hooksPath= commit`. Keep `spec/contracts/` compiling: copy it with `spec/reference/` into a scratch folder with `zod@4.6.7` and `typescript@7.0.2` and run `tsc` under the settings in `spec/03-stack.md`.

## Where things are

- `spec/README.md`: reading order of the spec
- `GLOSSARY.md`: terms
- `features.json`: features and their pass flags
- `docs/JOURNAL.md`: how the spec was made
- `docs/research/` on the branch `research/round-1`: research findings
