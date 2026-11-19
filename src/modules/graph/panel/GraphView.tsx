import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import Sigma from 'sigma';
import { z } from 'zod';
import type { Bus } from '@hsos/contracts/bus';
import { graphChannels } from '@hsos/contracts/channels/graph';
import type { GraphEdge, GraphNode, LinkRef } from '@hsos/contracts/channels/graph';
import type { AbsPath } from '@hsos/contracts/ids';
import type { Logger, PanelProps } from '@hsos/contracts/module';
import {
  Badge,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  ProgressBar,
  Switch,
  TextField,
  usePageVisible,
  useReducedMotion,
} from '@hsos/ui-kit';
import { DetailsCard, HoverCard } from './GraphCards';
import type { HoverCardData } from './GraphCards';
import { withAlpha, tokenValue } from './graph-colour';
import { communitiesOf, layoutCanvas, newCanvasGraph } from './graph-canvas';
import type { CanvasGraph } from './graph-canvas';
import {
  COMMUNITY_TOKENS,
  agentReach,
  agentSummary,
  isRecent,
  kindToken,
  largestNodes,
  lineBadge,
  nodeRadius,
  previewLines,
  searchMatches,
} from './graph-model';
import type { AgentReach } from './graph-model';
import { useGraphData } from './graph-store';
import styles from './Graph.module.css';

/** The graph view's saved state (graph.md "Graph view"): filters, the agent view and node positions (GRAPH-20). */
export const GraphViewState = z.object({
  query: z.string().max(200).default(''),
  recentOnly: z.boolean().default(false),
  byCommunity: z.boolean().default(false),
  agentView: z.boolean().default(false),
  onlyNotReached: z.boolean().default(false),
  positions: z.record(z.string(), z.object({ x: z.number(), y: z.number() })).default({}),
});
export type GraphViewState = z.infer<typeof GraphViewState>;

export const INITIAL_GRAPH_VIEW_STATE: GraphViewState = {
  query: '',
  recentOnly: false,
  byCommunity: false,
  agentView: false,
  onlyNotReached: false,
  positions: {},
};

export type GraphDeps = {
  readonly bus: Bus;
  readonly log: Logger;
  readonly openNote: (path: AbsPath, line: number | null) => void;
  readonly showLocal: () => void;
  readonly openSettings: () => void;
};

/** Hover card wait (GRAPH-44). */
export const HOVER_DELAY_MS = 400;
/** Labels appear for every node from this zoom (GRAPH-50). */
const LABEL_ZOOM = 1.8;
/** Pointer speed, in px per second, above which a sweep pushes nodes (GRAPH-51). */
const PUSH_SPEED = 600;
const PUSH_RADIUS = 40;
const DRIFT_PX = 6;
const DIM_ALPHA = 0.15;
const MUTED_ALPHA = 0.4;

type Point = { readonly x: number; readonly y: number };
type Flags = {
  hovered: string | null;
  neighbours: ReadonlySet<string>;
  selected: string | null;
  labelled: ReadonlySet<string>;
  matches: ReadonlySet<string>;
  byCommunity: boolean;
  agent: boolean;
  onlyNotReached: boolean;
  recentOnly: boolean;
  reach: AgentReach;
  now: number;
};

/** The layout of nodes that have no saved position: a ring, then ForceAtlas2 (GRAPH-20). */
function startPoint(index: number, count: number): Point {
  const angle = (index / Math.max(1, count)) * Math.PI * 2;
  return { x: Math.cos(angle) * 100, y: Math.sin(angle) * 100 };
}

/**
 * The graph view (`graph.view`, GRAPH-20 to GRAPH-29, GRAPH-40 to GRAPH-44, GRAPH-50 to GRAPH-53): sigma on
 * a graphology graph, with CLAUDE.md pinned at the centre (GRAPH-51), node drift and pointer push, the
 * camera limits, labels for the largest nodes, the agent view and the toolbar.
 */
