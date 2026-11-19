/** Pure rules of the graph panels: colours, sizes, agent reach and the notes tree (GRAPH-21, GRAPH-41 to GRAPH-43). */
import type { GraphEdge, GraphNode, NodeKind } from '@hsos/contracts/channels/graph';
import type { TokenName } from '@hsos/contracts/theme';

/** A Claude file over this many lines gets a badge (GRAPH-42). */
export const LINE_LIMIT = 200;
/** Labels show for this many of the largest nodes (GRAPH-22). */
export const LABELLED_NODES = 30;
/** "Changed in last 24 hours" window (GRAPH-26). */
export const RECENT_MS = 24 * 60 * 60 * 1000;
/** Preview lines on the hover card (GRAPH-44). */
export const PREVIEW_LINES = 12;

const KIND_TOKEN: Readonly<Record<NodeKind, TokenName>> = {
  note: 'color.graph.node.note',
  claudeMd: 'color.graph.node.claudeMd',
  skill: 'color.graph.node.skill',
  memory: 'color.graph.node.memory',
  unresolved: 'color.graph.node.unresolved',
};

/** The colour token of a node kind (visual-direction.md "Colour jobs"). */
export const kindToken = (kind: NodeKind): TokenName => KIND_TOKEN[kind];

/** The eight hues of "Colour by community" (GRAPH-21), all state or job colours. */
export const COMMUNITY_TOKENS: readonly TokenName[] = [
  'color.live',
  'color.knowledge',
  'color.accent',
  'color.state.ok',
  'color.structure',
  'color.memory',
  'color.brand',
  'color.state.info',
];

/** Node radius: 3 + 1.5 × √degree, at most 14 (GRAPH-21). */
export const nodeRadius = (degree: number): number => Math.min(14, 3 + 1.5 * Math.sqrt(degree));

/** Nodes whose file was modified in the last 24 hours (GRAPH-26). */
export const isRecent = (node: GraphNode, now: number): boolean =>
  node.modifiedAt !== null && now - node.modifiedAt <= RECENT_MS;

/** The labels of nodes that are the largest by degree, as a set of ids (GRAPH-22). */
export function largestNodes(nodes: readonly GraphNode[]): ReadonlySet<string> {
  const sorted = [...nodes].sort((a, b) => b.degree - a.degree || a.label.localeCompare(b.label));
  return new Set(sorted.slice(0, LABELLED_NODES).map((node) => node.id));
}

/** Ids of nodes whose label, path or tags contain the query, ignoring case. Empty query: none. */
export function searchMatches(nodes: readonly GraphNode[], query: string): ReadonlySet<string> {
  const needle = query.trim().toLowerCase();
  if (needle === '') return new Set();
  return new Set(
    nodes
      .filter(
        (node) =>
          node.label.toLowerCase().includes(needle) ||
          (node.path ?? '').toLowerCase().includes(needle) ||
          node.tags.some((tag) => tag.toLowerCase().includes(needle)),
      )
      .map((node) => node.id),
  );
}

/** Where agents reach each note: hops from the start files along edges (GRAPH-43). Start files are hop 0. */
export type AgentReach = {
  readonly hops: ReadonlyMap<string, number>;
  readonly parent: ReadonlyMap<string, string>;
};

export function agentReach(nodes: readonly GraphNode[], edges: readonly GraphEdge[]): AgentReach {
  const out = new Map<string, string[]>();
  for (const edge of edges) out.set(edge.source, [...(out.get(edge.source) ?? []), edge.target]);
  const hops = new Map<string, number>();
  const parent = new Map<string, string>();
  const queue: string[] = [];
  for (const node of nodes)
    if (node.loadsAtStart) {
      hops.set(node.id, 0);
      queue.push(node.id);
    }
  for (let index = 0; index < queue.length; index += 1) {
    const id = queue[index] ?? '';
    const depth = hops.get(id) ?? 0;
    for (const next of out.get(id) ?? [])
      if (!hops.has(next)) {
        hops.set(next, depth + 1);
        parent.set(next, id);
        queue.push(next);
      }
  }
  return { hops, parent };
}

/** The shortest chain of ids from a start file to `id`, start first (GRAPH-43 "How an agent gets here"). */
export function chainTo(id: string, reach: AgentReach): string[] {
  const chain = [id];
  let current = id;
  for (let guard = 0; guard < 10_000; guard += 1) {
    const previous = reach.parent.get(current);
    if (previous === undefined) break;
    chain.unshift(previous);
    current = previous;
  }
  return chain;
}

/** The summary line of the agent view (GRAPH-42). The memory index counts at most 200 lines. */
export function agentSummary(nodes: readonly GraphNode[], reach: AgentReach) {
  const starts = nodes.filter((node) => node.loadsAtStart);
  const lines = starts.reduce(
    (sum, node) => sum + (node.kind === 'memory' ? Math.min(node.lineCount, LINE_LIMIT) : node.lineCount),
    0,
  );
  const notes = nodes.filter((node) => node.kind === 'note');
  return {
    files: starts.length,
    lines,
    reached: notes.filter((node) => reach.hops.has(node.id)).length,
    total: notes.length,
  };
}

/** The badge text for a file over the line limit (GRAPH-42), or null. */
export function lineBadge(node: GraphNode): string | null {
  if (node.lineCount <= LINE_LIMIT) return null;
  if (node.kind === 'claudeMd') return 'Over 200 lines: Claude follows long files less well';
  if (node.kind === 'memory' && node.loadsAtStart) return 'Claude loads only the first 200 lines';
  return null;
}

/** Hover card preview: the first 12 lines, and whether the text was cut (GRAPH-44). */
export function previewLines(
  text: string,
  truncated: boolean,
): { readonly lines: string[]; readonly cut: boolean } {
  const all = text.split('\n');
  return { lines: all.slice(0, PREVIEW_LINES), cut: truncated || all.length > PREVIEW_LINES };
}

/** The folder a note sits in, by name, for the notes list tree (GRAPH-55). */
export function folderName(path: string | null): string {
  if (path === null) return '';
  const parts = path.split(/[\\/]/);
  return parts.length > 1 ? (parts[parts.length - 2] ?? '') : '';
}

/** Short name of a root for the notes list: project, vault or Claude folder. */
export const ROOT_LABEL: Readonly<Record<GraphNode['root'], string>> = {
  project: 'Project',
  vault: 'Vault',
  claude: 'Claude folder',
};
