# Visual direction: Graphite

## The idea

HSOS looks like a precision instrument, not a web page. The terminal is the subject. Everything else is quiet metal around it.

- **Dark first.** Warm near-black surfaces. Never pure black, never blue-grey.
- **Lines, not shadows.** Areas are separated by one-pixel hairlines and small steps in surface tone. Shadows appear only under floating things: menus, the palette, dialogs.
- **One signal colour.** Amber marks the one thing that matters now: focus, the active tab, a session that needs the owner. Nothing is amber for decoration.
- **Dense.** Small type, tight rows, no wasted padding. Information the owner checks often is always visible.
- **Two type families.** Geist for the interface, Geist Mono for terminals, code, numbers and file paths.
- **Small radii.** 4 px on controls, 6 px on panels and menus, 8 px on dialogs. Nothing is pill-shaped except status dots.
- **Quiet motion.** Things move only to explain where they came from or went.

## Forbidden

These mark generic generated interfaces. None appears in HSOS.

- Gradients on surfaces, buttons or text.
- Purple, indigo or violet anywhere in the shipped themes.
- Glow, blur or glass effects.
- Radius above 8 px.
- Cards with drop shadows laid out in a grid.
- Emoji as icons.
- Centred hero text or marketing-style empty states.
- More than one accent colour in a view.

## Type

| Role | Family | Size / line height | Weight |
|---|---|---|---|
| Interface text | Geist | 13 / 18 | 400 |
| Interface small (labels, status bar) | Geist | 11 / 14 | 500 |
| Panel title | Geist | 12 / 16, uppercase, letter spacing 0.04em | 600 |
| Dialog title | Geist | 16 / 22 | 600 |
| Code, terminal, paths, numbers | Geist Mono | 13 / 18 | 400 |
| Large number (HUD percentages) | Geist Mono | 20 / 24 | 500 |

- Numbers that change in place use tabular figures.
- Terminal font, size and line height are settings; the values above are defaults.

## Colour roles

Every colour in the app is one of these roles. Values come from the active theme file (`themes/*.json`).

| Token | Role |
|---|---|
| `color.bg.app` | Window background, behind everything |
| `color.bg.panel` | Panel body |
| `color.bg.raised` | Hovered rows, inputs, tab strip |
| `color.bg.overlay` | Menus, palette, dialogs |
| `color.bg.selected` | Selected row |
| `color.border.hairline` | Lines between areas |
| `color.border.strong` | Input borders, dividers that can be dragged |
| `color.text.primary` | Main text |
| `color.text.secondary` | Supporting text |
| `color.text.muted` | Hints, disabled text, timestamps |
| `color.accent` | Focus ring, active marker, primary button |
| `color.accent.text` | Text on an accent background |
| `color.state.ok` | Success, clean, connected |
| `color.state.warn` | Needs attention soon |
| `color.state.danger` | Error, conflict, limit nearly reached |
| `color.state.info` | Neutral activity |
| `color.diff.added.bg`, `color.diff.removed.bg` | Diff line backgrounds |
| `color.term.*` | Terminal foreground, background, cursor, selection and the 16 ANSI colours |
| `color.graph.node.*` | Node colours by kind |

Rules:

- State is never colour alone. Each state colour is paired with an icon shape or a word.
- Text on any background reaches a contrast of 4.5:1. `color.text.muted` is the lowest allowed.
- Usage bars change colour by value: `state.ok` below 60 percent, `state.warn` from 60, `state.danger` from 85. The thresholds are settings.

## Space and size

Spacing uses only these values, in pixels: 2, 4, 6, 8, 12, 16, 20, 24, 32.

| Thing | Size |
|---|---|
| Row height (tree, lists) | 24 |
| Tab height | 30 |
| Title bar | 36 |
| Status bar | 24 |
| Activity rail width | 44 |
| Icon | 16, stroke 1.5 |
| Minimum click target | 24 by 24 |
| Panel inner padding | 8 |
| Hairline | 1 |

Icons are one outlined set, drawn as inline SVG using `currentColor`.

## Motion

| Token | Value | Used for |
|---|---|---|
| `motion.instant` | 80 ms | Hover, press |
| `motion.quick` | 120 ms | Menus, tooltips, tab switch |
| `motion.normal` | 160 ms | Panels opening, sidebar collapse |
| `motion.slow` | 240 ms | Dialogs, the palette |
| `motion.ease.out` | `cubic-bezier(0.2, 0, 0, 1)` | Things entering |
| `motion.ease.in` | `cubic-bezier(0.4, 0, 1, 1)` | Things leaving |

- Only `opacity` and `transform` animate. Never width, height, top or left.
- Entering things fade in and move 4 px. Leaving things fade out without moving.
- A value that updates (a percentage, a count) changes at once, with no count-up animation.
- A session that starts needing the owner pulses its dot once, for 600 ms. It never loops.
- With the system "reduce motion" setting on, every duration becomes 0.

## Focus

- Every focusable thing shows a 2 px ring in `color.accent`, offset 1 px, on keyboard focus only.
- The focused panel's tab has a 2 px accent line on its top edge. Unfocused panels have none.
- A terminal's cursor is solid when focused and an outline when not.

## Shipped themes

| File | Name | For |
|---|---|---|
| `themes/graphite.json` | Graphite | Default, dark |
| `themes/paper.json` | Paper | Light |
| `themes/ink.json` | Ink | High contrast dark |

Graphite gives a value to every token. Any other theme, shipped or written by the owner, may omit tokens; missing ones come from Graphite. Paper and Ink set colours and the overlay shadow only.

## Panel states

Every panel draws these four states (P-40).

| State | Looks like |
|---|---|
| Loading | The panel's normal frame with 3 to 6 skeleton rows in `color.bg.raised`. No spinner. Shown only after 150 ms of waiting. |
| Empty | One line of `text.secondary` saying what would appear here, and one action as a text button. Top-left aligned, not centred. |
| Error | A `state.danger` icon, one sentence saying what failed, a "Retry" button, and a "Show log" link. The rest of the app is unaffected. |
| Ready | The content. |
