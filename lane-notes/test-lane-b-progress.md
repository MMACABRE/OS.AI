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

## 027 Motion, glass and the background
- tests/ui-kit/motion.ui.test.tsx (9), backdrop.ui.test.tsx (10), phosphor-dust.test.ts (1), surface.test.ts (3), apply-theme.ui.test.tsx (3), tests/lint/no-layout-animation.test.ts (3)
- Covered: MOT-1, MOT-2, MOT-3, MOT-4, MOT-8, MOT-12, UI-30, UI-31, UI-33 (aria, one pointer + one puff, no puff on a button or after a drag, no canvas listener), UI-34 (overlay rules read from the stylesheet, no url( filter, phosphor-dust 300 frames under brightnessLimit), UI-35 (jsdom has no layout, so getClientRects is stubbed: a box unless the element or an ancestor is display none), applyTheme raised alpha, SET-13, SET-15 applyMotion.
- jsdom limits: CSS-module rules are not computed, so animation, pointer-events and composes rows read the stylesheet source (tests/ui-kit/css-composes.ts). MOT-4 checks dialog and dim compose dialogIn and dimIn and that the animation uses motion.slow.
- Skipped: UI-32 (worker draws nothing while hidden, one frame under reduced; needs the app, e2e).

## 028 App frame and pages
- tests/workspace/pages.ui.test.tsx (18)
- Covered: WS-40 (Ctrl+3 through the real key dispatcher and the real workspace commands, focus in data-hsos-terminal; pageBeside; switcher), MOT-5 (startViewTransition stubbed, called once, update runs at once), WS-41, WS-43 (dock of the visible page), WS-45 (jsdom does not blur an inert page, so the test blurs by hand), WS-11, WS-13 (the broken panel's tab is activated by hand to see its error state), UI-30 (same canvas node over two page changes), GIT-14 repoName, repo button present/absent, side tabs order with Settings last.
- Skipped (e2e, tests/e2e/demo-pages.e2e.ts): MOT-5 timing of the Dashboard after motion.page, MOT-7 backdropStats frames never go down, MOT-11 key during transition, WS-41 3 s demo run.

## 029 Terminal panel, ribbon and mascot
- tests/terminal/header-slot.ui.test.tsx (7), tests/terminal/xterm-fakes.ts (helper: fake Terminal, fake FitAddon, throwing WebglAddon, a ResizeObserver that tests fire by hand), tests/hud/ribbon.ui.test.tsx (15), tests/hud/mascot.ui.test.tsx (11), tests/hud/mascot-placeholder.ui.test.tsx (3), tests/hud/hud-fixtures.ts (helper)
- Covered: TERM-75 (heights 28 then 64 through onHeightChange; first-null contribution; a terminal.resize follows each height change in the real panel), TERM-76 (alpha 0.9 and 0.3 raised to 0.78, allowTransparency), TERM-52 (WebGL throws, log warn), HUD-80 (ribbon shown/absent, steam source colour live then brand, source leaves on unmount), HUD-81 (part order, tone warn/danger/ok), HUD-82 (3 rows, 30 s one with done, 90 s one gone, empty line), HUD-83 (roll spans only on the changed digit), HUD-90 (state table, three pages, four activities), HUD-91 (turn row 5 for 3 frames at 12 fps then row 1; placeholder sheet, one report), HUD-92 (5 minis and +2), HUD-93 (reduced motion frame 0 after 2 s, aria-hidden), frameAt (from 4, hold frame 0), shortFolder, sessionForTerminal, elapsedSince, listedAgents.
- The placeholder test is in its own file because the sheet is loaded when Mascot.tsx is imported, so it needs a file-level vi.mock of loadMascotSheet.
- Skipped: none.

## Owner amendments 2026-11-19
- tests/hud/hud-panel.ui.test.tsx (2): OWNER-1.
- tests/terminal/terminal-panel.ui.test.tsx (7): OWNER-2a (14, fontSizeDelta 1, resize, default prevented), OWNER-2b (32 up and 8 down stay, no setState), OWNER-2c (no Ctrl: unchanged, not prevented), OWNER-2d (delta 3 on 13 opens at 16; clamp at 32).
- Skipped: none.

## General notes for the Lead
- Existing test tests/files/parcel-file-watcher.test.ts (card 004) is flaky when the machine is busy: it fails with "no matching change; saw []" inside its 2 s window in the full run, and passes alone. It blocked several of this lane's commits until a retry got through. It is not changed here.
- Prettier was run only over new files; committed test files were never reformatted (the guard rejects changed lines).
- The 029 row text says "t1 shows a ribbon"; the real ids are 12-character terminal ids, so tests use terminal-001 and terminal-002.
- Rows with no rule id in the spec use the nearest id (UI-2 for keyboard and dialog rows, UI-6 for the icon set, STAGE-U for the demo backend).
