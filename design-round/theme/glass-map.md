# Phosphor: theme file and glass map

`phosphor.json` is the Phosphor direction as a `ThemeFile` (`spec/contracts/theme.ts`). Every token in `TOKEN_NAMES` is set. The tokens after `backdrop.fps` are new, and are listed below for the spec author to add to `contracts/theme.ts`.

## Colour roles

One colour has one job. The mockups in `design-round/` follow this table.

| Colour | Hex | Job | Tokens |
|---|---|---|---|
| Neon orange | `#FF7A3D` | Structure: frames, box titles, corner brackets, CLAUDE.md | `color.structure`, `color.border.strong` (the frame is the darker `#B4512A`), `color.graph.node.claudeMd` |
| Phosphor yellow | `#F5FF3B` | Values and focus: the current page, the primary action, the focused terminal, the open note, numbers | `color.accent`, `color.state.warn` |
| Neon red | `#FF003C` | Attention and the brand: HSOS, needs-you, danger, the strawberry | `color.brand`, `color.state.danger` |
| Cyan | `#00F0FF` | Live: running, now, healthy, the clock | `color.live`, `color.state.ok` |
| Lavender | `#C77DFF` | Knowledge: skills, wiki links, plan mode | `color.knowledge`, `color.state.info`, `color.graph.node.skill` |
| Magenta | `#FF00FF` | Memory, used rarely | `color.memory`, `color.graph.node.memory` |

Bars that show a share change colour as they fill: cyan below 60 percent, yellow from 60, red from 85.

## Glass map

Each surface sits over the dust-and-steam background (UI-30, UI-31). Blur is 0 everywhere because the whole window already passes through the CRT barrel filter. A `backdrop-filter` inside a filtered element costs a second full-window pass and does not blur what is under the filter. So depth comes from opacity, the frame, the corner brackets and the glow, not from blur.

| Surface role | Opacity | Blur | Why |
|---|---|---|---|
| `app` | 0 | 0 | The background is the app's face; nothing covers it. |
| `panel` | 0.88 | 0 | Files, HUD boxes and side views: enough to read 19 px text on any part of the field. On Code and Notes page C, the Files list and most HUD parts drop the box and float with a text shadow instead. |
| `widget` | 0.88 | 0 | Dashboard boxes. Free widgets (the graph, the mascot, the quick bar) have no surface. |
| `terminal` | 0.78 | 0 | Code page C: the steam rising from each session's ribbon shows behind the text. The text keeps a 3 px black shadow. |
| `ribbon` | 1 | 0 | The ribbon is a solid raised strip so its values never compete with the steam. |
| `overlay` | 0.97 | 0 | Dialogs, menus and popovers sit over a 62 percent dim and must read at once. |
| reading text (`surface.text.minAlpha`) | 0.74 | 0 | Lowered from Graphite's 0.85 so the terminal and the note can be see-through. See the open point below. |

## New tokens

| Token | Value | Used for |
|---|---|---|
| `color.structure`, `color.structure.deep` | `#FF7A3D`, `#8A2E0E` | Box titles, corner brackets; the deep tone is the 3D lift under buttons |
| `color.brand` | `#FF003C` | The HSOS wordmark and the strawberry |
| `color.live` | `#00F0FF` | Live activity, the clock |
| `color.knowledge`, `color.memory` | `#C77DFF`, `#FF00FF` | Skills and links; memory |
| `font.display`, `font.size.display` | Jersey 10, 46 px | The wordmark, dialog and state titles, note headings |
| `glow.accent`, `glow.danger`, `glow.live`, `glow.structure` | text and box shadows | The phosphor glow on each role |
| `button.lift`, `button.tilt` | stepped pixel edge, 18 degrees | Every button lifts and tilts toward the pointer on hover (MOT-2 in this direction) |
| `crt.barrel`, `crt.scanlines`, `crt.vignette` | 22, 0.22, 0.55 | The old-monitor look: barrel bend in px, scanline darkness, corner darkness |
| `mascot.sheet` | `resources/art/mascot.png` | The sprite sheet of HUD-90, from `design-round/mascot/` |

## Open points for the spec author

- `surface.text.minAlpha` at 0.74 is below Graphite's 0.85. The spec says that value is the floor for reading text (P-45, UI-31), so it needs a decision: lower the floor for this theme, or keep the floor and make the terminal and note 0.85 (less steam behind the text).
- VT323 as `font.mono` puts the terminal in the same pixel face as the UI. It reads well at 19 px. Box-drawing characters and some of Claude Code's symbols fall back to Cascadia Mono, so the spec author should check that fallback inside xterm.
- `size.titlebar` grows from 36 to 56 px to hold the wordmark and clock (round 3 of the Dashboard).
- The CRT barrel filter is an SVG displacement over the whole window. UI-32 caps the background's cost, so the spec author must decide whether the barrel bend stays in the app or moves into the background pass alone.
