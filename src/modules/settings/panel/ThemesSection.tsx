import { useEffect, useState } from 'react';
import type { Bus } from '@hsos/contracts/bus';
import { settingsChannels } from '@hsos/contracts/channels/settings';
import type { ThemeSummary } from '@hsos/contracts/channels/settings';
import { Badge, Button, useToast } from '@hsos/ui-kit';
import styles from './SettingsScreen.module.css';

type ActiveTheme = {
  readonly name: string;
  readonly kind: 'dark' | 'light';
  readonly tokens: Readonly<Record<string, string>>;
};

/** The swatch row: one cell per colour job of the visual direction. */
const SWATCH_TOKENS = [
  'color.bg.app',
  'color.structure',
  'color.accent',
  'color.brand',
  'color.live',
  'color.knowledge',
  'color.memory',
  'color.text.primary',
] as const;

/**
 * "Themes": every theme, the active one with its swatch row, "Use" to switch and "Duplicate" to copy the
 * active theme under a new name. The token editor comes in stage 6.
 */
export function ThemesSection({ bus, filter }: { readonly bus: Bus; readonly filter: string }) {
  const toast = useToast();
  const [themes, setThemes] = useState<readonly ThemeSummary[]>([]);
  const [active, setActive] = useState<ActiveTheme | null>(null);

  useEffect(() => {
    const refresh = () => {
      void bus.call(settingsChannels.listThemes, {}).then((result) => {
        if (result.ok) setThemes(result.value);
      });
      void bus.call(settingsChannels.getActiveTheme, {}).then((result) => {
        if (result.ok) setActive(result.value);
      });
    };
    refresh();
    const stop = bus.on(settingsChannels.activeThemeChanged, (theme) => {
      setActive(theme);
      refresh();
    });
    return stop;
  }, [bus]);

  const use = async (name: string) => {
    const result = await bus.call(settingsChannels.setValue, {
      moduleId: 'settings',
      key: 'theme',
      value: name,
    });
    if (!result.ok) toast.show({ tone: 'error', message: result.error.message });
  };
  const duplicate = async () => {
    if (active === null) return;
    const taken = new Set(themes.map((theme) => theme.name));
    let name = `${active.name} copy`;
    for (let n = 2; taken.has(name); n += 1) name = `${active.name} copy ${n}`;
    const result = await bus.call(settingsChannels.saveTheme, {
      theme: { version: 1, name, kind: active.kind, tokens: { ...active.tokens } },
    });
    if (result.ok) toast.show({ tone: 'ok', message: `Saved ${name}.` });
    else toast.show({ tone: 'error', message: result.error.message });
  };

  const shown = themes.filter((theme) => theme.name.toLowerCase().includes(filter.toLowerCase()));
  return (
    <div className={styles.rows}>
      {shown.map((theme) => {
        const isActive = active?.name === theme.name;
        return (
          <div key={theme.file} className={styles.row}>
            <span className={styles.label}>
              {theme.name}
              {theme.isBuiltIn ? <Badge tone="neutral" text="built in" /> : null}
              {isActive ? <Badge tone="warn" text="active" /> : null}
            </span>
            <span className={styles.control}>
              {isActive && active !== null ? (
                <span className={styles.swatches} aria-label={`${theme.name} colours`}>
                  {SWATCH_TOKENS.map((token) => (
                    <i
                      key={token}
                      className={styles.swatch}
                      style={{ background: active.tokens[token] ?? 'transparent' }}
                      title={token}
                    />
                  ))}
                </span>
              ) : (
                <Button size="small" onPress={() => void use(theme.name)}>
                  Use
                </Button>
              )}
              {isActive ? (
                <Button size="small" variant="ghost" onPress={() => void duplicate()}>
                  Duplicate
                </Button>
              ) : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}
