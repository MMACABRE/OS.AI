import { useCallback, useEffect, useRef, useState } from 'react';
import type { Bus } from '@hsos/contracts/bus';
import { activitySection } from '@hsos/contracts/channels/activity';
import { browserSection } from '@hsos/contracts/channels/browser';
import { claudeLinkSection } from '@hsos/contracts/channels/claude-link';
import { cliSection } from '@hsos/contracts/channels/cli';
import { dashboardSection } from '@hsos/contracts/channels/dashboard';
import { filesSection } from '@hsos/contracts/channels/files';
import { gitSection } from '@hsos/contracts/channels/git';
import { graphSection } from '@hsos/contracts/channels/graph';
import { historySection } from '@hsos/contracts/channels/history';
import { hudSection } from '@hsos/contracts/channels/hud';
import { sessionsSection } from '@hsos/contracts/channels/sessions';
import { appearanceSection, settingsChannels } from '@hsos/contracts/channels/settings';
import type { SettingsProblem } from '@hsos/contracts/channels/settings';
import { shellChannels } from '@hsos/contracts/channels/shell';
import { skillsSection } from '@hsos/contracts/channels/skills';
import { terminalSection } from '@hsos/contracts/channels/terminal';
import type { ModuleId } from '@hsos/contracts/ids';
import type { SettingsSection } from '@hsos/contracts/module';
import { Button, ErrorState, Skeleton, TextField, useToast } from '@hsos/ui-kit';
import { z } from 'zod';
import { KeybindingsSection } from './KeybindingsSection';
import { SchemaControl } from './schema-control';
import styles from './SettingsScreen.module.css';
import { ThemesSection } from './ThemesSection';

/** Saving waits this long after the last edit (settings.md "Settings screen"). */
export const SAVE_DELAY_MS = 400;

/** Appearance first, then one section per module (module order), then key bindings and themes. */
export const SCREEN_SECTIONS: readonly SettingsSection<unknown>[] = [
  appearanceSection,
  terminalSection,
  filesSection,
  historySection,
  gitSection,
  claudeLinkSection,
  skillsSection,
  hudSection,
  activitySection,
  browserSection,
  graphSection,
  cliSection,
  sessionsSection,
  dashboardSection,
] as readonly SettingsSection<unknown>[];

type SectionId = ModuleId | 'keybindings' | 'themes';
type Values = Readonly<Record<string, unknown>>;
type Load = { readonly kind: 'loading' } | { readonly kind: 'error' } | { readonly kind: 'ready' };

