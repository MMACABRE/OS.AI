import { describe, expect, it } from 'vitest';
import { DEFAULT_LAYOUT } from '../../src/modules/dashboard/panel/placement';

describe('dashboard default layout (DASH-22)', () => {
  it('DASH-22 screen 1 follows the approved mockup', () => {
    const screenOne = Object.fromEntries(
      DEFAULT_LAYOUT.widgets
        .filter((widget) => widget.screen === 0)
        .map((widget) => [widget.type, [widget.x, widget.y, widget.w, widget.h]]),
    );
    expect(screenOne).toEqual({
      'hud.ribbon': [0, 0, 2, 3],
      'hud.sessions': [0, 3, 2, 3],
      'graph.mini': [2, 0, 4, 5],
      'hud.quickBar': [2, 5, 4, 1],
      'hud.mascot': [6, 0, 2, 3],
      'hud.usage': [6, 3, 2, 2],
      'hud.context': [6, 5, 2, 1],
    });
  });
});
