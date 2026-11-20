import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { CodeView, DiffView, List, MarkdownView, Tree } from '@hsos/ui-kit';
import { editorIn } from '../fakes/editor';

afterEach(cleanup);

beforeAll(() => {
  // jsdom has no layout, so it has no scrollIntoView.
  Element.prototype.scrollIntoView = vi.fn();
});

/** Makes `scrollTop` a plain stored value on one element, since jsdom does not scroll. */
function storeScrollTop(element: Element, initial: number): void {
  let value = initial;
  Object.defineProperty(element, 'scrollTop', {
    configurable: true,
    get: () => value,
    set: (next: number) => (value = next),
  });
}

describe('MarkdownView (ui-kit)', () => {
  it('UI-5 raw html in the source is shown as text and makes no element', () => {
    const { container } = render(
      <MarkdownView source="<img src=x onerror=alert(1)>" onLinkActivate={vi.fn()} />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('UI-5b a javascript: link never reaches onLinkActivate, a relative one does', () => {
    const onLinkActivate = vi.fn();
    render(
      <MarkdownView
        source={'[x](javascript:alert(1)) and [y](notes/a.md)'}
        onLinkActivate={onLinkActivate}
      />,
    );
    fireEvent.click(screen.getByText('x'));
    for (const call of onLinkActivate.mock.calls) expect(String(call[0])).not.toMatch(/^javascript:/i);
    fireEvent.click(screen.getByText('y'));
    expect(onLinkActivate).toHaveBeenCalledWith('notes/a.md');
  });
});

describe('DiffView (ui-kit)', () => {
  const numbered = (count: number) => Array.from({ length: count }, (_, index) => `line ${index + 1}`);

  it('REV-20 keeps the same element and its scroll position when the text changes', () => {
    const before = numbered(300).join('\n');
    const afterText = (lines: string[]) => lines.join('\n');
    const first = numbered(300);
    first[150] = 'changed 151';
    const view = render(<DiffView before={before} after={afterText(first)} />);
    const region = screen.getByRole('region', { name: 'Diff' });
    storeScrollTop(region, 400);
    const second = ['new 1', 'new 2', 'new 3', ...first];
    view.rerender(<DiffView before={before} after={afterText(second)} />);
    expect(screen.getByRole('region', { name: 'Diff' })).toBe(region);
    expect(region.scrollTop).toBe(400);
  });

  /** Lines a1..a7, with b, d and f added: three one-row changes. */
  const threeAdditions = () => ({
    before: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'].join('\n'),
    after: ['a1', 'b', 'a2', 'a3', 'd', 'a4', 'a5', 'f', 'a6', 'a7'].join('\n'),
  });
  const activeRow = () => document.activeElement?.closest('[data-row]')?.textContent ?? '(no row focused)';

  it('REV-21 F7 moves to the next change and Shift+F7 to the previous one', () => {
    render(<DiffView {...threeAdditions()} />);
    const region = screen.getByRole('region', { name: 'Diff' });
    region.focus();
    const press = (shiftKey: boolean) =>
      fireEvent.keyDown(document.activeElement ?? region, { key: 'F7', shiftKey });
    press(false);
    expect(activeRow()).toMatch(/\+b$/);
    press(false);
    expect(activeRow()).toMatch(/\+d$/);
    press(false);
    expect(activeRow()).toMatch(/\+f$/);
    press(true);
    expect(activeRow()).toMatch(/\+d$/);
  });

  it('REV-21 F7 treats a replaced line (removed plus added) as one change', () => {
    const before = ['a1', 'b', 'a2', 'a3', 'd', 'a4', 'a5', 'f', 'a6'].join('\n');
    const after = ['a1', 'B', 'a2', 'a3', 'D', 'a4', 'a5', 'F', 'a6'].join('\n');
    render(<DiffView before={before} after={after} />);
    const region = screen.getByRole('region', { name: 'Diff' });
    region.focus();
    const press = (shiftKey: boolean) => fireEvent.keyDown(document.activeElement ?? region, { key: 'F7', shiftKey });
    press(false);
    expect(activeRow()).toMatch(/b$/);
    press(false);
    expect(activeRow()).toMatch(/d$/);
    press(false);
    expect(activeRow()).toMatch(/f$/);
    press(true);
    expect(activeRow()).toMatch(/d$/);
  });

  it('REV-23 C on a focused added line runs onLineAction with that row, Ctrl+C does nothing', () => {
    const onLineAction = vi.fn();
    render(<DiffView before={'a\nb'} after={'a\nnew\nb'} onLineAction={onLineAction} />);
    const added = document.querySelector<HTMLElement>('[class*="added"][data-row]');
    expect(added).not.toBeNull();
    if (added === null) return;
    added.focus();
    fireEvent.keyDown(added, { key: 'c', ctrlKey: true });
    expect(onLineAction).not.toHaveBeenCalled();
    fireEvent.keyDown(added, { key: 'c' });
    expect(onLineAction).toHaveBeenCalledTimes(1);
    expect(onLineAction).toHaveBeenCalledWith({ kind: 'added', text: 'new', before: null, after: 2 });
  });
});

describe('CodeView (ui-kit)', () => {
  const lines = Array.from({ length: 100 }, (_, index) => `row ${index + 1}`);

  it('FILE-73 a new value keeps the cursor line and the scroll', () => {
    const view = render(<CodeView value={lines.join('\n')} language="ts" readOnly={false} label="Edit" />);
    const editor = editorIn(view.container);
    const line40 = editor.state.doc.line(40);
    act(() => editor.dispatch({ selection: { anchor: line40.from } }));
    storeScrollTop(editor.scrollDOM, 300);
    const changed = [...lines];
    changed[0] = 'first line changed';
    view.rerender(<CodeView value={changed.join('\n')} language="ts" readOnly={false} label="Edit" />);
    expect(editor.state.doc.lineAt(editor.state.selection.main.head).number).toBe(40);
    expect(editor.state.doc.line(1).text).toBe('first line changed');
    expect(editor.scrollDOM.scrollTop).toBe(300);
  });

  it('FILE-72 Ctrl+S runs onSave once and the browser save is prevented', () => {
    const onSave = vi.fn();
    const view = render(<CodeView value="x" language="ts" readOnly={false} onSave={onSave} label="Edit" />);
    const editor = editorIn(view.container);
    const event = new KeyboardEvent('keydown', {
      key: 's',
      code: 'KeyS',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      editor.contentDOM.dispatchEvent(event);
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });
});

describe('Tree and List right click (ui-kit)', () => {
  it('UI-LIST-1 a right click on a tree row selects it', () => {
    const onSelect = vi.fn();
    render(
      <Tree
        nodes={[
          { id: 'a', text: 'a', children: null },
          { id: 'b', text: 'b', children: null },
        ]}
        expandedIds={new Set()}
        onToggle={vi.fn()}
        selectedId="a"
        onSelect={onSelect}
        onActivate={vi.fn()}
        renderLabel={(node) => <span>{node.text}</span>}
        label="Things"
      />,
    );
    fireEvent.contextMenu(screen.getByRole('treeitem', { name: 'b' }));
    expect(onSelect).toHaveBeenCalledWith('b');
  });

  it('UI-LIST-2 a right click on a list row selects it', () => {
    const onSelect = vi.fn();
    render(
      <List
        rows={[
          { id: 'a', text: 'a' },
          { id: 'b', text: 'b' },
        ]}
        rowHeight={24}
        renderRow={(row) => <span>{row.text}</span>}
        selectedId="a"
        onSelect={onSelect}
        onActivate={vi.fn()}
        label="Things"
      />,
    );
    fireEvent.contextMenu(screen.getByRole('option', { name: 'b' }));
    expect(onSelect).toHaveBeenCalledWith('b');
  });
});
