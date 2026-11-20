import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { filesChannels } from '@hsos/contracts/channels/files';
import { historyChannels } from '@hsos/contracts/channels/history';
import type { Snapshot } from '@hsos/contracts/channels/history';
import { err, ok } from '@hsos/contracts/result';
import { ToastProvider } from '@hsos/ui-kit';
import { Timeline } from '../../src/modules/history/panel/Timeline';
import { abs, textContent } from '../fakes/fixtures';
import { snapshot } from '../fakes/history-fixtures';
import { createStubBus, never } from '../fakes/stub-bus';

afterEach(cleanup);

const A = abs('a.ts');
const MINUTE = 60_000;

/** Three versions of a.ts, newest first: external 137 B, hsos-save 100 B, baseline 50 B. */
const THREE: Snapshot[] = [
  snapshot('s-external', A, 'external', 137, Date.now() - 5 * MINUTE),
  snapshot('s-save', A, 'hsos-save', 100, Date.now() - 60 * MINUTE),
  snapshot('s-base', A, 'baseline', 50, Date.now() - 180 * MINUTE),
];

function setup(snapshots: readonly Snapshot[] = THREE, texts: Record<string, string> = {}) {
  const bus = createStubBus();
  bus.answer(historyChannels.listForFile, () => ok([...snapshots]));
  bus.answer(historyChannels.getPrevious, ({ id }) => {
    const at = snapshots.findIndex((item) => item.id === id);
    return ok(snapshots[at + 1] ?? null);
  });
  bus.answer(historyChannels.readText, ({ id }) => ok(texts[id.replace(/_+$/, '')] ?? ''));
  bus.answer(historyChannels.restore, () => ok(textContent(A, 'x').version));
  bus.answer(filesChannels.read, () => ok(textContent(A, 'current file')));
  render(
    <ToastProvider>
      <Timeline bus={bus} path={A} selectedId={null} onSelect={vi.fn()} />
    </ToastProvider>,
  );
  return bus;
}

