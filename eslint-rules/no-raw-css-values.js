#!/usr/bin/env node
/**
 * UI-1: every colour, size, radius, font and duration in a component's CSS is a token variable.
 * This script rejects hex colours, rgb(), rgba(), hsl(), hsla() and px values other than 0, 1px and 2px
 * in every `*.module.css` under the given folders (default `src`). `npm run lint` runs it.
 *
 * Usage: node eslint-rules/no-raw-css-values.js [folder-or-file ...]
 * Exit code 0 when clean, 1 when a value is found (each one is printed as file:line: message).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const ALLOWED_PX = new Set(['0px', '1px', '2px']);
const RULES = [
  { pattern: /#[0-9a-fA-F]{3,8}\b/g, message: 'raw hex colour; use a color.* token' },
  { pattern: /\b(?:rgba?|hsla?)\(/g, message: 'raw colour function; use a color.* token' },
  { pattern: /-?\b\d*\.?\d+px\b/g, message: 'px value other than 0, 1px or 2px; use a token or rem' },
];

/** Every `*.module.css` file under `path`. */
function moduleCssFiles(path) {
  const stats = statSync(path, { throwIfNoEntry: false });
  if (stats === undefined) return [];
  if (stats.isFile()) return path.endsWith('.module.css') ? [path] : [];
  return readdirSync(path).flatMap((name) =>
    name === 'node_modules' ? [] : moduleCssFiles(join(path, name)),
  );
}

/** Blanks out comments but keeps line breaks, so line numbers stay right. */
function withoutComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
}

/** Problems in one CSS text: `{ line, message, value }`. */
export function findRawValues(text) {
  const problems = [];
  withoutComments(text)
    .split('\n')
    .forEach((line, index) => {
      for (const rule of RULES) {
        for (const match of line.matchAll(rule.pattern)) {
          const value = match[0];
          if (rule.message.startsWith('px') && ALLOWED_PX.has(value.replace(/^-/, ''))) continue;
          problems.push({ line: index + 1, message: rule.message, value });
        }
      }
    });
  return problems;
}

function main() {
  const targets = process.argv.slice(2);
  const files = (targets.length > 0 ? targets : ['src']).flatMap(moduleCssFiles);
  let count = 0;
  for (const file of files) {
    for (const problem of findRawValues(readFileSync(file, 'utf8'))) {
      count += 1;
      console.error(
        `${relative(process.cwd(), file)}:${problem.line}: ${problem.message} (${problem.value})`,
      );
    }
  }
  if (count > 0) {
    console.error(`no-raw-css-values: ${count} raw value(s) in CSS modules (UI-1).`);
    process.exit(1);
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) main();
