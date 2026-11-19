import { z } from 'zod';
import type { WidgetType } from '@hsos/contracts/channels/dashboard';
import { EmptyState } from '@hsos/ui-kit';
import { neighbourhood } from '../LocalGraph';
import { tokenValue } from '../graph-colour';
import { kindToken } from '../graph-model';
import { useGraphData } from '../graph-store';
import styles from './MiniGraph.module.css';

const RADIUS = 80;

/** The `graph.mini` widget (dashboard.md catalog): the local graph around the last opened note. Drawn as a still SVG. */
function MiniGraph() {
  const nodes = useGraphData((state) => state.nodes);
  const edges = useGraphData((state) => state.edges);
  const selectedPath = useGraphData((state) => state.selectedPath);
  const centre =
    nodes.find((node) => node.path !== null && node.path === selectedPath) ??
    nodes.find((node) => node.kind === 'claudeMd') ??
    nodes[0];
  if (centre === undefined) return <EmptyState message="No notes yet." />;
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const ring = neighbourhood(centre.id, 1, edges).filter((id) => id !== centre.id);
  return (
    <svg
      className={styles.svg}
      viewBox="-120 -120 240 240"
      role="img"
      aria-label={`Local graph of ${centre.label}`}
    >
      {ring.map((id, index) => {
        const angle = (index / Math.max(1, ring.length)) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(angle) * RADIUS;
        const y = Math.sin(angle) * RADIUS;
        const node = byId.get(id);
        return (
          <g key={id}>
            <line x1={0} y1={0} x2={x} y2={y} stroke={tokenValue('color.graph.edge')} strokeWidth={1} />
            <circle cx={x} cy={y} r={6} fill={tokenValue(kindToken(node?.kind ?? 'note'))} />
          </g>
        );
      })}
      <circle cx={0} cy={0} r={9} fill={tokenValue('color.accent')} />
    </svg>
  );
}

/**
 * The `graph.mini` widget type. Activating it opens the graph view (MOT-6 shared-element move is not built).
 */
export function miniGraphType(openGraph: () => void): WidgetType {
  const Component = () => <MiniGraph />;
  return {
    id: 'graph.mini',
    title: 'Mini graph',
    moduleId: 'graph',
    minSize: { w: 2, h: 2 },
    maxSize: { w: 8, h: 6 },
    defaultSize: { w: 2, h: 3 },
    frame: 'free',
    configSchema: z.unknown(),
    defaultConfig: null,
    component: Component as unknown as WidgetType['component'],
    activate: () => openGraph(),
  };
}
