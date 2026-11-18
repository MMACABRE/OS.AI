# Visual direction: Phosphor

The owner chose Phosphor in the design round (`direction-brief.md`, JOURNAL step 38). The approved mockups are in `design-round/`: the Dashboard, the Code page (layout C) and the Notes page (layout C with a notes list). Where this file and a mockup disagree, this file wins. Motion follows `motion.md`; the background and glass layering follows UI-30 to UI-34.

## The idea

HSOS looks like an old, large CRT monitor showing a pixel-art machine that is alive. A field of glowing dust and steam moves behind everything. Frames, values and the small strawberry mascot sit in front of it and react to what Claude is doing.

- **One colour per job.** Every colour means one thing, everywhere (table below). A colour never appears for decoration only.
- **Pixel art that feels 3D.** Stepped pixel edges under buttons and boxes, corner brackets, 8 by 8 pixel icons. Everything that can be pressed lifts toward the pointer.
- **Glow, not shadow.** Coloured text and frames carry a soft phosphor glow (`glow.*`). The only drop shadow is the hard pixel offset (`shadow.overlay`, `button.lift`).
- **Open air.** Lists and HUD parts float over the background without a box where they hold no input (Code page and Notes page layout C). Boxes are kept for things that hold an input, a terminal, a note or a Dashboard widget.
- **The terminal is still the subject** of the Code page. It is the largest surface and its text never moves (MOT-10).

## Colour jobs

| Colour | Hex | Job | Tokens |
|---|---|---|---|
| Neon orange | `#FF7A3D` | Structure: box titles, corner brackets, frames, CLAUDE.md in the graph | `color.structure`, `color.border.strong` (`#B4512A`, the frame line), `color.structure.deep` (the lift edge), `color.graph.node.claudeMd` |
| Phosphor yellow | `#F5FF3B` | Values and focus: numbers, the current page, the primary action, the focused terminal, the open note, the selected node | `color.accent`, `color.state.warn` |
| Neon red | `#FF003C` | Attention and the brand: the HSOS wordmark, needs-you, danger, the strawberry | `color.brand`, `color.state.danger` |
| Cyan | `#00F0FF` | Live: running, now, healthy, the clock | `color.live`, `color.state.ok` |
| Lavender | `#C77DFF` | Knowledge: skills, wiki links, plan mode | `color.knowledge`, `color.state.info`, `color.graph.node.skill` |
| Magenta | `#FF00FF` | Memory, used rarely | `color.memory`, `color.graph.node.memory` |

Text is warm off-white (`color.text.primary` `#F2E8DE`), with `text.secondary` and `text.muted` for less. Surfaces are warm near-black, never pure black.

Rules:

- State is never colour alone. Each state colour comes with an icon shape, a blinking status light or a word.
- Text on any surface reaches 4.5:1 against the brightest frame of the background behind it (P-43, P-45). `color.text.muted` is the lowest allowed.
- Bars that show a share change colour as they fill: `state.ok` (cyan) below 60 percent, `state.warn` (yellow) from 60, `state.danger` (red) from 85. The thresholds are settings.
- Glow on text below `font.size.body` is at most the strength of `glow.accent`, so small text stays sharp.

## Type

| Role | Family (token) | Size (token) | Notes |
|---|---|---|---|
| Interface text | VT323 (`font.ui`) | 19 px (`font.size.body`) | |
| Small text: labels, status bar | VT323 | 16 px (`font.size.small`) | |
| Box title | VT323 | 18 px (`font.size.title`), uppercase | in `color.structure` |
| Terminal, code, paths | VT323, falling back to Cascadia Mono (`font.mono`) | 19 px | box-drawing characters and symbols VT323 lacks come from Cascadia Mono |
| Large number | VT323 | 34 px (`font.size.number`) | in `color.accent`, tabular |
| Wordmark, dialog and state titles, note headings | Jersey 10 (`font.display`) | 46 px (`font.size.display`) for the wordmark | |

- VT323 and Jersey 10 are under the SIL Open Font License. They are bundled as files in `resources/fonts/` and loaded from disk (`03-stack.md`), never from the network.
- Numbers that change in place use tabular figures and roll (MOT-8).
- Terminal font, size and line height are settings; the values above are defaults.

## Shape

- Radius: 6 px on controls (`radius.control`), 10 px on boxes and panels (`radius.panel`), 12 px on dialogs (`radius.dialog`).
- A box has a 1 px frame in `color.border.strong`, corner brackets in `color.structure`, a box title with an 8 by 8 pixel icon and a status light, a dithered strip under the title, and a hard 4 px pixel offset under it as its extrusion.
- Status lights: cyan blinking for live, red blinking for needs-you, yellow steady for a value. A light that blinks also has a word or icon beside it (P-43). Under reduced motion lights do not blink.
- Icons are 8 by 8 or 16 by 16 pixel drawings, inline SVG of square cells using `currentColor`, scaled by whole numbers.

## Buttons

Every button and pressable row lifts in 3D (MOT-2):

