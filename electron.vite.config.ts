import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

const alias = {
  '@hsos/contracts': resolve(import.meta.dirname, 'spec/contracts'),
  '@hsos/ui-kit': resolve(import.meta.dirname, 'src/modules/ui-kit/index.ts'),
};

const serviceNames = ['pty-host', 'workspace-service', 'link-service'];

export default defineConfig({
  main: {
    resolve: { alias },
    build: {
      rollupOptions: {
        input: {
          index: resolve(import.meta.dirname, 'src/main/index.ts'),
          ...Object.fromEntries(
            serviceNames.map((name) => [name, resolve(import.meta.dirname, `src/services/${name}/index.ts`)]),
          ),
        },
      },
    },
  },
  preload: {
    resolve: { alias },
    build: {
      rollupOptions: {
        input: { index: resolve(import.meta.dirname, 'src/preload/index.ts') },
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
  },
  renderer: {
    root: resolve(import.meta.dirname, 'src/ui'),
    resolve: { alias },
    plugins: [react()],
    // The demo's recorded terminal session is a binary asset imported with ?inline (card 026).
    assetsInclude: ['**/*.bin'],
    build: {
      rollupOptions: { input: { index: resolve(import.meta.dirname, 'src/ui/index.html') } },
    },
  },
});
