import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { reviewChannels } from '@hsos/contracts/channels/review';
import { terminalChannels, TerminalSettings } from '@hsos/contracts/channels/terminal';
import { workspaceChannels } from '@hsos/contracts/channels/workspace';
import { ok } from '@hsos/contracts/result';
import { ToastProvider } from '@hsos/ui-kit';
import { sanitizePaste } from '@hsos/ui-kit';
import { createTerminalPanel } from '../../src/modules/terminal/panel/TerminalPanel';
import { FeedbackTray } from '../../src/modules/review/panel/FeedbackTray';
import { abs, PROJECT } from '../fakes/fixtures';
import { T1 } from '../fakes/hud-fixtures';
import { listItem, pinned } from '../fakes/review-fixtures';
import { createStubBus } from '../fakes/stub-bus';

/** A stand-in for xterm: jsdom cannot run the real one, and the tests need its paste, size and modes. */
const fake = vi.hoisted(() => ({
  bracketed: { on: true },
  paste: vi.fn<(text: string) => void>(),
  last: null as null | { options: { fontSize: number } },
}));

vi.mock('../../src/modules/terminal/panel/create-xterm', () => ({
  createXterm: (_element: HTMLElement, settings: { fontSize: number }) => {
    const terminal = {
      options: { fontSize: settings.fontSize },
      cols: 80,
      rows: 24,
      get modes() {
        return { bracketedPasteMode: fake.bracketed.on };
      },
      paste: (text: string) => fake.paste(text),
      write: () => undefined,
      onData: () => ({ dispose: () => undefined }),
      focus: () => undefined,
    };
    fake.last = terminal;
    return { terminal, fit: { fit: () => undefined }, applyTheme: () => undefined, dispose: () => undefined };
  },
}));

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
  // The panel only fits a screen that has a width; jsdom has no layout.
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 800 });
});

beforeEach(() => {
  fake.paste.mockReset();
  fake.bracketed.on = true;
  fake.last = null;
});

afterEach(cleanup);

function mountPanel(options: { readonly fontSize?: number; readonly delta?: number } = {}) {
  const bus = createStubBus();
  bus.answer(terminalChannels.attach, () =>
    ok({ lastSeq: 0, replay: new Uint8Array(0), info: { state: 'running', exitCode: null } } as never),
  );
  bus.answer(terminalChannels.resize, () => ok({}));
  bus.answer(terminalChannels.write, () => ok({}));
  bus.answer(workspaceChannels.getCurrentProject, () => ok(PROJECT));
  const Panel = createTerminalPanel({
    bus,
    log: { log: () => undefined },
    settings: () => TerminalSettings.parse({ fontSize: options.fontSize ?? 13 }),
    openSettings: () => undefined,
  });
  const setState = vi.fn();
  const view = render(
    <Panel
      panelId={'p'.repeat(12) as never}
      state={{
        terminalId: T1,
        cwd: abs('.'),
        worktree: null,
        launch: null,
        fontSizeDelta: options.delta ?? 0,
      }}
      setState={setState}
      isFocused={false}
    />,
  );
  const screenElement = view.container.querySelector('[data-hsos-terminal]') as HTMLElement;
  return { bus, setState, screenElement, view };
}

const wheel = (element: HTMLElement, init: WheelEventInit) => {
  const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, ...init });
  act(() => {
    element.dispatchEvent(event);
  });
  return event;
};

