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
