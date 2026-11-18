# Agent map, Claude setup view and spoken alerts

Asked by the owner on 2026-11-18, after reading a summary of a YouTube video about an "AI OS" setup, and after saying they like Obsidian-style linked notes as a way for agents to find information. Researched the same day by the spec author.

Marks: **[V]** checked today against the named source, or run on this machine. **[U]** not re-checked.

## The video, judged

| Idea | Verdict | Why |
|---|---|---|
| A map of everything in the setup, to prune what is unused | Take, read-only | HSOS already sees every tool call through hooks, so it can show real "last used" dates. HSOS never edits Claude Code's files (LINK-6). |
| Spoken alert when a session finishes or needs you | Take, with the voice built into Windows | Fixes a real problem the owner has: missing the moment a session stops. HUD-10 notifies only when the HSOS window is unfocused. |
| Fish Audio for the voice | Not taken | Needs a paid key and sends the text off the machine. Windows' own voices work offline. |
| "Turn this session into a skill" | Not taken | A prompt habit. The owner already has a skill-creator skill. |
| "Get to know me" memory prompt | Not taken | A prompt, nothing to build. |
| Connectors | Listed in the setup view only | Configuring them is Claude Code's and claude.ai's job. |
| Hourly email and calendar routine that replies to everyone automatically | Rejected | Already outside HSOS (capability map, "Left out"). Auto-replies send mail in the owner's name unreviewed, and inbound mail can carry instructions that steer the reply. |
| "20 to 30 percent more productive" | Ignored | No evidence. |

## Are linked notes really better for agents?

The owner's idea: start at a main `CLAUDE.md`, follow links from note to note, and read only what is needed, instead of loading the whole project.

Mostly right, with one correction and one trap.

- **It is a graph, not "neural".** Linked notes form a graph: notes are nodes, links are edges. A neural network is a different thing. Obsidian calls its view a graph view. Nothing about it learns.
- **What Claude Code loads at start, and what it reads on demand** [V, Claude Code memory docs and `.claude` directory reference]:
  - At start: `CLAUDE.md` files in the working directory and above it, `CLAUDE.local.md`, `~/.claude/CLAUDE.md`, every file those import with `@path` (up to four hops), rules in `.claude/rules/` and `~/.claude/rules/` without `paths:` frontmatter, and the first 200 lines (at most 25 KB) of the project's auto memory `MEMORY.md`.
  - On demand: `CLAUDE.md` files in subdirectories (when Claude reads a file there), rules with `paths:` (when Claude touches a matching file), memory topic files listed in `MEMORY.md`, and any file a link points to, when Claude decides to read it.
- **The trap: `@path` imports are not lazy.** The docs say imports "help you organize a long file but don't reduce its context cost, because imported files load together with the CLAUDE.md that imports them." A plain markdown link or a path in backticks costs nothing until Claude reads the file. So a linked note costs tokens only when it is needed; an imported one costs tokens every session.
- **The docs agree with the idea**: keep each `CLAUDE.md` under 200 lines and move detail into files that load only when needed. Claude Code's own auto memory works this way: `MEMORY.md` is an index of one-line pointers, and each topic file is read when relevant.
- **What makes it work**: a link is only followed if the agent can tell from the link text that it is worth reading. "`[[session-recovery]]`: design for auto-resume after a crash" gets followed; "see here" does not.
- **The weak spot**: a note nothing links to can't be found by following links. The agent must search for it. Today nobody can see which notes those are.

### Graphify compared

Graphify (the owner's skill) builds a knowledge graph from code and documents using syntax trees for code and an LLM for prose, and writes `graphify-out/graph.json` with a report. It answers questions about a codebase's structure. HSOS's `graph` module reads markdown links directly, with no LLM, and updates live as files change. They overlap little: graphify maps code, HSOS maps notes. HSOS does not read graphify output now.

## What HSOS adds

1. **Agent view in the graph.** It marks the files Claude Code loads at every start with their total line count, and warns about a `CLAUDE.md` or `MEMORY.md` over 200 lines. It draws `@path` imports as their own edge kind. It colours notes by how many link hops they are from the start files. It lists the notes no link reaches. And it shows, for any note, the chain of links an agent would follow to get there. A hover preview shows the start of a note without opening it.
2. **Claude setup view.** MCP servers, plugins, skills, subagents, hooks and permission rules, each with its scope, its file and when it was last used. It is read-only. "Ask Claude to remove" types a removal request into a Claude terminal.
3. **Spoken alerts.** Windows' built-in voice says "<session title>. Finished." plus the first sentence of Claude's last message, or "<session title>. Needs you." with the reason. It speaks unless you are already looking at that session's terminal.

## Facts behind the design

- **Windows speech.** `System.Speech.Synthesis.SpeechSynthesizer` from Windows PowerShell 5.1 lists "Microsoft David Desktop" and "Microsoft Zira Desktop" on this machine. A script given its text on stdin, with the voice and rate in environment variables, spoke 34 characters with Zira and exited 0. [V, run here] Chromium's `speechSynthesis` in Electron was not tested, so HSOS uses the proven path. [U for Electron]
- **MCP servers.** User servers are in `~/.claude.json` under `mcpServers`, local-scope servers under `projects["<path>"].mcpServers`, and project servers in `<project>\.mcp.json`. [V, Claude Code settings and directory docs] On this machine the user list is empty and the project entries have `enabledMcpjsonServers` and `disabledMcpjsonServers`. [V]
- **Plugins.** `~/.claude/plugins/installed_plugins.json` is `{ "version", "plugins": { "<name>@<marketplace>": [ { "scope", "installPath", "version", "installedAt", "lastUpdated", "gitCommitSha" } ] } }`. `enabledPlugins` in a settings file maps the same ids to `true` or `false`. [V, this machine; the file is named in the directory docs]
- **Usage counters.** `~/.claude.json` holds `skillUsage` (`{ "<skill>": { "usageCount", "lastUsedAt" } }`, 43 entries here) and `pluginUsage` (same shape plus `lastUsedNumStartups`). These keys are not documented. HSOS reads them when they have that shape and ignores them otherwise. [V for the shape on this machine; U for stability]
- **MCP tool names in hooks.** MCP tools reach hooks as `mcp__<server>__<tool>`. [U, from the hooks docs read on 2026-11-17 for claude-link]
- **Settings files.** `~/.claude/settings.json`, `<project>\.claude\settings.json` and `<project>\.claude\settings.local.json` hold `permissions.allow`, `permissions.ask`, `permissions.deny`, `hooks` and `enabledPlugins`. [V, settings docs]
- **Subagents.** `~/.claude/agents/*.md` and `<project>\.claude\agents\*.md`, with `name` and `description` frontmatter. [V, directory docs]
- **Auto memory folder.** `~/.claude/projects/<project path with every non-alphanumeric character replaced by "-">/memory/`. [V, 2026-11-17, `docs/drafts/session-recovery.md`]

## Sources

- Claude Code memory: https://code.claude.com/docs/en/memory
- Claude Code `.claude` directory: https://code.claude.com/docs/en/claude-directory
- Claude Code settings: https://code.claude.com/docs/en/settings
- System.Speech SpeechSynthesizer: https://learn.microsoft.com/en-us/dotnet/api/system.speech.synthesis.speechsynthesizer
- Chromium Windows TTS source (voice discovery, for the Electron path not taken): https://sources.debian.org/src/chromium/140.0.7339.127-1/content/browser/speech/tts_win.cc
