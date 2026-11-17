# Module: diagnostics

## Purpose

Records what every process does and what went wrong, so a fault can be understood after the fact. It never affects the behaviour of the app.

## Interface

`contracts/channels/diagnostics.ts`, and the `Logger` type in `contracts/module.ts`.

- Runs in: `main` (file writing, health), every process (a `Logger` instance).
- Third-party packages allowed: none.

## Behaviour

- **DIAG-1.** Each process writes its own log file `logsDir\<process>.log`, one JSON object per line, matching `LogRecord`. The renderer has no file access; its logger sends `diagnostics.write`.
- **DIAG-2.** A log file rotates when it passes 5 MB: `<process>.log` becomes `<process>.1.log`, up to `.4.log`; the oldest is removed. Log files are HSOS's own data, so removing them does not break P-1.
- **DIAG-3.** Writes are buffered and flushed every 500 ms and on process stop. A write failure is swallowed: logging never throws and never blocks.
- **DIAG-4.** Before a record is written, every string value under a key whose name contains `token`, `secret`, `password`, `authorization` or `cookie` (any letter case) is replaced with `"[redacted]"` (P-8).
- **DIAG-5.** `data` values longer than 2 000 characters are cut to 2 000 and end with `…`.
- **DIAG-6.** Level `debug` is written only when the setting `diagnostics.debug` is true. Default false.
- **DIAG-7.** When the supervisor reports a process death, `diagnostics` writes `crashDir\<time>-<process>.json` with: process name, exit code, time, app version, and the last 200 records of that process.
- **DIAG-8.** Uncaught exceptions and unhandled promise rejections in any process are logged at `error` with the stack, then the process exits with code 70. The supervisor restarts it.
- **DIAG-9.** `getHealth` returns, for each live process, its pid, resident memory in MB and uptime.
- **DIAG-10.** Crash files older than 30 days and beyond the newest 50 are removed at start.

## Settings section

| Key | Type | Default | Meaning |
|---|---|---|---|
| `debug` | boolean | `false` | Write debug-level records |

## UI

- Command `diagnostics.openLogFolder`, "Open log folder".
- Command `diagnostics.showHealth`, "Show process health": a dialog listing `getHealth` rows, refreshed every 2 s while open.

## Tests

| Rule | Level | Given | When | Then |
|---|---|---|---|---|
| DIAG-1 | integration | a temp logs folder | a logger writes 3 records and flushes | the file has 3 lines, each parses as `LogRecord` |
| DIAG-2 | integration | a log file of 5 MB | one more record is flushed | `<process>.1.log` exists and the live file holds only the new record |
| DIAG-3 | integration | the logs folder is made read-only | a record is logged and flushed | no exception; the process continues |
| DIAG-4 | unit | data `{ authToken: 'abc', nested: { Cookie: 'x' }, name: 'ok' }` | redaction runs | both secret values are `[redacted]`; `name` is unchanged |
| DIAG-5 | unit | a 5 000 character string value | truncation runs | length is 2 000 and ends with `…` |
| DIAG-6 | unit | `debug` false | a debug record is logged | nothing is written |
| DIAG-7 | integration | 300 records logged for `pty-host` | a death is reported | a crash file exists with exactly the last 200 records |
| DIAG-10 | integration | 60 crash files, 5 of them 40 days old | cleanup runs | 50 remain and none is older than 30 days |
