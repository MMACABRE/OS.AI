# Module: git

## Purpose

Keeps the project in step with GitHub with as little effort as possible, and never does anything to the owner's history that cannot be undone.

## Interface

`contracts/channels/git.ts`. Reference code: `reference/git-status-parser.ts`.

- Runs in: `workspace-service` (runs `git.exe`), `ui` (title bar button, status item; the Changes view belongs to `review`).
- Third-party packages allowed: `zod`. No git library. HSOS runs the installed `git.exe`, so behaviour, credentials and configuration are exactly those of the owner's own terminal.

## Running git

- **GIT-1.** Every command goes through `GitRunner.run` with an argument array (SEC-6) and these fixed leading arguments: `-c core.quotepath=false -c color.ui=false`.
- **GIT-2.** The environment adds `GIT_TERMINAL_PROMPT=0` so git never waits for typed input, and `GIT_OPTIONAL_LOCKS=0` for read-only commands so HSOS never blocks a git command Claude is running.
- **GIT-3.** Before running, the argument list is checked by `assertSafe`. A list containing any of these is refused with `GIT_REFUSED_UNSAFE` and never run (P-5): `--force`, `-f` (with `push`, `checkout`, `branch`, `clean`, `worktree`), `--force-with-lease`, `--hard`, `reset`, `clean`, `rebase`, `filter-branch`, `-D`, `--mirror`, `gc`, `prune`, `checkout --`, `restore`, `stash drop`, `stash clear`, `update-ref -d`.
- **GIT-4.** The subcommands HSOS uses are exactly: `rev-parse`, `status`, `fetch`, `merge --ff-only`, `add`, `commit`, `push`, `show`, `diff`, `worktree list`, `worktree add`, `worktree remove`, `init` (only from the owner's command, GIT-13), `remote get-url origin`, `--version`. `assertSafe` also refuses any other subcommand.
- **GIT-5.** `git --version` failing to start means git is missing: status kind `git-missing`. The UI then shows "Git is not installed" with a link to the download page.
- **GIT-6.** Commands for one repo run one at a time, in order. A read-only status never waits behind a network command for more than 2 000 ms; it runs alongside.
- **GIT-7.** Error mapping from exit code and stderr text:

| Stderr contains | Result |
|---|---|
| `not a git repository` | status kind `not-a-repo` |
| `Authentication failed`, `could not read Username`, `Permission denied (publickey)`, `terminal prompts disabled` | `GIT_AUTH_REQUIRED` |
| `Could not resolve host`, `unable to access`, `Connection timed out`, `Network is unreachable` | `GIT_OFFLINE` |
| `CONFLICT`, `Automatic merge failed`, `Not possible to fast-forward`, `diverging` | `GIT_CONFLICT` |
| anything else with a non-zero exit code | `GIT_COMMAND_FAILED` with the first 500 characters of stderr |

## Behaviour

### Status

- **GIT-10.** Status is read with `status --porcelain=v2 --branch -z --untracked-files=all` and parsed by the reference parser. `operation` is found by checking for `MERGE_HEAD`, `rebase-merge` or `rebase-apply`, and `CHERRY_PICK_HEAD` inside the git folder reported by `rev-parse --git-dir`.
- **GIT-11.** Status is re-read: at project open; 300 ms after a `files.changed` batch (one read per batch, however large); after every command HSOS runs; and when the window regains focus.
- **GIT-12.** `statusChanged` is emitted only when the new status differs from the last one emitted.
- **GIT-14.** `remoteUrl` is read with `remote get-url origin` at project open and after every fetch, and is null when there is no `origin`. Any user name, password or token in it is removed before it is stored, logged or shown (`https://user:token@host/x` becomes `https://host/x`). `webUrl` is the https address of the repo page when the host is `github.com`: `git@github.com:o/r.git`, `ssh://git@github.com/o/r.git` and `https://github.com/o/r.git` all become `https://github.com/o/r`; for other hosts it is null.
- **GIT-13.** A project that is not a repo shows no git UI except one command, "Initialize Repository", which the owner must choose. HSOS never runs `git init` on its own.

### Sync

- **GIT-20.** `fetch` runs `fetch --prune --quiet`. `--prune` here removes only stale remote-tracking names, not local work. Success sets `lastFetchAt` and clears `isOffline`. `GIT_OFFLINE` sets `isOffline` and is not shown as an error.
- **GIT-21.** `pull` requires a clean tree and runs `merge --ff-only @{upstream}` after a fetch. With local changes it returns `GIT_DIRTY_TREE`. When the branches have diverged it returns `GIT_CONFLICT` and changes nothing.
- **GIT-22.** `push` runs `push` with no flags. With no upstream set it runs `push --set-upstream origin <branch>`. A rejected push returns `GIT_CONFLICT`.
- **GIT-23.** `sync` fetches; pulls when behind (GIT-21 applies); then pushes when ahead. It stops at the first failure and reports it.
- **GIT-24.** Automatic fetch runs every `autoFetchMinutes`, and on window focus when the last fetch is more than 60 seconds old. It runs only when the repo has an upstream.
- **GIT-25.** After a successful automatic fetch, when `autoPullFastForward` is on, the tree is clean, `behind` is above zero and `ahead` is zero, HSOS pulls. A toast reports "Pulled N commits".
- **GIT-26.** While `operation` is not `none`, HSOS runs no automatic command and disables commit, pull and sync. The status item shows "Merge in progress" (or the other operation) and opens the Changes view.

### Commit

- **GIT-30.** `suggestMessage` with `messageGenerator: 'summary'`:
  - one file: `Update <file name>`, or `Add <file name>` or `Remove <file name>` by its change code
  - several files in one folder: `Update <n> files in <folder>`
  - otherwise: `Update <n> files`
  With `messageGenerator: 'claude'` it runs `claude -p --model <messageModel>` with a prompt asking for one conventional commit subject line, giving the output of `diff --stat` and at most 4 000 characters of `diff`. If that fails or takes more than 30 seconds, it falls back to the summary form.
- **GIT-31.** `commit` runs `add -- <paths>` (or `add -A` when `paths` is empty), then `commit -m <message>`. Nothing to commit returns `GIT_COMMAND_FAILED` with the message "There is nothing to commit."
- **GIT-32.** HSOS never passes `--no-verify`. If a hook rejects the commit, its output is shown.

### Automatic sync, opt-in

- **GIT-40.** For a repo listed in `autoSyncRepos`: when changes exist and no file has changed for `autoSyncQuietMinutes`, and `operation` is `none`, and no Claude session bound to this project is `working`, HSOS commits everything with the suggested summary message and then runs `sync`.
- **GIT-41.** Any failure in automatic sync stops it for that repo until the next file change, and shows one toast naming the failure.
- **GIT-42.** The settings screen describes this option as: "Commit and push all changes automatically after a quiet period. Every change becomes public history on GitHub."

### Worktrees

- **GIT-50.** `addWorktree(name)` creates `<repo parent>\<repo name><worktreeFolderSuffix>\<name>` with `worktree add -b <name> <path>`. If the branch exists it runs `worktree add <path> <name>`.
- **GIT-51.** `listWorktrees` parses `worktree list --porcelain`.
- **GIT-52.** `removeWorktree` first reads that worktree's status. With any change it returns `GIT_DIRTY_TREE`. Otherwise it runs `worktree remove <path>` without force.
- **GIT-53.** The command "New Claude Session in Worktree" asks for a name, calls `addWorktree`, then opens a terminal with `cwd` set to the worktree, `worktree` set to its name and `launch: "claude"`.

### GitHub account

- **GIT-60.** `getGitHubAccount` runs `gh auth status` and reads the login name. HSOS never reads or stores a token. Pushing and pulling use git's own credential helper.
- **GIT-61.** On `GIT_AUTH_REQUIRED` the error offers "Sign in to GitHub". That opens a terminal running `gh auth login --web --git-protocol https` when the GitHub CLI is installed, and otherwise shows where to get it.

## UI

- **Title bar button.** Branch name, then `↑n` and `↓n` when not zero. Pressing it runs `sync`. While busy it shows the activity word. Tooltip: last fetch time, or "Offline" when `isOffline`.
- **Status item `git.changes`** (left): the number of changed files, or nothing when clean. Pressing it opens the Changes view.
- Errors appear as toasts with the mapped message and, for auth, the sign-in action.

| Error | Message |
|---|---|
| `GIT_DIRTY_TREE` | "Commit or discard your changes before pulling." |
| `GIT_CONFLICT` | "Your branch and GitHub have both changed. Merge them in a terminal, then sync again." |
| `GIT_AUTH_REQUIRED` | "GitHub needs you to sign in." |
| `GIT_OFFLINE` | no toast; the button tooltip says "Offline" |
| `GIT_REFUSED_UNSAFE` | "HSOS does not run commands that rewrite or discard history." |

## Commands

| Id | Title | Default key |
|---|---|---|
| `git.sync` | Sync with GitHub | `Ctrl+Shift+S` |
| `git.fetch` | Fetch | none |
| `git.commitAll` | Commit All Changes | `Ctrl+Enter` when the Changes view has focus |
| `git.newWorktreeSession` | New Claude Session in Worktree | none |
| `git.signIn` | Sign in to GitHub | none |
| `git.init` | Initialize Repository | none |

## Tests

Integration tests use the real `git.exe` in temp repos, with a second temp repo as the remote.

| Rule | Level | Given | When | Then |
|---|---|---|---|---|
| GIT-3 | unit | each forbidden argument list | `assertSafe` | each is refused |
| GIT-3 | property | random argument lists containing a forbidden token | `assertSafe` | all are refused |
| GIT-4 | unit | the subcommand `stash` | `assertSafe` | refused |
| GIT-7 | unit | sample stderr for each row | mapping | the code matches the row |
| GIT-14 | unit | `https://user:ghp_x@github.com/o/r.git`, `git@github.com:o/r.git`, `ssh://git@github.com/o/r.git`, `https://gitlab.com/o/r.git` | they are read | `remoteUrl` holds no `user` or token; `webUrl` is `https://github.com/o/r` for the first three and null for the last |
| GIT-14 | integration | a repo with no `origin` | status is read | `remoteUrl` and `webUrl` are null |
| GIT-10 | unit | covered by the reference self-check | | |
| GIT-10 | integration | a repo in the middle of a conflicted merge | `getStatus` | `operation` is `merge`; the file is `isConflicted` |
| GIT-11 | integration | fake clock | 50 file change batches in 1 s | status was read at most 4 times |
| GIT-12 | integration | an unchanged repo | `refresh` twice | `statusChanged` fired at most once |
| GIT-21 | integration | local changes; remote ahead | `pull` | `GIT_DIRTY_TREE`; the working files are unchanged |
| GIT-21 | integration | local and remote both have new commits | `pull` | `GIT_CONFLICT`; HEAD is unchanged |
| GIT-21 | integration | clean tree; remote ahead by 2 | `pull` | HEAD equals the remote; `behind` is 0 |
| GIT-22 | integration | a new branch with no upstream | `push` | the remote has the branch and upstream is set |
| GIT-23 | integration | behind 1 and ahead 0 with a new local commit made after | `sync` | remote and local are equal |
| GIT-25 | integration | clean, behind 1, fake clock | the auto-fetch timer fires | HEAD advanced |
| GIT-25 | integration | dirty, behind 1 | the timer fires | HEAD is unchanged |
| GIT-26 | integration | a merge in progress | `commit` is requested from the UI layer | it is disabled; automatic fetch does not pull |
| GIT-30 | unit | one modified file `src/a.ts` | `suggestMessage` | `Update a.ts` |
| GIT-30 | unit | three files in `src/ui` | `suggestMessage` | `Update 3 files in src/ui` |
| GIT-31 | integration | two changed files, `paths` naming one | `commit` | the commit holds one file; the other is still changed |
| GIT-40 | integration | a repo in `autoSyncRepos`, a change, fake clock | the quiet period passes | one commit exists on the remote |
| GIT-40 | integration | the same, with a `working` session reported by a fake link | the quiet period passes | no commit is made |
| GIT-50 | integration | a repo | `addWorktree('feature-x')` | the folder exists and `listWorktrees` includes it on branch `feature-x` |
| GIT-52 | integration | a worktree with an uncommitted file | `removeWorktree` | `GIT_DIRTY_TREE`; the folder still exists |
| P-5 | integration | every test above, with a runner that records commands | all tests finish | no recorded command contains a forbidden token |
