import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import writeFileAtomic from 'write-file-atomic';
import type { z } from 'zod';

export type JsonRead<T> =
  | { readonly kind: 'missing' }
  | { readonly kind: 'ok'; readonly value: T; readonly text: string }
  | { readonly kind: 'invalid'; readonly reason: string; readonly text: string };

/** Reads a JSON file and validates it with `schema`. Never throws. */
export async function readJson<T>(file: string, schema: z.ZodType<T>): Promise<JsonRead<T>> {
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch {
    return { kind: 'missing' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  } catch (error) {
    return {
      kind: 'invalid',
      reason: `Not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      text,
    };
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue === undefined || issue.path.length === 0 ? '' : ` at ${issue.path.join('.')}`;
    return { kind: 'invalid', reason: `${issue?.message ?? 'Invalid content'}${where}`, text };
  }
  return { kind: 'ok', value: result.data, text };
}

/**
 * Writes `value` as JSON atomically (P-3): the previous content, if any, is first copied to `<file>.bak`,
 * then the new content replaces the file in one rename. Throws when the write fails.
 */
export async function writeJsonAtomic(file: string, value: unknown): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  await copyFile(file, `${file}.bak`).catch(() => undefined);
  await writeFileAtomic(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8' });
}
