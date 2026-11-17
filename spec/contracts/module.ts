/**
 * What a module receives when it registers. See spec/02-architecture.md §4
 * and principles P-20 to P-25.
 *
 * A module exports `register(ctx)` from register.service.ts and register.ui.ts.
 * Everything a module adds to the app goes through `ctx`.
 */
import type { ComponentType } from 'react';
import type { z } from 'zod';
import type { Bus, Unsubscribe } from './bus';
import type { ModuleId, PanelId, EpochMs } from './ids';
import type { DataPaths } from './paths';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type Logger = {
  /** `event` is a short fixed name such as `save.refused`. `data` must not contain secrets (P-8). */
  log(level: LogLevel, event: string, data?: Record<string, unknown>): void;
};

export type Clock = {
  now(): EpochMs;
  /** Calls `callback` after `ms`. Returns a function that cancels it. */
  after(ms: number, callback: () => void): Unsubscribe;
  /** Calls `callback` every `ms`. Returns a function that stops it. */
  every(ms: number, callback: () => void): Unsubscribe;
};

/** Read access to one module's settings section, typed by the section's schema. */
export type SettingsReader<T> = {
  get(): T;
  /** Fires after a valid change is loaded from disk or the settings screen (P-31). */
  onChange(listener: (value: T) => void): Unsubscribe;
};

export type SettingsSection<T> = {
  readonly moduleId: ModuleId;
  readonly title: string;
  readonly schema: z.ZodType<T>;
  readonly defaults: T;
};

/** Context for code running in main or a utility process. */
export type ServiceContext = {
  readonly moduleId: ModuleId;
  readonly bus: Bus;
  readonly log: Logger;
  readonly clock: Clock;
  readonly paths: DataPaths;
  registerSettings<T>(section: SettingsSection<T>): SettingsReader<T>;
  /** Runs once when the process is asked to stop. Must finish within 3 000 ms. */
  onStop(handler: () => Promise<void>): void;
};

export type PanelKind = 'side' | 'dock';

/** Props every panel component receives. `state` is the panel's own saved state. */
export type PanelProps<State> = {
  readonly panelId: PanelId;
  readonly state: State;
  /** Persists the panel's state with the workspace. Call on change, not on every key press. */
  readonly setState: (next: State) => void;
  readonly isFocused: boolean;
};

export type PanelDefinition<State> = {
  /** Unique across the app, `<moduleId>.<name>`, for example `terminal.shell`. */
  readonly type: string;
  readonly kind: PanelKind;
  readonly title: string;
  /** Name of an icon in ui-kit. */
  readonly icon: string;
  readonly stateSchema: z.ZodType<State>;
  readonly initialState: State;
  readonly component: ComponentType<PanelProps<State>>;
  /** Dock panels only. False means opening it again focuses the existing one. */
  readonly allowMultiple: boolean;
};

export type CommandDefinition = {
  /** `<moduleId>.<verb>`, for example `terminal.new`. */
  readonly id: string;
  readonly title: string;
  /** Default key binding in the format of keybindings.json, or null. */
  readonly defaultKey: string | null;
  /** True means the key works even while a terminal has focus. */
  readonly global: boolean;
  run(): void | Promise<void>;
};

export type StatusItemDefinition = {
  readonly id: string;
  readonly side: 'left' | 'right';
  /** Lower numbers sit closer to the window edge. */
  readonly order: number;
  readonly component: ComponentType;
};

/** Context for code running in the renderer. */
export type UiContext = {
  readonly moduleId: ModuleId;
  readonly bus: Bus;
  readonly log: Logger;
  readonly clock: Clock;
  registerPanel<State>(definition: PanelDefinition<State>): void;
  registerCommand(definition: CommandDefinition): void;
  registerStatusItem(definition: StatusItemDefinition): void;
  /** Reads a settings section registered by this module's service side. */
  settings<T>(section: SettingsSection<T>): SettingsReader<T>;
  /** Opens a panel of the given type, or focuses it if it exists and allowMultiple is false. */
  openPanel<State>(type: string, state?: State): void;
};

export type ServiceModule = { register(ctx: ServiceContext): void };
export type UiModule = { register(ctx: UiContext): void };
