import { useEffect, useMemo, useState } from 'react';
import type { Bus } from '@hsos/contracts/bus';
import { diagnosticsChannels } from '@hsos/contracts/channels/diagnostics';
import { CommandsContext, ToastProvider, UiKitActionsContext } from '../modules/ui-kit';
import { AppFrame } from '../modules/workspace/panel/AppFrame';
import { systemClock } from '../modules/shell/system-clock';
import { createModuleLogger } from './module-list';
import './app-root.css';
import type { UiKitActions } from '../modules/ui-kit';
import { COMMAND_MODE, CommandPalette } from '../modules/ui-kit/palette/CommandPalette';
import type { PaletteModeId } from '../modules/ui-kit/palette/CommandPalette';
import type { UiRegistry } from '../modules/shell/loader/ui-context';

/** Opens the palette from a command (Ctrl+Shift+P) or from file mode's command (Ctrl+P). */
export type PaletteControl = {
  open(mode: PaletteModeId): void;
  subscribe(listener: (mode: PaletteModeId) => void): () => void;
};

export function createPaletteControl(): PaletteControl {
  const listeners = new Set<(mode: PaletteModeId) => void>();
  return {
    open: (mode) => {
      for (const listener of listeners) listener(mode);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** A plain text line the e2e checks of cards 005 and 010 read; the status bar shows it (card 028). */
export type MessageControl = {
  set(text: string): void;
  subscribe(listener: (text: string) => void): () => void;
};

export function createMessageControl(): MessageControl {
  const listeners = new Set<(text: string) => void>();
  return {
    set: (text) => {
      for (const listener of listeners) listener(text);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type AppRootProps = {
  readonly bus: Bus | null;
  readonly registry: UiRegistry | null;
  readonly keyFor: (commandId: string) => string | null;
  readonly palette: PaletteControl;
  readonly message: MessageControl;
};

const silent = { log: () => undefined };

/** The renderer's root: toasts, the ui-kit's app actions, the app frame (card 028) and the palette. */
export function AppRoot({ bus, registry, keyFor, palette, message }: AppRootProps) {
  const [text, setText] = useState('');
  const [paletteMode, setPaletteMode] = useState<PaletteModeId | null>(null);
  useEffect(() => message.subscribe(setText), [message]);
  useEffect(() => palette.subscribe(setPaletteMode), [palette]);
  const actions = useMemo<UiKitActions>(
    () => ({ openLog: () => void bus?.call(diagnosticsChannels.openLogFolder, {}) }),
    [bus],
  );
  const commands = useMemo(
    () => ({ registry: registry?.commandRegistry ?? null, keyFor }),
    [registry, keyFor],
  );
  const log = useMemo(
    () => (bus === null ? silent : createModuleLogger(bus, systemClock, 'workspace')),
    [bus],
  );
  return (
    <UiKitActionsContext.Provider value={actions}>
      <CommandsContext.Provider value={commands}>
        <ToastProvider>
          <AppFrame bus={bus} registry={registry} log={log} keyFor={keyFor} message={text} />
          {registry === null ? null : (
            <CommandPalette
              registry={registry.commandRegistry}
              open={paletteMode !== null}
              initialMode={paletteMode ?? COMMAND_MODE}
              onClose={() => setPaletteMode(null)}
              keyFor={keyFor}
            />
          )}
        </ToastProvider>
      </CommandsContext.Provider>
    </UiKitActionsContext.Provider>
  );
}
