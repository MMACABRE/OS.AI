import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { reviewChannels } from '@hsos/contracts/channels/review';
import { workspaceChannels } from '@hsos/contracts/channels/workspace';
import { gitChannels } from '@hsos/contracts/channels/git';
import { ok } from '@hsos/contracts/result';
import { ToastProvider } from '@hsos/ui-kit';
import { DiffPanel } from '../../src/modules/review/panel/DiffPanel';
import { repoStatus } from '../fakes/changes-fixtures';
import { abs, PROJECT } from '../fakes/fixtures';
import { createStubBus } from '../fakes/stub-bus';

afterEach(cleanup);

const original = Element.prototype.scrollIntoView;
beforeAll(() => {
  // jsdom has no layout, so no scrollIntoView.
  Element.prototype.scrollIntoView = vi.fn();
});
afterAll(() => {
  Element.prototype.scrollIntoView = original;
});

const A = abs('a.ts');
type Sides = { before: string | null; after: string | null; isBinary?: boolean };

function setup(sides: () => Sides) {
  const bus = createStubBus();
  bus.answer(workspaceChannels.getCurrentProject, () => ok(PROJECT));
  bus.answer(gitChannels.getStatus, () => ok(repoStatus(PROJECT.path)));
  bus.answer(reviewChannels.getDiff, () => ok({ isBinary: false, ...sides() }));
  bus.answer(reviewChannels.listComments, () => ok([]));
  bus.answer(reviewChannels.addComment, (request) =>
    ok({
      id: 'comment-001'.slice(0, 12) as never,
      target: request.target,
      text: request.text,
      createdAt: 1 as never,
    }),
  );
  render(
    <ToastProvider>
      <DiffPanel bus={bus} path={A} base={{ kind: 'last-commit' }} />
    </ToastProvider>,
  );
  return bus;
}

const numbered = (count: number, replace: Record<number, string> = {}) =>
  Array.from({ length: count }, (_, index) => replace[index + 1] ?? `line ${index + 1}`).join('\n');
const rowTexts = () => [...document.querySelectorAll('[data-row]')].map((row) => row.textContent ?? '');
const region = () => screen.getByRole('region', { name: 'Changes in a.ts' });

describe('diff panel (card 033)', () => {
  it('REV-20 a refresh keeps the diff on screen and shows the new lines', async () => {
    let sides = { before: numbered(300), after: numbered(300, { 150: 'changed 150' }) };
    const bus = setup(() => sides);
    const first = await screen.findByRole('region', { name: 'Changes in a.ts' });
    sides = { before: numbered(300), after: `new 1\nnew 2\nnew 3\n${numbered(300, { 150: 'changed 150' })}` };
    act(() => bus.emit(reviewChannels.changesInvalidated, { projectId: PROJECT.id }));
    await waitFor(() => expect(region().textContent).toContain('new 3'));
    expect(region()).toBe(first);
    expect(rowTexts().some((text) => text.includes('changed 150'))).toBe(true);
  });

  it('REV-23 C on a focused changed line, a typed text and Ctrl+Enter add a diff-line comment', async () => {
    const bus = setup(() => ({
      before: numbered(130, { 121: 'out[i] = old' }),
      after: numbered(130, { 121: 'out[i] = cap' }),
    }));
    await screen.findByRole('region', { name: 'Changes in a.ts' });
    const line = [...document.querySelectorAll<HTMLElement>('[class*="added"][data-row]')].find((row) =>
      row.textContent?.includes('out[i] = cap'),
    );
    expect(line).toBeDefined();
    if (line === undefined) return;
    line.focus();
    fireEvent.keyDown(line, { key: 'c' });
    const box = await screen.findByRole('textbox', { name: 'Comment on line 121' });
    await userEvent.type(box, 'Keep the cap');
    await userEvent.keyboard('{Control>}{Enter}{/Control}');
    await waitFor(() => expect(bus.payloadsOf(reviewChannels.addComment)).toHaveLength(1));
    expect(bus.payloadsOf(reviewChannels.addComment)[0]).toEqual({
      projectId: PROJECT.id,
      target: { kind: 'diff-line', path: A, line: 121, side: 'after', quote: 'out[i] = cap' },
      text: 'Keep the cap',
    });
  });

  it('REV-23 Escape closes the comment box without a call', async () => {
    const bus = setup(() => ({ before: 'a\nb', after: 'a\nnew\nb' }));
    await screen.findByRole('region', { name: 'Changes in a.ts' });
    const line = document.querySelector<HTMLElement>('[class*="added"][data-row]');
    if (line === null) throw new Error('no added row');
    line.focus();
    fireEvent.keyDown(line, { key: 'c' });
    const box = await screen.findByRole('textbox', { name: /Comment on line/ });
    fireEvent.keyDown(box, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('textbox', { name: /Comment on line/ })).toBeNull());
    expect(bus.payloadsOf(reviewChannels.addComment)).toHaveLength(0);
  });

  it('REV-22 twelve unchanged lines fold into one row that shows them when pressed', async () => {
    const middle = Array.from({ length: 12 }, (_, index) => `same ${index}`).join('\n');
    setup(() => ({ before: `A\n${middle}\nZ`, after: `a\n${middle}\nz` }));
    const fold = await screen.findByRole('button', { name: '⋯ 12 unchanged lines' });
    expect(screen.queryByText('same 0')).toBeNull();
    await userEvent.click(fold);
    expect(screen.getByText('same 0')).toBeTruthy();
    expect(screen.getByText('same 11')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /unchanged lines/ })).toBeNull();
  });

  it('REV-22 F7 moves the cursor to the first changed row', async () => {
    setup(() => ({ before: numbered(40), after: numbered(40, { 30: 'changed 30' }) }));
    const diff = await screen.findByRole('region', { name: 'Changes in a.ts' });
    diff.focus();
    fireEvent.keyDown(diff, { key: 'F7' });
    const focused = document.activeElement;
    expect(focused?.getAttribute('data-row')).not.toBeNull();
    expect(focused?.textContent).toContain('line 30');
  });

  it('REV-25 a binary file shows "Binary file changed."', async () => {
    setup(() => ({ before: null, after: null, isBinary: true }));
    expect(await screen.findByText('Binary file changed.')).toBeTruthy();
  });

  it('state shows "No differences." for identical sides', async () => {
    setup(() => ({ before: 'same\ntext', after: 'same\ntext' }));
    expect(await screen.findByText('No differences.')).toBeTruthy();
  });
});
