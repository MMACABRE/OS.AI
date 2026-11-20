import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sessionsChannels } from '@hsos/contracts/channels/sessions';
import type { SessionListItem } from '@hsos/contracts/channels/sessions';
import { shellChannels } from '@hsos/contracts/channels/shell';
import { terminalChannels } from '@hsos/contracts/channels/terminal';
import { workspaceChannels } from '@hsos/contracts/channels/workspace';
import { err, ok } from '@hsos/contracts/result';
import { ToastProvider } from '@hsos/ui-kit';
import { SessionPicker } from '../../src/modules/sessions/panel/SessionPicker';
import { PROJECT } from '../fakes/fixtures';
import { listItem } from '../fakes/review-fixtures';
import { NEW_TERMINAL, sessionsBus } from '../fakes/sessions-fixtures';
import { never } from '../fakes/stub-bus';
import type { StubBus } from '../fakes/stub-bus';

afterEach(cleanup);

function setup(items: readonly SessionListItem[], bus: StubBus = sessionsBus(() => items)) {
  const openTranscript = vi.fn();
  const openTerminal = vi.fn();
  const onClose = vi.fn();
  render(
    <ToastProvider>
      <SessionPicker
        bus={bus}
        onClose={onClose}
        openTranscript={openTranscript}
        openTerminal={openTerminal}
      />
    </ToastProvider>,
  );
  return { bus, openTranscript, openTerminal, onClose };
}

const options = () => screen.getAllByRole('option');
const titles = () => options().map((row) => row.getAttribute('aria-label'));
const search = () => screen.getByRole('textbox', { name: 'Search sessions' });

