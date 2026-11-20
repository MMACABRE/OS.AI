import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { GraphNode, graphChannels } from '@hsos/contracts/channels/graph';
import type { GraphEdge } from '@hsos/contracts/channels/graph';
import { ok } from '@hsos/contracts/result';
import { tokenToCssVariable } from '@hsos/contracts/theme';
import { createGraphView, INITIAL_GRAPH_VIEW_STATE } from '../../src/modules/graph/panel/GraphView';
import type { GraphViewState } from '../../src/modules/graph/panel/GraphView';
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
const C = ROOT + '/notes/c.md';
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

describe('agent view (card 034)', () => {
  it('GRAPH-43 with the agent view on, a is 1 hop, b is 2 hops and the unlinked c is muted', async () => {
    setGraph(
      [
        node({ id: CLAUDE, kind: 'claudeMd', loadsAtStart: true, label: 'CLAUDE.md' }),
        node({ id: A }),
        node({ id: B }),
        node({ id: C }),
      ],
      [
        { source: CLAUDE, target: A, kind: 'wikilink' },
        { source: A, target: B, kind: 'wikilink' },
      ],
    );
    renderGraph({ positions: at({ [CLAUDE]: [0, 0], [A]: [60, 0], [B]: [120, 0], [C]: [0, 120] }) });
    clickButton('Agent view');
    fire('enterNode', { node: A, event: { x: 0, y: 0 } });
    expect(await screen.findByText('1 hop')).toBeTruthy();
    fire('leaveNode', { node: A });
    fire('enterNode', { node: B, event: { x: 0, y: 0 } });
    expect(await screen.findByText('2 hops')).toBeTruthy();
    fire('leaveNode', { node: B });
    expect(reduced(C)['color']).toMatch(/^rgba\(/);
    expect(reduced(A)['color']).not.toMatch(/^rgba\(/);
  });

  it('GRAPH-43 the card of c says no link reaches it, and the card of b shows the chain CLAUDE.md, a, b', () => {
    setGraph(
      [
        node({ id: CLAUDE, kind: 'claudeMd', loadsAtStart: true, label: 'CLAUDE.md' }),
        node({ id: A, label: 'a' }),
        node({ id: B, label: 'b' }),
        node({ id: C, label: 'c' }),
      ],
      [
        { source: CLAUDE, target: A, kind: 'wikilink' },
        { source: A, target: B, kind: 'wikilink' },
      ],
    );
    renderGraph({ positions: at({ [CLAUDE]: [0, 0], [A]: [60, 0], [B]: [120, 0], [C]: [0, 120] }) });
    clickButton('Agent view');
    fire('clickNode', { node: C });
    const unreached = within(screen.getByRole('region', { name: 'Selected node' }));
    expect(
      unreached.getByText('No link reaches this note. An agent finds it only by searching.'),
    ).toBeTruthy();
    fire('clickNode', { node: B });
    const chain = within(screen.getByRole('region', { name: 'Selected node' }))
      .getAllByRole('listitem')
      .map((item) => item.textContent);
    expect(chain).toEqual(['CLAUDE.md', 'a', 'b']);
  });

  it('GRAPH-43 with "Only not reached" on only the unlinked note c is drawn', () => {
    setGraph(
      [
        node({ id: CLAUDE, kind: 'claudeMd', loadsAtStart: true }),
        node({ id: A }),
        node({ id: B }),
        node({ id: C }),
      ],
      [
        { source: CLAUDE, target: A, kind: 'wikilink' },
        { source: A, target: B, kind: 'wikilink' },
      ],
    );
    renderGraph({ positions: at({ [CLAUDE]: [0, 0], [A]: [60, 0], [B]: [120, 0], [C]: [0, 120] }) });
    clickButton('Agent view');
    clickButton('Only not reached');
    expect(reduced(CLAUDE)['visibility']).toBe('hidden');
    expect(reduced(A)['visibility']).toBe('hidden');
    expect(reduced(B)['visibility']).toBe('hidden');
    expect(reduced(C)['visibility']).not.toBe('hidden');
  });

  it('GRAPH-42 a CLAUDE.md of 260 lines shows the over-200-lines badge on its card in the agent view', () => {
    setGraph(
      [
        node({ id: CLAUDE, kind: 'claudeMd', loadsAtStart: true, label: 'CLAUDE.md', lineCount: 260 }),
        node({ id: A }),
      ],
      [{ source: CLAUDE, target: A, kind: 'wikilink' }],
    );
    renderGraph({ positions: at({ [CLAUDE]: [0, 0], [A]: [60, 0] }) });
    clickButton('Agent view');
    fire('clickNode', { node: CLAUDE });
    const card = within(screen.getByRole('region', { name: 'Selected node' }));
    expect(card.getByText('Over 200 lines: Claude follows long files less well')).toBeTruthy();
  });

  it('GRAPH-44 hovering a node for 400 ms shows its first 12 lines as plain text, and Escape closes the card', async () => {
    const bus = createStubBus();
    const lines: string[] = ['**not bold**'];
    for (let index = 2; index <= 20; index += 1) lines.push('line ' + String(index));
    bus.answer(graphChannels.preview, () => ok({ text: lines.join('\n'), truncated: false }));
    setGraph([node({ id: A, label: 'a' })]);
    renderGraph({ positions: at({ [A]: [0, 0] }) }, bus);
    fire('enterNode', { node: A, event: { x: 20, y: 30 } });
    const card = await screen.findByRole('tooltip');
    const pre = await waitFor(() => {
      const found = card.querySelector('pre');
      if (found === null) throw new Error('the preview has not arrived');
      return found;
    });
    const shown = pre.textContent ?? '';
    expect(shown).toContain('**not bold**');
    expect(shown).toContain('line 12');
    expect(shown).not.toContain('line 13');
    expect(shown.endsWith('…')).toBe(true);
    expect(document.activeElement).toBe(document.body);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
