import type { TokenName } from '@hsos/contracts/theme';

/** The surface roles of UI-31. */
export type SurfaceRole = 'app' | 'panel' | 'terminal' | 'overlay' | 'widget' | 'ribbon';

/** Roles whose surface always holds reading text, so their opacity never goes below `surface.text.minAlpha`. */
const READING_ROLES: readonly SurfaceRole[] = ['terminal'];

export type SurfaceProblem = { readonly token: TokenName; readonly message: string };

const alphaToken = (role: SurfaceRole): TokenName => `surface.${role}.alpha` as TokenName;

const toAlpha = (value: string | undefined): number | null => {
  if (value === undefined || value.trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : null;
};

/**
 * Raises every reading surface's opacity to `surface.text.minAlpha` (UI-31, P-45) and returns the
 * corrected tokens with one problem per raised value. Other tokens pass through unchanged.
 */
export function raiseReadingAlphas<T extends Readonly<Record<string, string>>>(
  tokens: T,
): { readonly tokens: T; readonly problems: readonly SurfaceProblem[] } {
  const floor = toAlpha(tokens['surface.text.minAlpha']);
  if (floor === null) return { tokens, problems: [] };
  const raised: Record<string, string> = { ...tokens };
  const problems: SurfaceProblem[] = [];
  for (const role of READING_ROLES) {
    const token = alphaToken(role);
    const alpha = toAlpha(tokens[token]);
    if (alpha === null || alpha >= floor) continue;
    raised[token] = String(floor);
    problems.push({
      token,
      message: `${token} is ${alpha}, below surface.text.minAlpha ${floor}; ${floor} is used`,
    });
  }
  return { tokens: raised as T, problems };
}
