import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { claudeLinkChannels } from '@hsos/contracts/channels/claude-link';
import { HudSettings } from '@hsos/contracts/channels/hud';
import { settingsChannels } from '@hsos/contracts/channels/settings';
import { shellChannels } from '@hsos/contracts/channels/shell';
import { skillsChannels } from '@hsos/contracts/channels/skills';
import { terminalChannels } from '@hsos/contracts/channels/terminal';
import { ok } from '@hsos/contracts/result';
import { err } from '@hsos/contracts/result';
import { ToastProvider } from '@hsos/ui-kit';
import { startHudAlerts, firstSentence, spokenText } from '../../src/modules/hud/panel/hud-alerts';
import { HudDepsContext } from '../../src/modules/hud/panel/hud-context';
import { startHudData, targetSession, useHudData } from '../../src/modules/hud/panel/hud-data';
import { QuickBar, tokensText } from '../../src/modules/hud/panel/QuickBar';
import { Section } from '../../src/modules/hud/panel/Section';
import { boardOrder, cacheState, SessionsBoard } from '../../src/modules/hud/panel/SessionsSection';
import { SessionsMenu } from '../../src/modules/hud/panel/SessionsSection';
import { cleanFreeText, sendToSession } from '../../src/modules/hud/panel/send-command';
import { SkillsDeck, SkillsRepoRow } from '../../src/modules/hud/panel/SkillsSection';
import { UsageBars } from '../../src/modules/hud/panel/UsageSection';
import { register } from '../../src/modules/hud/register.ui';
import { createFakeUiContext } from '../fakes/fake-ui-context';
import { PROJECT } from '../fakes/fixtures';
import { makeDeps, ms, repoSync, seedHud, session, skill, T1, T2 } from '../fakes/hud-fixtures';
import { createStubBus } from '../fakes/stub-bus';
import type { StubBus } from '../fakes/stub-bus';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const MIN = 60_000;

/** Renders `ui` with the HUD's dependencies and a toast host. */
function renderHud(ui: ReactElement, bus: StubBus = createStubBus()) {
  const deps = makeDeps(bus);
  bus.answer(terminalChannels.write, () => ok({}));
  bus.answer(terminalChannels.getLastOwnerInput, () => ok({ at: null }));
  bus.answer(claudeLinkChannels.markSeen, () => ok({}));
  const view = render(
    <ToastProvider>
      <HudDepsContext.Provider value={deps}>{ui}</HudDepsContext.Provider>
    </ToastProvider>,
  );
  return { bus, deps, ...view };
}

const writes = (bus: StubBus) => bus.payloadsOf(terminalChannels.write);
const rowButton = (title: string) => screen.getByText(title).closest('button');

