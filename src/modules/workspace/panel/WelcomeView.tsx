import { useEffect, useState } from 'react';
import type { Bus } from '@hsos/contracts/bus';
import { shellChannels } from '@hsos/contracts/channels/shell';
import { workspaceChannels } from '@hsos/contracts/channels/workspace';
import type { RecentProject } from '@hsos/contracts/channels/workspace';
import { Button, ErrorState, Icon, Skeleton, useToast } from '@hsos/ui-kit';
import styles from './WelcomeView.module.css';

type Recent =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'ready'; readonly projects: readonly RecentProject[] };

/** "3 days ago" style age of a project's last opening. */
function ago(time: number, now: number): string {
  const minutes = Math.max(0, Math.round((now - time) / 60_000));
  if (minutes < 60) return minutes <= 1 ? 'just now' : `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

/**
 * The welcome view (WS-5): recent projects and one primary button, "Open folder". Enter or a click on a
 * row opens it; a folder that is gone is muted and offers "Remove from list". With no project open it is
 * the Dashboard's first screen (WS-44).
 */
export function WelcomeView({ bus }: { readonly bus: Bus }) {
  const toast = useToast();
  const [recent, setRecent] = useState<Recent>({ kind: 'loading' });

  const load = () =>
    void bus.call(workspaceChannels.listRecentProjects, {}).then((result) =>
      setRecent(
        result.ok
          ? { kind: 'ready', projects: [...result.value].sort((a, b) => b.lastOpened - a.lastOpened) }
          : { kind: 'error', message: result.error.message },
      ),
    );
  useEffect(load, [bus]);

  const open = (path: RecentProject['path']) =>
    void bus.call(workspaceChannels.openProject, { path }).then((result) => {
      if (!result.ok) toast.show({ tone: 'error', message: result.error.message });
    });
  const pick = () =>
    void bus.call(shellChannels.pickFolder, { title: 'Open folder' }).then((result) => {
      if (result.ok && result.value !== null) open(result.value);
    });
  const forget = (path: RecentProject['path']) =>
    void bus.call(workspaceChannels.forgetRecentProject, { path }).then(load);

  const now = Date.now();
  return (
    <section className={styles.welcome} aria-label="Welcome">
      <h1 className={styles.title}>Open a project</h1>
      <p className={styles.line}>A project is a folder. Its terminals, notes and layout come back when you open it again.</p>
      <div className={styles.actions}>
        <Button variant="primary" icon={<Icon name="folder-open" />} onPress={pick}>
          Open folder
        </Button>
      </div>
      <h2 className={styles.heading}>Recent</h2>
      {recent.kind === 'loading' ? <Skeleton rows={3} label="Reading recent projects" /> : null}
      {recent.kind === 'error' ? (
        <ErrorState message={`Recent projects could not be read. ${recent.message}`} onRetry={load} />
      ) : null}
      {recent.kind === 'ready' && recent.projects.length === 0 ? (
        <p className={styles.muted}>Projects you open appear here.</p>
      ) : null}
      {recent.kind === 'ready' && recent.projects.length > 0 ? (
        <ul className={styles.list}>
          {recent.projects.map((project) => (
            <li key={project.path} className={styles.item} data-missing={!project.exists || undefined}>
              <button
                type="button"
                className={styles.row}
                disabled={!project.exists}
                onClick={() => open(project.path)}
              >
                <Icon name="folder" />
                <span className={styles.name}>{project.name}</span>
                <span className={styles.path}>{project.path}</span>
                <span className={styles.when}>{project.exists ? ago(project.lastOpened, now) : 'Folder not found'}</span>
              </button>
              {project.exists ? null : (
                <Button size="small" variant="ghost" onPress={() => forget(project.path)}>
                  Remove from list
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
