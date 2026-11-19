/**
 * The graphology side of the graph view. The graphology typings need `graphology-types`, a peer that is not in
 * the lockfile, so the methods the view uses are declared here and the packages are cast once, in this file.
 */
import GraphClass from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import louvain from 'graphology-communities-louvain';

export type CanvasGraph = {
  addNode(id: string, attributes: Record<string, unknown>): void;
  addEdge(source: string, target: string, attributes: Record<string, unknown>): void;
  hasNode(id: string): boolean;
  hasEdge(source: string, target: string): boolean;
  getNodeAttribute(id: string, name: string): unknown;
  getNodeAttributes(id: string): Record<string, unknown>;
  setNodeAttribute(id: string, name: string, value: unknown): void;
  forEachNode(callback: (id: string, attributes: Record<string, unknown>) => void): void;
  neighbors(id: string): string[];
  extremities(edge: string): [string, string];
};

/** An empty undirected graph for the view. */
export function newCanvasGraph(): CanvasGraph {
  const Constructor = GraphClass as unknown as new (options: {
    type: 'undirected';
    multi: false;
  }) => CanvasGraph;
  return new Constructor({ type: 'undirected', multi: false });
}

/** ForceAtlas2, run to the end synchronously (GRAPH-20 allows up to 4 seconds; 200 iterations is well under). */
export function layoutCanvas(graph: CanvasGraph, iterations: number): void {
  const layout = forceAtlas2 as unknown as {
    assign(graph: CanvasGraph, options: { iterations: number; settings: Record<string, number> }): void;
  };
  layout.assign(graph, { iterations, settings: { gravity: 1, scalingRatio: 10, slowDown: 2 } });
}

/** Louvain communities, stored on each node as `community` (GRAPH-21). */
export function communitiesOf(graph: CanvasGraph): void {
  (louvain as unknown as { assign(graph: CanvasGraph): void }).assign(graph);
}
