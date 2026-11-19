import { useEffect, useState } from 'react';
import { z } from 'zod';
import type { Bus } from '@hsos/contracts/bus';
import { claudeLinkChannels } from '@hsos/contracts/channels/claude-link';
import type { ClaudeSession } from '@hsos/contracts/channels/claude-link';
import type { WidgetSize, WidgetType } from '@hsos/contracts/channels/dashboard';
import { Button, EmptyState } from '@hsos/ui-kit';
import { relativeTime } from '../format';
import styles from './Widgets.module.css';

/** The dashboard widget `sessions.recent` (dashboard.md catalog): the newest sessions of every project. */
export const RECENT_SESSION_ROWS = 6;

type Props = { readonly cells: WidgetSize };

/** The newest sessions first, every project (SESS-30 with no project). */
export function newestSessions(sessions: readonly ClaudeSession[], limit: number): ClaudeSession[] {
  return [...sessions].sort((a, b) => b.startedAt - a.startedAt).slice(0, limit);
}

function RecentSessions({ cells, bus, open }: Props & { readonly bus: Bus; readonly open: () => void }) {
  const [sessions, setSessions] = useState<readonly ClaudeSession[] | null>(null);
  useEffect(() => {
    let alive = true;
    void bus.call(claudeLinkChannels.listSessions, {}).then((result) => {
      if (alive) setSessions(result.ok ? result.value : []);
    });
    return () => {
      alive = false;
    };
  }, [bus]);
  if (sessions === null) return null;
  if (sessions.length === 0) return <EmptyState message="No sessions yet." />;
  const rows = newestSessions(sessions, Math.max(1, cells.h * 2 - 1));
  return (
    <div className={styles.list}>
      {rows.map((session) => (
        <button key={session.sessionId} type="button" className={styles.row} onClick={open}>
          <span>{session.title}</span>
          <span className={styles.muted}>{relativeTime(session.startedAt)}</span>
        </button>
      ))}
      <Button size="small" onPress={open}>
        All
      </Button>
    </div>
  );
}

/** The `sessions.recent` widget type. Activating a row or "All" opens Session History (SESS-32). */
export function recentSessionsType(bus: Bus, openHistory: () => void): WidgetType {
  const Component = (props: Props) => <RecentSessions {...props} bus={bus} open={openHistory} />;
  return {
    id: 'sessions.recent',
    title: 'Recent sessions',
    moduleId: 'sessions',
    minSize: { w: 2, h: 2 },
    maxSize: { w: 8, h: 6 },
    defaultSize: { w: 4, h: 3 },
    frame: 'box',
    configSchema: z.unknown(),
    defaultConfig: null,
    component: Component as unknown as WidgetType['component'],
    activate: () => openHistory(),
  };
}
