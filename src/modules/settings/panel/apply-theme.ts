import type { AppearanceSettings } from '@hsos/contracts/channels/settings';
import { TOKEN_NAMES, tokenToCssVariable } from '@hsos/contracts/theme';

export type ThemeToApply = {
  readonly kind: 'dark' | 'light';
  readonly tokens: Readonly<Record<string, string>>;
};

/**
 * Sets every token of the resolved theme as a CSS variable on the root element and marks the theme's
 * kind with `data-theme-kind`. No reload is needed (SET-13).
 */
export function applyTheme(theme: ThemeToApply, root: HTMLElement = document.documentElement): void {
  for (const name of TOKEN_NAMES) {
    const value = theme.tokens[name];
    if (value === undefined || value === '') root.style.removeProperty(tokenToCssVariable(name));
    else root.style.setProperty(tokenToCssVariable(name), value);
  }
  root.setAttribute('data-theme-kind', theme.kind);
}

/**
 * `data-motion="reduced"` when `reduceMotion` is `on`, or `system` while Windows asks for less motion;
 * otherwise `full`, even when Windows asks for less (SET-15).
 */
export function applyMotion(
  reduceMotion: AppearanceSettings['reduceMotion'],
  systemPrefersReduced: boolean,
  root: HTMLElement = document.documentElement,
): void {
  const reduced = reduceMotion === 'on' || (reduceMotion === 'system' && systemPrefersReduced);
  root.setAttribute('data-motion', reduced ? 'reduced' : 'full');
}
