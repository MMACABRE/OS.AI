# OS.AI: HSOS

HSOS is a personal Windows 11 desktop app built around a terminal that runs Claude Code. In one window it combines:

- terminals with tabs and splits that survive a UI crash and restore their history
- a file tree and viewer with safe editing alongside Claude
- local history of every file change, whoever made it, with one-click restore
- a HUD of every Claude session, who needs you, subagents, usage limits and prompt cache state
- a skills deck that runs skills in the background on a chosen model
- an activity timeline, an artifacts inbox, a live changes view and a feedback tray that sends pinned comments to Claude
- GitHub sync that never rewrites history, and Claude sessions in git worktrees
- a browser panel Claude drives through HSOS's own MCP server while you watch
- a link graph of notes, `CLAUDE.md` files, skills and memory

This repo holds the complete specification, written so that a smaller coding model can build HSOS from it task by task.

## Start here

- `spec/README.md`: what the spec contains and the order to read it
- `CLAUDE.md`: instructions for the model that builds HSOS
- `tasks/`: the 90 task cards
- `docs/JOURNAL.md`: every step and decision taken to write the spec
- Map of the decisions: [HSOS spec map](https://github.com/MMACABRE/OS.AI/issues/1)
