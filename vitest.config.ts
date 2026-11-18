import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@hsos/contracts': resolve(import.meta.dirname, 'spec/contracts'),
      '@hsos/ui-kit': resolve(import.meta.dirname, 'src/modules/ui-kit/index.ts'),
    },
  },
  test: {
    retry: 0,
    projects: [
      {
        extends: true,
        test: { name: 'node', include: ['tests/**/*.test.ts'], exclude: ['tests/e2e/**'], environment: 'node' },
      },
      {
        extends: true,
        test: { name: 'ui', include: ['tests/**/*.ui.test.tsx'], environment: 'jsdom' },
      },
    ],
  },
});
