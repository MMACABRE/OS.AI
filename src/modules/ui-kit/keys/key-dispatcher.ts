import type { Unsubscribe } from '@hsos/contracts/bus';
import type { Clock, CommandDefinition, Logger } from '@hsos/contracts/module';
import { keyFromEvent, normalizeBinding } from './parse-key';
import type { KeyPress } from './parse-key';

/** A chord's first part waits this long for the second (UI-23). */
export const CHORD_WAIT_MS = 1_500;
/** Focus inside an element with this attribute counts as "inside a terminal" (UI-21). */
export const TERMINAL_ATTRIBUTE = 'data-hsos-terminal';

export type BindingConflict = { readonly key: string; readonly winner: string; readonly loser: string };
export type ResolvedBindings = {
  /** Key (or chord) to command id. */
  readonly byKey: ReadonlyMap<string, string>;
  /** Command id to its effective key, or null for none. */
  readonly byCommand: ReadonlyMap<string, string | null>;
  readonly conflicts: readonly BindingConflict[];
  /** Overrides whose key string is not in the SET-19 format; those commands keep no key. */
  readonly invalid: readonly string[];
};

/**
 * Effective bindings (SET-18): the file's entry when present (a key, or null for none), else the command's
 * `defaultKey`. When two commands share a key, the one registered later wins and a conflict names both (SET-20).
 */
export function resolveBindings(
  commands: Iterable<Pick<CommandDefinition, 'id' | 'defaultKey'>>,
  overrides: Readonly<Record<string, string | null>>,
): ResolvedBindings {
  const byKey = new Map<string, string>();
  const byCommand = new Map<string, string | null>();
  const conflicts: BindingConflict[] = [];
  const invalid: string[] = [];
  for (const command of commands) {
    const raw = Object.hasOwn(overrides, command.id) ? (overrides[command.id] ?? null) : command.defaultKey;
    const key = raw === null ? null : normalizeBinding(raw);
    if (raw !== null && key === null) invalid.push(command.id);
    byCommand.set(command.id, key);
    if (key === null) continue;
    const previous = byKey.get(key);
    if (previous !== undefined) {
      conflicts.push({ key, winner: command.id, loser: previous });
      byCommand.set(previous, null);
    }
    byKey.set(key, command.id);
  }
  return { byKey, byCommand, conflicts, invalid };
}

export type KeyDispatcherOptions = {
  readonly target: Pick<Window, 'addEventListener' | 'removeEventListener'>;
  readonly clock: Clock;
  readonly log: Logger;
  /** The command for an id, read at press time. */
  command(id: string): Pick<CommandDefinition, 'id' | 'global' | 'run'> | undefined;
  /** The pending chord part, or null when none is pending (UI-23; the status bar shows it). */
  onPending?(part: string | null): void;
};

export type KeyDispatcher = {
  setBindings(byKey: ReadonlyMap<string, string>): void;
  dispose(): void;
};

type PressEvent = KeyPress & {
  readonly target: EventTarget | null;
  preventDefault(): void;
  stopPropagation(): void;
};

function closestElement(target: EventTarget | null): Element | null {
  return typeof Element !== 'undefined' && target instanceof Element ? target : null;
}

function inTerminal(target: EventTarget | null): boolean {
  return closestElement(target)?.closest(`[${TERMINAL_ATTRIBUTE}]`) != null;
}

function inTextInput(target: EventTarget | null): boolean {
  const element = closestElement(target);
  if (element === null) return false;
  if (element.closest('textarea, select, [contenteditable=""], [contenteditable="true"]') !== null)
    return true;
  if (element instanceof HTMLInputElement)
    return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color'].includes(element.type);
  return false;
}

/**
 * The one window key listener (UI-20). In a terminal only global commands run (UI-21); in a text input
 * only bindings with Ctrl or Alt run (UI-22); a chord's first part waits 1 500 ms and any other key cancels
 * it (UI-23).
 */
export function createKeyDispatcher(options: KeyDispatcherOptions): KeyDispatcher {
  let byKey: ReadonlyMap<string, string> = new Map();
  let chordStarts = new Set<string>();
  let pending: string | null = null;
  let cancelPending: Unsubscribe = () => undefined;

  const setPending = (part: string | null) => {
    cancelPending();
    pending = part;
    options.onPending?.(part);
    if (part !== null) cancelPending = options.clock.after(CHORD_WAIT_MS, () => setPending(null));
  };

  /** Whether the command may run for this press, given where focus is. */
  const allowed = (commandId: string, key: string, target: EventTarget | null): boolean => {
    const command = options.command(commandId);
    if (command === undefined) return false;
    if (inTerminal(target) && !command.global) return false;
    if (inTextInput(target) && !/^(Ctrl|Alt)\+/.test(key)) return false;
    return true;
  };

  const run = (commandId: string) => {
    const command = options.command(commandId);
    if (command === undefined) return;
    try {
      void Promise.resolve(command.run()).catch((error: unknown) =>
        options.log.log('error', 'ui-kit.command_failed', { command: commandId, message: String(error) }),
      );
    } catch (error) {
      options.log.log('error', 'ui-kit.command_failed', { command: commandId, message: String(error) });
    }
  };

  const onKeyDown = (event: Event) => {
    const press = event as unknown as PressEvent;
    const key = keyFromEvent(press);
    if (key === null) return;
    if (pending !== null) {
      const chord = `${pending} ${key}`;
      setPending(null);
      const commandId = byKey.get(chord);
      if (commandId !== undefined && allowed(commandId, chord.split(' ')[0] ?? key, press.target)) {
        press.preventDefault();
        press.stopPropagation();
        run(commandId);
      }
      return;
    }
    const commandId = byKey.get(key);
    if (commandId !== undefined && allowed(commandId, key, press.target)) {
      press.preventDefault();
      press.stopPropagation();
      run(commandId);
      return;
    }
    if (!chordStarts.has(key)) return;
    const anyAllowed = [...byKey].some(
      ([binding, id]) => binding.startsWith(`${key} `) && allowed(id, key, press.target),
    );
    if (!anyAllowed) return;
    press.preventDefault();
    press.stopPropagation();
    setPending(key);
  };

  options.target.addEventListener('keydown', onKeyDown, { capture: true });
  return {
    setBindings(next) {
      byKey = next;
      chordStarts = new Set(
        [...next.keys()].filter((key) => key.includes(' ')).map((key) => key.split(' ')[0] ?? key),
      );
      setPending(null);
    },
    dispose() {
      setPending(null);
      options.target.removeEventListener('keydown', onKeyDown, { capture: true });
    },
  };
}
