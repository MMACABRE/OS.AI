import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { PanelDefinition } from '@hsos/contracts/module';
import { z } from 'zod';
import { NotesPage } from '../../src/modules/workspace/panel/Pages';

afterEach(cleanup);

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
});

const definition = (type: string, kind: 'side' | 'dock', testId: string): PanelDefinition<unknown> => ({
  type,
  kind,
  title: type,
  icon: 'file',
  stateSchema: z.unknown(),
  initialState: {},
  allowMultiple: false,
  component: () => <div data-testid={testId} />,
});

describe('Notes page (card 034 look pass)', () => {
  it('WS-43 the graph is one page layer between the list and the dock and not a dock tab', () => {
    const panels = new Map([
      ['graph.view', definition('graph.view', 'dock', 'graph-layer')],
      ['graph.notes', definition('graph.notes', 'side', 'notes-list')],
    ]);
    render(
      <NotesPage
        panels={panels}
        log={{ log: () => undefined }}
        runCommand={() => undefined}
        hasCommand={() => false}
        onDockReady={() => undefined}
        welcome={null}
      />,
    );
    expect(screen.getAllByTestId('graph-layer')).toHaveLength(1);
    const graph = screen.getByTestId('graph-layer');
    const list = screen.getByTestId('notes-list');
    const dock = document.querySelector('[class*="notesDock"]');
    expect(dock).not.toBeNull();
    if (dock === null) return;
    expect(graph.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(list.compareDocumentPosition(dock) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(dock.contains(graph)).toBe(false);
    expect(screen.queryByRole('tab', { name: /graph/i })).toBeNull();
  });
});
