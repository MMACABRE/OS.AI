## 030 Files, viewer and history
Status: done (untested)
Date: 2026-11-19
Did: Built the Files view (side view `files.tree`: lazy folders on demo data, four states, context menu with delete confirmation and new file), the file viewer (dock `files.viewer`: text editor with Ctrl+S, dirty marker, changed-on-disk and deleted bars, binary, too-large and image notices) and the history timeline (dock `history.timeline`: version list, diff against the previous version, compare with the current file, restore with confirmation). Registered both modules in `src/ui/module-list.ts`.
Checks: typecheck ok, lint ok, deps ok, build ok, test not run (implementer rule), e2e not run
Deviations:
- ui-kit has no `CodeView`, `DiffView` or `MarkdownView` yet (ui-kit.md lists them; they are not in `src/modules/ui-kit/index.ts`). The viewer uses a plain monospace `textarea`; the history panel has its own `DiffView` (inline only) and `line-diff.ts`. The review module (card 033) will need the same diff, so the Lead should move `DiffView` into ui-kit. Until then it is a copy.
- No `diff` or `codemirror` package is imported in the panels: the lane rule allows only contracts, ui-kit and the module's own files.
- Viewer, not built: markdown preview toggle (FILE-70), "Compare" on the changed-on-disk bar (FILE-74), line wrap (`wordWrap`), image preview (no `hsos-file:` scheme yet), dirty-close prompt (FILE-76; the dock has no close hook), focus of an already-open file (FILE-78; the dock API does not expose it, so every open adds a viewer), syntax colours, dirty dot on the tab (the marker is in the frame header).
- Files view, not built: rename, new folder, Ctrl+N, Ctrl+C, drag to terminal and into folders, Delete key, dirty dots (FILE-66), "Open to the Side", "Open Terminal Here", "Send Path to Terminal". The view keeps its expanded folders and selection in component state, not in the view's saved state (FILE-60 asks for saved state; side views have no saved state yet).
- History, not built: "+n lines" change (the timeline shows the byte change, `+812 B`, because line counts need every version read); Undo action on the restore toast (ui-kit's toast has no action); the `history.showForActiveFile` and `history.pruneNow` commands; "Compare" reads the file with `files.read`, so binary files show "Binary file changed."
- The three helper files (`use-project.ts`, `helpers.ts`, `format.ts`) are small copies that the other modules also need (`useProject` for the open project, `relativeTime`). They belong in ui-kit or in `workspace`. The Lead should decide where.
- The Files view and the viewer open the history timeline through `ctx.openPanel('history.timeline', ...)`, not by import. The timeline opens the file's history through `ctx.openPanel` only from the files module; no import crosses modules.
- Paths in tree node ids and listings are absolute paths, joined with `\`. `DirEntry.relPath` is not used, because the contract says only "relative to the root that was listed" and the fixture uses the project root.
- `src/ui/module-list.ts` was edited (the Lead asked for it), though the card's file list does not name it.
Next: 032
