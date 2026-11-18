import type { Bus } from '@hsos/contracts/bus';
import type { ModuleId } from '@hsos/contracts/ids';
import type {
  Clock,
  CommandDefinition,
  Logger,
  PanelDefinition,
  SettingsReader,
  SettingsSection,
  StatusItemDefinition,
  UiContext,
} from '@hsos/contracts/module';

/**
 * What the renderer's modules registered. The workspace reads panels from it (WS cards), the palette
 * reads commands, the status bar reads status items. Ids are unique; a duplicate throws at registration.
 */
export type UiRegistry = {
  readonly panels: ReadonlyMap<string, PanelDefinition<unknown>>;
  readonly commands: ReadonlyMap<string, CommandDefinition>;
  readonly statusItems: ReadonlyMap<string, StatusItemDefinition>;
  /** Set by the workspace once it can open panels; until then `openPanel` only logs. */
  setPanelOpener(opener: (type: string, state: unknown) => void): void;
};

type MutableRegistry = UiRegistry & {
  addPanel(definition: PanelDefinition<unknown>): void;
  addCommand(definition: CommandDefinition): void;
  addStatusItem(definition: StatusItemDefinition): void;
  openPanel(type: string, state: unknown): boolean;
};

function addUnique<T>(map: Map<string, T>, id: string, value: T, what: string): void {
  if (map.has(id)) throw new Error(`The ${what} ${id} is registered twice.`);
  map.set(id, value);
}

export function createUiRegistry(): MutableRegistry {
  const panels = new Map<string, PanelDefinition<unknown>>();
  const commands = new Map<string, CommandDefinition>();
  const statusItems = new Map<string, StatusItemDefinition>();
  let opener: ((type: string, state: unknown) => void) | null = null;
  return {
    panels,
    commands,
    statusItems,
    setPanelOpener: (next) => {
      opener = next;
    },
    addPanel: (definition) => addUnique(panels, definition.type, definition, 'panel type'),
    addCommand: (definition) => addUnique(commands, definition.id, definition, 'command'),
    addStatusItem: (definition) => addUnique(statusItems, definition.id, definition, 'status item'),
    openPanel: (type, state) => {
      if (opener === null) return false;
      opener(type, state);
      return true;
    },
  };
}

export type UiContextDeps = {
  readonly bus: Bus;
  readonly clock: Clock;
  readonly registry: ReturnType<typeof createUiRegistry>;
  logFor(moduleId: ModuleId): Logger;
  /** Settings sections are read from main once settings exist (card 016); until then the defaults. */
  settings?<T>(section: SettingsSection<T>): SettingsReader<T>;
};

/** The `UiContext` one module registers with (architecture §4, card 014). */
export function createUiContext(moduleId: ModuleId, deps: UiContextDeps): UiContext {
  const log = deps.logFor(moduleId);
  return {
    moduleId,
    bus: deps.bus,
    log,
    clock: deps.clock,
    // A panel's state type is checked by its own stateSchema when the workspace restores it.
    registerPanel: (definition) => deps.registry.addPanel(definition as PanelDefinition<unknown>),
    registerCommand: (definition) => deps.registry.addCommand(definition),
    registerStatusItem: (definition) => deps.registry.addStatusItem(definition),
    settings: (section) =>
      deps.settings?.(section) ?? { get: () => section.defaults, onChange: () => () => undefined },
    openPanel: (type, state) => {
      if (!deps.registry.openPanel(type, state)) log.log('warn', 'shell.open_panel_early', { type });
    },
  };
}
