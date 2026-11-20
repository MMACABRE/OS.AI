import { describe, expect, it } from 'vitest';
import { normalizeAddress, SEARCH_URL } from '../../src/modules/browser/panel/address';

describe('browser address (card 034)', () => {
  it('BROW-4 "example.com" becomes https://example.com', () => {
    expect(normalizeAddress('example.com')).toBe('https://example.com');
  });

  it('BROW-4 "localhost:3000" becomes http://localhost:3000', () => {
    expect(normalizeAddress('localhost:3000')).toBe('http://localhost:3000');
  });

  it('BROW-4 "how to center a div" becomes a DuckDuckGo search', () => {
    expect(normalizeAddress('how to center a div')).toBe(SEARCH_URL + 'how%20to%20center%20a%20div');
    expect(normalizeAddress('how to center a div')).toBe(
      'https://duckduckgo.com/?q=how%20to%20center%20a%20div',
    );
  });
});
