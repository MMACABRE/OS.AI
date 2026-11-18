# Testing

## Levels

| Level | Tool | Runs | Covers |
|---|---|---|---|
| Unit | vitest | in Node, no Electron | Pure logic: parsers, reducers, schema checks, planners |
| Integration | vitest | in Node with real temp folders, real SQLite, real git | A module's service through its bus handlers |
| Component | vitest with jsdom | in Node | A panel's four states and its keyboard behaviour, against a fake bus |
| End-to-end | Playwright driving the built Electron app | real app | One flow per feature in `features.json` |
| Fault | Playwright plus process kills | real app | The reliability rules |
| Property | fast-check inside vitest | in Node | Invariants over random action sequences |
| Soak | script, stage 6 | real app, 2 hours | Memory, handles, dropped frames |

## Rules

- **TEST-1.** Every behaviour rule in a module spec has at least one test whose name starts with the rule id, for example `it('FILE-21 refuses to save when the file changed on disk', ...)`.
- **TEST-2.** Tests cross the same seam callers cross. A service is tested through its bus handlers with a real temp folder. A panel is tested through the rendered DOM with a fake bus. Private functions are not tested directly, except pure parsers.
- **TEST-3.** Prefer real things: real file system in a temp folder, real SQLite file, real `git` in a temp repo. Fakes exist only for the bus, the clock, the PTY and Claude Code.
- **TEST-4.** No test sleeps for a fixed time. Tests wait for a condition with a timeout, or use the fake clock.
- **TEST-5.** Each test creates and removes its own temp folder. Tests run in any order and in parallel.
- **TEST-6.** A test that fails once and passes on retry is a bug. Retries are off.
- **TEST-7.** Assertions check outcomes (file content, returned value, visible text), never which internal function was called.

## Fakes

Kept in `tests/fakes/`, each implementing a contract.

| Fake | Replaces | Behaviour |
|---|---|---|
| `FakeBus` | the bus | Routes `req` to registered handlers in-process; records events |
| `FakeClock` | `Clock` contract | Time moves only when the test advances it |
| `FakePty` | `PtyProcess` contract | Echoes scripted output; records input and resize |
| `FakeClaude` | Claude Code | A script that posts hook events and statusline JSON from fixture files to the real link service |

`FakeClaude` fixtures live in `tests/fixtures/claude/` and are copied from the documented examples of hook input and statusline input.

## Test table format

Each module spec ends with a test table. The implementer turns each row into one test.

| Column | Meaning |
|---|---|
| Rule | The rule id the test proves |
| Level | unit, integration, component, e2e, fault, property |
| Given | Starting state |
| When | The single action |
| Then | The observable outcome |

## Reliability bar (stage 6)

HSOS is trusted as a daily working environment only when all of these pass.

| Id | Fault test | Passes when |
|---|---|---|
| REL-1 | Kill the renderer while 3 shells print output | Window reloads in under 3 s; all 3 terminals reattach; no output lost beyond the ring buffer size |
| REL-2 | Kill `workspace-service` during a save | The file holds either the full old content or the full new content |
| REL-3 | Kill `workspace-service` during a snapshot | History index opens; no snapshot points to a missing object |
| REL-4 | Kill `pty-host` | Terminals show "shell ended" with a restart button; the rest of the app works |
| REL-5 | Kill `link-service` while Claude posts hooks | Claude Code is not slowed or blocked; the HUD recovers within 5 s of restart |
| REL-6 | Kill the whole app with unsaved editor text | On next launch the text is restored as unsaved |
| REL-7 | Corrupt `settings.json` | App starts with defaults, names the error, leaves the bad file untouched and restorable |
| REL-8 | Change a file on disk while it is open and edited | Save is refused; a diff is offered; nothing is overwritten |
| REL-9 | Delete from the tree | The item is in the Recycle Bin |
| REL-10 | Fill the disk during a save (simulated write error) | The original file is intact; the owner sees the error |
| REL-11 | 2-hour soak: 4 terminals with periodic heavy output, file churn of 10 writes per second, HUD events | Memory growth under 10 percent after the first 10 minutes; no handle growth; no process restarts |
| REL-12 | Property test: random sequences of edit, external change, save, restore, kill | The last content the owner was told is saved is always recoverable from disk or history |
| REL-13 | Simulated power cut: kill every HSOS process and every shell at once while a Claude session runs (stub `claude`) | After relaunch the terminal types `claude --resume` with the same session id |

The performance budgets of `02-architecture.md` §10 are measured on the owner's machine, the reference machine, by card 104.

## Tests that spend usage

No automated test starts the real Claude Code with a prompt. Tests use `FakeClaude` and a stub `claude` executable. Checks that need real Claude Code are listed as "manual" in module test tables and are run by the owner.

## What is not tested

- Third-party libraries' own behaviour.
- Visual pixel equality. Looks are checked against `design/` by the owner.
