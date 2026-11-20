import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DirEntry } from '@hsos/contracts/channels/files';
import { filesChannels } from '@hsos/contracts/channels/files';
import { shellChannels } from '@hsos/contracts/channels/shell';
import { workspaceChannels } from '@hsos/contracts/channels/workspace';
import { err, ok } from '@hsos/contracts/result';
import { ToastProvider } from '@hsos/ui-kit';
import { FilesTree } from '../../src/modules/files/panel/FilesTree';
import { register } from '../../src/modules/files/register.ui';
import { createFakeUiContext } from '../fakes/fake-ui-context';
import { abs, dirEntry, PROJECT } from '../fakes/fixtures';
import { createStubBus, never } from '../fakes/stub-bus';
import type { StubBus } from '../fakes/stub-bus';

afterEach(cleanup);

type Listings = Record<string, readonly DirEntry[]>;

function setup(listings: Listings, options: { readonly confirmTrash?: boolean } = {}) {
  const bus = createStubBus();
  bus.answer(workspaceChannels.getCurrentProject, () => ok(PROJECT));
  bus.answer(filesChannels.listDir, ({ dir }) => ok(listings[dir] ?? []));
  bus.answer(filesChannels.trash, () => ok({}));
  bus.answer(shellChannels.writeClipboard, () => ok({}));
  const openFile = vi.fn();
  const showHistory = vi.fn();
  render(
    <ToastProvider>
      <FilesTree
        bus={bus}
        confirmTrash={() => options.confirmTrash ?? true}
        openFile={openFile}
        showHistory={showHistory}
      />
    </ToastProvider>,
  );
  return { bus, openFile, showHistory };
}

const listDirCalls = (bus: StubBus) => bus.payloadsOf(filesChannels.listDir).map((payload) => payload.dir);
const tree = () => screen.getByRole('tree', { name: 'Project files' });
const rowNames = () =>
  within(tree())
    .getAllByRole('treeitem')
    .map((row) => row.getAttribute('aria-label'));

