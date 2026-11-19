# HSOS

Spec of HSOS (Windows 11 desktop app around terminal running Claude Code), and app built from it.

**Status (2026-11-19):** spec done (20 modules, 118 cards). Build order look first: stage 0, Stage U (demo data, ends at owner gate card 037), stages 1 to 9 (JOURNAL 36, 37). On `main`: cards 001 to 036 done, untested by owner rule (`PROGRESS.md`, `untested.md`). No lane branches open. Handoff: `docs/handoff.md`.

**Look profile: Phosphor** (`spec/design/visual-direction.md`, JOURNAL 38; mockups `design-round/`, start `index.html`, decisions `design-round/design-rounds.md`). CRT pixel art; one colour per job (orange `#FF7A3D` structure, yellow `#F5FF3B` values/focus, red `#FF003C` attention/brand, cyan `#00F0FF` live, lavender `#C77DFF` knowledge, magenta `#FF00FF` memory); breathing HSOS + cyan clock top left; corner boxes; floating zoomable graph, CLAUDE.md pinned centre; strawberry mascot; dust-and-steam background; buttons lift in 3D. Screens without mockup get own layout, shown to owner as options first. Phosphor only built-in theme.

**Next:** close gap between app and approved mockups, Dashboard first (owner 2026-11-19: "nothing like how we designed it"). See `docs/handoff.md` "Next". Then card 037 (owner gate), stop.

## Before any work

Owner edits repo from several devices. Each session start: `git fetch --prune`, `git status -sb`, `git pull --ff-only` if behind and tree clean. Diverged or local changes: report, don't merge. Push finished work. No git identity on device: commit with `-c user.name=... -c user.email=...` from `git log -1 --format='%an <%ae>'`; don't change git config.

## If you are the implementer

You build HSOS from spec. You don't design it.

1. Run `pwsh scripts/init.ps1`. Without PowerShell 7: `powershell -ExecutionPolicy Bypass -File scripts/init.ps1` (works here).
2. Read `spec/04-implementer-protocol.md` once per session. It is the loop.
3. Do lowest-numbered card in `tasks/` not done in `PROGRESS.md`. One card, stop. Card 037 = gate: wait for owner approval (protocol "Look first").

Rules:

- `spec/contracts/` is real TypeScript. Import as `@hsos/contracts/...`. Never retype contract.
- Copy `spec/reference/` files exactly where card says.
- Tests first, from module spec test table. Test name starts with rule id. (Owner override 2026-11-18: implementers write no tests; plans go to `untested.md`.)
- Change only files card lists. Others: report in `PROGRESS.md` under `Deviations`.
- Spec silent or contradictory: stop, write `blocked` entry in `PROGRESS.md`. Don't choose.
- No test may run real `claude` with prompt (spends owner usage). Before test calls `claude`, check `Get-Command claude -CommandType Application` resolves to stub: Git Bash can reorder `PATH`.

Pre-commit hook `scripts/guard.mjs` enforces file rules. Never bypass it. It blocks implementer edits to `CLAUDE.md`, `docs/**`, `spec/**`; `PROGRESS.md` append-only.

Build gotchas:

