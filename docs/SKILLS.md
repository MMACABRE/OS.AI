# Skills for the HSOS spec work

Thirty skills picked for researching and writing the HSOS spec. The first 22 are already installed on this machine. The last 8 came from the skills.sh registry and are not installed yet.

## Already installed

| # | Skill | Used for |
|---|---|---|
| 1 | mattpocock-skills:wayfinder | Charts the open decisions as a map and tickets |
| 2 | mattpocock-skills:grilling | Question rounds that settle each decision with the owner |
| 3 | mattpocock-skills:domain-modeling | Glossary and decision records |
| 4 | mattpocock-skills:research | Background agents that read primary sources and write findings |
| 5 | anthropic-skills:deep-research | Wider multi-source research when one agent is not enough |
| 6 | mattpocock-skills:codebase-design | Deep-module vocabulary for the architecture sections |
| 7 | mattpocock-skills:writing-for-agents | How to write a spec a weak model follows the same way every run |
| 8 | mattpocock-skills:prototype | Throwaway UI and logic prototypes to settle look and behaviour |
| 9 | spec-driven-development | Spec structure, capability map, gated phases |
| 10 | api-and-interface-design | Contracts between the app shell and each feature module |
| 11 | source-driven-development | Every framework claim in the spec cites official docs |
| 12 | test-driven-development | Test strategy the implementer must follow |
| 13 | incremental-implementation | Thin, verifiable build slices for the implementer |
| 14 | frontend-ui-engineering | Component, state and accessibility rules |
| 15 | frontend-design | Distinct visual direction |
| 16 | impeccable | Design critique and polish passes |
| 17 | design-taste-frontend | Rules that keep the UI from looking generated |
| 18 | emil-design-eng | Animation and interaction detail |
| 19 | ui-ux-pro-max | Style, palette and font lookup data |
| 20 | graphify | Reference for the markdown graph feature, and for mapping research output |
| 21 | performance-optimization | Startup, memory and terminal throughput budgets |
| 22 | git-workflow-and-versioning | Commit, branch and release rules for the implementer |

## Found in the registry, not installed

| # | Skill | Installs | Used for | Install only if |
|---|---|---|---|---|
| 23 | affaan-m/ecc@windows-desktop-e2e | 8.6K | End-to-end tests for a Windows desktop app | always useful |
| 24 | wshobson/agents@e2e-testing-patterns | 25.3K | End-to-end test patterns | always useful |
| 25 | anthropics/claude-code@Hook Development | 14.5K | Claude Code hooks, the data source for the agent HUD | always useful |
| 26 | anthropics/claude-code@Plugin Structure | 13.9K | Claude Code plugin layout, for the skills panel | always useful |
| 27 | github/awesome-copilot@github-issues | 17.8K | Working with GitHub issues for the map and tickets | GitHub Issues is the tracker |
| 28 | apollographql/skills@rust-best-practices | 23.2K | Rust conventions | the stack includes Rust |
| 29 | wshobson/agents@rust-async-patterns | 22.2K | Async Rust for terminal and file-watching code | the stack includes Rust |
| 30 | affaan-m/ecc@rust-testing | 14.1K | Rust tests | the stack includes Rust |

Install command for any of them: `npx skills add <owner/repo@skill> -g -y`.

## Gaps

Registry searches for tauri, electron, obsidian, webview, svelte, typescript, accessibility and architecture returned nothing, and direct calls to the registry API failed to connect. Those topics need a second search once the stack is chosen.
