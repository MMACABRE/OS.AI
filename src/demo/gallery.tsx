import { Component, createElement } from 'react';
import type { ComponentType, ReactNode } from 'react';
import type { Bus, Envelope } from '@hsos/contracts/bus';
import { dashboardWidgets } from '@hsos/contracts/channels/dashboard';
import type { WidgetType } from '@hsos/contracts/channels/dashboard';
import type { PanelId } from '@hsos/contracts/ids';
import type { Logger, PanelDefinition, PanelProps } from '@hsos/contracts/module';
import { err } from '@hsos/contracts/result';
import type { Result } from '@hsos/contracts/result';
import {
  CommandsContext,
  PageVisibleContext,
  ToastProvider,
  UiKitActionsContext,
  uiContributions,
} from '../modules/ui-kit';
import { createBus } from '../modules/shell/bus/create-bus';
import type { Peer, Transport } from '../modules/shell/bus/transport';
import { loadModules } from '../modules/shell/loader/load-modules';
import { createUiContext, createUiRegistry } from '../modules/shell/loader/ui-context';
import type { UiRegistry } from '../modules/shell/loader/ui-context';
import { systemClock } from '../modules/shell/system-clock';
import { createModuleLogger, uiModules } from '../ui/module-list';
import { ALL_FIXTURES } from './fixtures';
import { createDemoTransport } from './demo-transport';
import { REQUEST_CHANNELS } from './all-channels';
import styles from './gallery.module.css';

/** The four states every panel and widget is shown in (visual-direction.md "Panel states"). */
export const GALLERY_STATES = ['loading', 'empty', 'error', 'ready'] as const;
export type GalleryState = (typeof GALLERY_STATES)[number];

/** Answers in the empty and error states come this long after the request (ms). */
const ANSWER_MS = 120;
const silent: Logger = { log: () => undefined };

/** The answer of one request in a state: empty, or an error. Loading never answers (the calls hang). */
function answerFor(state: 'empty' | 'error', channel: string): Result<unknown> {
  if (state === 'error') return err('INTERNAL', `The gallery has no data for ${channel} in this state.`);
  const schema = REQUEST_CHANNELS.get(channel)?.response;
  for (const candidate of [[], null, {}])
    if (schema?.safeParse(candidate).success === true) return { ok: true, value: candidate };
  return err('INTERNAL', `No empty value fits ${channel}.`);
}

/**
 * The transport of one state. Loading never answers; empty and error answer every request as described; ready
 * forwards to the demo transport and its fixtures.
 */
function stateTransport(state: GalleryState, inner: Transport): Transport {
  const listeners: ((envelope: Envelope, from: Peer) => void)[] = [];
  return {
    send(envelope) {
      if (state === 'ready') return inner.send(envelope);
      if (envelope.kind !== 'req' || state === 'loading') return;
      const payload = answerFor(state, envelope.channel);
      systemClock.after(ANSWER_MS, () => {
        for (const listener of listeners)
          listener({ v: 1, kind: 'res', id: envelope.id, channel: envelope.channel, payload }, 'main');
      });
    },
    onMessage(listener) {
      if (state === 'ready') inner.onMessage(listener);
      else listeners.push(listener);
    },
  };
}

/** One state's pass: its own bus and registry, and the widgets this pass contributed. */
type Pass = {
  readonly state: GalleryState;
  readonly registry: UiRegistry;
  readonly widgets: readonly WidgetType[];
};

/**
 * Loads the renderer's modules once for a state. Widgets are global contributions, so the pass keeps the ones it
 * added. NOTE: module stores are singletons; see the progress note on shared stores.
 */
function buildPass(state: GalleryState, inner: Transport): Pass {
  const bus: Bus = createBus({
    process: 'ui',
    transport: stateTransport(state, inner),
    clock: systemClock,
    log: silent,
    owns: () => false,
  });
  const registry = createUiRegistry();
  const before = new Set<WidgetType>(uiContributions(dashboardWidgets));
  loadModules(
    uiModules,
    (id) =>
      createUiContext(id, {
        bus,
        clock: systemClock,
        registry,
        logFor: (module) => createModuleLogger(bus, systemClock, module),
      }),
    silent,
  );
  const widgets = uiContributions(dashboardWidgets).filter((entry) => !before.has(entry));
  return { state, registry, widgets };
}

/** One tile's error boundary: a throwing panel or widget shows its own message and the rest of the page goes on. */
class TileBoundary extends Component<
  { readonly label: string; readonly children: ReactNode },
  { readonly failed: string | null }
> {
  override state = { failed: null as string | null };
  static getDerivedStateFromError(error: Error) {
    return { failed: error.message };
  }
  override render() {
    if (this.state.failed !== null)
      return <p className={styles.failed}>{`${this.props.label} threw: ${this.state.failed}`}</p>;
    return this.props.children;
  }
}

