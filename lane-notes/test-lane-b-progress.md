# Tester lane B progress

Branch test/lane-b. Per section: test file, rule ids covered, skipped and why.

Tooling note: vitest keeps only an element's own CSS-module class (composed classes such as `focusRing` and `lift` are not added), and the ui tests are typechecked without node types. `tests/ui-kit/css-composes.ts` reads the `.module.css` source to check "composes".

## 020 Base components
- tests/ui-kit/base-components.ui.test.tsx (13), tests/ui-kit/no-raw-css.test.ts (3), helper tests/ui-kit/css-composes.ts
- Covered: UI-2 (Button, IconButton, Switch, NumberField, Select, TextField), UI-3, UI-1, P-43 (StatusDot), TextField invalid, Kbd caps.
- Limits: Select arrow keys cannot be driven in jsdom (native select), so the change goes through selectOptions; Tab reach and the focusRing composition are checked. `:focus-visible` is not checked (jsdom).

## 021 Panel frame, lists and trees
- tests/ui-kit/panel-frame.ui.test.tsx (5), list.ui.test.tsx (6), tree.ui.test.tsx (5), panel-parts.ui.test.tsx (4: Tabs, SplitView x2, ProgressBar)
- Covered: P-40, UI-7 (1000 rows < 60 with a stubbed 260 px clientHeight; 150 rows all; 10 000 rows < 100), List keyboard and type-ahead, Tree keyboard/aria, Tabs, SplitView (getBoundingClientRect stubbed to 1000 px), ProgressBar clamp.
- Skipped: none. The "also" rows have no rule id in the spec, so they are prefixed UI-2 (keyboard operation).

## 022 Overlays and icons
- tests/ui-kit/overlays.ui.test.tsx (14); helper additions in tests/ui-kit/css-composes.ts (ruleBody, MOTION)
- Covered: Dialog Escape and focus return, ConfirmDialog focus (danger and not), Toast max 3 / 4000 ms / error stays until Dismiss, SET-15 (stylesheet source read: dialog composes dialogIn; the reduced rule is a fade of motion.quick; jsdom computes no CSS animation), BROW-3 (Dialog and a keyboard-opened dropdown Menu), icons (49 names equal the spec list, 8x8 grids, one rect per #).
- Limits: ConfirmDialog without danger: Cancel is also its first focusable element, so the two focus tests cannot tell the rules apart there; a plain Dialog test shows the first-focusable rule with a text field. Rows with no rule id in the spec are prefixed UI-2 (dialog, toast) or UI-6 (icons, shared pixel set).

## 023 Command palette
- tests/ui-kit/rank-commands.test.ts (5), tests/ui-kit/palette.ui.test.tsx (5)
- Covered: UI-11 (set, term, recency and registration order), UI-10 (list with keys), UI-12, UI-13 (reject and resolve), UI-14 (button and text field).
- Row discrepancy (not a src bug): untested.md says query `set` matches "Restart service" as a subsequence. "restart service" holds s, e but no t after the e, so it is NOT a subsequence of s-e-t and the code rightly drops it. The test uses "Reset tasks" (s, e, t in order, no word starting with "set") as the subsequence case instead. Lead: fix the row in untested.md or the spec example.
- Skipped: F-008 (e2e).

## 024 Settings screen
- tests/settings/settings-screen.ui.test.tsx (12)
- Covered: P-32 invalid JSON text shows the message and saves nothing (shellArgs field), Reset only when changed and sends the default after 400 ms (SET-2), problems banner from getProblems and problemsChanged with Open file, one save 400 ms after the last edit (SET-6), fieldKindOf for boolean, enum, number, path, string.
- Bug: the row "type 400 into the terminal font size" fails: NumberField clamps to the max and saves it. Moved to lane-notes/test-lane-b-bugs.md.
- Skipped: F-009 (e2e). The row text says max 40; the real fontSize max is 32 (tests use that).

## 025 Stage 0 checks
- tests/stage0/packaging.test.ts (5): F-010 electron-builder.yml values (app id, product, NSIS flags, asarUnpack, themes extraResources, npmRebuild) and the 256x256 entry of resources/icon.ico.
- Skipped (e2e, Playwright): REP-7/P-32 corrupted settings launch, F-008 palette, F-007 live theme, SHELL-14 renderer crash, `npm run dist`, and the optional F-005/F-006/F-004 rows.

## 026 Demo backend
- tests/demo/fixtures.test.ts (4), tests/demo/demo-transport.test.ts (6)
- Covered: all hand-written fixtures parse (generateMissing off), every request channel has an entry when on (>= 155 channels), function fixtures answer a mockFromSchema request with a schema-valid response, no-fixture answers INTERNAL "No demo data", 80 ms at random 0 and 400 ms at random 1, everyMs events, parseReplay on terminal-claude.bin and on a truncated record.
- No spec rule ids exist for the Stage U rows, so names start with STAGE-U.
- Skipped: `npm run demo` launch (needs the app).
