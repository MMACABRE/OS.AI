# Module: ui-kit

## Purpose

The one place where the look and feel of HSOS is built. Every panel is assembled from these components, so the whole app is consistent and a design change is made once.

## Interface

Exports React components and hooks from `src/modules/ui-kit/index.ts`. This is the single module other modules' `panel/` code may import directly, as `@hsos/ui-kit`. It has no service side and no channels.

- Runs in: `ui`.
- Third-party packages allowed: `react`, Radix packages, `cmdk`.

## Rules for all components

- **UI-1.** Every colour, size, radius, font and duration in a component's CSS is a token variable from `contracts/theme.ts`. A lint rule rejects hex colours, `rgb(`, and `px` values other than `0`, `1px` and `2px` in CSS modules.
- **UI-2.** Every interactive component works with the keyboard alone and shows the focus ring from `visual-direction.md` on keyboard focus.
- **UI-3.** Every icon-only control has an accessible name and a tooltip showing that name and its key binding.
- **UI-4.** Components take no `style` or `className` props. Variation is expressed through typed props listed below.
- **UI-5.** Text passed as a prop is rendered as text. No component renders HTML strings.
- **UI-6.** Animations use only `opacity` and `transform` and the motion tokens (P-42).
- **UI-7.** Lists with more than 200 rows are virtualised: only visible rows are in the DOM.

## Components

| Component | Props (beyond children) | Notes |
|---|---|---|
| `Button` | `variant: 'primary' \| 'default' \| 'ghost' \| 'danger'`, `size: 'small' \| 'normal'`, `icon?`, `disabled?`, `onPress` | One `primary` at most per view |
| `IconButton` | `icon`, `label`, `onPress`, `pressed?` | 24 by 24 |
| `TextField` | `value`, `onChange`, `placeholder?`, `invalidMessage?`, `mono?` | Message shown beneath when set |
| `NumberField` | `value`, `onChange`, `min`, `max`, `step` | Arrow keys step |
| `Switch` | `checked`, `onChange`, `label` | |
| `Select` | `value`, `options`, `onChange` | Radix select |
| `Tooltip` | `text`, `keyBinding?` | Opens after 500 ms |
| `Menu` | `items: MenuItem[]` | Context and dropdown menus; items have `label`, `icon?`, `keyBinding?`, `danger?`, `onSelect` |
| `Dialog` | `title`, `onClose`, `actions` | Focus trapped; Escape closes; focus returns to the opener |
| `ConfirmDialog` | `title`, `body`, `confirmLabel`, `danger?`, `onConfirm`, `onCancel` | Cancel is the default focus when `danger` |
| `PanelFrame` | `title`, `actions?`, `state: PanelViewState` | Draws the four states (P-40); children render only when `state.kind` is `ready` |
| `EmptyState` | `message`, `action?` | Top-left aligned |
| `ErrorState` | `message`, `onRetry?`, `logProcess?` | "Show log" opens the log folder |
| `Skeleton` | `rows` | Appears after 150 ms |
| `List` | `rows`, `rowHeight`, `renderRow`, `selectedId`, `onSelect`, `onActivate` | Virtualised; arrows, Home, End, type-ahead |
| `Tree` | `nodes`, `expandedIds`, `onToggle`, `selectedId`, `onSelect`, `onActivate`, `renderLabel` | Virtualised; Left and Right collapse and expand |
| `Tabs` | `tabs`, `activeId`, `onChange` | For use inside a panel; dock tabs belong to `workspace` |
| `SplitView` | `direction`, `initialSizes`, `minSizes`, `onSizesChange` | Draggable divider, 4 px hit area on a 1 px line |
| `ProgressBar` | `value` (0 to 1), `tone: 'ok' \| 'warn' \| 'danger' \| 'info'`, `label` | Label is read by screen readers |
| `Badge` | `tone`, `text` | |
| `StatusDot` | `tone`, `pulseOnce?`, `label` | 8 px circle; never colour alone, always with `label` text nearby or as accessible name |
| `Icon` | `name`, `size?` | Inline SVG, `currentColor` |
| `Kbd` | `binding` | Renders a key binding |
| `Toast` | via `useToast()` | Bottom right, 4 s, at most 3 stacked; errors stay until dismissed |
| `CommandPalette` | none | See below |
| `DiffView` | `before`, `after`, `mode: 'inline' \| 'split'`, `onLineAction?` | Used by `files`, `history`, `review` |
| `MarkdownView` | `source`, `onLinkActivate` | Rendered with `micromark`; raw HTML in the source is shown as text |
| `CodeView` | `value`, `language`, `readOnly`, `onChange?`, `onSave?` | Wraps CodeMirror; theme built from tokens |

