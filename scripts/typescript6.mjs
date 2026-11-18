/**
 * TypeScript 7 has no JavaScript compiler API, and typescript-eslint and dependency-cruiser need one.
 * This resolve hook gives those two tools the TypeScript 6 API (@typescript/typescript6), while `tsc`
 * stays on TypeScript 7. Loaded by eslint.config.js and by the `deps` script.
 */
import { registerHooks } from 'node:module';

const NEEDS_TS6 = /[\/]node_modules[\/](@typescript-eslint|typescript-eslint|ts-api-utils|dependency-cruiser)[\/]/;

registerHooks({
  resolve(specifier, context, nextResolve) {
    const fromTool = NEEDS_TS6.test(context.parentURL ?? '');
    if (fromTool && (specifier === 'typescript' || specifier.startsWith('typescript/'))) {
      return nextResolve(specifier.replace(/^typescript/, '@typescript/typescript6'), context);
    }
    return nextResolve(specifier, context);
  },
});
