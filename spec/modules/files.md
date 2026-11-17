# Module: files

## Purpose

Lets the owner see and lightly edit the project's files while Claude Code edits the same files, without ever losing or silently overwriting anyone's work.

## Interface

`contracts/channels/files.ts`.

- Runs in: `workspace-service` (disk access, watching, search), `ui` (file tree, viewer, go-to-file).
- Third-party packages allowed: `@parcel/watcher` and `write-file-atomic` (service only), `codemirror` packages and `micromark` through `ui-kit`, `zod`.

## Parts

| Part | Where | Does |
|---|---|---|
| File store | service | Read, stat, atomic save, create, rename, trash |
| Watcher | service | Watches the roots, batches hints, feeds the file list |
| File list | service | In-memory list of project file paths for search |
| Hot-exit store | service | Keeps unsaved editor buffers on disk |
| Files view | ui, side view `files.tree` | The file tree |
| Viewer | ui, dock panel `files.viewer` | Shows and edits one file |
| Go to file | ui | File mode of the command palette |

## Roots

The service touches only paths inside these folders. Anything else returns `FILE_OUTSIDE_ROOT`.

- the open project folder
- the vault folder from settings
- HSOS's `configRoot`
- `%USERPROFILE%\.claude` and `%USERPROFILE%\.agents`

A path is checked after resolving `..` and symbolic links.

## Behaviour

### Reading

- **FILE-1.** `listDir` returns one folder's entries, folders first, each group sorted by name ignoring case. Names matching `hidePatterns` are left out. Names matching `dimPatterns` have `isDimmed: true`.
- **FILE-2.** `read` classifies a file:

| Kind | When |
|---|---|
| `image` | extension is `png`, `jpg`, `jpeg`, `gif`, `webp`, `svg`, `ico`, `bmp` |
| `too-large` | size above `maxEditableBytes` |
| `binary` | a zero byte appears in the first 8 000 bytes and the file is not UTF-16 with a byte order mark |
| `text` | everything else |

- **FILE-3.** For `text`, the service detects the encoding (UTF-8 with or without byte order mark, UTF-16 LE with byte order mark) and the line ending (`crlf` when the first line break is `\r\n`, else `lf`), and returns the text with every line break as `\n`.
- **FILE-4.** `version.hash` is the SHA-256 of the file's bytes on disk.

### Saving

- **FILE-20.** `save` converts `content` back to `format.eol` and `format.encoding`, so a file keeps its original encoding and line endings. A trailing line break is kept or omitted exactly as it is in `content`.
- **FILE-21.** Before writing, `save` reads the file's current hash. If it differs from `baseHash` and `overwrite` is false, `save` returns `FILE_CHANGED_ON_DISK` and writes nothing (P-2).
- **FILE-22.** If the file does not exist and `baseHash` is not null, `save` returns `FILE_CHANGED_ON_DISK` with details `{ deleted: true }`.
- **FILE-23.** Writing is atomic (P-3). Before the write, every contribution to `fileWriteObservers` has `beforeWrite` awaited with the old bytes. After it, `afterWrite` is awaited with the new bytes. An observer that throws is logged and does not stop the save.
- **FILE-24.** A write failure returns `FILE_WRITE_FAILED` with the system's reason. The original file is unchanged.
- **FILE-25.** `save` returns the new `FileVersion`, which the editor uses as its next `baseHash`.
- **FILE-26.** Saves to the same path run one at a time, in the order received.

### Creating, renaming, deleting

- **FILE-30.** `createFile` and `createDir` return `FILE_EXISTS` when the path is taken. Missing parent folders are created.
- **FILE-31.** `rename` returns `FILE_EXISTS` when the target exists. It never replaces a file.
- **FILE-32.** `trash` awaits `beforeTrash` on every observer, then calls `shell.trashItem` (P-1).

### Watching

