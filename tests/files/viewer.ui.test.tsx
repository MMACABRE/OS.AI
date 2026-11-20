import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FileContent } from '@hsos/contracts/channels/files';
import { filesChannels } from '@hsos/contracts/channels/files';
import { shellChannels } from '@hsos/contracts/channels/shell';
import { toAbsPath } from '@hsos/contracts/ids';
import type { AbsPath } from '@hsos/contracts/ids';
import { ok } from '@hsos/contracts/result';
import { ToastProvider } from '@hsos/ui-kit';
import { FileViewer } from '../../src/modules/files/panel/FileViewer';
import { register } from '../../src/modules/files/register.ui';
import { editorIn, pressSave, typeAtEnd } from '../fakes/editor';
import { createFakeUiContext } from '../fakes/fake-ui-context';
import { abs, textContent } from '../fakes/fixtures';
import { createStubBus, never } from '../fakes/stub-bus';

afterEach(cleanup);

const A = abs('a.ts');
const NOTE = abs('notes.md');

function setup(
  path: AbsPath,
  first: FileContent,
  options: { readonly markdownPreviewFirst?: boolean; readonly reads?: FileContent[] } = {},
) {
  const bus = createStubBus();
  const reads = [first, ...(options.reads ?? [])];
  let at = 0;
  bus.answer(filesChannels.read, () => {
    const answer = reads[Math.min(at, reads.length - 1)] ?? first;
    at += 1;
    return ok(answer);
  });
  bus.answer(filesChannels.save, (request) => ok(textContent(request.path, request.content, 'b').version));
  render(
    <ToastProvider>
      <FileViewer
        bus={bus}
        path={path}
        line={null}
        openHistory={vi.fn()}
        openLink={vi.fn()}
        markdownPreviewFirst={options.markdownPreviewFirst ?? false}
      />
    </ToastProvider>,
  );
  return bus;
}

describe('viewer, lead fixes after the lane B merge (card 030)', () => {
  it('FILE-70 a markdown file opens in preview when markdownPreviewFirst is on, and Ctrl+Shift+V shows the source', async () => {
    setup(NOTE, textContent(NOTE, '# Plan title\n\nbody'), { markdownPreviewFirst: true });
    const heading = await screen.findByRole('heading', { name: 'Plan title' });
    expect(document.querySelector('.cm-editor')).toBeNull();
    fireEvent.keyDown(heading, { key: 'V', ctrlKey: true, shiftKey: true });
    await waitFor(() => expect(editorIn().state.doc.toString()).toBe('# Plan title\n\nbody'));
  });

  it('FILE-70 a markdown file opens as source when markdownPreviewFirst is off', async () => {
    setup(NOTE, textContent(NOTE, '# Plan title'), { markdownPreviewFirst: false });
    await waitFor(() => expect(editorIn().state.doc.toString()).toBe('# Plan title'));
    expect(screen.queryByRole('heading', { name: 'Plan title' })).toBeNull();
  });

  it('FILE-74 Compare shows a diff of disk against the buffer and nothing is saved', async () => {
    const bus = setup(A, textContent(A, 'one'), { reads: [textContent(A, 'disk side', 'b')] });
    await waitFor(() => expect(editorIn().state.doc.toString()).toBe('one'));
    act(() => typeAtEnd(editorIn(), ' x'));
    act(() => bus.emit(filesChannels.changed, { changes: [{ path: A, kind: 'changed' }] }));
    await userEvent.click(await screen.findByRole('button', { name: 'Compare' }));
    const diff = await screen.findByRole('region', { name: 'a.ts on disk against your changes' });
    expect(diff.textContent).toContain('disk side');
    expect(diff.textContent).toContain('one x');
    expect(bus.payloadsOf(filesChannels.save)).toHaveLength(0);
  });

  it('FILE-72 pressing Ctrl+S twice quickly sends one files.save', async () => {
    const bus = setup(A, textContent(A, 'one'));
    await waitFor(() => expect(editorIn().state.doc.toString()).toBe('one'));
    bus.answer(filesChannels.save, () => never());
    act(() => typeAtEnd(editorIn(), ' x'));
    act(() => pressSave(editorIn()));
    act(() => pressSave(editorIn()));
    expect(bus.payloadsOf(filesChannels.save)).toHaveLength(1);
  });

  it('FILE-79 a relative link opens the file next to it, an https link goes to shell.openExternal', async () => {
    const from = toAbsPath('C:\\p\\docs\\a.md');
    const bus = createStubBus();
    bus.answer(filesChannels.read, () =>
      ok(textContent(from, '[up](../b.md) and [web](https://example.com/x)')),
    );
    bus.answer(shellChannels.openExternal, () => ok({}));
    const ctx = createFakeUiContext('files', bus);
    register(ctx);
    const Viewer = ctx.panel('files.viewer').component;
    render(
      <ToastProvider>
        <Viewer
          panelId={'p'.repeat(12) as never}
          state={{ path: from, line: null } as never}
          setState={() => undefined}
          isFocused
        />
      </ToastProvider>,
    );
    fireEvent.click(await screen.findByRole('link', { name: 'up' }));
    expect(ctx.opened).toEqual([
      { type: 'files.viewer', state: { path: toAbsPath('C:\\p\\b.md'), line: null } },
    ]);
    fireEvent.click(screen.getByRole('link', { name: 'web' }));
    expect(bus.payloadsOf(shellChannels.openExternal)).toEqual([{ url: 'https://example.com/x' }]);
  });
});
