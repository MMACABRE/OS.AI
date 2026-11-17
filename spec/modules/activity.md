# Module: activity

## Purpose

Answers two questions without asking Claude and without spending usage: "what changed, and who changed it?" and "where is the thing Claude made for me?"

## Interface

`contracts/channels/activity.ts`. Reads `history` and `claude-link` through their channels.

- Runs in: `workspace-service` (joins history with session events, keeps the artifact list), `ui` (two side views).
- Third-party packages allowed: `diff` (service, for line counts), `write-file-atomic`, `zod`.

## Data

`artifactsFile(projectId)`: `{ "version": 1, "artifacts": [...], "dismissed": ["<relPath>", ...] }`. Written atomically.

## Behaviour

### Activity timeline

- **ACT-1.** Each `history.snapshotAdded` becomes one `ActivityEntry`, except snapshots with source `baseline`, which are the state before a change and not a change.
- **ACT-2.** `change` is `created` when the path had no earlier snapshot, `deleted` for source `deleted`, `restored` for source `restore`, else `changed`.
- **ACT-3.** `cause`:

| Snapshot source | Condition | Cause |
|---|---|---|
| `hsos-save`, `restore` | always | `owner` |
| `external`, `deleted` | a `file-edit` session event for the same path exists within 5 seconds before or 2 seconds after the snapshot time | `claude`, with that session's id and title |
| `external`, `deleted` | otherwise | `outside` |

- **ACT-4.** The service keeps the last 60 seconds of `link.sessionEvent` events of kind `file-edit` in memory to make this match. A snapshot waits up to 2 seconds for a matching event before it is classed `outside`.
- **ACT-5.** `linesAdded` and `linesRemoved` come from a line diff between the previous snapshot of the path and this one. Both are null for binary content and for files above 1 MB.
- **ACT-6.** `listTimeline` reads `history.listRecent` and applies ACT-1 to ACT-5. Results for a page are cached in memory until a new snapshot arrives.
- **ACT-7.** Entries are derived, not stored: the timeline goes back exactly as far as local history does.

### Activity view

Side view `activity.timeline`.

- **ACT-10.** A list grouped by day ("Today", "Yesterday", then dates), newest first. Each row: time, cause icon and word, relative path (file name emphasised, folder muted), and `+n −m`.

| Cause | Icon | Word |
|---|---|---|
| `owner` | `check` | You |
| `claude` | `agent` | the session title, cut to 24 characters |
| `outside` | `external` | Outside |

- **ACT-11.** Consecutive entries with the same cause, the same session and times within 60 seconds of each other collapse into one group row: "Claude · refactor parser · 7 files". Expanding it shows the entries.
- **ACT-12.** Filters at the top: cause (All, You, Claude, Outside) and, when `claude` entries exist, a session select.
- **ACT-13.** Activating an entry opens the file's `history.timeline` panel with that snapshot selected, which shows its diff.
- **ACT-14.** The row menu has: "Open file", "Show diff", "Restore the version before this change" (calls `history.restore` on the previous snapshot after confirmation), "Pin comment" (adds a `file-line` comment at line 1 through `review`, when present).
- **ACT-15.** New entries appear at the top as they arrive. When the list is scrolled away from the top, a "n new changes" chip appears instead of moving the list.
- **ACT-16.** The list loads 100 entries and loads 100 more when scrolled to the end.

### Artifacts inbox

- **ACT-20.** A file becomes an artifact when it is created or changed, its extension is in `artifactExtensions`, no folder in its path is in `artifactExcludeFolders` or matches `files` `dimPatterns`, and either:
  - the change's cause is `claude` (ACT-3), or
  - a Claude session of this project was `working` at the time of the change.
  The second condition catches files made by commands Claude runs, such as a script that renders a PDF.
- **ACT-21.** Kind by extension: `html`, `htm` → `html`; `pdf` → `pdf`; `mp4`, `webm` → `video`; the rest → `image`.
- **ACT-22.** `pinArtifact` adds any file as an artifact with `isPinned: true`. `dismissArtifact` removes one and records its path in `dismissed`, so it does not return unless pinned.
- **ACT-23.** An artifact whose file no longer exists is removed at the next list. Beyond `maxArtifacts`, the oldest unpinned ones are dropped from the list. Files are never touched (P-1).

### Artifacts view

Side view `activity.artifacts`.

- **ACT-30.** A search field, then a grid of tiles two across (one when the area is under 260 wide), newest first. A tile shows a thumbnail, the file name, relative time and the session title.

| Kind | Thumbnail |
|---|---|
| `image` | the image through `hsos-file:`, fitted |
| `html`, `pdf`, `video` | an icon for the kind on `color.bg.raised` |

- **ACT-31.** Activating a tile opens it: `html` in a browser panel as a local file when the `browser` module is present, else in the system browser; `image` in a file viewer; `pdf` and `video` in the system's default program through `shell.openPath`.
- **ACT-32.** Tile menu: Open, Reveal in Explorer, Copy Path, Send Path to Terminal, Pin Comment (adds an `artifact` comment through `review`), Remove from Inbox.
- **ACT-33.** The search field filters by relative path as typed. No request leaves the machine and no Claude run is involved.
- **ACT-34.** The activity rail icon for Artifacts shows a dot when artifacts arrived since the view was last open.

## Commands

| Id | Title |
|---|---|
| `activity.showTimeline` | Show Activity |
| `activity.showArtifacts` | Show Artifacts |
| `activity.pinActiveFile` | Add Active File to Artifacts |

## States

| View | Loading | Empty | Error |
|---|---|---|---|
| Activity | skeleton rows | "No changes recorded yet. Changes to files in this project appear here." | "Activity could not be read." with "Retry" |
| Artifacts | skeleton tiles | "Nothing here yet. Pages, PDFs and images Claude makes in this project appear here." | "Artifacts could not be read." with "Retry" |

## Tests

| Rule | Level | Given | When | Then |
|---|---|---|---|---|
| ACT-1 | integration | snapshots: `baseline`, `hsos-save` | the timeline is listed | one entry |
| ACT-2 | integration | a first snapshot for a path | it is listed | `created` |
| ACT-3 | integration | an `external` snapshot at time T and a `file-edit` event for the path at T−1 s from session S | it is listed | cause `claude`, session S |
| ACT-3 | integration | an `external` snapshot with no event | it is listed | `outside` |
| ACT-4 | integration | a snapshot arrives 1 s before its `file-edit` event, fake clock | both are processed | cause `claude` |
| ACT-5 | integration | previous `a\nb\n`, current `a\nc\nd\n` | it is listed | `+2 −1` |
| ACT-11 | unit | 7 `claude` entries of one session within 40 s, then one `owner` entry | grouping | one group of 7 and one single row |
| ACT-15 | component | the list scrolled down | a new entry arrives | the scroll position is unchanged and a "1 new changes" chip shows |
| ACT-20 | integration | `report.pdf` created with cause `claude` | artifacts are listed | it is present, kind `pdf` |
| ACT-20 | integration | `chart.png` created while a session is `working`, cause `outside` | listed | present |
| ACT-20 | integration | `logo.png` under `public\` | listed | absent |
| ACT-20 | integration | `x.png` created with no session working | listed | absent |
| ACT-22 | integration | a dismissed artifact | its file changes again by Claude | still absent; after `pinArtifact` it is present |
| ACT-23 | integration | an artifact whose file was deleted | listed | absent; no file operation was made by `activity` |
| ACT-33 | component | tiles `a/report.html`, `b/chart.png` | the query `rep` | one tile |
| P-4 | integration | all tests above | all finish | no file inside the project was written by `activity` |
