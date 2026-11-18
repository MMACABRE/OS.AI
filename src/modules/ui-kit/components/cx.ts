/** Joins class names, skipping false, null and undefined. */
export function cx(...names: readonly (string | false | null | undefined)[]): string {
  return names.filter((name): name is string => typeof name === 'string' && name !== '').join(' ');
}

/** Tones shared by Badge, StatusDot and ProgressBar (visual-direction.md colour jobs). */
export type Tone = 'ok' | 'warn' | 'danger' | 'info';
