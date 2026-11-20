import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { claudeLinkChannels } from '@hsos/contracts/channels/claude-link';
import { gitChannels } from '@hsos/contracts/channels/git';
import { reviewChannels } from '@hsos/contracts/channels/review';
import type { PinnedComment, ReviewFile } from '@hsos/contracts/channels/review';
import { sessionsChannels } from '@hsos/contracts/channels/sessions';
import type { SessionListItem } from '@hsos/contracts/channels/sessions';
import { terminalChannels } from '@hsos/contracts/channels/terminal';
import { workspaceChannels } from '@hsos/contracts/channels/workspace';
import { err, ok } from '@hsos/contracts/result';
import type { RepoStatus } from '@hsos/contracts/channels/git';
import { ToastProvider } from '@hsos/ui-kit';
import { ChangesView } from '../../src/modules/review/panel/ChangesView';
import { targetLabel } from '../../src/modules/review/panel/FeedbackTray';
import { repoStatus, reviewFile } from '../fakes/changes-fixtures';
import { abs, PROJECT } from '../fakes/fixtures';
import { listItem, pinned } from '../fakes/review-fixtures';
import { createStubBus, never } from '../fakes/stub-bus';
import type { StubBus } from '../fakes/stub-bus';
import { SessionEvent } from '@hsos/contracts/channels/claude-link';

afterEach(cleanup);

type Options = {
  readonly files?: () => readonly ReviewFile[];
  readonly status?: RepoStatus;
  readonly sessions?: readonly SessionListItem[];
  readonly bus?: StubBus;
  readonly comments?: readonly PinnedComment[];
};

