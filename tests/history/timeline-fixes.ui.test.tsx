import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { historyChannels } from '@hsos/contracts/channels/history';
import type { Snapshot } from '@hsos/contracts/channels/history';
import { ok } from '@hsos/contracts/result';
import { ToastProvider } from '@hsos/ui-kit';
import { Timeline } from '../../src/modules/history/panel/Timeline';
import { abs } from '../fakes/fixtures';
import { snapshot } from '../fakes/history-fixtures';
import { createStubBus } from '../fakes/stub-bus';

afterEach(cleanup);

function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('expected a value');
  return value;
}

const A = abs('a.ts');
const MINUTE = 60_000;
const THREE: Snapshot[] = [
  snapshot('s-external', A, 'external', 137, Date.now() - 5 * MINUTE),
  snapshot('s-save', A, 'hsos-save', 100, Date.now() - 60 * MINUTE),
  snapshot('s-base', A, 'baseline', 50, Date.now() - 180 * MINUTE),
];

describe('history timeline fixes (card 030, 033)', () => {
  it('HIST-43 P-40 a new snapshot of the file keeps the selected version and its diff with no skeleton', async () => {
    const bus = createStubBus();
    let list: Snapshot[] = [...THREE];
    bus.answer(historyChannels.listForFile, () => ok([...list]));
    bus.answer(historyChannels.getPrevious, ({ id }) => {
      const at = list.findIndex((item) => item.id === id);
      return ok(list[at + 1] ?? null);
    });
    bus.answer(historyChannels.readText, ({ id }) =>
      ok(id.replace(/_+$/, '') === 's-save' ? 'old text' : 'new text'),
    );
    render(
      <ToastProvider>
        <Timeline bus={bus} path={A} selectedId={must(THREE[1]).id} onSelect={vi.fn()} />
      </ToastProvider>,
    );
    await waitFor(() => expect(bus.payloadsOf(historyChannels.readText).length).toBeGreaterThan(0));
    const before = bus.payloadsOf(historyChannels.listForFile).length;
    list = [snapshot('s-new', A, 'external', 150, Date.now()), ...THREE];
    act(() => bus.emit(historyChannels.snapshotAdded, must(list[0])));
    await waitFor(() => expect(bus.payloadsOf(historyChannels.listForFile).length).toBeGreaterThan(before));
    expect(screen.queryByText('Loading the difference')).toBeNull();
    expect(screen.queryByText(/Reading the history of/)).toBeNull();
    expect(await screen.findAllByText(/old text|new text/)).not.toHaveLength(0);
  });

  it('HIST-42 the restore toast has an "Undo" that restores the version under the new restore row', async () => {
    const bus = createStubBus();
    let list: Snapshot[] = [...THREE];
    bus.answer(historyChannels.listForFile, () => ok([...list]));
    bus.answer(historyChannels.getPrevious, () => ok(null));
    bus.answer(historyChannels.readText, () => ok('text'));
    bus.answer(historyChannels.restore, ({ id }) => {
      if (id === must(THREE[1]).id) list = [snapshot('s-restore', A, 'restore', 100), ...list];
      return ok(undefined as never);
    });
    render(
      <ToastProvider>
        <Timeline bus={bus} path={A} selectedId={must(THREE[1]).id} onSelect={vi.fn()} />
      </ToastProvider>,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Restore this version' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Restore' }));
    expect(await screen.findByText(/is back at the version from/)).toBeTruthy();
    await userEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    const calls = bus.payloadsOf(historyChannels.restore).map((payload) => payload.id);
    expect(calls).toEqual([must(THREE[1]).id, must(THREE[0]).id]);
  });
});
