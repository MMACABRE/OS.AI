import { useEffect, useState } from 'react';
import { z } from 'zod';
import type { Bus } from '@hsos/contracts/bus';
import { activityChannels } from '@hsos/contracts/channels/activity';
import type { ActivityEntry } from '@hsos/contracts/channels/activity';
import type { WidgetSize, WidgetType } from '@hsos/contracts/channels/dashboard';
import { workspaceChannels } from '@hsos/contracts/channels/workspace';
import { EmptyState } from '@hsos/ui-kit';
import { relativeTime, splitPath } from '../format';
import styles from './Widgets.module.css';

type Props = { readonly cells: WidgetSize };

/** The `activity.recent` widget (dashboard.md catalog): the newest activity events of the open project. */
function ActivityRecent({ cells, bus, open }: Props & { readonly bus: Bus; readonly open: () => void }) {
  const [entries, setEntries] = useState<readonly ActivityEntry[] | null>(null);
  useEffect(() => {
    let alive = true;
    void bus.call(workspaceChannels.getCurrentProject, {}).then(async (project) => {
      if (!project.ok || project.value === null) return setEntries([]);
      const timeline = await bus.call(activityChannels.listTimeline, {
        projectId: project.value.id,
        limit: 50,
        before: null,
        cause: null,
        sessionId: null,
      });
      if (alive) setEntries(timeline.ok ? timeline.value : []);
    });
    return () => {
      alive = false;
    };
  }, [bus]);
  if (entries === null) return null;
  if (entries.length === 0) return <EmptyState message="No activity yet." />;
  return (
    <div className={styles.list}>
      {entries.slice(0, Math.max(1, cells.h * 2 - 1)).map((entry) => {
        const parts = splitPath(entry.relPath);
        return (
          <button key={entry.snapshotId} type="button" className={styles.row} onClick={open}>
            <span>{parts.name}</span>
            <span className={styles.muted}>{relativeTime(entry.time)}</span>
          </button>
        );
      })}
    </div>
  );
}

/** The `activity.recent` widget type. Activating it opens the Activity timeline. */
export function activityRecentType(bus: Bus, openTimeline: () => void): WidgetType {
  const Component = (props: Props) => <ActivityRecent {...props} bus={bus} open={openTimeline} />;
  return {
    id: 'activity.recent',
    title: 'Recent activity',
    moduleId: 'activity',
    minSize: { w: 2, h: 2 },
    maxSize: { w: 8, h: 6 },
    defaultSize: { w: 4, h: 2 },
    frame: 'box',
    configSchema: z.unknown(),
    defaultConfig: null,
    component: Component as unknown as WidgetType['component'],
    activate: () => openTimeline(),
  };
}
