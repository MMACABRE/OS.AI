import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { claudeLinkChannels, SessionEvent } from '@hsos/contracts/channels/claude-link';
import { gitChannels } from '@hsos/contracts/channels/git';
import type { RepoStatus } from '@hsos/contracts/channels/git';
import { reviewChannels } from '@hsos/contracts/channels/review';
import type { PinnedComment, ReviewFile } from '@hsos/contracts/channels/review';
import { sessionsChannels } from '@hsos/contracts/channels/sessions';
import type { SessionListItem } from '@hsos/contracts/channels/sessions';
import { terminalChannels } from '@hsos/contracts/channels/terminal';
import { workspaceChannels } from '@hsos/contracts/channels/workspace';
import { ok } from '@hsos/contracts/result';
import { registerTerminalPaste, ToastProvider } from '@hsos/ui-kit';
import { ChangesView } from '../../src/modules/review/panel/ChangesView';
import { FeedbackTray } from '../../src/modules/review/panel/FeedbackTray';
import { repoRelative } from '../../src/modules/review/panel/helpers';
import { repoStatus, reviewFile } from '../fakes/changes-fixtures';
import { abs, PROJECT } from '../fakes/fixtures';
import { listItem, pinned } from '../fakes/review-fixtures';
import { createStubBus, never } from '../fakes/stub-bus';
import type { StubBus } from '../fakes/stub-bus';

afterEach(cleanup);

type Options = {
  readonly files?: () => readonly ReviewFile[];
  readonly status?: RepoStatus;
  readonly sessions?: readonly SessionListItem[];
  /** Session ids whose transcript holds a file edit (REV-10). */
  readonly editing?: readonly string[];
  readonly bus?: StubBus;
};

function setup(options: Options = {}) {
  const bus = options.bus ?? createStubBus();
  const files = options.files ?? (() => [reviewFile('a.ts')]);
  const editing = options.editing ?? [];
  bus.answer(workspaceChannels.getCurrentProject, () => ok(PROJECT));
  bus.answer(gitChannels.getStatus, () => ok(options.status ?? repoStatus(PROJECT.path)));
  if (options.bus === undefined) bus.answer(reviewChannels.listChanges, () => ok([...files()]));
  bus.answer(reviewChannels.listComments, () => ok([]));
  bus.answer(terminalChannels.list, () => ok([]));
  bus.answer(sessionsChannels.list, () => ok([...(options.sessions ?? [])]));
  bus.answer(claudeLinkChannels.getSessionEvents, ({ sessionId }) =>
    ok(
      editing.includes(sessionId)
        ? [
            SessionEvent.parse({
              sessionId,
              agentId: null,
              time: 1_000,
              kind: 'file-edit',
              label: 'Edit',
              path: null,
            }),
          ]
        : [],
    ),
  );
  bus.answer(gitChannels.suggestMessage, () => ok('Update a.ts'));
  bus.answer(gitChannels.commit, () => ok(undefined as never));
  const openFile = vi.fn();
  const openDiff = vi.fn();
  const openHistory = vi.fn();
  render(
    <ToastProvider>
      <ChangesView bus={bus} openFile={openFile} openDiff={openDiff} openHistory={openHistory} />
    </ToastProvider>,
  );
  return { bus, openFile, openDiff, openHistory };
}

const baseSelect = () => screen.getByRole('combobox', { name: 'Changes since' }) as HTMLSelectElement;
const messageField = () => screen.getByRole('textbox', { name: 'Commit message' }) as HTMLInputElement;
const row = (name: string) => screen.getByText(name).closest('[role="option"]') as HTMLElement;

