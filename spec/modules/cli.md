# Module: cli

## Purpose

Lets Claude use HSOS itself: drive the browser panel, open a file or a diff in front of the owner, find notes in the graph, and read the owner's pinned feedback. Claude reaches it through one shell command, `hsos`, that it runs with its Bash tool. Only sessions started in HSOS terminals have it.

It replaces the MCP server of earlier drafts (JOURNAL step 36). A command costs Claude's context nothing until it is used: the session holds one skill description instead of 20 tool definitions, and the command needs no SDK and no extra protocol.

## Interface

`contracts/channels/cli.ts`. Calls `browser`, `files`, `workspace`, `graph`, `review` and `shell` through their channels. Reference code: `reference/hsos-cli.sh` (the command itself).

- Runs in: `link-service`, sharing the HTTP listener of `claude-link` at the path `/cli`.
- Third-party packages allowed: `zod`.

## How Claude reaches it

Verified with Claude Code 2.1.327 on 2026-11-18: the Bash tool runs Git Bash on Windows with the session's environment; a permission rule `Bash(<prefix> *)` allows commands that start with the prefix; a plugin loaded with `--plugin-dir` contributes skills whose description alone sits in context until the skill is used.

- **CLI-1.** `claude-link` writes `linkDir\bin\hsos`, a byte-for-byte copy of `spec/reference/hsos-cli.sh`, at every launch, and sets `HSOS_BIN_DIR` to `linkDir\bin` (LINK-2). The wrapper puts that folder first on `PATH` (LINK-4). The command reads `HSOS_LINK_PORT`, `HSOS_LINK_TOKEN` and `HSOS_TERMINAL_ID` from its environment and posts its arguments, in order, as form fields `a=<argument>` with `v=1` to `http://127.0.0.1:<port>/cli` through `curl`. It prints the reply. Exit code 0 means done, 1 means HSOS answered with an error, 2 means not in an HSOS terminal or HSOS not reachable. The file must keep LF line endings, since Git Bash fails on CR; `.gitattributes` pins `*.sh` to LF, and the CLI-1 tests run the copy that the build produces.
- **CLI-2.** `claude-link` writes `linkDir\plugin\skills\hsos\SKILL.md` at every launch with this exact content, `<groups>` replaced by the enabled groups joined with `, `:

```markdown
---
name: hsos
description: Use the hsos command in Bash to show the user files, diffs and notes inside HSOS, drive the HSOS browser panel they can see, and read their pinned review feedback. Groups enabled - <groups>.
---

Run `hsos help` for every command, or `hsos help <group>` for one group. Each command prints plain text. A non-zero exit code means it failed and the text says why.

The user sees everything these commands open. They never take focus away from the terminal the user is typing in.
```

- **CLI-3.** `session-settings.json` (LINK-2) holds `"permissions": { "allow": ["Bash(hsos *)"] }`, so the command runs without a permission prompt. This is safe because no command can run a program, write a file, change git or send anything off the machine (CLI-10).
- **CLI-4.** With `enabled` false, `/cli` answers 404, the skill file is not written, and the permission rule is left out.

## Requests

- **CLI-5.** Every request needs the launch token (LINK-10); others get 401 and `CLI_UNAUTHORISED` in the log. The body is `application/x-www-form-urlencoded`, at most 1 MB (413 above). `v` must be `1`; the arguments are every `a` field in order.
- **CLI-6.** Arguments parse as `<group> <command> [positional] [--flag value | --switch]...`. A flag name is kebab-case. A flag given twice keeps the last value. An unknown group, command or flag, or a missing required value, answers 400 with one line saying what was wrong and then that command's usage line. `hsos`, `hsos help` and `hsos help <group>` answer 200 with the usage lines of every enabled command, or of that group.
- **CLI-7.** Each command runs within its own timeout and answers 200 with plain text, or 400 with the `AppError` message when it fails. The server never crashes on a bad request.
- **CLI-8.** Every request records the calling session from the `X-HSOS-Terminal` header when it names a live terminal, and the call appears in the activity of that session as a `tool` event labelled `hsos <group> <command>` (via `claude-link`).
- **CLI-9.** Text replies are at most 20 000 characters, cut with a final line `[truncated]`.

## Commands

Usage lines are part of the contract with Claude: `hsos help` prints them exactly as below, one per line, after a line naming the group.

### browser

| Usage line | Does | Prints |
|---|---|---|
| `hsos browser navigate <url> [--tab <id>]` | BROW-35 and BROW-36 | tab id, URL, title |
| `hsos browser snapshot --tab <id>` | BROW-31 | the tree as indented text: `- button "Save" [ref=e12]` |
| `hsos browser click --tab <id> --ref <ref>` | BROW-32 | `Clicked` |
| `hsos browser type --tab <id> --ref <ref> --text <text> [--submit]` | BROW-33 | `Typed` |
| `hsos browser press-key --tab <id> --key <key>` | BROW-34 | `Pressed` |
| `hsos browser screenshot --tab <id> [--full-page]` | BROW-37; the PNG is saved as `linkDir\shots\<time>-<tab>.png` | the absolute path of the PNG, for Claude to open with its Read tool |
| `hsos browser console --tab <id> [--only-errors]` | BROW-38 | one line per entry |
| `hsos browser network --tab <id> [--only-failed]` | BROW-38 | one line per entry: `GET 404 /api/x 12ms` |
| `hsos browser wait-for --tab <id> --text <text> [--timeout-ms <n>]` | waits until the text appears, default 10 000 ms, at most 60 000 | `Found` or `Not found` |
| `hsos browser tabs` | lists tabs | id, URL, title, one per line |
| `hsos browser release --tab <id>` | ends agent control | `Released` |

