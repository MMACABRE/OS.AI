# Architecture

## 1. Processes

```
main  (supervisor, window, bus broker, settings, diagnostics)
 ├─ pty-host            utility process   shells
 ├─ workspace-service   utility process   files, history, git, graph index, activity, skills index
 ├─ link-service        utility process   Claude hook receiver, session recovery, `hsos` command endpoint
 ├─ ui                  renderer          every panel
 └─ browser views       WebContentsView   one per browser tab
```

- `main` does no heavy work. It starts processes, restarts them, owns the window and brokers message ports.
- The `ui` renderer runs with `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`. It reaches the rest of the app only through the preload API `window.hsos`.
- Browser views run with no preload, no Node access, and the storage partition `persist:hsos-browser`.

## 2. The bus

All communication between processes goes through one typed bus. Contract: `contracts/bus.ts`.

### 2.1 Shape

- A **channel** is a string `module.verb`, for example `terminal.create`.
- Each channel is declared once in `contracts/channels/<module>.ts` with a zod schema for its request and its response, or for its event payload.
- Three message kinds:

| Kind | Direction | Meaning |
|---|---|---|
| `req` | caller to owner | Ask for something. Has an `id`. |
| `res` | owner to caller | Answer to one `req`. Carries a `Result`. |
| `evt` | owner to all subscribers | Something happened. No answer. |

- Envelope: `{ v: 1, kind, id, channel, payload }`.

### 2.2 Transport

- `ui` to `main`: `ipcRenderer.invoke` and `ipcRenderer.on`, wrapped by the preload.
- `ui` to a service: a direct `MessagePort`. `main` creates a `MessageChannelMain` per service, hands one end to the service and the other to the renderer. Terminal output therefore never passes through `main`.
- Service to service: through `main`, which forwards by channel prefix. This path is for low-volume messages only.
- When a service restarts, `main` creates a fresh channel and sends the new port to the renderer with the event `shell.servicePort`.

### 2.3 Rules

- **BUS-1.** The receiver validates every message with the channel's schema. Invalid messages are logged with `diagnostics` and dropped. A dropped `req` is answered with error code `BAD_REQUEST`.
- **BUS-2.** A handler never throws across the bus. It returns `Result<T>`. An uncaught exception in a handler is converted to error code `INTERNAL`.
- **BUS-3.** Every `req` has a timeout, default 10 000 ms, set per channel in its declaration. On timeout the caller receives error code `TIMEOUT`.
- **BUS-4.** When a service dies, every pending `req` to it resolves with error code `SERVICE_DOWN`.
- **BUS-5.** Events are not queued for absent subscribers. A panel that mounts asks for current state with a `req`, then subscribes.
- **BUS-6.** Payloads are plain JSON values, plus `Uint8Array` for terminal data and file bytes.
- **BUS-7.** Each handler receives `CallMeta` as its second argument. `meta.from` is set by the receiving bus from the port or IPC channel the request arrived on: the process's own name for an in-process call, the service's name for its port, `ui` for the renderer. Forwarded service-to-service requests keep the original sender, set by the broker. A payload can never set it.

## 3. Results and errors

Contract: `contracts/result.ts`.

```ts
type Result<T> = { ok: true; value: T } | { ok: false; error: AppError };
type AppError = { code: ErrorCode; message: string; details?: unknown };
```

- `code` is from a closed list in `contracts/result.ts`. Each module adds its own codes there with its prefix, for example `FILE_CHANGED_ON_DISK`.
- `message` is a plain sentence for the owner. It names what failed and what to do.
- Functions inside one process may throw only for programmer errors. Expected failures return `Result`.

## 4. Module shape

Every module except `contracts` has this layout:

```
src/modules/<id>/
  service/            code that runs in a utility process or main (may be absent)
  panel/              React components that run in the ui (may be absent)
  register.service.ts exports register(ctx: ServiceContext): void
  register.ui.ts      exports register(ctx: UiContext): void
```

- `ServiceContext` and `UiContext` are defined in `contracts/module.ts`. They give a module the bus, the logger, settings access, data paths, and registration functions for panels, commands, settings sections and status items.
- The list of modules loaded in each process is in `src/main/module-list.ts`, `src/services/<service>/module-list.ts` and `src/ui/module-list.ts`. These three files are the only places a module is named outside its own folder.

## 5. Data on disk

Contract: `contracts/paths.ts`. All paths come from `DataPaths`, never from string building in a module.

