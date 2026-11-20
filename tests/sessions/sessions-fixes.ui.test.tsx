import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { sessionsChannels } from '@hsos/contracts/channels/sessions';
import { shellChannels } from '@hsos/contracts/channels/shell';
import { terminalChannels } from '@hsos/contracts/channels/terminal';
import { workspaceChannels } from '@hsos/contracts/channels/workspace';
import { err, ok } from '@hsos/contracts/result';
import { ToastProvider } from '@hsos/ui-kit';
import { SessionHistory } from '../../src/modules/sessions/panel/SessionHistory';
import { SessionPicker } from '../../src/modules/sessions/panel/SessionPicker';
import { SessionReader } from '../../src/modules/sessions/panel/SessionReader';
import { copyResumeCommand, NO_PROJECT_MESSAGE } from '../../src/modules/sessions/panel/actions';
import { PROJECT } from '../fakes/fixtures';
import { listItem } from '../fakes/review-fixtures';
import { NEW_TERMINAL, record, sessionsBus, terminalInfo, transcriptItem } from '../fakes/sessions-fixtures';
import { createStubBus } from '../fakes/stub-bus';
import type { StubBus } from '../fakes/stub-bus';

afterEach(cleanup);

const HERE = 'C:\\code\\hsos';
const OTHER = 'C:\\code\\other';
const ago = (seconds: number) => Date.now() - seconds * 1000;
const options = () => screen.getAllByRole('option').filter((row) => row.tagName === 'LI');
const titleOf = (row: HTMLElement) => row.querySelector('[class*="title"]')?.textContent ?? '';
const titles = () => options().map(titleOf);
const rowOf = (title: string) => options().find((row) => titleOf(row) === title) as HTMLElement;
const selectedTitles = () =>
  options()
    .filter((row) => row.getAttribute('aria-selected') === 'true')
    .map(titleOf);
const projectSelect = () => screen.getByRole('combobox', { name: 'Project' }) as HTMLSelectElement;
const search = () => screen.getByRole('textbox', { name: 'Search sessions' });

function history(bus: StubBus, openTerminal = vi.fn()) {
  render(
    <ToastProvider>
      <SessionHistory bus={bus} openTranscript={vi.fn()} openTerminal={openTerminal} />
    </ToastProvider>,
  );
  return { openTerminal };
}

/** The picker as the register mounts it: it closes itself on a resume, the toast provider stays. */
function PickerHost({ bus, openTerminal }: { readonly bus: StubBus; readonly openTerminal: () => void }) {
  const [open, setOpen] = useState(true);
  return open ? (
    <SessionPicker
      bus={bus}
      onClose={() => setOpen(false)}
      openTranscript={vi.fn()}
      openTerminal={openTerminal}
    />
  ) : null;
}

