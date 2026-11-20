import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { activityChannels } from '@hsos/contracts/channels/activity';
import type { ActivityEntry, Artifact } from '@hsos/contracts/channels/activity';
import { historyChannels } from '@hsos/contracts/channels/history';
import { reviewChannels } from '@hsos/contracts/channels/review';
import { shellChannels } from '@hsos/contracts/channels/shell';
import { workspaceChannels } from '@hsos/contracts/channels/workspace';
import { err, ok } from '@hsos/contracts/result';
import { ToastProvider } from '@hsos/ui-kit';
import { Artifacts } from '../../src/modules/activity/panel/Artifacts';
import { Timeline } from '../../src/modules/activity/panel/Timeline';
import { artifact, entry } from '../fakes/changes-fixtures';
import { abs, PROJECT } from '../fakes/fixtures';
import { snapshot } from '../fakes/history-fixtures';
import { createStubBus } from '../fakes/stub-bus';
import type { StubBus } from '../fakes/stub-bus';

afterEach(cleanup);

const DAY = 86_400_000;

function timeline(entries: () => readonly ActivityEntry[], custom?: StubBus) {
  const bus = custom ?? createStubBus();
  bus.answer(workspaceChannels.getCurrentProject, () => ok(PROJECT));
  if (custom === undefined) bus.answer(activityChannels.listTimeline, () => ok([...entries()]));
  const openFile = vi.fn();
  const openHistory = vi.fn();
  render(
    <ToastProvider>
      <Timeline bus={bus} openFile={openFile} openHistory={openHistory} />
    </ToastProvider>,
  );
  return { bus, openFile, openHistory };
}

/** Makes `scrollTop` a stored value on one element, since jsdom does not scroll. */
function storeScrollTop(element: Element, initial: number): void {
  let value = initial;
  Object.defineProperty(element, 'scrollTop', {
    configurable: true,
    get: () => value,
    set: (next: number) => (value = next),
  });
}

/** Forty one-file entries, 5 minutes apart so none of them groups. */
const forty = () =>
  Array.from({ length: 40 }, (_, index) =>
    entry(`e${index}`, `f${index}.ts`, { time: Date.now() - (index + 1) * 5 * 60_000 }),
  );

describe('activity timeline (card 033)', () => {
  it('ACT-15 a new entry while scrolled down keeps the scroll and shows "1 new changes"', async () => {
    const { bus } = timeline(forty);
    await screen.findByText('f0.ts');
    storeScrollTop(screen.getByLabelText('Activity', { selector: 'div' }), 300);
    act(() => bus.emit(activityChannels.entryAdded, entry('fresh', 'fresh.ts', { time: Date.now() })));
    expect(await screen.findByRole('button', { name: '1 new changes' })).toBeTruthy();
    expect(screen.getByLabelText('Activity', { selector: 'div' }).scrollTop).toBe(300);
    expect(screen.queryByText('fresh.ts')).toBeNull();
  });

  it('ACT-15 a new entry at the top becomes the first row with no chip', async () => {
    const { bus } = timeline(forty);
    await screen.findByText('f0.ts');
    act(() => bus.emit(activityChannels.entryAdded, entry('fresh', 'fresh.ts', { time: Date.now() })));
    expect(await screen.findByText('fresh.ts')).toBeTruthy();
    const first = screen.getByLabelText('Activity', { selector: 'div' }).querySelector('button');
    expect(first?.textContent).toContain('fresh.ts');
    expect(screen.queryByRole('button', { name: /new changes/ })).toBeNull();
  });

  it('ACT-11 seven Claude entries of one session within 40 s become one group row, an owner entry stays single', async () => {
    const now = Date.now();
    const claude = Array.from({ length: 7 }, (_, index) =>
      entry(`c${index}`, `parser${index}.ts`, {
        cause: 'claude',
        sessionId: 'sess-1',
        sessionTitle: 'refactor parser',
        time: now - 60_000 - index * 6_000,
      }),
    );
    timeline(() => [...claude, entry('own', 'mine.ts', { cause: 'owner', time: now - 5 * 60_000 })]);
    const group = await screen.findByRole('button', { name: 'refactor parser · 7 files' });
    expect(group.getAttribute('aria-expanded')).toBe('false');
    expect(within(screen.getByLabelText('Activity', { selector: 'div' })).getByText('You')).toBeTruthy();
    expect(screen.queryByText('parser0.ts')).toBeNull();
    await userEvent.click(group);
    expect(group.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('parser0.ts')).toBeTruthy();
    expect(screen.getByText('parser6.ts')).toBeTruthy();
  });

  it('ACT-10 entries from today and yesterday sit under "Today" and "Yesterday"', async () => {
    timeline(() => [
      entry('t1', 'today.ts', { time: Date.now() - 1_000 }),
      entry('y1', 'old.ts', { time: Date.now() - DAY }),
    ]);
    expect(await screen.findByRole('heading', { name: 'Today' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Yesterday' })).toBeTruthy();
  });

  it('ACT-14 "Restore the version before this change" asks first, then restores the previous snapshot', async () => {
    const { bus } = timeline(() => [entry('e1', 'src/a.ts')]);
    const previous = snapshot('prev', abs('src\\a.ts'), 'hsos-save', 10);
    bus.answer(historyChannels.getPrevious, () => ok(previous));
    bus.answer(historyChannels.restore, () =>
      ok({ path: abs('src\\a.ts'), hash: 'a'.repeat(64) as never, modifiedAt: 1 as never, size: 1 }),
    );
    fireEvent.contextMenu(await screen.findByText('a.ts'));
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Restore the version before this change' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Restore the version before this change?' });
    expect(bus.payloadsOf(historyChannels.getPrevious)).toHaveLength(1);
    expect(bus.payloadsOf(historyChannels.restore)).toHaveLength(0);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(bus.payloadsOf(historyChannels.restore)).toEqual([{ id: previous.id }]));
  });

  it('ACT-14 "Pin comment" opens the pin dialog and Pin adds a file-line comment on line 1', async () => {
    const { bus } = timeline(() => [entry('e1', 'src/a.ts')]);
    bus.answer(reviewChannels.addComment, (request) =>
      ok({ id: 'comment-0001' as never, target: request.target, text: request.text, createdAt: 1 as never }),
    );
    fireEvent.contextMenu(await screen.findByText('a.ts'));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Pin comment' }));
    const dialog = await screen.findByRole('dialog', { name: 'Pin comment' });
    await userEvent.type(within(dialog).getByRole('textbox'), 'look here');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Pin' }));
    await waitFor(() => expect(bus.payloadsOf(reviewChannels.addComment)).toHaveLength(1));
    expect(bus.payloadsOf(reviewChannels.addComment)[0]).toMatchObject({
      target: { kind: 'file-line', path: abs('src\\a.ts'), line: 1 },
      text: 'look here',
    });
  });

  it('state shows the empty message when nothing was recorded', async () => {
    timeline(() => []);
    expect(
      await screen.findByText('No changes recorded yet. Changes to files in this project appear here.'),
    ).toBeTruthy();
  });

  it('state shows the failure with Retry', async () => {
    const bus = createStubBus();
    bus.answer(activityChannels.listTimeline, () => err('INTERNAL', 'Index locked'));
    timeline(() => [], bus);
    expect(await screen.findByText('Activity could not be read. Index locked')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() =>
      expect(bus.payloadsOf(activityChannels.listTimeline).length).toBeGreaterThanOrEqual(3),
    );
  });
});