| What | Location | Format |
|---|---|---|
| Settings | `%APPDATA%\HSOS\settings\settings.json` | JSON, schema `SettingsFile` |
| Key bindings | `%APPDATA%\HSOS\settings\keybindings.json` | JSON |
| Themes | `%APPDATA%\HSOS\themes\<name>.json` | JSON, schema `ThemeFile` |
| App state | `%APPDATA%\HSOS\state\app.json` | recent projects, window bounds |
| Workspaces | `%APPDATA%\HSOS\workspaces\<projectId>.json` | layout and panel state |
| Skill favourites | `%APPDATA%\HSOS\skills\favourites.json` | JSON |
| Dashboard | `%APPDATA%\HSOS\dashboard.json` | JSON, schema `DashboardFile` (DASH-20) |
| Logs | `%LOCALAPPDATA%\HSOS\logs\<process>.log` | JSON lines |
| Crash reports | `%LOCALAPPDATA%\HSOS\crash\` | JSON |
| Local history | `%LOCALAPPDATA%\HSOS\history\<projectId>\` | `objects\<sha256>` and `index.sqlite` |
| Note index | `%LOCALAPPDATA%\HSOS\index\<projectId>.sqlite` | SQLite |
| Terminal restore | `%LOCALAPPDATA%\HSOS\terminals\<projectId>\<terminalId>.json` | serialised scrollback |
| Browser profile | `%LOCALAPPDATA%\HSOS\browser\` | Chromium partition |
| Claude link | `%LOCALAPPDATA%\HSOS\link\` | generated files (LINK-2), `bin\hsos` (CLI-1), `shots\` screenshots kept 24 hours (CLI-12) |
| Terminal init script | `%LOCALAPPDATA%\HSOS\terminal\terminal-init.ps1` | PowerShell, rewritten at every start (TERM-8) |
| Claude sessions | `%LOCALAPPDATA%\HSOS\sessions\` | `records\<sessionId>.json`, `launches\*.json`, `transcripts\<sessionId>.jsonl` (SESS-1, SESS-5, SESS-20) |
| Claude settings backups | `%LOCALAPPDATA%\HSOS\claude-settings-backups\` | old bytes of a Claude Code settings file before HSOS changed it, newest 50 (SKILL-9) |

- `projectId` is the first 16 hex characters of the SHA-256 of the project's absolute path, lower-cased, with forward slashes.
- Every JSON file HSOS writes has a top-level `"version"` number. A loader that meets a higher version than it knows refuses to load and keeps defaults.
- Before overwriting any of its own JSON files, HSOS keeps the previous content as `<name>.bak`.
- HSOS writes nothing inside a project except the files the owner edits and saves, and the one `skillOverrides` entry of SKILL-9 when the owner sets a skill state for that project.

## 6. Start

1. `main` takes the single-instance lock. A second launch focuses the first window and exits.
2. `main` starts `diagnostics`, then loads settings. Invalid settings fall back to defaults (P-32).
3. `main` starts `pty-host`, `workspace-service` and `link-service` in parallel and waits for each to send `ready`, at most 5 000 ms each.
4. `main` creates the window, hidden, with the background colour of the active theme.
5. The renderer loads, receives service ports, runs each module's `register.ui`, then restores the last workspace.
6. The window shows when the renderer sends `shell.uiReady`, or after 3 000 ms, whichever is first.

A service that misses its `ready` deadline is restarted once. If it fails again the window still opens, and that service's panels show the error state with a "Restart service" button.

## 7. Stop

1. The window close request is intercepted.
2. `ui` saves the workspace and reports unsaved editor buffers. Unsaved buffers are stored as hot-exit files, never discarded and never a blocking question.
3. `pty-host` serialises each terminal's scrollback and working folder.
4. Services flush and exit within 3 000 ms. After that `main` kills them.
5. `main` exits.

## 8. Supervisor

- A dead service is restarted at once.
- More than 5 deaths of one service in 60 seconds stops automatic restart. Its panels show the error state with a "Restart service" button and a link to the log.
- A renderer crash reloads the renderer. Terminals reattach (see `modules/terminal.md`).
- Every death writes a crash report: process name, exit code, the last 200 log lines of that process.

## 9. Security

- **SEC-1.** The renderer's Content Security Policy is `default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: hsos-file:; connect-src 'none'`.
- **SEC-2.** The renderer cannot navigate. `will-navigate` and `setWindowOpenHandler` deny everything in the main window.
- **SEC-3.** The preload exposes only `window.hsos.bus` and `window.hsos.platform`. No Node objects cross.
- **SEC-4.** Local files are shown to the renderer through the custom protocol `hsos-file:`, which serves only paths inside the open project, the vault and the artifacts list.
- **SEC-5.** Local listeners (hook receiver, `hsos` command endpoint) bind to `127.0.0.1` on a random free port and require the launch token in the `Authorization` header.
- **SEC-6.** Child programs are started with an argument array, never through a shell string built from outside text.

## 10. Performance budgets

| Measure | Budget |
|---|---|
| Launch to visible window | 1 500 ms |
| Launch to usable terminal | 2 500 ms |
| Key press to terminal echo | 16 ms median |
| Terminal output throughput | 5 MB per second without dropped frames in other panels |
| UI thread blocked | never above 50 ms |
| Memory with 4 terminals, tree, HUD, no browser | below 600 MB total |
| File tree of 50 000 entries | first paint under 300 ms |
| Graph of 5 000 notes | 60 frames per second when idle, 30 while laying out |
| Background scene (UI-32) | under 3 % of one CPU core, at most 30 frames per second, 0 frames while minimised |
| Page transition (MOT-5) | 60 frames per second with 4 terminals open, no frame over 33 ms |
| Key press to terminal echo during a page transition | 33 ms median |
| Terminal output throughput with a see-through terminal and the background running behind it | 5 MB per second, as with an opaque terminal |

The budgets are measured by tests in stage 6. They are targets the implementer reports against, and a miss is recorded in `PROGRESS.md`.
