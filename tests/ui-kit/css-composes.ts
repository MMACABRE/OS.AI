/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * CSS Modules under vitest keep only an element's own class (for example `_button_3bcc9e`); the classes it
 * `composes` are not added. These helpers read the `.module.css` source instead, so a test can still check
 * that a class composes the shared `lift` or `focusRing` classes.
 */

/** The source folder of the ui-kit components. */
export const COMPONENTS = resolve(import.meta.dirname, '../../src/modules/ui-kit/components');

/** The source name of a hashed module class: `_button_3bcc9e` gives `button`. */
export function sourceClassNames(element: Element): string[] {
  return [...element.classList].map((name) => name.replace(/^_(.+)_[0-9a-f]+$/, '$1'));
}

/** Every class name that `.className` in `cssFile` composes, followed through other module files. */
export function composedBy(cssFile: string, className: string, seen = new Set<string>()): Set<string> {
  const result = new Set<string>();
  const key = `${cssFile}#${className}`;
  if (seen.has(key)) return result;
  seen.add(key);
  const text = readFileSync(cssFile, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = new RegExp(`\\.${className}\\s*\\{([^}]*)\\}`).exec(text);
  for (const match of (rule?.[1] ?? '').matchAll(/composes:\s*([^;]+?)(?:\s+from\s+'([^']+)')?;/g)) {
    const names = (match[1] ?? '').split(/\s+/).filter((name) => name !== '');
    const from = match[2] === undefined ? cssFile : resolve(dirname(cssFile), match[2]);
    for (const name of names) {
      result.add(name);
      for (const nested of composedBy(from, name, seen)) result.add(nested);
    }
  }
  return result;
}

/** True when one of the element's own classes, looked up in `cssFile`, composes `wanted`. */
export function composes(element: Element, cssFile: string, wanted: string): boolean {
  return sourceClassNames(element).some((name) => composedBy(cssFile, name).has(wanted));
}