describe('session fixes (card 032)', () => {
  it('SESS-71 Ctrl+A in the search field is left to the browser and selects no row', async () => {
    history(sessionsBus(() => [listItem('a', { title: 'alpha' }), listItem('b', { title: 'beta' })]));
    await screen.findByText('alpha');
    const notPrevented = fireEvent.keyDown(search(), { key: 'a', ctrlKey: true });
    expect(notPrevented).toBe(true);
    expect(selectedTitles()).toEqual([]);
  });

  it('SESS-72 Ctrl+A with a row focused selects all three rows', async () => {
    history(
      sessionsBus(() => [
        listItem('a', { title: 'one' }),
        listItem('b', { title: 'two' }),
        listItem('c', { title: 'three' }),
      ]),
    );
    await screen.findByText('one');
    rowOf('two').focus();
    fireEvent.keyDown(rowOf('two'), { key: 'a', ctrlKey: true });
    expect(selectedTitles()).toEqual(['one', 'two', 'three']);
    expect(screen.getByRole('button', { name: 'Delete 3' })).toBeTruthy();
  });

  it('SESS-73 Enter on a focused "more" button opens its menu and does not open the transcript', async () => {
    const bus = sessionsBus(() => [listItem('a', { title: 'alpha' })]);
    const openTranscript = vi.fn();
    render(
      <ToastProvider>
        <SessionHistory bus={bus} openTranscript={openTranscript} openTerminal={vi.fn()} />
      </ToastProvider>,
    );
    await screen.findByText('alpha');
    const more = screen.getByRole('button', { name: 'Actions for alpha' });
    more.focus();
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByRole('menuitem', { name: 'Open transcript' })).toBeTruthy();
    expect(openTranscript).not.toHaveBeenCalled();
  });

  it('SESS-73 F2 and Delete on a focused "more" button run neither the rename nor the delete dialog', async () => {
    history(sessionsBus(() => [listItem('a', { title: 'alpha' })]));
    await screen.findByText('alpha');
    const more = screen.getByRole('button', { name: 'Actions for alpha' });
    fireEvent.keyDown(more, { key: 'F2' });
    fireEvent.keyDown(more, { key: 'Delete' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('SESS-72 ArrowDown then ArrowUp moves focus to the next row and back', async () => {
    history(
      sessionsBus(() => [
        listItem('a', { title: 'one' }),
        listItem('b', { title: 'two' }),
        listItem('c', { title: 'three' }),
      ]),
    );
    await screen.findByText('one');
    rowOf('one').focus();
    fireEvent.keyDown(rowOf('one'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(rowOf('two'));
    fireEvent.keyDown(rowOf('two'), { key: 'ArrowUp' });
    expect(document.activeElement).toBe(rowOf('one'));
  });

  it('SESS-31 SESS-32 a resume from the picker closes it and the "Resumed" toast stays after the close', async () => {
    const bus = sessionsBus(() => [listItem('a', { title: 'alpha' })]);
    bus.answer(terminalChannels.create, () => ok(terminalInfo('terminal-t01')));
    render(
      <ToastProvider>
        <PickerHost bus={bus} openTerminal={vi.fn()} />
      </ToastProvider>,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Resume in new terminal' }));
    expect(await screen.findByText('Resumed "alpha" in a new terminal.')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(screen.getByText('Resumed "alpha" in a new terminal.')).toBeTruthy();
  });

  it('SESS-32 "Resume in new terminal" opens the new terminal panel on the session folder', async () => {
    const bus = sessionsBus(() => [listItem('a', { title: 'alpha', cwd: HERE })]);
    bus.answer(terminalChannels.create, () => ok(terminalInfo('terminal-t01')));
    const openTerminal = vi.fn();
    render(
      <ToastProvider>
        <PickerHost bus={bus} openTerminal={() => openTerminal('terminal-t01', HERE)} />
      </ToastProvider>,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Resume in new terminal' }));
    await waitFor(() => expect(openTerminal).toHaveBeenCalledWith('terminal-t01', HERE));
    expect(await screen.findByText('Resumed "alpha" in a new terminal.')).toBeTruthy();
    expect(bus.payloadsOf(sessionsChannels.bind)).toEqual([{ sessionId: 'a', terminalId: 'terminal-t01' }]);
    expect(NEW_TERMINAL).toBe('terminal-nw1');
  });

  it('SESS-32 resume with no project open shows "Open a project first" and creates no terminal', async () => {
    const bus = sessionsBus(() => [listItem('a', { title: 'alpha' })]);
    bus.answer(workspaceChannels.getCurrentProject, () => ok(null as never));
    history(bus);
    await screen.findByText('alpha');
    await userEvent.click(screen.getByRole('button', { name: 'Actions for alpha' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Resume in new terminal' }));
    expect(await screen.findByText(NO_PROJECT_MESSAGE)).toBeTruthy();
    expect(bus.payloadsOf(terminalChannels.create)).toEqual([]);
  });

  it('SESS-32 a failing terminal.create shows its message as an error toast and opens no panel', async () => {
    const bus = sessionsBus(() => [listItem('a', { title: 'alpha' })]);
    bus.answer(terminalChannels.create, () => err('INTERNAL', 'No shell could start.'));
    const openTerminal = vi.fn();
    render(
      <ToastProvider>
        <PickerHost bus={bus} openTerminal={openTerminal} />
      </ToastProvider>,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Resume in new terminal' }));
    expect(await screen.findByText('No shell could start.')).toBeTruthy();
    expect(openTerminal).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('SESS-71 with no session in the open project, "All projects" is shown and every group is listed', async () => {
    history(
      sessionsBus(() => [
        listItem('b1', { title: 'there only', cwd: OTHER }),
        listItem('b2', { title: 'there too', cwd: OTHER }),
      ]),
    );
    await screen.findByText('there only');
    expect(projectSelect().selectedOptions[0]?.textContent).toBe('All projects');
    expect(titles()).toEqual(['there only', 'there too']);
  });

  it('SESS-71 a project filter chosen is reset to the default when workspace.projectChanged fires', async () => {
    const bus = sessionsBus(() => [
      listItem('a1', { title: 'here', cwd: HERE }),
      listItem('b1', { title: 'there', cwd: OTHER }),
    ]);
    history(bus);
    await screen.findByText('here');
    await userEvent.selectOptions(projectSelect(), 'all');
    expect(projectSelect().value).toBe('all');
    const next = { ...PROJECT, id: 'fedcba9876543210', path: OTHER, name: 'other' };
    act(() => bus.emit(workspaceChannels.projectChanged, next));
    await waitFor(() => expect(projectSelect().value).toBe(OTHER));
    expect(titles()).toEqual(['there']);
  });

  it('SESS-72 "All projects" orders the groups by their newest row and each group newest first', async () => {
    history(
      sessionsBus(() => [
        listItem('a1', { title: 'here old', cwd: HERE, lastActiveAt: ago(1200) }),
        listItem('a2', { title: 'here new', cwd: HERE, lastActiveAt: ago(900) }),
        listItem('b1', { title: 'there old', cwd: OTHER, lastActiveAt: ago(1500) }),
        listItem('b2', { title: 'there new', cwd: OTHER, lastActiveAt: ago(120) }),
      ]),
    );
    await screen.findByText('here new');
    await userEvent.selectOptions(projectSelect(), 'all');
    const heads = screen
      .getAllByRole('region')
      .filter((region) => region.getAttribute('aria-label') !== 'Session History')
      .map((group) => group.querySelector('h3')?.textContent);
    expect(heads).toEqual(['other', 'hsos']);
    expect(titles()).toEqual(['there new', 'there old', 'here new', 'here old']);
  });

  it('SESS-50 a reader whose transcript grows from 200 to 650 items shows items 0 to 649 with no gap or repeat', async () => {
    let total = 200;
    const transcript = () =>
      Array.from({ length: total }, (_, index) => transcriptItem(index, 'assistant', 'message ' + index));
    const bus = sessionsBus(() => [listItem('s1')]);
    bus.answer(sessionsChannels.readTranscript, ({ beforeIndex, limit }) => {
      const list = transcript();
      const older = beforeIndex === null ? list : list.filter((item) => item.index < beforeIndex);
      return ok({ items: older.slice(-limit), total: list.length });
    });
    render(
      <ToastProvider>
        <SessionReader
          bus={bus}
          session={{
            sessionId: listItem('s1').sessionId,
            title: 'long',
            cwd: PROJECT.path,
            hasOriginal: true,
            liveTerminalId: null,
            note: '',
          }}
          openTerminal={vi.fn()}
        />
      </ToastProvider>,
    );
    await screen.findByText('message 199');
    total = 650;
    await screen.findByText('message 649', undefined, { timeout: 4000 });
    const texts = screen.queryAllByText(/^message \d+$/).map((node) => node.textContent);
    expect(texts.length).toBe(650);
    expect(new Set(texts).size).toBe(650);
    for (let index = 0; index < 650; index += 1) expect(texts).toContain('message ' + index);
  });

  it('SESS-50 "Show earlier" keeps the view where it was', async () => {
    const all = Array.from({ length: 400 }, (_, index) =>
      transcriptItem(index, 'assistant', 'message ' + index),
    );
    const bus = sessionsBus(() => [listItem('s1')]);
    bus.answer(sessionsChannels.readTranscript, ({ beforeIndex, limit }) => {
      const older = beforeIndex === null ? all : all.filter((item) => item.index < beforeIndex);
      return ok({ items: older.slice(-limit), total: all.length });
    });
    const { container } = render(
      <ToastProvider>
        <SessionReader
          bus={bus}
          session={{
            sessionId: listItem('s1').sessionId,
            title: 'long',
            cwd: PROJECT.path,
            hasOriginal: true,
            liveTerminalId: null,
            note: '',
          }}
          openTerminal={vi.fn()}
        />
      </ToastProvider>,
    );
    await screen.findByText('message 399');
    const scroller = container.querySelector('[class*="scroll"]') as HTMLDivElement;
    // jsdom has no layout: the height is 1000 when the anchor is taken, then 1400 once the older items are in.
    let reads = 0;
    let top = 0;
    Object.defineProperty(scroller, 'scrollHeight', {
      configurable: true,
      get: () => (reads++ === 0 ? 1000 : 1400),
    });
    Object.defineProperty(scroller, 'scrollTop', {
      configurable: true,
      get: () => top,
      set: (value: number) => (top = value),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show earlier' }));
    await screen.findByText('message 0');
    expect(top).toBe(400);
  });

  it('SESS-32 SESS-43 the Resume button of a reader hides while a terminal runs the session and returns when it exits', async () => {
    let live: string | null = null;
    const bus = sessionsBus(() => [listItem('s1', { liveTerminalId: live })]);
    bus.answer(sessionsChannels.readTranscript, () =>
      ok({ items: [transcriptItem(0, 'user', 'hi')], total: 1 }),
    );
    render(
      <ToastProvider>
        <SessionReader
          bus={bus}
          session={{
            sessionId: listItem('s1').sessionId,
            title: 's1',
            cwd: PROJECT.path,
            hasOriginal: true,
            liveTerminalId: null,
            note: '',
          }}
          openTerminal={vi.fn()}
        />
      </ToastProvider>,
    );
    expect(await screen.findByRole('button', { name: 'Resume' })).toBeTruthy();
    live = 'terminal-lv1';
    act(() => bus.emit(sessionsChannels.recordChanged, record('s1')));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Resume' })).toBeNull());
    live = null;
    act(() => bus.emit(terminalChannels.exited, { id: 'terminal-lv1' } as never));
    expect(await screen.findByRole('button', { name: 'Resume' })).toBeTruthy();
  });

  it('SESS-76 deleting only running sessions shows "Nothing to move" with a Close button and calls no trash', async () => {
    const bus = sessionsBus(() => [
      listItem('r1', { title: 'runner', state: 'running', liveTerminalId: 'terminal-lv1' }),
    ]);
    history(bus);
    await screen.findByText('runner');
    fireEvent.click(rowOf('runner'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete 1' }));
    expect(await screen.findByText('Nothing to move')).toBeTruthy();
    expect(screen.queryByText(/Move 0/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
    expect(bus.payloadsOf(sessionsChannels.trash)).toEqual([]);
  });

  it('SESS-76 deleting one idle and one running session asks "Move 1 session" and lists the running one as skipped', async () => {
    const bus = sessionsBus(() => [
      listItem('i1', { title: 'idle one' }),
      listItem('r1', { title: 'runner', state: 'running', liveTerminalId: 'terminal-lv1' }),
    ]);
    history(bus);
    await screen.findByText('idle one');
    fireEvent.click(rowOf('idle one'));
    fireEvent.click(rowOf('runner'), { shiftKey: true });
    fireEvent.click(screen.getByRole('button', { name: 'Delete 2' }));
    expect(await screen.findByText('Move 1 session to the Recycle Bin?')).toBeTruthy();
    expect(screen.getByText(/Still running, will be skipped: runner/)).toBeTruthy();
  });

  it('SESS-32 copy resume command writes the folder change and the resume, with PowerShell quotes escaped', async () => {
    const bus = createStubBus();
    bus.answer(shellChannels.writeClipboard, () => ok({}));
    await copyResumeCommand(bus, listItem('abc', { cwd: 'C:\\dir $x\\\x60y' }));
    expect(bus.payloadsOf(shellChannels.writeClipboard)).toEqual([
      { text: 'cd "C:\\dir \x60$x\\\x60\x60y"; claude --resume abc' },
    ]);
  });

  it('SESS-32 a failing clipboard write shows its message as an error toast', async () => {
    const bus = sessionsBus(() => [listItem('a', { title: 'alpha' })]);
    bus.answer(shellChannels.writeClipboard, () => err('INTERNAL', 'Clipboard is busy.'));
    render(
      <ToastProvider>
        <PickerHost bus={bus} openTerminal={vi.fn()} />
      </ToastProvider>,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Copy resume command' }));
    expect(await screen.findByText('Clipboard is busy.')).toBeTruthy();
  });
});
