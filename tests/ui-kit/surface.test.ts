import { describe, expect, it } from 'vitest';
import { raiseReadingAlphas } from '../../src/modules/ui-kit/components/surface-alpha';

describe('UI-31 reading surfaces keep a minimum opacity', () => {
  it('UI-31 a terminal alpha of 0.3 under a minAlpha of 0.85 is raised to 0.85 and one problem names the token', () => {
    const tokens = {
      'surface.terminal.alpha': '0.3',
      'surface.text.minAlpha': '0.85',
      'surface.panel.alpha': '0.5',
    };
    const result = raiseReadingAlphas(tokens);
    expect(result.tokens['surface.terminal.alpha']).toBe('0.85');
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]?.token).toBe('surface.terminal.alpha');
    expect(result.problems[0]?.message).toContain('surface.terminal.alpha');
  });

  it('UI-31 a terminal alpha at or above minAlpha is left alone and reports nothing', () => {
    const tokens = { 'surface.terminal.alpha': '0.9', 'surface.text.minAlpha': '0.85' };
    const result = raiseReadingAlphas(tokens);
    expect(result.tokens['surface.terminal.alpha']).toBe('0.9');
    expect(result.problems).toEqual([]);
  });

  it('UI-31 tokens other than the reading roles pass through unchanged', () => {
    const tokens = {
      'surface.terminal.alpha': '0.3',
      'surface.text.minAlpha': '0.85',
      'surface.panel.alpha': '0.5',
    };
    expect(raiseReadingAlphas(tokens).tokens['surface.panel.alpha']).toBe('0.5');
  });
});
