import { createContext, useContext } from 'react';
import type { CommandRegistry } from './command-registry';

/** What a screen needs to list commands and their effective keys (the settings screen's "Key bindings"). */
export type CommandsView = {
  readonly registry: CommandRegistry | null;
  keyFor(commandId: string): string | null;
};

export const CommandsContext = createContext<CommandsView>({ registry: null, keyFor: () => null });

export function useCommands(): CommandsView {
  return useContext(CommandsContext);
}
