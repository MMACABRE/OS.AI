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

## Round 4 (2026-11-18): motion and interaction

Owner loved round 3 and asked for HSOS, the clock, the strawberry and the graph to react to the mouse and move; CLAUDE.md always in the centre; an open note glowing far brighter; a crowded graph that zooms with the scroll wheel.

- Strawberry (canvas, 16 by 16 cells): eyes follow the pointer, blink every 2.5 to 5.5 s, a slight smile, sleeps after 12 s without pointer movement (lavender Z, slower bob) and wakes on movement, now and then reads an orange book or types on a laptop with a cyan glow, hops on click, cheeks light on hover. The label under it follows the mode.
- Clock: real time, blinking colon, a short phosphor flicker every few seconds, seconds and a brighter glow on hover.
- HSOS: a light band sweeps across it (`clip-path`) on hover, click, and every 6 to 15 s; it keeps breathing.
- Graph (canvas): CLAUDE.md pinned in the centre with the large orange halo; the open note glows far brighter than the rest; 57 notes; every node drifts slowly; the pointer pushes nodes away, harder when it moves fast, and they spring back; hover enlarges a node and lights its links in cyan; scroll zooms at the pointer (0.7 to 5x), drag pans, double click resets; small labels appear from 1.8x.
- Background: a 10 px parallax against the pointer.
- One animation loop capped at 30 frames a second, paused when the window is hidden; reduced motion turns all of it off.
- Open points for the spec: the graph widget needs zoom and pan (GRAPH module); the mascot needs reading and working states in HUD-90.

## Round 5 (2026-11-18): living background, strawberry face

Owner: the white eyes looked scary; the strawberry should turn its whole face to the mouse with big black eyes and keep a poker face; the background should not be still; the halos behind nodes should become part of the background and move with physics; nodes fled the mouse so much they could not be picked.

- Strawberry: big black 2x3 eyes with a small pink glint; the eyes, cheeks and mouth slide toward the pointer, the body leans a few pixels and the leaves shift the other way, the extrusion falls on the far side; a flat mouth (poker face); cheeks only on hover.
- Background: a 120 by 75 cell dot field. A ripple height field (pointer movement makes small waves, a click on empty space drops a big one, fast nodes make their own); a velocity field the pointer drags that carries colour like smoke; each graph node pours its halo colour into the field every frame, so halos follow, smear and trail as nodes move. Waves brighten dots and nudge them sideways. Rendered at 480 by 300 and scaled up pixelated.
- Graph: halos are no longer drawn on the graph; only a fast pointer sweep pushes nodes, a slow or resting pointer can reach and pick one, and a hovered node holds still.
- Note: headless Edge runs only one animation frame under virtual time, so stills come from `?still=1`, which simulates 60 steps.
- Graph layer: the graph draws on a full-window canvas between the background and the widgets, so panning and zooming are no longer clipped by the centre cell. The centre area only sets the graph's home position. `.app` passes pointer events through empty space; frames, buttons, the mascot and the bars take them. A click without a drag on empty space drops a ripple; a drag pans.

## Round 6 (2026-11-18): dust and steam, richer boxes

Owner: boxes and background looked alike; add more pixel-art components; the background should feel like dust and steam, not water; use more symbols; colours and patterns should shift.

