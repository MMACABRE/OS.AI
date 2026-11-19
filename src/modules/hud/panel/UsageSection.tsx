import { useEffect, useState } from 'react';
import type { UsageWindow } from '@hsos/contracts/channels/claude-link';
import { EmptyState, ErrorState, ProgressBar, RollingNumber, Skeleton } from '@hsos/ui-kit';
import { useHudDeps } from './hud-context';
import { retryHudData, useHudData } from './hud-data';
import styles from './Hud.module.css';

/** HUD-26: the section title notes data older than this. */
export const STALE_USAGE_MS = 10 * 60_000;

/** HUD-25: a share is toned warn from `warnAt` and danger from `dangerAt`. */
export function usageTone(percent: number, warnAt: number, dangerAt: number): 'ok' | 'warn' | 'danger' {
  return percent >= dangerAt ? 'danger' : percent >= warnAt ? 'warn' : 'ok';
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const two = (value: number) => String(value).padStart(2, '0');

/** HUD-25: `resets 2h 10m` under 24 hours, else `resets Thu 14:00`. */
export function resetsText(resetsAt: number, now: number): string {
  const minutes = Math.max(0, Math.round((resetsAt - now) / 60_000));
  if (minutes < 24 * 60) return `resets ${Math.floor(minutes / 60)}h ${two(minutes % 60)}m`;
  const at = new Date(resetsAt);
  return `resets ${WEEKDAYS[at.getDay()] ?? ''} ${two(at.getHours())}:${two(at.getMinutes())}`;
}

/** HUD-26: "updated 14m ago" when the numbers are older than 10 minutes, else null. */
export function staleNote(updatedAt: number | null, now: number): string | null {
  if (updatedAt === null || now - updatedAt < STALE_USAGE_MS) return null;
  return `updated ${Math.round((now - updatedAt) / 60_000)}m ago`;
}

/** Re-renders every 30 s, for reset times and the stale note. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function UsageBar({ label, window, now }: { readonly label: string; readonly window: UsageWindow | null; readonly now: number }) {
  const settings = useHudData((state) => state.settings);
  if (window === null)
    return (
      <div className={styles.usageRow}>
        <span>{label}</span>
        <ProgressBar value={0} tone="info" label={`${label}: no data yet`} />
        <span className={`${styles.number} ${styles.muted}`}>–</span>
        <span className={styles.muted}>No data yet</span>
      </div>
    );
  const tone = usageTone(window.usedPercentage, settings.warnAt, settings.dangerAt);
  return (
    <div className={styles.usageRow}>
      <span>{label}</span>
      <ProgressBar value={window.usedPercentage / 100} tone={tone} label={`${label} ${Math.round(window.usedPercentage)} percent used`} />
      <span className={`${styles.number} ${styles[tone]}`}>
        <RollingNumber value={Math.round(window.usedPercentage)} format={(value) => `${value}%`} />
      </span>
      <span className={styles.resets}>{resetsText(window.resetsAt, now)}</span>
    </div>
  );
}

/** The usage bars (HUD-25, HUD-26). */
export function UsageBars() {
  const deps = useHudDeps();
  const usage = useHudData((state) => state.usage);
  const link = useHudData((state) => state.link);
  const now = useNow();
  if (link !== null && !link.isListening)
    return <ErrorState message="Claude Code link is off." onRetry={() => retryHudData(deps.bus, 'sessions')} />;
  if (usage.kind === 'loading') return <Skeleton rows={2} label="Reading usage" />;
  if (usage.kind === 'error') return <ErrorState message={`Claude Code link is off: ${usage.message}`} />;
  if (usage.value.fiveHour === null && usage.value.sevenDay === null)
    return <EmptyState title="No data yet" message="No data yet. Limits appear after a session's first reply." />;
  return (
    <div className={styles.rows}>
      <UsageBar label="5 hours" window={usage.value.fiveHour} now={now} />
      <UsageBar label="7 days" window={usage.value.sevenDay} now={now} />
    </div>
  );
}

/** The usage section's title note (HUD-26). */
export function useUsageNote(): string | null {
  const usage = useHudData((state) => state.usage);
  const now = useNow();
  return usage.kind === 'ready' ? staleNote(usage.value.updatedAt, now) : null;
}

/** Status items `hud.usage5h` and `hud.usage7d` (HUD-27): `5h 58%`, toned; hidden while null. */
export function createUsageStatus(which: 'fiveHour' | 'sevenDay', openHud: () => void) {
  const label = which === 'fiveHour' ? '5h' : '7d';
  return function UsageStatus() {
    const usage = useHudData((state) => state.usage);
    const settings = useHudData((state) => state.settings);
    const window = usage.kind === 'ready' ? usage.value[which] : null;
    if (window === null) return null;
    const tone = usageTone(window.usedPercentage, settings.warnAt, settings.dangerAt);
    return (
      <button type="button" className={`${styles.statusItem} ${styles[tone]}`} onClick={openHud}>
        {label} {Math.round(window.usedPercentage)}%
      </button>
    );
  };
}
