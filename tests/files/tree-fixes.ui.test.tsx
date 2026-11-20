import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { filesChannels } from '@hsos/contracts/channels/files';
import type { DirEntry } from '@hsos/contracts/channels/files';
import { workspaceChannels } from '@hsos/contracts/channels/workspace';
import { ok } from '@hsos/contracts/result';
import { ToastProvider } from '@hsos/ui-kit';
import { FilesTree } from '../../src/modules/files/panel/FilesTree';
import { abs, dirEntry, PROJECT } from '../fakes/fixtures';
import { createStubBus } from '../fakes/stub-bus';

afterEach(cleanup);

const NEXT = { ...PROJECT, id: 'fedcba9876543210', path: 'C:\\code\\next', name: 'next' };
const tree = () => screen.getByRole('tree', { name: 'Project files' });

function renderTree(bus: ReturnType<typeof createStubBus>) {
  render(
    <ToastProvider>
      <FilesTree
        bus={bus}
        confirmTrash={() => true}
        openFile={() => undefined}
        showHistory={() => undefined}
      />
    </ToastProvider>,
  );
}

describe('files tree fixes (card 030)', () => {
  it('FILE-60 P-40 a change in the root reloads it with no skeleton and keeps the entries on screen', async () => {
    let root: DirEntry[] = [dirEntry('README.md')];
    const bus = createStubBus();
    bus.answer(workspaceChannels.getCurrentProject, () => ok(PROJECT));
    bus.answer(filesChannels.listDir, ({ dir }) => ok(dir === PROJECT.path ? [...root] : []));
    renderTree(bus);
    await screen.findByRole('treeitem', { name: 'README.md' });
    root = [dirEntry('README.md'), dirEntry('new.md')];
    act(() =>
      bus.emit(filesChannels.changed, { changes: [{ path: abs('new.md'), kind: 'created' }] } as never),
    );
    expect(await screen.findByRole('treeitem', { name: 'new.md' })).toBeTruthy();
    expect(screen.getByRole('treeitem', { name: 'README.md' })).toBeTruthy();
    expect(screen.queryByText(/loading/i)).toBeNull();
    expect(tree()).toBeTruthy();
  });

  it('FILE-60 a listing still in flight when the project changes is not shown', async () => {
    const bus = createStubBus();
    let release: (value: { ok: true; value: DirEntry[] }) => void = () => undefined;
    bus.answer(workspaceChannels.getCurrentProject, () => ok(PROJECT));
    bus.answer(filesChannels.listDir, ({ dir }) => {
      if (dir === PROJECT.path) return new Promise((resolve) => (release = resolve));
      return ok([dirEntry('fresh.ts')]);
    });
    renderTree(bus);
    await waitFor(() => expect(bus.payloadsOf(filesChannels.listDir)).toHaveLength(1));
    act(() => bus.emit(workspaceChannels.projectChanged, NEXT));
    expect(await screen.findByRole('treeitem', { name: 'fresh.ts' })).toBeTruthy();
    release(ok([dirEntry('stale.ts')]));
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(screen.queryByRole('treeitem', { name: 'stale.ts' })).toBeNull();
    expect(screen.getByRole('treeitem', { name: 'fresh.ts' })).toBeTruthy();
  });
});
