import type { CommandDefinition } from '@hsos/contracts/module';

/** How many recently used commands are remembered for ranking (UI-11). */
const RECENT_LIMIT = 20;

/** One entry a palette mode offers. */
export type PaletteItem = {
  readonly id: string;
  readonly title: string;
  readonly detail?: string;
  run(): void | Promise<void>;
};

/**
 * A palette mode added by a provider (UI-12), for example file mode from `files`. `prefix` is what the
 * query starts with to enter the mode; '' marks the mode `Ctrl+P` opens.
 */
export type PaletteMode = {
  readonly id: string;
  readonly prefix: string;
  readonly placeholder: string;
  search(query: string): readonly PaletteItem[] | Promise<readonly PaletteItem[]>;
};

export type CommandRegistry = {
  readonly commands: ReadonlyMap<string, CommandDefinition>;
  add(command: CommandDefinition): void;
  /** Ids of recently run commands, most recent first. */
  recent(): readonly string[];
  markUsed(id: string): void;
  addMode(mode: PaletteMode): void;
  modes(): readonly PaletteMode[];
  onChange(listener: () => void): () => void;
};

/** Every command registered through `UiContext.registerCommand` (UI-10), recent use and palette modes. */
export function createCommandRegistry(): CommandRegistry {
  const commands = new Map<string, CommandDefinition>();
  const modes: PaletteMode[] = [];
  let recent: string[] = [];
  const listeners = new Set<() => void>();
  const changed = () => {
    for (const listener of listeners) listener();
  };
  return {
    commands,
    add(command) {
      if (commands.has(command.id)) throw new Error(`The command ${command.id} is registered twice.`);
      commands.set(command.id, command);
      changed();
    },
    recent: () => recent,
    markUsed(id) {
      recent = [id, ...recent.filter((item) => item !== id)].slice(0, RECENT_LIMIT);
    },
    addMode(mode) {
      if (modes.some((existing) => existing.id === mode.id))
        throw new Error(`The palette mode ${mode.id} is registered twice.`);
      modes.push(mode);
      changed();
    },
    modes: () => modes,
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