function Tile({
  pass,
  title,
  size,
  children,
}: {
  readonly pass: Pass;
  readonly title: string;
  readonly size: 'panel' | 'widget';
  readonly children: (pass: Pass) => ReactNode;
}) {
  return (
    <figure className={styles.tile} data-state={pass.state} data-size={size}>
      <figcaption className={styles.caption}>
        <span>{title}</span>
        <span className={styles.stateName}>{pass.state}</span>
      </figcaption>
      <div className={styles.frame}>
        <TileBoundary label={title}>
          <CommandsContext.Provider value={{ registry: pass.registry.commandRegistry, keyFor: () => null }}>
            <UiKitActionsContext.Provider value={{ openLog: () => undefined }}>
              <PageVisibleContext.Provider value={true}>{children(pass)}</PageVisibleContext.Provider>
            </UiKitActionsContext.Provider>
          </CommandsContext.Provider>
        </TileBoundary>
      </div>
    </figure>
  );
}

const noop = () => undefined;

/** A panel rendered with its initial state, as the workspace's side views and dashboard page render it (WS-14). */
function panelTile(definition: PanelDefinition<unknown>) {
  return function PanelBody(pass: Pass) {
    const found = pass.registry.panels.get(definition.type);
    if (found === undefined) return <p className={styles.muted}>Not registered in this state.</p>;
    const props: PanelProps<unknown> = {
      panelId: `gallery${definition.type}` as PanelId,
      state: found.initialState,
      setState: noop,
      isFocused: false,
    };
    return createElement(found.component as ComponentType<PanelProps<unknown>>, props);
  };
}

/** A widget at its default size, as the dashboard draws it (DASH-12). */
function widgetTile(type: WidgetType) {
  return function WidgetBody(pass: Pass) {
    const found = pass.widgets.find((entry) => entry.id === type.id);
    if (found === undefined) return <p className={styles.muted}>Not contributed in this state.</p>;
    const props = {
      config: found.defaultConfig,
      cells: found.defaultSize,
      pixels: { width: 400, height: 260 },
      setConfig: noop,
    };
    return createElement(found.component as unknown as ComponentType<typeof props>, props);
  };
}

/** The module a panel type belongs to: the part before the first dot. */
const moduleOfPanel = (type: string) => type.split('.')[0] ?? type;

/**
 * The state gallery (`npm run demo -- --gallery`, card 036): every registered panel and dashboard widget, each in
 * loading, empty, error and ready, side by side, grouped by module. Four passes load the modules, one per state.
 */
let cache: readonly Pass[] | null = null;

/** The four passes, built once: each one loads the modules and so starts their loaders. */
function galleryPasses(): readonly Pass[] {
  if (cache === null) {
    const inner = createDemoTransport({ fixtures: ALL_FIXTURES, clock: systemClock, log: silent });
    cache = GALLERY_STATES.map((state) => buildPass(state, inner));
  }
  return cache;
}

export function Gallery() {
  const passes = galleryPasses();
  const ready = passes[passes.length - 1];
  if (ready === undefined) return null;
  const panels = [...ready.registry.panels.values()].sort((a, b) => a.type.localeCompare(b.type));
  const widgets = [...ready.widgets];
  const groups = new Map<string, { panels: PanelDefinition<unknown>[]; widgets: WidgetType[] }>();
  const group = (module: string) => {
    const existing = groups.get(module) ?? { panels: [], widgets: [] };
    groups.set(module, existing);
    return existing;
  };
  for (const panel of panels) group(moduleOfPanel(panel.type)).panels.push(panel);
  for (const widget of widgets) group(widget.moduleId).widgets.push(widget);
  const names = [...groups.keys()].sort();
  return (
    <ToastProvider>
      <main className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>State gallery</h1>
          <p className={styles.muted}>
            Each row is one panel or widget. The four columns are its states: loading never answers, empty
            answers with empty values, error answers with an error, ready uses the demo fixtures.
          </p>
        </header>
        {names.map((name) => {
          const entry = groups.get(name);
          if (entry === undefined) return null;
          return (
            <section key={name} className={styles.group} aria-label={name}>
              <h2 className={styles.groupTitle}>{name}</h2>
              {entry.panels.map((definition) => (
                <div key={definition.type} className={styles.row}>
                  <h3 className={styles.rowTitle}>{definition.type}</h3>
                  <div className={styles.states}>
                    {passes.map((pass) => (
                      <Tile key={pass.state} pass={pass} title={definition.title} size="panel">
                        {panelTile(definition)}
                      </Tile>
                    ))}
                  </div>
                </div>
              ))}
              {entry.widgets.map((widgetType) => (
                <div key={widgetType.id} className={styles.row}>
                  <h3 className={styles.rowTitle}>{`${widgetType.id} (widget)`}</h3>
                  <div className={styles.states}>
                    {passes.map((pass) => (
                      <Tile key={pass.state} pass={pass} title={widgetType.title} size="widget">
                        {widgetTile(widgetType)}
                      </Tile>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          );
        })}
      </main>
    </ToastProvider>
  );
}
