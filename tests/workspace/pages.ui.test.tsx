import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { gitChannels } from '@hsos/contracts/channels/git';
import type { RepoStatus } from '@hsos/contracts/channels/git';
import { workspaceChannels } from '@hsos/contracts/channels/workspace';
import type { ProjectInfo } from '@hsos/contracts/channels/workspace';
import type { CommandDefinition, PanelDefinition, PanelProps, UiContext } from '@hsos/contracts/module';
import { ok } from '@hsos/contracts/result';
import { zAbsPath } from '@hsos/contracts/schemas';
import { createKeyDispatcher, resolveBindings } from '@hsos/ui-kit';
import type { KeyDispatcher } from '@hsos/ui-kit';
import { AppFrame } from '../../src/modules/workspace/panel/AppFrame';
import type { FrameRegistry } from '../../src/modules/workspace/panel/AppFrame';
import { PAGES, pageBeside, usePageStore } from '../../src/modules/workspace/panel/page-store';
import { goToPage } from '../../src/modules/workspace/panel/page-transition';
import { repoName, TitleBar } from '../../src/modules/workspace/panel/TitleBar';
import { register } from '../../src/modules/workspace/register.ui';
import { createFakeBus } from '../fakes/fake-bus';
import { createFakeClock } from '../fakes/fake-clock';
import { sourceClassNames } from '../ui-kit/css-composes';

/** jsdom has no ResizeObserver; dockview and the lists only need it to exist. */
class StillResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeAll(() => {
  globalThis.ResizeObserver ??= StillResizeObserver;
  Element.prototype.scrollIntoView ??= () => undefined;
});

beforeEach(() => {
  usePageStore.setState({ page: 'code', shown: new Set(['code']), lastFocus: {} });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Reflect.deleteProperty(document, 'startViewTransition');
  document.documentElement.removeAttribute('data-page-direction');
});

const log = { log: vi.fn() };

function panel(
  type: string,
  kind: 'side' | 'dock',
  title: string,
  component: (props: PanelProps<unknown>) => React.ReactNode,
  icon = 'files',
  allowMultiple = true,
): PanelDefinition<unknown> {
  return {
    type,
    kind,
    title,
    icon,
    stateSchema: z.unknown(),
    initialState: {},
    component: component as PanelDefinition<unknown>['component'],
    allowMultiple,
  };
}

type Harness = {
  registry: FrameRegistry;
  commands: Map<string, CommandDefinition>;
  open(type: string, state?: unknown): void;
};

function makeHarness(panels: PanelDefinition<unknown>[]): Harness {
  const commands = new Map<string, CommandDefinition>();
  register({
    registerCommand: (definition: CommandDefinition) => commands.set(definition.id, definition),
  } as unknown as UiContext);
  let opener: ((type: string, state: unknown) => void) | null = null;
  const registry: FrameRegistry = {
    panels: new Map(panels.map((definition) => [definition.type, definition])),
    statusItems: new Map(),
    commands,
    setPanelOpener: (next) => {
      opener = next;
    },
  };
  return {
    registry,
    commands,
    open: (type, state) => {
      if (opener === null) throw new Error('the frame has not set its panel opener');
      opener(type, state ?? {});
    },
  };
}

const frame = (harness: Harness) =>
  render(<AppFrame bus={null} registry={harness.registry} log={log} keyFor={() => null} message="" />);

const pageSection = (page: string): HTMLElement | null => document.querySelector(`[data-page="${page}"]`);
const isInert = (element: HTMLElement | null): boolean => element?.hasAttribute('inert') === true;
const isHiddenPage = (element: HTMLElement | null): boolean =>
  element !== null && sourceClassNames(element).includes('hiddenPage');

describe('WS-40 three pages and the switcher', () => {
  it('WS-40 Ctrl+3 with focus in a terminal shows the notes section, makes code inert, and marks Notes current', () => {
    const files = panel('files.tree', 'side', 'Files', () => (
      <div data-hsos-terminal="" tabIndex={0} data-testid="term" />
    ));
    const harness = makeHarness([files]);
    frame(harness);
    const dispatcher: KeyDispatcher = createKeyDispatcher({
      target: window,
      clock: createFakeClock(),
      log,
      command: (id) => harness.commands.get(id),
    });
    dispatcher.setBindings(resolveBindings(harness.commands.values(), {}).byKey);
    const terminal = screen.getByTestId('term');
    act(() => terminal.focus());
    expect(document.activeElement).toBe(terminal);
    expect(isInert(pageSection('notes'))).toBe(false);
    fireEvent.keyDown(terminal, { key: '3', code: 'Digit3', ctrlKey: true });
    dispatcher.dispose();

    const notes = pageSection('notes');
    expect(notes).not.toBeNull();
    expect(isInert(notes)).toBe(false);
    expect(isHiddenPage(notes)).toBe(false);
    expect(isInert(pageSection('code'))).toBe(true);
    expect(isHiddenPage(pageSection('code'))).toBe(true);
    const current = screen.getByRole('button', { name: 'Notes' });
    expect(current.getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('button', { name: 'Code' }).hasAttribute('aria-current')).toBe(false);
  });

  it('WS-40 pageBeside gives dashboard and notes for code, and dashboard for notes forward', () => {
    expect(pageBeside('code', -1)).toBe('dashboard');
    expect(pageBeside('code', 1)).toBe('notes');
    expect(pageBeside('notes', 1)).toBe('dashboard');
    expect(PAGES).toEqual(['dashboard', 'code', 'notes']);
  });

  it('WS-40 the page switcher buttons go to their page', () => {
    frame(makeHarness([]));
    fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }));
    expect(usePageStore.getState().page).toBe('dashboard');
    expect(screen.getByRole('button', { name: 'Dashboard' }).getAttribute('aria-current')).toBe('page');
  });

  it('MOT-5 goToPage calls document.startViewTransition once and runs the update at once', () => {
    const start = vi.fn((update: () => void) => {
      update();
      return { finished: Promise.resolve(), skipTransition: () => undefined };
    });
    Object.defineProperty(document, 'startViewTransition', { configurable: true, value: start });
    frame(makeHarness([]));
    act(() => goToPage('dashboard'));
    expect(start).toHaveBeenCalledTimes(1);
    expect(usePageStore.getState().page).toBe('dashboard');
  });
});

