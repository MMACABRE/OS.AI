# Module: history

## Purpose

Keeps earlier versions of every file that changes in the project, whoever changed it, so any change can be seen and undone. It works without git and stores nothing inside the project.

## Interface

`contracts/channels/history.ts`. Observes `files` through the `fileWriteObservers` extension point in `contracts/channels/files.ts`.

- Runs in: `workspace-service` (store), `ui` (timeline for one file).
- Third-party packages allowed: `better-sqlite3` and `write-file-atomic` (service only), `diff` through `ui-kit`, `zod`.

## Storage

Under `historyDir(projectId)`:

| Item | Content |
|---|---|
| `objects\<first 2 hex>\<remaining 62 hex>` | The raw bytes of one content version, named by its SHA-256 |
| `index.sqlite` | Table `snapshots(id TEXT PRIMARY KEY, path TEXT, hash TEXT, time INTEGER, size INTEGER, source TEXT)` with an index on `(path, time)` and one on `(time)` |

- `path` is stored relative to the project root with forward slashes, so history survives the project folder being moved.
- Identical content is stored once, however many snapshots point to it.

## Behaviour

### Taking snapshots

- **HIST-1.** A snapshot is taken only for files inside the project, not matching `exclude`, and no larger than `maxFileBytes`. With `enabled` false, none are taken.
- **HIST-2.** Order of writing: first the object file, atomically; then the index row. A crash between the two leaves an unused object and never a row without its object (REL-3).
- **HIST-3.** A snapshot is skipped when the newest snapshot of that path already has the same hash.
- **HIST-4.** From `files` (observer):
  - `beforeWrite(path, previous)`: if `previous` is not null and the newest snapshot of the path does not have its hash, snapshot `previous` with source `baseline`.
  - `afterWrite(path, content, cause)`: snapshot `content` with source `hsos-save` for `save` and `create`, `restore` for `restore`.
  - `beforeTrash(path, previous)`: snapshot `previous` with source `deleted`.
- **HIST-5.** From the watcher: for each `created` or `changed` path in a `files.changed` batch, wait until the file's size and modified time are unchanged across 300 ms, then read it and snapshot with source `external`. Writes made by `files` itself are recognised by their hash and skipped (HIST-3).
- **HIST-6.** For a `deleted` path in a batch, nothing can be read. The newest snapshot of that path gets a following row with the same hash and source `deleted`, so the timeline shows when it disappeared.
- **HIST-7.** `snapshotNow(path, source)` snapshots the file's current content at once, subject to HIST-1 and HIST-3. It answers within its 1 500 ms timeout or the caller proceeds without it.
- **HIST-8.** Each new snapshot emits `snapshotAdded`.
- **HIST-9.** Snapshot work runs one file at a time on a queue. A burst of 1 000 changed files is processed without blocking bus requests for more than 50 ms at a stretch (P-13).

### Reading and restoring

- **HIST-20.** `restore(id)` writes the snapshot's bytes to its path through the same atomic path as `files.save`, with observers run. The file's current content is therefore snapshotted first (as `baseline` if unknown), and the restored content is snapshotted as `restore`.
- **HIST-21.** `restore` refuses with `FILE_EXISTS` only in `restoreDeleted` when a file now exists at the path. `restore` on an existing file always works, because the current content is saved first.
- **HIST-22.** `readText` decodes the object as the same encodings `files` reads. Non-text content returns `FILE_BINARY`.
- **HIST-23.** A row whose object file is missing returns `HIST_OBJECT_MISSING` and is removed from the index at the next prune.

### Retention

- **HIST-30.** Pruning runs at project open and every 24 hours. It removes, in order:
  1. rows older than `maxAgeDays`,
  2. for each path, rows beyond the newest `maxSnapshotsPerFile`,
  3. the oldest rows across all paths until total object size is at or below `maxTotalBytes`.
