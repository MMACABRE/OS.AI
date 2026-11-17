# Markdown link graph at scale

Ticket: "Markdown link graph at scale". Researched 2026-11-17 in the main session.

Marks: **[V]** checked against the named source today. **[U]** from the researcher's own knowledge, not re-checked.

## Summary

1. A note graph has three jobs: parse links out of markdown files, keep an index that updates when files change, and draw the graph.
2. Obsidian's link grammar is small and documented: `[[Note]]`, `[[Note|text]]`, `[[Note#Heading]]`, `[[Note#^block]]`, `![[embed]]`, and ordinary markdown links to `.md` files. [V]
3. Paths in Obsidian links are written from the vault root with forward slashes. A bare name resolves by file name. [V for root paths, U for bare-name resolution]
4. Two WebGL graph libraries fit. sigma.js draws graphs kept in a graphology data structure and leaves layout to graphology's library. cosmos.gl computes the layout and draws on the GPU and handles hundreds of thousands of nodes. [V]
5. A personal vault plus one project is a few thousand notes at most. Both libraries handle that size. The choice turns on control over looks and interaction.
6. sigma.js is the better fit for HSOS: custom node and edge programs, hover and click handling, and graphology gives community detection and metrics for free. [V for graphology features, U for the fit judgement]
7. The index should be a small local database updated by a file watcher, so opening HSOS does not re-read every file.

## Link grammar to support [V]

| Syntax | Meaning |
|---|---|
| `[[Note]]`, `[[Note.md]]` | Link to a note |
| `[[Folder/Note]]` | Path from the vault root |
| `[[Note\|Display text]]` | Link with display text |
| `[[Note#Heading]]`, `[[Note#Heading#Sub]]` | Link to a heading |
| `[[#Heading]]` | Heading in the same note |
| `[[Note#^blockid]]` | Link to a block. Ids use letters, digits and dashes |
| `![[Note]]`, `![[Image.png]]` | Embed |
| `[Text](Folder/Note.md)`, `[Text](Note.md#Heading)` | Markdown link, spaces encoded as `%20` |

Also to parse: YAML frontmatter (`tags`, `aliases`) and inline `#tags`. [U]

Not links: anything inside code fences or inline code. [U]

## Index

- **Per file:** path, title, modified time, content hash, outgoing links (target text, kind, line), tags, aliases, headings, block ids.
- **Derived:** resolved target per link, backlinks per note, unresolved links.
- **Storage:** SQLite, one file per vault or project, kept in HSOS's data folder and never inside the vault. [U]
- **Updates:** a file watcher reports changes. Only changed files are re-parsed, decided by modified time and hash.
- **Read-only rule:** the graph feature never writes to the vault.

## Renderers

| Library | Layout | Scale claimed | Licence | Notes |
|---|---|---|---|---|
| sigma.js | From graphology (ForceAtlas2 and others) [U for the worker] | "Large graphs", no number given [V] | MIT [U] | WebGL, built on graphology, which supplies layouts, metrics and community detection [V] |
| cosmos.gl v3 | On the GPU in shaders [V] | Hundreds of thousands of points and links [V] | MIT [V] | Needs WebGL 2. Less control over per-node drawing [U] |
| d3-force with canvas | CPU | A few thousand [U] | ISC [U] | Simple, slows down on big graphs |

## Ideas above Obsidian's graph

- Node kinds with their own look: note, `CLAUDE.md`, skill, memory file, source file mentioned in a note.
- Community colouring from graphology's community detection.
- A local graph that follows the file open in the viewer.
- Time filter: show only notes changed in the last day or week, which shows what Claude touched.
- Click a node to open the note in the viewer; a second action sends its path to the active terminal.

## Not settled

- How Obsidian resolves a bare name when two notes share it.
- The exact frontmatter keys Obsidian treats as links.
- Measured frame rates for sigma.js at 5,000 nodes.

## Sources

- https://obsidian.md/help/links
- https://www.sigmajs.org/
- https://github.com/cosmosgl/graph
