import { useEffect, useRef, useState } from 'react';
import type { Bus } from '@hsos/contracts/bus';
import { gitChannels } from '@hsos/contracts/channels/git';
import type { RepoStatus } from '@hsos/contracts/channels/git';
import { shellChannels } from '@hsos/contracts/channels/shell';
import { workspaceChannels } from '@hsos/contracts/channels/workspace';
import type { ProjectInfo, RecentProject } from '@hsos/contracts/channels/workspace';
import { Kbd, Menu, useLift } from '@hsos/ui-kit';
import type { MenuItem } from '@hsos/ui-kit';
import { PAGE_TITLES, PAGES, usePageStore } from './page-store';
import { goToPage } from './page-transition';
import styles from './TitleBar.module.css';

/** The switcher marker's `view-transition-name`: it slides to the new page (MOT-6). */
export const PAGE_MARKER_NAME = 'hsos-page-marker';

export type TitleBarProps = {
  readonly bus: Bus | null;
  readonly project: ProjectInfo | null;
  /** The effective key of a command, for the palette hint. */
  readonly keyFor: (commandId: string) => string | null;
  readonly runCommand: (commandId: string) => void;
};

/**
 * The title bar of `design/layout.md`: wordmark, clock, page switcher (WS-40), project switcher (WS-6),
 * repo button (WS-30, GIT-14) and the palette hint. It is a drag region except over its controls; the
 * window's own controls are drawn by Windows in the title bar overlay on the right.
 */
export function TitleBar({ bus, project, keyFor, runCommand }: TitleBarProps) {
  const paletteKey = keyFor('shell.commandPalette');
  const lift = useLift();
  return (
    <header className={styles.titleBar}>
      <Wordmark />
      <Clock />
      <ProjectSwitcher bus={bus} project={project} />
      <RepoButton bus={bus} project={project} />
      <PageSwitcher />
      <div className={styles.grow} />
      {paletteKey === null ? null : (
        <button
          type="button"
          className={styles.hint}
          aria-label="Show all commands"
          onClick={() => runCommand('shell.commandPalette')}
          {...lift}
        >
          <Kbd binding={paletteKey} />
        </button>
      )}
    </header>
  );
}

/** `HSOS` in the display font. It breathes; a light band sweeps across it on hover, press and every 6 to 15 s. */
function Wordmark() {
  const [sweep, setSweep] = useState(0);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const next = () => {
      timer = setTimeout(() => {
        setSweep((count) => count + 1);
        next();
      }, 6_000 + Math.random() * 9_000);
    };
    next();
    return () => clearTimeout(timer);
  }, []);
  const again = () => setSweep((count) => count + 1);
  return (
    <div className={styles.wordmark} aria-label="HSOS" role="img" onPointerEnter={again} onPointerDown={again}>
      <span aria-hidden="true">HSOS</span>
      <span key={sweep} className={sweep === 0 ? styles.band : `${styles.band} ${styles.sweep}`} aria-hidden="true">
        HSOS
      </span>
    </div>
  );
}

const twoDigits = (value: number) => String(value).padStart(2, '0');

/** Local time `HH:MM` in `color.live` with a blinking colon; the seconds show on hover. */
function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(timer);
  }, []);
  const time = `${twoDigits(now.getHours())}:${twoDigits(now.getMinutes())}`;
  return (
    <time className={styles.clock} dateTime={now.toISOString()} aria-label={`Time ${time}`}>
      {twoDigits(now.getHours())}
      <span className={styles.colon}>:</span>
      {twoDigits(now.getMinutes())}
      <span className={styles.seconds}>:{twoDigits(now.getSeconds())}</span>
    </time>
  );
}

