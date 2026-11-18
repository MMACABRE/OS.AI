import type { Bus } from '@hsos/contracts/bus';
import { diagnosticsChannels } from '@hsos/contracts/channels/diagnostics';
import type { Clock, Logger } from '@hsos/contracts/module';

/**
 * The renderer's logger: it has no file access, so each record goes to main with `diagnostics.write` (DIAG-1).
 * Main redacts, filters debug and writes `ui.log`. A failed send is dropped; logging never throws (DIAG-3).
 */
export function createBusLogger(bus: Bus, clock: Clock, module: string): Logger {
  return {
    log(level, event, data) {
      try {
        void bus
          .call(diagnosticsChannels.write, {
            time: clock.now(),
            process: 'ui',
            module,
            level,
            event: event.slice(0, 80),
            ...(data === undefined ? {} : { data }),
          })
          .catch(() => undefined);
      } catch {
        // Dropped: see DIAG-3.
      }
    },
  };
}