```ts
type PanelViewState =
  | { kind: 'loading' }
  | { kind: 'empty'; message: string; action?: { label: string; onPress: () => void } }
  | { kind: 'error'; message: string; onRetry?: () => void }
  | { kind: 'ready' };
```

## Icons

The set, by name: `files`, `changes`, `graph`, `activity`, `artifacts`, `hud`, `terminal`, `browser`, `settings`, `search`, `close`, `add`, `split-right`, `split-down`, `maximize`, `chevron-right`, `chevron-down`, `folder`, `folder-open`, `file`, `file-code`, `file-markdown`, `file-image`, `git-branch`, `arrow-up`, `arrow-down`, `sync`, `check`, `warning`, `error`, `info`, `play`, `stop`, `star`, `star-filled`, `pin`, `comment`, `send`, `history`, `restore`, `trash`, `external`, `copy`, `agent`, `subagent`, `clock`, `target`, `refresh`, `more`.

Each is a 16 by 16 SVG with 1.5 px strokes, round caps, no fill, stored in `src/modules/ui-kit/icons/<name>.svg.tsx`.

## Command palette

- **UI-10.** Lists every command registered through `UiContext.registerCommand`, with title and effective key binding.
- **UI-11.** Typing filters by fuzzy match on the title. Matches are ranked: prefix match, then word-start match, then any subsequence. Most recently used commands rank first among equals.
- **UI-12.** A provider can add a mode. `files` registers file mode (prefix none, opened by `Ctrl+P`); typing `>` at the start switches to command mode.
- **UI-13.** Enter runs the selected command and closes the palette. A command that returns a rejected promise shows an error toast with its message.
- **UI-14.** Closing returns focus to the element that had it before opening.

## Key handling

- **UI-20.** One key listener on the window resolves key presses to commands using the effective bindings from `settings`.
- **UI-21.** While focus is inside a terminal, only commands with `global: true` are run. Every other key goes to the terminal (P-44).
- **UI-22.** While focus is inside a text input, bindings without `Ctrl` or `Alt` are not run.
- **UI-23.** A chord's first part waits 1 500 ms for the second part, showing the pending part in the status bar. Any other key cancels it.

## Tests

| Rule | Level | Given | When | Then |
|---|---|---|---|---|
| UI-1 | unit (lint fixture) | a CSS module containing `color: #fff` | lint runs | it reports an error |
| UI-2 | component | each interactive component | Tab, Enter and Space are used | it focuses and activates |
| UI-3 | component | an `IconButton` | it renders | it has an accessible name |
| UI-5 | component | `MarkdownView` with source `<img src=x onerror=alert(1)>` | it renders | no `img` element exists; the text is shown |
| UI-7 | component | a `List` with 10 000 rows | it renders | fewer than 100 row elements are in the DOM |
| P-40 | component | `PanelFrame` | each of the four states is set | the matching content shows and children show only in `ready` |
| UI-11 | unit | commands "New Terminal", "Terminal: Clear", "Open Settings" | the query `term` | order is "Terminal: Clear", "New Terminal" |
| UI-13 | component | a command that rejects | it is run from the palette | an error toast shows its message |
| UI-14 | component | focus in a text field | the palette opens and closes | the text field has focus again |
| UI-21 | component | focus inside a terminal element; `Ctrl+B` not global, `Ctrl+Shift+P` global | both keys are pressed | only the palette command runs |
| UI-23 | component | binding `Ctrl+K Ctrl+T`, fake clock | `Ctrl+K`, then 2 000 ms pass, then `Ctrl+T` | the command does not run |
| SET-15 | component | reduced motion on | a `Dialog` opens | its transition duration is `0ms` |