- **FILE-40.** The service watches the open project and the vault with `watcherExclude` applied. Watching starts on `workspace.projectChanged` and stops for the previous project.
- **FILE-41.** Watcher events are collected for 100 ms and emitted as one `files.changed` batch. Several events for one path collapse to one: created then deleted cancels out; anything then deleted is `deleted`; otherwise the first kind wins.
- **FILE-42.** Every consumer of `files.changed` re-reads before acting (P-16).
- **FILE-43.** If the watcher fails or reports an overflow, the service logs a warning, restarts the watch, and emits `files.changed` with an empty list plus the event `files.rescanNeeded`. The tree and file list then reload fully.
- **FILE-44.** When the window regains focus, open viewers call `stat` for their file, and the tree reloads its expanded folders.

### Search

- **FILE-50.** The file list holds every file path in the project except those under `hidePatterns` or `dimPatterns` names. It is built by a walk at project open and kept current from watcher batches.
- **FILE-51.** `search` ranks by: exact file name, file name prefix, word-start match in the file name, subsequence in the file name, subsequence in the relative path. Ties go to the shorter path. An empty query returns the most recently opened files.

### Files view

- **FILE-60.** The tree shows the project root's entries. Folders load their children when first expanded. Expanded folders and the selection are saved in the view's state.
- **FILE-61.** A `files.changed` batch reloads only the affected folders that are loaded.
- **FILE-62.** Activating a file (Enter or double click) opens it in a viewer. A single click selects and, when a preview viewer exists, shows it there; the preview viewer's tab title is italic and it is replaced by the next single click. Editing or double-clicking makes it a normal tab.
- **FILE-63.** Keys: arrows move; Right and Left expand and collapse; `F2` renames in place; `Delete` trashes after confirmation when `confirmTrash` is on; `Ctrl+N` new file; `Ctrl+Shift+N` new folder; `Ctrl+C` copies the path.
- **FILE-64.** Context menu: Open, Open to the Side, Reveal in Explorer, Open Terminal Here, Copy Path, Copy Relative Path, Send Path to Terminal, Rename, Delete, Show History.
- **FILE-65.** Files and folders can be dragged onto a terminal (TERM-44) and into folders within the tree, which renames them (FILE-31 applies).
- **FILE-66.** A file with unsaved changes in a viewer shows a dot after its name in the tree.

### Viewer

- **FILE-70.** The viewer shows by kind:

| Kind | Shows |
|---|---|
| `text` | `CodeView` with syntax colours by extension, editable |
| markdown text (`.md`, `.mdx`) | preview or source, switched by a toggle in the tab bar and `Ctrl+Shift+V`; starts in preview when `markdownPreviewFirst` |
| `image` | the image, fitted, on a checkered background, with its pixel size |
| `binary` | "This file is not text." with "Reveal in Explorer" |
| `too-large` | "This file is too large to edit here." with its size and "Reveal in Explorer" |

- **FILE-71.** The buffer is dirty when its text differs from the last loaded or saved text. A dirty tab shows a dot in place of its close icon.
- **FILE-72.** `Ctrl+S` saves through `files.save` with the loaded `format` and `baseHash`.
- **FILE-73.** When the file changes on disk and the buffer is not dirty, the viewer reloads it silently and keeps the scroll position and cursor line.
- **FILE-74.** When the file changes on disk and the buffer is dirty, or `save` returns `FILE_CHANGED_ON_DISK`, a bar appears above the editor: "This file changed on disk." with "Compare", "Reload from disk" and "Overwrite". Compare opens a `DiffView` of disk against buffer. Overwrite saves with `overwrite: true`. Nothing is written until the owner chooses.
- **FILE-75.** When the file is deleted on disk, a bar says "This file was deleted." with "Save to recreate" and "Close". The buffer is kept.
- **FILE-76.** Closing a dirty viewer asks "Save changes to <name>?" with Save, Don't Save, Cancel.
- **FILE-77.** A dirty buffer is sent with `storeUnsaved` 1 000 ms after the last edit and removed with `discardUnsaved` when it is saved or closed without saving. At project open, `listUnsaved` buffers are reopened as dirty viewers (REL-6).
- **FILE-78.** Opening a path already open focuses that viewer. `state.line`, when set, places the cursor on that line and centres it.
- **FILE-79.** Links in a markdown preview: a relative link to a file opens it in a viewer; a wiki link `[[Note]]` is resolved through the `graph` module when present; an `https:` link opens in a browser panel when present, else externally.