describe('WS-41 pages stay mounted', () => {
  it('WS-41 a page shown once stays in the DOM, hidden and inert, when the frame goes back to code', () => {
    frame(makeHarness([]));
    act(() => goToPage('dashboard'));
    expect(pageSection('dashboard')).not.toBeNull();
    act(() => goToPage('code'));
    const dashboard = pageSection('dashboard');
    expect(dashboard).not.toBeNull();
    expect(isInert(dashboard)).toBe(true);
    expect(isHiddenPage(dashboard)).toBe(true);
    expect(isInert(pageSection('code'))).toBe(false);
  });

  it('WS-41 a page never shown is not mounted', () => {
    frame(makeHarness([]));
    expect(pageSection('notes')).toBeNull();
    expect(pageSection('dashboard')).toBeNull();
  });

  it('WS-41 the code section is the same node after a visit to the dashboard', () => {
    frame(makeHarness([]));
    const before = pageSection('code');
    act(() => goToPage('dashboard'));
    act(() => goToPage('code'));
    expect(pageSection('code')).toBe(before);
  });
});

describe('WS-45 focus comes back', () => {
  it('WS-45 a button on code that had focus has focus again after dashboard and back', () => {
    const files = panel('files.tree', 'side', 'Files', () => <button type="button">Probe</button>);
    frame(makeHarness([files]));
    const probe = screen.getByRole('button', { name: 'Probe' });
    act(() => probe.focus());
    expect(document.activeElement).toBe(probe);
    act(() => goToPage('dashboard'));
    // A real browser drops focus from the inert page; jsdom does not, so the blur is done here.
    act(() => (document.activeElement as HTMLElement).blur());
    expect(document.activeElement).not.toBe(probe);
    act(() => goToPage('code'));
    expect(document.activeElement).toBe(probe);
  });
});

describe('WS-43 panels open in the dock of the visible page', () => {
  it('WS-43 on the notes page a dock panel opens in the Notes dock, not the Code dock', async () => {
    const note = panel('notes.note', 'dock', 'Note', () => <p>note body</p>, 'file');
    const harness = makeHarness([note]);
    frame(harness);
    act(() => goToPage('notes'));
    act(() => harness.open('notes.note'));
    const body = await screen.findByText('note body');
    expect(body.closest('[aria-label="Notes dock"]')).not.toBeNull();
    expect(body.closest('[aria-label="Code dock"]')).toBeNull();
  });

  it('WS-43 on the code page the same dock panel opens in the Code dock', async () => {
    const note = panel('notes.note', 'dock', 'Note', () => <p>note body</p>, 'file');
    const harness = makeHarness([note]);
    frame(harness);
    act(() => harness.open('notes.note'));
    const body = await screen.findByText('note body');
    expect(body.closest('[aria-label="Code dock"]')).not.toBeNull();
  });
});

describe('WS-11 single-instance dock panels', () => {
  it('WS-11 a dock panel with allowMultiple false opened again with new state leaves one panel of that type', async () => {
    const view = panel(
      'settings.screen',
      'dock',
      'Settings',
      (props) => <p data-testid="settings-panel">{JSON.stringify(props.state)}</p>,
      'settings',
      false,
    );
    const harness = makeHarness([view]);
    frame(harness);
    act(() => harness.open('settings.screen', { tab: 'one' }));
    expect((await screen.findByTestId('settings-panel')).textContent).toBe('{"tab":"one"}');
    act(() => harness.open('settings.screen', { tab: 'two' }));
    await waitFor(() => expect(screen.getByTestId('settings-panel').textContent).toBe('{"tab":"two"}'));
    expect(screen.getAllByTestId('settings-panel')).toHaveLength(1);
  });

  it('WS-11 a dock panel with allowMultiple true opens a second panel', async () => {
    const view = panel(
      'terminal.shell',
      'dock',
      'Terminal',
      () => <p data-testid="shell">shell</p>,
      'terminal',
      true,
    );
    const harness = makeHarness([view]);
    frame(harness);
    act(() => harness.open('terminal.shell'));
    await screen.findByTestId('shell');
    act(() => harness.open('terminal.shell'));
    await waitFor(() => expect(screen.getAllByTestId('shell')).toHaveLength(2));
  });
});

