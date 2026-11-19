import './scripts/typescript6.mjs';

const { default: tseslint } = await import('typescript-eslint');
const { default: boundaries } = await import('eslint-plugin-boundaries');
const { default: hsos } = await import('./eslint-rules/no-layout-animation.js');

const nodeBuiltins = ['node:*', 'fs', 'path', 'os', 'child_process', 'crypto', 'net', 'http', 'https', 'url', 'util', 'stream', 'events', 'worker_threads'];

/** Boundaries of spec/03-stack.md, "Boundaries, enforced by lint". */
export default tseslint.config(
  { ignores: ['out/**', 'dist/**', 'node_modules/**', 'spec/**', '.crew/**', 'design-round/**', 'Visual Reference/**'] },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
    },
  },
  {
    // MOT-1: CSS modules a component imports animate only opacity, transform, filter and clip-path.
    files: ['src/**/*.{ts,tsx}'],
    plugins: { hsos },
    rules: { 'hsos/no-layout-animation': 'error' },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'import/resolver': { node: { extensions: ['.ts', '.tsx', '.js'] } },
      'boundaries/elements': [
        { type: 'module', pattern: 'src/modules/*', capture: ['moduleId'] },
        { type: 'app', pattern: 'src/(main|preload|services|ui|demo)', capture: ['part'] },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            {
              from: { element: { type: 'module' } },
              allow: { to: { element: { type: 'module', captured: { moduleId: '{{ from.element.captured.moduleId }}' } } } },
            },
            {
              from: { element: { type: 'module' } },
              allow: { to: { element: { type: 'module', captured: { moduleId: 'ui-kit' } } } },
            },
            { from: { element: { type: 'app' } }, allow: { to: { element: { types: ['module', 'app'] } } } },
          ],
        },
      ],
    },
  },
  {
    files: ['src/modules/*/panel/**', 'src/ui/**', 'src/modules/*/register.ui.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'electron', message: 'Only main and preload import electron.' }],
          patterns: [
            { group: nodeBuiltins, message: 'No Node built-ins in the ui.' },
            { group: ['**/service/**'], message: 'The ui may not import service code.' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/modules/*/service/**', 'src/modules/*/register.service.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'react', message: 'Service code may not import react.' }],
          patterns: [{ group: ['**/panel/**', 'react-dom', 'react-dom/*'], message: 'Service code may not import panels.' }],
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/main/**', 'src/preload/**', 'src/modules/browser/service/**', 'src/modules/*/panel/**', 'src/ui/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: [{ name: 'electron', message: 'Only main and preload import electron.' }] },
      ],
    },
  },
);
