# Writing specs a weak model follows

Ticket: "Writing specs a weak model follows". Researched 2026-11-17 in the main session.

Marks: **[V]** checked against the named source today. **[U]** from the researcher's own knowledge, not re-checked.

## Summary

1. A weak model fails on long projects in four known ways: it declares the project done too early, it leaves half-finished work with no notes, it marks features done without testing them, and it wastes time working out how to run the app. Anthropic documents a fix for each. [V]
2. The fixes are files, not advice: a feature list with a pass flag per feature, a progress log, a start script, and a git commit at the end of every session. [V]
3. The feature list should be JSON. The implementer may change only the pass flag. Anthropic found a model is less likely to rewrite JSON than Markdown. [V]
4. One feature per session. Each session starts by reading the progress log and git log, running the start script and a smoke test, then picking the next failing feature. [V]
5. Features must be verified the way a user would use them, with UI automation, not only unit tests. [V]
6. Spec tools such as GitHub Spec Kit use the same shape: principles first, then specification, plan, tasks, implement, and a convergence check. [V]
7. For HSOS the strong model should do everything that needs judgement in advance: interfaces, types, test cases, visual tokens and the hard code. The weak model then fills in bodies until pre-written tests pass.

## Evidence

### Anthropic, "Effective harnesses for long-running agents" [V]

| Failure | Fix prepared up front | What each session does |
|---|---|---|
| Declares the project done too early | A structured feature list, all features failing at the start | Reads the list, picks one feature |
| Leaves bugs or undocumented progress | Git repo and a progress notes file | Reads notes and git log, runs a basic test, ends with a commit and a notes update |
| Marks features done too early | The feature list with test steps | Marks a feature passing only after end-to-end testing |
| Wastes time working out how to run the app | An `init.sh` script | Runs it first |

Quoted rules: "work on only one feature at a time" and "It is unacceptable to remove or edit tests because this could lead to missing or buggy functionality."

### GitHub Spec Kit [V]

Order of commands: constitution, specify, plan, tasks, implement, converge. Implement and converge repeat until convergence passes.

### Warp [V]

Warp's open source repo keeps a `specs/` folder, an `agents/specs/` folder and an `AGENTS.md` with engineering rules. A production desktop app already steers agents with specs kept in the repo.

### The writing-for-agents skill [V, local skill]

- Each step ends on a completion criterion the model can check.
- State the target behaviour, not the forbidden one.
- Keep one meaning in one place.
- Split documents so each session loads only what its task needs.

## Recommended spec format for HSOS

### Files

| File | Purpose | Who may edit |
|---|---|---|
| `CLAUDE.md` | The session loop and the hard rules. Short. Loaded every session. | Spec author |
| `spec/00-principles.md` | Priorities and the rules every module obeys | Spec author |
| `spec/01-capability-map.md` | Modules, dependencies, build order | Spec author |
| `spec/modules/<id>.md` | One module's purpose, interface, behaviour, states, errors | Spec author |
| `spec/contracts/*.ts` | The real TypeScript types and interfaces between modules | Spec author |
| `spec/design/tokens.json` and `spec/design/*.md` | Every colour, size, font, radius and motion value, and screen layouts | Spec author |
| `spec/reference/*` | Finished code for the hardest parts, written by the strong model | Spec author |
| `tasks/<nnn>-<name>.md` | One task card | Spec author |
| `features.json` | Every user-visible feature with test steps and a `passes` flag | Implementer may flip `passes` only |
| `PROGRESS.md` | One entry per session: what was done, what failed, what is next | Implementer appends |
| `scripts/init.ps1` | Installs, builds and starts the app, runs the smoke test | Spec author |

### Module spec template

1. Purpose in two sentences.
2. Interface: the exact exported types and functions, copied from `spec/contracts`.
3. Behaviour: numbered rules, each one testable.
4. States and errors: every state the module can be in and what the user sees.
5. Data on disk: files, formats, where they live.
6. Depends on: module ids only.
7. Tests the module must pass: file names of pre-written tests.
8. Out of scope.

### Task card template

- Goal: one sentence.
- Read first: at most three files.
- Files to create or change: an exact list, five at most.
- Steps: numbered, each with the function signatures to write.
- Done when: the exact commands that must pass, and which `features.json` entries flip to passing.
- Do not touch: the files and folders outside the task.

### Session loop for the implementer

1. Run `scripts/init.ps1`.
2. Read `PROGRESS.md` and the last ten git commits.
3. Open the lowest-numbered task that is not done.
4. Do that one task.
5. Run type check, lint, unit tests and the end-to-end test for the task.
6. If all pass, flip the feature flags, append to `PROGRESS.md`, commit.
7. If anything fails three times, stop, write the failure in `PROGRESS.md`, and end the session.

### Guardrails that catch mistakes without judgement

- TypeScript in strict mode. Contracts are imported, never retyped.
- Lint rules that forbid imports across module boundaries except through the contract.
- Tests written by the spec author before the task exists. The implementer may not edit them.
- End-to-end tests that drive the real app window.
- A git hook that blocks a commit when checks fail or when a protected file changed.
- A walking skeleton as task one: an empty window that builds, tests and packages, so every later task starts from a working app.

## Not settled

- OpenSpec, Kiro and BMAD were not read today.
- No published measurement compares task sizes for Haiku-class models. The five-file limit is a judgement.

## Sources

- https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
- https://github.com/github/spec-kit
- https://github.com/warpdotdev/Warp
- Local skill `mattpocock-skills:writing-for-agents`
