# Tester lane B progress

Branch test/lane-b. Per section: test file, rule ids covered, skipped and why.

Tooling note: vitest keeps only an element's own CSS-module class (composed classes such as `focusRing` and `lift` are not added), and the ui tests are typechecked without node types. `tests/ui-kit/css-composes.ts` reads the `.module.css` source to check "composes".

## 020 Base components
- tests/ui-kit/base-components.ui.test.tsx (13), tests/ui-kit/no-raw-css.test.ts (3), helper tests/ui-kit/css-composes.ts
- Covered: UI-2 (Button, IconButton, Switch, NumberField, Select, TextField), UI-3, UI-1, P-43 (StatusDot), TextField invalid, Kbd caps.
- Limits: Select arrow keys cannot be driven in jsdom (native select), so the change goes through selectOptions; Tab reach and the focusRing composition are checked. `:focus-visible` is not checked (jsdom).
