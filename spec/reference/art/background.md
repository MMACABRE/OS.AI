# Background scene: `phosphor-dust`

The scene of the Phosphor direction (`spec/design/visual-direction.md`), drawn by the background worker (UI-30 to UI-35). The approved live preview is any page in `design-round/`, for example `design-round/dashboard/phosphor.html`. Where this file and the preview disagree, this file wins.

`mascot.png` and `mascot.json` in this folder are the sprite sheet of HUD-90 and HUD-91. Card 029 copies them to `resources/art/`.

## Grid and glyphs

- The scene draws on a grid of cells, each a 5 by 5 pixel glyph from this set: `. : ' + x / \ | - = [ ] # *`. The grid is 120 by 75 cells, drawn at 480 by 300 pixels and scaled up to the window with nearest-neighbour scaling (`image-rendering: pixelated`).
- Behind the glyphs is `color.bg.app`. No pixel is brighter than the cap of UI-34.

## Layers, back to front

1. **Base pattern.** A sparse field of glyphs that slides slowly across the grid. Its colour bands walk the palette along the diagonal (orange, red, magenta, lavender, cyan) and blend into each other by dithering; the bands drift so the colours shift over time. Single glyphs twinkle.
2. **Steam.** A slow turbulent flow drifting upward. Steam density picks the glyph: thin steam draws `.` and `+`, mid steam `x` and `=`, thick steam `#`. Where the flow is stirred, glyphs turn into `/ | \ -` streaks along the flow direction.
3. **Sources.** Each source of UI-35 pours steam of its colour into the field every frame, so the steam rises from it, smears and trails as the source moves. Sources by page: the graph's nodes in their halo colours (Dashboard, Notes); each live session ribbon in cyan, a ribbon that needs the owner in red, the focused terminal a little yellow (Code).
4. **Dust.** 420 motes float through the steam, carried by the flow.
5. **Barrel.** The worker bends the finished frame with the barrel distortion `crt.barrel` (UI-34).

## Input

- Pointer movement stirs the flow and the dust around the pointer, harder when it moves fast.
- A `puff` (a click on empty space, UI-33) blows a ring of dust and steam outward from the point.
- A 10 px parallax shifts the base pattern against the pointer.

## Loop and budget

- The scene never repeats exactly; every quantity drifts.
- One animation loop, at most `backdrop.fps` (30) frames a second, paused while the window is hidden (UI-32).
- Under reduced motion (MOT-12) it draws one frame, with steam already risen, and stops.