describe('WS-13 a failing panel stays in its own frame', () => {
  it('WS-13 a dock panel that throws shows the error state while a healthy one beside it renders', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const broken = panel(
      'broken.view',
      'dock',
      'Broken',
      () => {
        throw new Error('kaput');
      },
      'error',
    );
    const healthy = panel('healthy.view', 'dock', 'Healthy', () => <p>all fine</p>, 'check');
    const harness = makeHarness([broken, healthy]);
    frame(harness);
    act(() => harness.open('broken.view'));
    act(() => harness.open('healthy.view'));
    // The second panel opened last, so it is the visible tab; its content renders.
    expect(await screen.findByText('all fine')).toBeTruthy();
    expect(screen.getByText('all fine').closest('[role="alert"]')).toBeNull();
    // The first panel's tab shows its own error state, without touching the healthy panel.
    const brokenTab = document.querySelector('[data-tab-panel-id^="broken.view"]') as HTMLElement;
    fireEvent.pointerDown(brokenTab);
    fireEvent.mouseDown(brokenTab);
    fireEvent.click(brokenTab);
    const message = await screen.findByText('Broken failed: kaput');
    expect(message.closest('[role="alert"]')).not.toBeNull();
    expect(log.log).toHaveBeenCalledWith(
      'error',
      'workspace.panel_failed',
      expect.objectContaining({ message: 'kaput' }),
    );
  });
});

describe('UI-30 one backdrop canvas for the window', () => {
  it('UI-30 after two page changes there is one canvas under [data-hsos-backdrop], the same node throughout', () => {
    frame(makeHarness([]));
    const canvases = () => document.querySelectorAll('[data-hsos-backdrop] canvas');
    expect(canvases()).toHaveLength(1);
    const first = canvases()[0];
    act(() => goToPage('dashboard'));
    act(() => goToPage('notes'));
    expect(canvases()).toHaveLength(1);
    expect(canvases()[0]).toBe(first);
    expect(document.querySelectorAll('canvas')).toHaveLength(1);
  });
});

describe('title bar and side tabs', () => {
  it('GIT-14 repoName gives owner/repo for a GitHub URL and null for a bad URL', () => {
    expect(repoName('https://github.com/a/b')).toBe('a/b');
    expect(repoName('https://github.com/a/b/tree/main')).toBe('a/b');
    expect(repoName('not a url')).toBeNull();
    expect(repoName('https://github.com/a')).toBeNull();
    expect(repoName(null)).toBeNull();
  });

  const project: ProjectInfo = {
    id: '0123456789abcdef' as ProjectInfo['id'],
    path: zAbsPath.parse('C:\\Users\\x\\repo'),
    name: 'repo',
  };
  const status = (webUrl: string | null): RepoStatus => ({
    kind: 'repo',
    root: project.path,
    branch: 'main',
    upstream: 'origin/main',
    ahead: 1,
    behind: 0,
    files: [],
    operation: 'none',
    lastFetchAt: null,
    isOffline: false,
    remoteUrl: webUrl,
    webUrl,
    busy: 'none',
  });

  function titleBar(webUrl: string | null) {
    const bus = createFakeBus();
    bus.handle(gitChannels.getStatus, () => ok(status(webUrl)));
    bus.handle(workspaceChannels.listRecentProjects, () => ok([]));
    render(<TitleBar bus={bus} project={project} keyFor={() => null} runCommand={() => undefined} />);
  }

  it('WS-30 the repo button shows owner/repo when the status has a webUrl', async () => {
    titleBar('https://github.com/acme/widgets');
    expect(await screen.findByText('acme/widgets')).toBeTruthy();
  });

  it('WS-30 the repo button is absent when webUrl is null', async () => {
    titleBar(null);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(screen.queryByTitle(/on GitHub/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Project menu' })).toBeTruthy();
  });

  it('WS-30 the side tabs list the registered side views in order with Settings last', () => {
    const harness = makeHarness([
      panel('files.tree', 'side', 'Files', () => null, 'files'),
      panel('git.changes', 'side', 'Changes', () => null, 'changes'),
      panel('hud.panel', 'side', 'HUD', () => null, 'hud'),
      panel('terminal.shell', 'dock', 'Terminal', () => null, 'terminal'),
    ]);
    harness.commands.set('settings.open', {
      id: 'settings.open',
      title: 'Open Settings',
      defaultKey: null,
      global: false,
      run: () => undefined,
    });
    frame(harness);
    const tabs = screen.getByRole('toolbar', { name: 'Side view tabs' });
    const names = [...tabs.querySelectorAll('button')].map((button) => button.getAttribute('aria-label'));
    expect(names).toEqual(['Files', 'Changes', 'Settings']);
  });
});
