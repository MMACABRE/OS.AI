import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import type { Bus } from '@hsos/contracts/bus';
import { graphChannels } from '@hsos/contracts/channels/graph';
import type { GraphEdge, GraphNode, LinkRef } from '@hsos/contracts/channels/graph';
import type { AbsPath } from '@hsos/contracts/ids';
import type { Logger } from '@hsos/contracts/module';
import { kindToken } from './graph-model';
import { tokenValue } from './graph-colour';
import { useGraphData } from './graph-store';
import styles from './Graph.module.css';

/** The local graph has no saved state of its own: it follows the selected note (GRAPH-30). */
export const LocalGraphState = z.object({});
export type LocalGraphState = z.infer<typeof LocalGraphState>;
export const INITIAL_LOCAL_GRAPH_STATE: LocalGraphState = {};

/** Nodes within `depth` links of `start`, the start first (GRAPH-30). */
export function neighbourhood(start: string, depth: number, edges: readonly GraphEdge[]): string[] {
  const seen = new Set([start]);
  let frontier = [start];
  for (let level = 0; level < depth; level += 1) {
    const next: string[] = [];
    for (const edge of edges)
      for (const [from, to] of [
        [edge.source, edge.target],
        [edge.target, edge.source],
      ] as const)
        if (frontier.includes(from) && !seen.has(to)) {
          seen.add(to);
          next.push(to);
        }
    frontier = next;
  }
  return [...seen];
}

const RADIUS = 80;

/**
 * The side view `graph.local` (GRAPH-30, GRAPH-31): the selected note and its neighbours to the local depth,
 * then its backlinks. Activating a backlink opens the note at that line.
 */
export function createLocalGraph(deps: {
  readonly bus: Bus;
  readonly log: Logger;
  readonly depth: () => number;
  readonly open: (path: AbsPath, line: number | null) => void;
}) {
  return function LocalGraph() {
    const nodes = useGraphData((state) => state.nodes);
    const edges = useGraphData((state) => state.edges);
    const selectedPath = useGraphData((state) => state.selectedPath);
    const [links, setLinks] = useState<readonly LinkRef[]>([]);
    const current: GraphNode | undefined = nodes.find(
      (node) => node.path !== null && node.path === selectedPath,
    );

    useEffect(() => {
      if (selectedPath === null || current === undefined) {
        setLinks([]);
        return;
      }
      let alive = true;
      void deps.bus.call(graphChannels.backlinks, { path: selectedPath }).then((result) => {
        if (alive && result.ok) setLinks(result.value);
        else if (!result.ok)
          deps.log.log('warn', 'graph.backlinks_failed', { message: result.error.message });
      });
      return () => {
        alive = false;
      };
      // Only the selected path drives the list; the node is looked up from it.
    }, [selectedPath]);

    const drawn = useMemo(() => {
      if (current === undefined) return null;
      const ids = neighbourhood(current.id, deps.depth(), edges);
      const byId = new Map(nodes.map((node) => [node.id, node]));
      const ring = ids.filter((id) => id !== current.id);
      return {
        centre: current,
        spokes: ring.map((id, index) => {
          const angle = (index / Math.max(1, ring.length)) * Math.PI * 2 - Math.PI / 2;
          const node = byId.get(id);
          return {
            id,
            label: node?.label ?? id,
            kind: node?.kind ?? ('unresolved' as const),
            x: Math.cos(angle) * RADIUS,
            y: Math.sin(angle) * RADIUS,
          };
        }),
      };
    }, [current, edges, nodes]);

    if (drawn === null) return <p className={styles.message}>Open a markdown note to see its links.</p>;
    return (
      <div className={styles.local}>
        <svg
          className={styles.localSvg}
          viewBox="-120 -120 240 240"
          role="img"
          aria-label={`Local graph of ${drawn.centre.label}`}
        >
          {drawn.spokes.map((spoke) => (
            <line
              key={spoke.id}
              x1={0}
              y1={0}
              x2={spoke.x}
              y2={spoke.y}
              stroke={tokenValue('color.graph.edge')}
              strokeWidth={1}
            />
          ))}
          {drawn.spokes.map((spoke) => (
            <g key={`n-${spoke.id}`}>
              <circle cx={spoke.x} cy={spoke.y} r={6} fill={tokenValue(kindToken(spoke.kind))} />
              <text x={spoke.x} y={spoke.y + 16} textAnchor="middle" className={styles.localLabel}>
                {spoke.label}
              </text>
            </g>
          ))}
          <circle cx={0} cy={0} r={9} fill={tokenValue('color.accent')} />
          <text x={0} y={26} textAnchor="middle" className={styles.localLabel}>
            {drawn.centre.label}
          </text>
        </svg>
        <h3 className={styles.sectionHead}>Backlinks</h3>
        {links.length === 0 ? <p className={styles.muted}>No note links here yet.</p> : null}
        <ul className={styles.backlinks}>
          {links.map((link) => (
            <li key={`${link.from}:${link.line}`}>
              <button
                type="button"
                className={styles.backlink}
                onClick={() => deps.open(link.from, link.line)}
              >
                <span className={styles.cardTitle}>{link.fromLabel}</span>
                <span className={styles.muted}>{link.context}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  };
}