/** Dashboard, Code, Notes with a marker under the active one (WS-40). */
function PageSwitcher() {
  const page = usePageStore((state) => state.page);
  const lift = useLift();
  return (
    <nav className={styles.pages} aria-label="Pages">
      {PAGES.map((id) => {
        const active = id === page;
        return (
          <button
            key={id}
            type="button"
            className={active ? `${styles.page} ${styles.activePage}` : styles.page}
            aria-current={active ? 'page' : undefined}
            onClick={() => goToPage(id)}
            {...lift}
          >
            {active ? <span className={styles.marker} style={{ viewTransitionName: PAGE_MARKER_NAME }} /> : null}
            <span className={styles.pageLabel}>{PAGE_TITLES[id]}</span>
          </button>
        );
      })}
    </nav>
  );
}

/** The project name; its menu lists recent projects, "Open folder" and "Close project" (WS-6). */
function ProjectSwitcher({ bus, project }: { readonly bus: Bus | null; readonly project: ProjectInfo | null }) {
  const [recent, setRecent] = useState<readonly RecentProject[]>([]);
  useEffect(() => {
    if (bus === null) return;
    void bus.call(workspaceChannels.listRecentProjects, {}).then((result) => {
      if (result.ok) setRecent(result.value);
    });
  }, [bus, project]);
  const lift = useLift();
  if (bus === null) return null;
  const open = (path: RecentProject['path']) => void bus.call(workspaceChannels.openProject, { path });
  const items: MenuItem[] = [
    ...recent
      .filter((entry) => entry.path !== project?.path)
      .map((entry) => ({
        label: entry.name,
        icon: 'folder' as const,
        disabled: !entry.exists,
        onSelect: () => open(entry.path),
      })),
    ...(recent.length > 1 ? [{ separator: true as const }] : []),
    {
      label: 'Open folder',
      icon: 'folder-open',
      onSelect: () =>
        void bus.call(shellChannels.pickFolder, { title: 'Open folder' }).then((result) => {
          if (result.ok && result.value !== null) open(result.value);
        }),
    },
    {
      label: 'Close project',
      icon: 'close',
      disabled: project === null,
      onSelect: () => void bus.call(workspaceChannels.closeProject, {}),
    },
  ];
  return (
    <Menu items={items}>
      <button type="button" className={styles.project} aria-label="Project menu" {...lift}>
        {project?.name ?? 'No project'}
        <span className={styles.caret} aria-hidden="true">
          ▾
        </span>
      </button>
    </Menu>
  );
}

/** `owner/repo` from a GitHub page URL (GIT-14), or null. */
export function repoName(webUrl: string | null): string | null {
  if (webUrl === null) return null;
  try {
    const parts = new URL(webUrl).pathname.split('/').filter((part) => part !== '');
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;
  } catch {
    return null;
  }
}

/** The repo button: `owner/repo`, branch and ahead/behind; opens `webUrl`. Hidden without a remote (WS-30). */
function RepoButton({ bus, project }: { readonly bus: Bus | null; readonly project: ProjectInfo | null }) {
  const [status, setStatus] = useState<RepoStatus | null>(null);
  const root = useRef<string | null>(null);
  useEffect(() => {
    root.current = project?.path ?? null;
    setStatus(null);
    if (bus === null || project === null) return undefined;
    void bus.call(gitChannels.getStatus, { root: project.path }).then((result) => {
      if (result.ok && root.current === project.path) setStatus(result.value);
    });
    return bus.on(gitChannels.statusChanged, (next) => {
      if (next.kind === 'repo' && next.root === root.current) setStatus(next);
    });
  }, [bus, project]);
  const lift = useLift();
  if (bus === null || status === null || status.kind !== 'repo' || status.webUrl === null) return null;
  const name = repoName(status.webUrl);
  const webUrl = status.webUrl;
  if (name === null) return null;
  return (
    <button
      type="button"
      className={styles.repo}
      title={`Open ${name} on GitHub`}
      onClick={() => void bus.call(shellChannels.openExternal, { url: webUrl })}
      {...lift}
    >
      <span className={styles.repoIcon} aria-hidden="true" />
      {name}
      {status.branch === null ? null : <span className={styles.branch}>{status.branch}</span>}
      <span className={styles.aheadBehind}>
        ↑{status.ahead} ↓{status.behind}
      </span>
    </button>
  );
}
