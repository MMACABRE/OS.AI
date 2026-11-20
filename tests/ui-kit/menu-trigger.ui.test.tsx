import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Menu } from '@hsos/ui-kit';

afterEach(cleanup);

describe('Menu triggers (ui-kit)', () => {
  it('UI-MENU-1b a Menu opens from a plain button trigger', async () => {
    const onSelect = vi.fn();
    render(
      <Menu items={[{ label: 'Do it', onSelect }]}>
        <button type="button">More</button>
      </Menu>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Do it' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