describe('sessions board (card 031)', () => {
  beforeEach(() => {
    seedHud({
      sessions: [
        session('inproj', { title: 'in project' }),
        session('inwt', { title: 'in worktree', cwd: `${PROJECT.path}\\.claude\\worktrees\\x` }),
        session('elsewhere', { title: 'elsewhere', cwd: 'C:\\code\\other' }),
      ],
    });
  });

  it('HUD-1 lists the project folder and its worktrees, and all three once all projects are shown', () => {
    renderHud(<SessionsBoard />);
    expect(screen.getByText('in project')).toBeTruthy();
    expect(screen.getByText('in worktree')).toBeTruthy();
    expect(screen.queryByText('elsewhere')).toBeNull();
    act(() => useHudData.setState({ showAllProjects: true }));
    expect(screen.getByText('elsewhere')).toBeTruthy();
    expect(screen.getByText('in project')).toBeTruthy();
    expect(screen.getByText('in worktree')).toBeTruthy();
  });

  it('HUD-1 the section menu item "Show all projects" lists every session', async () => {
    renderHud(
      <>
        <SessionsMenu />
        <SessionsBoard />
      </>,
    );
    expect(screen.getByText('in project')).toBeTruthy();
    expect(screen.getByText('in worktree')).toBeTruthy();
    expect(screen.queryByText('elsewhere')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Sessions menu' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Show all projects' }));
    expect(screen.getByText('elsewhere')).toBeTruthy();
    expect(screen.getByText('in project')).toBeTruthy();
    expect(screen.getByText('in worktree')).toBeTruthy();
  });

  it('HUD-2 orders needs-you, working, background, done, idle, ended and newest first in a group', () => {
    const list = [
      session('ended', { activity: 'ended' }),
      session('idle', { activity: 'idle' }),
      session('done', { activity: 'done' }),
      session('background', { activity: 'background' }),
      session('working-old', { activity: 'working', startedAt: 1_000 }),
      session('working-new', { activity: 'working', startedAt: 5_000 }),
      session('needs', { activity: 'needs-you' }),
    ];
    expect(boardOrder(list).map((entry) => entry.sessionId)).toEqual([
      'needs',
      'working-new',
      'working-old',
      'background',
      'done',
      'idle',
      'ended',
    ]);
  });

  it('HUD-3 and HUD-9 show the tool and agent count, with the context in the warn then danger tone', () => {
    const agents = [{}, {}];
    seedHud({
      sessions: [
        session('w', {
          title: 'busy',
          activity: 'working',
          currentTool: 'Edit',
          contextUsedPercentage: 72,
          subagents: agents,
        }),
      ],
    });
    const first = renderHud(<SessionsBoard />);
    expect(screen.getByText('Edit · 2 agents')).toBeTruthy();
    expect(screen.getByText('72%').className).toMatch(/warn/);
    first.unmount();
    seedHud({
      sessions: [
        session('w', {
          title: 'busy',
          activity: 'working',
          currentTool: 'Edit',
          contextUsedPercentage: 91,
          subagents: agents,
        }),
      ],
    });
    renderHud(<SessionsBoard />);
    expect(screen.getByText('91%').className).toMatch(/danger/);
  });

  it('HUD-4 lists an agent that ended 30 s ago as done and drops one that ended 90 s ago', () => {
    const now = Date.now();
    seedHud({
      sessions: [
        session('w', {
          activity: 'working',
          subagents: [
            { agentType: 'RecentAgent', endedAt: now - 30_000 },
            { agentType: 'OldAgent', endedAt: now - 90_000 },
          ],
        }),
      ],
    });
    renderHud(<SessionsBoard />);
    const list = screen.getByRole('list', { name: /Subagents of/ });
    expect(within(list).getByText('RecentAgent')).toBeTruthy();
    expect(within(list).getByText('done')).toBeTruthy();
    expect(screen.queryByText('OldAgent')).toBeNull();
  });

  it('HUD-5 activating a row with a terminal marks it seen and focuses its input; one outside HSOS does nothing', async () => {
    seedHud({
      sessions: [
        session('inside', { title: 'inside', terminalId: T1 }),
        session('outside', { title: 'outside', terminalId: null }),
      ],
    });
    const host = document.createElement('div');
    host.setAttribute('data-terminal-id', T1);
    const input = document.createElement('textarea');
    host.append(input);
    document.body.append(host);
    const { bus } = renderHud(<SessionsBoard />);
    expect(screen.getByText('outside HSOS')).toBeTruthy();
    await userEvent.click(rowButton('outside') as HTMLElement);
    expect(bus.payloadsOf(claudeLinkChannels.markSeen)).toHaveLength(0);
    await userEvent.click(rowButton('inside') as HTMLElement);
    expect(bus.payloadsOf(claudeLinkChannels.markSeen)).toEqual([{ sessionId: 'inside' }]);
    expect(document.activeElement).toBe(input);
    host.remove();
  });

  it('HUD-6 a needs-you session has a pulsing dot and a working one does not', () => {
    seedHud({
      sessions: [
        session('n', { title: 'needy', activity: 'needs-you' }),
        session('w', { title: 'busy', activity: 'working' }),
      ],
    });
    renderHud(<SessionsBoard />);
    const dot = (title: string) => rowButton(title)?.querySelector('[class*="dot"]');
    expect(dot('needy')?.className).toMatch(/pulse/);
    expect(dot('busy')?.className).not.toMatch(/pulse/);
  });

  it('HUD-8 shows warm minutes left from the last reply, and cold after an hour', () => {
    const now = 10_000_000;
    expect(cacheState(now - 8 * MIN, now)).toBe('warm 52m');
    expect(cacheState(now - 61 * MIN, now)).toBe('cold');
  });

  it('HUD-8 a done session row shows its cache state', () => {
    seedHud({
      sessions: [session('d', { title: 'finished', activity: 'done', lastResponseAt: Date.now() - 8 * MIN })],
    });
    renderHud(<SessionsBoard />);
    expect(screen.getByText(/^warm 5[12]m$/)).toBeTruthy();
  });
});