## Commands

| Id | Title | Default key |
|---|---|---|
| `files.show` | Show Files | `Ctrl+Shift+E` |
| `files.goToFile` | Go to File | `Ctrl+P` |
| `files.save` | Save | `Ctrl+S` |
| `files.newFile` | New File | `Ctrl+N` when the tree has focus |
| `files.togglePreview` | Toggle Markdown Preview | `Ctrl+Shift+V` |
| `files.revealActive` | Reveal Active File in Tree | none |

## States

| Panel | Loading | Empty | Error |
|---|---|---|---|
| Files view | skeleton rows | "This folder is empty." with "New file" | "The folder could not be read." with the reason and "Retry" |
| Viewer | skeleton lines | an empty file is a normal empty editor | "This file could not be opened." with the reason and "Retry" |

## Tests

| Rule | Level | Given | When | Then |
|---|---|---|---|---|
| Roots | integration | a project in a temp folder | `read` of `..\outside.txt` resolved outside | `FILE_OUTSIDE_ROOT` |
| FILE-1 | integration | entries `b.txt`, `A`, `.git`, `node_modules` | `listDir` | order is `A`, `node_modules`, `b.txt`; `.git` absent; `node_modules` dimmed |
| FILE-2 | integration | a file with a zero byte at position 10 | `read` | kind `binary` |
| FILE-3 | integration | a UTF-8 file with a byte order mark and `\r\n` endings | `read` | text has `\n` only; format is `utf8-bom`, `crlf` |
| FILE-20 | integration | that file, read then saved with one word changed | bytes on disk are compared | byte order mark and `\r\n` are preserved; only the word differs |
| FILE-20 | property | random text, encoding and line ending | write, `read`, `save` unchanged | bytes on disk are identical to the original |
| FILE-21 | integration | a file read, then changed by another writer | `save` with the old `baseHash` | `FILE_CHANGED_ON_DISK`; disk holds the other writer's content |
| FILE-21 | integration | the same | `save` with `overwrite: true` | disk holds the editor's content |
| FILE-22 | integration | a file read, then deleted | `save` | `FILE_CHANGED_ON_DISK` with `deleted: true`; no file created |
| FILE-23 | integration | an observer that records calls | `save` | `beforeWrite` got the old bytes, then `afterWrite` the new bytes |
| FILE-23 | integration | an observer that throws | `save` | the save succeeds and one error is logged |
| FILE-24 | integration | a store whose write fails | `save` | `FILE_WRITE_FAILED`; original bytes intact |
| FILE-26 | integration | two saves to one path sent together | both finish | disk holds the second; the second's `baseHash` check ran after the first write |
| FILE-31 | integration | `a.txt` and `b.txt` | `rename` a to b | `FILE_EXISTS`; both unchanged |
| FILE-41 | unit | events: create x, change x, delete x, change y, change y | batching | the batch is `y changed` only |
| FILE-43 | integration | a fake watcher that reports failure | the service handles it | the watch is started again and `rescanNeeded` is emitted |
| FILE-51 | unit | files `src/app.ts`, `src/apple/map.ts`, `docs/happy.md` | query `app` | order is `src/app.ts`, `src/apple/map.ts`, `docs/happy.md` |
| FILE-61 | component | folder `src` expanded, `docs` collapsed | a change in `docs/x.md` and one in `src/y.ts` | only `src` is listed again |
| FILE-73 | component | a clean viewer | the file changes on disk | the editor shows the new text; no bar |
| FILE-74 | component | a dirty viewer | the file changes on disk | the bar shows; the buffer text is unchanged; no save happened |
| FILE-74, REL-8 | e2e | a file open with unsaved edits | another process rewrites it, then `Ctrl+S` | the bar shows and the disk content is the other process's |
| FILE-77, REL-6 | fault | a viewer with unsaved text | the app is killed and started again | the viewer reopens dirty with that text |
| FILE-32, REL-9 | e2e | a file in the tree | Delete, confirm | the file is gone from the folder and present in the Recycle Bin |
| FILE-23, REL-2 | fault | a 4 MB save in progress | `workspace-service` is killed | the file's hash equals the old hash or the new hash |
