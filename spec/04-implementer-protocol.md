# Implementer protocol

This is the loop the implementer runs. One session does one task card.

## Files and who may change them

| Path | Implementer may |
|---|---|
| `spec/**`, `tasks/**`, `GLOSSARY.md`, `docs/**` | read only |
| `features.json` | change a feature's `"passes"` from `false` to `true`, nothing else |
| `PROGRESS.md` | append at the end |
| `tests/**` | create the test files a task names; never weaken or delete an existing assertion |
| `src/**`, `resources/**`, `scripts/**`, config files | create and change, only the files the task lists |

A git pre-commit hook (`scripts/guard.mjs`, created in task 001) rejects a commit that breaks this table or fails `npm run check`.

## Session loop

1. Run `pwsh scripts/init.ps1`. It installs, type checks and runs the smoke test. If it fails, fixing that is the whole session.
2. Read the last entry of `PROGRESS.md` and run `git log --oneline -10`.
3. Find the lowest-numbered card that `PROGRESS.md` does not list with `Status: done`. Cards live in `tasks/stage-<n>.md` and `tasks/stage-u.md`, one `## <number> <name>` section each, numbered across all stages from 001 in build order: stage 0, stage U, then stages 1 to 9. Card 037 is a gate ("Look first").
4. Read the card's "Read first" files. Read nothing else from `spec/` unless the card says so.
5. **Red.** Write the tests the card lists, from the test tables in the module spec. Run them. They must fail for the right reason: the thing under test does not exist yet.
6. **Green.** Write the code. Only the files in the card's list.
7. Run `npm run check`. Then the card's end-to-end test, if it has one.
8. When everything passes:
   - flip the card's features in `features.json`,
   - append an entry to `PROGRESS.md`,
   - commit with the message the card gives.
9. Stop. The next card is a new session.

## When something goes wrong

| Situation | Action |
|---|---|
| A check fails | Read the first error. Fix the cause. Run again. |
| The same check fails after three different fixes | Revert the working tree to the last commit. Append a `blocked` entry to `PROGRESS.md` with the error text and what was tried. Stop. |
| The card needs a file not in its list | Stop. Append a `blocked` entry naming the file and why. |
| The spec contradicts itself or is silent | Stop. Append a `blocked` entry quoting both places. Do not choose. |
| A third-party name in the spec does not exist | Follow `03-stack.md`, "Third-party APIs". Continue. |
| An earlier test now fails | The new code broke it. Fix the new code. Never edit the earlier test. |

## PROGRESS.md entry format

```
## <task number> <task name>
Status: done | blocked | waiting-for-owner
Date: <YYYY-MM-DD>
Did: <one to three sentences>
Checks: typecheck ok, lint ok, deps ok, test <n> passed, e2e <n> passed
Deviations: <none, or each difference from the spec and why>
Next: <next task number>
```

## Task card format

Every card has these parts, in this order. Paths in a card are from the repo root. A path ending in `/` means "files inside this folder that the steps name".

- **Goal.** One sentence.
- **Stage.** The build stage number.
- **Read first.** At most four files, with section numbers.
- **Files.** The exact list to create or change. Six at most, not counting test files. Card 001 is an exception, because it creates the project's configuration, and so are Stage U cards, which may list up to eight entries because each draws several modules' panels.
- **Steps.** Numbered. Each step names the function or component to write and the rules it implements.
- **Tests.** The test files to create and the rule ids each covers.
- **Done when.** Commands that must pass and the feature ids that flip.
- **Commit.** The exact commit message.

## Look first

The owner approves how HSOS looks and moves before any backend is built.

- Stage U (`tasks/stage-u.md`, cards 026 to 037) runs after stage 0 and before stage 1. It builds the panel side of every module on the demo backend (`npm run demo`).
- Card 037 ends with `Status: waiting-for-owner`. Card 038 and every later card start only after `PROGRESS.md` holds `## 037 Owner review of the look` with `Status: done`, written by the owner or by the spec author on the owner's word. Until then, a session that finds no Stage U card left to do writes nothing and stops.
- Panel, widget and `ui-kit` files built in Stage U hold the approved look. A later card that lists one of them may change where its data comes from and what it does, to meet that card's rules. It may not change layout, tokens, sizes, copy or motion. If a rule cannot be met without a visible change, stop with a `blocked` entry naming the rule and the change.
- A test a later card lists that already exists and passes from Stage U stays as it is. Step 5 (red) applies to the listed tests that do not exist yet.
- `npm run demo` keeps working until the end of the project: a card that adds a request channel adds its fixture, and the fixture test (card 026) checks it.

## Hard rules

- One task per session. One commit per task.
- Tests first. Code second.
- Copy code in `spec/reference/` exactly. It is finished.
- Copy types from `@hsos/contracts`. Never retype a contract inside a module.
- Every value a user can see or feel comes from a token or a setting.
- Leave every file outside the card's list untouched, even to fix something that looks wrong. Report it in `Deviations`.