describe('history timeline (card 030)', () => {
  it('HIST-40 names each version by its source, newest first', async () => {
    setup();
    await screen.findByText('Changed outside HSOS');
    const text = within(screen.getByRole('listbox', { name: 'Versions of this file' }))
      .getAllByRole('option')
      .map((row) => row.textContent ?? '');
    expect(text).toHaveLength(3);
    expect(text[0]).toContain('Changed outside HSOS');
    expect(text[1]).toContain('Saved in HSOS');
    expect(text[2]).toContain('Before first change');
  });

  it('HIST-40 each row shows its size change against the older row', async () => {
    setup();
    await screen.findByText('Changed outside HSOS');
    const rows = within(screen.getByRole('listbox', { name: 'Versions of this file' })).getAllByRole(
      'option',
    );
    expect(rows[0]?.textContent).toContain('+37 B');
    expect(rows[1]?.textContent).toContain('+50 B');
    expect(rows[2]?.textContent).not.toMatch(/[+−]\d/);
  });

  it('HIST-41 the diff reads the previous version and the selected one and shows added and removed lines', async () => {
    const bus = setup(THREE, { 's-external': 'a\nc', 's-save': 'a\nb' });
    const diff = await screen.findByRole('region', { name: 'Changes in a.ts' });
    expect(bus.payloadsOf(historyChannels.getPrevious)).toEqual([{ id: THREE[0]?.id }]);
    const read = bus.payloadsOf(historyChannels.readText).map((payload) => payload.id);
    expect(read).toContain(THREE[0]?.id);
    expect(read).toContain(THREE[1]?.id);
    expect(diff.querySelector('[class*="removed"]')?.textContent).toContain('b');
    expect(diff.querySelector('[class*="added"]')?.textContent).toContain('c');
  });

  it('HIST-41 with Compare on, the left side is the selected snapshot and the right side is the current file', async () => {
    const bus = setup(THREE, { 's-external': 'selected text' });
    await screen.findByRole('region', { name: 'Changes in a.ts' });
    await userEvent.click(screen.getByRole('switch', { name: 'Compare with current file' }));
    await waitFor(() => expect(bus.payloadsOf(filesChannels.read)).toEqual([{ path: A }]));
    await waitFor(() => {
      const diff = screen.getByRole('region', { name: 'Changes in a.ts' });
      expect(diff.querySelector('[class*="removed"]')?.textContent).toContain('selected text');
      expect(diff.querySelector('[class*="added"]')?.textContent).toContain('current file');
    });
  });

  it('HIST-42 Restore this version asks first, then restores once and toasts', async () => {
    const bus = setup(THREE, { 's-external': 'new', 's-save': 'old' });
    await screen.findByRole('region', { name: 'Changes in a.ts' });
    await userEvent.click(screen.getByRole('button', { name: 'Restore this version' }));
    const dialog = await screen.findByRole('dialog', { name: 'Restore this version?' });
    expect(bus.payloadsOf(historyChannels.restore)).toHaveLength(0);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(bus.payloadsOf(historyChannels.restore)).toEqual([{ id: THREE[0]?.id }]));
    expect((await screen.findByText(/is back at the version from/)).textContent).toContain('a.ts');
  });

  it('HIST-42 Cancel does not restore', async () => {
    const bus = setup(THREE, { 's-external': 'new', 's-save': 'old' });
    await screen.findByRole('region', { name: 'Changes in a.ts' });
    await userEvent.click(screen.getByRole('button', { name: 'Restore this version' }));
    const dialog = await screen.findByRole('dialog', { name: 'Restore this version?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(bus.payloadsOf(historyChannels.restore)).toHaveLength(0);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('HIST-43 a snapshot of this file reloads the list, one of another file does not', async () => {
    const bus = setup();
    await screen.findByText('Changed outside HSOS');
    const before = bus.payloadsOf(historyChannels.listForFile).length;
    act(() => bus.emit(historyChannels.snapshotAdded, snapshot('other', abs('b.ts'), 'external', 5)));
    expect(bus.payloadsOf(historyChannels.listForFile)).toHaveLength(before);
    act(() => bus.emit(historyChannels.snapshotAdded, snapshot('mine', A, 'external', 5)));
    await waitFor(() => expect(bus.payloadsOf(historyChannels.listForFile)).toHaveLength(before + 1));
  });

  it('state shows the empty message when there are no versions', async () => {
    setup([]);
    expect(
      await screen.findByText(
        'No earlier versions of this file yet. Versions appear here after the file changes.',
      ),
    ).toBeTruthy();
  });

  it('state shows the failure with Retry', async () => {
    const bus = createStubBus();
    bus.answer(historyChannels.listForFile, () => err('INTERNAL', 'Disk trouble'));
    render(
      <ToastProvider>
        <Timeline bus={bus} path={A} selectedId={null} onSelect={vi.fn()} />
      </ToastProvider>,
    );
    expect(await screen.findByText('History could not be read. Disk trouble')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(bus.payloadsOf(historyChannels.listForFile)).toHaveLength(2));
  });

  it('state shows "Binary file changed." when the snapshot is binary', async () => {
    const bus = createStubBus();
    bus.answer(historyChannels.listForFile, () => ok([...THREE]));
    bus.answer(historyChannels.getPrevious, () => ok(THREE[1] ?? null));
    bus.answer(historyChannels.readText, () => err('FILE_BINARY', 'Not text'));
    render(
      <ToastProvider>
        <Timeline bus={bus} path={A} selectedId={null} onSelect={vi.fn()} />
      </ToastProvider>,
    );
    expect(await screen.findByText('Binary file changed.')).toBeTruthy();
  });

  it('state shows the skeleton "Loading the difference" while the diff loads', async () => {
    const bus = createStubBus();
    bus.answer(historyChannels.listForFile, () => ok([...THREE]));
    bus.answer(historyChannels.getPrevious, () => ok(THREE[1] ?? null));
    bus.answer(historyChannels.readText, () => never());
    render(
      <ToastProvider>
        <Timeline bus={bus} path={A} selectedId={null} onSelect={vi.fn()} />
      </ToastProvider>,
    );
    expect(
      await screen.findByRole('status', { name: 'Loading the difference' }, { timeout: 2000 }),
    ).toBeTruthy();
  });
});
