# H3 src bugs (not fixed by H3)

Found while writing card 034 and 035 tests. Tests for these rows are not in the committed files.

## DASH-9 (dashboard undo window)

# Lane h3: dashboard UI bug notes (card 035)

Test file: tests/dashboard/dashboard.ui.test.tsx (12 tests, all green).

## Open src bugs (rows whose test is NOT in the committed file)

### DASH-9: Undo window is 4 s, the row says 5 s

- Src: src/modules/ui-kit/components/Toast.tsx line 10 (TOAST_MS = 4_000, used at line 38 for every toast).
  The removal toast is raised at src/modules/dashboard/panel/DashboardPage.tsx lines 333 to 337, which sets no duration.
- Spec: spec/modules/dashboard.md DASH-9 says "a toast with Undo stays 5 seconds". The ui-kit spec says toasts last 4 s. The two specs disagree, so the Lead or owner must pick one.
- Test code removed from the file (it was a probe, not kept):

```
  it('DASH-9 probe: Undo is still offered at 4.9 s after the removal', () => {
    vi.useFakeTimers();
    contributeType('test.box', { title: 'Box thing' });
    setDashboard({ editing: true, widgets: [cell('gone', 'test.box', 3, 1)] });
    renderPage();
    fireEvent.click(within(widgetEl('gone')).getByRole('button', { name: 'Remove widget' }));
    act(() => {
      vi.advanceTimersByTime(4900);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(document.querySelector('[data-widget="' + idOf('gone') + '"]')).not.toBeNull();
  });
```

- Failure message: Unable to find an accessible element with the role "button" and name "Undo" (the toast had already been dismissed at 4000 ms). The committed DASH-9 test checks Undo right after the removal and passes.


## GRAPH-29 and GRAPH-52 (graph)

# H3 bug notes: graph and browser UI tests (card 034)

Two rows of the graph module failed against src and were removed from the committed test file so it stays green. The Lead merges this file.

## BUG-H3-1: GRAPH-29 labels for the 30 largest nodes show above 5 000 nodes

- Rule: GRAPH-29 (spec/modules/graph.md: "With more than 5 000 nodes, labels show only on hover and search"). untested.md marks it NOT BUILT.
- Source: src/modules/graph/panel/GraphView.tsx:313 (`if (top.has(id) || f.matches.has(id) || zoomed) label = node.label;`), with the top set from src/modules/graph/panel/graph-model.ts:8 (LABELLED_NODES = 30) and :47 (largestNodes). No 5 000-node rule exists.
- Failure: `AssertionError: expected 'n0' to be null` (the 6 000-node case, top node by degree; the 5 000-node rule is not implemented).
- Test code (removed from tests/graph/graph-view.ui.test.tsx):

```tsx
  it('GRAPH-29 with 6000 nodes only hovered and matched labels show', () => {
    const many: GraphNode[] = [];
    for (let index = 0; index < 6000; index += 1)
      many.push(node({ id: ROOT + '/n' + String(index) + '.md', degree: index === 0 ? 500 : 1 }));
    setGraph(many);
    renderGraph();
    expect(reduced(ROOT + '/n0.md')['label']).toBeNull();
    expect(reduced(ROOT + '/n5000.md')['label']).toBeNull();
  });
```

## BUG-H3-2: GRAPH-52 graph nodes are not steam sources

- Rule: GRAPH-52 (spec/modules/graph.md: each drawn node is a steam source, the open note at 3 times the strength). untested.md marks it NOT BUILT.
- Source: src/modules/graph/panel/GraphView.tsx:121 (canvas ref `screen`; nothing calls useBackdropSource for nodes); src/modules/ui-kit/backdrop/sources.ts (only useBackdropSource / addBackdropSource register sources; the graph never does).
- Failure: `AssertionError: expected [] to have a length of 3 but got +0`
- Test code (removed from tests/graph/graph-view.ui.test.tsx):

```tsx
  it('GRAPH-52 each drawn node is a steam source and the open note is three times as strong', async () => {
    const { visibleBackdropSources } = await import('../../src/modules/ui-kit/backdrop/sources');
    const spy = vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as never);
    setGraph([node({ id: A }), node({ id: B }), node({ id: C })]);
    useGraphData.setState({ selectedPath: A as never });
    renderGraph({ positions: at({ [A]: [0, 0], [B]: [50, 0], [C]: [0, 50] }) });
    const sources = visibleBackdropSources(() => ({ r: 0, g: 0, b: 0 }) as never, { width: 800, height: 600 });
    expect(sources).toHaveLength(3);
    const strengths = sources.map((source) => source.strength);
    expect(Math.max(...strengths)).toBe(3 * Math.min(...strengths));
    spy.mockRestore();
  });
```

