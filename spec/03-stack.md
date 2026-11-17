# Stack

## Versions

Read from the npm registry on 2026-11-17. Install these exact versions. `package.json` uses exact versions with no `^` or `~`.

| Package | Version | Used for |
|---|---|---|
| Node.js | 24.x | Build tooling |
| `electron` | 45.3.3 | App runtime |
| `typescript` | 7.0.2 | Language |
| `electron-vite` | 6.0.0 | Build for main, preload, renderer |
| `vite` | 8.3.8 | Bundler |
| `electron-builder` | 26.18.0 | Packaging |
| `react`, `react-dom` | 19.3.1 | UI |
| `zustand` | 5.1.0 | UI state |
| `zod` | 4.6.7 | Schemas |
| `dockview` | 8.9.0 | Dock layout |
| `@radix-ui/react-dialog` and sibling Radix packages | 1.3.1 line | Accessible dialogs, menus, tooltips |
| `cmdk` | 1.1.1 | Command palette |
| `@xterm/xterm` | 6.0.0 | Terminal drawing |
| `@xterm/addon-webgl` | 0.19.0 | GPU renderer |
| `@xterm/addon-fit` | 0.11.0 | Resize |
| `@xterm/addon-serialize` | 0.14.0 | Scrollback save |
| `@xterm/addon-search` | 0.16.0 | Find |
| `@xterm/addon-web-links` | 0.12.0 | Links |
| `@xterm/addon-unicode-graphemes` | 0.4.0 | Character widths |
| `node-pty` | 1.1.0 | ConPTY binding |
| `codemirror`, `@codemirror/view` | 6.0.2, 6.43.15 | Viewer and editor |
| `better-sqlite3` | 13.2.0 | Local databases |
| `@parcel/watcher` | 2.6.0 | File watching |
| `write-file-atomic` | 8.0.0 | Atomic writes |
| `diff` | 9.0.0 | Text diffs |
| `micromark` | 4.0.3 | Markdown rendering |
| `sigma` | 4.0.6 | Graph drawing |
| `graphology` | 0.26.0 | Graph data |
| `graphology-layout-forceatlas2` | 0.10.1 | Graph layout |
| `graphology-communities-louvain` | 2.0.2 | Graph communities |
| `@modelcontextprotocol/sdk` | 1.32.2 | MCP server |
| `vitest` | 5.1.0 | Unit and integration tests |
| `@playwright/test` | 1.65.1 | End-to-end tests on the Electron app |
| `fast-check` | 4.10.2 | Property tests |
| `eslint` | 10.15.0 | Lint |
| `eslint-plugin-boundaries` | 7.4.4 | Module boundary rules |
| `dependency-cruiser` | 18.8.0 | Dependency direction check |
| `prettier` | 3.10.1 | Formatting |

Package manager: `npm`. Fonts: Geist and Geist Mono, bundled as files, loaded from disk.

### Third-party APIs

The spec author's knowledge of these libraries may be older than the versions above. For every third-party call:

1. Read the type definitions in `node_modules/<package>` before writing the call.
2. If a name in this spec does not exist in the installed version, use the installed equivalent and record the difference in `PROGRESS.md`.
3. Never downgrade a package to match the spec.

Six APIs carry risk and are proven by the spike tasks in stage 0 before anything depends on them:

| Risk | Spike proves |
|---|---|
| `node-pty` inside an Electron utility process | A shell starts, echoes input, resizes and exits |
| `better-sqlite3` rebuilt for Electron | A database opens, writes and reads in a utility process |
| `@parcel/watcher` on Windows | Create, change, rename and delete events arrive for a nested folder |
| `WebContentsView` with `webContents.debugger` | A page loads and `Page.captureScreenshot` returns an image |
| `MessageChannelMain` between renderer and utility process | 10 MB of binary messages arrive in order |
| `dockview` layout serialise and restore | A layout round-trips through JSON |

If a spike fails, the implementer stops and reports. The fallback choices are listed in each spike task.

## Commands

| Purpose | Command |
|---|---|
| Install | `npm ci` |
| Start in development | `npm run dev` |
| Type check | `npm run typecheck` |
| Lint | `npm run lint` |
| Boundary check | `npm run deps` |
| Unit and integration tests | `npm test` |
| One test file | `npm test -- tests/<path>` |
| End-to-end tests | `npm run e2e` |
| All checks | `npm run check` (typecheck, lint, deps, test) |
| Build | `npm run build` |
| Package to exe | `npm run dist` |
| Session start | `pwsh scripts/init.ps1` |

## Folder layout

```
spec/                     this specification (read-only for the implementer)
  contracts/              shared types, imported as @hsos/contracts
tasks/                    task cards (read-only)
features.json             feature list (implementer flips "passes" only)
PROGRESS.md               session log (implementer appends)
scripts/                  init.ps1, check scripts
src/
  main/                   main process: supervisor, window, bus broker
  preload/                the window.hsos bridge
  services/
    pty-host/             entry point and module list
    workspace-service/
    link-service/
  ui/                     renderer entry, app frame, module list
  modules/<id>/           one folder per module (see 02-architecture.md §4)
tests/
  <id>/                   unit and integration tests for module <id>
  e2e/                    Playwright tests against the built app
  fakes/                  in-memory fakes of contracts
resources/                fonts, icons, default themes, default settings
```

## TypeScript settings

`strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `noImplicitOverride: true`, `noFallthroughCasesInSwitch: true`. No `any`. No `as` casts except on the result of a zod parse. No non-null `!`.

## Code style

One example sets the style. Match it.

```ts
// src/modules/files/service/save-file.ts
import type { Result } from '@hsos/contracts/result';
import { ok, err } from '@hsos/contracts/result';
import type { FileVersion, SaveRequest } from '@hsos/contracts/channels/files';
import type { FileStore } from './file-store';

/** Saves editor content if the file on disk still matches what the editor loaded. FILE-21, P-2. */
export async function saveFile(store: FileStore, request: SaveRequest): Promise<Result<FileVersion>> {
  const current = await store.readVersion(request.path);
  if (!current.ok) return current;

  if (current.value.hash !== request.baseHash) {
    return err('FILE_CHANGED_ON_DISK', 'This file changed on disk since you opened it.', {
      path: request.path,
    });
  }

  return store.writeAtomic(request.path, request.content);
}
```

Conventions shown:

- One exported function or class per file. File name is the kebab-case of the export.
- Dependencies arrive as parameters (`store`). A function never constructs its own collaborators.
- Expected failures return `err(...)`. No `try` around code that returns `Result`.
- Early returns. No `else` after a `return`. No nesting deeper than two levels.
- The doc comment is one line: what it does, then the rule ids it implements.
- Names are whole words: `request`, `current`, never `req`, `cur`.
- Functions stay under 40 lines and files under 200. Split when they grow.
- React components are functions, one per file, props typed with a named `type`. No inline styles. Class names come from a CSS module beside the component, and every value in that CSS is a token variable.

## Boundaries, enforced by lint

- `src/modules/<a>/**` may import: its own folder, `@hsos/contracts/**`, and third-party packages allowed for that module in its spec.
- `src/modules/*/panel/**` and `src/ui/**` may not import Node built-ins, `electron`, or anything under `service/`.
- `src/modules/*/service/**` may not import `react` or anything under `panel/`.
- Only `src/main/**` and `src/preload/**` import `electron`, with one exception: `src/modules/browser/service/**`.
