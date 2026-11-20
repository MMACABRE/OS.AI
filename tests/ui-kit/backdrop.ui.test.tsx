import { cleanup, isInaccessible, render } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Backdrop, sceneFor } from '@hsos/ui-kit';
import { readBackdropSettings, startBackdrop } from '../../src/modules/ui-kit/backdrop/backdrop-client';
import type { ToBackdropWorker } from '../../src/modules/ui-kit/backdrop/protocol';
import { addBackdropSource } from '../../src/modules/ui-kit/backdrop/sources';
import { COMPONENTS, ruleBody } from './css-composes';

const backdropCss = `${COMPONENTS}/../backdrop/Backdrop.module.css`;

/** Records what the renderer posts to the background worker. */
class FakeWorker {
  static instances: FakeWorker[] = [];
  readonly messages: ToBackdropWorker[] = [];
  terminated = false;
  constructor() {
    FakeWorker.instances.push(this);
  }
  postMessage(message: ToBackdropWorker): void {
    this.messages.push(message);
  }
  addEventListener(): void {}
  removeEventListener(): void {}
  terminate(): void {
    this.terminated = true;
  }
  ofType<T extends ToBackdropWorker['type']>(type: T) {
    return this.messages.filter(
      (message): message is Extract<ToBackdropWorker, { type: T }> => message.type === type,
    );
  }
}

const proto = HTMLCanvasElement.prototype as unknown as { transferControlToOffscreen?: () => object };
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

beforeEach(() => {
  FakeWorker.instances = [];
  proto.transferControlToOffscreen = () => ({});
  vi.stubGlobal('Worker', FakeWorker);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(proto, 'transferControlToOffscreen');
  document.documentElement.removeAttribute('style');
});

const lastWorker = (): FakeWorker => {
  const worker = FakeWorker.instances.at(-1);
  if (worker === undefined) throw new Error('no worker was created');
  return worker;
};

describe('UI-30 one canvas, unknown scenes draw still', () => {
  it('UI-30 backdrop.scene unknown gives the still scene, and Backdrop mounts one canvas under [data-hsos-backdrop]', () => {
    document.documentElement.style.setProperty('--backdrop-scene', 'unknown');
    expect(sceneFor('unknown').name).toBe('still');
    expect(sceneFor(readBackdropSettings(document.documentElement, 1000).scene).name).toBe('still');
    const { container } = render(<Backdrop />);
    expect(container.querySelectorAll('[data-hsos-backdrop] canvas')).toHaveLength(1);
    expect(container.querySelectorAll('canvas')).toHaveLength(1);
  });

  it('UI-30 a known scene name is kept', () => {
    expect(sceneFor('phosphor-dust').name).toBe('phosphor-dust');
    expect(sceneFor('still').name).toBe('still');
  });
});

describe('UI-33 the backdrop takes no input and is not read', () => {
  it('UI-33 the backdrop and the CRT overlay are aria-hidden and inaccessible to the accessibility tree', () => {
    const { container } = render(<Backdrop />);
    const parts = container.querySelectorAll('[data-hsos-backdrop], [data-hsos-crt]');
    expect(parts).toHaveLength(2);
    for (const part of parts) {
      expect(part.getAttribute('aria-hidden')).toBe('true');
      expect(isInaccessible(part)).toBe(true);
    }
    expect(isInaccessible(container.querySelector('canvas') as HTMLElement)).toBe(true);
  });

  it('UI-33 three pointer moves in one frame and a click on empty space send one pointer and one puff', async () => {
    render(<Backdrop />);
    const worker = lastWorker();
    for (const x of [100, 200, 300])
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: x, clientY: 50 }));
    window.dispatchEvent(new MouseEvent('click', { clientX: 300, clientY: 50, bubbles: true }));
    await act(async () => {
      await nextFrame();
    });
    expect(worker.ofType('pointer')).toHaveLength(1);
    expect(worker.ofType('puff')).toHaveLength(1);
    expect(worker.ofType('pointer')[0]?.x).toBeCloseTo(300 / window.innerWidth);
  });

  it('UI-33 a click on a button sends no puff', async () => {
    render(<Backdrop />);
    const worker = lastWorker();
    const button = document.createElement('button');
    document.body.append(button);
    button.dispatchEvent(new MouseEvent('click', { clientX: 20, clientY: 20, bubbles: true }));
    await act(async () => {
      await nextFrame();
    });
    button.remove();
    expect(worker.ofType('puff')).toHaveLength(0);
  });

  it('UI-33 a click after a 10 px drag sends no puff', async () => {
    render(<Backdrop />);
    const worker = lastWorker();
    window.dispatchEvent(new MouseEvent('pointerdown', { clientX: 10, clientY: 10, bubbles: true }));
    window.dispatchEvent(new MouseEvent('click', { clientX: 20, clientY: 10, bubbles: true }));
    await act(async () => {
      await nextFrame();
    });
    expect(worker.ofType('puff')).toHaveLength(0);
  });

  it('UI-33 no event listener is put on the backdrop canvas, and the backdrop rule has pointer-events none', () => {
    const added = vi.spyOn(EventTarget.prototype, 'addEventListener');
    const { container } = render(<Backdrop />);
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    const onCanvas = added.mock.contexts.filter((context) => context === canvas);
    added.mockRestore();
    expect(onCanvas).toHaveLength(0);
    expect(ruleBody(backdropCss, '.backdrop')).toMatch(/pointer-events:\s*none/);
  });
});

