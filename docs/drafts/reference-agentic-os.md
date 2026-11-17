# Reference: the "agentic OS" video

Source: a video transcript the owner pasted on 2026-11-17. The owner likes this person's setup. Only the parts about the OS tool are noted here. Nothing in the transcript was checked against another source, and the app itself has not been seen, only described.

## What that tool is

A browser-based dashboard on localhost that sits beside the Claude Code desktop app. It is not a terminal. It organises the author's workspace around four things: apps, routines, memory and skills.

## Features described

| # | Feature | What it does |
|---|---|---|
| 1 | Home dashboard | Launches the author's micro apps. Shows next calendar items, next scheduled routines, flagged emails, and skills to trigger. |
| 2 | Artifacts inbox | Everything Claude produced (decks, PDFs, HTML pages) lands in one searchable place, so finding an old one costs no tokens. |
| 3 | Second brain graph | Every workspace file is a node, with a 3D view and a flat view. `CLAUDE.md` sits in the centre and routes to departments, skills, apps and routines. Search opens a file faster than the file explorer. |
| 4 | Timeline | Which files, skills and routines the agent edited last. |
| 5 | Routines tab | Scheduled tasks in a week view, sortable by tokens used per week. |
| 6 | Usage by skill and connector | Most used skills, token cost of each, and the ones never used. |
| 7 | Skills deck | Click a skill to run it in the background through `claude -p`, choosing model and effort. A short report appears when it ends. |
| 8 | Usage bar mod | 5-hour and 7-day limits, plus prompt cache state per session: idle time, tokens that would be re-cached, and the cost. |
| 9 | Cache keep-warm | Sessions ping themselves about hourly for four hours so the cache does not go cold. |
| 10 | Notes backlog | A `/note` skill parks an improvement idea in a file for later. |
| 11 | Recommendations app | A weekly routine lists suggested improvements. The author adds some to a cart and sends the list to Claude. |
| 12 | Review micro apps | Small local apps for reviewing Claude's output outside the chat, with pinned comments that are copied back to Claude. |
| 13 | Component library | Reusable UI parts and a brand book so every micro app looks the same. |
| 14 | Browser extensions | One captures the code of a page element to hand to Claude instead of a screenshot. |

## How it compares with HSOS as decided so far

| Their feature | HSOS today |
|---|---|
| Second brain graph (3) | Already in scope, including `CLAUDE.md`, skills and memory files as nodes. HSOS has no 3D view. |
| Timeline (4) | Partly in scope through local history. No cross-file "what did Claude touch" view yet. |
| Usage bar (8) | 5-hour and 7-day bars in scope. Prompt cache state is not. |
| Skills (7) | Skill finder pastes `/name` into the prompt. No background run with model and effort choice. |
| Design consistency (13) | Covered by the `ui-kit` module and design tokens. |
| Element capture (14) | Not in scope. Easy to add to the browser pane. |
| Artifacts inbox (2), home dashboard (1), micro apps (12), routines (5), usage analytics (6), notes (10), recommendations (11), keep-warm (9) | Not in scope. |

HSOS has things that tool lacks: a real terminal, shells that survive a crash, file safety and local history, GitHub sync, and a browser pane Claude drives.
