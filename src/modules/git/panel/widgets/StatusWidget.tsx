import { useEffect, useState } from 'react';
import { z } from 'zod';
import type { Bus } from '@hsos/contracts/bus';
import { gitChannels } from '@hsos/contracts/channels/git';
import type { RepoStatus } from '@hsos/contracts/channels/git';
import type { WidgetSize, WidgetType } from '@hsos/contracts/channels/dashboard';
import { workspaceChannels } from '@hsos/contracts/channels/workspace';
import { EmptyState, RollingNumber } from '@hsos/ui-kit';
import styles from './Widgets.module.css';

type Props = { readonly cells: WidgetSize };

/** The dashboard widget `git.status` (dashboard.md catalog): branch, ahead and behind, number of changes. */
function GitStatus({ bus, open }: Props & { readonly bus: Bus; readonly open: () => void }) {
  const [status, setStatus] = useState<RepoStatus | null>(null);
  useEffect(() => {
    let alive = true;
    void bus.call(workspaceChannels.getCurrentProject, {}).then(async (project) => {
      if (!project.ok || project.value === null) return;
      const repo = await bus.call(gitChannels.getStatus, { root: project.value.path });
      if (alive && repo.ok) setStatus(repo.value);
    });
    return () => {
      alive = false;
    };
  }, [bus]);
  if (status === null) return null;
  if (status.kind !== 'repo') return <EmptyState message="This project is not a git repository." />;
  return (
    <button type="button" className={styles.card} onClick={open}>
      <span className={styles.muted}>{status.branch ?? 'detached'}</span>
      <span>{`ahead ${status.ahead} · behind ${status.behind}`}</span>
      <RollingNumber value={status.files.length} format={(value: number) => `${value} changes`} />
    </button>
  );
}

/** The `git.status` widget type. Activating it opens the Changes view (GIT-14, review.changes). */
export function gitStatusType(bus: Bus, openChanges: () => void): WidgetType {
  const Component = (props: Props) => <GitStatus {...props} bus={bus} open={openChanges} />;
  return {
    id: 'git.status',
    title: 'Git status',
    moduleId: 'git',
    minSize: { w: 2, h: 1 },
    maxSize: { w: 4, h: 3 },
    defaultSize: { w: 2, h: 2 },
    frame: 'box',
    configSchema: z.unknown(),
    defaultConfig: null,
    component: Component as unknown as WidgetType['component'],
    activate: () => openChanges(),
  };
}
