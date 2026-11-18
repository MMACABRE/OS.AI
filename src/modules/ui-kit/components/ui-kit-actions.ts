import { createContext, useContext } from 'react';
import type { ProcessName } from '@hsos/contracts/channels/diagnostics';

/**
 * App actions the ui-kit cannot reach on its own (it has no bus). The app frame provides them;
 * without a provider they do nothing.
 */
export type UiKitActions = {
  /** "Show log" in an error state: opens the log folder (ui-kit.md, `ErrorState`). */
  openLog(process: ProcessName | null): void;
};

export const UiKitActionsContext = createContext<UiKitActions>({ openLog: () => undefined });

export function useUiKitActions(): UiKitActions {
  return useContext(UiKitActionsContext);
}
