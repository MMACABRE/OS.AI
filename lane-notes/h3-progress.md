# H3 progress

Branch lane-h3. Commits are per test file. Items:

- Card 032 fixes (sessions): tests/sessions/sessions-fixes.ui.test.tsx, 19 tests, commit 1c4e1e1. Its SESS-50 polling and the 1 s picker toast test are timing-sensitive; the suite is green alone (3 runs) but failed once under full-suite load. Not changed after commit, because the guard blocks edits to existing test lines.
- Card 030 and 033 fixes: review (changes-fixes, 10 tests), git (status-fixes, 5), history (timeline-fixes, 2), activity (activity-fixes, 8), files (tree-fixes, 2, FILE-60 only), commands (commands-fixes, 2). Per-file commits are f26f6c2 (activity), ac6cca0 (files), 7246c5f (commands), d1288a1 (review), 3fa5d93 (git, status-fixes; it also carries history timeline-fixes because the index held it).
- Card 034: browser address (68b9142, 3 tests), graph-view (d7d06c2), agent-view (88e768d), notes-list (38ab492), browser-tab (f682ccf). GRAPH-29 and GRAPH-52 not in the file (see h3-bugs.md).
- Card 035: placement unit (eac0c9e, 9 tests with address), dashboard UI (0a20c58, 12 tests). DASH-9 not in the file (undo window bug).
- Card 036: gallery (9773cf6, 2 tests). The second test name says "in that order" but only checks four tiles; the order is not asserted. The first test skips the graph section because sigma needs WebGL 2 (jsdom has none).

Choices:
- FILE-61 (FilesTree rescan) skipped: open bug H1 owns it.
- HUD-16 and HUD-37 ("not yet covered" line in the Open bugs section) skipped: they are in the open-bug section.
- DASH-13 and other e2e rows skipped.
- DASH-6 checks outline classes, not colours (jsdom).
- DASH-5 uses vitest fake timers, not the ctx clock.
- GRAPH-55: NotesList takes no bus, so no disk read is possible; test checks open is not called.
- Browser tab id branded with a cast in tests.
- ACT-15 "refresh" covered as entryAdded with scroll kept (the Timeline's reload path has no separate scroll behaviour to test).

Left: nothing in scope.
