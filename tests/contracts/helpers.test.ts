import { describe, expect, it } from 'vitest';
import { err, ok } from '@hsos/contracts/result';
import { newId, toAbsPath, toRelPath } from '@hsos/contracts/ids';
import { tokenToCssVariable } from '@hsos/contracts/theme';

describe('result helpers', () => {
  it('ok wraps a value', () => {
    expect(ok(5)).toEqual({ ok: true, value: 5 });
  });

  it('err without details has no details key', () => {
    const failure = err('NOT_FOUND', 'Not there.');
    expect(failure).toEqual({ ok: false, error: { code: 'NOT_FOUND', message: 'Not there.' } });
    expect('details' in failure.error).toBe(false);
  });

  it('err with details keeps them', () => {
    expect(err('BAD_REQUEST', 'Bad.', { field: 'x' })).toEqual({
      ok: false,
      error: { code: 'BAD_REQUEST', message: 'Bad.', details: { field: 'x' } },
    });
  });
});

describe('newId', () => {
  it('is 12 characters from the lower-case alphanumeric alphabet', () => {
    const id = newId<string>();
    expect(id).toMatch(/^[0-9a-z]{12}$/);
  });

  it('is deterministic with an injected random', () => {
    expect(newId<string>(() => 0)).toBe('000000000000');
    expect(newId<string>(() => 0.999)).toBe('zzzzzzzzzzzz');
    let step = 0;
    const sequence = () => (step++ % 36) / 36;
    expect(newId<string>(sequence)).toBe('0123456789ab');
  });
});

describe('paths', () => {
  it('toAbsPath upper-cases the drive, uses backslashes and drops a trailing slash', () => {
    expect(toAbsPath('c:/a/b/')).toBe('C:\\a\\b');
  });

  it('toAbsPath keeps a drive root', () => {
    expect(toAbsPath('C:\\')).toBe('C:\\');
  });

  it('toRelPath uses forward slashes and no leading slash', () => {
    expect(toRelPath('\\a\\b')).toBe('a/b');
  });
});

describe('tokenToCssVariable', () => {
  it('turns dots into dashes behind two dashes', () => {
    expect(tokenToCssVariable('color.bg.app')).toBe('--color-bg-app');
  });
});
