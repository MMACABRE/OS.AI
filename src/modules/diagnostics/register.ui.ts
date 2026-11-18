import { diagnosticsChannels } from '@hsos/contracts/channels/diagnostics';
import type { UiContext } from '@hsos/contracts/module';

/**
 * Renderer side of diagnostics: the "Open log folder" command (spec/modules/diagnostics.md, "UI").
 * "Show process health" needs the dialog component of the ui-kit and comes with it.
 */
export function register(ctx: UiContext): void {
  ctx.registerCommand({
    id: 'diagnostics.openLogFolder',
    title: 'Open log folder',
    defaultKey: null,
    global: false,
    run: async () => {
      const result = await ctx.bus.call(diagnosticsChannels.openLogFolder, {});
      if (!result.ok) ctx.log.log('warn', 'diagnostics.open_log_folder_failed', { code: result.error.code });
    },
  });
}
