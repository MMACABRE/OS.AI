import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { activityChannels } from '@hsos/contracts/channels/activity';
import type { ActivityEntry } from '@hsos/contracts/channels/activity';
import { shellChannels } from '@hsos/contracts/channels/shell';
import { workspaceChannels } from '@hsos/contracts/channels/workspace';
import { err, ok } from '@hsos/contracts/result';
import { ToastProvider } from '@hsos/ui-kit';
import { Artifacts } from '../../src/modules/activity/panel/Artifacts';
import { Timeline } from '../../src/modules/activity/panel/Timeline';
import { artifact, entry } from '../fakes/changes-fixtures';
import { PROJECT } from '../fakes/fixtures';
import { listItem } from '../fakes/review-fixtures';
import { createStubBus } from '../fakes/stub-bus';
import type { StubBus } from '../fakes/stub-bus';

afterEach(cleanup);

function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('expected a value');
  return value;
}

const SID = listItem('sessionaaa1').sessionId;
const MIN = 60_000;
const NEXT = { ...PROJECT, id: 'fedcba9876543210', path: 'C:\\code\\next', name: 'next' };

function timeline(
  answer: (payload: { cause: string | null; before: number | null }) => readonly ActivityEntry[],
) {
  const bus = createStubBus();
  bus.answer(workspaceChannels.getCurrentProject, () => ok(PROJECT));
  bus.answer(activityChannels.listTimeline, (payload) => ok([...answer(payload as never)]));
  render(
    <ToastProvider>
      <Timeline bus={bus} openFile={vi.fn()} openHistory={vi.fn()} />
    </ToastProvider>,
  );
  return bus;
}

const claudeEntry = (id: string, relPath: string, input: Record<string, unknown> = {}) =>
  entry(id, relPath, { cause: 'claude', sessionId: SID, sessionTitle: 'Session A', ...input });

const scroller = () => screen.getByLabelText('Activity', { selector: 'div' });

