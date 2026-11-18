# HSOS spec

HSOS is a Windows 11 desktop app for one owner. It is a working environment built around a terminal that runs Claude Code. This folder is the complete specification. A coding model builds HSOS by following it.

## Read in this order

| File | What it settles |
|---|---|
| `00-principles.md` | Priorities and the rules every module obeys |
| `01-capability-map.md` | The modules, their dependencies, the build order |
| `02-architecture.md` | Processes, the message bus, data on disk, the error model |
| `03-stack.md` | Exact versions, commands, folder layout, code style |
| `04-implementer-protocol.md` | The loop the implementer runs every session |
| `05-testing.md` | Test levels, what proves reliability |
| `design/` | Visual direction, tokens, layout, motion (`motion.md`), and the brief for the design round (`direction-brief.md`) |
| `contracts/` | The TypeScript types every module shares. These are real source files. |
| `modules/<id>.md` | One spec per module |
| `reference/` | Finished code to copy unchanged: `ring-buffer.ts`, `git-status-parser.ts`, `markdown-links.ts` (each with a self-check run by `npx tsx <file>`), `guard.mjs`, `init.ps1`, `terminal-init.ps1`, `shell-init.ps1`, `hsos-cli.sh` |
| `../tasks/stage-<n>.md`, `../tasks/stage-u.md` | 118 task cards, numbered 001 to 118 across eleven stages, in build order: stage 0, stage U (the look, on demo data, ending at the owner's approval), then stages 1 to 9. The implementer works them in order, one per session. |
| `../features.json` | Every user-visible feature with test steps and a pass flag |

## Rules for reading

- `contracts/` wins over prose. If a module spec and a contract disagree, the contract is right and the module spec has a bug.
- A module spec lists numbered behaviour rules such as `TERM-12`. Tests and task cards cite those ids.
- Words in **bold** on first use are defined in `../GLOSSARY.md`.
- Nothing in this spec is optional unless it says "later".

## Size

20 modules. 615 numbered rules, each with at least one test row. 72 features. 118 task cards. Every contract file compiles under the pinned TypeScript and zod versions with the strict settings in `03-stack.md`.

## Who decides what

- The spec author decides design. The implementer does not redesign.
- When the spec is silent or wrong, the implementer stops the task and writes the gap in `PROGRESS.md`. It does not guess.
