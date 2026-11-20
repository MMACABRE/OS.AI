import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { List } from '@hsos/ui-kit';
import type { ListRow } from '@hsos/ui-kit';

const heightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');

/** jsdom lays nothing out, so the container is 260 px tall by stub. */
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 260 });
});
afterEach(() => {
  cleanup();
  if (heightDescriptor !== undefined)
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', heightDescriptor);
  else Reflect.deleteProperty(HTMLElement.prototype, 'clientHeight');
});

const makeRows = (count: number): ListRow[] =>
  Array.from({ length: count }, (_, index) => ({ id: `r${index}`, text: `Row ${index}` }));

type Spies = { onSelect: (id: string) => void; onActivate: (id: string) => void };

function Harness({ rows, spies }: { rows: ListRow[]; spies: Spies }) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <List
      rows={rows}
      rowHeight={26}
      label="Things"
      selectedId={selected}
      renderRow={(row) => <span>{row.text}</span>}
      onSelect={(id) => {
        setSelected(id);
        spies.onSelect(id);
      }}
      onActivate={spies.onActivate}
    />
  );
}

describe('UI-7 List windows its rows', () => {
  it('UI-7 with 1000 rows of height 26 in a 260 px container fewer than 60 options are in the DOM', () => {
    render(<Harness rows={makeRows(1000)} spies={{ onSelect: vi.fn(), onActivate: vi.fn() }} />);
    const count = screen.getAllByRole('option').length;
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(60);
  });

  it('UI-7 with 10000 rows fewer than 100 options are in the DOM', () => {
    render(<Harness rows={makeRows(10_000)} spies={{ onSelect: vi.fn(), onActivate: vi.fn() }} />);
    expect(screen.getAllByRole('option').length).toBeLessThan(100);
  });

  it('UI-7 with 150 rows all 150 are in the DOM', () => {
    render(<Harness rows={makeRows(150)} spies={{ onSelect: vi.fn(), onActivate: vi.fn() }} />);
    expect(screen.getAllByRole('option')).toHaveLength(150);
  });
});

describe('UI-2 List keyboard', () => {
  it('UI-2 ArrowDown, ArrowUp, Home and End move the selection through onSelect', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Harness rows={makeRows(5)} spies={{ onSelect, onActivate: vi.fn() }} />);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('listbox'));
    await user.keyboard('{ArrowDown}');
    expect(onSelect).toHaveBeenLastCalledWith('r0');
    await user.keyboard('{ArrowDown}');
    expect(onSelect).toHaveBeenLastCalledWith('r1');
    await user.keyboard('{ArrowUp}');
    expect(onSelect).toHaveBeenLastCalledWith('r0');
    await user.keyboard('{End}');
    expect(onSelect).toHaveBeenLastCalledWith('r4');
    await user.keyboard('{Home}');
    expect(onSelect).toHaveBeenLastCalledWith('r0');
  });

  it('UI-2 Enter calls onActivate with the selected id', async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    render(<Harness rows={makeRows(5)} spies={{ onSelect: vi.fn(), onActivate }} />);
    await user.tab();
    await user.keyboard('{ArrowDown}{ArrowDown}');
    await user.keyboard('{Enter}');
    expect(onActivate).toHaveBeenCalledWith('r1');
  });

  it('UI-2 typing b then e quickly selects the first row whose text starts with be', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const rows = [
      { id: 'a', text: 'Alpha' },
      { id: 'b', text: 'Bravo' },
      { id: 'c', text: 'Beta' },
      { id: 'd', text: 'Bee' },
      { id: 'e', text: 'Delta' },
    ];
    render(<Harness rows={rows} spies={{ onSelect, onActivate: vi.fn() }} />);
    await user.tab();
    await user.keyboard('be');
    expect(onSelect).toHaveBeenLastCalledWith('c');
  });
});