describe('activity fixes (cards 030, 033)', () => {
  it('ACT-12 P-40 a filter with no match keeps both filters on screen and says so', async () => {
    timeline(({ cause }) => (cause === 'owner' ? [] : [claudeEntry('c1', 'f1.ts')]));
    await screen.findByText('f1.ts');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Cause' }), 'owner');
    expect(await screen.findByText('No change matches these filters.')).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Cause' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Session' })).toBeTruthy();
  });

  it('ACT-12 a session chosen stays chosen when the cause changes and the list reloads', async () => {
    const bus = timeline(() => [claudeEntry('c1', 'f1.ts')]);
    await screen.findByText('f1.ts');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Session' }), SID);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Cause' }), 'claude');
    await waitFor(() =>
      expect(bus.payloadsOf(activityChannels.listTimeline).at(-1)).toMatchObject({
        cause: 'claude',
        sessionId: SID,
      }),
    );
    expect((screen.getByRole('combobox', { name: 'Session' }) as HTMLSelectElement).value).toBe(SID);
  });

  it('ACT-15 P-40 a new entry while the list is scrolled keeps the scroll with no skeleton', async () => {
    const bus = timeline(() => [claudeEntry('c1', 'f1.ts')]);
    await screen.findByText('f1.ts');
    let top = 300;
    Object.defineProperty(scroller(), 'scrollTop', {
      configurable: true,
      get: () => top,
      set: (value: number) => (top = value),
    });
    act(() => bus.emit(activityChannels.entryAdded, claudeEntry('fresh', 'fresh.ts', { time: Date.now() })));
    expect(await screen.findByRole('button', { name: '1 new changes' })).toBeTruthy();
    expect(screen.queryByLabelText('Reading activity')).toBeNull();
    expect(top).toBe(300);
  });

  it('ACT-16 scrolling to the end asks from one past the last time, and the entry at that time shows once', async () => {
    const now = Date.now();
    const page1 = Array.from({ length: 100 }, (_, index) =>
      entry(
        'e' + index,
        'f' + index + '.ts',
        index === 99
          ? { time: now - 99 * 5 * MIN, cause: 'claude', sessionId: SID, sessionTitle: 'Session A' }
          : { time: now - (Math.min(index, 98) + 1) * 5 * MIN },
      ),
    );
    const T = must(page1[99]).time;
    const bus = createStubBus();
    bus.answer(workspaceChannels.getCurrentProject, () => ok(PROJECT));
    bus.answer(activityChannels.listTimeline, (payload) => {
      if (payload.before === null) return ok(page1);
      return ok([must(page1[99]), entry('p2', 'g.ts', { time: T - MIN })]);
    });
    render(
      <ToastProvider>
        <Timeline bus={bus} openFile={vi.fn()} openHistory={vi.fn()} />
      </ToastProvider>,
    );
    await screen.findByText('f99.ts');
    fireEvent.scroll(scroller());
    expect(await screen.findByText('g.ts')).toBeTruthy();
    const asked = bus.payloadsOf(activityChannels.listTimeline).filter((payload) => payload.before !== null);
    expect(asked).toHaveLength(1);
    expect(must(asked[0]).before).toBe(T + 1);
    expect(screen.getAllByText('f99.ts')).toHaveLength(1);
  });

  it('ACT-16 a page that adds only known entries asks for no further page', async () => {
    const now = Date.now();
    const page1 = Array.from({ length: 100 }, (_, index) =>
      entry('e' + index, 'f' + index + '.ts', { time: now - (index + 1) * 5 * MIN }),
    );
    const bus = createStubBus();
    bus.answer(workspaceChannels.getCurrentProject, () => ok(PROJECT));
    bus.answer(activityChannels.listTimeline, (payload) =>
      ok(payload.before === null ? page1 : page1.slice(-2)),
    );
    render(
      <ToastProvider>
        <Timeline bus={bus} openFile={vi.fn()} openHistory={vi.fn()} />
      </ToastProvider>,
    );
    await screen.findByText('f99.ts');
    fireEvent.scroll(scroller());
    await waitFor(() =>
      expect(bus.payloadsOf(activityChannels.listTimeline).some((p) => p.before !== null)).toBe(true),
    );
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    const asked = bus.payloadsOf(activityChannels.listTimeline).length;
    fireEvent.scroll(scroller());
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(bus.payloadsOf(activityChannels.listTimeline)).toHaveLength(asked);
  });

  it('ACT-33 typing "abc" in the Artifacts search asks once, with "abc", after the pause', async () => {
    const bus = createStubBus();
    bus.answer(workspaceChannels.getCurrentProject, () => ok(PROJECT));
    bus.answer(activityChannels.listArtifacts, ({ query }) =>
      ok(query === '' ? [artifact('x.html', 'html')] : []),
    );
    render(
      <ToastProvider>
        <Artifacts bus={bus} openFile={vi.fn()} />
      </ToastProvider>,
    );
    await screen.findByText('x.html');
    await userEvent.type(screen.getByRole('textbox', { name: 'Search artifacts' }), 'abc');
    await act(() => new Promise((resolve) => setTimeout(resolve, 400)));
    const queries = bus.payloadsOf(activityChannels.listArtifacts).map((payload) => payload.query);
    expect(queries.filter((query) => query !== '')).toEqual(['abc']);
  });

  it('ACT-31 a PDF tile that cannot be opened shows the error as a toast', async () => {
    const bus = createStubBus();
    bus.answer(workspaceChannels.getCurrentProject, () => ok(PROJECT));
    bus.answer(activityChannels.listArtifacts, () => ok([artifact('report.pdf', 'pdf')]));
    bus.answer(shellChannels.openPath, () => err('INTERNAL', 'No program is set to open PDF files.'));
    render(
      <ToastProvider>
        <Artifacts bus={bus} openFile={vi.fn()} />
      </ToastProvider>,
    );
    await userEvent.click(await screen.findByText('report.pdf'));
    expect(await screen.findByText('No program is set to open PDF files.')).toBeTruthy();
  });

  it('ACT-30 a project change empties the Artifacts search and drops the old tiles', async () => {
    const bus: StubBus = createStubBus();
    bus.answer(workspaceChannels.getCurrentProject, () => ok(PROJECT));
    bus.answer(activityChannels.listArtifacts, ({ projectId }) =>
      ok(projectId === PROJECT.id ? [artifact('old.html', 'html')] : [artifact('new.html', 'html')]),
    );
    render(
      <ToastProvider>
        <Artifacts bus={bus} openFile={vi.fn()} />
      </ToastProvider>,
    );
    await screen.findByText('old.html');
    await userEvent.type(screen.getByRole('textbox', { name: 'Search artifacts' }), 'old');
    act(() => bus.emit(workspaceChannels.projectChanged, NEXT));
    await screen.findByText('new.html');
    expect(screen.queryByText('old.html')).toBeNull();
    expect((screen.getByRole('textbox', { name: 'Search artifacts' }) as HTMLInputElement).value).toBe('');
  });
});
