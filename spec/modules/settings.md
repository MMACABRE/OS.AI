# Module: settings

## Purpose

Holds everything the owner can change: settings, key bindings and themes. It loads them from JSON files, checks them, applies changes while the app runs, and never lets a bad file break the app.

## Interface

`contracts/channels/settings.ts`, `contracts/theme.ts`, and `SettingsSection` and `SettingsReader` in `contracts/module.ts`.

- Runs in: `main` (files, validation), `ui` (settings screen, theme application).
- Third-party packages allowed: `zod`, `write-file-atomic`.

## Files

| File | Schema | Created |
|---|---|---|
| `settingsFile` | `SettingsFile` | at first start, with `{ "version": 1, "values": {} }` |
| `keybindingsFile` | `KeybindingsFile` | at first start, with `{ "version": 1, "bindings": {} }` |
| `themesDir\*.json` | `ThemeFile` | built-in themes are copied from `resources/themes/` at every start, overwriting the copies |

Only values that differ from the defaults are stored in `settingsFile`.

## Behaviour

### Sections

- **SET-1.** A module declares its settings as a `SettingsSection` (schema plus defaults) and registers it with `ctx.registerSettings`. The result is a `SettingsReader`.
- **SET-2.** `SettingsReader.get()` returns the stored values merged over the defaults, after validation. It is synchronous and never fails.
- **SET-3.** A stored value that fails its schema is ignored. The default is used for that key only, and a `SettingsProblem` is recorded naming the file, the path `values.<moduleId>.<key>` and the reason (P-32).
- **SET-4.** Keys in the file that no section declares are kept on disk untouched and reported as a problem with the message "Unknown setting".
- **SET-5.** A file that is not valid JSON, or whose `version` is above 1, is not loaded. Every section uses defaults, one problem is recorded, and the file is left exactly as it is. HSOS does not write to `settingsFile` while it is in this state, except through `setValue`, which first copies the bad file to `settings.json.invalid-<time>`.

### Changes

- **SET-6.** `setValue` validates the new value against the section schema. An invalid value returns `SET_INVALID` and changes nothing.
- **SET-7.** A valid `setValue` writes the file atomically (P-3), keeping the previous content as `settings.json.bak`, then notifies readers and emits `sectionChanged`.
- **SET-8.** `main` watches `settingsFile`, `keybindingsFile` and `themesDir`. A change on disk is re-read after a 200 ms quiet period and applied within one second (P-31). The re-read state is what is applied, never the watcher's event data (P-16).
- **SET-9.** Readers are notified only when their section's resolved value actually changed.
- **SET-10.** Services in utility processes receive their sections through the bus: they call `getSection` at start and subscribe to `sectionChanged`.

### Themes

- **SET-11.** The active theme is the one whose `name` equals the `theme` setting. If none matches, Phosphor is used and a problem is recorded.
- **SET-12.** A theme is resolved by taking Phosphor's tokens (the one built-in theme, `resources/themes/phosphor.json`) and overlaying the theme's tokens.
- **SET-13.** In the renderer, every token of the resolved theme is set as a CSS variable on `:root` using `tokenToCssVariable`. The attribute `data-theme-kind` on `<html>` is `dark` or `light`. Applying a theme causes no reload.
- **SET-14.** A token name not in `TOKEN_NAMES`, or a value containing `url(`, `;`, `{` or `}`, is ignored and reported as a problem.
- **SET-15.** `uiScale` is applied as the renderer zoom factor. `reduceMotion` set to `on`, or `system` with the system preference on, sets `data-motion="reduced"` on the root element, and components switch to the fades of MOT-12. `off` sets `data-motion="full"` even when Windows asks for reduced motion.
- **SET-16.** `saveTheme` writes `themesDir\<slug>.json`, where slug is the name lower-cased with runs of other characters replaced by `-`. A name equal to a built-in theme's name returns `SET_INVALID`.
- **SET-17.** The window background colour used before the renderer paints is `color.bg.app` of the active theme.

