import { useMemo, useState } from 'react';
import { z } from 'zod';
import type { GraphNode } from '@hsos/contracts/channels/graph';
import type { AbsPath } from '@hsos/contracts/ids';
import { EmptyState, Tree, TextField } from '@hsos/ui-kit';
import type { TreeNode } from '@hsos/ui-kit';
import { ROOT_LABEL, folderName, searchMatches } from './graph-model';
import { useGraphData } from './graph-store';
import styles from './Graph.module.css';

/** The notes list keeps only its open folders (GRAPH-55); it has no saved state of its own. */
export const NotesListState = z.object({});
export type NotesListState = z.infer<typeof NotesListState>;
export const INITIAL_NOTES_LIST_STATE: NotesListState = {};

type Group = { readonly root: GraphNode['root']; readonly folders: Map<string, GraphNode[]> };

/** The notes tree: root, then folder, then note, each note with its link count (GRAPH-55). */
function buildTree(nodes: readonly GraphNode[]): TreeNode[] {
  const roots = new Map<GraphNode['root'], Group>();
  for (const node of nodes) {
    if (node.path === null) continue;
    const group = roots.get(node.root) ?? { root: node.root, folders: new Map<string, GraphNode[]>() };
    const folder = folderName(node.path);
    group.folders.set(folder, [...(group.folders.get(folder) ?? []), node]);
    roots.set(node.root, group);
  }
  return [...roots.values()].map((group) => ({
    id: `root:${group.root}`,
    text: ROOT_LABEL[group.root],
    children: [...group.folders.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([folder, files]) => ({
        id: `folder:${group.root}:${folder}`,
        text: folder === '' ? 'Top level' : folder,
        children: [...files]
          .sort((a, b) => a.label.localeCompare(b.label))
          .map((file) => ({ id: file.id, text: file.label, children: null })),
      })),
  }));
}

/**
 * The notes list (`graph.notes`), the Notes page's side view. It reads only the index, never the disk (P-4).
 * Activating a note opens it in the notes dock (WS-43).
 */
export function createNotesList(open: (path: AbsPath) => void) {
  return function NotesList() {
    const nodes = useGraphData((state) => state.nodes);
    const loaded = useGraphData((state) => state.loaded);
    const selectedPath = useGraphData((state) => state.selectedPath);
    const select = useGraphData((state) => state.select);
    const [query, setQuery] = useState('');
    const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
    const filtered = useMemo(() => {
      if (query.trim() === '') return nodes;
      const matches = searchMatches(nodes, query);
      return nodes.filter((node) => matches.has(node.id));
    }, [nodes, query]);
    const tree = useMemo(() => buildTree(filtered), [filtered]);
    const degrees = useMemo(() => new Map(nodes.map((node) => [node.id, node.degree])), [nodes]);
    const selectedId = nodes.find((node) => node.path !== null && node.path === selectedPath)?.id ?? null;
    const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
    const toggle = (id: string) =>
      setCollapsed((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    // Every root and folder starts open; the list remembers only the ones the owner closed.
    const expanded = useMemo(
      () =>
        new Set(
          tree
            .flatMap((root) => [root.id, ...(root.children ?? []).map((child) => child.id)])
            .filter((id) => !collapsed.has(id)),
        ),
      [tree, collapsed],
    );
    const openNode = (id: string) => {
      const node = nodeById.get(id);
      if (node?.path) {
        select(node.path);
        open(node.path);
      }
    };

    if (!loaded) return <p className={styles.message}>Loading notes…</p>;
    if (nodes.length === 0)
      return <EmptyState title="No notes yet." message="Notes in this project and your vault appear here." />;
    return (
      <div className={styles.notesList}>
        <TextField label="Search notes" placeholder="Search notes" value={query} onChange={setQuery} />
        <Tree
          nodes={tree}
          expandedIds={expanded}
          onToggle={toggle}
          selectedId={selectedId}
          onSelect={(id) => {
            const node = nodeById.get(id);
            if (node?.path) select(node.path);
          }}
          onActivate={(id) => {
            if (nodeById.has(id)) openNode(id);
            else toggle(id);
          }}
          renderLabel={(node) => (
            <span className={styles.noteRow}>
              <span>{node.text}</span>
              {degrees.has(node.id) ? <span className={styles.count}>{degrees.get(node.id)}</span> : null}
            </span>
          )}
          label="Notes"
        />
      </div>
    );
  };
}
