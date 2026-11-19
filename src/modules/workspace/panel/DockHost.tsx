import { Component, useEffect, useRef, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { createDockview } from 'dockview';
import type { DockviewApi } from 'dockview';
import 'dockview/dist/styles/dockview.css';
import type { PanelId } from '@hsos/contracts/ids';
import type { Logger, PanelDefinition } from '@hsos/contracts/module';
import { EmptyState, ErrorState } from '@hsos/ui-kit';
import type { StateAction } from '@hsos/ui-kit';
import styles from './DockHost.module.css';

/** One dock panel as the host renders it: dockview owns `element`, React renders into it. */
type HostedPanel = {
  readonly id: string;
  readonly type: string;
  readonly element: HTMLElement;
  readonly state: unknown;
};

/** What the frame can do with a dock: open a panel of a registered type (WS-11). */
export type DockControl = {
  open(type: string, state: unknown): void;
};

export type DockHostProps = {
  readonly label: string;
  readonly panels: ReadonlyMap<string, PanelDefinition<unknown>>;
  readonly log: Logger;
  /** Called once with the dock's control when it is ready. */
  readonly onReady: (control: DockControl) => void;
  readonly emptyActions?: { readonly action?: StateAction | undefined; readonly secondaryAction?: StateAction | undefined };
};

let nextPanel = 0;

/**
 * A dock on `dockview` (card 007): split, tab and drag (WS-34). Each panel renders through a React portal
 * into dockview's element, so it shares the app's providers, and inside an error boundary of its own
 * (WS-13). With no panel open it shows the dock's empty state.
 */
export function DockHost({ label, panels, log, onReady, emptyActions }: DockHostProps) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<DockviewApi | null>(null);
  const [hosted, setHosted] = useState<readonly HostedPanel[]>([]);
  const [focused, setFocused] = useState<string | null>(null);
  const [states, setStates] = useState<ReadonlyMap<string, unknown>>(new Map());

  useEffect(() => {
    const element = host.current;
    if (element === null) return undefined;
    const dock = createDockview(element, {
      className: styles.dockview ?? '',
      createComponent: (options) => {
        const content = document.createElement('div');
        content.className = styles.panel ?? '';
        return {
          element: content,
          init: (params) => {
            const parameters = params.params as { type?: string; state?: unknown };
            const entry: HostedPanel = {
              id: options.id,
              type: parameters.type ?? options.name,
              element: content,
              state: parameters.state,
            };
            setHosted((current) => [...current.filter((panel) => panel.id !== entry.id), entry]);
          },
          dispose: () => setHosted((current) => current.filter((panel) => panel.id !== options.id)),
        };
      },
    });
    api.current = dock;
    const active = dock.onDidActivePanelChange((change) => setFocused(change.panel?.id ?? null));
    const resize = new ResizeObserver(() => dock.layout(element.clientWidth, element.clientHeight));
    resize.observe(element);
    onReady({
      open: (type, state) => {
        const definition = panels.get(type);
        if (definition === undefined || definition.kind !== 'dock') {
          log.log('warn', 'workspace.unknown_panel', { type });
          return;
        }
        const existing = dock.panels.find((panel) => (panel.params as { type?: string }).type === type);
        if (existing !== undefined && !definition.allowMultiple) {
          if (state !== undefined) setStates((current) => new Map(current).set(existing.id, state));
          existing.api.setActive();
          return;
        }
        nextPanel += 1;
        dock.addPanel({
          id: `${type}-${nextPanel}`,
          component: type,
          title: definition.title,
          params: { type, state: state ?? definition.initialState },
        });
      },
    });
    return () => {
      active.dispose();
      resize.disconnect();
      dock.dispose();
      api.current = null;
    };
    // The dock is created once; `panels`, `log` and `onReady` are stable for the window's life.
  }, []);

  return (
    <section className={styles.dock} aria-label={label}>
      <div ref={host} className={styles.host} />
      {hosted.length === 0 ? (
        <div className={styles.empty}>
          <EmptyState
            title="No panels open"
            message="Open a terminal or a file to start."
            {...(emptyActions?.action === undefined ? {} : { action: emptyActions.action })}
            {...(emptyActions?.secondaryAction === undefined ? {} : { secondaryAction: emptyActions.secondaryAction })}
          />
        </div>
      ) : null}
      {hosted.map((panel) => {
        const definition = panels.get(panel.type);
        if (definition === undefined) return null;
        const Panel = definition.component;
        const state = states.has(panel.id) ? states.get(panel.id) : panel.state;
        return createPortal(
          <PanelBoundary key={panel.id} title={definition.title} log={log}>
            <Panel
              panelId={panel.id as PanelId}
              state={state}
              setState={(next) => setStates((current) => new Map(current).set(panel.id, next))}
              isFocused={focused === panel.id}
            />
          </PanelBoundary>,
          panel.element,
          panel.id,
        );
      })}
    </section>
  );
}

type BoundaryProps = { readonly title: string; readonly log: Logger; readonly children: ReactNode };

/** A panel that throws while rendering shows the error state in its own frame (WS-13, P-12). */
class PanelBoundary extends Component<BoundaryProps, { readonly error: Error | null; readonly attempt: number }> {
  override state = { error: null as Error | null, attempt: 0 };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.log.log('error', 'workspace.panel_failed', {
      title: this.props.title,
      message: error.message,
      stack: info.componentStack ?? '',
    });
  }

  override render() {
    if (this.state.error === null) return <div key={this.state.attempt}>{this.props.children}</div>;
    return (
      <ErrorState
        message={`${this.props.title} failed: ${this.state.error.message}`}
        onRetry={() => this.setState((state) => ({ error: null, attempt: state.attempt + 1 }))}
      />
    );
  }
}
