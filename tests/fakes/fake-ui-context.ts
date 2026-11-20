import type { Bus } from '@hsos/contracts/bus';
import type {
  CommandDefinition,
  PanelDefinition,
  SettingsSection,
  StatusItemDefinition,
  UiContext,
} from '@hsos/contracts/module';
import { createFakeClock } from './fake-clock';

export type FakeUiContext = UiContext & {
  readonly panels: PanelDefinition<never>[];
  readonly commands: CommandDefinition[];
  readonly statusItems: StatusItemDefinition[];
  readonly opened: { readonly type: string; readonly state: unknown }[];
  panel(type: string): PanelDefinition<never>;
  command(id: string): CommandDefinition;
};

/** A UiContext that records what a module registers and opens. `settings` maps a module id to its values. */
export function createFakeUiContext(
  moduleId: UiContext['moduleId'],
  bus: Bus,
  settingValues: Record<string, unknown> = {},
): FakeUiContext {
  const panels: PanelDefinition<never>[] = [];
  const commands: CommandDefinition[] = [];
  const statusItems: StatusItemDefinition[] = [];
  const opened: { type: string; state: unknown }[] = [];
  return {
    moduleId,
    bus,
    log: { log: () => undefined },
    clock: createFakeClock(),
    panels,
    commands,
    statusItems,
    opened,
    registerPanel(definition) {
      panels.push(definition as unknown as PanelDefinition<never>);
    },
    registerCommand(definition) {
      commands.push(definition);
    },
    registerStatusItem(definition) {
      statusItems.push(definition);
    },
    settings<T>(section: SettingsSection<T>) {
      const value = (settingValues[section.moduleId] ?? section.defaults) as T;
      return { get: () => value, onChange: () => () => undefined };
    },
    openPanel(type, state) {
      opened.push({ type, state });
    },
    panel(type) {
      const found = panels.find((panel) => panel.type === type);
      if (found === undefined) throw new Error(`No panel ${type} registered`);
      return found;
    },
    command(id) {
      const found = commands.find((command) => command.id === id);
      if (found === undefined) throw new Error(`No command ${id} registered`);
      return found;
    },
  };
}
