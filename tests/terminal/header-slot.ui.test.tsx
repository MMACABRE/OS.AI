import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { terminalChannels, terminalHeader, TerminalSettings } from '@hsos/contracts/channels/terminal';
import { workspaceChannels } from '@hsos/contracts/channels/workspace';
import { ok } from '@hsos/contracts/result';
import { zAbsPath, zProjectId, zTerminalId } from '@hsos/contracts/schemas';
import { contributeUi } from '@hsos/ui-kit';
import { createXterm } from '../../src/modules/terminal/panel/create-xterm';
import { HeaderSlot } from '../../src/modules/terminal/panel/header-slot';
import { createTerminalPanel } from '../../src/modules/terminal/panel/TerminalPanel';
import { createFakeBus } from '../fakes/fake-bus';
import { FakeTerminal, ManualResizeObserver, silentLog } from './xterm-fakes';

vi.mock('@xterm/xterm', async () => (await import('./xterm-fakes')).xtermModule);
vi.mock('@xterm/addon-fit', async () => (await import('./xterm-fakes')).fitModule);
vi.mock('@xterm/addon-webgl', async () => (await import('./xterm-fakes')).webglModule);

const t1 = zTerminalId.parse('terminal-001');
/** Contributions made by a test, removed after it so the next test starts with none. */
const stops: (() => void)[] = [];
const contribute: typeof contributeUi = (point, contribution) => {
  const stop = contributeUi(point, contribution);
  stops.push(stop);
  return stop;
};

const offsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');

/** The header host is 28 or 64 px high, as its content says through data-height. */
beforeEach(() => {
  FakeTerminal.created = [];
  ManualResizeObserver.all = [];
  vi.stubGlobal('ResizeObserver', ManualResizeObserver);
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return Number(this.firstElementChild?.getAttribute('data-height') ?? 0);
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 800 });
});

afterEach(() => {
  cleanup();
  for (const stop of stops.splice(0)) stop();
  vi.unstubAllGlobals();
  if (offsetHeight !== undefined) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', offsetHeight);
  if (clientWidth !== undefined) Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth);
  document.documentElement.removeAttribute('style');
});

const bar = (height: number, text: string) => <div data-height={height}>{text}</div>;

