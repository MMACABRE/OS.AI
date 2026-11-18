import { AppearanceSettings, settingsChannels } from '@hsos/contracts/channels/settings';
import type { UiContext } from '@hsos/contracts/module';
import { applyMotion, applyTheme } from './panel/apply-theme';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Renderer side of settings: applies the active theme and follows its changes (SET-13), and keeps
 * `data-motion` in step with the setting and the Windows preference (SET-15). Card 018.
 */
export function register(ctx: UiContext): void {
  void ctx.bus.call(settingsChannels.getActiveTheme, {}).then((result) => {
    if (result.ok) applyTheme(result.value);
    else ctx.log.log('warn', 'settings.theme_unavailable', { code: result.error.code });
  });
  ctx.bus.on(settingsChannels.activeThemeChanged, (theme) => applyTheme(theme));

  const media = window.matchMedia(REDUCED_MOTION_QUERY);
  let reduceMotion: AppearanceSettings['reduceMotion'] = 'system';
  const applyCurrent = () => applyMotion(reduceMotion, media.matches);
  const takeAppearance = (raw: unknown) => {
    const parsed = AppearanceSettings.safeParse(raw);
    if (!parsed.success) return;
    reduceMotion = parsed.data.reduceMotion;
    applyCurrent();
  };
  applyCurrent();
  media.addEventListener('change', applyCurrent);
  void ctx.bus.call(settingsChannels.getSection, { moduleId: 'settings' }).then((result) => {
    if (result.ok) takeAppearance(result.value);
  });
  ctx.bus.on(settingsChannels.sectionChanged, ({ moduleId, value }) => {
    if (moduleId === 'settings') takeAppearance(value);
  });
}
