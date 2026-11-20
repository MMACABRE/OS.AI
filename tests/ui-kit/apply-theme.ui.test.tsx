import { afterEach, describe, expect, it } from 'vitest';
import { applyMotion, applyTheme } from '../../src/modules/settings/panel/apply-theme';

afterEach(() => {
  document.documentElement.removeAttribute('style');
  document.documentElement.removeAttribute('data-motion');
  document.documentElement.removeAttribute('data-theme-kind');
});

describe('applyTheme', () => {
  it('UI-31 applyTheme sets --surface-terminal-alpha to the raised value and returns the problem', () => {
    const root = document.documentElement;
    const problems = applyTheme({
      kind: 'dark',
      tokens: { 'surface.terminal.alpha': '0.3', 'surface.text.minAlpha': '0.85' },
    });
    expect(root.style.getPropertyValue('--surface-terminal-alpha')).toBe('0.85');
    expect(root.style.getPropertyValue('--surface-text-minAlpha')).toBe('0.85');
    expect(problems).toHaveLength(1);
    expect(problems[0]?.token).toBe('surface.terminal.alpha');
  });

  it('SET-13 applyTheme marks the theme kind on the root', () => {
    applyTheme({ kind: 'light', tokens: {} });
    expect(document.documentElement.getAttribute('data-theme-kind')).toBe('light');
  });

  it('SET-15 reduceMotion on gives data-motion reduced, and off with the system preference on gives full', () => {
    applyMotion('on', false);
    expect(document.documentElement.getAttribute('data-motion')).toBe('reduced');
    applyMotion('off', true);
    expect(document.documentElement.getAttribute('data-motion')).toBe('full');
    applyMotion('system', true);
    expect(document.documentElement.getAttribute('data-motion')).toBe('reduced');
    applyMotion('system', false);
    expect(document.documentElement.getAttribute('data-motion')).toBe('full');
  });
});
