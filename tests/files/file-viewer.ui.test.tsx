import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FileContent } from '@hsos/contracts/channels/files';
import { filesChannels } from '@hsos/contracts/channels/files';
import { shellChannels } from '@hsos/contracts/channels/shell';
import type { AbsPath } from '@hsos/contracts/ids';
import { err, ok } from '@hsos/contracts/result';
import { ToastProvider } from '@hsos/ui-kit';
import { FileViewer } from '../../src/modules/files/panel/FileViewer';
import { editorIn, pressSave, typeAtEnd } from '../fakes/editor';
import { abs, otherContent, textContent } from '../fakes/fixtures';
import { createStubBus, never } from '../fakes/stub-bus';

afterEach(cleanup);

const A = abs('a.ts');

type Options = {
  readonly line?: number | null;
  readonly reads?: (() => FileContent)[];
  readonly path?: AbsPath;
};

/** A viewer whose `files.read` answers from `reads` in turn (the last answer repeats). */
function setup(first: FileContent, options: Options = {}) {
  const bus = createStubBus();
  const reads = [() => first, ...(options.reads ?? [])];
  let at = 0;
  bus.answer(filesChannels.read, () => {
    const answer = reads[Math.min(at, reads.length - 1)];
    at += 1;
    return ok((answer ?? (() => first))());
  });
  bus.answer(filesChannels.save, (request) => ok(textContent(request.path, request.content, 'b').version));
  bus.answer(shellChannels.revealInExplorer, () => ok({}));
  render(
    <ToastProvider>
      <FileViewer
        bus={bus}
        path={options.path ?? A}
        line={options.line ?? null}
        openHistory={vi.fn()}
        openLink={vi.fn()}
        markdownPreviewFirst={false}
      />
    </ToastProvider>,
  );
  return bus;
}

const docText = () => editorIn().state.doc.toString();
const changed = (kind: 'changed' | 'deleted') => ({ changes: [{ path: A, kind }] });

