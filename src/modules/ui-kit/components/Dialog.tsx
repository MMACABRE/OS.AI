import * as RadixDialog from '@radix-ui/react-dialog';
import { useRef } from 'react';
import type { ReactNode } from 'react';
import { cx } from './cx';
import styles from './Overlay.module.css';
import { useOverlayOpen } from './overlay-state';

export type DialogProps = {
  readonly title: string;
  readonly onClose: () => void;
  /** The buttons at the bottom right, usually `<Button>`s. */
  readonly actions: ReactNode;
  readonly children?: ReactNode;
  /** Draws the title in `state.danger`. */
  readonly danger?: boolean;
  /** Called when the dialog opens; return an element to focus instead of the first focusable one. */
  readonly initialFocus?: () => HTMLElement | null;
};

/**
 * A modal dialog, open while mounted: focus is trapped, Escape closes, and focus returns to the element
 * that had it before the dialog opened (ui-kit.md "Components").
 */
export function Dialog({ title, onClose, actions, children, danger = false, initialFocus }: DialogProps) {
  const opener = useRef<HTMLElement | null>(
    typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  useOverlayOpen(true);
  return (
    <RadixDialog.Root open onOpenChange={(open) => (open ? undefined : onClose())}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={styles.dim} />
        <RadixDialog.Content
          className={styles.dialog}
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            const target = initialFocus?.() ?? null;
            if (target === null) return;
            event.preventDefault();
            target.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            opener.current?.focus();
          }}
        >
          <RadixDialog.Title className={cx(styles.title, danger && styles.dangerTitle)}>
            {title}
          </RadixDialog.Title>
          {children === undefined ? null : <div className={styles.body}>{children}</div>}
          <div className={styles.actions}>{actions}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
