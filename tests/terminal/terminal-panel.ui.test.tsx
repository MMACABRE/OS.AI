import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { terminalChannels, TerminalSettings } from '@hsos/contracts/channels/terminal';
import { workspaceChannels } from '@hsos/contracts/channels/workspace';
import { ok } from '@hsos/contracts/result';
import { zAbsPath, zProjectId, zTerminalId } from '@hsos/contracts/schemas';
import { createTerminalPanel } from '../../src/modules/terminal/panel/TerminalPanel';
import type { TerminalPanelState } from '../../src/modules/terminal/panel/TerminalPanel';
import { createFakeBus } from '../fakes/fake-bus';
import { FakeTerminal, ManualResizeObserver, silentLog } from './xterm-fakes';

vi.mock('@xterm/xterm', async () => (await import('./xterm-fakes')).xtermModule);
vi.mock('@xterm/addon-fit', async () => (await import('./xterm-fakes')).fitModule);
vi.mock('@xterm/addon-webgl', async () => (await import('./xterm-fakes')).webglModule);

const t1 = zTerminalId.parse('terminal-001');
const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');

beforeEach(() => {
  FakeTerminal.created = [];
  ManualResizeObserver.all = [];
  vi.stubGlobal('ResizeObserver', ManualResizeObserver);
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 800 });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (clientWidth !== undefined) Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth);
});

/** A terminal panel on a fake bus that attaches to an existing shell. Resolves once it is ready. */
async function openPanel(fontSize: number, fontSizeDelta: number) {
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
  const setState = vi.fn<(state: TerminalPanelState) => void>();
  const Panel = createTerminalPanel({
    bus,
    log: silentLog,
    settings: () => TerminalSettings.parse({ fontSize }),
    openSettings: () => undefined,
  });
  const state: TerminalPanelState = { terminalId: t1, cwd: '', worktree: null, launch: null, fontSizeDelta };
  const { container } = render(
    <Panel panelId={'panel-000001' as never} state={state} setState={setState} isFocused={false} />,
  );
  await waitFor(() => expect(container.querySelector('[data-phase="ready"]')).not.toBeNull());
  // The attach path fits twice (TERM-23); wait for it so the wheel's own fit can be told apart.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 120));
  });
  const terminal = FakeTerminal.created.at(-1);
  if (terminal === undefined) throw new Error('no terminal was created');
  const screen = container.querySelector('[data-hsos-terminal]');
  if (!(screen instanceof HTMLElement)) throw new Error('no terminal screen');
  return { terminal, screen, setState, resizes };
}

const wheel = (target: HTMLElement, init: WheelEventInit): WheelEvent => {
  const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, ...init });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
};

describe('OWNER-2 Ctrl+wheel changes the terminal font size', () => {
  it('OWNER-2a font size 13, Ctrl+wheel up: fontSize 14, fontSizeDelta 1 saved, terminal resized, default prevented', async () => {
    const { terminal, screen, setState, resizes } = await openPanel(13, 0);
    expect(terminal.options.fontSize).toBe(13);
    const before = resizes.length;
    const event = wheel(screen, { ctrlKey: true, deltaY: -100 });
    expect(terminal.options.fontSize).toBe(14);
    expect(setState).toHaveBeenCalledTimes(1);
    expect(setState.mock.calls[0]?.[0].fontSizeDelta).toBe(1);
    expect(event.defaultPrevented).toBe(true);
    await waitFor(() => expect(resizes.length).toBeGreaterThan(before));
  });

  it('OWNER-2a Ctrl+wheel down makes the font one smaller', async () => {
    const { terminal, screen, setState } = await openPanel(13, 0);
    wheel(screen, { ctrlKey: true, deltaY: 100 });
    expect(terminal.options.fontSize).toBe(12);
    expect(setState.mock.calls[0]?.[0].fontSizeDelta).toBe(-1);
  });

  it('OWNER-2b at font size 32 Ctrl+wheel up leaves the size and does not call setState', async () => {
    const { terminal, screen, setState } = await openPanel(32, 0);
    wheel(screen, { ctrlKey: true, deltaY: -100 });
    expect(terminal.options.fontSize).toBe(32);
    expect(setState).not.toHaveBeenCalled();
  });

  it('OWNER-2b at font size 8 Ctrl+wheel down leaves the size and does not call setState', async () => {
    const { terminal, screen, setState } = await openPanel(8, 0);
    wheel(screen, { ctrlKey: true, deltaY: 100 });
    expect(terminal.options.fontSize).toBe(8);
    expect(setState).not.toHaveBeenCalled();
  });

  it('OWNER-2c a wheel event without Ctrl leaves the size and the default alone, for normal scrollback', async () => {
    const { terminal, screen, setState } = await openPanel(13, 0);
    const event = wheel(screen, { ctrlKey: false, deltaY: -100 });
    expect(terminal.options.fontSize).toBe(13);
    expect(setState).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('OWNER-2d saved fontSizeDelta 3 with font size 13 opens xterm at 16', async () => {
    const { terminal } = await openPanel(13, 3);
    expect(terminal.options.fontSize).toBe(16);
  });

  it('OWNER-2d a saved delta that would pass the maximum is held at 32', async () => {
    const { terminal } = await openPanel(30, 9);
    expect(terminal.options.fontSize).toBe(32);
  });
});
