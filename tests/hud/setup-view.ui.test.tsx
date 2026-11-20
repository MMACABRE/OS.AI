import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { claudeLinkChannels } from '@hsos/contracts/channels/claude-link';
import type { ClaudeSetup } from '@hsos/contracts/channels/claude-link';
import { terminalChannels } from '@hsos/contracts/channels/terminal';
import { ok } from '@hsos/contracts/result';
import { ToastProvider } from '@hsos/ui-kit';
import { HudDepsContext } from '../../src/modules/hud/panel/hud-context';
import { SetupView } from '../../src/modules/hud/panel/SetupView';
import { makeDeps, seedHud, session, setupOf, T1 } from '../fakes/hud-fixtures';
import { createStubBus } from '../fakes/stub-bus';
import type { StubBus } from '../fakes/stub-bus';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const DAY = 86_400_000;
const FILE = 'C:\\Users\\h\\.claude.json';

const server = (name: string, lastUse: { at: number | null; source: 'claude' | 'hsos' } | null) => ({
  name,
  scope: 'user',
  transport: 'stdio',
  target: 'npx.cmd',
  enabled: null,
  file: FILE,
  lastUse: lastUse === null ? null : { count: null, ...lastUse },
});

type Options = { readonly setup?: ClaudeSetup; readonly hasCommand?: (id: string) => boolean };

function renderSetup(options: Options = {}) {
  const bus: StubBus = createStubBus();
  const setup = options.setup ?? setupOf();
  bus.answer(claudeLinkChannels.getSetup, () => ok(setup));
  bus.answer(terminalChannels.write, () => ok({}));
  const deps = makeDeps(bus, options.hasCommand === undefined ? {} : { hasCommand: options.hasCommand });
  const ui = (isFocused: boolean) => (
    <ToastProvider>
      <HudDepsContext.Provider value={deps}>
        <SetupView
          panelId={'p'.repeat(12) as never}
          state={{}}
          setState={() => undefined}
          isFocused={isFocused}
        />
      </HudDepsContext.Provider>
    </ToastProvider>
  );
  const view = render(ui(false));
  return { bus, deps, rerenderFocused: () => view.rerender(ui(true)) };
}

const rowOf = (name: string) => screen.getByText(name).closest('li') as HTMLElement;
const rowNames = () =>
  screen.getAllByRole('listitem').map((row) => row.querySelector('[class*="skillName"]')?.textContent ?? '');

describe('Claude setup view (card 031)', () => {
  const twoServersOnePlugin = () =>
    setupOf({
      mcpServers: [server('old-db', { at: Date.now() - 3 * DAY, source: 'claude' }), server('fresh', null)],
      plugins: [
        {
          id: 'p@m',
          version: '1.0.0',
          scope: 'user',
          enabled: true,
          installedAt: null,
          file: FILE,
          lastUse: null,
        },
      ],
    });

  it('HUD-50 the header counts each section, and "Show what loads at start" needs graph.agentView', async () => {
    seedHud({});
    renderSetup({ setup: twoServersOnePlugin() });
    expect(await screen.findByText(/2 mcp servers/)).toBeTruthy();
    expect(screen.getByText(/1 plugins/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show what loads at start' })).toBeNull();
    cleanup();
    seedHud({});
    renderSetup({ setup: twoServersOnePlugin(), hasCommand: (id) => id === 'graph.agentView' });
    expect(await screen.findByRole('button', { name: 'Show what loads at start' })).toBeTruthy();
  });

  it('HUD-51 shows "3 d ago" with the counter named in a tooltip, and "never seen" when unknown', async () => {
    seedHud({});
    renderSetup({ setup: twoServersOnePlugin() });
    await screen.findByText('old-db');
    const used = within(rowOf('old-db')).getByText('3 d ago');
    expect(within(rowOf('fresh')).getByText('never seen')).toBeTruthy();
    await userEvent.hover(used);
    expect(
      (await screen.findAllByText('Counted by Claude Code', {}, { timeout: 3000 })).length,
    ).toBeGreaterThan(0);
  });

  it('HUD-53 "Not used in 30 days" with least-recently-used sort keeps stale and unknown rows, unknown first', async () => {
    seedHud({});
    renderSetup({
      setup: setupOf({
        mcpServers: [
          server('stale', { at: Date.now() - 40 * DAY, source: 'claude' }),
          server('recent', { at: Date.now() - 1 * DAY, source: 'claude' }),
          server('unknown', null),
        ],
      }),
    });
    await screen.findByText('recent');
    await userEvent.click(screen.getByRole('switch', { name: 'Not used in 30 days' }));
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Sort' }),
      'Least recently used first',
    );
    expect(rowNames()).toEqual(['unknown', 'stale']);
  });

  it('HUD-54 "Ask Claude to remove" types the exact sentence into the target terminal without Enter', async () => {
    seedHud({ sessions: [session('t', { terminalId: T1 })], focusOrder: [T1] });
    const { bus } = renderSetup({ setup: setupOf({ mcpServers: [server('old-db', null)] }) });
    await screen.findByText('old-db');
    await userEvent.click(within(rowOf('old-db')).getByRole('button', { name: 'Ask Claude to remove' }));
    await waitFor(() => expect(bus.payloadsOf(terminalChannels.write)).toHaveLength(1));
    expect(bus.payloadsOf(terminalChannels.write)[0]).toEqual({
      id: T1,
      data: `Remove the MCP server "old-db" from my Claude Code setup in ${FILE}. Tell me what else depends on it first.`,
      source: 'owner',
    });
  });

  it('HUD-55 a file that could not be read shows as a warn line, and focus after 11 s reads the setup again', async () => {
    seedHud({});
    const { bus, rerenderFocused } = renderSetup({
      setup: setupOf({ errors: [{ file: 'C:\\p\\.mcp.json', message: 'Unexpected token' }] }),
    });
    const line = await screen.findByText(/Could not read/);
    expect(line.className).toMatch(/warn/);
    expect(line.textContent).toContain('Could not read C:\\p\\.mcp.json: Unexpected token');
    expect(bus.payloadsOf(claudeLinkChannels.getSetup)).toHaveLength(1);
    const real = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(real + 11_000);
    rerenderFocused();
    await waitFor(() => expect(bus.payloadsOf(claudeLinkChannels.getSetup)).toHaveLength(2));
  });
});
