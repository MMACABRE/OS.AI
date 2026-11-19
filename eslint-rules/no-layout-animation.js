/**
 * MOT-1: only opacity, transform, filter and clip-path animate. This ESLint rule reads every CSS module
 * a source file imports (and the modules those compose from) and reports each `transition`,
 * `transition-property` or `@keyframes` block that names any other property, `all` included.
 *
 * `findLayoutAnimations(text)` is the check itself, exported for tests and other scripts.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const ANIMATABLE = new Set(['opacity', 'transform', 'filter', 'clip-path']);
const NOT_A_PROPERTY =
  /^(?:none|initial|inherit|unset|revert|normal|allow-discrete|ease|linear|ease-in|ease-out|ease-in-out|step-start|step-end|-?[\d.]+m?s|var\(.*\)|calc\(.*\)|cubic-bezier\(.*\)|steps\(.*\)|linear\(.*\))$/i;

/** Blanks out comments but keeps line breaks, so line numbers stay right. */
function withoutComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
}

/** Splits on `separator` outside parentheses. */
function splitTopLevel(value, separator) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const char of value) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (depth === 0 && separator.test(char)) {
      if (current.trim() !== '') parts.push(current.trim());
      current = '';
    } else current += char;
  }
  if (current.trim() !== '') parts.push(current.trim());
  return parts;
}

const lineAt = (text, index) => text.slice(0, index).split('\n').length;

/** The properties a `transition` or `transition-property` value names. */
function transitionedProperties(name, value) {
  return splitTopLevel(value, /,/).flatMap((part) => {
    const words = splitTopLevel(part, /\s/);
    if (name === 'transition-property') return words;
    const property = words.find((word) => !NOT_A_PROPERTY.test(word));
    return property === undefined ? [] : [property];
  });
}

/** Problems in one CSS text: `{ line, message }`. */
export function findLayoutAnimations(text) {
  const css = withoutComments(text);
  const problems = [];
  for (const match of css.matchAll(/(?<![\w-])(transition(?:-property)?)\s*:\s*([^;}]+)/g)) {
    for (const property of transitionedProperties(match[1], match[2])) {
      const lower = property.toLowerCase();
      if (lower === 'none' || ANIMATABLE.has(lower)) continue;
      problems.push({
        line: lineAt(css, match.index),
        message: `transition of "${property}": only opacity, transform, filter and clip-path animate (MOT-1)`,
      });
    }
  }
  for (const match of css.matchAll(/@keyframes\s+([\w-]+)\s*\{/g)) {
    let depth = 1;
    let end = match.index + match[0].length;
    while (end < css.length && depth > 0) {
      if (css[end] === '{') depth += 1;
      if (css[end] === '}') depth -= 1;
      end += 1;
    }
    const body = css.slice(match.index + match[0].length, end - 1);
    const offset = match.index + match[0].length;
    for (const declaration of body.matchAll(/([\w-]+)\s*:/g)) {
      const property = declaration[1].toLowerCase();
      if (ANIMATABLE.has(property) || property.startsWith('--') || property === 'animation-timing-function')
        continue;
      problems.push({
        line: lineAt(css, offset + declaration.index),
        message: `@keyframes ${match[1]} animates "${declaration[1]}": only opacity, transform, filter and clip-path animate (MOT-1)`,
      });
    }
  }
  return problems;
}

/** The CSS module files a CSS text composes from, resolved against `file`. */
function composedFiles(file, text) {
  return [...text.matchAll(/composes\s*:[^;]*?\bfrom\s+['"]([^'"]+)['"]/g)].map((match) =>
    resolve(dirname(file), match[1]),
  );
}

/** Every problem in `file` and the modules it composes from, each file read once. */
function checkCssModule(file, seen = new Set()) {
  if (seen.has(file) || !existsSync(file)) return [];
  seen.add(file);
  const text = readFileSync(file, 'utf8');
  return [
    ...findLayoutAnimations(text).map((problem) => ({ ...problem, file })),
    ...composedFiles(file, text).flatMap((next) => checkCssModule(next, seen)),
  ];
}

/** @type {import('eslint').Rule.RuleModule} */
export const noLayoutAnimation = {
  meta: {
    type: 'problem',
    docs: { description: 'Only opacity, transform, filter and clip-path animate in CSS modules (MOT-1).' },
    schema: [],
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (typeof source !== 'string' || !source.endsWith('.module.css') || !source.startsWith('.')) return;
        const file = resolve(dirname(context.filename), source);
        for (const problem of checkCssModule(file)) {
          context.report({ node, message: `${problem.file}:${problem.line}: ${problem.message}` });
        }
      },
    };
  },
};

export default { rules: { 'no-layout-animation': noLayoutAnimation } };
