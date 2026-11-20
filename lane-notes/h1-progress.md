# Lane H1 progress

Branch lane-h1, worktree C:\Users\H.2\Desktop\OS.AI-lane-h1. Task: fix the open src bugs in untested.md and re-add their tests.

## Items (one commit each)

- UI-MENU-1: done. IconButton forwards ref and props (forwardRef, rest spread, lift handlers composed with Radix handlers). Test added to tests/ui-kit/menu-trigger.ui.test.tsx (new describe at end). Commit 2d6f386.
- HUD-1, HUD-34, HUD-37: tests re-added to tests/hud/hud.ui.test.tsx (new imports and new it blocks only). Fixed by UI-MENU-1, no src change. Commit 38fe933.
- HUD-65: done. QuickBar compact dialog initialFocus selector '[data-hud-cancel] button' (as clear dialog). Commit aa006a3.
- FILE-61 / FILE-43: done. FilesTree subscribes to files.rescanNeeded and reloads the root and every known folder. Test failed without the fix (expected 1 to be 2), passes with it. Commit 62e9002.
- HIST-41: done. diff-rows linesOf(): empty text has no lines. Commit 9e8a95d.
- REV-21 / REV-22: done. Owner decision applied: F7 and Shift+F7 step per hunk (run of changed rows). Replaced line = one stop. DiffView changed list now holds hunk starts. Commit df85859.
- WS-44: done. AppFrame applies project; when null it calls usePageStore show('dashboard'), both on initial getCurrentProject and projectChanged. Test added at start of 'welcome on the Dashboard' describe. Commit 24b9e41.
- SET-6: done. Owner decision applied: reject, no clamp. NumberField gets clampTyped (default true, keeps ui-kit UI-2 'clamps a typed value' test green) and invalidMessage (role alert, aria-invalid). SchemaControl number branch passes clampTyped={false} and invalidMessage. Test added to tests/settings/settings-screen.ui.test.tsx. Commit b5ad3e1.

## Choices

- SET-6: kept NumberField clamping as default because the existing ui-kit test UI-2 'clamps a typed value to max on Enter' must not change. The reject behaviour is opt-in via clampTyped={false} from the settings control only.
- REV-21: hunk = contiguous run of non-same rows; stop is on its first row (the removed row when there is one).
- WS-44: switch to dashboard uses show() (no view transition), set when project is null.
- Existing test lines were never changed; new imports added as new lines.

## Left / notes for Lead

- lane-notes/test-lane-b-bugs.md and test-lane-c-bugs.md still exist; every bug in them now has a passing test. Lead deletes them per handoff.
- untested.md not edited (Lead owns it). Its "Open bugs" section can be cleared by the Lead.
- commit blocked several times by tests/files/parcel-file-watcher.test.ts (known flaky); retried until pass.
- NumberField.tsx: the wrapper span nesting was added without re-indenting the inner JSX (not prettier-formatted; existing file, so not run).