describe('focus and the target session (card 031)', () => {
  it('HUD-7 focus moving into a terminal marks its sessions seen and puts it first in the focus order', async () => {
    const bus = createStubBus();
    bus.answer(claudeLinkChannels.markSeen, () => ok({}));
    bus.answer(claudeLinkChannels.listSessions, () =>
      ok([
        session('a', { terminalId: T1 }),
        session('b', { terminalId: T1 }),
        session('c', { terminalId: T2 }),
      ]),
    );
    seedHud({});
    startHudData(bus);
    await waitFor(() => expect(useHudData.getState().sessions.size).toBe(3));
    const host = document.createElement('div');
    host.setAttribute('data-terminal-id', T1);
    const input = document.createElement('textarea');
    host.append(input);
    document.body.append(host);
    act(() => input.focus());
    await waitFor(() => expect(bus.payloadsOf(claudeLinkChannels.markSeen)).toHaveLength(2));
    expect(
      bus
        .payloadsOf(claudeLinkChannels.markSeen)
        .map((entry) => entry.sessionId)
        .sort(),
    ).toEqual(['a', 'b']);
    expect(useHudData.getState().focusOrder[0]).toBe(T1);
    host.remove();
  });

  it('HUD-31 the target is the most recently focused terminal with a live session', () => {
    const sessions = new Map([
      ['a', session('a', { terminalId: T1, startedAt: 9_000 })],
      ['b', session('b', { terminalId: T2, startedAt: 1_000 })],
    ]);
    expect(targetSession(sessions, [T2, T1])?.sessionId).toBe('b');
    expect(targetSession(sessions, [])?.sessionId).toBe('a');
  });
});