- node-pty builds from source for Electron; needs VS component `Microsoft.VisualStudio.Component.VC.14.51.x86.x64.Spectre` (installed).
- Claude Code shell sets `NoDefaultCurrentDirectoryInExePath=1`, breaks node-pty `GetCommitHash.bat`. Run `env -u NoDefaultCurrentDirectoryInExePath npm ci`. `init.ps1` runs plain `npm ci` and fails there: rerun with env fix after.
- TypeScript 7 has no JS API: ESLint and dependency-cruiser get `@typescript/typescript6` via `scripts/typescript6.mjs`.
- Never run Prettier over existing tests: guard rejects changed test lines. Format new files only.
- Bash heredocs can turn `\\` into `\` and `\r` into raw CR. Write backslash files with Write/Edit tool.
- Agents mangle non-ASCII (`§` became backtick). Check merged diffs.
- CSS modules: no hex, rgb(), px except 0/1px/2px (`eslint-rules/no-raw-css-values.js`).

### Parallel coder subagents: when and where

Default: one coder, cards in order. Build is dependency chain; most cards touch shared files: `PROGRESS.md`, `features.json` (append-only / `passes`-only), `module-list.ts` (19 cards), `register.*.ts` (44), `src/main/index.ts` (9), `ui-kit/index.ts`. Guard runs `npm run check` on whole tree, so one coder's unfinished work blocks every commit in shared tree.

| Cards | Parallel? | Lanes |
|---|---|---|
| 001 to 014 | No | Serial chain: skeleton, bus, supervisor, logging, loader. |
| 015 to 022 | Up to 2 | Settings, themes, keys (016 to 019); ui-kit components (020 to 022). Card 015 first. |
| 023 to 028 | No | Each needs both lanes above; 026 to 028 lay demo backend, motion, app frame. |
| 029 to 036 | Up to 2 or 3, owner agrees | Done 2026-11-19. |
| 037 | No | Owner gate. |
| 038 to 118 | Up to 2 or 3 | One module group per lane, e.g. files+history (050 to 062), claude-link+sessions (063 to 071), git (072 to 075), skills (076 to 078). Check each group's `Read first` for other-lane cards. |

Parallel lane rules:

- Ask owner before each spawn. Reuse subagent via SendMessage until 7 prompts from Lead, then replace.
- Each coder: own git worktree beside repo (`C:\Users\H.2\Desktop\OS.AI-lane-x`), own branch, `node_modules` junction to main checkout. Writes `lane-notes/<card>-progress.md` and `-untested.md`; commits on branch, no push.
- Only Lead writes `PROGRESS.md`, `features.json`, `untested.md`, merges into `main` in card order, merges `module-list.ts` / `register.*.ts` by hand, folds lane notes, deletes `lane-notes/`.
- Remove worktree: first `[System.IO.Directory]::Delete("<worktree>\node_modules")` (unlinks junction only), then `git worktree remove`. Recursive delete can follow junction into main `node_modules`.
- Lead does delicate look work; coders build rest; Lead look-passes each coder card against its mockup before merge.

## If you are changing the spec

You are spec author. Log every decision in `docs/JOURNAL.md`, push after each step. Commit spec changes with hook off: `git -c core.hooksPath= commit`. Keep `spec/contracts/` compiling: copy with `spec/reference/` into scratch folder with `zod@4.6.7`, `typescript@7.0.2`, `@types/node`, `@types/react`, run `tsc` under `spec/03-stack.md` settings. Test PowerShell in Windows PowerShell 5.1 too: no `pwsh` here, default `Restricted` policy, so scripts load as script blocks (TERM-7).

Gotchas: working copies CRLF (`core.autocrlf true`): strip `\r` before scripted find-and-replace; `.sh` stay LF (`.gitattributes`). Check Claude Code facts by searching binary (`grep -a` on `~/.local/bin/claude.exe`), never by running `claude` with prompt.

## Where things are

- `spec/README.md`: reading order
- `GLOSSARY.md`: terms
- `features.json`: features, pass flags
- `docs/JOURNAL.md`: how spec was made
- branch `research/round-1`, `docs/research/`: first research round; newer in `docs/research/` on `main`
- `docs/drafts/`: design drafts; `session-recovery.md` done, kept for history
- `design-round/`: throwaway HTML mockups outside `src/`; `index.html` links all. Pages take `?layout=`, `?state=`, `?dialog=`, `?mode=`. Stills: headless Edge with `?still=1` (one animation frame; resize clears canvases).
- `design-round/settings/phosphor-settings.html`: settings options; owner chose A (2026-11-19).

## /hsdevloop amendments

- 2026-11-18: owner asked hsdevloop run over 001 to 037, stop at 037 gate. Replaces "one card, then stop" for that run. Each card own commit and `PROGRESS.md` entry.
- 2026-11-18 round 2: implementers write no tests; plans to `untested.md` for later testing agent.
- 2026-11-19: run resumed, cards 030 to 036 built (lanes B to G, Haiku coder + Sonnet reviewer/fixer). Paused before 037 for mockup gap. Resume with `docs/handoff.md`.
