import { createDockview } from 'dockview';
import type { DockviewApi } from 'dockview';
import { describe, expect, it } from 'vitest';

/** jsdom has no ResizeObserver; dockview only needs it to exist. */
class StillResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= StillResizeObserver;

/** A dockview in a fresh element whose panels render an empty div. */
function makeDockview(): DockviewApi {
  const element = document.createElement('div');
  document.body.append(element);
  return createDockview(element, {
    createComponent: () => {
      const content = document.createElement('div');
      return { element: content, init: () => undefined };
    },
  });
}

/** Each panel id with the id of its group's first panel, so groups compare across instances. */
function panelsByGroup(api: DockviewApi): Record<string, string> {
  return Object.fromEntries(
    api.panels.map((panel) => [panel.id, panel.group.panels[0]?.id ?? '']),
  );
}

describe('dockview layout round trip (card 007)', () => {
  it('restores two groups and three panels from toJSON', () => {
    const first = makeDockview();
    first.layout(1000, 600);
    first.addPanel({ id: 'terminal-1', component: 'terminal' });
    first.addPanel({ id: 'file-1', component: 'file' });
    first.addPanel({ id: 'terminal-2', component: 'terminal', position: { direction: 'right' } });
    expect(first.groups).toHaveLength(2);

    const second = makeDockview();
    second.layout(1000, 600);
    second.fromJSON(first.toJSON());

    expect(second.groups).toHaveLength(2);
    expect(panelsByGroup(second)).toEqual(panelsByGroup(first));
  });
});
