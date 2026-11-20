import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sessionsChannels } from '@hsos/contracts/channels/sessions';
import type { SessionListItem } from '@hsos/contracts/channels/sessions';
import { err, ok } from '@hsos/contracts/result';
import { ToastProvider } from '@hsos/ui-kit';
import { SessionHistory } from '../../src/modules/sessions/panel/SessionHistory';
import { listItem } from '../fakes/review-fixtures';
import { record, sessionsBus } from '../fakes/sessions-fixtures';
import type { StubBus } from '../fakes/stub-bus';

afterEach(cleanup);

const HERE = 'C:\\code\\hsos';
const OTHER = 'C:\\code\\other';

function setup(items: readonly SessionListItem[], bus: StubBus = sessionsBus(() => items)) {
  const view = render(
    <ToastProvider>
      <SessionHistory bus={bus} openTranscript={vi.fn()} openTerminal={vi.fn()} />
    </ToastProvider>,
  );
  return { bus, view };
}

const options = () => screen.getAllByRole('option').filter((row) => row.tagName === 'LI');
const titleOf = (row: HTMLElement) => row.querySelector('[class*="title"]')?.textContent ?? '';
const titles = () => options().map(titleOf);
const rowOf = (title: string) => options().find((row) => titleOf(row) === title) as HTMLElement;
const selectedTitles = () =>
  options()
    .filter((row) => row.getAttribute('aria-selected') === 'true')
    .map(titleOf);
const projectSelect = () => screen.getByRole('combobox', { name: 'Project' }) as HTMLSelectElement;
const ago = (seconds: number) => Date.now() - seconds * 1000;

/** Five sessions in the open project, newest first: p0 to p4. */
const five = () =>
  Array.from({ length: 5 }, (_, index) =>
    listItem(`p${index}`, { title: `p${index}`, lastActiveAt: ago(60 + index * 10) }),
  );

