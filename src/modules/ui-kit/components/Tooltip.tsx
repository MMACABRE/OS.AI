import * as RadixTooltip from '@radix-ui/react-tooltip';
import type { ReactElement } from 'react';
import { Kbd } from './Kbd';
import styles from './Tooltip.module.css';

/** Tooltips open after this long (ui-kit.md "Components"). */
export const TOOLTIP_DELAY_MS = 500;

export type TooltipProps = {
  readonly text: string;
  readonly keyBinding?: string | null;
  /** The one element the tooltip describes; it must accept a ref and focus. */
  readonly children: ReactElement;
};

/** A tooltip with the name and, when known, the key binding (UI-3). Opens on hover and keyboard focus. */
export function Tooltip({ text, keyBinding, children }: TooltipProps) {
  return (
    <RadixTooltip.Provider delayDuration={TOOLTIP_DELAY_MS}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content className={styles.content} sideOffset={6} collisionPadding={8}>
            <span>{text}</span>
            {keyBinding === undefined || keyBinding === null ? null : <Kbd binding={keyBinding} />}
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
