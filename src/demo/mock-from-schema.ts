/**
 * Builds a value that passes a zod schema, for channels the hand-written fixtures do not cover.
 * The value is plausible rather than clever: it fills every field so every panel has something to draw.
 * The demo still parses the result with the channel's schema; a value this cannot build is reported.
 */

type Check = {
  readonly check?: string;
  readonly format?: string;
  readonly pattern?: RegExp;
  readonly value?: number | bigint;
  readonly inclusive?: boolean;
  readonly length?: number;
  readonly minimum?: number;
  readonly maximum?: number;
};
type Def = Record<string, unknown> & {
  readonly type?: string;
  readonly checks?: readonly { _zod: { def: Check } }[];
};

const WORDS = [
  'phosphor',
  'steam',
  'ribbon',
  'vault',
  'session',
  'skill',
  'branch',
  'note',
  'agent',
  'graph',
];
const ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
/** A stable "now" so fixtures do not drift between runs: 2026-11-18 09:40 local. */
export const DEMO_NOW = Date.UTC(2026, 10, 18, 8, 40, 0);

function defOf(schema: unknown): Def {
  return typeof schema === 'object' && schema !== null && 'def' in schema ? (schema.def as Def) : {};
}

function checksOf(def: Def): Check[] {
  return (def.checks ?? []).map((check) => check._zod.def);
}

/** Candidate strings for a regex check, tried in order. */
const REGEX_CANDIDATES = [
  '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
  '0123456789abcdef',
  'a1b2c3d4e5f6',
  'abcdefghijkl',
  'main',
  'feat/phosphor-dust',
  'Ctrl+Shift+P',
  '#FF7A3D',
  'phosphor',
  'v1',
  '1.0.0',
  'a',
];

function mockString(def: Def, hint: string, seed: number): string {
  const checks = checksOf(def);
  let min = 0;
  let max = Number.POSITIVE_INFINITY;
  let exact: number | null = null;
  for (const check of checks) {
    if (check.check === 'min_length' && typeof check.minimum === 'number') min = check.minimum;
    if (check.check === 'max_length' && typeof check.maximum === 'number') max = check.maximum;
    if (check.check === 'length_equals' && typeof check.length === 'number') exact = check.length;
    if (check.check === 'string_format') {
      if (check.format === 'url') return `https://github.com/hsos-owner/${WORDS[seed % WORDS.length]}`;
      if (check.format === 'email') return 'owner@example.com';
      if (check.format === 'uuid' || check.format === 'guid') return '7f3c2a10-4b8e-4c1d-9a6f-2e5b8d0c1a3f';
      if (check.format === 'datetime') return new Date(DEMO_NOW).toISOString();
      if (check.format === 'regex' && check.pattern instanceof RegExp) {
        const found = REGEX_CANDIDATES.find((candidate) => (check.pattern as RegExp).test(candidate));
        if (found !== undefined) return found;
      }
    }
  }
  if (exact !== null)
    return Array.from({ length: exact }, (_, index) => ID_ALPHABET[(index * 7 + seed) % 36]).join('');
  const lower = hint.toLowerCase();
  let text: string;
  if (/path|file|folder|dir|root|cwd/.test(lower))
    text = `C:\\Users\\owner\\code\\hsos\\src\\${WORDS[seed % WORDS.length]}.ts`;
  else if (/url|link|href/.test(lower)) text = `https://github.com/hsos-owner/hsos`;
  else if (/branch/.test(lower)) text = 'main';
  else if (/sha|hash|commit/.test(lower)) text = '4f9c2e1a7b3d5f6081a2c4e6b8d0f1a3c5e7b9d2';
  else if (/name|title|label/.test(lower))
    text = `${WORDS[seed % WORDS.length]} ${WORDS[(seed + 3) % WORDS.length]}`;
  else if (/message|text|body|summary|description|detail|reason/.test(lower))
    text = 'Tuned the phosphor dust so the steam reads behind the terminal.';
  else text = WORDS[seed % WORDS.length] ?? 'demo';
  if (text.length > max) text = text.slice(0, max);
  while (text.length < min) text += 'x';
  return text;
}

