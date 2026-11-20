import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { claudeLinkChannels } from '@hsos/contracts/channels/claude-link';
import { gitChannels } from '@hsos/contracts/channels/git';
import type { RepoStatus } from '@hsos/contracts/channels/git';
import { reviewChannels } from '@hsos/contracts/channels/review';
import { sessionsChannels } from '@hsos/contracts/channels/sessions';
import { shellChannels } from '@hsos/contracts/channels/shell';
import { terminalChannels } from '@hsos/contracts/channels/terminal';
import { workspaceChannels } from '@hsos/contracts/channels/workspace';
import { ok } from '@hsos/contracts/result';
import { ToastProvider } from '@hsos/ui-kit';
import { ChangesStatus } from '../../src/modules/git/panel/ChangesStatus';
import { runGitCommand } from '../../src/modules/git/panel/actions';
import { ChangesView } from '../../src/modules/review/panel/ChangesView';
import { DiffPanel } from '../../src/modules/review/panel/DiffPanel';
import { TrayCount } from '../../src/modules/review/panel/TrayCount';
import { repoStatus, reviewFile } from '../fakes/changes-fixtures';
import { abs, PROJECT } from '../fakes/fixtures';
import { createStubBus } from '../fakes/stub-bus';
import type { StubBus } from '../fakes/stub-bus';

afterEach(cleanup);

const changed = (path: string) => ({
  path,
  originalPath: null,
  staged: 'unmodified',
  unstaged: 'modified',
  isUntracked: false,
  isConflicted: false,
});

function gitBus(status: RepoStatus): StubBus {
  const bus = createStubBus();
  bus.answer(workspaceChannels.getCurrentProject, () => ok(PROJECT));
  bus.answer(gitChannels.getStatus, () => ok(status));
  bus.answer(gitChannels.sync, () => ok(undefined as never));
  bus.answer(shellChannels.notify, () => ok(undefined as never));
  return bus;
}

describe('git status fixes (cards 030, 033)', () => {
  it('GIT-26 Sync during a merge runs no git.sync and notifies that the merge must finish first', async () => {
    const bus = gitBus(repoStatus(PROJECT.path, { operation: 'merge', files: [changed('a.ts')] }));
    await runGitCommand(bus, 'sync');
    expect(bus.payloadsOf(gitChannels.sync)).toEqual([]);
    expect(bus.payloadsOf(shellChannels.notify)).toEqual([
      expect.objectContaining({ body: 'Merge in progress. Finish it in a terminal, then sync again.' }),
    ]);
  });

  it('GIT-26 the status item reads "Merge in progress" when a merge is open with no changed file', async () => {
    const bus = gitBus(repoStatus(PROJECT.path, { operation: 'merge' }));
    render(<ChangesStatus bus={bus} openChanges={vi.fn()} />);
    expect(await screen.findByRole('button', { name: 'Merge in progress' })).toBeTruthy();
  });

  it('GIT-26 the status item reads "2 changed · Offline" when the last fetch was offline with 2 files', async () => {
    const bus = gitBus(
      repoStatus(PROJECT.path, { isOffline: true, files: [changed('a.ts'), changed('b.ts')] }),
    );
    render(<ChangesStatus bus={bus} openChanges={vi.fn()} />);
    expect(await screen.findByRole('button', { name: '2 changed · Offline' })).toBeTruthy();
  });

  it('GIT-26 pressing the status item with 2 changed files opens the Changes view', async () => {
    const openChanges = vi.fn();
    const bus = gitBus(repoStatus(PROJECT.path, { files: [changed('a.ts'), changed('b.ts')] }));
    render(<ChangesStatus bus={bus} openChanges={openChanges} />);
    await userEvent.click(await screen.findByRole('button', { name: '2 changed' }));
    expect(openChanges).toHaveBeenCalledTimes(1);
  });

  it('GIT-11 the Changes view, its diff and the tray count read git.getStatus once when the project opens', async () => {
    const bus = createStubBus();
    bus.answer(workspaceChannels.getCurrentProject, () => ok(PROJECT));
    bus.answer(gitChannels.getStatus, () => ok(repoStatus(PROJECT.path, { files: [changed('a.ts')] })));
    bus.answer(reviewChannels.listChanges, () => ok([reviewFile('a.ts')]));
    bus.answer(reviewChannels.listComments, () => ok([]));
    bus.answer(terminalChannels.list, () => ok([]));
    bus.answer(sessionsChannels.list, () => ok([]));
    bus.answer(claudeLinkChannels.getSessionEvents, () => ok([]));
    bus.answer(gitChannels.suggestMessage, () => ok('Update a.ts'));
    render(
      <ToastProvider>
        <ChangesView bus={bus} openFile={vi.fn()} openDiff={vi.fn()} openHistory={vi.fn()} />
        <DiffPanel bus={bus} path={abs('a.ts')} base={{ kind: 'last-commit' }} />
        <TrayCount bus={bus} />
      </ToastProvider>,
    );
    await waitFor(() => expect(bus.payloadsOf(gitChannels.getStatus).length).toBeGreaterThan(0));
    await act(() => new Promise((resolve) => setTimeout(resolve, 100)));
    expect(bus.payloadsOf(gitChannels.getStatus)).toHaveLength(1);
  });
});
