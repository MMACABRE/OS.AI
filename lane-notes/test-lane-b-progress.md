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
