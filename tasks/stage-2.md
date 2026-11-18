# Stage 2: Files

At the end of this stage the owner browses, views and edits project files while Claude edits the same files, with no silent overwrite, and can restore any earlier version of any file.

---

## 050 Reading files

**Goal.** Files are listed and read with their kind, encoding and line endings.

**Stage.** 2

**Read first.** `spec/modules/files.md` "Roots", FILE-1 to FILE-4, `spec/contracts/channels/files.ts`.

**Files.** `src/modules/files/service/file-store.ts`, `src/modules/files/service/roots.ts`, `src/modules/files/service/text-codec.ts`, `src/modules/files/register.service.ts`, `src/services/workspace-service/module-list.ts`.

**Steps.** Implement the roots check, `listDir`, `read`, `stat`.

**Tests.** `tests/files/read.test.ts`: the "Roots" row, FILE-1, FILE-2, FILE-3.

**Done when.** Tests pass.

**Commit.** `feat(files): list and read files`

---

## 051 Saving safely

**Goal.** Saves keep encoding and line endings, never overwrite a changed file without consent, and notify observers.

**Stage.** 2

**Read first.** `spec/modules/files.md` FILE-20 to FILE-26, `FileWriteObserver` and `fileWriteObservers` in `spec/contracts/channels/files.ts`, P-2, P-3.

**Files.** `src/modules/files/service/save-file.ts`, `src/modules/files/service/write-queue.ts`, `src/modules/files/service/file-store.ts`, `src/modules/files/register.service.ts`.

**Steps.** Implement FILE-20 to FILE-26. Writes use `write-file-atomic` with `fsync: true`.

**Tests.** `tests/files/save.test.ts`: FILE-20 to FILE-26 rows, including the property test.

**Done when.** Tests pass. Feature `F-019` passes.

**Commit.** `feat(files): save files safely`

---

## 052 Create, rename, trash

**Goal.** File operations that never destroy anything.

**Stage.** 2

**Read first.** `spec/modules/files.md` FILE-30 to FILE-32.

**Files.** `src/modules/files/service/file-operations.ts`, `src/modules/files/register.service.ts`.

**Steps.** Implement FILE-30 to FILE-32.

**Tests.** `tests/files/operations.test.ts`: FILE-30, FILE-31, FILE-32 with a fake `shell.trashItem`.

**Done when.** Tests pass.

**Commit.** `feat(files): create, rename and trash files`

---

## 053 Watching

**Goal.** Changes on disk arrive as clean batches.

**Stage.** 2

**Read first.** `spec/modules/files.md` FILE-40 to FILE-44.

**Files.** `src/modules/files/service/watch-roots.ts`, `src/modules/files/service/batch-changes.ts`, `src/modules/files/register.service.ts`.

**Steps.** Use the watcher from card 004. Implement FILE-40, FILE-41, FILE-43.

**Tests.** `tests/files/batch-changes.test.ts`: FILE-41. `tests/files/watch-roots.test.ts`: FILE-43 with a fake watcher.

**Done when.** Tests pass.

**Commit.** `feat(files): watch project folders`

---

## 054 File search

**Goal.** `Ctrl+P` finds any file in a few keystrokes.

**Stage.** 2

**Read first.** `spec/modules/files.md` FILE-50, FILE-51, `spec/modules/ui-kit.md` UI-12.

**Files.** `src/modules/files/service/file-list.ts`, `src/modules/files/service/rank-files.ts`, `src/modules/files/panel/go-to-file.ts`, `src/modules/files/register.ui.ts`, `src/modules/files/register.service.ts`.

**Steps.** Implement FILE-50, FILE-51 and the file mode of the palette.

**Tests.** `tests/files/rank-files.test.ts`: FILE-51.

**Done when.** Tests pass. Feature `F-020` passes.

**Commit.** `feat(files): add go to file`

---

## 055 Files view

**Goal.** The file tree.

**Stage.** 2

**Read first.** `spec/modules/files.md` FILE-60 to FILE-66, "States".

**Files.** `src/modules/files/panel/FilesView.tsx`, `src/modules/files/panel/FilesView.module.css`, `src/modules/files/panel/use-file-tree.ts`, `src/modules/files/panel/file-tree-menu.ts`, `src/modules/files/register.ui.ts`.

**Steps.** Build the view on `ui-kit` `Tree`.

**Tests.** `tests/files/files-view.ui.test.tsx`: FILE-61, keys of FILE-63, the empty and error states.

**Done when.** Tests pass. Feature `F-021` passes.

**Commit.** `feat(files): add the file tree`

---

## 056 Viewer

**Goal.** Code, markdown and images open in the viewer.

**Stage.** 2

**Read first.** `spec/modules/files.md` FILE-70, FILE-71, FILE-72, FILE-78, FILE-79, `spec/modules/ui-kit.md` (`CodeView`, `MarkdownView`), UI-5.

**Files.** `src/modules/ui-kit/components/CodeView.tsx`, `src/modules/ui-kit/components/MarkdownView.tsx`, `src/modules/files/panel/FileViewer.tsx`, `src/modules/files/panel/FileViewer.module.css`, `src/modules/files/register.ui.ts`, `src/modules/ui-kit/index.ts`.

**Steps.** Build `CodeView` on CodeMirror with a theme from tokens and language support by extension for `ts`, `tsx`, `js`, `jsx`, `json`, `md`, `css`, `html`, `py`, `rs`, `go`, `yaml`, `toml`, `ps1`, `sh`. Build `MarkdownView` on `micromark` with HTML disabled. Build the viewer panel `files.viewer`.

