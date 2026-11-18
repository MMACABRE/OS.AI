# Stage 5: Graph

At the end of this stage the owner sees the notes of the project and vault, Claude's instructions, skills and memory as one link graph, and Claude can search it.

---

## 096 Note index

**Goal.** An index of every note, kept current.

**Stage.** 5

**Read first.** `spec/modules/graph.md` "Roots indexed", "Index", GRAPH-1 to GRAPH-8, `spec/reference/markdown-links.ts`, `spec/contracts/channels/graph.ts`.

**Files.** `src/modules/graph/service/markdown-links.ts` (copy of the reference), `src/modules/graph/service/note-index.ts`, `src/modules/graph/service/index-queue.ts`, `src/modules/graph/service/note-kind.ts`, `src/modules/graph/register.service.ts`, `src/services/workspace-service/module-list.ts`.

**Steps.** Implement the rules.

**Tests.** `tests/graph/markdown-links.test.ts`: the reference self-check cases. `tests/graph/note-index.test.ts`: GRAPH-1, GRAPH-2, GRAPH-5, GRAPH-7, GRAPH-8.

**Done when.** Tests pass.

**Commit.** `feat(graph): index notes`

---

## 097 Link resolution

**Goal.** Links resolve the way Obsidian users expect.

**Stage.** 5

**Read first.** `spec/modules/graph.md` GRAPH-10 to GRAPH-17.

**Files.** `src/modules/graph/service/resolve-link.ts`, `src/modules/graph/service/note-index.ts`, `src/modules/graph/service/graph-queries.ts`, `src/modules/graph/register.service.ts`.

**Steps.** `resolve-link.ts` is a pure function over a name index. `graph-queries.ts` answers `getGraph`, `backlinks`, `outgoing`, `resolve`, `search`.

**Tests.** `tests/graph/resolve-link.test.ts`: GRAPH-11 to GRAPH-15 rows. `tests/graph/note-index.test.ts`: GRAPH-17.

**Done when.** Tests pass.

**Commit.** `feat(graph): resolve links`

---

## 098 Graph view

**Goal.** The graph, drawn with care.

**Stage.** 5

**Read first.** `spec/modules/graph.md` GRAPH-20 to GRAPH-29, "States", `spec/design/visual-direction.md` "Colour roles".

**Files.** `src/modules/graph/panel/GraphView.tsx`, `src/modules/graph/panel/GraphView.module.css`, `src/modules/graph/panel/build-graph.ts`, `src/modules/graph/panel/layout-worker.ts`, `src/modules/graph/panel/GraphToolbar.tsx`, `src/modules/graph/register.ui.ts`.

**Steps.** Build the view with sigma and graphology. ForceAtlas2 runs in `layout-worker.ts` as a web worker. Node and edge colours read the CSS variables at draw time so a theme change applies at once.

**Tests.** `tests/graph/build-graph.test.ts`: node size formula; community colouring assigns 8 hues in turn. `tests/graph/graph-view.ui.test.tsx`: GRAPH-20, GRAPH-23, GRAPH-26, GRAPH-29 with sigma's WebGL replaced by a test stub in jsdom.

**Done when.** Tests pass. Feature `F-047` passes.

**Commit.** `feat(graph): add the graph view`

---

## 099 Local graph, backlinks and Claude tools

**Goal.** The graph follows the open note, links in previews work, and Claude can search notes.

**Stage.** 5

**Read first.** `spec/modules/graph.md` GRAPH-30 to GRAPH-32, `spec/modules/files.md` FILE-79, `spec/modules/cli.md` "graph".

**Files.** `src/modules/graph/panel/LocalGraph.tsx`, `src/modules/graph/panel/Backlinks.tsx`, `src/modules/files/panel/FileViewer.tsx`, `src/modules/cli/service/commands/graph-commands.ts`, `src/modules/cli/register.service.ts`, `src/modules/graph/register.ui.ts`.

**Steps.** Implement the rules and the three graph commands.

**Tests.** `tests/graph/local-graph.ui.test.tsx`: GRAPH-30, GRAPH-31. `tests/files/markdown-links.ui.test.tsx`: GRAPH-32. `tests/cli/graph-commands.test.ts`: each command maps to its channel.

**Done when.** Tests pass. Feature `F-048` passes.

**Commit.** `feat(graph): add local graph, backlinks and graph commands`

---

## 100 Stage 5 checks

**Goal.** The graph stays smooth with thousands of notes.

**Stage.** 5

**Read first.** `spec/02-architecture.md` §10, `spec/modules/graph.md` "Tests".

**Files.** `tests/e2e/stage-5.e2e.ts`, `tests/fixtures/make-vault.ts`.

**Steps.** `make-vault.ts` generates 5 000 notes with random links, tags and a few `CLAUDE.md` and `SKILL.md` files in a temp folder. The test sets it as the vault, waits for indexing, opens the graph and measures frame rate over 3 seconds idle and while hovering nodes.

**Tests.** That file.

**Done when.** Tests pass. Record the frame rates and indexing time in `PROGRESS.md`. Feature `F-049` passes.

**Commit.** `test: prove stage 5 with a large vault`
