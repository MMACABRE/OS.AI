# Module: shell

## Purpose

The frame everything else runs in: starts and supervises processes, owns the window, carries the bus, and loads modules. It contains no feature of its own.

## Interface

`contracts/channels/shell.ts`, `contracts/bus.ts`, `contracts/module.ts`.

- Runs in: `main`, `preload`, and the entry point of each utility process and of the renderer.
- Third-party packages allowed: `electron`, `zod`.

## Parts

| Part | File area | Does |
|---|---|---|
| Supervisor | `src/main/supervisor/` | Starts, watches and restarts utility processes |
| Bus broker | `src/main/bus/` | Creates message channels, forwards service-to-service messages |
| Bus client | `src/modules/shell/bus/` | The `Bus` implementation used in every process |
| Window | `src/main/window/` | Creates the frameless window, saves and restores its bounds |
| Preload | `src/preload/` | Exposes `window.hsos` |
| Module loader | `src/modules/shell/loader/` | Calls each module's `register` with a context |

## Behaviour

### Start and stop

- **SHELL-1.** Only one instance runs. A second launch focuses the first window and exits.
- **SHELL-2.** Start follows `02-architecture.md` §6 in order.
- **SHELL-3.** A service is `ready` when it sends the message `{ type: 'ready' }` on its parent port after registering all its modules.
- **SHELL-4.** A service that is not ready within 5 000 ms is killed and started once more. A second miss marks it `down` with `needsManualRestart: true`.
- **SHELL-5.** The window is shown on `shell.uiReady` or 3 000 ms after it was created, whichever comes first.
- **SHELL-6.** Window bounds and maximised state are saved to `appStateFile` on move, resize (debounced 500 ms) and close, and restored at start. Bounds that fall outside every connected display are replaced by a centred 1280 by 800 window.
- **SHELL-7.** Stop follows `02-architecture.md` §7. Each service gets the message `{ type: 'stop' }`, runs its `onStop` handlers, and exits. A service still alive after 3 000 ms is killed.

### Supervisor

- **SHELL-10.** When a utility process exits for any reason other than a requested stop, the supervisor reports the death to `diagnostics` (DIAG-7), emits `serviceStatusChanged` with state `down`, and starts it again at once.
- **SHELL-11.** After a restart the broker creates a new message channel for that service and emits `shell.servicePort` (architecture §2.2).
- **SHELL-12.** Every pending request to a dead service resolves with `SERVICE_DOWN` (BUS-4).
- **SHELL-13.** A sixth death of the same service within 60 seconds stops automatic restart. `needsManualRestart` becomes true. `shell.restartService` starts it again and clears the count.
- **SHELL-14.** When the renderer process is gone (`render-process-gone`), the window reloads it. A third loss within 60 seconds shows a native dialog offering "Reload" or "Quit".
- **SHELL-15.** A renderer that stops responding for 10 seconds (`unresponsive`) is reloaded.

### Bus

- **SHELL-16.** The bus client implements `Bus` and rules BUS-1 to BUS-6.
- **SHELL-17.** `Bus.call` to a channel whose owner is the current process runs the handler directly, with the same validation.
- **SHELL-18.** `Bus.handle` called for a channel whose owner is another process throws at registration. This is a programmer error.
- **SHELL-19.** Registering a second handler for the same channel throws at registration.

### Module loading

- **SHELL-20.** Each process loads the modules in its `module-list.ts`, in list order, by calling `register(ctx)`. A `register` that throws is logged at `error`; that module is skipped and the others still load (P-12).

### Window and system

- **SHELL-21.** `openExternal` accepts only `https:` URLs. Anything else returns `BAD_REQUEST`.
- **SHELL-22.** `trashItem` uses the system Recycle Bin. A failure returns `FILE_WRITE_FAILED` and the item is left in place.
- **SHELL-23.** `notify` shows a notification only when the window is not focused. Clicking it restores and focuses the window, then emits a focus request for `focusPanel`.
- **SHELL-24.** The main window refuses all navigation and all new windows (SEC-2).
- **SHELL-25.** The title bar is drawn by the renderer. The window is created frameless with the native window controls overlay enabled, so minimise, maximise and close stay native.

- **SHELL-26.** At launch `main` creates a token of 32 random bytes, hex encoded. `getLaunchToken` returns it only to a caller in `link-service`. A call arriving from the renderer returns `BAD_REQUEST`. The token is never logged (P-8).

- **SHELL-27.** `openPath` opens a file in its default program only when its extension is in the list in the contract. Any other extension returns `BAD_REQUEST`, so HSOS can never be made to launch a program or script.

## Preload API

```ts
window.hsos = {
  bus: {
    send(envelope: Envelope): void;                        // to main
    onMessage(listener: (envelope: Envelope) => void): void; // from main
    onServicePort(listener: (service: ServiceId, port: MessagePort) => void): void;
  },
  platform: { appVersion: string; isPackaged: boolean },
};
```

Nothing else is exposed (SEC-3).

## States

| Service state | Meaning | What panels of that service show |
|---|---|---|
| `starting` | Process launched, not ready | Loading state |
| `ready` | Handling requests | Ready |
| `down` | Dead, restart in progress or stopped | Error state: "This part of HSOS stopped. Restarting…" or a "Restart service" button when `needsManualRestart` |
| `stopped` | Stopped on request during quit | nothing |

## Tests

| Rule | Level | Given | When | Then |
|---|---|---|---|---|
| SHELL-1 | e2e | the app is running | it is launched again | one window exists and it has focus |
| SHELL-4 | integration | a fake service that never sends `ready` | the supervisor starts it | it is started twice, then reported `down` with `needsManualRestart` true |
| SHELL-6 | unit | saved bounds outside all displays | bounds are restored | the result is 1280 by 800, centred on the primary display |
| SHELL-10 | fault | the app is running | `workspace-service` is killed | a crash file appears and the service reaches `ready` again within 5 s |
| SHELL-12 | integration | a request pending to a fake service | the service dies | the request resolves with `SERVICE_DOWN` |
| SHELL-13 | integration | a fake service that exits at once | the supervisor runs with a fake clock | after the sixth death no further start happens; `restartService` starts it |
| SHELL-14 | fault | the app is running | the renderer is killed | the window reloads and reaches `uiReady` |
| SHELL-16, BUS-1 | unit | a handler for a channel | a request with a wrong payload arrives | the handler is not called and the caller gets `BAD_REQUEST` |
| SHELL-16, BUS-2 | unit | a handler that throws | it is called | the caller gets `INTERNAL` |
| SHELL-16, BUS-3 | unit | a handler that never answers, fake clock | the channel's timeout passes | the caller gets `TIMEOUT` |
| SHELL-17 | unit | caller and owner in the same process | `call` is used | the handler runs and its result is returned |
| SHELL-18 | unit | a channel owned by `pty-host` | `handle` is called in `main` | it throws |
| SHELL-20 | unit | three modules, the second throws in `register` | the loader runs | the first and third are registered and one error is logged |
| SHELL-21 | unit | the URL `file:///C:/x` | `openExternal` is called | the result is `BAD_REQUEST` |
| SHELL-24 | e2e | the app is running | the renderer calls `window.open('https://example.com')` | no new window opens |
