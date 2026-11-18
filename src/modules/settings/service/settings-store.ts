import { copyFile } from 'node:fs/promises';
import { z } from 'zod';
import { SettingsFile } from '@hsos/contracts/channels/settings';
import type { SettingsProblem } from '@hsos/contracts/channels/settings';
import { toAbsPath } from '@hsos/contracts/ids';
import type { ModuleId } from '@hsos/contracts/ids';
import type { Clock, Logger, SettingsReader, SettingsSection } from '@hsos/contracts/module';
import { err, ok } from '@hsos/contracts/result';
import type { Result } from '@hsos/contracts/result';
import { readJson, writeJsonAtomic } from './atomic-json';

type Values = Record<string, unknown>;
type AnySection = SettingsSection<unknown>;

export type SettingsStore = {
  /** Registers a section and returns its reader (SET-1). Registering the same module twice returns the first reader. */
  register<T>(section: SettingsSection<T>): SettingsReader<T>;
  /** Reads the file again and applies it; readers of changed sections are notified (SET-2 to SET-5, SET-9). */
  load(): Promise<void>;
  /** Resolved values of one module, defaults filled in; null for a module with no section. */
  getSection(moduleId: ModuleId): Values | null;
  /** Validates and stores one key (SET-6, SET-7). */
  setValue(moduleId: ModuleId, key: string, value: unknown): Promise<Result<Record<string, never>>>;
  getProblems(): SettingsProblem[];
  onSectionChanged(listener: (moduleId: ModuleId, value: Values) => void): () => void;
  onProblemsChanged(listener: (problems: SettingsProblem[]) => void): () => void;
};

export type SettingsStoreOptions = {
  readonly file: string;
  readonly clock: Clock;
  readonly log: Logger;
};

const EMPTY_FILE: SettingsFile = { version: 1, values: {} };

/** The keys a section declares: its object schema's shape, or its defaults' keys. */
function declaredKeys(section: AnySection): Map<string, z.ZodType | null> {
  const keys = new Map<string, z.ZodType | null>();
  if (section.schema instanceof z.ZodObject)
    for (const [key, schema] of Object.entries(section.schema.shape)) keys.set(key, schema as z.ZodType);
  const defaults = section.defaults;
  if (typeof defaults === 'object' && defaults !== null)
    for (const key of Object.keys(defaults)) if (!keys.has(key)) keys.set(key, null);
  return keys;
}