describe('UI-34 the old-monitor overlay is still', () => {
  it('UI-34 [data-hsos-crt] has pointer-events none and no animation, and no element has a filter with url(', () => {
    const { container } = render(<Backdrop />);
    const crt = container.querySelector('[data-hsos-crt]');
    expect(crt).not.toBeNull();
    // jsdom computes no CSS-module rule, so the stylesheet source is read for the overlay's rules.
    expect(ruleBody(backdropCss, '.crt')).toMatch(/pointer-events:\s*none/);
    for (const selector of ['.crt', '.scanlines', '.vignette', '.backdrop', '.canvas']) {
      expect(ruleBody(backdropCss, selector), selector).not.toMatch(/animation|transition/);
    }
    for (const element of document.querySelectorAll('*')) {
      expect((element as HTMLElement).style.filter ?? '').not.toContain('url(');
      expect((element as HTMLElement).style.backdropFilter ?? '').not.toContain('url(');
    }
  });
});

describe('UI-35 steam sources', () => {
  it('UI-35 two sources, one inside a display:none parent: at most 10 sources messages in 1000 ms, each with only the visible one', () => {
    vi.useFakeTimers();
    // jsdom has no layout: an element has a box unless it, or an ancestor, is display:none.
    const hiddenByAncestor = (element: Element): boolean => {
      for (let node: Element | null = element; node !== null; node = node.parentElement)
        if (getComputedStyle(node).display === 'none') return true;
      return false;
    };
    const rects = vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(function (
      this: HTMLElement,
    ) {
      return (hiddenByAncestor(this) ? [] : [new DOMRect(100, 100, 50, 50)]) as unknown as DOMRectList;
    });
    const boxes = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(() => new DOMRect(100, 100, 50, 50));

    const visible = document.createElement('div');
    const parent = document.createElement('div');
    parent.style.display = 'none';
    const hidden = document.createElement('div');
    parent.append(hidden);
    document.body.append(visible, parent);
    const removeVisible = addBackdropSource(visible, 'color.live', 1);
    const removeHidden = addBackdropSource(hidden, 'color.brand', 1);

    const canvas = document.createElement('canvas');
    const handle = startBackdrop(canvas, { createWorker: () => new FakeWorker() as unknown as Worker });
    vi.advanceTimersByTime(1000);
    handle.stop();
    removeVisible();
    removeHidden();
    visible.remove();
    parent.remove();
    rects.mockRestore();
    boxes.mockRestore();

    const worker = lastWorker();
    const messages = worker.ofType('sources');
    expect(messages.length).toBeGreaterThan(0);
    expect(messages.length).toBeLessThanOrEqual(10);
    for (const message of messages) {
      expect(message.sources).toHaveLength(1);
      expect(message.sources[0]?.x).toBeCloseTo(125 / window.innerWidth);
    }
    expect(worker.terminated).toBe(true);
  });

  it('UI-35 with no sources nothing is posted', () => {
    vi.useFakeTimers();
    const handle = startBackdrop(document.createElement('canvas'), {
      createWorker: () => new FakeWorker() as unknown as Worker,
    });
    vi.advanceTimersByTime(1000);
    handle.stop();
    expect(lastWorker().ofType('sources')).toHaveLength(0);
  });
});