describe('session picker (card 032)', () => {
  const two = () => [listItem('s1', { title: 'fix login flow' }), listItem('s2', { title: 'write tests' })];

  it('SESS-31 a search of "flow fix" keeps only "fix login flow"', async () => {
    setup(two());
    await screen.findByRole('option', { name: 'fix login flow' });
    await userEvent.type(search(), 'flow fix');
    expect(titles()).toEqual(['fix login flow']);
  });

  it('SESS-31 the search ignores case', async () => {
    setup(two());
    await screen.findByRole('option', { name: 'fix login flow' });
    await userEvent.type(search(), 'FLOW');
    expect(titles()).toEqual(['fix login flow']);
  });

  it('SESS-31 a row with an empty title reads "Untitled session"', async () => {
    setup([listItem('s3', { title: '' })]);
    expect(await screen.findByRole('option', { name: 'Untitled session' })).toBeTruthy();
  });

  it('SESS-31 a backup-only row has the "Backup only" badge and its state word', async () => {
    setup([listItem('s4', { hasOriginal: false, hasBackup: true, state: 'interrupted' })]);
    const row = await screen.findByRole('option');
    expect(within(row).getByText('Backup only')).toBeTruthy();
    expect(within(row).getByText('Interrupted')).toBeTruthy();
  });

  it('SESS-31 a row reads "5 min ago · 12 messages"', async () => {
    setup([listItem('s5', { messages: 12, lastActiveAt: Date.now() - 5 * 60_000 })]);
    const row = await screen.findByRole('option');
    expect(within(row).getByText('5 min ago · 12 messages')).toBeTruthy();
  });

  it('SESS-31 ArrowDown moves the selection from the first row to the second', async () => {
    setup(two());
    await screen.findByRole('option', { name: 'fix login flow' });
    expect(options()[0]?.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(screen.getByRole('listbox', { name: 'Claude sessions' }), { key: 'ArrowDown' });
    expect(options()[1]?.getAttribute('aria-selected')).toBe('true');
    expect(options()[0]?.getAttribute('aria-selected')).toBe('false');
  });

  it('SESS-31 Enter on a row without a live terminal starts the resume with terminal.create first', async () => {
    const { bus } = setup(two());
    await screen.findByRole('option', { name: 'fix login flow' });
    fireEvent.keyDown(screen.getByRole('listbox', { name: 'Claude sessions' }), { key: 'Enter' });
    await waitFor(() => expect(bus.payloadsOf(terminalChannels.create)).toHaveLength(1));
    expect(bus.payloadsOf(sessionsChannels.restoreTranscript)).toHaveLength(0);
  });

  it('SESS-32 a running row offers a disabled "Go to terminal" and "Open transcript", no resume', async () => {
    setup([listItem('s6', { liveTerminalId: 'terminal-lv1', state: 'running' })]);
    await screen.findByRole('option');
    expect((screen.getByRole('button', { name: 'Go to terminal' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Open transcript' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Resume in new terminal' })).toBeNull();
  });

  it('SESS-32 a row without a live terminal offers "Resume in new terminal" and "Copy resume command", never "Resume here"', async () => {
    setup([listItem('s7')]);
    await screen.findByRole('option');
    expect(screen.getByRole('button', { name: 'Resume in new terminal' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy resume command' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Resume here/ })).toBeNull();
  });

  it('SESS-32 "Resume in new terminal" creates, binds, then types the resume command as the owner', async () => {
    const { bus, openTerminal } = setup([listItem('s8', { cwd: 'C:\\code\\hsos\\sub' })]);
    await screen.findByRole('option');
    await userEvent.click(screen.getByRole('button', { name: 'Resume in new terminal' }));
    await waitFor(() => expect(bus.payloadsOf(terminalChannels.write)).toHaveLength(1));
    const order = bus.calls
      .map((call) => call.channel)
      .filter((name) => ['terminal.create', 'sessions.bind', 'terminal.write'].includes(name));
    expect(order).toEqual(['terminal.create', 'sessions.bind', 'terminal.write']);
    expect(bus.payloadsOf(terminalChannels.create)[0]).toMatchObject({
      cwd: 'C:\\code\\hsos\\sub',
      launch: null,
    });
    expect(bus.payloadsOf(sessionsChannels.bind)).toEqual([{ sessionId: 's8', terminalId: NEW_TERMINAL }]);
    expect(bus.payloadsOf(terminalChannels.write)).toEqual([
      { id: NEW_TERMINAL, data: 'claude --resume s8\r', source: 'owner' },
    ]);
    expect(openTerminal).toHaveBeenCalledTimes(1);
  });

  it('SESS-32 a backup-only session restores its transcript before the terminal is created', async () => {
    const { bus } = setup([listItem('s9', { hasOriginal: false, hasBackup: true })]);
    await screen.findByRole('option');
    await userEvent.click(screen.getByRole('button', { name: 'Resume in new terminal' }));
    await waitFor(() => expect(bus.payloadsOf(terminalChannels.write)).toHaveLength(1));
    const order = bus.calls
      .map((call) => call.channel)
      .filter((name) => ['sessions.restoreTranscript', 'terminal.create'].includes(name));
    expect(order).toEqual(['sessions.restoreTranscript', 'terminal.create']);
  });

  it('SESS-32 "Copy resume command" copies the folder change and the resume command', async () => {
    const { bus } = setup([listItem('s10', { cwd: 'C:\\code\\hsos' })]);
    bus.answer(shellChannels.writeClipboard, () => ok({}));
    await screen.findByRole('option');
    await userEvent.click(screen.getByRole('button', { name: 'Copy resume command' }));
    await waitFor(() => expect(bus.payloadsOf(shellChannels.writeClipboard)).toHaveLength(1));
    expect(bus.payloadsOf(shellChannels.writeClipboard)[0]).toEqual({
      text: 'cd "C:\\code\\hsos"; claude --resume s10',
    });
  });

  it('state shows the skeleton "Loading sessions" while the list is slow', async () => {
    const bus = sessionsBus(() => []);
    bus.answer(sessionsChannels.list, () => never());
    setup([], bus);
    expect(await screen.findByRole('status', { name: 'Loading sessions' }, { timeout: 2000 })).toBeTruthy();
  });

  it('state shows "No Claude sessions in this project yet." for an empty list', async () => {
    setup([]);
    expect(await screen.findByText('No Claude sessions in this project yet.')).toBeTruthy();
  });

  it('state shows "No session matches." when the search matches nothing', async () => {
    setup(two());
    await screen.findByRole('option', { name: 'fix login flow' });
    await userEvent.type(search(), 'zzzz');
    expect(screen.getByText('No session matches.')).toBeTruthy();
  });

  it('state shows the failure with Retry, and Retry asks again', async () => {
    const bus = sessionsBus(() => []);
    bus.answer(sessionsChannels.list, () => err('INTERNAL', 'The index is locked'));
    setup([], bus);
    expect(await screen.findByText('Sessions could not be read. The index is locked')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(bus.payloadsOf(sessionsChannels.list)).toHaveLength(2));
  });

  it('state shows "Open a project to find its sessions." with no project', async () => {
    const bus = sessionsBus(() => []);
    bus.answer(workspaceChannels.getCurrentProject, () => ok(null));
    setup([], bus);
    expect(await screen.findByText('Open a project to find its sessions.')).toBeTruthy();
    expect(PROJECT).toBeDefined();
  });
});