describe('session history (card 032)', () => {
  it('SESS-71 the project select shows the open project and hides other folders', async () => {
    setup([listItem('a', { title: 'mine', cwd: HERE }), listItem('b', { title: 'theirs', cwd: OTHER })]);
    await screen.findByText('mine');
    expect(projectSelect().value).toBe(HERE);
    expect(projectSelect().selectedOptions[0]?.textContent).toBe('hsos');
    expect(titles()).toEqual(['mine']);
  });

  it('SESS-71 the state select "Interrupted" shows only interrupted rows', async () => {
    setup([
      listItem('a', { title: 'ended one', state: 'ended' }),
      listItem('b', { title: 'broken one', state: 'interrupted' }),
    ]);
    await screen.findByText('ended one');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'State' }), 'interrupted');
    expect(titles()).toEqual(['broken one']);
  });

  it('SESS-72 "All projects" groups rows by folder, each headed by its name, newest first in each', async () => {
    setup([
      listItem('a1', { title: 'here old', cwd: HERE, lastActiveAt: ago(600) }),
      listItem('a2', { title: 'here new', cwd: HERE, lastActiveAt: ago(60) }),
      listItem('b1', { title: 'there old', cwd: OTHER, lastActiveAt: ago(900) }),
      listItem('b2', { title: 'there new', cwd: OTHER, lastActiveAt: ago(300) }),
    ]);
    await screen.findByText('here new');
    await userEvent.selectOptions(projectSelect(), 'all');
    const groups = screen
      .getAllByRole('region')
      .filter((region) => region.getAttribute('aria-label') !== 'Session History');
    const heads = groups.map((group) => group.querySelector('h3')?.textContent);
    expect(heads).toEqual(['hsos', 'other']);
    expect(titles()).toEqual(['here new', 'here old', 'there new', 'there old']);
  });

  it('SESS-72 a click then a Shift-click selects the rows between them', async () => {
    setup(five());
    await screen.findByText('p0');
    fireEvent.click(rowOf('p1'));
    fireEvent.click(rowOf('p3'), { shiftKey: true });
    expect(selectedTitles()).toEqual(['p1', 'p2', 'p3']);
  });

  it('SESS-72 Ctrl+A on the list selects every row and the toolbar offers "Delete 5"', async () => {
    setup(five());
    await screen.findByText('p0');
    fireEvent.keyDown(rowOf('p0'), { key: 'a', ctrlKey: true });
    expect(selectedTitles()).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Delete 5' })).toBeTruthy();
  });

  it('SESS-73 F2 on a row opens the rename dialog with the current title', async () => {
    setup([listItem('a', { title: 'fix login' })]);
    await screen.findByText('fix login');
    fireEvent.keyDown(rowOf('fix login'), { key: 'F2' });
    const dialog = await screen.findByRole('dialog', { name: 'Rename session' });
    expect((within(dialog).getByRole('textbox', { name: 'Session name' }) as HTMLInputElement).value).toBe(
      'fix login',
    );
  });

  it('SESS-73 the Delete key opens "Move 1 session to the Recycle Bin?"', async () => {
    setup([listItem('a', { title: 'old chat' })]);
    await screen.findByText('old chat');
    fireEvent.keyDown(rowOf('old chat'), { key: 'Delete' });
    expect(await screen.findByRole('dialog', { name: 'Move 1 session to the Recycle Bin?' })).toBeTruthy();
  });

  it('SESS-73 a row with a note shows its first line, muted', async () => {
    setup([listItem('a', { title: 'with note', note: 'Kept for notes\nsecond line' })]);
    const line = await screen.findByText('Kept for notes');
    expect(line.className).toMatch(/note/);
    expect(screen.queryByText('second line')).toBeNull();
  });

  it('SESS-74 Save sends the trimmed title, closes the dialog, and an ended session says Claude Code lists the name too', async () => {
    const { bus } = setup([listItem('a', { title: 'fix login', state: 'ended' })]);
    bus.answer(sessionsChannels.rename, (request) => ok({ title: request.title, writtenToTranscript: true }));
    await screen.findByText('fix login');
    fireEvent.keyDown(rowOf('fix login'), { key: 'F2' });
    const dialog = await screen.findByRole('dialog', { name: 'Rename session' });
    expect(within(dialog).getByText("Claude Code's own session list shows this name too.")).toBeTruthy();
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Session name' }), ' flow  ');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(bus.payloadsOf(sessionsChannels.rename)).toEqual([{ sessionId: 'a', title: 'fix login flow' }]),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('SESS-74 a running session says Claude Code shows the name after the session ends', async () => {
    setup([listItem('a', { title: 'live one', state: 'running', liveTerminalId: 'terminal-lv1' })]);
    await screen.findByText('live one');
    fireEvent.keyDown(rowOf('live one'), { key: 'F2' });
    expect(await screen.findByText('Claude Code shows this name after the session ends.')).toBeTruthy();
  });

  it('SESS-74 a title of 81 characters disables Save and says "Use 80 characters or fewer."', async () => {
    setup([listItem('a', { title: 'fix login' })]);
    await screen.findByText('fix login');
    fireEvent.keyDown(rowOf('fix login'), { key: 'F2' });
    const dialog = await screen.findByRole('dialog', { name: 'Rename session' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Session name' }), {
      target: { value: 'x'.repeat(81) },
    });
    expect((within(dialog).getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(dialog).getByText('Use 80 characters or fewer.')).toBeTruthy();
  });

  it('SESS-75 Ctrl+Enter saves the note once, Enter alone adds a line', async () => {
    const { bus } = setup([listItem('a', { title: 'noted', note: '' })]);
    bus.answer(sessionsChannels.setNote, () => ok({}));
    await screen.findByText('noted');
    await userEvent.click(screen.getByRole('button', { name: 'Actions for noted' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit note' }));
    const field = await screen.findByRole('textbox', { name: 'Note' });
    await userEvent.type(field, 'first{Enter}second');
    expect((field as HTMLTextAreaElement).value).toBe('first\nsecond');
    expect(bus.payloadsOf(sessionsChannels.setNote)).toHaveLength(0);
    await userEvent.keyboard('{Control>}{Enter}{/Control}');
    await waitFor(() =>
      expect(bus.payloadsOf(sessionsChannels.setNote)).toEqual([{ sessionId: 'a', note: 'first\nsecond' }]),
    );
  });

  const mixed = () => [
    listItem('run', { title: 'runner', state: 'running', liveTerminalId: 'terminal-lv1' }),
    listItem('end', { title: 'finished', state: 'ended' }),
  ];

  it('SESS-76 deleting a selection with a running session names it, focuses Cancel, and trashes only the ended one', async () => {
    const { bus } = setup(mixed());
    bus.answer(sessionsChannels.trash, (request) => ok({ trashed: request.sessionIds, failed: [] }));
    await screen.findByText('runner');
    fireEvent.keyDown(rowOf('runner'), { key: 'a', ctrlKey: true });
    await userEvent.click(screen.getByRole('button', { name: 'Delete 2' }));
    const dialog = await screen.findByRole('dialog', { name: 'Move 1 session to the Recycle Bin?' });
    expect(dialog.textContent).toContain('Still running, will be skipped: runner');
    await waitFor(() =>
      expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Cancel' })),
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Move to Recycle Bin' }));
    await waitFor(() => expect(bus.payloadsOf(sessionsChannels.trash)).toEqual([{ sessionIds: ['end'] }]));
  });

  it('SESS-76 a partial failure shows "1 moved to the Recycle Bin" and the failure message', async () => {
    const { bus } = setup([listItem('a', { title: 'first' }), listItem('b', { title: 'second' })]);
    bus.answer(sessionsChannels.trash, () =>
      ok({ trashed: ['a'] as never, failed: [{ sessionId: 'b' as never, message: 'Locked' }] }),
    );
    await screen.findByText('first');
    fireEvent.keyDown(rowOf('first'), { key: 'a', ctrlKey: true });
    await userEvent.click(screen.getByRole('button', { name: 'Delete 2' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Move to Recycle Bin' }));
    expect(await screen.findByText('1 moved to the Recycle Bin')).toBeTruthy();
    expect(await screen.findByText('Locked')).toBeTruthy();
  });

  it('SESS-70 three record changes within 300 ms read the list once more after 500 ms', async () => {
    const { bus } = setup([listItem('a', { title: 'watched' })]);
    await screen.findByText('watched');
    const before = bus.payloadsOf(sessionsChannels.list).length;
    for (let count = 0; count < 3; count += 1)
      act(() => bus.emit(sessionsChannels.recordChanged, record('a')));
    expect(bus.payloadsOf(sessionsChannels.list)).toHaveLength(before);
    await waitFor(() => expect(bus.payloadsOf(sessionsChannels.list)).toHaveLength(before + 1), {
      timeout: 2000,
    });
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(bus.payloadsOf(sessionsChannels.list)).toHaveLength(before + 1);
  });

  it('state shows "No Claude sessions found." for an empty list', async () => {
    setup([]);
    expect(await screen.findByText('No Claude sessions found.')).toBeTruthy();
  });

  it('state shows "No session matches." when a filter matches nothing', async () => {
    setup([listItem('a', { title: 'only one', state: 'ended' })]);
    await screen.findByText('only one');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'State' }), 'running');
    expect(screen.getByText('No session matches.')).toBeTruthy();
  });

  it('state shows the failure with Retry', async () => {
    const bus = sessionsBus(() => []);
    bus.answer(sessionsChannels.list, () => err('INTERNAL', 'Disk trouble'));
    setup([], bus);
    expect(await screen.findByText('Sessions could not be read. Disk trouble')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });
});
