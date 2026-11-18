import { useEffect, useMemo, useState } from 'react';
import type { Bus } from '@hsos/contracts/bus';
import { diagnosticsChannels } from '@hsos/contracts/channels/diagnostics';
import { ToastProvider, UiKitActionsContext } from '../modules/ui-kit';
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

/** A plain text line the e2e checks of cards 005 and 010 read; the app frame (card 028) replaces it. */
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

/** The renderer's root until the app frame exists: toasts, the ui-kit's app actions, and the palette. */
export function AppRoot({ bus, registry, keyFor, palette, message }: AppRootProps) {
  const [text, setText] = useState('HSOS');
  const [paletteMode, setPaletteMode] = useState<PaletteModeId | null>(null);
  useEffect(() => message.subscribe(setText), [message]);
  useEffect(() => palette.subscribe(setPaletteMode), [palette]);
  const actions = useMemo<UiKitActions>(
    () => ({ openLog: () => void bus?.call(diagnosticsChannels.openLogFolder, {}) }),
    [bus],
  );
  return (
    <UiKitActionsContext.Provider value={actions}>
      <ToastProvider>
        <p>{text}</p>
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
    </UiKitActionsContext.Provider>
  );
}
