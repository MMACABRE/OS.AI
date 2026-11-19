import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { terminalHeader } from '@hsos/contracts/channels/terminal';
import type { TerminalId } from '@hsos/contracts/ids';
import { useUiContributions } from '@hsos/ui-kit';
import styles from './TerminalPanel.module.css';

export type HeaderSlotProps = {
  readonly terminalId: TerminalId;
  /** Called with the header's height whenever it changes, so the terminal can be refitted (TERM-75). */
  readonly onHeightChange: (height: number) => void;
};

/**
 * The slot above a terminal's rows (TERM-75): the first contribution to `terminalHeader` whose
 * `render` returns content. The terminal module knows nothing about what it shows.
 */
export function HeaderSlot({ terminalId, onHeightChange }: HeaderSlotProps) {
  const contributions = useUiContributions(terminalHeader);
  const host = useRef<HTMLDivElement>(null);
  let content: ReactNode = null;
  for (const contribution of contributions) {
    const rendered = contribution.render(terminalId);
    if (rendered !== null && rendered !== undefined) {
      content = rendered as ReactNode;
      break;
    }
  }
  useEffect(() => {
    const element = host.current;
    if (element === null) return undefined;
    let last = -1;
    const observer = new ResizeObserver(() => {
      const height = element.offsetHeight;
      if (height === last) return;
      last = height;
      onHeightChange(height);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [onHeightChange]);
  return (
    <div ref={host} className={styles.header}>
      {content}
    </div>
  );
}
