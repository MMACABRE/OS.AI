import { createElement } from 'react';
import { create } from 'zustand';
import type { PanelId } from '@hsos/contracts/ids';
import type { Logger, PanelDefinition } from '@hsos/contracts/module';
import { EmptyState, Icon, IconButton } from '@hsos/ui-kit';
import type { IconName } from '@hsos/ui-kit';
import { DockHost } from './DockHost';
import type { DockControl } from './DockHost';
import styles from './Frame.module.css';

export type PageProps = {
  readonly panels: ReadonlyMap<string, PanelDefinition<unknown>>;
  readonly log: Logger;
  readonly runCommand: (commandId: string) => void;
  readonly hasCommand: (commandId: string) => boolean;
  readonly onDockReady: (control: DockControl) => void;
};

type Area = 'left' | 'right';

type SideState = {
  readonly active: Readonly<Record<Area, string | null>>;
  readonly collapsed: Readonly<Record<Area, boolean>>;
  /** Shows `type` in `area` and expands it (WS-12); its own button again collapses the area (WS-30). */
  press(area: Area, type: string): void;
  open(area: Area, type: string): void;
};

/** The side and right areas of the Code page. Width is the layout default until resizing lands (WS-31). */
export const useSideStore = create<SideState>((set) => ({
  active: { left: null, right: null },
  collapsed: { left: false, right: false },
  press: (area, type) =>
    set((state) => {
      const same = state.active[area] === type && !state.collapsed[area];
      return {
        active: { ...state.active, [area]: type },
        collapsed: { ...state.collapsed, [area]: same },
      };
    }),
  open: (area, type) =>
    set((state) => ({
      active: { ...state.active, [area]: type },
      collapsed: { ...state.collapsed, [area]: false },
    })),
}));

/** The area a side view lives in by default: the HUD on the right, everything else on the left (layout.md). */
export const areaOf = (type: string): Area => (type.startsWith('hud.') ? 'right' : 'left');

const sideViews = (panels: ReadonlyMap<string, PanelDefinition<unknown>>, area: Area) =>
  [...panels.values()].filter((panel) => panel.kind === 'side' && areaOf(panel.type) === area);

/** A side view rendered with its initial state; side view state is saved with the workspace later (WS-14). */
function SideView({ definition }: { readonly definition: PanelDefinition<unknown> }) {
  return createElement(definition.component, {
    panelId: definition.type as PanelId,
    state: definition.initialState,
    setState: () => undefined,
    isFocused: false,
  });
}

/** The Code page: side view tabs and the side area, the dock, and the right area (layout.md "Areas"). */
export function CodePage({ panels, log, runCommand, hasCommand, onDockReady }: PageProps) {
  const active = useSideStore((state) => state.active);
  const collapsed = useSideStore((state) => state.collapsed);
  const press = useSideStore((state) => state.press);
  const left = sideViews(panels, 'left');
  const right = sideViews(panels, 'right');
  const leftView = panels.get(active.left ?? left[0]?.type ?? '');
  const rightView = panels.get(active.right ?? right[0]?.type ?? '');
  return (
    <div className={styles.codePage}>
      <aside className={styles.side} aria-label="Side views">
        <div className={styles.sideTabs} role="toolbar" aria-label="Side view tabs">
          {left.map((view) => (
            <IconButton
              key={view.type}
              icon={<Icon name={view.icon as IconName} />}
              label={view.title}
              pressed={leftView?.type === view.type && !collapsed.left}
              onPress={() => press('left', view.type)}
            />
          ))}
          {hasCommand('settings.open') ? (
            <span className={styles.sideTabsEnd}>
              <IconButton icon={<Icon name="settings" />} label="Settings" onPress={() => runCommand('settings.open')} />
            </span>
          ) : null}
        </div>
        {leftView === undefined || collapsed.left ? null : (
          <div className={styles.sideContent}>
            <SideView definition={leftView} />
          </div>
        )}
      </aside>
      <DockHost
        label="Code dock"
        panels={panels}
        log={log}
        onReady={onDockReady}
        emptyActions={{
          action: hasCommand('terminal.new') ? { label: 'New terminal', onPress: () => runCommand('terminal.new') } : undefined,
          secondaryAction: hasCommand('files.goToFile')
            ? { label: 'Open file', onPress: () => runCommand('files.goToFile') }
            : undefined,
        }}
      />
      {rightView === undefined || collapsed.right ? null : (
        <aside className={styles.right} aria-label="Right area">
          <SideView definition={rightView} />
        </aside>
      )}
    </div>
  );
}

/** The Notes page: the notes list floating on the left and the notes dock (WS-43, layout.md "Pages"). */
export function NotesPage({ panels, log, onDockReady }: PageProps) {
  const notesList = panels.get('graph.notes');
  return (
    <div className={styles.notesPage}>
      {notesList === undefined ? null : (
        <aside className={styles.notesList} aria-label="Notes">
          <SideView definition={notesList} />
        </aside>
      )}
      <DockHost label="Notes dock" panels={panels} log={log} onReady={onDockReady} />
    </div>
  );
}

/** The Dashboard: the widget screens of the dashboard module (DASH-1), when it is registered. */
export function DashboardPage({ panels }: PageProps) {
  const screens = panels.get('dashboard.screens');
  return (
    <div className={styles.dashboardPage}>
      {screens === undefined ? (
        <EmptyState title="Dashboard" message="Widgets for sessions, usage and notes appear here." />
      ) : (
        <SideView definition={screens} />
      )}
    </div>
  );
}