describe('file viewer (card 030)', () => {
  it('FILE-73 a clean viewer reloads silently when the file changes on disk', async () => {
    const bus = setup(textContent(A, 'one'), { reads: [() => textContent(A, 'two', 'b')] });
    await waitFor(() => expect(docText()).toBe('one'));
    act(() => bus.emit(filesChannels.changed, changed('changed')));
    await waitFor(() => expect(docText()).toBe('two'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('FILE-74 a dirty viewer shows the bar, keeps its text and saves nothing', async () => {
    const bus = setup(textContent(A, 'one'));
    await waitFor(() => expect(docText()).toBe('one'));
    act(() => typeAtEnd(editorIn(), ' x'));
    expect(docText()).toBe('one x');
    act(() => bus.emit(filesChannels.changed, changed('changed')));
    expect((await screen.findByRole('alert')).textContent).toContain('This file changed on disk.');
    expect(docText()).toBe('one x');
    expect(bus.payloadsOf(filesChannels.save)).toHaveLength(0);
  });

  it('FILE-74 Ctrl+S answered with FILE_CHANGED_ON_DISK keeps the bar and never overwrites', async () => {
    const bus = setup(textContent(A, 'one'));
    await waitFor(() => expect(docText()).toBe('one'));
    bus.answer(filesChannels.save, () => err('FILE_CHANGED_ON_DISK', 'Changed on disk'));
    act(() => typeAtEnd(editorIn(), ' x'));
    act(() => bus.emit(filesChannels.changed, changed('changed')));
    await screen.findByRole('alert');
    act(() => pressSave(editorIn()));
    await waitFor(() => expect(bus.payloadsOf(filesChannels.save)).toHaveLength(1));
    expect(screen.getByRole('alert').textContent).toContain('This file changed on disk.');
    expect(bus.payloadsOf(filesChannels.save).some((request) => request.overwrite)).toBe(false);
  });

  it('FILE-74 Overwrite saves with overwrite true and the editor text', async () => {
    const bus = setup(textContent(A, 'one'));
    await waitFor(() => expect(docText()).toBe('one'));
    act(() => typeAtEnd(editorIn(), ' x'));
    act(() => bus.emit(filesChannels.changed, changed('changed')));
    await userEvent.click(await screen.findByRole('button', { name: 'Overwrite' }));
    await waitFor(() => expect(bus.payloadsOf(filesChannels.save)).toHaveLength(1));
    expect(bus.payloadsOf(filesChannels.save)[0]).toMatchObject({
      overwrite: true,
      content: 'one x',
      path: A,
    });
  });

  it('FILE-72 Ctrl+S saves with the loaded hash and format and the new content', async () => {
    const bus = setup(textContent(A, 'one', 'c'));
    await waitFor(() => expect(docText()).toBe('one'));
    act(() => typeAtEnd(editorIn(), ' x'));
    act(() => pressSave(editorIn()));
    await waitFor(() => expect(bus.payloadsOf(filesChannels.save)).toHaveLength(1));
    expect(bus.payloadsOf(filesChannels.save)[0]).toEqual({
      path: A,
      content: 'one x',
      format: { encoding: 'utf8', eol: 'lf' },
      baseHash: 'c'.repeat(64),
      overwrite: false,
    });
  });

  it('FILE-75 a deleted file shows the bar with Save to recreate and keeps the text', async () => {
    const bus = setup(textContent(A, 'one'));
    await waitFor(() => expect(docText()).toBe('one'));
    act(() => bus.emit(filesChannels.changed, changed('deleted')));
    const bar = await screen.findByRole('alert');
    expect(bar.textContent).toContain('This file was deleted.');
    expect(screen.getByRole('button', { name: 'Save to recreate' })).toBeTruthy();
    expect(docText()).toBe('one');
  });

  it('FILE-78 a viewer opened with line 3 puts the caret at the start of line 3', async () => {
    setup(textContent(A, 'l1\nl2\nl3\nl4\nl5'), { line: 3 });
    await waitFor(() => expect(editorIn().state.selection.main.head).toBe('l1\nl2\n'.length));
  });

  it('FILE-70 a binary file says it is not text and can be revealed in Explorer', async () => {
    const bus = setup(otherContent(A, 'binary'));
    expect(await screen.findByText('This file is not text.')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Reveal in Explorer' }));
    expect(bus.payloadsOf(shellChannels.revealInExplorer)).toEqual([{ path: A }]);
  });

  it('FILE-70 a too-large file says so and shows its size', async () => {
    setup(otherContent(A, 'too-large', 8_400_000));
    expect(await screen.findByText('This file is too large to edit here.')).toBeTruthy();
    expect(screen.getByText('8.4 MB')).toBeTruthy();
  });

  it('state shows "Opening a.ts" while the file is read', async () => {
    const bus = createStubBus();
    bus.answer(filesChannels.read, () => never());
    render(
      <ToastProvider>
        <FileViewer
          bus={bus}
          path={A}
          line={null}
          openHistory={vi.fn()}
          openLink={vi.fn()}
          markdownPreviewFirst={false}
        />
      </ToastProvider>,
    );
    expect(await screen.findByRole('status', { name: 'Opening a.ts' }, { timeout: 2000 })).toBeTruthy();
    expect(screen.getByText('Opening a.ts')).toBeTruthy();
  });

  it('state shows the failure with Retry, and Retry reads again', async () => {
    const bus = createStubBus();
    bus.answer(filesChannels.read, () => err('FILE_NOT_FOUND', 'It is gone'));
    render(
      <ToastProvider>
        <FileViewer
          bus={bus}
          path={A}
          line={null}
          openHistory={vi.fn()}
          openLink={vi.fn()}
          markdownPreviewFirst={false}
        />
      </ToastProvider>,
    );
    expect(await screen.findByText('This file could not be opened. It is gone')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(bus.payloadsOf(filesChannels.read)).toHaveLength(2));
  });

  it('state shows an empty text file as a normal empty editor', async () => {
    setup(textContent(A, ''));
    await waitFor(() => expect(docText()).toBe(''));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/could not be opened/)).toBeNull();
  });
});