function artifacts(all: () => readonly Artifact[], bus: StubBus = createStubBus()) {
  bus.answer(workspaceChannels.getCurrentProject, () => ok(PROJECT));
  bus.answer(activityChannels.listArtifacts, ({ query }) =>
    ok(all().filter((item) => item.relPath.toLowerCase().includes(query.toLowerCase()))),
  );
  bus.answer(shellChannels.openPath, () => ok({}));
  const openFile = vi.fn();
  render(
    <ToastProvider>
      <Artifacts bus={bus} openFile={openFile} />
    </ToastProvider>,
  );
  return { bus, openFile };
}

describe('artifacts (card 033)', () => {
  const both = () => [artifact('a/report.html', 'html'), artifact('b/chart.png', 'image')];

  it('ACT-33 typing "rep" asks for artifacts with query "rep" and one tile shows', async () => {
    const { bus } = artifacts(both);
    await screen.findByText('report.html');
    await userEvent.type(screen.getByRole('textbox', { name: 'Search artifacts' }), 'rep');
    await waitFor(() =>
      expect(bus.payloadsOf(activityChannels.listArtifacts).at(-1)).toEqual({
        projectId: PROJECT.id,
        query: 'rep',
      }),
    );
    await waitFor(() => expect(screen.queryByText('chart.png')).toBeNull());
    expect(screen.getByText('report.html')).toBeTruthy();
  });

  it('ACT-31 activating an html tile opens it with shell.openPath', async () => {
    const { bus } = artifacts(both);
    await userEvent.click((await screen.findByText('report.html')).closest('button') as HTMLElement);
    expect(bus.payloadsOf(shellChannels.openPath)).toEqual([{ path: abs('a\\report.html') }]);
  });

  it('ACT-31 activating an image tile opens it in the file viewer', async () => {
    const { bus, openFile } = artifacts(both);
    await userEvent.click((await screen.findByText('chart.png')).closest('button') as HTMLElement);
    expect(openFile).toHaveBeenCalledWith(abs('b\\chart.png'));
    expect(bus.payloadsOf(shellChannels.openPath)).toHaveLength(0);
  });

  it('state shows the empty message for an empty list with no query', async () => {
    artifacts(() => []);
    expect(
      await screen.findByText('Pages, PDFs and images Claude makes in this project appear here.'),
    ).toBeTruthy();
  });
});
