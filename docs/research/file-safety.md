# Protecting files and surviving crashes

Ticket: "Protecting files and surviving crashes". Researched 2026-11-17 in the main session.

Marks: **[V]** checked against the named source today. **[U]** from the researcher's own knowledge, not re-checked.

## Summary

1. Most file damage from desktop apps has four causes: a write interrupted halfway, two writers on one file, an app acting on stale state, and a delete with no way back. Each has a standard defence.
2. Interrupted writes: write to a temporary file in the same folder, flush it to disk, then rename it over the target. The `write-file-atomic` package does this and queues writes to the same file in order. [V]
3. Two writers: HSOS is never the only writer, because Claude Code edits the same files. Before saving, compare the file on disk with the version that was opened. If it changed, ask, never overwrite.
4. Stale state: watch the folder and refresh. On Windows the watcher can miss or repeat events, so every watcher event is a hint to re-read, never a fact to act on. [U]
5. Deletes: send files to the Recycle Bin, never delete permanently. [U]
6. Crashes: isolate risky work in separate processes. Electron's `utilityProcess` creates a child process with Node.js and message ports and reports `exit`. A supervisor restarts what dies. [V]
7. A local history of file versions, kept outside the project, gives undo for anything, including changes made by Claude. VS Code's Timeline shows git commits and local saves per file. [V]

## Defences

| Threat | Defence | Status |
|---|---|---|
| Power loss or crash during save | Temp file, fsync, rename | `write-file-atomic`, fsync on by default [V] |
| Two saves racing in HSOS | Serialise writes per file | `write-file-atomic` queues them [V] |
| Claude edits a file open in the viewer | Detect change by modified time and hash before save; show a diff and ask | Design rule [U] |
| Watcher misses an event | Re-read on focus and before any write | Design rule [U] |
| Accidental delete | Recycle Bin through the shell API | Electron `shell.trashItem` [U] |
| Bad edit, by anyone | Local history snapshot per change | Modelled on VS Code Timeline [V] |
| One part crashes | Separate processes and a supervisor | `utilityProcess` [V] |
| HSOS's own settings get corrupted | Atomic writes, a schema check on load, keep the last good copy | Design rule [U] |
| App closes with unsaved edits | Hot exit: unsaved buffers stored on disk and restored | As in VS Code [U] |

## Process layout for reliability

- **Main process.** Small. Starts and supervises the others. Does no heavy work.
- **PTY host.** Owns the shells. Survives a UI reload.
- **Workspace service.** File watching, indexing, local history, git commands.
- **UI renderer.** Draws everything. Can crash and reload without data loss.
- **Browser panes.** One isolated view each.

Rules:
- Every process may die at any time. The others must stay correct.
- State that matters is on disk before it is acknowledged.
- A restarted process rebuilds its state from disk and from the processes still alive.

## Local history

- Snapshot a file when HSOS saves it and when the watcher sees an outside change.
- Store snapshots by content hash under HSOS's data folder, with an index of path, time and source (HSOS, external, Claude session id when known from hooks).
- Limits: maximum file size, maximum age, maximum total size, and an ignore list (`node_modules`, `.git`, build output).
- Restore writes through the same atomic path and is itself snapshotted.

## How the implementer proves it

- **Fault injection tests.** Kill each process during a save, a snapshot and an index update, then check that files are whole.
- **Property tests.** Random sequences of edit, external change, save and restore must never lose the last acknowledged content.
- **Soak test.** Hours of terminal output and file churn with memory and handle counts recorded.
- **Crash log.** Every unexpected exit writes a local report with the process name and last actions.

## What HSOS never does

- Permanently delete a user file.
- Write inside the vault from the graph feature.
- Overwrite a file that changed on disk since it was opened, without asking.
- Run git commands that rewrite or discard history.

These are proposals for the ticket "File safety rules".

## Not settled

- NTFS guarantees for rename over an existing file, and antivirus interference with temp files. No Microsoft source was read.
- Which file watcher library is most reliable on Windows.
- VS Code's local history setting names and defaults.
- Whether node-pty loads in a `utilityProcess`. The Electron page does not mention native modules.

## Sources

- https://github.com/npm/write-file-atomic
- https://www.electronjs.org/docs/latest/api/utility-process
- https://code.visualstudio.com/docs/sourcecontrol/overview
