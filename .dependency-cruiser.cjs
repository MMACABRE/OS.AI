/** Dependency direction of spec/03-stack.md "Boundaries" and spec/02-architecture.md §4. */
module.exports = {
  forbidden: [
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
    {
      name: 'module-to-other-module',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to: { path: '^src/modules/', pathNot: ['^src/modules/$1/', '^src/modules/ui-kit/'] },
    },
    {
      name: 'ui-to-service',
      severity: 'error',
      from: { path: '^src/(ui/|modules/[^/]+/panel/|modules/[^/]+/register\.ui\.ts)' },
      to: { path: '(^src/modules/[^/]+/service/|^src/services/|^src/main/)' },
    },
    {
      name: 'ui-to-node',
      severity: 'error',
      from: { path: '^src/(ui/|modules/[^/]+/panel/)' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'service-to-panel',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/service/' },
      to: { path: '(^src/modules/[^/]+/panel/|^src/ui/|node_modules/react)' },
    },
    {
      name: 'electron-outside-main',
      severity: 'error',
      from: { pathNot: '^src/(main|preload)/|^src/modules/browser/service/' },
      to: { path: '^electron$|node_modules/electron/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '^(out|dist|node_modules)/' },
    tsConfig: { fileName: 'tsconfig.node.json' },
    tsPreCompilationDeps: true,
  },
};
