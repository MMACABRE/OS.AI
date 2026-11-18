import type { Bus } from '@hsos/contracts/bus';
import { settingsChannels } from '@hsos/contracts/channels/settings';
import type { Logger, SettingsReader, SettingsSection } from '@hsos/contracts/module';

/**
 * A `SettingsReader` for a module in a utility process (SET-10): it starts with the defaults, asks main
 * with `getSection`, and follows `sectionChanged`. Values from main are checked with the section's schema;
 * a value that fails keeps the previous one.
 */
export function createRemoteSettingsReader<T>(
  bus: Bus,
  section: SettingsSection<T>,
  log: Logger,
): SettingsReader<T> {
  let current: T = section.defaults;
  const listeners = new Set<(value: T) => void>();
  const apply = (raw: unknown) => {
    const parsed = section.schema.safeParse(raw);
    if (!parsed.success) {
      log.log('warn', 'settings.remote_value_invalid', { moduleId: section.moduleId });
      return;
    }
    if (JSON.stringify(parsed.data) === JSON.stringify(current)) return;
    current = parsed.data;
    for (const listener of listeners) listener(current);
  };
  bus.on(settingsChannels.sectionChanged, ({ moduleId, value }) => {
    if (moduleId === section.moduleId) apply(value);
  });
  void bus.call(settingsChannels.getSection, { moduleId: section.moduleId }).then((result) => {
    if (result.ok) apply(result.value);
    else
      log.log('warn', 'settings.remote_get_failed', { moduleId: section.moduleId, code: result.error.code });
  });
  return {
    get: () => current,
    onChange: (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
