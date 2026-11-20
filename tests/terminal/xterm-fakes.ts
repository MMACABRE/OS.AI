import { vi } from 'vitest';

/** A stand-in for xterm's Terminal: it keeps its options and what was written to it. */
export class FakeTerminal {
  static created: FakeTerminal[] = [];
  readonly options: Record<string, unknown>;
  cols = 80;
  rows = 24;
  readonly modes = { bracketedPasteMode: false };
  readonly writes: unknown[] = [];
  disposed = false;

  constructor(options: Record<string, unknown>) {
    this.options = { ...options };
    FakeTerminal.created.push(this);
  }

  /** The options the constructor received, before the panel changed any. */
  get fontSize(): number {
    return this.options.fontSize as number;
  }

  loadAddon(addon: unknown): void {
    (addon as { activate?: (terminal: FakeTerminal) => void }).activate?.(this);
  }
  open(): void {}
  write(data: unknown, callback?: () => void): void {
    this.writes.push(data);
    callback?.();
  }
  paste(): void {}
  focus(): void {}
  onData(): { dispose: () => void } {
    return { dispose: () => undefined };
  }
  dispose(): void {
    this.disposed = true;
  }
}

export class FakeFitAddon {
  activate(): void {}
  fit(): void {}
  dispose(): void {}
}

export class ThrowingWebglAddon {
  constructor() {
    throw new Error('WebGL is not available in this test');
  }
}

export const xtermModule = { Terminal: FakeTerminal };
export const fitModule = { FitAddon: FakeFitAddon };
export const webglModule = { WebglAddon: ThrowingWebglAddon };

/** jsdom has no ResizeObserver; this one lets a test fire every observer by hand. */
export class ManualResizeObserver {
  static all: ManualResizeObserver[] = [];
  constructor(private readonly callback: () => void) {
    ManualResizeObserver.all.push(this);
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {
    ManualResizeObserver.all = ManualResizeObserver.all.filter((observer) => observer !== this);
  }
  fire(): void {
    this.callback();
  }
  static fireAll(): void {
    for (const observer of [...ManualResizeObserver.all]) observer.fire();
  }
}

export const silentLog = { log: vi.fn() };