/** `fontSize` reads "Font size". */
export function keyLabel(key: string): string {
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function keysOf(section: SettingsSection<unknown>): [string, z.ZodType][] {
  if (section.schema instanceof z.ZodObject)
    return Object.entries(section.schema.shape as Record<string, z.ZodType>);
  return [];
}

/**
 * Every setting, key binding and theme (settings.md "Settings screen", "States"): a search field, the
 * section list, one row per key with a "Reset" link only when the value differs from the default, saves
 * 400 ms after the last edit, and a banner listing problems with a way to the file.
 */
export function SettingsScreen({ bus }: { readonly bus: Bus }) {
  const toast = useToast();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [values, setValues] = useState<ReadonlyMap<ModuleId, Values>>(new Map());
  const [problems, setProblems] = useState<readonly SettingsProblem[]>([]);
  const [current, setCurrent] = useState<SectionId>('settings');
  const [filter, setFilter] = useState('');
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const reload = useCallback(async () => {
    setLoad({ kind: 'loading' });
    const results = await Promise.all(
      SCREEN_SECTIONS.map(async (section) => {
        const result = await bus.call(settingsChannels.getSection, { moduleId: section.moduleId });
        return [section.moduleId, result] as const;
      }),
    );
    const problemsResult = await bus.call(settingsChannels.getProblems, {});
    if (results.every(([, result]) => !result.ok && result.error.code !== 'NOT_FOUND')) {
      setLoad({ kind: 'error' });
      return;
    }
    const next = new Map<ModuleId, Values>();
    for (const [moduleId, result] of results) if (result.ok) next.set(moduleId, result.value);
    setValues(next);
    if (problemsResult.ok) setProblems(problemsResult.value);
    setLoad({ kind: 'ready' });
  }, [bus]);

  useEffect(() => {
    void reload();
    const stopSections = bus.on(settingsChannels.sectionChanged, ({ moduleId, value }) =>
      setValues((old) => new Map(old).set(moduleId, value)),
    );
    const stopProblems = bus.on(settingsChannels.problemsChanged, setProblems);
    const pending = timers.current;
    return () => {
      stopSections();
      stopProblems();
      for (const timer of pending.values()) clearTimeout(timer);
    };
  }, [bus, reload]);

  const save = (moduleId: ModuleId, key: string, value: unknown) => {
    setValues((old) => new Map(old).set(moduleId, { ...(old.get(moduleId) ?? {}), [key]: value }));
    const id = `${moduleId}.${key}`;
    const old = timers.current.get(id);
    if (old !== undefined) clearTimeout(old);
    timers.current.set(
      id,
      setTimeout(() => {
        timers.current.delete(id);
        void bus.call(settingsChannels.setValue, { moduleId, key, value }).then((result) => {
          if (!result.ok) toast.show({ tone: 'error', message: result.error.message });
        });
      }, SAVE_DELAY_MS),
    );
  };
  const pickFolder = async (title: string) => {
    const result = await bus.call(shellChannels.pickFolder, { title });
    return result.ok ? result.value : null;
  };
  const showFile = (file: SettingsProblem['file']) =>
    void bus.call(shellChannels.revealInExplorer, { path: file });

  if (load.kind === 'error')
    return (
      <div className={styles.screen}>
        <ErrorState
          message="Settings could not be read from the main process."
          onRetry={() => void reload()}
          logProcess="main"
        />
      </div>
    );

  const text = filter.trim().toLowerCase();
  const matches = (section: SettingsSection<unknown>) =>
    text === '' ||
    section.title.toLowerCase().includes(text) ||
    keysOf(section).some(([key]) => keyLabel(key).toLowerCase().includes(text));
  const sectionsShown = SCREEN_SECTIONS.filter(matches);
  const visible: SettingsSection<unknown>[] =
    text === '' ? SCREEN_SECTIONS.filter((section) => section.moduleId === current) : sectionsShown;

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.heading}>Settings</h1>
        <TextField
          value={filter}
          onChange={setFilter}
          placeholder="Search settings"
          label="Search settings"
        />
      </header>
      {problems.length === 0 ? null : (
        <div className={styles.banner} role="alert">
          <strong className={styles.bannerTitle}>
            {problems.length === 1
              ? 'One problem in your settings files'
              : `${problems.length} problems in your settings files`}
          </strong>
          <ul className={styles.problems}>
            {problems.map((problem, index) => (
              <li key={`${problem.file}-${problem.path}-${index}`} className={styles.problem}>
                <span>
                  {problem.path === '' ? problem.file : problem.path}: {problem.message}
                </span>
                <Button size="small" variant="ghost" onPress={() => showFile(problem.file)}>
                  Open file
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className={styles.body}>
        <nav className={styles.nav} aria-label="Settings sections">
          {[
            ...SCREEN_SECTIONS.map((section) => ({
              id: section.moduleId as SectionId,
              title: section.title,
            })),
            { id: 'keybindings' as SectionId, title: 'Key bindings' },
            { id: 'themes' as SectionId, title: 'Themes' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              className={styles.navItem}
              aria-current={item.id === current && text === '' ? 'page' : undefined}
              onClick={() => {
                setCurrent(item.id);
                setFilter('');
              }}
            >
              {item.title}
            </button>
          ))}
        </nav>
        <main className={styles.content}>
          {load.kind === 'loading' ? <Skeleton rows={6} label="Reading settings" /> : null}
          {load.kind === 'ready' && current === 'keybindings' && text === '' ? (
            <KeybindingsSection bus={bus} filter="" />
          ) : null}
          {load.kind === 'ready' && current === 'themes' && text === '' ? (
            <ThemesSection bus={bus} filter="" />
          ) : null}
          {load.kind === 'ready'
            ? visible.map((section) => (
                <section key={section.moduleId} className={styles.section} aria-label={section.title}>
                  <h2 className={styles.sectionTitle}>{section.title}</h2>
                  <div className={styles.rows}>
                    {keysOf(section)
                      .filter(
                        ([key]) =>
                          text === '' ||
                          keyLabel(key).toLowerCase().includes(text) ||
                          section.title.toLowerCase().includes(text),
                      )
                      .map(([key, schema]) => {
                        const value = values.get(section.moduleId)?.[key];
                        const defaults = section.defaults as Values;
                        const changed = JSON.stringify(value) !== JSON.stringify(defaults[key]);
                        return (
                          <div key={key} className={styles.row}>
                            <span className={styles.label}>{keyLabel(key)}</span>
                            <span className={styles.control}>
                              <SchemaControl
                                settingKey={key}
                                label={keyLabel(key)}
                                schema={schema}
                                value={value}
                                pickFolder={pickFolder}
                                onValid={(next) => save(section.moduleId, key, next)}
                              />
                              {changed ? (
                                <button
                                  type="button"
                                  className={styles.reset}
                                  onClick={() => save(section.moduleId, key, defaults[key])}
                                >
                                  Reset
                                </button>
                              ) : null}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </section>
              ))
            : null}
          {load.kind === 'ready' && text !== '' && 'key bindings'.includes(text) ? (
            <KeybindingsSection bus={bus} filter="" />
          ) : null}
          {load.kind === 'ready' &&
          text !== '' &&
          sectionsShown.length === 0 &&
          !'key bindings'.includes(text) ? (
            <p className={styles.hint}>No setting matches "{filter}".</p>
          ) : null}
        </main>
      </div>
    </div>
  );
}
