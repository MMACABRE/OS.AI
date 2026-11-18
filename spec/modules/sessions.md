# Module: sessions

## Purpose

No Claude session is ever lost. After a terminal crash, a power cut, a pty-host restart or quitting HSOS, the interrupted session comes back in its terminal on its own, and every past session of a project can be found, read and resumed. Plain `claude` always starts an empty chat; this module makes sure the owner never has to hunt for the old one.

Background: `docs/drafts/session-recovery.md` (the design agreed with the owner) and JOURNAL step 35.

## Interface

`contracts/channels/sessions.ts`. Reference code: `reference/shell-init.ps1` (the wrapper, owned by `claude-link`).

- Runs in: `link-service` (records, hooks, backups, listing), `ui` (recovery offers, the picker, the transcript reader).
- Uses: the `hookObservers` extension point of `claude-link` (LINK-15), the `terminalRecovery` extension point of `terminal`, `terminal.create`, `terminal.write`, `terminal.list`, `workspace.openPanel`, `shell.writeClipboard`.
- Third-party packages allowed: `zod`, `write-file-atomic` (service).

## What Claude Code does

Verified on 2026-11-17 and 2026-11-18 with Claude Code 2.1.325 and 2.1.327.

- Every session is written to `%USERPROFILE%\.claude\projects\<encoded cwd>\<sessionId>.jsonl`. `<encoded cwd>` is the cwd with every character other than a letter or digit replaced by `-`. Hook payloads carry `transcript_path`.
- Plain `claude` always starts a new session. `--resume <id>` (`-r`) resumes one. `--session-id <uuid>` starts a new session with an id the caller chooses.
- `SessionStart` has `source` `startup`, `resume`, `clear`, `compact` or `fork`. `SessionEnd` has `reason` `clear`, `resume`, `logout`, `prompt_input_exit` or `other`.
- Transcript lines have a `type`. `user` and `assistant` lines carry `message`, `timestamp`, `cwd` and `sessionId`; a user prompt has `message.content` as a string, a tool result has it as an array. `ai-title` lines carry `aiTitle`; a transcript holds many, the last is current.
- Claude Code deletes transcripts older than `cleanupPeriodDays`, 30 by default. HSOS's backup outlives that.
- Next to `<sessionId>.jsonl` there may be a folder `<sessionId>\` holding that session's subagent transcripts and large tool results. A project folder may also hold `memory\`, which belongs to the project, not to a session.
- `/rename <name>` appends `{"type":"custom-title","customTitle":"<name>","sessionId":"<id>"}` to the transcript. The last such line is the session's name, and `/resume` lists it. Verified in the 2.1.327 binary.

## Files

All under `sessionsDir` (`%LOCALAPPDATA%\HSOS\sessions`). HSOS's own data.

| Path | Written by | Content |
|---|---|---|
| `launches\<ms>-<guid>.json` | the `claude` wrapper | One launch (SESS-1). Deleted once applied. |
| `records\<sessionId>.json` | this module only | One `SessionRecord` per session (SESS-5) |
| `transcripts\<sessionId>.jsonl` | this module only | The backup copy of the transcript (SESS-20) |

## Behaviour

### Launches

- **SESS-1.** The `claude` wrapper (`reference/shell-init.ps1`, LINK-4) decides per launch:
  - a first argument that is a Claude Code subcommand: run as typed, nothing recorded;
  - `-p`, `--print`, `--bg` or `--background`: no launch file and no chosen id;
  - none of the flags in `$__HsosNotFresh`: a fresh session. The wrapper creates a GUID, passes `--session-id <guid>`, and records it;
  - `--resume <uuid>`, `-r <uuid>` or `--resume=<uuid>`: records the id being resumed;
  - `-c` or `--continue`: records that a continue happened, with no id.

  It records by writing a launch file `{ version: 1, sessionId, resumeId, continue, terminalId, cwd, at, args }` into `HSOS_SESSIONS_LAUNCH_DIR`: to a `.tmp` file first, flushed to disk (`Flush($true)`), then renamed to `.json`. All of this happens before Claude Code starts, and needs no HSOS process to be running. A failure prints one line and Claude still starts.
- **SESS-2.** The service reads `launches\*.json` at start and then every 2 seconds, oldest name first. Each file is validated, applied (SESS-3) and deleted. A file that fails validation moves to `launches\invalid\`. A `.tmp` file older than 60 seconds is deleted, because its write never finished.
- **SESS-3.** Applying a launch:
  - with `sessionId`: create the record, `state: 'running'`, `terminalId` and `boundAt` from the launch, `startedAt` and `lastActiveAt` = `at`, `title` empty;
  - with `resumeId`: update that record, or create it from the launch, with `terminalId`, `boundAt` = `at`, `state: 'running'`, `endReason: null`;
  - with only `continue`: nothing; `SessionStart` will say which session it was.

### Records

- **SESS-5.** Each session has one file `records\<sessionId>.json`, written with `write-file-atomic` (which flushes to disk before renaming), so a power cut leaves either the old or the new record, never a torn one. At start all records are loaded into memory. A file that fails validation is renamed `<name>.invalid-<time>` and logged. Records are never deleted by HSOS, except by SESS-62.
- **SESS-6.** A change to `state`, `terminalId` or `transcriptPath` is written before the hook, launch or request that caused it is finished with. Changes to `lastActiveAt`, `title` and `backupBytes` alone are written at most once every 2 seconds per record, and at stop. Every write emits `recordChanged`.

### Hooks

Hooks arrive through `hookObservers` (LINK-15). Each payload is validated with zod; a field that fails is ignored (P-6).

- **SESS-10.** `SessionStart`: the record of `session_id` is created or updated with `state: 'running'`, `endReason: null`, `cwd`, `transcriptPath` and, when the hook carried a terminal id, `terminalId` and `boundAt` = now. This covers `-c`, `/resume` inside Claude, `/clear` and forks, which bring a new id into the same terminal.
- **SESS-11.** A terminal's session is the record with that `terminalId` and the newest `boundAt`. `bind` sets `terminalId` and `boundAt` and writes the record before it replies.
- **SESS-12.** `SessionEnd` with `reason` `clear`, `resume`, `logout` or `prompt_input_exit` sets `state: 'ended'` and `endReason`. The owner chose to leave, so it is never resumed on its own.
- **SESS-13.** `SessionEnd` with any other reason, or none, sets `state: 'interrupted'` with that reason. A `running` record whose terminal is not live when `getResumeOffer` or `list` looks at it is treated as `interrupted` and written with `endReason: 'lost-terminal'`. A Claude process killed with its shell, at a crash, a power cut or app stop (TERM-61), therefore ends up `interrupted`.
- **SESS-14.** `UserPromptSubmit` sets `lastActiveAt`, and `title` from the first 80 characters of `prompt` when `title` is empty. `Stop` sets `lastActiveAt`.
- **SESS-15.** `session_id` must be a UUID. `transcript_path` is used only when it is an absolute path to a `.jsonl` file under `%USERPROFILE%\.claude\projects\`; any other value is ignored, so a hook payload can never make HSOS copy or read another file.

### Transcript backup

- **SESS-20.** With `backupTranscripts` on, after every `Stop` and `SessionEnd` the service copies the transcript's new bytes, from `backupBytes` to the current end, onto `transcripts\<sessionId>.jsonl`, flushes, and sets `backupBytes`. When the transcript is shorter than `backupBytes`, it was rewritten: the whole file is copied to a temporary file, flushed, and renamed over the backup. Only one copy per session runs at a time; requests during a copy run once more after it. A failure is logged and retried at the next `Stop`.
- **SESS-21.** While copying, every `ai-title` line seen sets `title` to its `aiTitle`, cut to 80 characters, control characters removed (P-6). The last one wins.
- **SESS-22.** `restoreTranscript` is the only write HSOS makes in Claude Code's folder (LINK-6). It writes to `transcriptPath`, or when that is null to `%USERPROFILE%\.claude\projects\<encoded cwd>\<sessionId>.jsonl`, and only when no file exists there. It copies the backup to a temporary file in the same folder, flushes, and renames it into place without overwriting, creating the folder if needed. With a file already there it returns `BAD_REQUEST` "A transcript already exists". With no backup it returns `NOT_FOUND`.
- **SESS-23.** Backups are never deleted by HSOS, except by SESS-62.

### Resuming

- **SESS-40.** `getResumeOffer({ terminalId })` takes that terminal's session (SESS-11). It returns an offer when the session is `running` or `interrupted` (SESS-13 applies) and its transcript or its backup exists; `hasOriginal` says which. Otherwise, and for an `ended` session, it returns null.
- **SESS-41.** The ui part contributes to `terminalRecovery`. `offerFor(savedTerminalId)` returns null when `autoResume` is `never`, else calls `getResumeOffer` and, for an offer, returns a `RecoveryOffer`:
  - `label`: `Resume Claude session "<title>"`, or `Resume Claude session` when the title is empty;
  - `notice`: `HSOS: resuming Claude session "<title>"`;
  - `launch`: `resumeCommand(sessionId)`, which runs through the wrapper so HSOS's hooks load;
  - `auto`: true when `autoResume` is `always`.
- **SESS-42.** `accepted(newTerminalId)` first calls `restoreTranscript` when `hasOriginal` is false, then `bind` with the new terminal id. Because the binding is on disk before Claude starts, a second crash still resumes the same session.
- **SESS-43.** A session whose terminal is live is never offered for resuming anywhere. Resuming it twice would run two Claude processes on one transcript.

### Finding sessions

- **SESS-30.** `list({ projectPath, liveTerminalIds })` returns, newest activity first, at most 500 for a project and 2 000 when `projectPath` is null:
  - every record whose `cwd` is `projectPath` or inside it;
  - every `.jsonl` file in `%USERPROFILE%\.claude\projects\<encoded projectPath>\`, the newest 200 by modified time, which catches sessions started outside HSOS. With `projectPath` null: every record, and every `.jsonl` file directly inside any folder of `%USERPROFILE%\.claude\projects\`, the newest 2 000 by modified time;
  - the backup of every listed record whose original is gone.

  Each transcript is read once and the result kept in memory, keyed by path, size and modified time. From it: `title` (the record's `customTitle`, else the last `customTitle` line, else the last `aiTitle`, else the record's title, else the first user line whose content is a string, is not `isMeta`, and does not start with `<`, cut to 80), `messages` (those user lines plus `assistant` lines), `startedAt` (the first `timestamp`), `lastActiveAt` (the last `timestamp`, else the file's modified time) and `cwd` (the first line with one). A file whose `cwd` is not inside `projectPath` is left out, since different folders can encode to the same name. `note` comes from the record, else empty. `state` comes from the record, else `untracked`. `liveTerminalId` is the record's `terminalId` when it is in `liveTerminalIds` and the state is `running`.
- **SESS-31.** Command `sessions.find`, "Find Claude Session", opens a dialog. It calls `list` with the open project's folder and the ids from `terminal.list`. A search field filters by title, every typed word in any order, case ignored. Each row: title (or "Untitled session"), relative last activity, message count, a state chip, and a "backup only" badge when only the backup exists. Arrow keys move, Enter runs the row's first action.
- **SESS-32.** Row actions:
  - with `liveTerminalId`: "Go to terminal" focuses that terminal's panel. No resume action is shown (SESS-43).
  - otherwise: "Resume in new terminal" (first): opens a terminal panel in the session's `cwd`, creates its shell with no `launch`, runs SESS-42 with the new id, then writes `resumeCommand(sessionId)` and `\r`;
  - "Resume here": the same into the focused terminal, enabled only while that terminal's prompt state is `prompt` (TERM-71);
  - "Copy resume command": `shell.writeClipboard` with `cd "<cwd>"; claude --resume <sessionId>`;
  - "Open transcript": opens the reader (SESS-50).

### Reading a transcript

- **SESS-50.** Dock panel `sessions.transcript`, state `{ sessionId }`, title the session title. `readTranscript` reads the original, else the backup, and turns it into items: a user line with string content and not `isMeta` is a `user` item; an `assistant` line's `text` blocks, joined, are an `assistant` item; each `tool_use` block is a `tool` item with the tool name. Thinking blocks and tool results are left out. The panel shows the last 200 items with `MarkdownView`, user items set apart by `color.bg.raised`, tool items as one muted line each, and "Show earlier" loads 200 more. While visible it checks for growth every 2 seconds and appends new items. The header has a "Resume" button that runs the row's first action from SESS-32.
- **SESS-51.** The reader only reads. Transcript text is data (P-6): it is rendered with `MarkdownView`, which shows raw HTML as text (UI-5).

### Managing sessions

- **SESS-60.** Rename, note and delete act on any listed session, including `untracked` ones. A session without a record gets one first: `cwd`, `startedAt`, `lastActiveAt` and `transcriptPath` from its transcript, `terminalId` null, `boundAt` 0, `state: 'ended'`, `endReason: 'untracked'`.
- **SESS-61.** `rename({ sessionId, title })` trims the title and removes control characters (P-6); it must then be 1 to 80 characters, else `BAD_REQUEST`. It sets `customTitle` and writes the record. Then:
  - when the session has no live terminal (SESS-43) and its original transcript exists under `%USERPROFILE%\.claude\projects\`, it appends one line `{"type":"custom-title","customTitle":"<title>","sessionId":"<id>"}` and a line break to that file, in one write in append mode, with a line break first when the file does not end in one. Then it runs the SESS-20 copy for the session, so the backup has the line too;
  - when the session is live, it sets `pendingTitleLine: true` instead. Claude Code holds the old name in memory while it runs and would write it again. The line is appended, as above, when the record leaves `running` (SESS-12, SESS-13), and `pendingTitleLine` goes back to false.

  This is the only content HSOS adds to a transcript. It is the same line `/rename` writes, so Claude Code's `/resume` shows the new name.
- **SESS-62.** `trash({ sessionIds })` handles each id in turn:
  - a session with a live terminal is refused with "Running in a terminal. End it first." (SESS-43);
  - otherwise each of these that exists goes to the Recycle Bin through `shell.trashItem` (P-1), in this order: the original `<sessionId>.jsonl`, the folder `<sessionId>\` beside it, the backup `transcripts\<sessionId>.jsonl`, the record `records\<sessionId>.json`;
  - before each move, the path is checked: its parent is `sessionsDir\transcripts`, `sessionsDir\records`, or a folder directly inside `%USERPROFILE%\.claude\projects\`, and its name is exactly the session id, with `.jsonl` or `.json` for files. Anything else is refused and logged. So `memory\`, other sessions and the project folder itself can never be moved;
  - a failed move stops that session's remaining moves and is reported for it; the other sessions still go.

  It answers `{ trashed, failed }` and emits `removed` with the trashed ids.
- **SESS-63.** `setNote({ sessionId, note })` stores the note, at most 2 000 characters, control characters other than line breaks removed, in the record only. The note is never sent to Claude.

### Session history

- **SESS-70.** Dock panel `sessions.history`, single instance, title "Session History", opened by the command `sessions.history`, which the HUD quick bar's "More" menu also runs (HUD-67). It calls `list` with `projectPath: null` and the ids from `terminal.list`, again on `recordChanged` and `removed` (debounced 500 ms), and on "Refresh".
- **SESS-71.** The toolbar has a project select ("All projects" and each distinct project folder found, by folder name with the full path in its tooltip; default the open project, else "All projects"), a search field that matches every typed word against title and note in any order, case ignored, and a state select (all, running, interrupted, ended, untracked).
- **SESS-72.** Rows are grouped by project folder when "All projects" is chosen, newest activity first within each group. Each row shows the SESS-31 parts plus the first line of the note, muted. A checkbox selects rows; Shift-click selects a range; Ctrl+A selects every visible row.
- **SESS-73.** Row actions: the SESS-32 actions, then "Rename" (F2), "Edit note" and "Delete" (Delete key). Opening a row (double-click or Enter) opens the reader (SESS-50). With rows selected, the toolbar shows "Delete <n>".
- **SESS-74.** "Rename" opens a dialog with the title field, filled with the current title and selected. Under it: "Claude Code's own session list shows this name too." For a live session the line reads "Claude Code shows this name after the session ends." Enter saves through `rename`.
- **SESS-75.** "Edit note" opens a dialog with a multi-line field. Ctrl+Enter saves through `setNote`.
- **SESS-76.** "Delete" opens a confirmation: "Move <n> session(s) to the Recycle Bin?" and "Their transcripts, HSOS's backup copies and notes go to the Recycle Bin. Restore them from there if you change your mind." Live sessions in the selection are listed under "Still running, will be skipped:". The buttons are "Move to Recycle Bin" (danger tone) and "Cancel", which has focus. After `trash`, a toast says "<n> moved to the Recycle Bin", and each failure shows as a line in the toast.
- **SESS-77.** The reader (SESS-50) header gains "Rename" and "Edit note", which open the same dialogs.

## Settings section

| Key | Type | Default |
|---|---|---|
| `autoResume` | `always`, `ask` or `never` | `always` |
| `backupTranscripts` | boolean | `true` |

## Commands

| Id | Title | Default key |
|---|---|---|
| `sessions.find` | Find Claude Session | `Ctrl+Shift+R` |
| `sessions.history` | Show Session History | none |

## States

| Part | Loading | Empty | Error |
|---|---|---|---|
| Picker | skeleton rows | "No Claude sessions in this project yet." | "Sessions could not be read." with "Retry" |
| History | skeleton rows | "No Claude sessions found." or, when filtering, "No session matches." | "Sessions could not be read." with "Retry" |
| Reader | skeleton lines | "This session has no messages yet." | "The transcript could not be read." with the reason |

## Tests

| Rule | Level | Given | When | Then |
|---|---|---|---|---|
| SESS-1 | integration | the reference wrapper loaded by the TERM-7 loader in `powershell.exe`, a stub `claude.cmd` first on `PATH` that prints its arguments, a temp launch folder | `claude "fix the bug"` | the stub's arguments end with `--session-id <uuid> "fix the bug"`; one launch file holds the same `sessionId`, `args` `["fix the bug"]` and no `.tmp` remains |
| SESS-1 | integration | the same | `claude --resume=<uuid>`, `claude -c`, `claude -p hi`, `claude doctor` | launch files with that `resumeId` and with `continue: true`; none for the last two; the stub received `doctor` alone |
| SESS-1 | integration | the same | `claude hello` | the arguments start with `--plugin-dir`, and `hello` is the last argument |
| SESS-6 | integration | fake clock; a running record | 5 `UserPromptSubmit` hooks within 1 s, then `SessionEnd` | the record file was written once for the prompts, and again before the `SessionEnd` handler finished |
| SESS-2 | integration | fake clock; a valid launch file, an invalid one, and a `.tmp` file 2 minutes old | 2 s pass | a record exists for the valid one; the invalid one is in `launches\invalid\`; the `.tmp` file is gone |
| SESS-3 | integration | a launch with `resumeId` of an `interrupted` record and a new `terminalId` | it is applied | the record is `running` with that terminal and `boundAt` |
| SESS-5 | integration | a record file of invalid JSON | the service starts | it is renamed `.invalid-*`; the other records load |
| SESS-10 | integration | `FakeClaude` posts `SessionStart` with source `clear`, a new `session_id` and terminal `t1`, whose old session was bound earlier | the hook is handled | the new record is `running` and is `t1`'s session (SESS-11) |
| SESS-11 | integration | two records bound to `t1` at 10:00 and 10:05 | `getResumeOffer({ terminalId: t1 })` | the offer is for the 10:05 one |
| SESS-11 | integration | a fake writer that records file writes | `bind` | the record file was written before the reply was sent |
| SESS-12 | integration | a running record | `SessionEnd` with reason `prompt_input_exit` | `state: 'ended'`; `getResumeOffer` for its terminal returns null |
| SESS-13 | integration | a running record | `SessionEnd` with reason `other` | `state: 'interrupted'` |
| SESS-13 | integration | a running record bound to `t1`, `t1` not live | `getResumeOffer({ terminalId: t1 })` | an offer; the record file says `interrupted`, `lost-terminal` |
| SESS-14 | integration | a record with an empty title | `UserPromptSubmit` with a 200-character prompt | `title` is its first 80 characters |
| SESS-15 | integration | `SessionStart` with `transcript_path` `C:\Windows\win.ini` | the hook is handled, then `Stop` | `transcriptPath` is null and no backup file exists |
| SESS-20 | integration | a 1 000-byte transcript backed up, then 500 bytes appended | `Stop` | the backup equals the transcript and `backupBytes` is 1 500 |
| SESS-20 | integration | a backup of 1 500 bytes; the transcript rewritten to 300 bytes | `Stop` | the backup equals the 300-byte transcript |
| SESS-21 | integration | a transcript with two `ai-title` lines | it is backed up | `title` is the second one |
| SESS-22 | integration | a backup and no original | `restoreTranscript` | the original exists with the backup's bytes |
| SESS-22 | integration | a backup and an original | `restoreTranscript` | `BAD_REQUEST`; the original is unchanged |
| SESS-41 | component | `autoResume: 'always'`, an offer for `t1` titled `fix login` | `offerFor(t1)` | label `Resume Claude session "fix login"`, `auto: true`, launch `claude --resume <id>` |
| SESS-41 | component | `autoResume: 'never'` | `offerFor(t1)` | null, and `getResumeOffer` was not called |
| SESS-42 | component | an offer with `hasOriginal: false` | `accepted('t2')` | `restoreTranscript` was called before `bind({ terminalId: 't2' })` |
| SESS-43 | integration | a `running` record bound to `t1`, with `t1` in `liveTerminalIds` | `list` | the item has `liveTerminalId: 't1'` |
| SESS-30 | integration | a temp home with three transcripts in the project's encoded folder, one with a `cwd` outside the project, and one record whose original is gone but backup exists | `list` | three items: the two inside, and the record marked `hasOriginal: false, hasBackup: true` |
| SESS-30 | unit | a transcript with meta lines, a `<command-name>` line, then the prompt `fix login` | its title is computed with no `ai-title` | `fix login` |
| SESS-31 | component | rows titled `fix login flow`, `write tests` | typing `flow fix` | only the first row shows |
| SESS-32 | component | a row with `liveTerminalId` | the picker renders | the actions are "Go to terminal" and "Open transcript" only |
| SESS-32 | component | a row without one, the focused terminal at state `running` | the picker renders | "Resume here" is disabled |
| SESS-32 | component | "Resume in new terminal" | it runs | in order: `terminal.create` with `launch: null`, `bind`, `terminal.write` of `claude --resume <id>\r` |
| SESS-50 | integration | a transcript with a user prompt, a meta line, an assistant reply with thinking, text and a `Bash` tool call, and a tool result | `readTranscript` | items `user`, `assistant` (the text only), `tool` `Bash` |
| SESS-23 | integration | all `sessions` tests except SESS-62 | they finish | no file under `records\` or `transcripts\` was deleted |
| SESS-30 | integration | a temp home with transcripts in two project folders and a `memory\` folder | `list({ projectPath: null })` | items from both folders; nothing from `memory\` |
| SESS-30 | unit | a transcript with an `ai-title` line and later a `custom-title` line | its title is computed | the `customTitle` |
| SESS-60 | integration | an `untracked` session | `setNote` | a record exists with `endReason: 'untracked'` and the note |
| SESS-61 | integration | an ended session whose transcript does not end in a line break | `rename` to `login fix` | the transcript's last line parses as `{ type: 'custom-title', customTitle: 'login fix', sessionId }`, every earlier byte is unchanged, and the backup ends with the same line |
| SESS-61 | integration | a running session with a live terminal | `rename`, then `SessionEnd` with reason `other` | no line was appended before the `SessionEnd`; one after; `pendingTitleLine` is false |
| SESS-61 | unit | the title `"  a<BEL>b  "`, then 81 characters | `rename` | `ab`; then `BAD_REQUEST` |
| SESS-62 | integration | a fake `shell.trashItem`, a session with its `.jsonl`, its folder, a backup and a record, a second session that is live, and a `memory\` folder | `trash` with both ids | exactly the first session's four paths were trashed, in order; the second is in `failed` with "Running in a terminal. End it first."; `removed` carried only the first |
| SESS-62 | unit | the path check | `…\projects\p\memory`, `…\projects\p\<other id>.jsonl`, `…\projects\<id>.jsonl` | all three refused |
| SESS-62 | integration | a fake `shell.trashItem` that fails on the folder | `trash` of one session | the original was trashed; the backup and record were not; `failed` names the folder |
| SESS-63 | integration | a session | `setNote` with 2 001 characters; then with `a<NUL>b`, a line break, `c` | `BAD_REQUEST`; then the note is `ab`, a line break, `c` |
| SESS-71 | component | rows from two projects with notes | project "All projects", search `deploy` | only rows whose title or note contains `deploy` show, grouped by project |
| SESS-72 | component | five rows | click row 1, Shift-click row 3 | rows 1 to 3 are selected and the toolbar shows "Delete 3" |
| SESS-70 | component | a fake bus | the panel opens, then `removed` fires twice within 200 ms | `list` was called with `projectPath: null`, then once more 500 ms after the second event |
| SESS-73 | component | a selected row | F2, then Delete | the rename dialog opens; then the delete confirmation for that row |
| SESS-75 | component | the note dialog with text | Ctrl+Enter | `setNote` got the text and the dialog closed |
| SESS-77 | component | the reader for a session | "Rename" in its header | the SESS-74 dialog opens for that session |
| SESS-74 | component | a live session | "Rename" | the dialog shows "Claude Code shows this name after the session ends." |
| SESS-76 | component | a selection of two, one live | "Delete" | the dialog lists the live one under "Still running, will be skipped:", "Cancel" has focus, and "Move to Recycle Bin" calls `trash` with both ids |
| SESS-62 | manual | a few old sessions | the owner deletes them in Session History | they are in the Recycle Bin; restoring the `.jsonl` brings the session back in the list |
| SESS-51 | component | an assistant item `<img src=x onerror=alert(1)>` | the reader renders | no `img` element exists |
| SESS-40, REL-13 | fault | a terminal running the waiting stub `claude` through the wrapper, `FakeClaude` posting its `SessionStart` | every HSOS process and the shells are killed with `taskkill /F /T`, then HSOS starts again | the restored terminal shows the resume notice and the stub prints `--resume <the same id>` |
| SESS-40 | manual | a real Claude session with a few messages | the owner closes HSOS from the Task Manager and starts it again | the terminal resumes the same conversation without a prompt being typed |
| SESS-22 | manual | a session's original transcript moved away | the owner chooses "Resume in new terminal" on its "backup only" row | Claude Code opens the restored conversation |