describe('files tree (card 030)', () => {
  it('FILE-60 shows the root entries, folders first, with src collapsed', async () => {
    setup({ [PROJECT.path]: [dirEntry('src', 'dir'), dirEntry('README.md')] });
    const src = await screen.findByRole('treeitem', { name: 'src' });
    expect(rowNames()).toEqual(['src', 'README.md']);
    expect(src.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('treeitem', { name: 'README.md' }).hasAttribute('aria-expanded')).toBe(false);
  });

  it('FILE-60 loads a folder when ArrowRight expands it, once, with its absolute path', async () => {
    const { bus } = setup({
      [PROJECT.path]: [dirEntry('src', 'dir'), dirEntry('README.md')],
      [abs('src')]: [dirEntry('index.ts')],
    });
    await screen.findByRole('treeitem', { name: 'src' });
    fireEvent.keyDown(tree(), { key: 'ArrowDown' });
    fireEvent.keyDown(tree(), { key: 'ArrowRight' });
    await screen.findByRole('treeitem', { name: 'index.ts' });
    expect(listDirCalls(bus).filter((dir) => dir === abs('src'))).toHaveLength(1);
    expect(screen.getByRole('treeitem', { name: 'src' }).getAttribute('aria-expanded')).toBe('true');
  });

  it('FILE-61 reloads only the loaded folders a change touches', async () => {
    const { bus } = setup({
      [PROJECT.path]: [dirEntry('docs', 'dir'), dirEntry('src', 'dir')],
      [abs('src')]: [dirEntry('y.ts')],
      [abs('docs')]: [dirEntry('x.md')],
    });
    await screen.findByRole('treeitem', { name: 'src' });
    fireEvent.keyDown(tree(), { key: 'ArrowDown' });
    fireEvent.keyDown(tree(), { key: 'ArrowDown' });
    fireEvent.keyDown(tree(), { key: 'ArrowRight' });
    await screen.findByRole('treeitem', { name: 'y.ts' });
    const before = bus.payloadsOf(filesChannels.listDir).length;
    act(() => {
      bus.emit(filesChannels.changed, {
        changes: [
          { path: abs('docs\\x.md'), kind: 'changed' },
          { path: abs('src\\y.ts'), kind: 'changed' },
        ],
      });
    });
    await waitFor(() => expect(bus.payloadsOf(filesChannels.listDir).length).toBeGreaterThan(before));
    const after = listDirCalls(bus).slice(before);
    expect(after).toContain(abs('src'));
    expect(after).not.toContain(abs('docs'));
  });

  it('FILE-63 Enter on a selected file opens it', async () => {
    const { openFile } = setup({ [PROJECT.path]: [dirEntry('src', 'dir'), dirEntry('README.md')] });
    const row = await screen.findByRole('treeitem', { name: 'README.md' });
    fireEvent.click(row);
    fireEvent.keyDown(tree(), { key: 'Enter' });
    expect(openFile).toHaveBeenCalledWith(abs('README.md'));
  });

  it('FILE-63 the registered tree opens files.viewer with the path and line null', async () => {
    const bus = createStubBus();
    bus.answer(workspaceChannels.getCurrentProject, () => ok(PROJECT));
    bus.answer(filesChannels.listDir, () => ok([dirEntry('README.md')]));
    const ctx = createFakeUiContext('files', bus);
    register(ctx);
    const Tree = ctx.panel('files.tree').component;
    render(
      <ToastProvider>
        <Tree panelId={'p'.repeat(12) as never} state={{} as never} setState={() => undefined} isFocused />
      </ToastProvider>,
    );
    fireEvent.click(await screen.findByRole('treeitem', { name: 'README.md' }));
    fireEvent.keyDown(tree(), { key: 'Enter' });
    expect(ctx.opened).toEqual([{ type: 'files.viewer', state: { path: abs('README.md'), line: null } }]);
  });

  it('FILE-1 lists A, node_modules, b.txt and dims node_modules', async () => {
    setup({
      [PROJECT.path]: [
        dirEntry('A', 'dir'),
        dirEntry('node_modules', 'dir', { isDimmed: true }),
        dirEntry('b.txt'),
      ],
    });
    await screen.findByRole('treeitem', { name: 'A' });
    expect(rowNames()).toEqual(['A', 'node_modules', 'b.txt']);
    const label = (name: string) =>
      screen.getByRole('treeitem', { name }).querySelector('span[class*="label"]');
    expect(label('node_modules')?.className).toMatch(/dimmed/);
    expect(label('A')?.className).not.toMatch(/dimmed/);
  });

  it('state shows the loading skeleton "Loading files" when listDir is slow', async () => {
    const bus = createStubBus();
    bus.answer(workspaceChannels.getCurrentProject, () => ok(PROJECT));
    bus.answer(filesChannels.listDir, () => never());
    render(
      <ToastProvider>
        <FilesTree bus={bus} confirmTrash={() => true} openFile={vi.fn()} showHistory={vi.fn()} />
      </ToastProvider>,
    );
    expect(await screen.findByRole('status', { name: 'Loading files' }, { timeout: 2000 })).toBeTruthy();
    expect(screen.getByText('Loading files')).toBeTruthy();
  });

  it('state shows the error line with Retry, and Retry reads again', async () => {
    const bus = createStubBus();
    bus.answer(workspaceChannels.getCurrentProject, () => ok(PROJECT));
    bus.answer(filesChannels.listDir, () => err('FILE_NOT_FOUND', 'Access denied'));
    render(
      <ToastProvider>
        <FilesTree bus={bus} confirmTrash={() => true} openFile={vi.fn()} showHistory={vi.fn()} />
      </ToastProvider>,
    );
    expect(await screen.findByText('The folder could not be read. Access denied')).toBeTruthy();
    const calls = bus.payloadsOf(filesChannels.listDir).length;
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(bus.payloadsOf(filesChannels.listDir).length).toBe(calls + 1));
  });

  it('state shows "This folder is empty." with a New file button that opens the dialog', async () => {
    setup({ [PROJECT.path]: [] });
    expect(await screen.findByText('This folder is empty.')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'New file' }));
    expect(await screen.findByRole('dialog', { name: 'New file' })).toBeTruthy();
  });

  it('state shows "No project open" when there is no project', async () => {
    const bus = createStubBus();
    bus.answer(workspaceChannels.getCurrentProject, () => ok(null));
    render(
      <ToastProvider>
        <FilesTree bus={bus} confirmTrash={() => true} openFile={vi.fn()} showHistory={vi.fn()} />
      </ToastProvider>,
    );
    expect(await screen.findByText('No project open')).toBeTruthy();
  });

  it('FILE-64 Delete from the context menu asks first, and Confirm trashes that path', async () => {
    const { bus } = setup({ [PROJECT.path]: [dirEntry('a.txt'), dirEntry('b.txt')] });
    const row = await screen.findByRole('treeitem', { name: 'a.txt' });
    fireEvent.click(row);
    fireEvent.contextMenu(row);
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog', { name: 'Move to Recycle Bin?' });
    expect(bus.payloadsOf(filesChannels.trash)).toHaveLength(0);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Move to Recycle Bin' }));
    await waitFor(() => expect(bus.payloadsOf(filesChannels.trash)).toEqual([{ path: abs('a.txt') }]));
  });

  it('FILE-64 a right click on b.txt acts on b.txt even when a.txt was selected', async () => {
    const { bus } = setup({ [PROJECT.path]: [dirEntry('a.txt'), dirEntry('b.txt')] });
    fireEvent.click(await screen.findByRole('treeitem', { name: 'a.txt' }));
    const second = screen.getByRole('treeitem', { name: 'b.txt' });
    fireEvent.contextMenu(second);
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog', { name: 'Move to Recycle Bin?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Move to Recycle Bin' }));
    await waitFor(() => expect(bus.payloadsOf(filesChannels.trash)).toEqual([{ path: abs('b.txt') }]));
  });
});
