# Glossary

**HSOS**: The app this repo specifies.

**Owner**: The one person who uses HSOS.

**Project**: A folder on disk the owner opens in HSOS. One project is active per window.

**Vault**: One extra folder of markdown notes, chosen in settings, shown in the graph beside the project.

**Workspace**: The saved arrangement for a project: layout, open panels, terminal folders, browser tabs.

**Panel**: One rectangular area of the window showing one thing, such as a terminal or the file tree.

**Dock**: The area that holds panels and lets the owner drag, split and tab them.

**Terminal**: A panel showing one shell.

**Shell**: A running command-line program, PowerShell by default, connected to a terminal.

**PTY host**: The process that owns every shell.

**Reattach**: A terminal panel reconnecting to a shell that kept running while the UI reloaded.

**Shell integration**: The PowerShell script HSOS loads into every shell (`terminal-init.ps1`). It makes Shift+Enter start a new line and prints prompt marks and the current folder.

**Prompt mark**: An invisible `OSC 133` sequence the shell prints where a prompt starts, ends, and where a command starts and finishes. HSOS uses it to jump between commands.

**Bracketed paste**: A mode a program turns on so pasted text arrives wrapped in markers, as one block, instead of as typed keys. Claude Code uses it.

**Dictation app**: A program such as Wispr Flow that turns speech into text, puts the text on the clipboard and presses a paste key in the focused window.

**Claude session**: One running Claude Code conversation, identified by its session id.

**Subagent**: An agent started by a Claude session.

**HUD**: The panel showing Claude sessions, subagents, usage limits and skills.

**Usage window**: A period over which Claude limits usage: five hours or seven days.

**Cache state**: Whether a Claude session's prompt cache is still warm, judged from how long the session has been idle.

**Skill**: A folder with a `SKILL.md` file that Claude Code can run as a slash command.

**Skills deck**: The part of the HUD that lists skills and starts them.

**Background run**: A skill started by HSOS outside any terminal, with a chosen model and effort, ending in a report.

**Attention board**: The part of the HUD that groups Claude sessions by whether they need the owner, are working, or are done.

**Session recap**: A short summary of what a Claude session did while its terminal was out of view.

**Worktree session**: A Claude session started in its own git worktree.

**Changes panel**: The panel showing a live diff of the project against the last commit or a session's start.

**Pinned comment**: A note the owner attaches to a diff line, file line, artifact or captured element.

**Feedback tray**: The list of pinned comments waiting to be sent to a terminal as one prompt.

**Snapshot**: A stored copy of one file's content at one moment.

**Local history**: All snapshots, kept outside the project.

**Activity timeline**: One list, newest first, of every file change HSOS observed, with its cause.

**Artifact**: A file Claude produced for the owner to look at: an HTML page, PDF or image.

**Artifacts inbox**: The searchable gallery of artifacts.

**Note**: A markdown file in the project or the vault.

**Link**: A reference from one note to another note, heading or block.

**Backlink**: A link seen from the note it points to.

**Graph**: The view of notes as nodes and links as edges.

**Browser panel**: A panel showing web pages in an isolated profile.

**Element capture**: Picking an element in a browser panel and sending its markup and styles to a terminal.

**Agent control**: The state in which Claude is driving a browser panel.

**Module**: A unit of HSOS with one contract, one folder and one `register` function.

**Contract**: The types and message shapes a module exposes to others.

**Bus**: The typed message channel between processes.

**Service**: The part of a module that runs outside the UI process.

**Token (design)**: A named design value such as a colour or a duration.

**Theme**: A JSON file giving a value to every design token.

**Spec author**: The model that writes this spec.

**Implementer**: The model that writes HSOS from this spec.

**Agent view**: The graph mode that marks the files Claude Code loads at every session start and shows how many link hops each other note is from them.

**Loaded at start**: A file Claude Code puts into every session's context before the first prompt: `CLAUDE.md` files, their `@path` imports, rules without `paths`, and the first 200 lines of the memory index. Everything else is read only when needed.

**Claude setup view**: The HUD panel that lists the owner's MCP servers, plugins, skills, subagents, hooks and permission rules with when each was last used.

**Spoken alert**: A sentence HSOS says aloud with the Windows voice when a Claude session finishes or needs the owner.
