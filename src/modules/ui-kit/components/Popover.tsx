import * as RadixPopover from '@radix-ui/react-popover';
import { useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import styles from './Overlay.module.css';
import { useOverlayOpen } from './overlay-state';

export type PopoverProps = {
  /** The trigger: one element that accepts a ref. */
  readonly children: ReactElement;
  readonly label: string;
  readonly content: ReactNode;
};

/** A popover anchored to its trigger: it scales from 0.96 at the anchor (MOT-4) on the overlay surface. */
export function Popover({ children, label, content }: PopoverProps) {
  const [open, setOpen] = useState(false);
  useOverlayOpen(open);
  return (
    <RadixPopover.Root open={open} onOpenChange={setOpen}>
      <RadixPopover.Trigger asChild>{children}</RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content className={styles.popover} aria-label={label} sideOffset={6} align="start">
          {content}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}
