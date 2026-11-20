import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Menu } from '@hsos/ui-kit';
import { Icon, IconButton } from '@hsos/ui-kit';

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

describe('Menu triggers (ui-kit) IconButton', () => {
  it('UI-MENU-1 a Menu opens from an IconButton trigger', async () => {
    const onSelect = vi.fn();
    render(
      <Menu items={[{ label: 'Do it', onSelect }]}>
        <IconButton icon={<Icon name="more" />} label="More" onPress={() => undefined} />
      </Menu>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Do it' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