describe('terminal panel font size (owner amendment 2026-11-19)', () => {
  it('OWNER-2a Ctrl+wheel up makes the font one larger, saves the delta, resizes and prevents the default', async () => {
    const { bus, setState, screenElement } = mountPanel();
    await waitFor(() => expect(bus.payloadsOf(terminalChannels.attach)).toHaveLength(1));
    const before = bus.payloadsOf(terminalChannels.resize).length;
    const event = wheel(screenElement, { ctrlKey: true, deltaY: -100 });
    expect(fake.last?.options.fontSize).toBe(14);
    expect(setState).toHaveBeenCalledWith(expect.objectContaining({ fontSizeDelta: 1 }));
    expect(bus.payloadsOf(terminalChannels.resize).length).toBeGreaterThan(before);
    expect(event.defaultPrevented).toBe(true);
  });

  it('OWNER-2b at the largest size Ctrl+wheel up changes nothing, and likewise at the smallest going down', async () => {
    const largest = mountPanel({ fontSize: 32 });
    await waitFor(() => expect(largest.bus.payloadsOf(terminalChannels.attach)).toHaveLength(1));
    wheel(largest.screenElement, { ctrlKey: true, deltaY: -100 });
    expect(fake.last?.options.fontSize).toBe(32);
    expect(largest.setState).not.toHaveBeenCalled();
    cleanup();
    const smallest = mountPanel({ fontSize: 8 });
    await waitFor(() => expect(smallest.bus.payloadsOf(terminalChannels.attach)).toHaveLength(1));
    wheel(smallest.screenElement, { ctrlKey: true, deltaY: 100 });
    expect(fake.last?.options.fontSize).toBe(8);
    expect(smallest.setState).not.toHaveBeenCalled();
  });

  it('OWNER-2c a wheel without Ctrl leaves the size alone and does not prevent the default', async () => {
    const { bus, setState, screenElement } = mountPanel();
    await waitFor(() => expect(bus.payloadsOf(terminalChannels.attach)).toHaveLength(1));
    const event = wheel(screenElement, { deltaY: -100 });
    expect(fake.last?.options.fontSize).toBe(13);
    expect(setState).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('OWNER-2d a saved delta of 3 on font size 13 opens xterm at 16', async () => {
    const { bus } = mountPanel({ delta: 3 });
    await waitFor(() => expect(bus.payloadsOf(terminalChannels.attach)).toHaveLength(1));
    expect(fake.last?.options.fontSize).toBe(16);
  });
});

describe('feedback paste (lead fixes after the lane B merge)', () => {
  it('P-6 sanitizePaste removes the escape but keeps carriage return, tab and line feed', () => {
    expect(sanitizePaste('a\x1b[201~\rb\tc\n')).toBe('a[201~\rb\tc\n');
  });

  const sendFromTray = async (composed: string, options: { readonly panel: boolean }) => {
    const bus = createStubBus();
    bus.answer(reviewChannels.composePrompt, () => ok(composed));
    bus.answer(terminalChannels.write, () => ok({}));
    const panel = options.panel ? mountPanel() : null;
    if (panel !== null)
      await waitFor(() => expect(panel.bus.payloadsOf(terminalChannels.attach)).toHaveLength(1));
    render(
      <ToastProvider>
        <FeedbackTray
          bus={bus}
          projectId={PROJECT.id}
          root={PROJECT.path}
          comments={[pinned('c1', { kind: 'artifact', path: abs('a.html') }, 'text')]}
          sessions={[listItem('s1', { liveTerminalId: T1, state: 'running' })]}
        />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Send to Claude' }));
    return bus;
  };

  it('REV-33 with bracketed paste on, the text reaches xterm paste without an escape and the tray writes nothing itself', async () => {
    const bus = await sendFromTray('\x1b[201~rm -rf x\r', { panel: true });
    await waitFor(() => expect(fake.paste).toHaveBeenCalledTimes(1));
    const pasted = String(fake.paste.mock.calls[0]?.[0]);
    expect(pasted).not.toContain('\x1b');
    expect(bus.payloadsOf(terminalChannels.write)).toHaveLength(0);
  });

  it('REV-33b with bracketed paste off, a two-line prompt is not pasted and an error toast suggests Copy', async () => {
    fake.bracketed.on = false;
    await sendFromTray('line one\nline two', { panel: true });
    expect(fake.paste).not.toHaveBeenCalled();
    expect((await screen.findByRole('alert')).textContent).toMatch(/Copy/);
  });

  it('REV-33c with no panel for the terminal, a toast says to open the terminal and nothing is written', async () => {
    const bus = await sendFromTray('some prompt', { panel: false });
    expect((await screen.findByRole('alert')).textContent).toMatch(/Open that session's terminal/);
    expect(bus.payloadsOf(terminalChannels.write)).toHaveLength(0);
    expect(fake.paste).not.toHaveBeenCalled();
  });

  it('REV-34 after a successful send the tray shows "Sent. Clear comments?" with Clear and Keep and still lists the comments', async () => {
    await sendFromTray('hello', { panel: true });
    expect(await screen.findByText('Sent. Clear comments?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Keep' })).toBeTruthy();
    expect(screen.getByText(/a\.html \(artifact\)/)).toBeTruthy();
  });
});
