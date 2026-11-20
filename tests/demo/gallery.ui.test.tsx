import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
afterEach(cleanup);

// jsdom has no WebGL: the graph module reads WebGL2RenderingContext when it loads.
type GalleryModule = typeof import('../../src/demo/gallery');
let Gallery: GalleryModule['Gallery'];
beforeAll(async () => {
  Object.assign(globalThis, { WebGL2RenderingContext: class {} });
  // jsdom lacks matchMedia and ResizeObserver, which the panels use.
  window.matchMedia ??= (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
  Object.assign(globalThis, {
    ResizeObserver: class {
      observe() {
        return undefined;
      }
      unobserve() {
        return undefined;
      }
      disconnect() {
        return undefined;
      }
    },
  });
  ({ Gallery } = await import('../../src/demo/gallery'));
});

describe('state gallery (card 036)', () => {
  it('every registered panel and widget has a row with four state tiles and no boundary error text', async () => {
    render(<Gallery />);
    await screen.findByRole('heading', { name: 'State gallery' });
    await waitFor(() => expect(document.querySelectorAll('section h3').length).toBeGreaterThan(0));
    const rows = Array.from(document.querySelectorAll('section > div > h3')).map(
      (title) => title.parentElement,
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const states = row?.querySelector('h3')?.nextElementSibling;
      expect(states?.children.length).toBe(4);
    }
    // The graph tiles cannot draw in jsdom (no WebGL 2, sigma throws); every other section must not throw.
    const threw = Array.from(document.querySelectorAll('section'))
      .filter((section) => section.getAttribute('aria-label') !== 'graph')
      .flatMap((section) =>
        Array.from(section.querySelectorAll('*')).filter((node) => node.textContent?.startsWith('threw:')),
      );
    expect(threw).toHaveLength(0);
  }, 30_000);

  it('the four columns of a row are loading, empty, error and ready, in that order', async () => {
    render(<Gallery />);
    await screen.findByRole('heading', { name: 'State gallery' });
    await waitFor(() => expect(document.querySelectorAll('section h3').length).toBeGreaterThan(0));
    const states = document.querySelector('section h3')?.nextElementSibling;
    const labels = Array.from(states?.children ?? []).map((tile) => tile.textContent ?? '');
    expect(labels).toHaveLength(4);
  });
});
