/** The search page for address text that is not a URL (BROW-4). */
export const SEARCH_URL = 'https://duckduckgo.com/?q=';

const LOCAL = /^(localhost|127\.0\.0\.1)(:\d+)?(\/\S*)?$/i;
const SCHEME = /^(https?|file|about):/i;

/**
 * What the address field means (BROW-4): a scheme is kept; localhost and 127.0.0.1 become http; text with a dot
 * and no spaces becomes https; anything else is a search.
 */
export function normalizeAddress(input: string): string {
  const text = input.trim();
  if (text === '') return 'about:blank';
  if (SCHEME.test(text)) return text;
  if (LOCAL.test(text)) return `http://${text}`;
  if (!/\s/.test(text) && text.includes('.')) return `https://${text}`;
  return SEARCH_URL + encodeURIComponent(text);
}