describe('spoken and shown alerts (card 031)', () => {
  const alertsFor = (bus: StubBus, clock: { now: number }) => {
    bus.answer(shellChannels.notify, () => ok({}));
    bus.answer(shellChannels.speak, () => ok({}));
    startHudAlerts(bus, () => clock.now);
  };

  it('HUD-10 and HUD-11 notify once for done after 40 s of work, and not again for needs-you 3 s later', () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    const bus = createStubBus();
    const clock = { now: 100_000 };
    alertsFor(bus, clock);
    seedHud({ sessions: [session('s1', { title: 'big job', activity: 'idle' })] });
    clock.now = 100_000;
    seedHud({ sessions: [session('s1', { title: 'big job', activity: 'working' })] });
    clock.now = 140_000;
    seedHud({ sessions: [session('s1', { title: 'big job', activity: 'done' })] });
    expect(bus.payloadsOf(shellChannels.notify)).toEqual([
      { title: 'big job', body: 'Finished', focusPanel: null },
    ]);
    clock.now = 143_000;
    seedHud({
      sessions: [
        session('s1', { title: 'big job', activity: 'needs-you', attentionReason: 'Permission: Bash' }),
      ],
    });
    expect(bus.payloadsOf(shellChannels.notify)).toHaveLength(1);
  });

  it('HUD-10 a done after less than 30 s of work sends nothing', () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    const bus = createStubBus();
    const clock = { now: 500_000 };
    alertsFor(bus, clock);
    seedHud({ sessions: [session('s2', { activity: 'idle' })] });
    seedHud({ sessions: [session('s2', { activity: 'working' })] });
    clock.now = 510_000;
    seedHud({ sessions: [session('s2', { activity: 'done' })] });
    expect(bus.payloadsOf(shellChannels.notify)).toHaveLength(0);
  });

  it('HUD-13 a focused window with the session terminal focused does not speak; another terminal focused speaks once', () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    const bus = createStubBus();
    const clock = { now: 900_000 };
    alertsFor(bus, clock);
    const hostOf = (id: string) => {
      const host = document.createElement('div');
      host.setAttribute('data-terminal-id', id);
      const input = document.createElement('textarea');
      host.append(input);
      document.body.append(host);
      return { host, input };
    };
    const mine = hostOf(T1);
    const other = hostOf(T2);
    seedHud({ sessions: [session('s3', { terminalId: T1, activity: 'working' })] });
    mine.input.focus();
    seedHud({
      sessions: [
        session('s3', { terminalId: T1, activity: 'needs-you', attentionReason: 'Permission: Bash' }),
      ],
    });
    expect(bus.payloadsOf(shellChannels.speak)).toHaveLength(0);
    clock.now = 920_000;
    seedHud({ sessions: [session('s3', { terminalId: T1, activity: 'working' })] });
    other.input.focus();
    clock.now = 940_000;
    seedHud({
      sessions: [
        session('s3', { terminalId: T1, activity: 'needs-you', attentionReason: 'Permission: Bash' }),
      ],
    });
    expect(bus.payloadsOf(shellChannels.speak)).toHaveLength(1);
    mine.host.remove();
    other.host.remove();
  });

  it('HUD-14 speaks the title, "Finished" and the first plain sentence; needs-you says why', () => {
    const done = session('s4', {
      title: 'Parser',
      lastMessage: 'Done. See ```x``` [docs](http://a) now.',
      attentionReason: 'Permission: Bash',
    });
    expect(spokenText(done, 'done', true)).toBe('Parser. Finished. Done.');
    expect(spokenText(done, 'needs-you', true)).toBe('Parser. Needs you. Permission: Bash.');
  });

  it('HUD-16 choosing a voice saves speakVoice and speaks the test line with it', async () => {
    const bus = createStubBus();
    bus.answer(shellChannels.listVoices, () => ok(['Voice A', 'Voice B']));
    bus.answer(settingsChannels.setValue, () => ok({}));
    bus.answer(shellChannels.speak, () => ok({}));
    const ctx = createFakeUiContext('hud', bus);
    register(ctx);
    seedHud({});
    const Panel = ctx.panel('hud.panel').component;
    render(
      <ToastProvider>
        <Panel
          panelId={'p'.repeat(12) as never}
          state={{ collapsed: [] } as never}
          setState={() => undefined}
          isFocused
        />
      </ToastProvider>,
    );
    act(() => ctx.command('hud.chooseVoice').run() as undefined);
    const dialog = await screen.findByRole('dialog', { name: 'Alert voice' });
    await userEvent.click(await within(dialog).findByRole('option', { name: 'Voice B' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Use this voice' }));
    await waitFor(() => expect(bus.payloadsOf(settingsChannels.setValue)).toHaveLength(1));
    expect(bus.payloadsOf(settingsChannels.setValue)[0]).toEqual({
      moduleId: 'hud',
      key: 'speakVoice',
      value: 'Voice B',
    });
    expect(bus.payloadsOf(shellChannels.speak)).toEqual([
      { text: 'This is how HSOS alerts sound.', voice: 'Voice B', rate: HudSettings.parse({}).speakRate },
    ]);
  });
});

describe('usage section and status items (card 031)', () => {
  const usage = () => ({
    kind: 'ready' as const,
    value: {
      fiveHour: { usedPercentage: 58, resetsAt: Date.now() + (2 * 60 + 10) * MIN + 20_000 },
      sevenDay: null,
      updatedAt: Date.now() - 14 * MIN,
    },
  });

  it('HUD-25 and HUD-26 shows the five-hour bar with its reset, "No data yet" for seven days, and the stale note', () => {
    const bus = createStubBus();
    const ctx = createFakeUiContext('hud', bus);
    register(ctx);
    seedHud({ usage: usage() });
    const Panel = ctx.panel('hud.panel').component;
    render(
      <ToastProvider>
        <Panel
          panelId={'p'.repeat(12) as never}
          state={{ collapsed: [] } as never}
          setState={() => undefined}
          isFocused
        />
      </ToastProvider>,
    );
    const section = screen.getByRole('region', { name: 'Usage' });
    expect(section.textContent).toContain('58%');
    expect(section.textContent).toContain('resets 2h 10m');
    expect(section.textContent).toContain('No data yet');
    expect(section.textContent).toContain('updated 14m ago');
  });

  it('HUD-27 the five-hour status item shows "5h 58%" and the seven-day one shows nothing', () => {
    const bus = createStubBus();
    const ctx = createFakeUiContext('hud', bus);
    register(ctx);
    seedHud({ usage: usage() });
    const item = (id: string) => ctx.statusItems.find((entry) => entry.id === id)?.component;
    const FiveHour = item('hud.usage5h');
    const SevenDay = item('hud.usage7d');
    expect(FiveHour).toBeDefined();
    expect(SevenDay).toBeDefined();
    if (FiveHour === undefined || SevenDay === undefined) return;
    const view = render(<FiveHour />);
    expect(view.container.textContent).toBe('5h 58%');
    view.unmount();
    const empty = render(<SevenDay />);
    expect(empty.container.textContent).toBe('');
    expect(UsageBars).toBeDefined();
  });
});

describe('quick bar (card 031)', () => {
  const target = (input: Parameters<typeof session>[1] = {}) =>
    session('t', {
      title: 'My chat',
      terminalId: T1,
      activity: 'idle',
      lastResponseAt: Date.now() - 5 * MIN,
      ...input,
    });
  const withTarget = (input: Parameters<typeof session>[1] = {}) =>
    seedHud({ sessions: [target(input)], focusOrder: [T1] });

  it('HUD-60 with no target session only Usage, Context and Skills are enabled', () => {
    seedHud({});
    renderHud(<QuickBar onSearchSkills={vi.fn()} />);
    expect(screen.getByText('Start a Claude session first')).toBeTruthy();
    const button = (name: RegExp) => screen.getByRole('button', { name }) as HTMLButtonElement;
    expect(button(/^Compact$/).disabled).toBe(true);
    expect(button(/^Clear$/).disabled).toBe(true);
    expect(button(/^Model/).disabled).toBe(true);
    expect(button(/^Usage/).disabled).toBe(false);
    expect(button(/^Context/).disabled).toBe(false);
    expect(button(/^Skills$/).disabled).toBe(false);
  });

  it('HUD-61 the Context popover reads "41k of 200k tokens"', async () => {
    withTarget({ contextUsedPercentage: 21, contextTokens: 41_000, contextWindowSize: 200_000 });
    renderHud(<QuickBar onSearchSkills={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /^Context/ }));
    expect(await screen.findByText('41k of 200k tokens')).toBeTruthy();
  });

  it('HUD-62 the model menu checks the current model and effort, and choosing sonnet sends /model sonnet', async () => {
    withTarget({ modelId: 'claude-opus-5-5', model: 'Opus 5.5', effort: 'high' });
    const { bus } = renderHud(<QuickBar onSearchSkills={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /Opus 5\.5 · high/ }));
    expect(await screen.findByRole('menuitem', { name: /✓\s*opus/ })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /✓\s*high/ })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: /✓\s*sonnet/ })).toBeNull();
    await userEvent.click(screen.getByRole('menuitem', { name: /sonnet/ }));
    await waitFor(() => expect(writes(bus)).toHaveLength(1));
    expect(writes(bus)[0]).toMatchObject({ id: T1, data: '/model sonnet\r', source: 'quick-command' });
  });

  it('HUD-63 an idle session whose owner typed before the last reply gets the command and Enter', async () => {
    const bus = createStubBus();
    const lastReply = 1_000_000;
    bus.answer(terminalChannels.getLastOwnerInput, () => ok({ at: ms(lastReply - 3 * MIN) }));
    bus.answer(terminalChannels.write, () => ok({}));
    const toast = { show: vi.fn() };
    const result = await sendToSession(bus, target({ lastResponseAt: lastReply }), '/model sonnet', toast);
    expect(result).toBe('ran');
    expect(writes(bus)).toEqual([{ id: T1, data: '/model sonnet\r', source: 'quick-command' }]);
  });

  it('HUD-63 owner input after the reply types the command without Enter, as owner, and toasts', async () => {
    const bus = createStubBus();
    const lastReply = 1_000_000;
    bus.answer(terminalChannels.getLastOwnerInput, () => ok({ at: ms(lastReply + MIN) }));
    bus.answer(terminalChannels.write, () => ok({}));
    const toast = { show: vi.fn() };
    const result = await sendToSession(bus, target({ lastResponseAt: lastReply }), '/model sonnet', toast);
    expect(result).toBe('typed');
    expect(writes(bus)).toEqual([{ id: T1, data: '/model sonnet', source: 'owner' }]);
    expect(toast.show).toHaveBeenCalledTimes(1);
  });

  it('HUD-63 a working session never gets Enter', async () => {
    const bus = createStubBus();
    bus.answer(terminalChannels.getLastOwnerInput, () => ok({ at: null }));
    bus.answer(terminalChannels.write, () => ok({}));
    await sendToSession(bus, target({ activity: 'working' }), '/compact', { show: vi.fn() });
    expect(writes(bus)).toHaveLength(1);
    expect(writes(bus)[0]?.data).toBe('/compact');
  });

  it('HUD-63 a needs-you session gets nothing and the "waiting for you" toast shows', async () => {
    const bus = createStubBus();
    bus.answer(terminalChannels.write, () => ok({}));
    const toast = { show: vi.fn() };
    const result = await sendToSession(bus, target({ activity: 'needs-you' }), '/status', toast);
    expect(result).toBe('blocked');
    expect(writes(bus)).toHaveLength(0);
    expect(toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('waiting for you') }),
    );
  });

  it('HUD-64 the mode button writes Shift+Tab as a quick command and does not take focus', async () => {
    withTarget({ activity: 'working', permissionMode: 'plan' });
    const { bus } = renderHud(
      <>
        <input aria-label="elsewhere" />
        <QuickBar onSearchSkills={vi.fn()} />
      </>,
    );
    const other = screen.getByLabelText('elsewhere');
    other.focus();
    const mode = screen.getByRole('button', { name: /^Plan/ });
    expect(mode.textContent).toContain('Plan');
    await userEvent.click(mode);
    await waitFor(() => expect(writes(bus)).toHaveLength(1));
    expect(writes(bus)[0]).toEqual({ id: T1, data: '\x1b[Z', source: 'quick-command' });
    expect(document.activeElement).toBe(other);
  });

  it('HUD-65 Compact sends /compact followed by the typed text', async () => {
    withTarget();
    const { bus } = renderHud(<QuickBar onSearchSkills={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /^Compact$/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Compact this conversation?' });
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: 'Keep in the summary' }),
      'keep the tests',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Compact' }));
    await waitFor(() => expect(writes(bus)).toHaveLength(1));
    expect(writes(bus)[0]?.data).toBe('/compact keep the tests\r');
  });

  it('HUD-66 the clear dialog has Cancel focused, so Enter at once sends nothing; Clear sends /clear', async () => {
    withTarget();
    const { bus } = renderHud(<QuickBar onSearchSkills={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /^Clear$/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Clear this conversation?' });
    await waitFor(() =>
      expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Cancel' })),
    );
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(writes(bus)).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: /^Clear$/ }));
    const again = await screen.findByRole('dialog', { name: 'Clear this conversation?' });
    await userEvent.click(within(again).getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(writes(bus)).toHaveLength(1));
    expect(writes(bus)[0]?.data).toBe('/clear\r');
  });

  it('HUD-67 More then a configured command sends it through the same path', async () => {
    withTarget();
    const { bus } = renderHud(<QuickBar onSearchSkills={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /^More/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: '/status' }));
    await waitFor(() => expect(writes(bus)).toHaveLength(1));
    expect(writes(bus)[0]).toEqual({ id: T1, data: '/status\r', source: 'quick-command' });
  });

  it('HUD-68 removes line breaks and control characters from free text', () => {
    expect(cleanFreeText('a\x07b\nc')).toBe('a b c');
  });

  it('HUD-68 the settings schema rejects a quick command with shell characters', () => {
    expect(HudSettings.safeParse({ quickCommands: ['/x; rm -rf ~'] }).success).toBe(false);
    expect(HudSettings.safeParse({ quickCommands: ['/status'] }).success).toBe(true);
  });

  it('tokensText writes 41000 of 200000 as "41k of 200k tokens"', () => {
    expect(tokensText(41_000, 200_000)).toBe('41k of 200k tokens');
  });
});