### Key bindings

- **SET-18.** The effective binding of a command is its entry in `keybindingsFile` if present (a string, or `null` meaning no key), else its `defaultKey`.
- **SET-19.** Key format: modifiers in the order `Ctrl+Alt+Shift+`, then one key name, for example `Ctrl+Shift+P`. A chord is two such parts separated by a space, for example `Ctrl+K Ctrl+T`.
- **SET-20.** Two commands with the same effective key: the one registered later wins, and a problem is recorded naming both.

## Settings screen (dock panel `settings.screen`, single instance)

- A search field at the top filters sections and keys by text.
- A left list of sections: Appearance first, then one per module that registered a section, in module-list order, then "Key bindings" and "Themes".
- Each key is one row: label, control, and a "Reset" link shown only when the value differs from the default.

| Schema type | Control |
|---|---|
| boolean | switch |
| enum | select |
| number with min and max | number field with stepper |
| string | text field |
| path | text field with a "Browse" button |

- A change is saved 400 ms after the last edit. Invalid input shows the schema's message under the control and saves nothing.
- A banner at the top lists current problems, each with "Open file".
- "Key bindings" lists every command with its key. Selecting a row and pressing a key combination sets it. A conflict is shown before saving.
- "Themes" lists themes with a preview swatch row. "Duplicate" copies a theme to a new name. In stage 6 a token editor edits the copy live.

## States

| State | Shows |
|---|---|
| Loading | skeleton rows |
| Ready | the sections |
| Ready with problems | the sections plus the problems banner |
| Error | only if `main` cannot be reached: standard error state |

## Tests

| Rule | Level | Given | When | Then |
|---|---|---|---|---|
| SET-2 | unit | a section with defaults `{ a: 1, b: 2 }` and stored `{ a: 5 }` | `get()` | returns `{ a: 5, b: 2 }` |
| SET-3 | integration | stored `fontSize: "big"` for a numeric key | settings load | `get()` returns the default; one problem with path `values.terminal.fontSize` |
| SET-4 | integration | the file has `values.terminal.unknownKey` | load, then `setValue` on another key | the unknown key is still in the file; one "Unknown setting" problem |
| SET-5 | integration | the file contains `{ not json` | the app loads settings | defaults are in force; the file's bytes are unchanged; one problem |
| SET-5 | integration | the file is invalid | `setValue` is called | a `settings.json.invalid-*` copy exists and the new file is valid |
| SET-6 | integration | a numeric key with max 40 | `setValue` with 400 | `SET_INVALID`; file unchanged |
| SET-7 | integration | a valid file | `setValue` succeeds | `settings.json.bak` holds the old content; the reader's listener fired once |
| SET-8 | integration | the app is running with a temp config folder | the file is edited on disk | the reader's listener fires within 1 000 ms |
| SET-9 | unit | two sections | only the first changes on disk | only the first section's listener fires |
| SET-11 | unit | `theme: "Nope"` | the theme resolves | Phosphor is active; one problem |
| SET-12 | unit | a theme setting only `color.accent` | it resolves | `color.accent` is the theme's; every other token equals Phosphor's |
| SET-14 | unit | a token value `red; background: url(x)` | it resolves | the token keeps Phosphor's value; one problem |
| SET-15 | component | `reduceMotion: 'on'`; then `'off'` with the system preference on | the theme is applied | the root has `data-motion="reduced"`; then `data-motion="full"` |
| SET-16 | integration | a theme named "Phosphor" | `saveTheme` | `SET_INVALID`; no file written |
| SET-18 | unit | default `Ctrl+B`, file maps the command to `null` | the binding resolves | the command has no key |
| SET-20 | unit | two commands on `Ctrl+B` | bindings resolve | the later one holds the key; one problem names both |
| P-32 | e2e | `settings.json` is corrupted before launch | the app starts | the window opens, the settings screen shows the problem banner |