- **HIST-31.** The newest snapshot of each path is never pruned.
- **HIST-32.** After rows are removed, objects that no row points to are removed. These are HSOS's own data (P-1 concerns user files).
- **HIST-33.** Pruning deletes rows in batches of 500 and yields between batches.

### Timeline for one file

Dock panel `history.timeline`, opened by "Show History" on a file. State: `{ path: AbsPath, selectedId: SnapshotId | null }`.

- **HIST-40.** The left column lists the file's snapshots, newest first: relative time, source as a word and icon, and size change against the previous snapshot (`+12 lines`, `−3 lines`).

| Source | Word shown | Icon |
|---|---|---|
| `baseline` | Before first change | `clock` |
| `hsos-save` | Saved in HSOS | `check` |
| `external` | Changed outside HSOS | `agent` |
| `restore` | Restored | `restore` |
| `deleted` | Deleted | `trash` |

- **HIST-41.** Selecting a snapshot shows a `DiffView` between the previous snapshot and the selected one. A toggle switches to "Compare with current file".
- **HIST-42.** "Restore this version" asks for confirmation naming the file and the snapshot's time, then calls `restore`. A toast confirms with an "Undo" action that restores the version that was current before.
- **HIST-43.** The list updates on `snapshotAdded` for this path.

## Commands

| Id | Title |
|---|---|
| `history.showForActiveFile` | Show File History |
| `history.pruneNow` | Clean Up Local History |

## Status

The settings section "Local history" shows current usage from `getUsage` ("1 284 versions, 96 MB") and a "Clean up now" button.

## States

| Panel | Loading | Empty | Error |
|---|---|---|---|
| Timeline | skeleton rows | "No earlier versions of this file yet. Versions appear here after the file changes." | "History could not be read." with "Retry" |

## Tests

| Rule | Level | Given | When | Then |
|---|---|---|---|---|
| HIST-1 | integration | a 3 MB file with the default limit | it changes | no snapshot |
| HIST-1 | integration | a file under `node_modules` | it changes | no snapshot |
| HIST-2 | integration | a store whose index insert throws | a snapshot is taken | the object file exists; a later prune removes it; no row exists |
| HIST-3 | integration | a file snapshotted with content A | it is "changed" to A again | still one snapshot |
| HIST-4 | integration | a file never seen by history, content A | `files.save` writes B | snapshots are A `baseline`, then B `hsos-save` |
| HIST-5 | integration | a watched project, fake clock | another process writes C to a file | one `external` snapshot with C's hash after the settle time |
| HIST-5 | integration | a file being appended every 100 ms | the watcher reports it | no snapshot until 300 ms pass with no change |
| HIST-6 | integration | a file with one snapshot | it is deleted outside HSOS | a second row with source `deleted` and the same hash |
| HIST-7 | integration | a file with content D | `snapshotNow` | returns a snapshot of D; calling again returns the same one |
| HIST-20 | integration | snapshots A then B; disk has unsnapshotted content X | `restore` of A | disk holds A; rows are A, B, X `baseline`, A `restore` |
| HIST-23 | integration | a row whose object was removed by hand | `readText` | `HIST_OBJECT_MISSING` |
| HIST-30 | integration | rows aged 40 and 10 days, limit 30 days, fake clock | prune | only the 10-day row remains |
| HIST-30 | integration | 250 rows for one path, limit 200 | prune | the newest 200 remain |
| HIST-31 | integration | one path whose only row is 90 days old | prune | the row remains |
| HIST-32 | integration | two rows sharing one object; one row pruned | prune | the object remains; after the second is pruned in a later test, it is gone |
| HIST-42 | component | a timeline with a selected snapshot | "Restore this version", confirm | `restore` is called once and a toast with "Undo" shows |
| REL-3 | fault | a burst of 200 file changes | `workspace-service` is killed mid-burst and restarts | `index.sqlite` opens; every row's object exists |
| REL-12 | property | random sequences of save, external write, restore, kill | after each "saved" acknowledgement | that content is on disk or readable from history |
