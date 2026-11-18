/** Longest string kept in a log record's data (DIAG-5). */
export const MAX_VALUE_LENGTH = 2_000;
export const REDACTED = '[redacted]';

const SECRET_KEY = /token|secret|password|authorization|cookie/i;

function cleanValue(value: unknown, secret: boolean): unknown {
  if (typeof value === 'string') return secret ? REDACTED : truncate(value);
  if (Array.isArray(value)) return value.map((item) => cleanValue(item, secret));
  // An Error has no enumerable fields; keep what a reader needs (DIAG-8 logs the stack).
  if (value instanceof Error)
    return cleanRecord({ name: value.name, message: value.message, stack: value.stack }, secret);
  if (typeof value === 'object' && value !== null) return cleanRecord(value, secret);
  return value;
}

function cleanRecord(record: object, secret: boolean): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record))
    out[key] = cleanValue(value, secret || SECRET_KEY.test(key));
  return out;
}

/** Cuts a string to 2 000 characters, the last one `…` (DIAG-5). */
export function truncate(value: string): string {
  return value.length > MAX_VALUE_LENGTH ? `${value.slice(0, MAX_VALUE_LENGTH - 1)}…` : value;
}

/**
 * Returns a copy of `data` safe to write: every string under a key naming a secret, at any depth,
 * becomes `[redacted]` (DIAG-4, P-8), and every other string is cut to 2 000 characters (DIAG-5).
 */
export function redact(data: Record<string, unknown>): Record<string, unknown> {
  return cleanRecord(data, false);
}