export function createGraphView(deps: GraphDeps) {
  return function GraphView({ state, setState }: PanelProps<GraphViewState>) {
    const data = useGraphData();
    const visible = usePageVisible();
    const reduced = useReducedMotion();
    const screen = useRef<HTMLDivElement>(null);
    const toolbar = useRef<HTMLDivElement>(null);
    const sigmaRef = useRef<Sigma | null>(null);
    const graphRef = useRef<CanvasGraph | null>(null);
    const stateRef = useRef(state);
    stateRef.current = state;
    const flags = useRef<Flags>({
      hovered: null,
      neighbours: new Set(),
      selected: null,
      labelled: new Set(),
      matches: new Set(),
      byCommunity: state.byCommunity,
      agent: state.agentView,
      onlyNotReached: state.onlyNotReached,
      recentOnly: state.recentOnly,
      reach: { hops: new Map(), parent: new Map() },
      now: Date.now(),
    });
    const [selected, setSelected] = useState<string | null>(null);
    const [hover, setHover] = useState<HoverCardData | null>(null);
    const [backlinks, setBacklinks] = useState<readonly LinkRef[]>([]);
    const handledRequest = useRef(data.agentRequest);
    const reducedRef = useRef(reduced);
    reducedRef.current = reduced;

    const reach = useMemo(() => agentReach(data.nodes, data.edges), [data.nodes, data.edges]);
    const matches = useMemo(() => searchMatches(data.nodes, state.query), [data.nodes, state.query]);
    const nodeById = useMemo(
      () => new Map<string, GraphNode>(data.nodes.map((node) => [node.id, node])),
      [data.nodes],
    );
    const selectedNode = selected === null ? undefined : nodeById.get(selected);
    const summary = useMemo(() => agentSummary(data.nodes, reach), [data.nodes, reach]);
    const badges = useMemo(
      () =>
        data.nodes.flatMap((node) =>
          lineBadge(node) === null ? [] : [{ id: node.id, text: lineBadge(node) ?? '' }],
        ),
      [data.nodes],
    );

    // The agent view opens when the command asks for it (GRAPH-43, graph.agentView).
    useEffect(() => {
      if (data.agentRequest === handledRequest.current) return;
      handledRequest.current = data.agentRequest;
      setState({ ...stateRef.current, agentView: true });
    }, [data.agentRequest, setState]);

    // Filters and agent data reach the canvas without rebuilding it.
    useEffect(() => {
      flags.current = {
        ...flags.current,
        byCommunity: state.byCommunity,
        agent: state.agentView,
        onlyNotReached: state.onlyNotReached,
        recentOnly: state.recentOnly,
        reach,
        matches,
        now: Date.now(),
      };
      sigmaRef.current?.refresh({ skipIndexation: true });
    }, [state.byCommunity, state.agentView, state.onlyNotReached, state.recentOnly, reach, matches]);

    // The canvas: built when the graph changes (GRAPH-27 keeps positions of nodes that stay).
    useEffect(() => {
      const element = screen.current;
      if (element === null || data.nodes.length === 0) return undefined;
      const graph = newCanvasGraph();
      graphRef.current = graph;
      const saved = stateRef.current.positions;
      const colourOf = (node: GraphNode) => tokenValue(kindToken(node.kind));
      data.nodes.forEach((node, index) => {
        const point = saved[node.id] ?? startPoint(index, data.nodes.length);
        graph.addNode(node.id, {
          x: point.x,
          y: point.y,
          size: nodeRadius(node.degree),
          color: colourOf(node),
          label: node.label,
          base: colourOf(node),
        });
      });
      for (const edge of data.edges as readonly GraphEdge[])
        if (
          edge.source !== edge.target &&
          graph.hasNode(edge.source) &&
          graph.hasNode(edge.target) &&
          !graph.hasEdge(edge.source, edge.target)
        )
          graph.addEdge(edge.source, edge.target, { size: 1, color: tokenValue('color.graph.edge') });

      const needsLayout = data.nodes.some((node) => saved[node.id] === undefined);
      if (needsLayout) layoutCanvas(graph, 200);
      communitiesOf(graph);
      // CLAUDE.md sits at the centre of the view and never moves (GRAPH-51).
      const pinned = data.nodes.find((node) => node.kind === 'claudeMd')?.id ?? null;
      if (pinned !== null && graph.hasNode(pinned)) {
        const shiftX = graph.getNodeAttribute(pinned, 'x') as number;
        const shiftY = graph.getNodeAttribute(pinned, 'y') as number;
        graph.forEachNode((id) => {
          graph.setNodeAttribute(id, 'x', (graph.getNodeAttribute(id, 'x') as number) - shiftX);
          graph.setNodeAttribute(id, 'y', (graph.getNodeAttribute(id, 'y') as number) - shiftY);
        });
      }
      if (needsLayout) {
        const positions: Record<string, Point> = {};
        graph.forEachNode((id, attributes) => {
          positions[id] = { x: attributes['x'] as number, y: attributes['y'] as number };
        });
        setState({ ...stateRef.current, positions });
      }

      const base = new Map<string, Point>();
      const phases = new Map<string, number>();
      graph.forEachNode((id, attributes) => {
        base.set(id, { x: attributes['x'] as number, y: attributes['y'] as number });
        phases.set(id, Math.random() * Math.PI * 2);
      });
      const labelled = largestNodes(data.nodes);
      const top = new Set(labelled);
      const colourTokens = COMMUNITY_TOKENS.map((token) => tokenValue(token));
      const accent = tokenValue('color.accent');
      const muted = tokenValue('color.text.muted');
      const live = tokenValue('color.live');
      const nodeMap = new Map(data.nodes.map((node) => [node.id, node]));
      const hiddenNode = (id: string, f: Flags): boolean => {
        const node = nodeMap.get(id);
        if (node === undefined) return false;
        if (f.recentOnly && !isRecent(node, f.now)) return true;
        return f.agent && f.onlyNotReached && f.reach.hops.has(id);
      };

      const sigma = new Sigma(graph as unknown as ConstructorParameters<typeof Sigma>[0], element, {
        settings: {
          // GRAPH-50: zoom between 0.7x and 5x (sigma's camera ratio is the inverse).
          minCameraRatio: 0.2,
          maxCameraRatio: 1 / 0.7,
          doubleClickZoomingRatio: 1,
          labelRenderedSizeThreshold: 0,
          allowInvalidContainer: true,
        },
        nodeReducer: (id, attributes) => {
          const f = flags.current;
          const node = nodeMap.get(id);
          const result = { ...attributes };
          if (node === undefined) return result;
          const zoomed = sigma.getCamera().getState().ratio <= 1 / LABEL_ZOOM;
          let colour = graph.getNodeAttribute(id, 'base') as string;
          if (f.byCommunity) {
            const community = graph.getNodeAttribute(id, 'community') as number;
            colour = colourTokens[community % colourTokens.length] ?? colour;
          }
          let size = nodeRadius(node.degree);
          let label: string | null = null;
          if (top.has(id) || f.matches.has(id) || zoomed) label = node.label;
          if (f.agent) {
            if (node.loadsAtStart) {
              colour = accent;
              size += 2;
              label = node.label;
            } else if (!f.reach.hops.has(id)) colour = withAlpha(muted, MUTED_ALPHA);
          }
          if (hiddenNode(id, f)) result.visibility = 'hidden';
          if (f.hovered !== null && id !== f.hovered && !f.neighbours.has(id) && !colour.startsWith('rgba'))
            colour = withAlpha(colour, DIM_ALPHA);
          if (f.hovered === id || f.neighbours.has(id)) label = node.label;
          if (f.selected === id) {
            colour = accent;
            size += 2;
            label = node.label;
            result.highlighted = true;
          }
          result.color = colour;
          result.size = size;
          result.label = label;
          return result;
        },
        edgeReducer: (edge, attributes) => {
          const f = flags.current;
          const result = { ...attributes };
          const [source, target] = graph.extremities(edge);
          if (hiddenNode(source, f) || hiddenNode(target, f)) result.visibility = 'hidden';
          if (f.hovered !== null) {
            const touches = source === f.hovered || target === f.hovered;
            result.color = touches ? live : withAlpha(tokenValue('color.graph.edge'), DIM_ALPHA);
          }
          return result;
        },
      });
      sigmaRef.current = sigma;
      flags.current = {
        ...flags.current,
        labelled,
        matches,
        byCommunity: stateRef.current.byCommunity,
        agent: stateRef.current.agentView,
        onlyNotReached: stateRef.current.onlyNotReached,
        recentOnly: stateRef.current.recentOnly,
        reach,
        now: Date.now(),
      };
      sigma.getCamera().on('updated', () => sigma.refresh({ skipIndexation: true }));

      // Node drift, the pointer push and the spring back (GRAPH-51). Reduced motion stops both.
      const offsets = new Map<string, Point>();
      const unit = () => {
        const origin = sigma.viewportToGraph({ x: 0, y: 0 });
        const side = sigma.viewportToGraph({ x: DRIFT_PX, y: 0 });
        return Math.abs(side.x - origin.x) / DRIFT_PX || 1;
      };
      let frame = 0;
      let last = performance.now();
      const tick = (time: number) => {
        const dt = Math.min(0.05, (time - last) / 1000);
        last = time;
        if (!reducedRef.current) {
          const px = unit();
          const seconds = time / 1000;
          for (const [id, point] of base) {
            if (id === pinned || id === flags.current.hovered) continue;
            const offset = offsets.get(id) ?? { x: 0, y: 0 };
            const decay = Math.exp(-dt * 3);
            const next = { x: offset.x * decay, y: offset.y * decay };
            offsets.set(id, next);
            const phase = phases.get(id) ?? 0;
            graph.setNodeAttribute(
              id,
              'x',
              point.x + px * DRIFT_PX * Math.sin(seconds * 0.4 + phase) + next.x,
            );
            graph.setNodeAttribute(
              id,
              'y',
              point.y + px * DRIFT_PX * Math.cos(seconds * 0.3 + phase) + next.y,
            );
          }
          sigma.refresh({ skipIndexation: true });
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);

      let lastPointer: { x: number; y: number; t: number } | null = null;
      const onMove = (event: PointerEvent) => {
        const rect = element.getBoundingClientRect();
        const pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top, t: performance.now() };
        const previous = lastPointer;
        lastPointer = pointer;
        if (previous === null || reducedRef.current) return;
        const seconds = (pointer.t - previous.t) / 1000;
        if (seconds <= 0) return;
        const speed = Math.hypot(pointer.x - previous.x, pointer.y - previous.y) / seconds;
        if (speed <= PUSH_SPEED) return;
        const px = unit();
        for (const id of base.keys()) {
          const node = graph.getNodeAttributes(id);
          const at = sigma.graphToViewport({ x: node['x'] as number, y: node['y'] as number });
          const distance = Math.hypot(at.x - pointer.x, at.y - pointer.y);
          if (distance >= PUSH_RADIUS || distance === 0) continue;
          const push = (PUSH_RADIUS - distance) * 0.3 * px;
          const offset = offsets.get(id) ?? { x: 0, y: 0 };
          offsets.set(id, {
            x: offset.x + ((at.x - pointer.x) / distance) * push,
            y: offset.y + ((at.y - pointer.y) / distance) * push,
          });
        }
      };
      element.addEventListener('pointermove', onMove);

      // Hover: the card waits HOVER_DELAY_MS and reads the note's preview (GRAPH-44).
      let timer: ReturnType<typeof setTimeout> | null = null;
      let token = 0;
      sigma.on('enterNode', ({ node, event }) => {
        flags.current = { ...flags.current, hovered: node, neighbours: new Set(graph.neighbors(node)) };
        sigma.refresh({ skipIndexation: true });
        if (timer !== null) clearTimeout(timer);
        const current = ++token;
        timer = setTimeout(() => {
          const info = nodeMap.get(node);
          if (info === undefined) return;
          const at = { x: event.x, y: event.y };
          setHover({
            node: info,
            x: at.x,
            y: at.y,
            preview: null,
            hops: flags.current.reach.hops.get(node) ?? null,
          });
          if (info.path === null) return;
          void deps.bus.call(graphChannels.preview, { path: info.path }).then((result) => {
            if (!result.ok || current !== token) return;
            const preview = previewLines(result.value.text, result.value.truncated);
            setHover((card) => (card === null || card.node.id !== node ? card : { ...card, preview }));
          });
        }, HOVER_DELAY_MS);
      });
      sigma.on('leaveNode', () => {
        if (timer !== null) clearTimeout(timer);
        token += 1;
        flags.current = { ...flags.current, hovered: null, neighbours: new Set() };
        sigma.refresh({ skipIndexation: true });
        setHover(null);
      });
      sigma.on('clickNode', ({ node }) => {
        flags.current = { ...flags.current, selected: node };
        setSelected(node);
        const info = nodeMap.get(node);
        deps.log.log('debug', 'graph.select', { kind: info?.kind ?? 'unknown' });
        if (info?.path) useGraphData.getState().select(info.path);
        sigma.refresh({ skipIndexation: true });
      });
      sigma.on('doubleClickNode', ({ node }) => {
        const info = nodeMap.get(node);
        if (info?.path) deps.openNote(info.path, null);
      });
      sigma.on('doubleClickStage', () => void sigma.getCamera().reset());

      return () => {
        cancelAnimationFrame(frame);
        if (timer !== null) clearTimeout(timer);
        element.removeEventListener('pointermove', onMove);
        sigma.kill();
        sigmaRef.current = null;
        graphRef.current = null;
      };
      // The canvas is built once per graph; filters reach it through `flags`.
    }, [data.nodes, data.edges]);

    // Positions and selection are read when the canvas exists; the card follows the selection.
    useEffect(() => {
      if (selectedNode?.path === null || selectedNode === undefined) {
        setBacklinks([]);
        return;
      }
      void deps.bus.call(graphChannels.backlinks, { path: selectedNode.path }).then((result) => {
        if (result.ok) setBacklinks(result.value);
      });
      // Only the path of the selected note matters here.
    }, [selectedNode?.path]);

    useEffect(() => {
      const onKey = (event: KeyboardEvent) => {
        if (event.key === 'Escape') setHover(null);
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, []);

    useEffect(() => {
      if (!visible) return;
      sigmaRef.current?.refresh({ skipIndexation: true });
    }, [visible]);

    const fit = () => void sigmaRef.current?.getCamera().reset();
    const focusSearch = () => toolbar.current?.querySelector('input')?.focus();
    const onKeys = (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === '/') {
        event.preventDefault();
        focusSearch();
      } else if (event.key === '0') fit();
    };

    if (!data.loaded)
      return (
        <div className={styles.panel}>
          <p className={styles.message}>Loading notes…</p>
        </div>
      );
    if (data.error !== null)
      return (
        <div className={styles.panel}>
          <ErrorState
            message={`The note index could not be read. ${data.error}`}
            onRetry={() => void deps.bus.call(graphChannels.reindex, {})}
            settingsAction={{ label: 'Settings', onPress: deps.openSettings }}
          />
        </div>
      );
    if (data.nodes.length === 0) {
      if (data.status?.state === 'indexing')
        return (
          <div className={styles.panel}>
            <p
              className={styles.message}
            >{`Indexing notes… ${data.status.processed} of ${data.status.total}`}</p>
            <ProgressBar
              value={data.status.total === 0 ? 0 : (data.status.processed / data.status.total) * 100}
              tone="ok"
              label="Indexing notes"
            />
          </div>
        );
      return (
        <div className={styles.panel}>
          <EmptyState
            title="No notes yet."
            message="Notes in this project and your vault appear here."
            action={{ label: 'Set vault folder', onPress: deps.openSettings }}
          />
        </div>
      );
    }

    return (
      <div className={styles.panel} onKeyDown={onKeys} tabIndex={-1}>
        <div ref={toolbar} className={styles.toolbar} role="toolbar" aria-label="Graph tools">
          <div className={styles.search}>
            <TextField
              label="Search notes"
              value={state.query}
              placeholder="Search notes"
              onChange={(query) => setState({ ...stateRef.current, query })}
            />
          </div>
          <Switch
            label="Changed in last 24 hours"
            checked={state.recentOnly}
            onChange={(recentOnly) => setState({ ...stateRef.current, recentOnly })}
          />
          <Switch
            label="Colour by community"
            checked={state.byCommunity}
            onChange={(byCommunity) => setState({ ...stateRef.current, byCommunity })}
          />
          <Switch
            label="Agent view"
            checked={state.agentView}
            onChange={(agentView) => setState({ ...stateRef.current, agentView })}
          />
          {state.agentView ? (
            <Switch
              label="Only not reached"
              checked={state.onlyNotReached}
              onChange={(onlyNotReached) => setState({ ...stateRef.current, onlyNotReached })}
            />
          ) : null}
          <IconButton icon={<Icon name="maximize" />} label="Fit graph" onPress={fit} />
        </div>
        {state.agentView ? (
          <div className={styles.agent} aria-label="Agent view summary">
            <p className={styles.summary}>
              {`Loaded at every start: ${summary.files} files, ${summary.lines} lines`}
              {`  ·  Reached by links: ${summary.reached} of ${summary.total} notes`}
            </p>
            {badges.map((badge) => (
              <Badge key={badge.id} tone="warn" text={badge.text} />
            ))}
          </div>
        ) : null}
        <div ref={screen} className={styles.canvas} data-testid="graph-canvas" />
        {hover === null ? null : <HoverCard card={hover} agent={state.agentView} />}
        {selectedNode === undefined ? null : (
          <DetailsCard
            node={selectedNode}
            backlinks={backlinks.length}
            chain={chainOf(selectedNode.id, reach, nodeById)}
            agent={state.agentView}
            onOpen={() => selectedNode.path !== null && deps.openNote(selectedNode.path, null)}
            onLocal={() => {
              if (selectedNode.path !== null) useGraphData.getState().select(selectedNode.path);
              deps.showLocal();
            }}
            onPick={(id) => {
              const picked = nodeById.get(id);
              flags.current = { ...flags.current, selected: id };
              setSelected(id);
              if (picked?.path) useGraphData.getState().select(picked.path);
              sigmaRef.current?.refresh({ skipIndexation: true });
            }}
            onClose={() => {
              flags.current = { ...flags.current, selected: null };
              setSelected(null);
              sigmaRef.current?.refresh({ skipIndexation: true });
            }}
          />
        )}
        <p className={styles.hint}>
          Scroll to zoom · drag to pan · double-click empty space to fit · / to search
        </p>
      </div>
    );
  };
}

/** The chain from a start file to `id` as nodes, for the details card (GRAPH-43). */
function chainOf(
  id: string,
  reach: AgentReach,
  nodes: ReadonlyMap<string, GraphNode>,
): readonly { readonly id: string; readonly label: string }[] {
  if (!reach.hops.has(id)) return [];
  const ids: string[] = [];
  let current: string | undefined = id;
  for (let guard = 0; current !== undefined && guard < 10_000; guard += 1) {
    ids.unshift(current);
    current = reach.parent.get(current);
  }
  return ids.map((entry) => ({ id: entry, label: nodes.get(entry)?.label ?? entry }));
}