describe('changes view fixes (cards 030, 033)', () => {
  it('REV-12 P-40 a refresh while the commit message is typed keeps the focus, the text and the list on screen', async () => {
    const { bus } = setup();
    await screen.findByText('a.ts');
    await screen.findByDisplayValue('Update a.ts');
    await userEvent.clear(messageField());
    await userEvent.type(messageField(), 'Fix the parser');
    messageField().focus();
    act(() => bus.emit(reviewChannels.changesInvalidated, { projectId: PROJECT.id } as never));
    await waitFor(() => expect(bus.payloadsOf(reviewChannels.listChanges).length).toBeGreaterThan(1));
    expect(document.activeElement).toBe(messageField());
    expect(messageField().value).toBe('Fix the parser');
    expect(screen.queryByLabelText('Reading changes')).toBeNull();
    expect(screen.getByText('a.ts')).toBeTruthy();
  });

  it('REV-10 P-40 a clean repo still shows the base select, with "No changes since the last commit."', async () => {
    setup({ files: () => [] });
    expect(await screen.findByText('No changes since the last commit.')).toBeTruthy();
    expect(baseSelect()).toBeTruthy();
    expect(baseSelect().value).toBe('last-commit');
  });

  it('REV-10 the base select lists only the sessions that edited files', async () => {
    setup({
      sessions: [listItem('edits', { title: 'editing one' }), listItem('reads', { title: 'reading one' })],
      editing: ['edits'],
    });
    await screen.findByText('a.ts');
    await waitFor(() => expect(screen.getByRole('option', { name: 'Session: editing one' })).toBeTruthy());
    const labels = Array.from(baseSelect().options).map((option) => option.textContent);
    expect(labels).toEqual(['Since last commit', 'Session: editing one']);
  });

  it('REV-10 a session base chosen is reset to "Since last commit" when workspace.projectChanged fires', async () => {
    const { bus } = setup({
      sessions: [listItem('edits', { title: 'editing one' })],
      editing: ['edits'],
    });
    await screen.findByText('a.ts');
    await waitFor(() => expect(screen.getByRole('option', { name: 'Session: editing one' })).toBeTruthy());
    await userEvent.selectOptions(baseSelect(), 'session:edits');
    expect(baseSelect().value).toBe('session:edits');
    const next = { ...PROJECT, id: 'fedcba9876543210', path: 'C:\\code\\next', name: 'next' };
    act(() => bus.emit(workspaceChannels.projectChanged, next));
    await waitFor(() => expect(baseSelect().value).toBe('last-commit'));
    expect(messageField()).toBeTruthy();
  });

  it('REV-13 Enter on a changed file opens its diff, not the file', async () => {
    const { openDiff, openFile } = setup({ files: () => [reviewFile('a.ts'), reviewFile('b.ts')] });
    await screen.findByText('b.ts');
    await userEvent.click(row('a.ts'));
    await userEvent.keyboard('{Enter}');
    expect(openDiff).toHaveBeenCalledTimes(1);
    expect(openFile).not.toHaveBeenCalled();
  });

  it('REV-13 a double click on a changed file opens its diff, not the file', async () => {
    const { openDiff, openFile } = setup();
    await screen.findByText('a.ts');
    fireEvent.doubleClick(row('a.ts'));
    expect(openDiff).toHaveBeenCalledTimes(1);
    expect(openFile).not.toHaveBeenCalled();
  });

  it('REV-14 Commit pressed twice calls git.commit once', async () => {
    const { bus } = setup();
    await screen.findByText('a.ts');
    await userEvent.type(messageField(), 'Fix');
    bus.answer(gitChannels.commit, () => never());
    const commit = screen.getByRole('button', { name: 'Commit' });
    fireEvent.click(commit);
    fireEvent.click(commit);
    await waitFor(() => expect(bus.payloadsOf(gitChannels.commit).length).toBe(1));
    expect(bus.payloadsOf(gitChannels.commit)).toHaveLength(1);
  });

  it('REV-14 a file in a project inside the repo is committed with its path from the repo root', () => {
    expect(repoRelative('C:\\repo', 'C:\\repo\\app', 'src/a.ts')).toBe('app/src/a.ts');
  });

  it('REV-32 a comment edited on two lines and saved with Ctrl+Enter keeps both lines', async () => {
    const bus = createStubBus();
    bus.answer(reviewChannels.updateComment, () => ok(undefined as never));
    const comment: PinnedComment = pinned(
      'c1',
      { kind: 'file-line', path: abs('a.ts'), line: 4, quote: 'x' },
      'first',
    );
    render(
      <ToastProvider>
        <FeedbackTray
          bus={bus}
          projectId={PROJECT.id}
          root={PROJECT.path}
          comments={[comment]}
          sessions={[]}
        />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const field = screen.getByRole('textbox', { name: 'Comment text' });
    fireEvent.change(field, { target: { value: 'line one\nline two' } });
    fireEvent.keyDown(field, { key: 'Enter', ctrlKey: true });
    await waitFor(() => expect(bus.payloadsOf(reviewChannels.updateComment)).toHaveLength(1));
    expect(bus.payloadsOf(reviewChannels.updateComment)[0]).toMatchObject({ text: 'line one\nline two' });
  });

  it('REV-34 a comment added after "Sent. Clear comments?" brings back Send to Claude and Copy', async () => {
    const bus = createStubBus();
    bus.answer(reviewChannels.composePrompt, () => ok('Please fix it'));
    const unregister = registerTerminalPaste('terminal-s01', () => 'pasted');
    const sessions = [listItem('live', { title: 'live one', liveTerminalId: 'terminal-s01' })];
    const first = [pinned('c1', { kind: 'file-line', path: abs('a.ts'), line: 1, quote: 'x' }, 'one')];
    const view = render(
      <ToastProvider>
        <FeedbackTray
          bus={bus}
          projectId={PROJECT.id}
          root={PROJECT.path}
          comments={first}
          sessions={sessions}
        />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Send to Claude' }));
    expect(await screen.findByText('Sent. Clear comments?')).toBeTruthy();
    const more = [
      ...first,
      pinned('c2', { kind: 'file-line', path: abs('a.ts'), line: 2, quote: 'y' }, 'two'),
    ];
    view.rerender(
      <ToastProvider>
        <FeedbackTray
          bus={bus}
          projectId={PROJECT.id}
          root={PROJECT.path}
          comments={more}
          sessions={sessions}
        />
      </ToastProvider>,
    );
    expect(screen.queryByText('Sent. Clear comments?')).toBeNull();
    expect(screen.getByRole('button', { name: 'Send to Claude' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
    unregister();
  });
});
