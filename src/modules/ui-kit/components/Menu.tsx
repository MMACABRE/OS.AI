import * as RadixContextMenu from '@radix-ui/react-context-menu';
import * as RadixDropdownMenu from '@radix-ui/react-dropdown-menu';
import { useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';
import type { IconProps } from './Icon';
import { Kbd } from './Kbd';
import styles from './Overlay.module.css';
import { useOverlayOpen } from './overlay-state';

export type MenuItem =
  | {
      readonly label: string;
      readonly icon?: IconProps['name'];
      readonly keyBinding?: string | null;
      readonly danger?: boolean;
      readonly disabled?: boolean;
      readonly onSelect: () => void;
    }
  | { readonly separator: true };

export type MenuProps = {
  readonly items: readonly MenuItem[];
  /** `dropdown` opens from the trigger on press; `context` opens on right-click inside the trigger area. */
  readonly kind?: 'dropdown' | 'context';
  /** The trigger: one element that accepts a ref (dropdown), or the area that takes the right-click (context). */
  readonly children: ReactElement;
};

type Parts = typeof RadixDropdownMenu | typeof RadixContextMenu;

function renderItems(parts: Parts, items: readonly MenuItem[]): ReactNode {
  return items.map((item, index) =>
    'separator' in item ? (
      <parts.Separator key={`separator-${index}`} className={styles.separator} />
    ) : (
      <parts.Item
        key={`${item.label}-${index}`}
        className={cx(styles.item, item.danger === true && styles.itemDanger)}
        disabled={item.disabled === true}
        onSelect={item.onSelect}
      >
        <span className={styles.itemIcon} aria-hidden="true">
          {item.icon === undefined ? null : <Icon name={item.icon} />}
        </span>
        <span>{item.label}</span>
        {item.keyBinding === undefined || item.keyBinding === null ? null : (
          <span className={styles.itemKey}>
            <Kbd binding={item.keyBinding} />
          </span>
        )}
      </parts.Item>
    ),
  );
}

/** Context and dropdown menus (ui-kit.md "Components"); arrow keys move, Enter selects, Escape closes. */
export function Menu({ items, kind = 'dropdown', children }: MenuProps) {
  const [open, setOpen] = useState(false);
  useOverlayOpen(open);
  if (kind === 'context')
    return (
      <RadixContextMenu.Root onOpenChange={setOpen}>
        <RadixContextMenu.Trigger asChild>{children}</RadixContextMenu.Trigger>
        <RadixContextMenu.Portal>
          <RadixContextMenu.Content className={styles.menu} collisionPadding={8}>
            {renderItems(RadixContextMenu, items)}
          </RadixContextMenu.Content>
        </RadixContextMenu.Portal>
      </RadixContextMenu.Root>
    );
  return (
    <RadixDropdownMenu.Root open={open} onOpenChange={setOpen}>
      <RadixDropdownMenu.Trigger asChild>{children}</RadixDropdownMenu.Trigger>
      <RadixDropdownMenu.Portal>
        <RadixDropdownMenu.Content className={styles.menu} sideOffset={4} collisionPadding={8}>
          {renderItems(RadixDropdownMenu, items)}
        </RadixDropdownMenu.Content>
      </RadixDropdownMenu.Portal>
    </RadixDropdownMenu.Root>
  );
}
