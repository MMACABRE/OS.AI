import { useId, useMemo } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { staggerStyle, useEntering } from '../motion/motion';
import { cx } from './cx';
import styles from './Tree.module.css';
import { useTypeAhead, useVirtualRows } from './virtual-rows';

/** A tree node; `children` null means a leaf, an array (even empty) means it can expand. */
export type TreeNode = {
  readonly id: string;
  readonly text: string;
  readonly children: readonly TreeNode[] | null;
};

type FlatNode = { readonly node: TreeNode; readonly depth: number; readonly parentId: string | null };

export type TreeProps = {
  readonly nodes: readonly TreeNode[];
  readonly expandedIds: ReadonlySet<string>;
  readonly onToggle: (id: string) => void;
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
  readonly onActivate: (id: string) => void;
  readonly renderLabel: (
    node: TreeNode,
    state: { readonly selected: boolean; readonly expanded: boolean },
  ) => ReactNode;
  /** Pixels; defaults to 26 (`size.row`). */
  readonly rowHeight?: number;
  readonly label: string;
};

function flatten(nodes: readonly TreeNode[], expanded: ReadonlySet<string>): FlatNode[] {
  const out: FlatNode[] = [];
  const walk = (list: readonly TreeNode[], depth: number, parentId: string | null) => {
    for (const node of list) {
      out.push({ node, depth, parentId });
      if (node.children !== null && expanded.has(node.id)) walk(node.children, depth + 1, node.id);
    }
  };
  walk(nodes, 0, null);
  return out;
}

/**
 * A keyboard tree: Up and Down move, Right expands or enters, Left collapses or goes to the parent,
 * Enter activates (and toggles a folder), letters jump by type-ahead. Virtualised above 200 visible rows (UI-7).
 */
export function Tree({
  nodes,
  expandedIds,
  onToggle,
  selectedId,
  onSelect,
  onActivate,
  renderLabel,
  rowHeight = 26,
  label,
}: TreeProps) {
  const baseId = useId();
  const flat = useMemo(() => flatten(nodes, expandedIds), [nodes, expandedIds]);
  const virtual = useVirtualRows(flat.length, rowHeight);
  const entering = useEntering();
  const selectedIndex = flat.findIndex((item) => item.node.id === selectedId);
  const choose = (index: number) => {
    const item = flat[Math.min(flat.length - 1, Math.max(0, index))];
    if (item === undefined) return;
    onSelect(item.node.id);
    virtual.scrollToIndex(flat.indexOf(item));
  };
  const typeAhead = useTypeAhead(() => flat.map((item) => item.node.text), selectedIndex, choose);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = flat[selectedIndex];
    const isFolder = current?.node.children !== null && current !== undefined;
    const expanded = current !== undefined && expandedIds.has(current.node.id);
    let handled = true;
    if (event.key === 'ArrowDown') choose(selectedIndex + 1);
    else if (event.key === 'ArrowUp') choose(selectedIndex < 0 ? 0 : selectedIndex - 1);
    else if (event.key === 'Home') choose(0);
    else if (event.key === 'End') choose(flat.length - 1);
    else if (event.key === 'ArrowRight' && current !== undefined) {
      if (isFolder && !expanded) onToggle(current.node.id);
      else if (isFolder && expanded) choose(selectedIndex + 1);
    } else if (event.key === 'ArrowLeft' && current !== undefined) {
      if (isFolder && expanded) onToggle(current.node.id);
      else if (current.parentId !== null) choose(flat.findIndex((item) => item.node.id === current.parentId));
    } else if (event.key === 'Enter' && current !== undefined) {
      if (isFolder) onToggle(current.node.id);
      onActivate(current.node.id);
    } else handled = !event.ctrlKey && !event.altKey && !event.metaKey && typeAhead(event.key);
    if (handled) event.preventDefault();
  };

  return (
    <div
      ref={virtual.containerRef}
      className={styles.tree}
      role="tree"
      tabIndex={0}
      aria-label={label}
      aria-activedescendant={selectedIndex >= 0 ? `${baseId}-${selectedIndex}` : undefined}
      onKeyDown={onKeyDown}
      onScroll={virtual.onScroll}
    >
      <div className={styles.inner} style={{ height: virtual.totalHeight }}>
        {flat.slice(virtual.start, virtual.end).map((item, offset) => {
          const index = virtual.start + offset;
          const selected = item.node.id === selectedId;
          const isFolder = item.node.children !== null;
          const expanded = isFolder && expandedIds.has(item.node.id);
          return (
            <div
              key={item.node.id}
              id={`${baseId}-${index}`}
              role="treeitem"
              aria-level={item.depth + 1}
              aria-selected={selected}
              aria-expanded={isFolder ? expanded : undefined}
              aria-label={item.node.text}
              className={cx(styles.row, entering && styles.rowEnter, selected && styles.selected)}
              style={{
                ...(entering ? staggerStyle(offset) : {}),
                top: index * rowHeight,
                height: rowHeight,
                paddingLeft: `${0.5 + item.depth * 0.875}rem`,
              }}
              onClick={() => {
                onSelect(item.node.id);
                if (isFolder) onToggle(item.node.id);
              }}
              onDoubleClick={() => onActivate(item.node.id)}
            >
              <span className={cx(styles.twisty, expanded && styles.open)} aria-hidden="true">
                {isFolder ? '›' : ''}
              </span>
              {renderLabel(item.node, { selected, expanded })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
