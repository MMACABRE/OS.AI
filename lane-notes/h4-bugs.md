# Lane H4: src bugs found, not fixed

## UI-32 minimised window keeps drawing
- Rule: UI-32 (spec/modules/ui-kit.md). Test: tests/e2e/background.e2e.ts, test.fixme('UI-32: a minimised window ...').
- Src: src/modules/ui-kit/backdrop/backdrop-client.ts (visibility from document.hidden only).
- Failure: Expected 41, Received 86 (frames grew in 2 s while minimised).
- Observed: document.visibilityState stays visible; renderer rAF stops for about 2.7 s then bursts. Needs a main-process minimise signal (contract change).

## SHELL-6 window size drifts at 120 % scale
- Rule: SHELL-6. Test: tests/e2e/window.e2e.ts, test.fixme('SHELL-6: ...').
- Src: src/main/window/main-window.ts (saves getNormalBounds, outer size includes the 1 px frame border).
- Failure: Expected 1100, Received 1105 after one restart.

## Startup terminal restore switches the page
- Src: src/modules/terminal/register.ui.ts (void async block that openPanel's running terminals).
- Observed: switches to Code about 300 ms after start, even after the user pressed Ctrl+1.

## Themes list (not started)
- Src: src/modules/settings/panel/ThemesSection.tsx (lists on mount only); inactive theme name has zero width. Source: h2-bugs.md.

## GRAPH-29, GRAPH-52 (not started)
- Src: src/modules/graph/panel/GraphView.tsx. See h3-bugs.md for the failing test code.

## zAbsPath accepts relative paths
- Src: spec/contracts/schemas.ts line 26. Contract, Lead decides.
