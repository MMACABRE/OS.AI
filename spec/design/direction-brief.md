# Design round: brief for the UI designer

Before Stage U is built, a UI designer agent shows the owner several visual directions and the owner picks one (JOURNAL step 37). This file is that agent's brief. The implementer does not read it and does not design; it builds the direction the owner chose, once the spec author has written that choice into `visual-direction.md` and `themes/`.

## What the owner said they like

These are preferences to explore, not rules. No direction overrides another until the owner chooses.

- Cyberpunk mixed with pixel art. Minimal, not busy.
- A home screen like Samsung One UI: widgets that resize and snap to a grid, pages to swipe between.
- A lot of motion in widgets, buttons and page changes, with seamless transitions between the Dashboard, the Code page and the Notes page (motion is a hard rule; see `motion.md`).
- An animated background that runs everywhere, terminal included, seen through glass surfaces whose transparency differs from part to part.
- A small orange pixel-art character that dances and reacts to what Claude is doing.
- The current Graphite direction (`visual-direction.md`) stays a candidate. It is not replaced unless the owner picks another.

## What every direction must keep

These come from the spec and hold whatever is chosen.

- Text contrast at least 4.5:1 against the worst frame of the background behind it (P-43, P-45). Terminal, editor and transcript text sit on surfaces opaque enough for that.
- State is never colour alone (P-43).
- Every token in `contracts/theme.ts` gets a value. A direction may propose new tokens; the spec author adds them to the contract.
- The motion system of `motion.md`: its durations, its reduced-motion fallback, and the rule that only `opacity`, `transform`, `filter` and `clip-path` animate.
- The background's budget (UI-32): at most 30 frames a second, under 1 ms of main-thread time per frame, paused when the window is hidden.
- Dense information: the terminal is still the subject of the Code page.
- The mascot is an original character drawn for HSOS, not a copy of another product's sprite.

## What to deliver

At least three directions, Graphite counted as one. For each:

1. A name and three sentences on the idea.
2. A theme file in the `ThemeFile` format with every token, plus any new tokens it needs, listed separately.
3. Still frames, at 1440 by 900, of: the Dashboard with eight widgets in edit mode and out of it; the Code page with two terminals, one with its session ribbon expanded; the Notes page with the graph and a note open; the HUD; a dialog; the empty, loading and error states of one panel.
4. The background: a short description of the scene, its layers and its loop, and a looping preview of at least 10 seconds.
5. The mascot: a sprite sheet of 16 by 16 pixel cells, with the frames for each state of HUD-90, shown at 2x and 4x.
6. Motion previews of: Dashboard to Code page, Code page to Notes page, a widget being resized, a button press, a menu opening, a dialog opening and closing.
7. The glass map: for each surface role, its opacity and blur, and why.

Previews are built as throwaway HTML pages outside `src/`. They are not part of the app.

## How the choice is recorded

The owner picks one direction, or parts of several. The spec author then:

1. rewrites `visual-direction.md` for the chosen direction, keeping Graphite as a shipped theme if the owner wants it;
2. writes the theme files to `themes/` and any new tokens to `contracts/theme.ts`;
3. adds the mascot sheet and the background description to `spec/reference/art/`;
4. logs the choice in `docs/JOURNAL.md`.

Stage U starts after this. Until then the spec's direction is Graphite.
