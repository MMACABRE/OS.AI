import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Mascot, setMascotProblemReporter } from '../../src/modules/hud/panel/mascot/Mascot';

const sheetPath = '../../src/modules/hud/panel/mascot/mascot-sheet';

/** The sheet in this file is unreadable, as when resources/art is missing (HUD-91). */
vi.mock('../../src/modules/hud/panel/mascot/mascot-sheet', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/modules/hud/panel/mascot/mascot-sheet')>();
  return {
    ...actual,
    loadMascotSheet: () => ({ kind: 'placeholder', problem: 'mascot.json could not be read: missing' }),
  };
});

afterEach(cleanup);

describe('HUD-91 a missing sprite sheet', () => {
  it('HUD-91 loadMascotSheet("not json") gives a placeholder with a problem', async () => {
    const actual =
      await vi.importActual<typeof import('../../src/modules/hud/panel/mascot/mascot-sheet')>(sheetPath);
    const sheet = actual.loadMascotSheet('not json');
    expect(sheet.kind).toBe('placeholder');
    expect(sheet.kind === 'placeholder' ? sheet.problem : '').toMatch(/mascot\.json/);
  });

  it('HUD-91 loadMascotSheet with a map that fails the schema gives a placeholder', async () => {
    const actual =
      await vi.importActual<typeof import('../../src/modules/hud/panel/mascot/mascot-sheet')>(sheetPath);
    expect(actual.loadMascotSheet('{"cell": 16}').kind).toBe('placeholder');
  });

  it('HUD-91 the component draws the two blocks, throws nothing and reports the problem once', () => {
    const reporter = vi.fn();
    setMascotProblemReporter(reporter);
    const first = render(<Mascot activity="working" page="code" scale={2} />);
    const mascot = first.container.querySelector('[data-mascot]');
    expect(mascot).not.toBeNull();
    expect(mascot?.querySelectorAll('span')).toHaveLength(2);
    expect(mascot?.querySelector('img')).toBeNull();
    render(<Mascot activity="idle" page="other" scale={1} />);
    expect(reporter).toHaveBeenCalledTimes(1);
    expect(reporter.mock.calls[0]?.[0]).toContain('mascot.json');
  });
});
