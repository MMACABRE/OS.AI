# HSOS spec journal

A running log of every step taken toward the HSOS spec. Newest entry at the bottom.

## 2026-11-16

### Step 1. Repo set up

Cloned `MMACABRE/OS.AI` into the working folder. The repo held one commit and a one-line README.

### Step 2. Goal recorded

The owner's brief, as given:

- Produce a very detailed spec that a weak coding model (Haiku-class) can follow to build HSOS.
- HSOS is a Windows desktop app (`.exe`) built around a terminal that runs Claude Code.
- Parts named so far:
  - terminal
  - file sidebar and file viewing, like VS Code
  - GitHub login and sync
  - a built-in browser the AI can drive
  - an Obsidian-style view of linked markdown files
  - an agent HUD showing usage limits and the agents and subagents running on the device
  - quick access to the owner's personal skills
- Priorities: customisable, exceptional looks, code that is easy to change and extend, and reliable enough to trust with real files.
- Method: research agents gather how similar apps were built and which languages fit, before the spec is written.

### Step 3. Skills loaded

- `hsluck` bundle: 10 of 10 loaded.
- `hs24skills` bundle: 12 of 24 loaded. The other 12 are switched off for model use in settings: interview-me, idea-refine, constraint-driven-development, planning-and-task-breakdown, context-engineering, doubt-driven-development, security-and-hardening, ci-cd-and-automation, deprecation-and-migration, documentation-and-adrs, observability-and-instrumentation, shipping-and-launch.
- Task skills added: research, codebase-design, writing-for-agents, prototype.

### Step 4. Skill search started

Searched the skills registry for 20 topics. Results are listed in `docs/SKILLS.md` once the search is complete.

### Step 5. Wayfinder charting started

The work follows the wayfinder method: name the destination, list the open decisions, create a map and tickets, then run research agents on the research tickets. The first act is a round of questions to the owner to pin down the destination.
