import type { ITheme } from '@xterm/xterm';
import { tokenToCssVariable } from '@hsos/contracts/theme';
import type { TokenName } from '@hsos/contracts/theme';

const ANSI = [
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
  'brightBlack',
  'brightRed',
  'brightGreen',
  'brightYellow',
  'brightBlue',
  'brightMagenta',
  'brightCyan',
  'brightWhite',
] as const;

type Read = (token: TokenName) => string;

/** Reads tokens from the root element's CSS variables, as `applyTheme` set them. */
export function readTokens(root: HTMLElement = document.documentElement): Read {
  const style = getComputedStyle(root);
  return (token) => style.getPropertyValue(tokenToCssVariable(token)).trim();
}

/** `#RRGGBB` at `alpha` as `rgba(...)`; other values pass through unchanged. */
export function withAlpha(colour: string, alpha: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(colour);
  if (match === null) return colour;
  const hex = match[1] ?? '000000';
  const channel = (start: number) => Number.parseInt(hex.slice(start, start + 2), 16);
  return `rgba(${channel(0)}, ${channel(2)}, ${channel(4)}, ${alpha})`;
}

/**
 * The opacity of the terminal's background: `surface.terminal.alpha`, never below
 * `surface.text.minAlpha` (UI-31, TERM-76).
 */
export function terminalAlpha(read: Read): number {
  const number = (token: TokenName, fallback: number) => {
    const value = Number.parseFloat(read(token));
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
  };
  return Math.max(number('surface.terminal.alpha', 1), number('surface.text.minAlpha', 0));
}

/**
 * xterm's colours from the `color.term.*` tokens (TERM-51). Only the background is see-through
 * (TERM-76); text, cursor and selection stay opaque.
 */
export function xtermTheme(read: Read): ITheme {
  const theme: Record<string, string> = {
    foreground: read('color.term.foreground'),
    background: withAlpha(read('color.term.background'), terminalAlpha(read)),
    cursor: read('color.term.cursor'),
    cursorAccent: read('color.term.background'),
    selectionBackground: read('color.term.selection'),
  };
  for (const name of ANSI) theme[name] = read(`color.term.ansi.${name}` as TokenName);
  return theme as ITheme;
}
