import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { GraphNode, graphChannels } from '@hsos/contracts/channels/graph';
import type { GraphEdge } from '@hsos/contracts/channels/graph';
import { ok } from '@hsos/contracts/result';
import { tokenToCssVariable } from '@hsos/contracts/theme';
import { createGraphView, INITIAL_GRAPH_VIEW_STATE } from '../../src/modules/graph/panel/GraphView';
import type { GraphViewState } from '../../src/modules/graph/panel/GraphView';
import { createLocalGraph } from '../../src/modules/graph/panel/LocalGraph';
import { useGraphData } from '../../src/modules/graph/panel/graph-store';
import { createStubBus } from '../fakes/stub-bus';
import type { StubBus } from '../fakes/stub-bus';

const fake = vi.hoisted(() => ({
  sigmas: [] as FakeSigmaRecord[],
  display: {} as Record<string, { x: number; y: number }>,
  animate: vi.fn(),
  reset: vi.fn(),
}));
const layout = vi.hoisted(() => ({ assign: vi.fn() }));

vi.mock('graphology-layout-forceatlas2', () => ({ default: layout }));
vi.mock('sigma/rendering', () => ({ sdfSquare: () => ({}) }));
vi.mock('sigma', () => {
  class FakeSigma {
    readonly handlers = new Map<string, (payload: unknown) => void>();
    readonly graph: unknown;
    readonly options: unknown;
    constructor(graph: unknown, _element: unknown, options: unknown) {
      this.graph = graph;
      this.options = options;
      fake.sigmas.push(this as never);
    }
    getCamera() {
      return {
        animate: fake.animate,
        reset: fake.reset,
        on: () => undefined,
        getState: () => ({ ratio: 1 }),
      };
    }
    getNodeDisplayData(id: string) {
      return fake.display[id];
    }
    viewportToGraph(point: { x: number; y: number }) {
      return point;
    }
    graphToViewport(point: { x: number; y: number }) {
      return point;
    }
    on(event: string, handler: (payload: unknown) => void) {
      this.handlers.set(event, handler);
    }
    refresh() {}
    kill() {}
  }
  return { default: FakeSigma, DEFAULT_STYLES: { nodes: {} } };
});

const ROOT = 'C:/hsos';
const CLAUDE = ROOT + '/CLAUDE.md';
const A = ROOT + '/notes/a.md';
const B = ROOT + '/notes/b.md';
const PANEL = 'p'.repeat(12) as never;

type Attributes = Record<string, unknown>;
type Reducer = (id: string, attributes: Attributes) => Attributes;
type Handler = (payload: unknown) => void;
type CanvasLike = {
  getNodeAttributes(id: string): Attributes;
  getNodeAttribute(id: string, name: string): unknown;
};
type FakeSigmaRecord = {
  readonly graph: CanvasLike;
  readonly options: { nodeReducer: Reducer; edgeReducer: Reducer; settings: Record<string, unknown> };
  readonly handlers: Map<string, Handler>;
};

type NodeSpec = {
  readonly id: string;
  readonly kind?: GraphNode['kind'];
  readonly label?: string;
  readonly degree?: number;
  readonly lineCount?: number;
  readonly loadsAtStart?: boolean;
  readonly modifiedAt?: number;
};

function node(spec: NodeSpec): GraphNode {
  return GraphNode.parse({
    id: spec.id,
    kind: spec.kind ?? 'note',
    label: spec.label ?? spec.id.slice(spec.id.lastIndexOf('/') + 1).replace(/\.md$/, ''),
    path: spec.id,
    root: 'project',
    tags: [],
    modifiedAt: spec.modifiedAt === undefined ? 1_000 : spec.modifiedAt,
    degree: spec.degree ?? 1,
    community: null,
    loadsAtStart: spec.loadsAtStart ?? false,
    lineCount: spec.lineCount ?? 10,
  });
}

function setGraph(nodes: GraphNode[], edges: GraphEdge[] = []) {
  useGraphData.setState({ loaded: true, error: null, status: null, nodes, edges, selectedPath: null });
}

function at(points: Record<string, [number, number]>): Record<string, { x: number; y: number }> {
  return Object.fromEntries(Object.entries(points).map(([id, [x, y]]) => [id, { x, y }]));
}

function sigma(): FakeSigmaRecord {
  const last = fake.sigmas[fake.sigmas.length - 1];
  if (last === undefined) throw new Error('the graph view has not drawn a canvas');
  return last;
}
function drawn(id: string): Attributes {
  return sigma().graph.getNodeAttributes(id);
}
function reduced(id: string): Attributes {
  return sigma().options.nodeReducer(id, drawn(id));
}
function fire(event: string, payload: unknown) {
  act(() => {
    sigma().handlers.get(event)?.(payload);
  });
}

let frames: FrameRequestCallback[] = [];
function runFrame(time: number) {
  const due = frames;
  frames = [];
  for (const callback of due) callback(time);
}

