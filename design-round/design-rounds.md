# Design rounds

Log of the design round for the Dashboard (`spec/design/direction-brief.md`). Mockups are throwaway HTML in `design-round/dashboard/`; open `compare.html`.

## Brief

- Scope: Dashboard only, eight widgets, in use and in edit mode, at 1440 by 900.
- Directions: Graphite (as specified), Phosphor and Contour (new).
- Palette for the new directions, set by the owner: terracotta `#E07A5F`, neon yellow `#F5FF3B`, neon red `#FF003C`. Accents used sparingly: cyan `#00F0FF` and lavender `#C77DFF`, magenta `#FF00FF` least.
- Owner's wishes: pixel art that feels 3D when it moves, a little asymmetry, slight distortion like a 40-year-old large CRT monitor.
- References: `Visual Reference/` (four images and one video; the video could not be decoded on this machine, and `download.jpg` appears to be a frame of it).
- Bar: fresh-context judge score of 9.2/10 or more. Budget: about 20% of the 5-hour limit.
- Motion: after the owner approves a still, only for the chosen direction.

## Round 1 (2026-11-18)

Builder's notes, not a judge score.

- Fixed after the first render: grid overflowed and clipped the quick bar; the barrel map bent outward and cut the title and status bars; the vertical wordmark overflowed its band; widgets were half empty; a full neon yellow git widget read as a dead block; contour lines ran into neighbours; the graph label sat on a node.
- Eight widgets: the default layout of DASH-22, with `hud.context` 2x3 split into `hud.context` 2x2 and `git.status` 2x1.
- Open points for the spec author if Phosphor wins: the wordmark band takes 112 px from the grid (DASH-2 says the grid fills the page); a full-window SVG displacement filter is likely too costly for UI-32 and would move to the background layer or a WebGL pass.
- Judge: not run yet; waiting for the owner's go-ahead to spawn the reviewer.

## Round 2 (2026-11-18)

Owner chose Phosphor and asked for: a strawberry mascot; less neon yellow and more of the main palette; a few more touches of cyan and lavender; rounded boxes instead of the notched corners; the graph exactly in the middle with the other widgets toward the corners.

- File: `design-round/dashboard/phosphor.html` (round 1 kept in `index.html`).
- Layout on the 8x6 grid: graph 4x4 at 2,1; git 4x1 above it and quick bar 4x1 below; session ribbon 2x3 and sessions 2x3 on the left; mascot, usage and context 2x2 each on the right. A 112 px rail on the right matches the left band, so the grid centre is the page centre.
- Colour roles: yellow is `accent` only (current page, primary action, open note, current plan step). Terracotta for titles, attention and the wordmark; neon red for danger and the strawberry; cyan for ok, running and the live session; lavender for info, skills and the second outline of the graph. Background dots are mostly terracotta with sparse cyan, lavender and red, and about one in 250 magenta.
- Radius 10 px on widgets, 6 px on controls. The hard 4 px offset under each widget stays as the pixel extrusion.
- Open point for the spec: `ok` becomes cyan, so usage bars below 60 percent are cyan.
- Judge: not run yet.

- Round 2b, owner's colour share: about 50 percent terracotta and phosphor yellow, 20 percent neon red, 30 percent cyan, lavender and magenta; red, cyan, lavender and magenta glow. Big numbers and the session title are phosphor yellow; sessions widget and needs-you row are neon red; usage, clock, band mark and graph outline carry the cool colours; unresolved graph nodes and the mascot frame are magenta. Glow on small text is softened so it stays legible.

## Round 3 (2026-11-18)

Owner: colours felt placed without order; HSOS horizontal top left in neon red with the cyan clock beside it; remove the symbol and other things without meaning; boxes to the page corners with more space between; graph without a box, floating, with a pixel halo on every node in different colours; frames symmetric, only decorative parts and buttons a little asymmetric; HSOS breathes slowly; terracotta becomes a brighter neon orange.

- File: `design-round/dashboard/phosphor.html`; round 2 kept as `phosphor-r2.html`.
- Colour jobs: neon orange `#FF7A3D` = structure (frames, titles); phosphor yellow = values and focus; neon red = attention and the brand; cyan = live activity; lavender = knowledge; magenta = memory. Bars: cyan below 60 percent, yellow from 60, red from 85.
- Background dots walk the palette along the diagonal (orange, red, magenta, lavender, cyan) instead of random colours.
- Layout: session and sessions boxes on the left edge, usage and context boxes bottom right, mascot free top right, graph free in the centre (4x5), quick bar free below it with the screen dots. The git widget is gone; its data is in the status bar. Grid gap 22 by 40 px, page edge 18 px.
- Breathing: `transform` scale 1 to 1.035 and `filter` drop-shadow plus hue-rotate toward magenta, 7 s loop, off under reduced motion. Only allowed properties animate.
- Open points for the spec: title bar grows from 36 to 56 px to hold the brand and clock; a widget can be frameless (`free`).
