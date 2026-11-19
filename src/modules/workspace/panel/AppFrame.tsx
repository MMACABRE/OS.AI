import { useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import type { Bus } from '@hsos/contracts/bus';
import { workspaceChannels } from '@hsos/contracts/channels/workspace';
import type { ProjectInfo } from '@hsos/contracts/channels/workspace';
import type { Logger, PanelDefinition, StatusItemDefinition } from '@hsos/contracts/module';
import { Backdrop, PageVisibleContext } from '@hsos/ui-kit';
import type { DockControl } from './DockHost';
import './frame.css';
import styles from './Frame.module.css';
import { PAGES, usePageStore } from './page-store';
import type { PageId } from './page-store';
import { goToPage, PAGE_TRANSITION_NAME } from './page-transition';
import { areaOf, CodePage, DashboardPage, NotesPage, useSideStore } from './Pages';
import type { PageProps } from './Pages';
import { StatusBar } from './StatusBar';
import { TitleBar } from './TitleBar';
import { WelcomeView } from './WelcomeView';

/** What the frame reads from the shell's registry (architecture §4). */
export type FrameRegistry = {
  readonly panels: ReadonlyMap<string, PanelDefinition<unknown>>;
  readonly statusItems: ReadonlyMap<string, StatusItemDefinition>;
  readonly commands: ReadonlyMap<string, { run(): void | Promise<void> }>;
  setPanelOpener(opener: (type: string, state: unknown) => void): void;
};

export type AppFrameProps = {
  readonly bus: Bus | null;
  readonly registry: FrameRegistry | null;
  readonly log: Logger;
  readonly keyFor: (commandId: string) => string | null;
  readonly message: string;
};

const PAGE_COMPONENTS: Readonly<Record<PageId, ComponentType<PageProps>>> = {
  dashboard: DashboardPage,
  code: CodePage,
  notes: NotesPage,
};

const NO_PANELS: ReadonlyMap<string, PanelDefinition<unknown>> = new Map();

/**
 * The window: the background (UI-30, mounted once), the title bar, the three pages and the status bar
 * (layout.md). Pages mount the first time they are shown and stay mounted; hidden pages are `inert`
 * and skip rendering (WS-41).
 */
export function AppFrame({ bus, registry, log, keyFor, message }: AppFrameProps) {
  const page = usePageStore((state) => state.page);
  const shown = usePageStore((state) => state.shown);
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const docks = useRef<Partial<Record<'code' | 'notes', DockControl>>>({});

  useEffect(() => {
    if (bus === null) return undefined;
    void bus.call(workspaceChannels.getCurrentProject, {}).then((result) => {
      if (result.ok) setProject(result.value);
    });
    return bus.on(workspaceChannels.projectChanged, setProject);
  }, [bus]);

  const runCommand = useCallback(
    (commandId: string) => void registry?.commands.get(commandId)?.run(),
    [registry],
  );
  const hasCommand = useCallback((commandId: string) => registry?.commands.has(commandId) === true, [registry]);

  // WS-11, WS-12, WS-43: side views open in their area, dock panels in the dock of the page they belong to.
  useEffect(() => {
    registry?.setPanelOpener((type, state) => {
      const definition = registry.panels.get(type);
      if (definition === undefined) {
        log.log('warn', 'workspace.unknown_panel', { type });
        return;
      }
      if (definition.kind === 'side') {
        useSideStore.getState().open(areaOf(type), type);
        goToPage('code');
        return;
      }
      const target = usePageStore.getState().page === 'notes' && docks.current.notes !== undefined ? 'notes' : 'code';
      if (target === 'code') goToPage('code');
      // A dock mounts with its page; open once it is ready.
      const open = () => docks.current[target]?.open(type, state);
      if (docks.current[target] === undefined) setTimeout(open, 0);
      else open();
    });
  }, [registry, log]);

  const pageProps = (id: PageId): PageProps => ({
    panels: registry?.panels ?? NO_PANELS,
    log,
    runCommand,
    hasCommand,
    onDockReady: (control) => {
      if (id === 'code' || id === 'notes') docks.current[id] = control;
    },
    welcome: bus !== null && project === null ? <WelcomeView bus={bus} /> : null,
  });

  return (
    <div className={styles.frame}>
      <Backdrop />
      <TitleBar bus={bus} project={project} keyFor={keyFor} runCommand={runCommand} />
      <main className={styles.pages}>
        {PAGES.filter((id) => shown.has(id)).map((id) => {
          const visible = id === page;
          const Page = PAGE_COMPONENTS[id];
          return (
            <section
              key={id}
              data-page={id}
              aria-label={`${id} page`}
              className={visible ? styles.page : `${styles.page} ${styles.hiddenPage}`}
              style={visible ? { viewTransitionName: PAGE_TRANSITION_NAME } : undefined}
              inert={!visible}
            >
              <PageVisibleContext.Provider value={visible}>
                <Page {...pageProps(id)} />
              </PageVisibleContext.Provider>
            </section>
          );
        })}
      </main>
      <StatusBar items={registry?.statusItems.values() ?? []} message={message} />
    </div>
  );
}
