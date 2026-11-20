import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Button, Dialog, List, RollingNumber, tiltToward, useReducedMotion } from '@hsos/ui-kit';
import { COMPONENTS, MOTION, composedBy, composes, ruleBody, sourceClassNames } from './css-composes';
import { changedDigits } from '../../src/modules/ui-kit/components/RollingNumber';

class StillResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeAll(() => {
  globalThis.ResizeObserver ??= StillResizeObserver;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  document.documentElement.removeAttribute('data-motion');
});

const motionCss = `${MOTION}/motion.module.css`;

describe('MOT-2 pressables lift and sink', () => {
  it('MOT-2 a Button has data-released after pointer up, and its class composes lift (scale 0.96 on :active)', () => {
    render(<Button onPress={() => undefined}>Go</Button>);
    const button = screen.getByRole('button', { name: 'Go' });
    fireEvent.pointerDown(button);
    expect(button.hasAttribute('data-released')).toBe(false);
    fireEvent.pointerUp(button);
    expect(button.hasAttribute('data-released')).toBe(true);
    expect(composes(button, `${COMPONENTS}/Button.module.css`, 'lift')).toBe(true);
    expect(ruleBody(`${MOTION}/lift.module.css`, '.lift:active:not(:disabled)')).toMatch(/scale\(0\.96\)/);
  });

  it('MOT-2 a Button pressed again clears data-released on pointer down', () => {
    render(<Button onPress={() => undefined}>Go</Button>);
    const button = screen.getByRole('button', { name: 'Go' });
    fireEvent.pointerDown(button);
    fireEvent.pointerUp(button);
    fireEvent.pointerDown(button);
    expect(button.hasAttribute('data-released')).toBe(false);
  });

  it('MOT-2 tiltToward on a 100 by 30 box with the pointer at the right edge and max 18 gives ry 18 and rx 0; 300 wide gives 9', () => {
    const narrow = tiltToward({ left: 0, top: 0, width: 100, height: 30 }, 100, 15, 18);
    expect(narrow.ry).toBe(18);
    expect(Math.abs(narrow.rx)).toBe(0);
    const wide = tiltToward({ left: 0, top: 0, width: 300, height: 30 }, 300, 15, 18);
    expect(wide.ry).toBe(9);
    expect(Math.abs(wide.rx)).toBe(0);
  });
});

describe('MOT-3 lists stagger in', () => {
  const rows = Array.from({ length: 12 }, (_, index) => ({ id: `r${index}`, text: `Row ${index}` }));

  it('MOT-3 rows 0 to 7 have animation-delay 0 to 140 ms, rows 8 to 11 have 140 ms, and the enter class is gone after 360 ms', () => {
    vi.useFakeTimers();
    render(
      <List
        rows={rows}
        rowHeight={26}
        label="Things"
        selectedId={null}
        renderRow={(row) => <span>{row.text}</span>}
        onSelect={() => undefined}
        onActivate={() => undefined}
      />,
    );
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(12);
    expect(options.map((option) => option.style.animationDelay)).toEqual([
      '0ms',
      '20ms',
      '40ms',
      '60ms',
      '80ms',
      '100ms',
      '120ms',
      '140ms',
      '140ms',
      '140ms',
      '140ms',
      '140ms',
    ]);
    const entering = options.every((option) => sourceClassNames(option).includes('rowEnter'));
    expect(entering).toBe(true);
    expect(composes(options[0] as HTMLElement, `${COMPONENTS}/List.module.css`, 'enter')).toBe(true);
    act(() => {
      vi.advanceTimersByTime(360);
    });
    for (const option of screen.getAllByRole('option')) {
      expect(sourceClassNames(option)).not.toContain('rowEnter');
      expect(option.style.animationDelay).toBe('');
    }
  });
});

describe('MOT-4 dialogs scale in', () => {
  it('MOT-4 the dialog composes dialogIn (scale 0.94 to 1 over motion.slow) and the dim composes dimIn', () => {
    render(<Dialog title="Hi" onClose={() => undefined} actions={null} />);
    const dialog = screen.getByRole('dialog');
    const overlayCss = `${COMPONENTS}/Overlay.module.css`;
    expect(composes(dialog, overlayCss, 'dialogIn')).toBe(true);
    const dim = document.querySelector('[class*="_dim_"]');
    expect(dim).not.toBeNull();
    expect(composedBy(overlayCss, 'dim').has('dimIn')).toBe(true);
    expect(ruleBody(motionCss, '.dialogIn')).toMatch(/var\(--motion-slow\)/);
    expect(ruleBody(motionCss, '.dimIn')).toMatch(/var\(--motion-slow\)/);
  });
});

describe('MOT-8 rolling digits', () => {
  it('MOT-8 a RollingNumber with value 41 re-rendered with 42 gives only the last cell the in and out spans', () => {
    const { container, rerender } = render(<RollingNumber value={41} />);
    const rolling = () =>
      [...container.querySelectorAll('span')].filter((span) => {
        const names = sourceClassNames(span);
        return names.includes('in') || names.includes('out');
      });
    expect(rolling()).toHaveLength(0);
    rerender(<RollingNumber value={42} />);
    const spans = rolling();
    expect(spans.map((span) => span.textContent)).toEqual(['1', '2']);
    const cells = [...container.querySelectorAll('[aria-hidden="true"] > span')];
    expect(cells).toHaveLength(2);
    expect(cells[0]?.querySelectorAll('span')).toHaveLength(0);
    expect(cells[1]?.querySelectorAll('span')).toHaveLength(2);
    expect(container.textContent).toContain('42');
  });

  it('MOT-8 changedDigits of "41 %" and "42 %" is false, true, false, false', () => {
    expect(changedDigits('41 %', '42 %')).toEqual([false, true, false, false]);
  });
});

describe('MOT-12 reduced motion', () => {
  function Probe() {
    return <span data-testid="reduced">{String(useReducedMotion())}</span>;
  }

  it('MOT-12 useReducedMotion is true under data-motion reduced and false again when it becomes full', async () => {
    document.documentElement.setAttribute('data-motion', 'reduced');
    render(<Probe />);
    expect(screen.getByTestId('reduced').textContent).toBe('true');
    act(() => document.documentElement.setAttribute('data-motion', 'full'));
    await waitFor(() => expect(screen.getByTestId('reduced').textContent).toBe('false'));
  });

  it('MOT-12 useReducedMotion is false with no data-motion attribute', () => {
    render(<Probe />);
    expect(screen.getByTestId('reduced').textContent).toBe('false');
  });
});
