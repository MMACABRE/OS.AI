/**
 * REFERENCE CODE. Copy to src/modules/terminal/service/ring-buffer.ts unchanged.
 *
 * Keeps the most recent `capacity` bytes of terminal output for reattach (TERM-20).
 * `snapshot()` starts at a safe point so a replay never begins in the middle of
 * an escape sequence or a UTF-8 character (TERM-22).
 */
export class RingBuffer {
  private readonly buffer: Uint8Array;
  private start = 0;
  private length = 0;

  constructor(private readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error('RingBuffer capacity must be a positive integer');
    }
    this.buffer = new Uint8Array(capacity);
  }

  get size(): number {
    return this.length;
  }

  append(chunk: Uint8Array): void {
    if (chunk.length >= this.capacity) {
      this.buffer.set(chunk.subarray(chunk.length - this.capacity));
      this.start = 0;
      this.length = this.capacity;
      return;
    }

    const end = (this.start + this.length) % this.capacity;
    const firstPart = Math.min(chunk.length, this.capacity - end);
    this.buffer.set(chunk.subarray(0, firstPart), end);
    this.buffer.set(chunk.subarray(firstPart), 0);

    const overflow = this.length + chunk.length - this.capacity;
    if (overflow > 0) {
      this.start = (this.start + overflow) % this.capacity;
      this.length = this.capacity;
    } else {
      this.length += chunk.length;
    }
  }

  /** Returns the buffered bytes in order, trimmed to begin just after the first line feed
   *  when the buffer has wrapped, so replay starts on a clean line. */
  snapshot(): Uint8Array {
    const out = new Uint8Array(this.length);
    const firstPart = Math.min(this.length, this.capacity - this.start);
    out.set(this.buffer.subarray(this.start, this.start + firstPart), 0);
    out.set(this.buffer.subarray(0, this.length - firstPart), firstPart);

    if (this.length < this.capacity) return out;

    const LINE_FEED = 0x0a;
    const firstLineFeed = out.indexOf(LINE_FEED);
    if (firstLineFeed === -1) return out;
    return out.subarray(firstLineFeed + 1);
  }

  clear(): void {
    this.start = 0;
    this.length = 0;
  }
}

/** Self-check. Run with: npx tsx spec/reference/ring-buffer.ts */
function selfCheck(): void {
  const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
  const bytes = (value: string) => new TextEncoder().encode(value);
  const assertEqual = (actual: string, expected: string, label: string) => {
    if (actual !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  };

  const small = new RingBuffer(16);
  small.append(bytes('abc'));
  assertEqual(text(small.snapshot()), 'abc', 'not wrapped returns everything');

  small.append(bytes('def\nghijklmnop'));
  // 17 bytes written into 16: 'a' dropped; wrapped, so the snapshot starts after the first line feed.
  assertEqual(text(small.snapshot()), 'ghijklmnop', 'wrapped starts after first line feed');

  small.append(bytes('0123456789ABCDEFGHIJ'));
  assertEqual(text(small.snapshot()), '456789ABCDEFGHIJ', 'chunk larger than capacity keeps its tail');

  small.clear();
  assertEqual(text(small.snapshot()), '', 'clear empties');
}

if (typeof process !== 'undefined' && process.argv[1]?.endsWith('ring-buffer.ts')) {
  selfCheck();
  console.log('ring-buffer self-check passed');
}
