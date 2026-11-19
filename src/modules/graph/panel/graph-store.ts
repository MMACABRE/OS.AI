/** The graph index as the renderer reads it: nodes, edges and status, kept live by graph.graphChanged (GRAPH-6). */
import { create } from 'zustand';
import type { Bus } from '@hsos/contracts/bus';
import { graphChannels } from '@hsos/contracts/channels/graph';
import type { GraphEdge, GraphNode, IndexStatus } from '@hsos/contracts/channels/graph';
import { workspaceChannels } from '@hsos/contracts/channels/workspace';
import type { AbsPath } from '@hsos/contracts/ids';

export type GraphData = {
  readonly loaded: boolean;
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
  readonly status: IndexStatus | null;
  readonly error: string | null;
  /** The note last selected in the graph or the notes list; the local graph follows it (GRAPH-30). */
  readonly selectedPath: AbsPath | null;
  /** Counts up each time "Show What Claude Loads at Start" runs (GRAPH-43). */
  readonly agentRequest: number;
  select(path: AbsPath | null): void;
  requestAgentView(): void;
};

export const useGraphData = create<GraphData>((set) => ({
  loaded: false,
  nodes: [],
  edges: [],
  status: null,
  error: null,
  selectedPath: null,
  agentRequest: 0,
  select: (path) => set({ selectedPath: path }),
  requestAgentView: () => set((state) => ({ agentRequest: state.agentRequest + 1 })),
}));

/** Loads the open project's graph and keeps it current. Called once by the module's register (GRAPH-6). */
export function startGraphData(bus: Bus): void {
  const load = async () => {
    const project = await bus.call(workspaceChannels.getCurrentProject, {});
    if (!project.ok || project.value === null) {
      useGraphData.setState({ loaded: true, nodes: [], edges: [], error: null });
      return;
    }
    const graph = await bus.call(graphChannels.getGraph, { projectId: project.value.id });
    if (!graph.ok) {
      useGraphData.setState({ loaded: true, error: graph.error.message });
      return;
    }
    useGraphData.setState({ loaded: true, nodes: graph.value.nodes, edges: graph.value.edges, error: null });
  };
  bus.on(graphChannels.statusChanged, (status) => useGraphData.setState({ status }));
  bus.on(graphChannels.graphChanged, () => void load());
  bus.on(workspaceChannels.projectChanged, () => void load());
  void load();
}
