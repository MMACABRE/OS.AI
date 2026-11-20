import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sessionsChannels } from '@hsos/contracts/channels/sessions';
import type { TranscriptItem } from '@hsos/contracts/channels/sessions';
import { err, ok } from '@hsos/contracts/result';
import { PageVisibleContext, ToastProvider } from '@hsos/ui-kit';
import { SessionReader } from '../../src/modules/sessions/panel/SessionReader';
import { PROJECT } from '../fakes/fixtures';
import { listItem } from '../fakes/review-fixtures';
import { sessionsBus, transcriptItem } from '../fakes/sessions-fixtures';
import { never } from '../fakes/stub-bus';
import type { StubBus } from '../fakes/stub-bus';

afterEach(cleanup);

const SESSION = {
  sessionId: listItem('s1').sessionId,
  title: 'reader',
  cwd: PROJECT.path,
  hasOriginal: true,
  liveTerminalId: null,
  note: '',
};

/** A reader over a transcript held in `all`, answered the way link-service pages it. */
function setup(
  all: () => readonly TranscriptItem[],
  options: { readonly visible?: boolean; readonly bus?: StubBus } = {},
) {
  const bus = options.bus ?? sessionsBus(() => [listItem('s1')]);
  if (options.bus === undefined)
    bus.answer(sessionsChannels.readTranscript, ({ beforeIndex, limit }) => {
      const list = all();
      const older = beforeIndex === null ? list : list.filter((item) => item.index < beforeIndex);
      return ok({ items: older.slice(-limit), total: list.length });
    });
  render(
    <ToastProvider>
      <PageVisibleContext.Provider value={options.visible ?? true}>
        <SessionReader bus={bus} session={SESSION} openTerminal={vi.fn()} />
      </PageVisibleContext.Provider>
    </ToastProvider>,
  );
  return bus;
}

const messages = (count: number) =>
  Array.from({ length: count }, (_, index) =>
    transcriptItem(index, index % 2 === 0 ? 'user' : 'assistant', `message ${index}`),
  );
const shown = () => screen.queryAllByText(/^message \d+$/);

describe('session reader (card 032)', () => {
  it('SESS-50 shows "You" and "Claude" items with their text and a tool item as one muted line', async () => {
    setup(() => [
      transcriptItem(0, 'user', 'please fix it'),
      transcriptItem(1, 'assistant', 'fixed it'),
      transcriptItem(2, 'tool', 'Bash npm run check'),
    ]);
    const you = await screen.findByRole('region', { name: 'You' });
    expect(within(you).getByText('please fix it')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Claude' })).getByText('fixed it')).toBeTruthy();
    const tool = screen.getByText('Bash npm run check');
    expect(tool.tagName).toBe('P');
    expect(tool.className).toMatch(/tool/);
  });

  it('SESS-50 of 250 items 200 show with "Show earlier", which reads before the oldest shown with limit 200', async () => {
    const bus = setup(() => messages(250));
    await screen.findByText('message 249');
    expect(shown()).toHaveLength(200);
    await userEvent.click(screen.getByRole('button', { name: 'Show earlier' }));
    await waitFor(() =>
      expect(bus.payloadsOf(sessionsChannels.readTranscript)).toContainEqual({
        sessionId: SESSION.sessionId,
        beforeIndex: 50,
        limit: 200,
      }),
    );
    await waitFor(() => expect(shown()).toHaveLength(250));
  });

  it('SESS-50 a visible reader appends the fourth item after 2 s without repeating the first three', async () => {
    let list = messages(3);
    setup(() => list);
    await screen.findByText('message 2');
    list = messages(4);
    expect(await screen.findByText('message 3', {}, { timeout: 4000 })).toBeTruthy();
    expect(shown().map((node) => node.textContent)).toEqual([
      'message 0',
      'message 1',
      'message 2',
      'message 3',
    ]);
  }, 10_000);

  it('SESS-50 a reader on a hidden page does not poll', async () => {
    const bus = setup(() => messages(3), { visible: false });
    await screen.findByText('message 2');
    await new Promise((resolve) => setTimeout(resolve, 2_500));
    expect(bus.payloadsOf(sessionsChannels.readTranscript)).toHaveLength(1);
  }, 10_000);

  it('SESS-51 a prompt with html is shown literally and makes no element', async () => {
    setup(() => [transcriptItem(0, 'user', '<b>bold</b> and <script>x</script>')]);
    const text = await screen.findByText('<b>bold</b> and <script>x</script>');
    expect(text.querySelector('b')).toBeNull();
    expect(document.querySelector('b')).toBeNull();
    expect(document.querySelector('script')).toBeNull();
  });

  it('SESS-50 an empty transcript says "This session has no messages yet."', async () => {
    setup(() => []);
    expect(await screen.findByText('This session has no messages yet.')).toBeTruthy();
  });

  it('state shows the failure with Retry', async () => {
    const bus = sessionsBus(() => []);
    bus.answer(sessionsChannels.readTranscript, () => err('FILE_NOT_FOUND', 'The file is gone'));
    setup(() => [], { bus });
    expect(await screen.findByText('The transcript could not be read. The file is gone')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(bus.payloadsOf(sessionsChannels.readTranscript)).toHaveLength(2));
  });

  it('state shows the skeleton "Reading the transcript" while it loads', async () => {
    const bus = sessionsBus(() => []);
    bus.answer(sessionsChannels.readTranscript, () => never());
    setup(() => [], { bus });
    expect(
      await screen.findByRole('status', { name: 'Reading the transcript' }, { timeout: 2000 }),
    ).toBeTruthy();
  });
});
