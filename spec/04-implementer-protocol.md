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
3. Find the lowest-numbered card that `PROGRESS.md` does not list with `Status: done`. Cards live in `tasks/stage-<n>.md`, one `## <number> <name>` section each, numbered across all stages from 001.
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
Status: done | blocked
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
- **Files.** The exact list to create or change. Six at most, not counting test files. Card 001 is the one exception, because it creates the project's configuration.
- **Steps.** Numbered. Each step names the function or component to write and the rules it implements.
- **Tests.** The test files to create and the rule ids each covers.
- **Done when.** Commands that must pass and the feature ids that flip.
- **Commit.** The exact commit message.

## Hard rules

- One task per session. One commit per task.
- Tests first. Code second.
- Copy code in `spec/reference/` exactly. It is finished.
- Copy types from `@hsos/contracts`. Never retype a contract inside a module.
- Every value a user can see or feel comes from a token or a setting.
- Leave every file outside the card's list untouched, even to fix something that looks wrong. Report it in `Deviations`.
