import type { ReactNode } from 'react';
import { cx } from './cx';
import type { SurfaceRole } from './surface-alpha';
import styles from './Surface.module.css';

export type SurfaceProps = {
  readonly role: SurfaceRole;
  /** The surface holds reading text (editor, transcript, viewer): its opacity never goes below `surface.text.minAlpha`. */
  readonly reading?: boolean;
  readonly children?: ReactNode;
};

/**
 * The only way a panel, widget or overlay gets its background (UI-31): its role's colour at
 * `surface.<role>.alpha` over the animated background, blurred by `surface.<role>.blur` when above 0.
 */
export function Surface({ role, reading = false, children }: SurfaceProps) {
  return (
    <div className={cx(styles.surface, styles[role], reading && styles.reading)} data-surface={role}>
      {children}
    </div>
  );
}
