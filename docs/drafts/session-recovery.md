# Draft: Claude session recovery (module `sessions`, prefix `SESS`)

Status: design agreed with the owner, not yet written into `spec/`. Paused 2026-11-17 at the owner's request.

## The owner's problem

After a terminal crash, a power cut or any other way a session ends, running `claude` again in the same folder starts a new, empty chat. The old chat looks gone and the owner cannot find it or its context. HSOS must make sure no Claude session is ever lost and that the interrupted one comes back on its own.

## What was found (verified 2026-11-17, Claude Code 2.1.325)

- Nothing is actually deleted. Claude Code writes every session to `~/.claude/projects/<encoded cwd>/<sessionId>.jsonl`. The folder name is the cwd with every non-alphanumeric character replaced by `-` (for example `C:\Users\X` becomes `C--Users-X`). Every hook payload also carries `transcript_path`.
- Plain `claude` always starts a new session. `claude -c` / `--continue` resumes the latest session in the folder. `claude -r` / `--resume [id]` opens a picker or a given id.
- `claude --session-id <uuid>` starts a session with an id the caller chooses. This is the key mechanism: HSOS picks and stores the id before Claude starts, so it doesn't depend on hooks or link-service being alive.
- `--fork-session` makes a resume use a new id. `-n/--name` sets a display name.
- Transcript lines of interest: `type: user|assistant` (with `cwd`, `sessionId`, `timestamp`, `isMeta`), `ai-title`, `last-prompt`.
- Risk: Claude Code's `cleanupPeriodDays` (30 days by default) deletes old transcripts. HSOS keeps its own copy (see SESS backup).

## Design

### Where it lives
New module `sessions`. Service runs in `link-service`, panel in `ui`. Depends on `claude-link`, `terminal`, `workspace`. Build in stage 3, straight after card 055.

### Rules to write (draft)
1. **Id chosen before launch.** Change the LINK-4 wrapper: on a fresh launch (no `-r/--resume/-c/--continue/--session-id/-p/--print` in the owner's args) it generates a GUID and runs `claude --session-id <guid> ...`. Before starting Claude it appends `{sessionId, terminalId: $env:HSOS_TERMINAL_ID, cwd, at, args}` to the launch ledger and flushes it to disk (`FileStream.Flush($true)`).
2. **Ledger.** `%LOCALAPPDATA%\HSOS\sessions\ledger.jsonl`, append-only, one JSON line per change, fsync per write so a power cut loses at most a torn last line. The loader skips invalid lines and keeps the latest record per sessionId. Each record has: sessionId, projectId, cwd, terminalId, transcriptPath, title, startedAt, lastActiveAt, state (`running|ended|interrupted`), endReason. Above 5 MB it is compacted atomically (temp file, fsync, rename, `.bak`).
3. **Hooks keep it current.** `SessionStart` (including source `clear`/`resume`, which may bring a new id in the same terminal), `UserPromptSubmit` (title, lastActive), `Stop` and `SessionEnd` (reason) all write ledger lines. The newest binding for a terminal wins.
4. **Interrupted vs ended.** Ended means a `SessionEnd` arrived. Running with no live terminal at startup, or a terminal killed at app stop (TERM-61), means interrupted.
5. **Auto-resume.** Extend TERM-24: when a panel restores (NOT_FOUND) and the ledger's latest session for its saved terminalId is interrupted, the new shell gets `launch: "claude --resume <id>"`, and a muted line shows `HSOS: resuming Claude session "<title>"`. Before launching, the module writes a binding line for the new terminalId, so a second crash still resumes. Setting `autoResume: always|ask|never`, default `always`. Ended sessions are not auto-resumed.
6. **Buttons.** The TERM-25 banner (pty-host restart) and the TERM-57 exited state get a "Resume Claude session" button when the ledger knows one.
7. **Transcript backup.** On `Stop` and `SessionEnd`, copy the new bytes of the transcript (append, it only grows) to `%LOCALAPPDATA%\HSOS\sessions\transcripts\<projectId>\<sessionId>.jsonl`. If the original is missing when resuming, an explicit owner click copies the backup back to the original path. This is a narrow, deliberate exception to LINK-6 and only applies when the target file does not exist. Needs a spike to prove `--resume` accepts a restored file.
8. **Sessions picker.** Command `sessions.open` "Find Claude Session" (pick a free key). It lists every session of the project: ledger records plus a scan of the project's `~/.claude/projects` folder (this catches sessions started outside HSOS or while link-service was down). It matches the folder by encoding and confirms it by the `cwd` field. Sorted by last activity, it shows title (`ai-title`, else the first non-meta user prompt), time, message count, state, and a "backup only" badge. Search covers titles and user prompts. Actions: Resume in new terminal, Resume here, Copy resume command, Open transcript. A session that is already running shows "Go to terminal" instead, never a second resume.
9. **Transcript reader.** A read-only panel that renders user and assistant text, with tool calls collapsed, so the chat can be read without resuming it.

### Spec files to change when resumed
- new `spec/modules/sessions.md`, `spec/contracts/channels/sessions.ts`
- `spec/contracts/ids.ts` (ModuleId `sessions`), `spec/contracts/paths.ts` (`sessionsDir`, `sessionsLedgerFile`, `transcriptBackupFile(project, sessionId)`)
- `spec/01-capability-map.md` (module row, stage 3), `spec/02-architecture.md` §5 data table
- `spec/modules/terminal.md` TERM-24, 25, 57, 61; `spec/modules/claude-link.md` LINK-4, LINK-6 exception
- `spec/05-testing.md`: new fault test, "kill every HSOS process and the shells mid-session (simulated power cut), relaunch, and the terminal types `claude --resume <same id>`", using the stub `claude` from card 070
- `GLOSSARY.md` (ledger, interrupted session), `features.json` (new features), `spec/README.md` counts
- Tasks: insert about 4 cards after 055 (ledger + wrapper id, hooks + backup, auto-resume in terminal, picker + reader), renumber 056–090 to 060–094 in `tasks/*.md`, every `card 0NN` reference, and `features.json` `"card"` values. `guard.mjs` and `init.ps1` contain no card numbers.
- `docs/JOURNAL.md` step entry; check that the contracts still compile (see CLAUDE.md).