### workspace

| Usage line | Does |
|---|---|
| `hsos workspace open-file <path> [--line <n>]` | Opens the file in a viewer without taking focus from the terminal. Paths outside the file roots fail (FILE roots). |
| `hsos workspace show-diff <path>` | Opens the diff panel for the file against the last commit. |
| `hsos workspace reveal-in-tree <path>` | Selects the file in the Files view. |
| `hsos workspace notify <message>` | Shows a toast in HSOS, and a Windows notification when HSOS is not focused. At most 200 characters. At most one per 30 seconds per session; more print `Skipped: too frequent`. |
| `hsos workspace list-panels` | Lists open panels: type, title, and the path or URL they show. |

### graph

| Usage line | Does |
|---|---|
| `hsos graph search <query> [--limit <n>]` | `graph.search`; prints label, kind and path per line |
| `hsos graph backlinks <path>` | `graph.backlinks`; prints note and line context per line |
| `hsos graph focus <path>` | Opens the graph view and selects that node, for the user to see |

### review

| Usage line | Does |
|---|---|
| `hsos review comments` | Prints `review.composePrompt`, so Claude can read the owner's pinned feedback when asked. It does not clear it. |

A relative `<path>` is resolved against the calling terminal's current folder (TERM-70), else the open project's folder.

## Behaviour rules for all commands

- **CLI-10.** No command runs a program, writes a file other than its own screenshots, sends a message outside the machine, or changes git. Commands show things to the owner, read HSOS state, or drive the browser panel under BROW rules. Writing files is Claude Code's own job, under its own permissions.
- **CLI-11.** No command takes focus away from the terminal the owner is typing in (P-44). Panels open in the background tab of their group.
- **CLI-12.** Screenshots older than 24 hours are deleted from `linkDir\shots` at start. They are HSOS's own files, not the owner's (P-1 does not apply).

## Settings section

| Key | Type | Default |
|---|---|---|
| `enabled` | boolean | `true` |
| `groups` | list of `browser`, `workspace`, `graph`, `review` | all four |

## Tests

| Rule | Level | Given | When | Then |
|---|---|---|---|---|
| CLI-1 | integration | Git Bash, the reference `hsos` on `PATH`, a local test server that echoes its form fields | `hsos browser type --text 'a "q" & $HOME = é;|' --submit` | the server received `v=1` and the five arguments unchanged, in order, as UTF-8; exit code 0 |
| CLI-1 | integration | the same, the server answering 400 `Usage: …` | any call | the text is printed and the exit code is 1 |
| CLI-1 | integration | no server on the port; then `HSOS_LINK_TOKEN` unset | any call | exit code 2 with `HSOS is not reachable`; then exit code 2 with `works only inside an HSOS terminal` |
| CLI-2 | integration | `groups: ['graph', 'review']` | the service starts | the skill file equals the CLI-2 text with `graph, review` |
| CLI-3 | integration | the service starts | `session-settings.json` is read | it parses and its `permissions.allow` is exactly `["Bash(hsos *)"]` |
| CLI-4 | integration | `enabled: false` | a request with the token | 404; no skill file; no permission rule |
| CLI-5 | integration | the server running | a request without the token | 401 |
| CLI-6 | unit | the parser | `browser click --tab t1` | 400 naming the missing `--ref`, then the usage line of `click` |
| CLI-6 | integration | `groups: ['graph']` | `help` | the three graph usage lines only |
| CLI-7 | integration | `browser click` with a stale ref | it is called | 400 with "Take a new snapshot." |
| CLI-8 | integration | a request with `X-HSOS-Terminal` of a live terminal running a session | `graph search notes` | that session's events gain a `tool` event `hsos graph search` |
| CLI-9 | unit | a 50 000 character result | it is returned | 20 000 characters plus `[truncated]` |
| CLI-10 | unit | the command table | each handler is run in a test with a recording fake bus | no handler calls a channel outside the allowed list: browser agent channels, `files.read`, `workspace` open requests, `graph`, `review.composePrompt`, `shell.notify` |
| CLI-11 | e2e | a focused terminal | `hsos workspace open-file` is called | the viewer opens and the terminal still has focus |
| CLI-12 | integration | fake clock; two screenshots 2 days and 1 hour old | the service starts | only the newer one remains |
| notify | integration | fake clock | two `workspace notify` calls 5 seconds apart from one session | the second prints `Skipped: too frequent` |
| end to end | manual, run by the owner only, because it spends usage | Claude Code installed, a test project and a local test page | in an HSOS terminal, the owner asks Claude to open the page with `hsos` and report its heading | Claude runs `hsos browser navigate` without a permission prompt, the browser panel shows the page, and the reply contains the heading |
