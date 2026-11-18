# Handoff: hsdevloop run over cards 001 to 037

Written 2026-11-18, when the owner paused the run after card 010. Read this, then `CLAUDE.md`, then the last entries of `PROGRESS.md`.

## Where the run stands

- Done and committed, one commit per card: 001 to 010 (`04cc07e` to `2edcbba`). Features F-001, F-002, F-003 pass.
- Next card: **011 Supervisor** (`tasks/stage-0.md`). Then 012 Logging, 013 Crash reports and health, 014 Module loader. Those four finish round 2.
- Checks at `2edcbba`: `npm run check` green (27 tests), `npm run e2e` 2 passed, 1 skipped (card 006, skipped by its card).

## The run's rules

- Owner's instruction: build cards 001 to 037 in one run and stop at the 037 gate (`CLAUDE.md`, "/hsdevloop amendments").
- Crew: Lead (main session) writes all code; one TESTER subagent on Sonnet 5.5; no Reviewer (owner's choice).
- **Tester budget: 5 uses in the whole run, 1 used.** Use 1 was the spawn plus batch 1 (cards 001 to 007). The Tester's notes are in `.crew/handoff/tester.md` and its report in `.crew/reports/batch-1-tester.md` (both git-ignored, on this device only). A new session must spawn a fresh TESTER, which counts as use 2; put batch 2 in the same message.
- Round plan (one Tester batch per round):
  1. 001 to 007: done, tested.
  2. 008 to 014: 008 to 010 done; 011 to 014 left; not yet tested.
  3. 015 to 025: window, settings, themes, keys, components, palette, settings screen, stage 0 checks.
  4. 026 to 031: demo backend, motion and background, app frame, terminal and ribbon, files, HUD.
  5. 032 to 037: sessions, git and activity, notes, dashboard, settings states, the gate.

## Open feedback (batch 1)

- T1, T2: `scripts/guard.mjs` checks removed lines only in `*.test.ts(x)` (not `*.e2e.ts`) and reads the working tree. Reference code, left unchanged; noted for the spec author in `PROGRESS.md` (card 009).
- T3: new tests start with their rule id. Done from card 009 on.
- T5: SHELL-24 (no navigation, no new windows) lands in card 015. The port hand-off now checks `event.source === window`.

## Decisions a resuming session needs

- Ports cannot cross the context bridge, so the preload posts each service port to its window; `onServicePort` only names the service (card 010 deviation, for the spec author).
- The card 005 ports check runs beside the bus (raw messages on the pty-host port) so its e2e test still passes. Card 028 replaces `src/ui/index.tsx`; keep that test passing or stop with a `blocked` entry there.
- `BusClient.failPending(owner)` exists for BUS-4; card 011's supervisor calls it on a service death (main already does on exit).
- Service entries run on `startServiceRuntime` (`src/services/shared/service-main.ts`). Card 014's module lists plug in there.

## Environment on this device

- No `pwsh`: `powershell -ExecutionPolicy Bypass -File scripts/init.ps1` (exit 0 at `2edcbba`).
- Inside Claude Code's shell, run `env -u NoDefaultCurrentDirectoryInExePath npm ci`.
- Docker's engine is not running, so the Tester has no Strix; it uses `security-audit` instead.
- Skills disabled on this device and skipped on the owner's word: interview-me, idea-refine, context-engineering, ci-cd-and-automation, deprecation-and-migration, documentation-and-adrs, surgical-patch, verify-and-stop, babysit.