- Hover: the button lifts 2 to 3 px, tilts toward the pointer by up to `button.tilt` (wide rows by half), brightens, and grows the stepped pixel edge `button.lift` below it, over `motion.instant`.
- Press: it sinks 1 px, scales to 0.96, loses the edge and flashes brighter; release springs back (MOT-2).
- Yellow (primary) buttons get a yellow edge and `glow.accent`; the needs-you row gets a red edge and `glow.danger`.
- Only `transform` and `filter` animate (MOT-1). Under reduced motion the brightness stays and the movement goes.

## Background

The scene `phosphor-dust` (`backdrop.scene`) is a field of 5 by 5 pixel glyphs, rising steam and floating dust, drawn in the background worker (UI-30). Graph nodes and live session ribbons are steam sources in their own colour; the pointer stirs the flow; a click on empty space blows a puff (UI-33, UI-35). The full description is `spec/reference/art/background.md`.

The old-monitor look (UI-34): the scene alone is bent by the barrel distortion `crt.barrel` inside the worker. Scanlines (`crt.scanlines`) and the corner vignette (`crt.vignette`) are one still overlay over the whole window that takes no input. Text, buttons and the terminal are never bent, so every click lands where it is drawn.

## Glass map

Blur is 0 for every surface: depth comes from opacity, the frame, the brackets and the glow.

| Surface role | Opacity | Why |
|---|---|---|
| `app` | 0 | The background is the app's face. |
| `panel` | 0.88 | Files, HUD boxes and side views: 19 px text reads on any part of the field. Floating parts use a 3 px black text shadow instead of a surface. |
| `widget` | 0.88 | Dashboard boxes. A `free` widget has no surface (DASH-4). |
| `terminal` | 0.78 | The steam of each session's ribbon shows behind the text; the text keeps a 3 px black shadow. |
| `ribbon` | 1 | A solid strip, so its values never compete with the steam. |
| `overlay` | 0.97 | Dialogs, menus and popovers, over a 62 percent dim. |
| reading text (`surface.text.minAlpha`) | 0.78 | The floor for terminal, editor, transcript and viewer surfaces (UI-31). The mockups drew 0.74; that fails P-45 for muted text. |

Check for P-45 at the floor. The scene never draws a pixel brighter than 0.6 of `#F5FF3B` per channel, a relative luminance of 0.29 (UI-34). Over 0.78 of `color.bg.app` and 0.22 of that pixel: `color.text.primary` is 12.2:1, `color.text.secondary` 8.2:1, `color.text.muted` 4.7:1, and every ANSI colour except `ansi.black` (a background colour) at least 4.5:1. The theme raised `ansi.brightBlack` to `#A08C80` and `ansi.red` to `#FF5080` for this.

## Space and size

Spacing uses only these values, in pixels: 2, 4, 6, 8, 12, 16, 20, 24, 32, 40.

| Thing | Size (token) |
|---|---|
| Row height | 26 (`size.row`) |
| Tab height | 30 (`size.tab`) |
| Title bar | 56 (`size.titlebar`) |
| Status bar | 26 (`size.statusbar`) |
| Side view tab button | 30 by 30 |
| Ribbon, collapsed | 32 (HUD-80) |
| Dashboard grid gap | 22 across, 40 down (`size.grid.gapX`, `size.grid.gapY`) |
| Dashboard page edge | 18 (`size.grid.edge`) |
| Minimum click target | 24 by 24 |
| Hairline | 1 |

## Focus

- Every focusable thing shows a 2 px ring in `color.accent`, offset 1 px, with `glow.accent`, on keyboard focus only.
- The focused terminal's corner brackets and frame turn `color.accent`. A terminal whose session needs the owner has red brackets and frame.
- A terminal's cursor is a solid yellow block when focused and an outline when not.
- The selected graph node gets a yellow pixel bracket.

## Theme

Phosphor is the one built-in theme: `themes/phosphor.json` sets every token in `contracts/theme.ts`, and any theme the owner writes or duplicates may omit tokens, which then come from Phosphor (SET-12).

## Panel states

Every panel draws these four states (P-40). The approved examples are on the Notes page mockup, `?state=empty|loading|error`.

| State | Looks like |
|---|---|
| Loading | Shown only after 150 ms of waiting. A cyan pixel bar, one line saying what is loading ("Indexing notes"), and, where known, the item being read. The content fills in as it arrives. No spinner. |
| Empty | A title in `font.display`, one line of `text.secondary` saying what would appear here, and at most two actions as buttons. The mascot rests nearby where the page has one. |
| Error | The panel's frame and brackets turn `state.danger`, an icon, one sentence saying what failed, a "Retry" button and a "Show log" link, plus a settings shortcut when a setting can fix it. The rest of the app is unaffected. |
| Ready | The content. |

## Forbidden

- A colour used outside its job, or two jobs for one colour in one view.
- Blur, and gradients on surfaces, buttons or text. Dithering is the only blend.
- Radius above 12 px, and pill shapes except status lights.
- Soft drop shadows. The only shadows are the hard pixel offsets and the glows.
- Emoji as icons; icons that are not pixel drawings.
- Bending, animating or glowing terminal text.
- Anything drawn over reading text, including the background (P-45).
