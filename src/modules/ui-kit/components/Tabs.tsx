import { useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { cx } from './cx';
import styles from './Tabs.module.css';

export type TabItem = { readonly id: string; readonly label: string };

export type TabsProps = {
  readonly tabs: readonly TabItem[];
  readonly activeId: string;
  readonly onChange: (id: string) => void;
  readonly label: string;
};

/**
 * Tabs inside a panel (dock tabs belong to `workspace`). Left and Right move between tabs and select them,
 * Home and End go to the ends; only the active tab is in the Tab order.
 */
export function Tabs({ tabs, activeId, onChange, label }: TabsProps) {
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const go = (index: number) => {
    const tab = tabs[(index + tabs.length) % tabs.length];
    if (tab === undefined) return;
    onChange(tab.id);
    buttons.current.get(tab.id)?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = tabs.findIndex((tab) => tab.id === activeId);
    const moves: Record<string, number> = {
      ArrowRight: current + 1,
      ArrowLeft: current - 1,
      Home: 0,
      End: tabs.length - 1,
    };
    const target = moves[event.key];
    if (target === undefined) return;
    event.preventDefault();
    go(target);
  };
  return (
    <div className={styles.tabs} role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            ref={(element) => {
              if (element === null) buttons.current.delete(tab.id);
              else buttons.current.set(tab.id, element);
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            className={cx(styles.tab, active && styles.active)}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
