import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Tree } from '@hsos/ui-kit';
import type { TreeNode } from '@hsos/ui-kit';

afterEach(cleanup);

const nodes: TreeNode[] = [
  {
    id: 'src',
    text: 'src',
    children: [
      { id: 'src/a', text: 'a.ts', children: null },
      { id: 'src/b', text: 'b.ts', children: null },
    ],
  },
  { id: 'docs', text: 'docs', children: [] },
  { id: 'readme', text: 'README', children: null },
];

function setup(selectedId: string | null, expanded: string[]) {
  const spies = { onToggle: vi.fn(), onSelect: vi.fn(), onActivate: vi.fn() };
  render(
    <Tree
      nodes={nodes}
      expandedIds={new Set(expanded)}
      selectedId={selectedId}
      label="Files"
      renderLabel={(node) => <span>{node.text}</span>}
      {...spies}
    />,
  );
  return spies;
}

describe('UI-2 Tree keyboard', () => {
  it('UI-2 Right on a collapsed folder calls onToggle', async () => {
    const user = userEvent.setup();
    const spies = setup('src', []);
    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(spies.onToggle).toHaveBeenCalledWith('src');
    expect(spies.onSelect).not.toHaveBeenCalled();
  });

  it('UI-2 Right on an expanded folder selects its first child', async () => {
    const user = userEvent.setup();
    const spies = setup('src', ['src']);
    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(spies.onSelect).toHaveBeenCalledWith('src/a');
    expect(spies.onToggle).not.toHaveBeenCalled();
  });

  it('UI-2 Left on an expanded folder calls onToggle', async () => {
    const user = userEvent.setup();
    const spies = setup('src', ['src']);
    await user.tab();
    await user.keyboard('{ArrowLeft}');
    expect(spies.onToggle).toHaveBeenCalledWith('src');
  });

  it('UI-2 Left on a child selects its parent', async () => {
    const user = userEvent.setup();
    const spies = setup('src/b', ['src']);
    await user.tab();
    await user.keyboard('{ArrowLeft}');
    expect(spies.onSelect).toHaveBeenCalledWith('src');
    expect(spies.onToggle).not.toHaveBeenCalled();
  });

  it('UI-2 rows carry aria-level and aria-expanded', () => {
    setup(null, ['src']);
    const src = screen.getByRole('treeitem', { name: 'src' });
    expect(src.getAttribute('aria-level')).toBe('1');
    expect(src.getAttribute('aria-expanded')).toBe('true');
    const child = screen.getByRole('treeitem', { name: 'a.ts' });
    expect(child.getAttribute('aria-level')).toBe('2');
    expect(child.hasAttribute('aria-expanded')).toBe(false);
    const docs = screen.getByRole('treeitem', { name: 'docs' });
    expect(docs.getAttribute('aria-expanded')).toBe('false');
  });
});
