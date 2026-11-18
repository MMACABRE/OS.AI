# Motion

Motion is a hard rule of HSOS (P-42). Every widget, button, panel and page change moves. It shows where things come from and where they go, and it makes the app feel alive. This file holds for every visual direction; a direction picks the character of the motion within these limits, never whether there is motion.

## Tokens

| Token | Value | Used for |
|---|---|---|
| `motion.instant` | 80 ms | Hover, press feedback |
| `motion.quick` | 120 ms | Tooltips, menus, tab switch, toggles |
| `motion.normal` | 180 ms | Panels and sections opening, list items entering |
| `motion.slow` | 260 ms | Dialogs, the palette, widget resize settling |
| `motion.page` | 420 ms | Page transitions, dashboard screen swipes |
| `motion.ease.out` | `cubic-bezier(0.2, 0, 0, 1)` | Things entering |
| `motion.ease.in` | `cubic-bezier(0.4, 0, 1, 1)` | Things leaving |
| `motion.ease.spring` | `cubic-bezier(0.34, 1.4, 0.64, 1)` | Things that land: widgets snapping, buttons released, the mascot |

Values are theme tokens. A theme may change them within these bounds: `instant` 60 to 100, `quick` 100 to 160, `normal` 140 to 240, `slow` 200 to 320, `page` 300 to 520. Out-of-range values are clamped and reported (SET-14).

## Rules

- **MOT-1.** Only `opacity`, `transform`, `filter` and `clip-path` animate. Layout properties (width, height, top, left, margin, padding) never animate; a size change is shown with `transform` and the final layout is applied at once.
- **MOT-2.** Buttons, pressable rows and other controls: hover lifts them over `motion.instant`: up 2 to 3 px, tilted toward the pointer by up to `button.tilt` (rows wider than 200 px by half), brighter, with the stepped edge `button.lift` below. Press sinks 1 px and scales to 0.96 over `motion.instant`, dropping the edge and flashing brighter, and springs back with `motion.ease.spring` over `motion.quick` on release. A toggle's thumb slides with `motion.ease.spring`. Under reduced motion only the brightness changes.
- **MOT-3.** Entering things fade in and move 8 px from the side they come from, over `motion.normal`. Lists enter with a stagger of 20 ms per item, at most 8 items staggered. Leaving things fade out and move 4 px, over `motion.quick`.
- **MOT-4.** Menus, tooltips and popovers scale from 0.96 at their anchor with a fade. Dialogs scale from 0.94 and fade, over `motion.slow`, and the content behind them dims.
- **MOT-5.** Page transitions use the browser's View Transitions API (`document.startViewTransition`). The leaving page slides and fades toward the side of the page switcher it is leaving to, the entering page comes from the other side, over `motion.page`. Elements that exist on both pages carry the same `view-transition-name` and move between their two places instead of fading (MOT-6).
- **MOT-6.** Shared elements across pages:
  - a session widget on the Dashboard and that session's terminal panel on the Code page;
  - the Notes widget's mini graph and the graph on the Notes page;
  - the mascot in the Dashboard's ribbon widget and the mascot in the terminal ribbon of the same session;
  - the page switcher's active marker.
- **MOT-7.** The background layer (UI-30) is never part of a transition. It keeps running under every page, so a page change never restarts it.
- **MOT-8.** Values that change in place roll: each changed digit slides up and out while the new one slides in, over `motion.quick`, using tabular figures. Bars change length with `transform: scaleX` over `motion.normal`.
- **MOT-9.** Attention: a session that starts needing the owner pulses its dot 3 times over 1 200 ms, then holds. Nothing loops forever except the background and the mascot.
- **MOT-10.** Terminal text never animates. The terminal's rows, cursor and scrolling stay exactly as xterm draws them.
- **MOT-11.** A transition starts within one frame of the action and never blocks input: a key press during a transition goes to its target at once, and a second page change during a transition skips the first to its end.
- **MOT-12.** With Windows "Animation effects" off (`prefers-reduced-motion: reduce`), or with the setting `reduceMotion` at `on`: every movement becomes a fade of at most `motion.quick`, the background shows one still frame, and the mascot shows its first frame of each state. `reduceMotion` is `system` (default), `on` or `off`; `off` ignores the Windows setting (SET-15).

## Tests

| Rule | Level | Given | When | Then |
|---|---|---|---|---|
| MOT-1 | unit | the lint rule over `src/**/*.module.css` | a `transition` or `@keyframes` naming `width` | lint fails |
| MOT-2 | component | a `Button` | pointer down, then up | its transform reaches `scale(0.96)`, then returns through the spring easing |
| MOT-2 | component | a `Button`, pointer entering at its right edge | hover | it moves up at least 2 px and rotates toward the right by at most `button.tilt`; its box shadow is `button.lift` |
| MOT-3 | component | a list of 12 items entering | it renders | the first 8 have delays 0 to 140 ms; the rest have 140 ms |
| MOT-4 | component | a `Dialog` | it opens | it starts at `scale(0.94)` and opacity 0 and ends at `scale(1)` and opacity 1 over `motion.slow`, and the content behind it dims |
| MOT-9 | component | fake clock; a session becomes `needs-you` | 2 000 ms pass | its dot pulsed 3 times and is still |
| MOT-5 | e2e | the Code page | `Ctrl+1` | `startViewTransition` ran once; the Dashboard is shown after `motion.page` |
| MOT-6 | e2e | a session widget on the Dashboard | it is activated | the widget and the terminal panel share one `view-transition-name` during the transition |
| MOT-7 | e2e | the background running | three page changes | the background canvas element is the same node throughout and its frame counter never reset |
| MOT-8 | component | a percentage changes from 41 to 42 | it renders | only the last digit animates |
| MOT-10 | component | a terminal panel | any transition over the page | the xterm element has no animation or transition applied |
| MOT-11 | e2e | a page transition in progress | a key press in the terminal | the shell receives it before the transition ends |
| MOT-12 | component | `prefers-reduced-motion: reduce`, `reduceMotion: system` | a dialog opens | it only fades, for at most `motion.quick` |
| MOT-12 | component | the same with `reduceMotion: off` | a dialog opens | it scales as MOT-4 says |
