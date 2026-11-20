import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ThemeFile, TOKEN_NAMES } from '@hsos/contracts/theme';
import { applyMotion, applyTheme } from '../../src/modules/settings/panel/apply-theme';
import { resolveTheme } from '../../src/modules/settings/service/theme-store';

const readTheme = (path: string): ThemeFile =>
  ThemeFile.parse(JSON.parse(readFileSync(resolve(import.meta.dirname, path), 'utf8')));

const root = () => document.documentElement;

beforeEach(() => {
  root().removeAttribute('style');
  root().removeAttribute('data-theme-kind');
  root().removeAttribute('data-motion');
});
afterEach(() => {
  root().removeAttribute('style');
});

describe('apply theme', () => {
  it('SET-13 the resolved test-light theme sets --color-bg-app to #F4F1EA and data-theme-kind to light', () => {
    const phosphor = readTheme('../../resources/themes/phosphor.json');
    const light = readTheme('../fixtures/themes/test-light.json');
    const { theme } = resolveTheme(phosphor, light, 'C:\\themes\\test-light.json');

    applyTheme(theme);

    expect(root().style.getPropertyValue('--color-bg-app')).toBe('#F4F1EA');
    expect(root().getAttribute('data-theme-kind')).toBe('light');
  });

  it('SET-13 every token of the theme becomes a CSS variable, and a second theme replaces the first without a reload', () => {
    const phosphor = readTheme('../../resources/themes/phosphor.json');
    const light = readTheme('../fixtures/themes/test-light.json');

    applyTheme(resolveTheme(phosphor, phosphor, 'p').theme);
    expect(root().getAttribute('data-theme-kind')).toBe('dark');
    expect(root().style.getPropertyValue('--color-bg-app')).toBe(phosphor.tokens['color.bg.app']);
    for (const name of TOKEN_NAMES) {
      const variable = `--${name.replace(/\./g, '-')}`;
      expect(root().style.getPropertyValue(variable)).not.toBe('');
    }

    applyTheme(resolveTheme(phosphor, light, 'l').theme);
    expect(root().style.getPropertyValue('--color-bg-app')).toBe('#F4F1EA');
    expect(root().getAttribute('data-theme-kind')).toBe('light');
  });

  it('SET-15 reduceMotion on sets data-motion reduced; off with the system preference on sets full', () => {
    applyMotion('on', false);
    expect(root().getAttribute('data-motion')).toBe('reduced');

    applyMotion('off', true);
    expect(root().getAttribute('data-motion')).toBe('full');
  });

  it('SET-15 reduceMotion system follows the system preference', () => {
    applyMotion('system', true);
    expect(root().getAttribute('data-motion')).toBe('reduced');
    applyMotion('system', false);
    expect(root().getAttribute('data-motion')).toBe('full');
  });
});
