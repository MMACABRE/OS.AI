import { useHudData } from './hud-data';
import { focusTerminal } from './send-command';
import styles from './Hud.module.css';

/** Status item `hud.attention` (HUD-12): `n need you` in accent; pressing it goes to the first one. */
export function createAttentionStatus() {
  return function AttentionStatus() {
    const count = useHudData(
      (state) => [...state.sessions.values()].filter((session) => session.activity === 'needs-you').length,
    );
    if (count === 0) return null;
    const goToFirst = () => {
      const first = [...useHudData.getState().sessions.values()].find(
        (session) => session.activity === 'needs-you' && session.terminalId !== null,
      );
      if (first?.terminalId !== null && first?.terminalId !== undefined) focusTerminal(first.terminalId);
    };
    return (
      <button type="button" className={`${styles.statusItem} ${styles.warn}`} onClick={goToFirst}>
        {count} need you
      </button>
    );
  };
}
