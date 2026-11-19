/** Colour reading for the graph canvas: token values as hex, and alpha for fades (GRAPH-23, GRAPH-42). */
import { tokenToCssVariable } from '@hsos/contracts/theme';
import type { TokenName } from '@hsos/contracts/theme';

const FALLBACK = '#F2E8DE';

/** A token's current value on the document root, or a fallback when it is not set yet. */
export function tokenValue(token: TokenName): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(tokenToCssVariable(token)).trim();
  return value === '' ? FALLBACK : value;
}

/** The same colour at `alpha`, as an rgba() string the canvas accepts. Non-hex input is returned unchanged. */
export function withAlpha(colour: string, alpha: number): string {
  const match = /^#([0-9a-fA-F]{6})$/.exec(colour);
  if (match === null || match[1] === undefined) return colour;
  const value = Number.parseInt(match[1], 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