function renderGraph(initial: Partial<GraphViewState> = {}, bus: StubBus = createStubBus()) {
  const View = createGraphView({
    bus,
    log: { log: () => undefined },
    openNote: () => undefined,
    showLocal: () => undefined,
    openSettings: () => undefined,
  });
  const start: GraphViewState = { ...INITIAL_GRAPH_VIEW_STATE, ...initial };
  function Harness() {
    const [state, setState] = useState<GraphViewState>(start);
    return <View panelId={PANEL} state={state} setState={setState} isFocused />;
  }
  return render(<Harness />);
}

function clickButton(name: string) {
  fireEvent.click(screen.getByRole('button', { name }));
}

beforeEach(() => {
  fake.sigmas.length = 0;
  fake.display = {};
  fake.animate.mockClear();
  fake.reset.mockClear();
  layout.assign.mockClear();
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
  document.documentElement.style.setProperty(tokenToCssVariable('color.accent'), '#abcdef');
  useGraphData.setState({
    loaded: true,
    error: null,
    status: null,
    nodes: [],
    edges: [],
    selectedPath: null,
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.documentElement.style.removeProperty(tokenToCssVariable('color.accent'));
});

describe('graph view (card 034)', () => {
  it('GRAPH-20 a graph with saved positions draws each node at its saved place and runs no layout', () => {
    setGraph(
      [
        node({ id: CLAUDE, kind: 'claudeMd', degree: 2 }),
        node({ id: A, degree: 1 }),
        node({ id: B, degree: 1 }),
      ],
      [
        { source: CLAUDE, target: A, kind: 'wikilink' },
        { source: CLAUDE, target: B, kind: 'wikilink' },
      ],
    );
    renderGraph({ positions: at({ [CLAUDE]: [0, 0], [A]: [100, 100], [B]: [-50, 60] }) });
    expect(layout.assign).not.toHaveBeenCalled();
    expect(drawn(A)['x']).toBe(100);
    expect(drawn(A)['y']).toBe(100);
    expect(drawn(B)['x']).toBe(-50);
    expect(drawn(B)['y']).toBe(60);
  });

  it('GRAPH-23 a hovered node with two neighbours fades the other nodes to 0.15 alpha', () => {
    const HUB = ROOT + '/hub.md';
    const N1 = ROOT + '/n1.md';
    const N2 = ROOT + '/n2.md';
    const FAR = ROOT + '/far.md';
    setGraph(
      [node({ id: HUB, degree: 2 }), node({ id: N1 }), node({ id: N2 }), node({ id: FAR })],
      [
        { source: HUB, target: N1, kind: 'wikilink' },
        { source: HUB, target: N2, kind: 'wikilink' },
      ],
    );
    renderGraph({ positions: at({ [HUB]: [0, 0], [N1]: [10, 0], [N2]: [-10, 0], [FAR]: [200, 200] }) });
    fire('enterNode', { node: HUB, event: { x: 0, y: 0 } });
    expect(reduced(FAR)['color']).toMatch(/^rgba\(.*, 0\.15\)$/);
    expect(reduced(N1)['color']).toBe(drawn(N1)['base']);
    expect(reduced(N2)['color']).toBe(drawn(N2)['base']);
    fire('leaveNode', { node: HUB });
  });

  it('GRAPH-26 with "Changed in last 24 hours" on only the note changed 2 hours ago is drawn', () => {
    const now = Date.now();
    const HOUR = 60 * 60 * 1000;
    const RECENT = ROOT + '/recent.md';
    const OLD = ROOT + '/old.md';
    setGraph([
      node({ id: RECENT, modifiedAt: now - 2 * HOUR }),
      node({ id: OLD, modifiedAt: now - 3 * 24 * HOUR }),
    ]);
    renderGraph({ positions: at({ [RECENT]: [0, 0], [OLD]: [50, 50] }) });
    clickButton('24 h');
    expect(screen.getByRole('button', { name: '24 h' }).getAttribute('aria-pressed')).toBe('true');
    expect(reduced(OLD)['visibility']).toBe('hidden');
    expect(reduced(RECENT)['visibility']).not.toBe('hidden');
  });

  it('GRAPH-30 the local graph of a.md lists b with the text of its line 4', async () => {
    const CONTEXT = 'Read [[a]] before editing';
    const bus = createStubBus();
    bus.answer(graphChannels.backlinks, () => ok([{ from: B, fromLabel: 'b', line: 4, context: CONTEXT }]));
    setGraph(
      [node({ id: A, degree: 1 }), node({ id: B, degree: 1 })],
      [{ source: B, target: A, kind: 'wikilink' }],
    );
    useGraphData.setState({ selectedPath: A as never });
    const Local = createLocalGraph({
      bus,
      log: { log: () => undefined },
      depth: () => 1,
      open: () => undefined,
    });
    render(<Local />);
    await screen.findByText(CONTEXT);
    const list = screen.getByRole('list');
    expect(within(list).getByText('b')).toBeTruthy();
    expect(bus.payloadsOf(graphChannels.backlinks)).toEqual([{ path: A }]);
  });

  it('GRAPH-42 with the agent view on, the summary counts 3 files and 410 lines and the memory badge shows', () => {
    setGraph([
      node({ id: CLAUDE, kind: 'claudeMd', loadsAtStart: true, lineCount: 120 }),
      node({ id: ROOT + '/AGENTS.md', kind: 'claudeMd', loadsAtStart: true, lineCount: 90 }),
      node({
        id: ROOT + '/memory/MEMORY.md',
        kind: 'memory',
        label: 'MEMORY',
        loadsAtStart: true,
        lineCount: 260,
      }),
    ]);
    renderGraph({
      positions: at({
        [CLAUDE]: [0, 0],
        [ROOT + '/AGENTS.md']: [40, 0],
        [ROOT + '/memory/MEMORY.md']: [0, 40],
      }),
    });
    clickButton('Agent view');
    expect(screen.getByText(/Loaded at every start: 3 files, 410 lines/)).toBeTruthy();
    expect(screen.getByText('Claude loads only the first 200 lines')).toBeTruthy();
  });

  it('GRAPH-50 zoom is limited to 0.7x to 5x and a double-click on empty space returns to the fitted view', () => {
    fake.display[CLAUDE] = { x: 0.37, y: 0.63 };
    setGraph(
      [node({ id: CLAUDE, kind: 'claudeMd' }), node({ id: A })],
      [{ source: CLAUDE, target: A, kind: 'wikilink' }],
    );
    renderGraph({ positions: at({ [CLAUDE]: [0, 0], [A]: [100, 100] }) });
    const settings = sigma().options.settings;
    expect(settings['minCameraRatio']).toBe(0.2);
    expect(settings['maxCameraRatio']).toBeCloseTo(1 / 0.7, 10);
    fake.animate.mockClear();
    fire('doubleClickStage', {});
    expect(fake.animate).toHaveBeenCalledWith({ x: 0.37, y: 0.63, ratio: 1, angle: 0 }, { duration: 0 });
  });

  it('GRAPH-51 a node moves only on the 900 px/s sweep and is back within 2000 ms', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    let nowMs = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
    const pointer = (x: number, y: number, time: number) => {
      nowMs = time;
      screen
        .getByTestId('graph-canvas')
        .dispatchEvent(new MouseEvent('pointermove', { clientX: x, clientY: y, bubbles: true }));
    };
    // A drifting node sits 6 px from its place: drift is 6 sin(0.4 s) on x and 6 cos(0.3 s) on y, base 100, 100.
    const driftAt = (time: number) => ({
      x: 100 + 6 * Math.sin((0.4 * time) / 1000),
      y: 100 + 6 * Math.cos((0.3 * time) / 1000),
    });
    const offsetAt = (time: number) => {
      const here = driftAt(time);
      return Math.hypot((drawn(A)['x'] as number) - here.x, (drawn(A)['y'] as number) - here.y);
    };
    setGraph(
      [node({ id: CLAUDE, kind: 'claudeMd' }), node({ id: A })],
      [{ source: CLAUDE, target: A, kind: 'wikilink' }],
    );
    renderGraph({ positions: at({ [CLAUDE]: [0, 0], [A]: [100, 100] }) });
    runFrame(0);
    pointer(40, 100, 0);
    pointer(70, 100, 100);
    runFrame(100);
    expect(offsetAt(100)).toBeLessThan(0.5);
    pointer(70, 100, 200);
    pointer(79, 100, 210);
    runFrame(210);
    expect(offsetAt(210)).toBeGreaterThan(1);
    for (let time = 226; time <= 2210; time += 16) {
      nowMs = time;
      runFrame(time);
    }
    expect(offsetAt(2210)).toBeLessThan(0.5);
  });

  it('GRAPH-51 with CLAUDE.md in the graph the pinned node never moves under a fast sweep', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    let nowMs = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
    setGraph(
      [node({ id: CLAUDE, kind: 'claudeMd' }), node({ id: A })],
      [{ source: CLAUDE, target: A, kind: 'wikilink' }],
    );
    renderGraph({ positions: at({ [CLAUDE]: [0, 0], [A]: [100, 100] }) });
    runFrame(0);
    for (const [x, time] of [
      [-40, 0],
      [-11, 10],
    ] as const) {
      nowMs = time;
      screen
        .getByTestId('graph-canvas')
        .dispatchEvent(new MouseEvent('pointermove', { clientX: x, clientY: 0, bubbles: true }));
    }
    for (let time = 20; time <= 2000; time += 16) {
      nowMs = time;
      runFrame(time);
    }
    expect(drawn(CLAUDE)['x']).toBe(0);
    expect(drawn(CLAUDE)['y']).toBe(0);
  });
});