function setup(options: Options = {}) {
  const bus = options.bus ?? createStubBus();
  const files = options.files ?? (() => [reviewFile('a.ts')]);
  bus.answer(workspaceChannels.getCurrentProject, () => ok(PROJECT));
  bus.answer(gitChannels.getStatus, () => ok(options.status ?? repoStatus(PROJECT.path)));
  if (options.bus === undefined) bus.answer(reviewChannels.listChanges, () => ok([...files()]));
  bus.answer(reviewChannels.listComments, () => ok([...(options.comments ?? [])]));
  bus.answer(terminalChannels.list, () => ok([]));
  bus.answer(sessionsChannels.list, () => ok([...(options.sessions ?? [])]));
  bus.answer(claudeLinkChannels.getSessionEvents, ({ sessionId }) =>
    ok([
      SessionEvent.parse({
        sessionId,
        agentId: null,
        time: 1_000,
        kind: 'file-edit',
        label: 'Edit',
        path: null,
      }),
    ]),
  );
  bus.answer(gitChannels.suggestMessage, () => ok('Update a.ts'));
  bus.answer(gitChannels.commit, () => ok(repoStatus(PROJECT.path)));
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

const rowNamed = (name: string) => screen.getByRole('option', { name });
const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;

describe('changes view (card 033)', () => {
  it('REV-12 a refresh keeps the selected file selected and lists the new one', async () => {
    let files = [reviewFile('a.ts'), reviewFile('b.ts')];
    const { bus } = setup({ files: () => files });
    fireEvent.click(await screen.findByRole('option', { name: 'b.ts' }));
    expect(rowNamed('b.ts').getAttribute('aria-selected')).toBe('true');
    files = [reviewFile('a.ts'), reviewFile('b.ts'), reviewFile('c.ts')];
    act(() => bus.emit(reviewChannels.changesInvalidated, { projectId: PROJECT.id }));
    expect(await screen.findByRole('option', { name: 'c.ts' })).toBeTruthy();
    expect(rowNamed('b.ts').getAttribute('aria-selected')).toBe('true');
  });

  it('REV-14 during a merge both commit buttons are disabled', async () => {
    setup({ status: repoStatus(PROJECT.path, { operation: 'merge' }) });
    await screen.findByRole('option', { name: 'a.ts' });
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Commit message' })).toBeTruthy());
    expect(button('Commit').disabled).toBe(true);
    expect(button('Commit and Sync').disabled).toBe(true);
  });

  it('REV-14 with no operation the message is the suggestion and Commit is enabled', async () => {
    setup();
    await screen.findByRole('option', { name: 'a.ts' });
    await waitFor(() =>
      expect((screen.getByRole('textbox', { name: 'Commit message' }) as HTMLInputElement).value).toBe(
        'Update a.ts',
      ),
    );
    expect(button('Commit').disabled).toBe(false);
  });

  it('REV-14 Commit sends every listed file and the message, then the rows refresh', async () => {
    const { bus } = setup({ files: () => [reviewFile('a.ts'), reviewFile('src/b.ts')] });
    await screen.findByRole('option', { name: 'src/b.ts' });
    await waitFor(() =>
      expect((screen.getByRole('textbox', { name: 'Commit message' }) as HTMLInputElement).value).toBe(
        'Update a.ts',
      ),
    );
    const reads = bus.payloadsOf(reviewChannels.listChanges).length;
    await userEvent.click(button('Commit'));
    await waitFor(() => expect(bus.payloadsOf(gitChannels.commit)).toHaveLength(1));
    expect(bus.payloadsOf(gitChannels.commit)[0]).toEqual({
      root: PROJECT.path,
      message: 'Update a.ts',
      paths: ['a.ts', 'src/b.ts'],
    });
    await waitFor(() => expect(bus.payloadsOf(reviewChannels.listChanges).length).toBeGreaterThan(reads));
  });

  it('REV-10 choosing "Session: fix login" lists changes from the session start and removes the commit box', async () => {
    const { bus } = setup({ sessions: [listItem('s1', { title: 'fix login' })] });
    await screen.findByRole('option', { name: 'a.ts' });
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Changes since' }),
      await screen.findByRole('option', { name: 'Session: fix login' }),
    );
    await waitFor(() =>
      expect(bus.payloadsOf(reviewChannels.listChanges).at(-1)).toEqual({
        projectId: PROJECT.id,
        base: { kind: 'session-start', sessionId: 's1' },
      }),
    );
    expect(screen.queryByRole('textbox', { name: 'Commit message' })).toBeNull();
  });

  it('REV-11 sums three files as "3 files · +120 −45" and names each change letter', async () => {
    setup({
      files: () => [
        reviewFile('a.ts', 'modified', 100, 40),
        reviewFile('b.ts', 'added', 20, 0),
        reviewFile('c.ts', 'deleted', 0, 5),
      ],
    });
    await screen.findByRole('option', { name: 'a.ts' });
    expect(screen.getByText('3 files · +120 −45')).toBeTruthy();
    expect(within(rowNamed('a.ts')).getByLabelText('Modified').textContent).toBe('M');
    expect(within(rowNamed('b.ts')).getByLabelText('Added').textContent).toBe('A');
    expect(within(rowNamed('c.ts')).getByLabelText('Deleted').textContent).toBe('D');
  });

  it('REV-15 "Show History" on a file row opens its history by absolute path', async () => {
    const { openHistory } = setup({ files: () => [reviewFile('src/a.ts')] });
    const row = await screen.findByRole('option', { name: 'src/a.ts' });
    fireEvent.click(row);
    fireEvent.contextMenu(row);
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Show History' }));
    expect(openHistory).toHaveBeenCalledWith(abs('src\\a.ts'));
  });

  it('REV-31 a comment on a removed line is listed with "(removed line)"', async () => {
    setup({
      comments: [
        pinned('c1', { kind: 'diff-line', path: abs('a.ts'), line: 3, side: 'before', quote: 'old' }, 'why'),
      ],
    });
    expect(await screen.findByText('1. a.ts line 3 (removed line)')).toBeTruthy();
  });

  it('state shows the skeleton "Reading changes" while the list is slow', async () => {
    const bus = createStubBus();
    bus.answer(reviewChannels.listChanges, () => never());
    setup({ bus });
    expect(await screen.findByRole('status', { name: 'Reading changes' }, { timeout: 2000 })).toBeTruthy();
  });

  it('state shows the failure with Retry', async () => {
    const bus = createStubBus();
    bus.answer(reviewChannels.listChanges, () => err('INTERNAL', 'Git is stuck'));
    setup({ bus });
    expect(await screen.findByText('Changes could not be read. Git is stuck')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(bus.payloadsOf(reviewChannels.listChanges)).toHaveLength(2));
  });

  it('state shows the not-a-repo line for a folder that is not a repository', async () => {
    setup({ files: () => [], status: { kind: 'not-a-repo', root: PROJECT.path } });
    expect(
      await screen.findByText(
        'This folder is not a git repository. Choose a Claude session to see its changes.',
      ),
    ).toBeTruthy();
  });
});

describe('feedback labels (card 033)', () => {
  it('REV-31 targetLabel ends a before-side diff line with "(removed line)"', () => {
    expect(
      targetLabel(
        { kind: 'diff-line', path: abs('src\\a.ts'), line: 3, side: 'before', quote: 'x' },
        PROJECT.path,
      ),
    ).toBe('src/a.ts line 3 (removed line)');
    expect(
      targetLabel(
        { kind: 'diff-line', path: abs('src\\a.ts'), line: 3, side: 'after', quote: 'x' },
        PROJECT.path,
      ),
    ).toBe('src/a.ts line 3');
  });
});
