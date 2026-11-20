import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProgressBar, SplitView, Tabs } from '@hsos/ui-kit';

afterEach(cleanup);

describe('UI-2 Tabs', () => {
  it('UI-2 arrow keys change and focus the tab, Home and End go to the ends', async () => {
    const user = userEvent.setup();
    const seen: string[] = [];
    function Harness() {
      const [active, setActive] = useState('a');
      return (
        <Tabs
          label="Views"
          activeId={active}
          tabs={[
            { id: 'a', label: 'Alpha' },
            { id: 'b', label: 'Beta' },
            { id: 'c', label: 'Gamma' },
          ]}
          onChange={(id) => {
            seen.push(id);
            setActive(id);
          }}
        />
      );
    }
    render(<Harness />);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Alpha' }));
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Beta' }).getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Beta' }));
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Gamma' }));
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Beta' }));
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Alpha' }));
    expect(seen).toEqual(['b', 'c', 'b', 'a']);
  });
});

describe('UI-2 SplitView', () => {
  const rectDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'getBoundingClientRect');
  beforeEach(() => {
    HTMLElement.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 1000, 500);
  });
  afterEach(() => {
    if (rectDescriptor !== undefined)
      Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', rectDescriptor);
  });

  it('UI-2 arrow keys on the separator change aria-valuenow', () => {
    render(
      <SplitView direction="horizontal" initialSizes={[0.5, 0.5]} minSizes={[100, 100]}>
        <div>left</div>
        <div>right</div>
      </SplitView>,
    );
    const separator = screen.getByRole('separator');
    expect(separator.getAttribute('aria-valuenow')).toBe('50');
    fireEvent.keyDown(separator, { key: 'ArrowRight' });
    expect(separator.getAttribute('aria-valuenow')).toBe('52');
    fireEvent.keyDown(separator, { key: 'ArrowLeft' });
    fireEvent.keyDown(separator, { key: 'ArrowLeft' });
    expect(separator.getAttribute('aria-valuenow')).toBe('48');
  });

  it('UI-2 the separator never moves a pane below its minSize', () => {
    render(
      <SplitView direction="horizontal" initialSizes={[0.5, 0.5]} minSizes={[200, 300]}>
        <div>left</div>
        <div>right</div>
      </SplitView>,
    );
    const separator = screen.getByRole('separator');
    for (let press = 0; press < 40; press += 1) fireEvent.keyDown(separator, { key: 'ArrowLeft' });
    // 200 px of 1000 px is 20 %.
    expect(separator.getAttribute('aria-valuenow')).toBe('20');
    for (let press = 0; press < 80; press += 1) fireEvent.keyDown(separator, { key: 'ArrowRight' });
    // The right pane keeps 300 px, so the left pane stops at 70 %.
    expect(separator.getAttribute('aria-valuenow')).toBe('70');
  });
});

describe('UI-2 ProgressBar', () => {
  it('UI-2 ProgressBar clamps 1.4 to aria-valuenow 100 and 0.5 to 50', () => {
    const { rerender } = render(<ProgressBar value={1.4} tone="ok" label="Context" />);
    expect(screen.getByRole('progressbar', { name: 'Context' }).getAttribute('aria-valuenow')).toBe('100');
    rerender(<ProgressBar value={0.5} tone="ok" label="Context" />);
    expect(screen.getByRole('progressbar', { name: 'Context' }).getAttribute('aria-valuenow')).toBe('50');
    rerender(<ProgressBar value={-3} tone="ok" label="Context" />);
    expect(screen.getByRole('progressbar', { name: 'Context' }).getAttribute('aria-valuenow')).toBe('0');
  });
});