- Background: no ripples. A slow turbulent flow drifts upward; graph halos are steam that rises from the nodes; 420 dust motes float through it; the pointer stirs flow and dust; a click blows a puff. Every cell draws a 5 by 5 glyph from `. : ' + x / \ | - = [ ] # *`: steam picks by density (dots and pluses thin, x and = mid, # thick) and turns to `/ | \ -` streaks along the flow where it is stirred. The base pattern slides, its colour bands cycle through the palette with blends, and its glyphs twinkle.
- Boxes: corner brackets, an 8 by 8 pixel icon per box (terminal, stack, battery, chip), a status light (cyan blinking for live, red blinking for needs you, yellow for values), a dithered strip under the title, a double inner frame and a faint pixel texture.
- Buttons (page switcher, quick bar, edit toolbar, palette hint, window controls): on hover they lift 2 to 3 px, tilt toward the pointer (up to 9 and 12 degrees), brighten and grow a stepped pixel edge below; on press they sink 1 px, shrink to 0.97, lose the edge and flash brighter. Yellow buttons get a yellow edge and glow. Only `transform` and `filter` animate; reduced motion keeps the brightness and drops the movement.
- Session rows: each row in the Sessions box is a button with the same lift, tilt, brighten and press; wide rows tilt about half as much. The needs-you row gets a red edge and red glow; its `Open` is a real small button that inverts on hover.

## Code page, round 1 (2026-11-18): three layouts

Owner approved the Phosphor Dashboard and asked to carry on with the Code page. The Dashboard's look is kept; its layout is not binding, so the Code page is shown as three layouts in one live mockup, `design-round/code/phosphor-code.html?layout=a|b|c`; open `design-round/code/compare.html`.

All three show the same moment: the left terminal is focused (yellow frame) with a working session, two running subagents and one finished, and its ribbon expanded (HUD-82); the right terminal's session needs you for a Bash approval (red frame, red ribbon, collapsed). The background is the Dashboard's dust and steam, but the steam sources are the sessions: each live ribbon breathes cyan steam, the one that needs you breathes red, and the focused terminal a little yellow. Ribbon minis dance while working and hop while they need you (HUD-90, HUD-92).

- A, classic dock: rail, Files, two terminals side by side, HUD panel. Terminals are about 400 px wide, so the ribbon drops folder, repo and mode (HUD-81) and the chat name is cut.
- B, stage: the focused terminal at about 860 px with the full ribbon; the second terminal beside it at the top; a compact HUD under it. Files folds into the rail.
- C, open air: Files and the HUD float without boxes, the strawberry top right as on the Dashboard; terminals stacked full width, framed by corner brackets only, at 0.74 opacity.
- Open points for the spec: the ribbon is drawn 32 px high so the 16 by 16 mascot sits at 2x (HUD-80 says 28 px and HUD-81 a 20 px mascot); a terminal under 0.8 opacity (layout C) needs `surface.text.minAlpha` set at or below it (UI-31); layout C has no activity rail, its side views move to a tab row above Files (layout.md, Areas).

## Code page, round 2 (2026-11-18): layout C chosen

Owner liked layout C best and asked for a smaller strawberry, more room for tools and details, and where the repo and the skill search are.

- Strawberry at 5 px cells instead of 10, in a row with its word, top of the HUD column; the HUD column grows from 250 to 318 px and Files shrinks to 200.
- HUD column, top to bottom: mascot, quick bar (HUD-60 to HUD-62: the target session's title; Usage, Context and Skills; model and effort, Plan, Compact, Clear, More), Usage, Sessions (three rows), Skills deck (HUD-30 to HUD-33: a search field, here with `ui` typed and the first hit lit, star toggles, a run-in-background action per row, one background run with Cancel) and the Skills repo row (HUD-40: "In sync", Check). The Skills deck keeps a box because it holds an input; the other HUD parts float.
- Repo: a title bar button next to the project switcher shows `owner/repo`, the branch and ahead/behind, and opens `webUrl` (GIT-14). The ribbon still shows the session's repo and branch (HUD-81).
- Open points for the spec: the repo button in the title bar is new (layout.md says the title bar holds the project switcher and the branch); `Ctrl+K` as the key for `hud.searchSkills` is new and clashes with the `Ctrl+K Ctrl+T` chord, so the spec author picks a free key.

- Owner approved layout C with these changes (2026-11-18). It is the Code page for the spec author; layouts A and B stay in the mockup for history.

## Notes page, round 1 (2026-11-18): three layouts

Owner asked for the next part after approving the Code page. One live mockup, `design-round/notes/phosphor-notes.html?layout=a|b|c`; open `design-round/notes/compare.html`. The title bar matches the Code page (repo button included); the strawberry is small and reads a book; the graph's nodes are the steam sources, as on the Dashboard.

Every option shows the same moment: `hud.md` open in the notes dock (WS-43) as a Preview with wiki links in lavender and an unresolved one dotted (GRAPH-32); `motion.md` selected with a yellow pixel bracket and its details card (GRAPH-24); the pointer on `layout.md` with its links lit cyan and the hover preview card (GRAPH-44); the agent view on, CLAUDE.md ringed as a start file and the summary line (GRAPH-42, GRAPH-43); the toolbar of GRAPH-26.

- A, map and page: the graph free on the left, the note in a yellow-framed sheet on the right with its backlinks at the foot.
- B, reader: notes list on the left, the note as a wide centre column, the local graph (GRAPH-30, depth 2, not expanded through CLAUDE.md) and backlinks on the right.
- C, open air: matches Code page C. The graph fills the page and runs on behind the see-through note (0.78 opacity, corner brackets).
- Open points for the spec: in C, graph labels under the note show through its text; the graph should fade labels behind the sheet or the sheet needs a higher opacity. The notes list in B is not a spec'd panel (Files covers it on the Code page). The selection bracket colour (yellow, the focus colour) is new to GRAPH-24.

## Notes page, round 2 (2026-11-18): layout C with a notes list

Owner chose layout C and asked for a small notes list in it.

- A notes list floats on the left without a box, like Files on Code page C: a search field, the note tree (spec, modules with link counts, docs, tasks, CLAUDE.md, skills, memory) with the open note in yellow. Recent is left out to keep it small.
- The graph is centred in the space between the list and the note, so it no longer runs behind the note. This also settles the round 1 open point about graph labels showing through the note's text.
- Open point for the spec: the notes list is a new side view for the Notes page (a filtered Files view: markdown notes only, with link counts from the graph index).

- Owner approved Notes page layout C with the notes list (2026-11-18). It is the Notes page for the spec author; layouts A and B stay in the mockup for history.

## Finishing round (2026-11-18): every item of the brief

Owner asked to finish the UI. Everything the brief lists for the chosen direction now exists; open `design-round/index.html`.

- Dashboard: the calmer node drift of the Notes page (amplitude about 30 percent lower, speed about 20 percent lower) and the repo button, so all three title bars match.
- Panel states (brief item 3), on the Notes graph: `?state=empty` ("No notes yet", New note, Set vault folder; the strawberry rests without its book), `?state=loading` ("Indexing notes", a cyan pixel bar, the file being read; the graph fills in as notes are read) and `?state=error` (red frame, the error text, Retry, Open log, Settings).
- Dialog (brief item 3): "Run in background" of HUD-32 on Code page C, `?dialog=run` or a skill's ▶. It scales from 0.94 and fades over 260 ms while the page dims (MOT-4); it leaves over 120 ms with the ease-in curve.
- Mascot (brief item 5): `design-round/mascot/sheet.html`, eight states in 16 by 16 cells (dancing, waving, cheering, resting, sleeping, the 3-frame turn of HUD-91, reading, working), at 2x, 4x and live at 8x; exported as `mascot.png` (96 by 128) and `mascot.json`. Arms are two red pixels; the waving arm is yellow (`color.accent`, HUD-90).
- Motion (brief item 6): `design-round/motion/index.html`. The stage stacks the real mockups: one background that never moves (MOT-7), three page contents that slide 96 px and fade over 420 ms (MOT-5), and fixed bars whose switcher marker slides (MOT-6). Below: widget resize by FLIP with the spring (MOT-1), button press (MOT-2), the model menu with 20 ms row stagger (MOT-3, MOT-4), dialog open and close (MOT-4). Switches for slow motion ×4 and reduced motion (MOT-12). Each mockup gained `?mode=bg|content|chrome` for this.
- Theme file and glass map (brief items 2 and 7): `design-round/theme/phosphor.json` sets all 81 contract tokens plus 18 new ones; `glass-map.md` gives each surface role its opacity and blur (0 everywhere, because of the barrel filter) and why.
- Background (brief item 4): the live pages are the preview (dust and steam, described in Dashboard round 6).
- Not covered: the motion stage does not show the Dashboard mini graph turning into the Notes graph (the shared element of MOT-6), and in the stack the graph's steam goes to each page's own background, which is off, so the shared background shows none. In the app the graph inks the one shared background.
- Open points for the spec author, beyond those of earlier rounds: `surface.text.minAlpha` 0.74 against P-45's 0.85; VT323 in xterm and its fallback for box-drawing characters; the barrel filter's cost against UI-32 (all in `glass-map.md`); the empty state's buttons "New note" and "Set vault folder" are new to the graph module.

## Settings screen (2026-11-19): layout A

Settings had no mockup, so three options were shown in `design-round/settings/phosphor-settings.html?layout=a|b|c`: A Ledger (search and the section list on the left, one section on the right, the problems banner on top), B One scroll (one centred column with jump chips) and C With preview (A plus a live miniature on the right).

- Owner chose A, Ledger (2026-11-19). It is the settings.md layout as written, in the Phosphor look: corner-box section list with counts, the selected section in yellow, rows with a hint line under the label, a dot after a changed label and a lavender Reset link.

