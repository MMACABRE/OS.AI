// Loaded through NODE_OPTIONS in one e2e run (DIAG-8). In the named service's first start it throws one
// uncaught exception after a second; the marker file records that the throw happened, so the restart runs clean.
const { existsSync, writeFileSync } = process.getBuiltinModule('node:fs');

const target = process.env.HSOS_E2E_THROW_IN;
const marker = process.env.HSOS_E2E_THROW_MARKER;
const entry = process.argv[1] ?? '';

if (process.type === 'utility' && target && marker && entry.endsWith(`${target}.js`) && !existsSync(marker)) {
  writeFileSync(marker, 'thrown\n');
  setTimeout(() => {
    throw new Error('e2e: deliberate uncaught exception (DIAG-8)');
  }, 1000);
}
