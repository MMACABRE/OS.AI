import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
type RawValue = { readonly line: number; readonly message: string; readonly value: string };
/** The script is plain JavaScript without types, so it is loaded by URL. */
const scriptUrl = pathToFileURL(resolve(import.meta.dirname, '../../eslint-rules/no-raw-css-values.js')).href;
const { findRawValues } = (await import(/* @vite-ignore */ scriptUrl)) as unknown as {
  findRawValues: (text: string) => RawValue[];
};
const fixture = readFileSync(resolve(root, 'tests/fixtures/css/raw-values.module.css'), 'utf8');

describe('UI-1 component CSS holds only token values', () => {
  it('UI-1 findRawValues reports exactly the hex, the rgba( and the 4px of the fixture', () => {
    const problems = findRawValues(fixture);
    expect(problems.map((problem) => ({ line: problem.line, value: problem.value }))).toEqual([
      { line: 2, value: '#ff0000' },
      { line: 3, value: 'rgba(' },
      { line: 4, value: '4px' },
    ]);
  });

  it('UI-1 findRawValues reports nothing for 2px 1px 0, a comment, or var(--size-row)', () => {
    const clean = '.a {\n  margin: 2px 1px 0;\n  /* #abc and 9px in a comment */\n  width: var(--size-row);\n}\n';
    expect(findRawValues(clean)).toEqual([]);
  });

  it('UI-1 running the script over src exits 0', () => {
    const run = () =>
      execFileSync(process.execPath, ['eslint-rules/no-raw-css-values.js', 'src'], {
        cwd: root,
        stdio: 'pipe',
      });
    expect(run).not.toThrow();
  });
});
