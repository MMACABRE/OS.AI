# Module: skills

## Purpose

Puts the owner's skills one keystroke away: find a skill, send it to a Claude session, or run it in the background with a chosen model, and keep the owner's skills folder in step with their GitHub repo.

It carries over the behaviour of the owner's `agent-hud` mod: the skill finder, favourites, and the skills-repo row.

## Interface

`contracts/channels/skills.ts`.

- Runs in: `workspace-service` (index, runs, repo sync). Its UI is drawn by `hud` (the skills deck) from this module's channels.
- Third-party packages allowed: `zod`.

## Behaviour

### Index

- **SKILL-1.** A skill is a folder containing `SKILL.md`. The index scans:

| Source | Location | Name |
|---|---|---|
| `user` | `%USERPROFILE%\.claude\skills\*\SKILL.md`, following directory junctions | folder name |
| `project` | `<project>\.claude\skills\*\SKILL.md` | folder name |
| `plugin` | every `SKILL.md` up to four folders deep under `%USERPROFILE%\.claude\plugins\cache\<marketplace>\<plugin>\<version>\skills\`, using only the highest version of each plugin | `<plugin>:<skill folder name>` |

- **SKILL-2.** `name` and `description` come from the YAML frontmatter of `SKILL.md` when present. A missing name uses the rule above. A missing description is the first non-heading line of the body, cut to 200 characters. A skill whose frontmatter has `user-invocable: false` is left out.
- **SKILL-3.** Frontmatter is parsed by a small parser that accepts `key: value` lines and folded `>` or `|` blocks. A file it cannot parse still yields a skill, using the fallback name and description. Text from skill files is data (P-6): control characters are removed before display.
- **SKILL-4.** When two skills share a name, the order of precedence is `project`, `user`, `plugin`. The others are hidden.
- **SKILL-5.** The index is rebuilt at start, when the project changes, and 500 ms after a watcher change under any scanned location. `listChanged` is emitted when the result differs.
- **SKILL-6.** Favourites are stored in `skillFavouritesFile` as `{ "version": 1, "names": [...] }`, in the order they were starred. A favourite whose skill no longer exists is kept in the file and not shown.

### Skills folder

- **SKILL-7.** `openSkillsFolder` resolves `localSkillsDir` (empty means `%USERPROFILE%\.agents\skills`) and opens it in Windows Explorer through `shell.openFolder`. A folder that does not exist returns `NOT_FOUND` "Skills folder not found: <path>".

### Skill state

What `/skills` in Claude Code changes, verified in the 2.1.327 binary and in the owner's settings files on 2026-11-18:

- The settings key `skillOverrides` maps a skill name to `on`, `name-only` (listed without its description), `user-invocable-only` (hidden from the model, `/name` still works) or `off` (hidden from both). A missing entry means `on`.
- Claude Code reads it from these files, first match wins: policy settings, then `<project>\.claude\settings.local.json`, then `<project>\.claude\settings.json`, then `%USERPROFILE%\.claude\settings.json`. When the project is the home folder, the two project files are the ones in `%USERPROFILE%\.claude\`.
- A plugin skill's state is managed with its plugin. A skill whose own frontmatter has `disable-model-invocation: true` cannot be changed there either.

- **SKILL-8.** Each `SkillInfo` carries `state`, `stateSource` and `stateLock`, computed at every index build (SKILL-5) and again 500 ms after any of the three settings files changes:
  - `state` is the first entry found for the skill's `name` in the order above, else `on`. An entry that is not one of the four values is skipped. Policy settings are `%ProgramFiles%\ClaudeCode\managed-settings.json`, read only.
  - `stateSource` is `policy`, `local`, `project`, `user`, or `default` when no file names it.
  - `stateLock` is `policy` when the policy file sets it, `plugin` for a plugin skill, `author` when its frontmatter has `disable-model-invocation: true`, else null. A locked skill cannot be changed (SKILL-9).
- **SKILL-9.** `setState({ name, state, scope })` changes one entry in one file, and nothing else:
  1. A locked skill returns `BAD_REQUEST` with the reason: "Set by your organisation's policy.", "A plugin skill is managed with its plugin." or "This skill's own file turns model use off."
  2. The file is the one named by `stateSource` when that is `local`, `project` or `user`, because writing anywhere else would have no effect. With `stateSource: 'default'` it is the file for `scope`: `user` is `%USERPROFILE%\.claude\settings.json`, `project-local` is `<project>\.claude\settings.local.json`.
  3. It reads the file's bytes. A missing file counts as `{}`. Text that `JSON.parse` rejects, or that is not an object, returns `BAD_REQUEST` "Could not read <file>. Fix it in an editor first." and nothing is written.
  4. It copies the old bytes to `claudeSettingsBackupDir\<yyyyMMdd-HHmmss>-<file name>`, keeping the newest 50 there.
  5. It sets `skillOverrides[name] = state` on the parsed object, creating `skillOverrides` when missing, and serialises with two-space indentation and a final line break. Every other key keeps its value and its order.
  6. Just before writing it reads the file again. When the bytes differ from step 3, it starts again from step 3 once; a second difference returns `BAD_REQUEST` "The file changed while saving. Try again."
  7. It writes with `write-file-atomic`, then rebuilds the state (SKILL-8) and emits `listChanged`.
- **SKILL-10.** HSOS never removes a `skillOverrides` entry and never writes any other key of a Claude Code settings file (LINK-6).

### Sending to a terminal

Done in the UI by `hud` (HUD-30): it writes `/<name> ` to a terminal. No service rule is involved.

### Background runs

- **SKILL-20.** `startRun` creates a `SkillRun` in state `queued`. At most `maxConcurrentRuns` run at once; the rest wait in order.
- **SKILL-21.** A run starts `claude` through `ClaudeRunner` in `cwd` with the arguments `-p`, `/<skill> <args>`, `--model`, `<model>`, `--output-format`, `json`, and `--effort`, `<effort>` when effort is not null.
- **SKILL-22.** When the process exits with code 0, the run is `succeeded`. `report` is the `result` field of the JSON output when stdout parses as JSON and has one, else the raw stdout. `costUsd` is the JSON's `total_cost_usd` when present.
- **SKILL-23.** A non-zero exit code makes the run `failed`. `failure` is the first 300 characters of stderr, or of stdout when stderr is empty.
- **SKILL-24.** A run still going after `runTimeoutMinutes` is stopped and marked `failed` with "The run took too long and was stopped."
- **SKILL-25.** `cancelRun` stops a running process or removes a queued run, and marks it `cancelled`.
- **SKILL-26.** The newest 20 finished runs are kept in memory. Runs are not restored after a restart; a run in progress when `workspace-service` stops is stopped.
- **SKILL-27.** A background run spends the owner's usage. It starts only from the run dialog, which names the model before starting (HUD-32). Nothing in HSOS starts one automatically.

### Skills repo

- **SKILL-30.** `checkRepoSync` resolves the local folder and the repo folder from settings. With no repo folder found, state is `not-configured`.
  - It runs `fetch` in the repo through the `git` module, then reads `ahead` and `behind`. A fetch that fails offline sets `isOffline` and continues.
  - **Same folder** (the local folder is the repo): `changed`, `added` and `removed` are the top-level skill folders with uncommitted modified, new and deleted files, from `git.getStatus`.
  - **Separate folders:** each top-level folder is compared by the SHA-256 of its files' relative paths and contents. `changed` differ, `added` exist only locally, `removed` exist only in the repo.
  - State is `in-sync` when all three lists are empty and `ahead` and `behind` are 0, else `out-of-sync`.
- **SKILL-31.** A check runs at start, every 30 minutes, and after any change under the local folder (debounced 5 seconds).
- **SKILL-32.** `pushToRepo`:
  1. If `behind` is above 0, pull fast-forward through `git.pull`. On failure, stop with state `error` and the message "The skills repo has changes from elsewhere that need merging by hand."
  2. Separate folders only: copy each `changed` and `added` folder from local into the repo, replacing files of the same name. Files matching `.env*`, `*.pem`, `*.key`, and folders named `node_modules` or `.cache` are never copied. Folders in `removed` are left alone.
  3. Commit all with the message `sync skills <YYYY-MM-DD>` and push, through `git.commit` and `git.push`.
  4. Run `checkRepoSync`.
- **SKILL-33.** HSOS never copies from the repo into the local folder and never deletes a skill folder on either side. Folders that exist only in the repo are listed for the owner to handle.
- **SKILL-34.** `pushToRepo` runs only when the owner presses "Sync" in the deck (P-5 spirit: publishing is the owner's act).

## Tests

| Rule | Level | Given | When | Then |
|---|---|---|---|---|
| SKILL-1 | integration | a temp home with a user skill, a junction to a second skill folder, a project skill, and a plugin with versions 1.2.0 and 1.10.0 | the index builds | four skills; the plugin skill comes from 1.10.0 and is named `<plugin>:<name>` |
| SKILL-2 | unit | frontmatter with `name`, a folded `description: >` block, and `user-invocable: false` on another file | parsing | the first yields name and joined description; the second is left out |
| SKILL-2 | unit | a `SKILL.md` with no frontmatter and a body starting `# Title` then a sentence | parsing | description is that sentence |
| SKILL-3 | unit | frontmatter containing a tab-indented broken line | parsing | a skill is still returned with the fallback name |
| SKILL-4 | unit | a `user` and a `project` skill both named `deploy` | the index builds | only the project one is listed |
| SKILL-5 | integration | a built index, fake clock | a new skill folder appears | `listChanged` fires once with the new skill |
| SKILL-6 | integration | favourites `a`, `b` | `setFavourite('c', true)` then restart | order is `a`, `b`, `c` |
| SKILL-21 | integration | a fake runner | `startRun` with model `haiku`, effort `low`, skill `grammar`, args `check this` | args are `-p`, `/grammar check this`, `--model`, `haiku`, `--output-format`, `json`, `--effort`, `low` |
| SKILL-20 | integration | `maxConcurrentRuns` 1 | two runs are started | the second stays `queued` until the first ends |
| SKILL-22 | integration | the fake exits 0 with `{"result":"done","total_cost_usd":0.01}` | the run ends | `succeeded`, report `done`, cost 0.01 |
| SKILL-22 | integration | the fake exits 0 with plain text | the run ends | `succeeded`, report is that text |
| SKILL-23 | integration | the fake exits 1 with stderr | the run ends | `failed` with that text |
| SKILL-24 | integration | a fake that never exits, fake clock | the timeout passes | the fake was stopped; the run is `failed` |
| SKILL-25 | integration | a running run | `cancelRun` | the fake was stopped; state `cancelled` |
| SKILL-30 | integration | separate folders: local has skill `x` changed and `y` new; repo has `z` only | `checkRepoSync` | changed `[x]`, added `[y]`, removed `[z]`, state `out-of-sync` |
| SKILL-30 | integration | no repo folder exists | `checkRepoSync` | state `not-configured` |
| SKILL-32 | integration | that setup with a temp remote | `pushToRepo` | the remote has `x` and `y` updated; `z` still exists; state reflects `removed [z]` |
| SKILL-32 | integration | a local skill folder containing `.env` | `pushToRepo` | the repo copy has no `.env` |
| SKILL-32 | integration | the repo has diverged from the remote | `pushToRepo` | state `error`; nothing was copied or committed |
| SKILL-33 | integration | every sync test above | all finish | no folder was removed on either side and the local folder's files are unchanged |
| SKILL-7 | integration | a fake `shell.openFolder`; `localSkillsDir` empty and a temp home with `.agents\skills` | `openSkillsFolder` | `openFolder` got `<home>\.agents\skills`; with the folder removed, `NOT_FOUND` |
| SKILL-8 | integration | a temp home and project: user file `{ skillOverrides: { a: 'off', b: 'off' } }`, project-local file `{ skillOverrides: { b: 'name-only', c: 'bogus' } }` | the index builds | `a` is `off` from `user`; `b` is `name-only` from `local`; `c` is `on` from `default` |
| SKILL-8 | unit | a plugin skill; a user skill with `disable-model-invocation: true` | state is computed | locks `plugin` and `author` |
| SKILL-9 | integration | the user file with other keys `model`, `hooks` in that order and `skillOverrides: { a: 'off' }` | `setState({ name: 'a', state: 'on', scope: 'user' })` | the file parses to the same object with `a: 'on'`, keys in the same order; a backup with the old bytes exists |
| SKILL-9 | integration | `b` set by the project-local file | `setState({ name: 'b', state: 'off', scope: 'user' })` | the project-local file changed; the user file did not |
| SKILL-9 | integration | a user file containing `{ "a": 1, }` | `setState` | `BAD_REQUEST` "Could not read …"; the file's bytes are unchanged |
| SKILL-9 | integration | a fake reader that returns new bytes on the second read twice | `setState` | `BAD_REQUEST` "The file changed while saving. Try again."; nothing written |
| SKILL-9 | integration | a plugin skill | `setState` | `BAD_REQUEST` "A plugin skill is managed with its plugin." |
| SKILL-10 | integration | every SKILL-9 test | all finish | outside `skillOverrides`, every file parses to the same values as before |