describe('skills deck (card 031)', () => {
  const skills = () => [
    skill('aardvark', { description: 'Something else entirely' }),
    skill('caveman', { isFavourite: true, description: 'Talk in short words' }),
    skill('graphify', { description: 'Turn any folder into a knowledge graph' }),
  ];
  const names = () =>
    within(screen.getByRole('list', { name: 'Skills' }))
      .getAllByRole('listitem')
      .map((row) => row.querySelector('[class*="skillName"]')?.textContent);

  it('HUD-30 a query of two words in any order keeps only the skill holding both, favourites come first', async () => {
    seedHud({ skills: { kind: 'ready', value: skills() } });
    renderHud(<SkillsDeck />);
    expect(names()).toEqual(['caveman', 'aardvark', 'graphify']);
    await userEvent.type(screen.getByRole('textbox', { name: 'Search skills' }), 'turn folder');
    expect(names()).toEqual(['graphify']);
  });

  it('HUD-31 with no live session a toast says "Start a Claude session first"', async () => {
    seedHud({ skills: { kind: 'ready', value: skills() } });
    const { bus } = renderHud(<SkillsDeck />);
    await userEvent.click(screen.getByText('caveman'));
    expect(await screen.findByText('Start a Claude session first')).toBeTruthy();
    expect(writes(bus)).toHaveLength(0);
  });

  it('HUD-31 with a target session the skill is typed as "/name " without Enter', async () => {
    seedHud({
      skills: { kind: 'ready', value: skills() },
      sessions: [session('t', { terminalId: T1 })],
      focusOrder: [T1],
    });
    const { bus } = renderHud(<SkillsDeck />);
    await userEvent.click(screen.getByText('caveman'));
    await waitFor(() => expect(writes(bus)).toHaveLength(1));
    expect(writes(bus)[0]).toEqual({ id: T1, data: '/caveman ', source: 'owner' });
  });

  it('HUD-34 the row menu "Show in folder" reveals the skill file', async () => {
    seedHud({ skills: { kind: 'ready', value: [skill('a')] } });
    const { bus } = renderHud(<SkillsDeck />);
    bus.answer(shellChannels.revealInExplorer, () => ok({}));
    await userEvent.click(screen.getByRole('button', { name: 'More for a' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Show in folder' }));
    expect(bus.payloadsOf(shellChannels.revealInExplorer)).toEqual([{ path: skill('a').file }]);
  });

  it('HUD-37 a policy-locked skill disables its state choices and shows the reason', async () => {
    seedHud({ skills: { kind: 'ready', value: [skill('a', { state: 'off', stateLock: 'policy', stateSource: 'policy' })] } });
    renderHud(<SkillsDeck />);
    await userEvent.click(screen.getByRole('button', { name: 'More for a' }));
    const choice = await screen.findByRole('menuitem', { name: /You only/ });
    expect(choice.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText('Set by your organisation policy.')).toBeTruthy();
  });

  it('HUD-36 a skill that is off shows a muted "off" chip, and the state filter "Off" keeps only it', async () => {
    seedHud({
      skills: {
        kind: 'ready',
        value: [skill('a'), skill('b', { state: 'off' }), skill('c', { state: 'name-only' })],
      },
    });
    renderHud(<SkillsDeck />);
    await userEvent.click(screen.getByRole('button', { name: 'Off' }));
    expect(names()).toEqual(['b']);
    expect(screen.getByText('off').className).toMatch(/stateOff/);
  });
});

describe('skills repo row (card 031)', () => {
  it('HUD-40 and HUD-41 an out-of-sync repo shows its counts, Sync asks first listing the folders, then pushes', async () => {
    seedHud({
      repoSync: {
        kind: 'ready',
        value: repoSync({
          state: 'out-of-sync',
          changed: ['a', 'b', 'c'],
          added: ['d'],
          removed: ['e', 'f'],
          ahead: 1,
          behind: 0,
        }),
      },
    });
    const { bus } = renderHud(<SkillsRepoRow />);
    bus.answer(skillsChannels.pushToRepo, () => ok(repoSync({ state: 'in-sync' })));
    expect(screen.getByText('3 changed · 1 new · 2 only in repo · ↑1 ↓0')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Sync' }));
    const dialog = await screen.findByRole('dialog');
    for (const folder of ['a', 'b', 'c', 'd']) expect(dialog.textContent).toContain(folder);
    expect(bus.payloadsOf(skillsChannels.pushToRepo)).toHaveLength(0);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Sync' }));
    await waitFor(() => expect(bus.payloadsOf(skillsChannels.pushToRepo)).toHaveLength(1));
  });
});

describe('panel parts (card 031)', () => {
  /** Registers the module first (it resets the store), then seeds, then renders the HUD panel. */
  const panelOf = (bus: StubBus, seed: () => void) => {
    const ctx = createFakeUiContext('hud', bus);
    register(ctx);
    seed();
    const Panel = ctx.panel('hud.panel').component;
    render(
      <ToastProvider>
        <Panel
          panelId={'p'.repeat(12) as never}
          state={{ collapsed: [] } as never}
          setState={() => undefined}
          isFocused
        />
      </ToastProvider>,
    );
    return ctx;
  };

  it('Section a section that throws shows its error state while the others render', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const Broken = () => {
      throw new Error('boom');
    };
    renderHud(
      <>
        <Section title="Broken" collapsed={false} onToggle={vi.fn()} log={{ log: vi.fn() }}>
          <Broken />
        </Section>
        <Section title="Healthy" collapsed={false} onToggle={vi.fn()} log={{ log: vi.fn() }}>
          <p>all fine</p>
        </Section>
      </>,
    );
    expect(screen.getByText('Broken could not be shown: boom')).toBeTruthy();
    expect(screen.getByText('all fine')).toBeTruthy();
  });

  it('firstSentence cuts a long sentence at 160 characters on a word boundary', () => {
    const words = Array.from({ length: 60 }, (_, index) => `word${index}`).join(' ');
    const cut = firstSentence(words);
    expect(cut.length).toBeLessThanOrEqual(160);
    expect(words.startsWith(cut)).toBe(true);
    expect(words.charAt(cut.length)).toBe(' ');
  });

  it('HUD-35 a failed "Open skills folder" shows a toast with a Settings action', async () => {
    const bus = createStubBus();
    bus.answer(skillsChannels.openSkillsFolder, () => err('NOT_FOUND', 'The skills folder does not exist.'));
    const ctx = panelOf(bus, () =>
      seedHud({ skills: { kind: 'ready', value: [] }, repoSync: { kind: 'ready', value: repoSync() } }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Open skills folder' }));
    expect(await screen.findByText('The skills folder does not exist.')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(ctx.opened.at(-1)?.type).toBe('settings.screen');
  });

  it('OWNER-1 the Skills section holds the repo row before the search field and there is no "Skills repo" section', () => {
    panelOf(createStubBus(), () =>
      seedHud({
        skills: { kind: 'ready', value: [skill('a')] },
        repoSync: { kind: 'ready', value: repoSync() },
      }),
    );
    const skillsSection = screen.getByRole('region', { name: 'Skills' });
    const repoRow = within(skillsSection).getByText('In sync', { exact: false });
    const search = within(skillsSection).getByRole('textbox', { name: 'Search skills' });
    expect(repoRow.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Skills repo' })).toBeNull();
    expect(screen.queryByText('Skills repo')).toBeNull();
  });
});