describe('TERM-75 the header slot', () => {
  it('TERM-75 a contribution returning a 28 px element, then a 64 px one, reports 28 then 64 through onHeightChange', () => {
    const heights: number[] = [];
    const first = { render: (id: string) => (id === t1 ? bar(28, 'ribbon small') : null) };
    const stopFirst = contribute(terminalHeader, first);
    render(<HeaderSlot terminalId={t1} onHeightChange={(height) => heights.push(height)} />);
    act(() => ManualResizeObserver.fireAll());
    expect(heights).toEqual([28]);

    act(() => stopFirst());
    act(() => {
      contribute(terminalHeader, { render: () => bar(64, 'ribbon tall') });
    });
    expect(screen.getByText('ribbon tall')).toBeTruthy();
    act(() => ManualResizeObserver.fireAll());
    expect(heights).toEqual([28, 64]);
  });

  it('TERM-75 with two contributions, the first returning null, the second one is shown', () => {
    contribute(terminalHeader, { render: () => null });
    contribute(terminalHeader, { render: () => bar(30, 'second shows') });
    render(<HeaderSlot terminalId={t1} onHeightChange={() => undefined} />);
    expect(screen.getByText('second shows')).toBeTruthy();
  });

  it('TERM-75 with two contributions that both return content, only the first one is shown', () => {
    contribute(terminalHeader, { render: () => bar(30, 'first shows') });
    contribute(terminalHeader, { render: () => bar(30, 'second hidden') });
    render(<HeaderSlot terminalId={t1} onHeightChange={() => undefined} />);
    expect(screen.getByText('first shows')).toBeTruthy();
    expect(screen.queryByText('second hidden')).toBeNull();
  });

  it('TERM-75 the panel refits after each header height change: a terminal.resize call follows each', async () => {
    const bus = createFakeBus();
    const resizes: { cols: number; rows: number }[] = [];
    bus.handle(workspaceChannels.getCurrentProject, () => ok(null));
    bus.handle(terminalChannels.resize, (payload) => {
      resizes.push({ cols: payload.cols, rows: payload.rows });
      return ok({});
    });
    bus.handle(terminalChannels.attach, () =>
      ok({
        info: {
          id: t1,
          projectId: zProjectId.parse('0123456789abcdef'),
          cwd: zAbsPath.parse('C:\\Users\\x\\repo'),
          shellPath: 'pwsh.exe',
          worktree: null,
          launch: null,
          startedAt: 1 as never,
          cols: 80,
          rows: 24,
          state: 'running' as const,
          exitCode: null,
        },
        replay: new Uint8Array(0),
        lastSeq: 0,
      }),
    );
    let height = 28;
    contribute(terminalHeader, {
      render: (id: string) => (id === t1 ? bar(height, 'ribbon') : null),
    });
    const Panel = createTerminalPanel({
      bus,
      log: silentLog,
      settings: () => TerminalSettings.parse({}),
      openSettings: () => undefined,
    });
    const { container, rerender } = render(
      <Panel
        panelId={'panel-000001' as never}
        state={{ terminalId: t1, cwd: '', worktree: null, launch: null, fontSizeDelta: 0 }}
        setState={() => undefined}
        isFocused={false}
      />,
    );
    await waitFor(() => expect(container.querySelector('[data-phase="ready"]')).not.toBeNull());
    // The attach path fits twice (TERM-23); wait for it to finish so only the header's refits are counted.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 120));
    });
    const before = resizes.length;
    expect(before).toBeGreaterThan(0);

    act(() => ManualResizeObserver.fireAll());
    await waitFor(() => expect(resizes.length).toBeGreaterThan(before));
    const afterFirst = resizes.length;

    height = 64;
    rerender(
      <Panel
        panelId={'panel-000001' as never}
        state={{ terminalId: t1, cwd: '', worktree: null, launch: null, fontSizeDelta: 0 }}
        setState={() => undefined}
        isFocused
      />,
    );
    act(() => ManualResizeObserver.fireAll());
    await waitFor(() => expect(resizes.length).toBeGreaterThan(afterFirst));
  });
});

describe('TERM-76 a see-through terminal that stays readable', () => {
  const root = () => document.documentElement;
  const makeTerminal = () => {
    createXterm(document.createElement('div'), TerminalSettings.parse({}), silentLog);
    const terminal = FakeTerminal.created.at(-1);
    if (terminal === undefined) throw new Error('no terminal was created');
    return terminal;
  };

  it('TERM-76 surface alpha 0.9 gives allowTransparency and a background rgba(..., 0.9)', () => {
    root().style.setProperty('--surface-terminal-alpha', '0.9');
    root().style.setProperty('--surface-text-minAlpha', '0.78');
    root().style.setProperty('--color-term-background', '#0B0A09');
    const terminal = makeTerminal();
    expect(terminal.options.allowTransparency).toBe(true);
    expect((terminal.options.theme as { background: string }).background).toBe('rgba(11, 10, 9, 0.9)');
  });

  it('TERM-76 surface alpha 0.3 under minAlpha 0.78 gives a background rgba(..., 0.78)', () => {
    root().style.setProperty('--surface-terminal-alpha', '0.3');
    root().style.setProperty('--surface-text-minAlpha', '0.78');
    root().style.setProperty('--color-term-background', '#0B0A09');
    const terminal = makeTerminal();
    expect((terminal.options.theme as { background: string }).background).toBe('rgba(11, 10, 9, 0.78)');
  });

  it('TERM-52 when WebGL cannot start the terminal is still created and a warning is logged', () => {
    silentLog.log.mockClear();
    const terminal = makeTerminal();
    expect(terminal.disposed).toBe(false);
    expect(silentLog.log).toHaveBeenCalledWith('warn', 'terminal.webgl_unavailable', expect.anything());
  });
});
