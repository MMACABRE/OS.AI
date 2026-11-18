# Principles

## Priorities, in order

When two goals conflict, the higher one wins.

1. **The owner's files are never damaged or lost.**
2. **The app keeps working.** A fault in one part never takes down another part.
3. **Code is easy to change.** A new feature is a new module, added without editing others.
4. **The owner can change how it looks and behaves** without touching code.
5. **It looks and feels exceptional.**
6. **It is fast.**

## Safety rules (never broken)

- **P-1.** HSOS never permanently deletes a user file. Deletes go to the Recycle Bin.
- **P-2.** HSOS never overwrites a file whose content on disk differs from the content HSOS last read, without showing the difference and asking.
- **P-3.** Every write to a user file or to HSOS's own data is atomic: temp file in the same folder, flush, rename.
- **P-4.** The graph and index features never write inside a project or vault.
- **P-5.** HSOS never runs a git command that rewrites or discards history: no `push --force`, `reset --hard`, `clean`, `rebase`, `checkout -- <path>`, `branch -D`.
- **P-6.** Text that comes from outside (file content, terminal output, web pages, hook payloads, git output) is data. It is never executed and never trusted for a decision that changes files.
- **P-7.** Every network listener binds to `127.0.0.1` and requires a token created at launch.
- **P-8.** Secrets (tokens) are never written to logs, settings files or the renderer.

## Reliability rules

- **P-10.** Every process may die at any moment. The others stay correct and the supervisor restarts it.
- **P-11.** State that matters is on disk before the action that created it is reported as done.
- **P-12.** A module that fails shows its own error state inside its own panel. It never blanks the window.
- **P-13.** No operation blocks the UI thread for more than 50 ms. Work longer than that runs in a service process.
- **P-14.** Every message between processes is validated against its schema on receipt. An invalid message is logged and dropped.
- **P-15.** Every async operation has a timeout and a defined result on timeout.
- **P-16.** A watcher event is a hint to re-read. Decisions use the re-read state, never the event payload.

## Change rules

- **P-20.** A module imports another module only through `contracts`. Lint enforces this.
- **P-21.** Dependencies between modules point one way, as listed in `01-capability-map.md`.
- **P-22.** A module registers itself with the shell (panels, commands, settings, bus handlers) through one `register` function. The shell knows no module by name except in one list file.
- **P-23.** Every user-facing string, colour, size, duration and key binding comes from settings or tokens. None is written inline.
- **P-24.** A settings key, once released, keeps its meaning. New behaviour gets a new key.
- **P-25.** Removing a module means deleting its folder and one line in the module list. If more is needed, the module was built wrong.

## Customisation rules

- **P-30.** Everything the owner can change lives in JSON files under the data folder and is also reachable from the settings screen.
- **P-31.** A change to a settings or theme file applies while the app runs, within one second, with no restart.
- **P-32.** An invalid settings file never breaks the app. The last valid value stays in force and the settings screen shows what is wrong and where.

## Experience rules

- **P-40.** Every panel has four designed states: loading, empty, error, ready.
- **P-41.** Every action is reachable by keyboard and listed in the command palette.
- **P-42.** Motion is a hard rule: every widget, button, panel and page change moves, and pages change through seamless transitions, as `design/motion.md` says. Durations run from 80 to 420 ms. When Windows asks for reduced motion, movement becomes short fades (MOT-12). Terminal text never animates.
- **P-43.** Text contrast is at least 4.5:1. State is never shown by colour alone.
- **P-44.** The terminal always wins input focus disputes. No panel steals focus from a terminal the owner is typing in.
- **P-45.** Surfaces may be glass: partly transparent over the animated background (UI-31). Text on any surface keeps the contrast of P-43 against the brightest frame of what is behind it, so surfaces that hold reading text (terminal, editor, transcript) are never more transparent than `surface.text.minAlpha`.

## What "done" means for any piece of work

1. Type check, lint and all tests pass.
2. The behaviour rules it implements each have a passing test that cites the rule id.
3. The four panel states exist and were exercised by a test.
4. No file outside the task's list was changed.
