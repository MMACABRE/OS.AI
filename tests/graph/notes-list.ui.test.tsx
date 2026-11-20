import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GraphNode } from '@hsos/contracts/channels/graph';
import { createNotesList } from '../../src/modules/graph/panel/NotesList';
import { useGraphData } from '../../src/modules/graph/panel/graph-store';

const ROOT = 'C:/hsos';
const A = ROOT + '/a.md';
const B = ROOT + '/notes/b.md';

function node(id: string, label: string, degree: number): GraphNode {
  return GraphNode.parse({
    id,
    kind: 'note',
    label,
    path: id,
    root: 'project',
    tags: [],
    modifiedAt: 1_000,
    degree,
    community: null,
    loadsAtStart: false,
    lineCount: 10,
  });
}

beforeEach(() => {
  useGraphData.setState({
    loaded: true,
    error: null,
    status: null,
    selectedPath: null,
    nodes: [node(A, 'a', 4), node(B, 'b', 1)],
    edges: [],
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('notes list (card 034)', () => {
  it('GRAPH-55 the tree shows a with count 4 and b under its notes folder, and opens nothing on its own', () => {
    const open = vi.fn();
    const NotesList = createNotesList(open);
    render(<NotesList />);
    const aRow = screen.getByRole('treeitem', { name: 'a' });
    expect(aRow.textContent).toBe('a4');
    expect(aRow.getAttribute('aria-level')).toBe('3');
    const folder = screen.getByRole('treeitem', { name: 'notes' });
    expect(folder.getAttribute('aria-level')).toBe('2');
    const bRow = screen.getByRole('treeitem', { name: 'b' });
    expect(bRow.getAttribute('aria-level')).toBe('3');
    expect(bRow.textContent).toBe('b1');
    expect(open).not.toHaveBeenCalled();
  });
});
