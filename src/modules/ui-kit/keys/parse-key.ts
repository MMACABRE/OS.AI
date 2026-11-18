/** The parts of a `KeyboardEvent` that name a key press. */
export type KeyPress = {
  readonly key: string;
  readonly code: string;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
  readonly metaKey: boolean;
};

const MODIFIER_KEYS = new Set(['Control', 'Alt', 'Shift', 'Meta', 'AltGraph', 'CapsLock', 'OS']);

/** Physical keys named by `code`, so Shift does not change the name (`Ctrl+Shift+,` stays a comma). */
const CODE_NAMES: Readonly<Record<string, string>> = {
  Space: 'Space',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
};

/** Named keys, by `KeyboardEvent.key`, in the spelling bindings use. */
const KEY_NAMES: Readonly<Record<string, string>> = {
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Escape: 'Escape',
  Enter: 'Enter',
  Tab: 'Tab',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Insert: 'Insert',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
};

function keyName(press: KeyPress): string | null {
  if (/^Key[A-Z]$/.test(press.code)) return press.code.slice(3);
  if (/^Digit[0-9]$/.test(press.code)) return press.code.slice(5);
  if (/^Numpad[0-9]$/.test(press.code)) return press.code.slice(6);
  const byCode = CODE_NAMES[press.code];
  if (byCode !== undefined) return byCode;
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(press.key)) return press.key;
  const byKey = KEY_NAMES[press.key];
  if (byKey !== undefined) return byKey;
  if (press.key.length === 1) return press.key === ' ' ? 'Space' : press.key.toUpperCase();
  return null;
}

/**
 * A key press in the SET-19 format: modifiers in the order `Ctrl+Alt+Shift+`, then one key name, for
 * example `Ctrl+Shift+P`. A press of a modifier alone, or with the Windows key, gives null.
 */
export function keyFromEvent(press: KeyPress): string | null {
  if (press.metaKey || MODIFIER_KEYS.has(press.key)) return null;
  const name = keyName(press);
  if (name === null) return null;
  return `${press.ctrlKey ? 'Ctrl+' : ''}${press.altKey ? 'Alt+' : ''}${press.shiftKey ? 'Shift+' : ''}${name}`;
}

const MODIFIER_ORDER = ['Ctrl', 'Alt', 'Shift'] as const;

/** One part of a binding (`ctrl+shift+p`) in canonical form (`Ctrl+Shift+P`), or null when malformed. */
export function normalizeKeyPart(part: string): string | null {
  // The plus key itself: `+` alone or `Ctrl++`.
  const plusKey = part === '+' || part.endsWith('++');
  const head = plusKey ? part.slice(0, Math.max(0, part.length - 2)) : part;
  const pieces = head === '' ? [] : head.split('+');
  const last = plusKey ? '+' : pieces.pop();
  if (last === undefined || last.trim() === '') return null;
  const modifiers = new Set<string>();
  for (const piece of pieces) {
    const match = MODIFIER_ORDER.find((name) => name.toLowerCase() === piece.trim().toLowerCase());
    if (match === undefined || modifiers.has(match)) return null;
    modifiers.add(match);
  }
  const name = last.length === 1 ? last.toUpperCase() : last.charAt(0).toUpperCase() + last.slice(1);
  return `${MODIFIER_ORDER.filter((name) => modifiers.has(name))
    .map((modifier) => `${modifier}+`)
    .join('')}${name}`;
}

/** A binding (one part, or a chord of two parts separated by a space) in canonical form, or null (SET-19). */
export function normalizeBinding(binding: string): string | null {
  const parts = binding.trim().split(/\s+/);
  if (parts.length < 1 || parts.length > 2) return null;
  const normalized = parts.map(normalizeKeyPart);
  return normalized.every((part): part is string => part !== null) ? normalized.join(' ') : null;
}
