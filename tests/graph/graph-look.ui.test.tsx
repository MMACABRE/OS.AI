import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GraphNode } from '@hsos/contracts/channels/graph';
import { tokenToCssVariable } from '@hsos/contracts/theme';
import { createGraphView, INITIAL_GRAPH_VIEW_STATE } from '../../src/modules/graph/panel/GraphView';
import { useGraphData } from '../../src/modules/graph/panel/graph-store';
import { createStubBus } from '../fakes/stub-bus';

/** A stand-in for sigma: jsdom has no WebGL. It keeps what the view passes in so tests can run the reducers. */
const fake = vi.hoisted(() => ({
  instances: [] as {
    options: { nodeReducer: (id: string, attributes: Record<string, unknown>) => Record<string, unknown> };
  }[],
  display: {} as Record<string, { x: number; y: number }>,
  animate: vi.fn(),
  reset: vi.fn(),
}));

vi.mock('sigma', () => {
  class FakeSigma {
    readonly options: {
      nodeReducer: (id: string, attributes: Record<string, unknown>) => Record<string, unknown>;
    };
    constructor(_graph: unknown, _element: unknown, options: FakeSigma['options']) {
      this.options = options;
      fake.instances.push(this);
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
    on() {}
    refresh() {}
    kill() {}
  }
  return { default: FakeSigma, DEFAULT_STYLES: { nodes: {} } };
});
vi.mock('sigma/rendering', () => ({ sdfSquare: () => ({}) }));

const CLAUDE = 'C:\\code\\hsos\\CLAUDE.md';
const NOTE = 'C:\\code\\hsos\\notes\\a.md';
const OTHER = 'C:\\code\\hsos\\notes\\b.md';

const node = (id: string, kind: 'note' | 'claudeMd', degree: number) =>
  GraphNode.parse({
    id,
    kind,
    label: id.slice(id.lastIndexOf('\\') + 1),
    path: id,
    root: 'project',
    tags: [],
    modifiedAt: 1_000,
    degree,
    community: null,
    loadsAtStart: kind === 'claudeMd',
    lineCount: 10,
  });

function open() {
  const View = createGraphView({
    bus: createStubBus(),
    log: { log: () => undefined },
    openNote: () => undefined,
    showLocal: () => undefined,
    openSettings: () => undefined,
  });
  return render(
    <View
      panelId={'p'.repeat(12) as never}
      state={INITIAL_GRAPH_VIEW_STATE}
      setState={() => undefined}
      isFocused
    />,
  );
}

beforeEach(() => {
  fake.instances.length = 0;
  fake.animate.mockClear();
  fake.reset.mockClear();
  fake.display = { [CLAUDE]: { x: 0.37, y: 0.63 } };
  document.documentElement.style.setProperty(tokenToCssVariable('color.accent'), '#abcdef');
  useGraphData.setState({
    loaded: true,
    error: null,
    status: null,
    nodes: [node(CLAUDE, 'claudeMd', 3), node(NOTE, 'note', 1), node(OTHER, 'note', 1)],
    edges: [
      { source: CLAUDE, target: NOTE, kind: 'wikilink' },
      { source: CLAUDE, target: OTHER, kind: 'wikilink' },
    ],
    selectedPath: null,
  });
});

afterEach(() => {
  cleanup();
  document.documentElement.style.removeProperty(tokenToCssVariable('color.accent'));
});

describe('graph view look pass (card 034)', () => {
  it('GRAPH-51 the camera centre is CLAUDE.md display position when the canvas opens and when Fit is pressed', () => {
    open();
    const centred = { x: 0.37, y: 0.63, ratio: 1, angle: 0 };
    expect(fake.animate).toHaveBeenCalledTimes(1);
    expect(fake.animate.mock.calls[0]?.[0]).toEqual(centred);
    fake.display[CLAUDE] = { x: 0.5, y: 0.25 };
    fireEvent.click(screen.getByRole('button', { name: 'Fit' }));
    expect(fake.animate).toHaveBeenCalledTimes(2);
    expect(fake.animate.mock.calls[1]?.[0]).toEqual({ x: 0.5, y: 0.25, ratio: 1, angle: 0 });
  });

  it('GRAPH-30 the note selected in the list is drawn in color.accent with the focus halo', () => {
    useGraphData.setState({ selectedPath: NOTE as never });
    open();
    const reduce = fake.instances[0]?.options.nodeReducer;
    expect(reduce).toBeDefined();
    if (reduce === undefined) return;
    const attributes = (id: string) => ({
      x: 0,
      y: 0,
      size: 5,
      color: '#111111',
      base: '#111111',
      label: id,
    });
    const selected = reduce(NOTE, attributes(NOTE));
    const plain = reduce(OTHER, attributes(OTHER));
    const pinned = reduce(CLAUDE, attributes(CLAUDE));
    expect(selected['color']).toBe('#abcdef');
    expect(plain['color']).not.toBe('#abcdef');
    expect(selected['backdropShadowBlur']).toBe(pinned['backdropShadowBlur']);
    expect(Number(selected['backdropShadowBlur'])).toBeGreaterThan(Number(plain['backdropShadowBlur']));
  });
});
