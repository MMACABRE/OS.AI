import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type Problem = { readonly line: number; readonly message: string };
/** The rule is plain JavaScript without types, so it is loaded by URL. */
const ruleUrl = pathToFileURL(resolve(import.meta.dirname, '../../eslint-rules/no-layout-animation.js')).href;
const { findLayoutAnimations } = (await import(/* @vite-ignore */ ruleUrl)) as unknown as {
  findLayoutAnimations: (text: string) => Problem[];
};

describe('MOT-1 only opacity, transform, filter and clip-path animate', () => {
  it('MOT-1 a width transition, a height keyframe and transition: all give three problems', () => {
    const css = [
      '.a { transition: width 1s }',
      '@keyframes k { to { height: 0 } }',
      '.b { transition: all 1s }',
    ].join('\n');
    const problems = findLayoutAnimations(css);
    expect(problems).toHaveLength(3);
    expect(problems.map((problem) => problem.line).sort()).toEqual([1, 2, 3]);
  });

  it('MOT-1 a transform and filter transition with token timing gives no problem', () => {
    const css = '.a { transition: transform var(--motion-quick) var(--motion-ease-spring), filter 1s }';
    expect(findLayoutAnimations(css)).toEqual([]);
  });

  it('MOT-1 transition-property with a layout property is reported', () => {
    expect(findLayoutAnimations('.a { transition-property: margin-left, opacity }')).toHaveLength(1);
  });
});