function isRecord(value: unknown): value is Values {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * settings.json in main: sections, validation per key, problems, atomic writes and change events.
 * SET-1 to SET-7 and SET-9. Card 016.
 */
export function createSettingsStore(options: SettingsStoreOptions): SettingsStore {
  const file = toAbsPath(options.file);
  const sections = new Map<ModuleId, AnySection>();
  const readers = new Map<ModuleId, SettingsReader<unknown>>();
  const readerListeners = new Map<ModuleId, Set<(value: unknown) => void>>();
  const sectionListeners = new Set<(moduleId: ModuleId, value: Values) => void>();
  const problemListeners = new Set<(problems: SettingsProblem[]) => void>();
  /** What the file holds, as read; kept untouched for unknown keys (SET-4). */
  let stored: SettingsFile = EMPTY_FILE;
  /** SET-5: the file is unreadable or too new; nothing is written until `setValue`. */
  let broken: string | null = null;
  let resolved = new Map<ModuleId, Values>();
  let problems: SettingsProblem[] = [];

  const resolveSection = (moduleId: ModuleId, section: AnySection, found: SettingsProblem[]): Values => {
    const defaults: Values = isRecord(section.defaults) ? { ...section.defaults } : {};
    const values = broken === null ? (stored.values[moduleId] ?? {}) : {};
    const keys = declaredKeys(section);
    const merged: Values = { ...defaults };
    for (const [key, value] of Object.entries(values)) {
      const path = `values.${moduleId}.${key}`;
      if (!keys.has(key)) {
        found.push({ file, path, message: 'Unknown setting' });
        continue;
      }
      const schema = keys.get(key);
      const checked =
        schema === null || schema === undefined
          ? { success: true as const, data: value }
          : schema.safeParse(value);
      if (checked.success) merged[key] = checked.data;
      else found.push({ file, path, message: checked.error.issues[0]?.message ?? 'Invalid value' });
    }
    const whole = section.schema.safeParse(merged);
    return whole.success && isRecord(whole.data) ? whole.data : defaults;
  };

  /** Recomputes every section and the problems; notifies only what changed (SET-9). */
  const recompute = () => {
    const found: SettingsProblem[] = [];
    if (broken !== null) found.push({ file, path: '', message: broken });
    const next = new Map<ModuleId, Values>();
    for (const [moduleId, section] of sections) next.set(moduleId, resolveSection(moduleId, section, found));
    if (broken === null)
      for (const [moduleId, values] of Object.entries(stored.values))
        if (!sections.has(moduleId as ModuleId))
          for (const key of Object.keys(values))
            found.push({ file, path: `values.${moduleId}.${key}`, message: 'Unknown setting' });
    const previous = resolved;
    resolved = next;
    for (const [moduleId, value] of next) {
      if (sameJson(previous.get(moduleId), value)) continue;
      if (!previous.has(moduleId)) continue;
      for (const listener of readerListeners.get(moduleId) ?? []) listener(value);
      for (const listener of sectionListeners) listener(moduleId, value);
    }
    if (!sameJson(problems, found)) {
      problems = found;
      for (const listener of problemListeners) listener(problems);
    }
  };

  const load = async () => {
    const read = await readJson(file, z.unknown());
    if (read.kind === 'missing') {
      broken = null;
      stored = EMPTY_FILE;
      await writeJsonAtomic(file, EMPTY_FILE).catch(() => options.log.log('warn', 'settings.create_failed'));
    } else if (read.kind === 'invalid') {
      broken = read.reason;
    } else {
      const version: unknown = isRecord(read.value) ? read.value['version'] : undefined;
      const parsed = SettingsFile.safeParse(read.value);
      if (typeof version === 'number' && version > 1)
        broken = `The file has version ${version}; this HSOS reads version 1.`;
      else if (!parsed.success)
        broken = `The file's shape is wrong: ${parsed.error.issues[0]?.message ?? 'invalid'}`;
      else {
        broken = null;
        stored = parsed.data;
      }
    }
    recompute();
  };

  const setValue = async (
    moduleId: ModuleId,
    key: string,
    value: unknown,
  ): Promise<Result<Record<string, never>>> => {
    const section = sections.get(moduleId);
    const schema = section === undefined ? undefined : declaredKeys(section).get(key);
    if (section === undefined || schema === undefined)
      return err('SET_INVALID', `There is no setting ${moduleId}.${key}.`);
    const checked = schema === null ? { success: true as const, data: value } : schema.safeParse(value);
    if (!checked.success)
      return err('SET_INVALID', checked.error.issues[0]?.message ?? 'The value is not valid.');
    if (broken !== null) {
      // SET-5: keep the bad file, then start a fresh one.
      await copyFile(file, `${file}.invalid-${options.clock.now()}`).catch(() => undefined);
      stored = EMPTY_FILE;
      broken = null;
    }
    const moduleValues: Values = { ...(stored.values[moduleId] ?? {}) };
    const defaults: Values = isRecord(section.defaults) ? section.defaults : {};
    if (sameJson(defaults[key], checked.data)) delete moduleValues[key];
    else moduleValues[key] = checked.data;
    const values = { ...stored.values };
    if (Object.keys(moduleValues).length === 0) delete values[moduleId];
    else values[moduleId] = moduleValues;
    const next: SettingsFile = { version: 1, values };
    try {
      await writeJsonAtomic(file, next);
    } catch {
      return err(
        'FILE_WRITE_FAILED',
        'Settings could not be saved. Check that the settings folder is writable.',
      );
    }
    stored = next;
    recompute();
    return ok({});
  };

  return {
    register<T>(section: SettingsSection<T>): SettingsReader<T> {
      const existing = readers.get(section.moduleId);
      if (existing !== undefined) return existing as SettingsReader<T>;
      sections.set(section.moduleId, section as AnySection);
      recompute();
      const listeners = new Set<(value: unknown) => void>();
      readerListeners.set(section.moduleId, listeners);
      const reader: SettingsReader<T> = {
        get: () => (resolved.get(section.moduleId) ?? section.defaults) as T,
        onChange: (listener) => {
          const wrapped = (value: unknown) => listener(value as T);
          listeners.add(wrapped);
          return () => listeners.delete(wrapped);
        },
      };
      readers.set(section.moduleId, reader as SettingsReader<unknown>);
      return reader;
    },
    load,
    getSection: (moduleId) => resolved.get(moduleId) ?? null,
    setValue,
    getProblems: () => problems,
    onSectionChanged: (listener) => {
      sectionListeners.add(listener);
      return () => sectionListeners.delete(listener);
    },
    onProblemsChanged: (listener) => {
      problemListeners.add(listener);
      return () => problemListeners.delete(listener);
    },
  };
}