**Tests.** `tests/ui-kit/markdown-view.ui.test.tsx`: UI-5. `tests/files/file-viewer.ui.test.tsx`: each kind of FILE-70; `Ctrl+S` calls `save` with `baseHash`; FILE-78.

**Done when.** Tests pass. Feature `F-022` passes.

**Commit.** `feat(files): add the file viewer`

---

## 057 Edits that never get lost

**Goal.** Changed-on-disk handling and hot exit.

**Stage.** 2

**Read first.** `spec/modules/files.md` FILE-73 to FILE-77, FILE-44.

**Files.** `src/modules/files/panel/disk-change-bar.tsx`, `src/modules/files/panel/use-buffer-sync.ts`, `src/modules/files/panel/FileViewer.tsx`, `src/modules/files/service/hot-exit-store.ts`, `src/modules/files/register.service.ts`.

**Steps.** Implement FILE-73 to FILE-77 and FILE-44 for viewers.

**Tests.** `tests/files/disk-changes.ui.test.tsx`: FILE-73, FILE-74. `tests/e2e/files-safety.e2e.ts`: FILE-74 and REL-8, FILE-77 and REL-6, FILE-32 and REL-9.

**Done when.** Tests pass. Features `F-023`, `F-024` pass.

**Commit.** `feat(files): protect edits against outside changes and crashes`

---

## 058 History store

**Goal.** Snapshots stored by content, written in a crash-safe order.

**Stage.** 2

**Read first.** `spec/modules/history.md` "Storage", HIST-1 to HIST-4, HIST-8, `spec/contracts/channels/history.ts`.

**Files.** `src/modules/history/service/history-store.ts`, `src/modules/history/service/object-store.ts`, `src/modules/history/service/write-observer.ts`, `src/modules/history/register.service.ts`, `src/services/workspace-service/module-list.ts`.

**Steps.** Implement the store, HIST-1 to HIST-4, and contribute the observer to `fileWriteObservers`.

**Tests.** `tests/history/history-store.test.ts`: HIST-1 to HIST-4 rows.

**Done when.** Tests pass.

**Commit.** `feat(history): store file snapshots`

---

## 059 Snapshots of outside changes

**Goal.** Changes by Claude and other programs are captured.

**Stage.** 2

**Read first.** `spec/modules/history.md` HIST-5 to HIST-7, HIST-9.

**Files.** `src/modules/history/service/watch-snapshots.ts`, `src/modules/history/service/snapshot-queue.ts`, `src/modules/history/register.service.ts`.

**Steps.** Implement HIST-5 to HIST-7 and HIST-9, and `snapshotNow`.

**Tests.** `tests/history/watch-snapshots.test.ts`: HIST-5, HIST-6, HIST-7 rows.

**Done when.** Tests pass.

**Commit.** `feat(history): snapshot outside changes`

---

## 060 Restore and retention

**Goal.** Any version can be restored, and history stays within its limits.

**Stage.** 2

**Read first.** `spec/modules/history.md` HIST-20 to HIST-23, HIST-30 to HIST-33.

**Files.** `src/modules/history/service/restore.ts`, `src/modules/history/service/prune.ts`, `src/modules/history/register.service.ts`.

**Steps.** Implement the rules. `restore` writes through the `files.writeBytes` channel with cause `restore`, so the file is written atomically and the observers run (HIST-20). Implement that channel's handler in `files` as part of this card, in `src/modules/files/service/write-bytes.ts`, which this card may create.

**Tests.** `tests/history/restore.test.ts`: HIST-20, HIST-21, HIST-23. `tests/history/prune.test.ts`: HIST-30 to HIST-32.

**Done when.** Tests pass.

**Commit.** `feat(history): restore versions and prune history`

---

## 061 History timeline

**Goal.** The owner sees every version of a file and restores one in two clicks.

**Stage.** 2

**Read first.** `spec/modules/history.md` HIST-40 to HIST-43, "States", `spec/modules/ui-kit.md` (`DiffView`).

**Files.** `src/modules/ui-kit/components/DiffView.tsx`, `src/modules/ui-kit/components/DiffView.module.css`, `src/modules/history/panel/HistoryTimeline.tsx`, `src/modules/history/panel/HistoryTimeline.module.css`, `src/modules/history/register.ui.ts`, `src/modules/ui-kit/index.ts`.

**Steps.** Build `DiffView` with the `diff` package (inline and split modes, folded unchanged runs). Build the timeline panel.

**Tests.** `tests/history/timeline.ui.test.tsx`: HIST-40, HIST-42, HIST-43, states. `tests/ui-kit/diff-view.ui.test.tsx`: added and removed lines carry the diff tokens; a 20-line unchanged run folds.

**Done when.** Tests pass. Feature `F-025` passes.

**Commit.** `feat(history): add the file history timeline`

---

## 062 Stage 2 checks

**Goal.** Stage 2 meets the file safety bar.

**Stage.** 2

**Read first.** `spec/05-testing.md` REL-2, REL-3, REL-10, REL-12.

**Files.** `tests/e2e/stage-2-fault.e2e.ts`, `tests/history/history-property.test.ts`.

**Steps.** REL-2, REL-3, REL-10 (simulate the write error with a store whose write throws after the temp file is created) as fault tests. REL-12 as a fast-check property test against the real services in one process with a fake bus.

**Tests.** Those files.

**Done when.** Tests pass. Feature `F-026` passes.

**Commit.** `test: prove stage 2 file safety`
