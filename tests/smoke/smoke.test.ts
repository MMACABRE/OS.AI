import { describe, expect, it } from 'vitest';
import { ok } from '@hsos/contracts/result';

describe('smoke', () => {
  it('imports the contracts', () => {
    expect(ok(1).ok).toBe(true);
  });
});