function mockNumber(def: Def, hint: string, seed: number): number {
  const checks = checksOf(def);
  let min = 0;
  let max = 100;
  let int = false;
  for (const check of checks) {
    if (check.check === 'greater_than' && typeof check.value === 'number')
      min = check.value + (check.inclusive === true ? 0 : 1);
    if (check.check === 'less_than' && typeof check.value === 'number')
      max = check.value - (check.inclusive === true ? 0 : 1);
    if (check.check === 'number_format' && (check.format === 'safeint' || check.format === 'int32'))
      int = true;
  }
  const lower = hint.toLowerCase();
  if (/time|at$|date|when|since|until|started|ended|modified|created|updated/.test(lower) && max >= DEMO_NOW)
    return DEMO_NOW - (seed % 12) * 7 * 60_000;
  if (max < min) max = min;
  const span = max - min;
  const value = min + (span > 0 ? (((seed * 37) % 100) / 100) * Math.min(span, 1_000) : 0);
  return int ? Math.round(value) : Math.round(value * 100) / 100;
}

/** A value for `schema`; `hint` is the field name, which shapes strings and numbers. */
export function mockFromSchema(schema: unknown, hint = '', seed = 1, depth = 0): unknown {
  const def = defOf(schema);
  if (depth > 12) return null;
  switch (def.type) {
    case 'string':
      return mockString(def, hint, seed);
    case 'number':
      return mockNumber(def, hint, seed);
    case 'int':
      return Math.round(mockNumber(def, hint, seed));
    case 'boolean':
      return seed % 3 !== 0;
    case 'bigint':
      return BigInt(seed);
    case 'null':
      return null;
    case 'undefined':
    case 'void':
      return undefined;
    case 'any':
    case 'unknown':
      return null;
    case 'literal':
      return (def['values'] as unknown[])[0];
    case 'enum': {
      const entries = def['entries'] as Record<string, unknown>;
      const values = Object.values(entries);
      return values[seed % values.length];
    }
    case 'nullable':
    case 'optional':
    case 'readonly':
    case 'nonoptional':
      return mockFromSchema(def['innerType'], hint, seed, depth + 1);
    case 'default':
    case 'prefault':
      return mockFromSchema(def['innerType'], hint, seed, depth + 1);
    case 'catch':
      return mockFromSchema(def['innerType'], hint, seed, depth + 1);
    case 'pipe':
      return mockFromSchema(def['in'], hint, seed, depth + 1);
    case 'lazy':
      return mockFromSchema((def['getter'] as () => unknown)(), hint, seed, depth + 1);
    case 'array': {
      const count = depth > 3 ? 1 : 3;
      return Array.from({ length: count }, (_, index) =>
        mockFromSchema(def['element'], hint, seed + index, depth + 1),
      );
    }
    case 'tuple':
      return (def['items'] as unknown[]).map((item, index) =>
        mockFromSchema(item, hint, seed + index, depth + 1),
      );
    case 'object': {
      const shape = def['shape'] as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      let offset = 0;
      for (const [key, value] of Object.entries(shape)) {
        offset += 1;
        const field = mockFromSchema(value, key, seed + offset, depth + 1);
        if (field !== undefined) out[key] = field;
      }
      return out;
    }
    case 'record': {
      const key = mockFromSchema(def['keyType'], hint, seed, depth + 1);
      return { [String(key)]: mockFromSchema(def['valueType'], hint, seed + 1, depth + 1) };
    }
    case 'map':
      return new Map();
    case 'set':
      return new Set();
    case 'union': {
      const options = def['options'] as unknown[];
      return mockFromSchema(options[0], hint, seed, depth + 1);
    }
    case 'intersection':
      return {
        ...(mockFromSchema(def['left'], hint, seed, depth + 1) as object),
        ...(mockFromSchema(def['right'], hint, seed, depth + 1) as object),
      };
    case 'date':
      return new Date(DEMO_NOW);
    case 'custom':
      return /bytes|data|chunk/.test(hint.toLowerCase()) ? new Uint8Array([72, 83, 79, 83]) : null;
    default:
      return null;
  }
}
