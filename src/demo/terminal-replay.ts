import { terminalChannels } from '@hsos/contracts/channels/terminal';
import type { Unsubscribe } from '@hsos/contracts/bus';
import type { DemoEmitter } from './demo-transport';

/** One recorded chunk: wait `delayMs`, then write `bytes`. */
export type ReplayChunk = { readonly delayMs: number; readonly bytes: Uint8Array };

/** A pause after the end before the recording starts again. */
const LOOP_PAUSE_MS = 6_000;

/**
 * Reads `terminal-claude.bin`: repeated records of [delay ms: uint32 LE][length: uint32 LE][bytes].
 * A truncated record ends the list.
 */
export function parseReplay(data: Uint8Array): ReplayChunk[] {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const chunks: ReplayChunk[] = [];
  let offset = 0;
  while (offset + 8 <= data.byteLength) {
    const delayMs = view.getUint32(offset, true);
    const length = view.getUint32(offset + 4, true);
    if (offset + 8 + length > data.byteLength) break;
    chunks.push({ delayMs, bytes: data.slice(offset + 8, offset + 8 + length) });
    offset += 8 + length;
  }
  return chunks;
}

/** Bytes of a `data:` URL with base64 content, as Vite's `?inline` import gives it. */
export function bytesFromDataUrl(url: string): Uint8Array {
  const base64 = url.slice(url.indexOf(',') + 1);
  const text = atob(base64);
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) bytes[index] = text.charCodeAt(index);
  return bytes;
}

/**
 * Plays the recorded Claude session into demo terminals at its recorded speed, then loops (card 026).
 * Each terminal plays once attached. Typed keys are echoed and go nowhere.
 */
export function createTerminalReplay(chunks: readonly ReplayChunk[]) {
  const playing = new Map<string, Unsubscribe>();
  const seqs = new Map<string, number>();
  const encoder = new TextEncoder();

  const send = (demo: DemoEmitter, id: string, bytes: Uint8Array) => {
    const seq = (seqs.get(id) ?? 0) + 1;
    seqs.set(id, seq);
    demo.emit(terminalChannels.data.name, { id, seq, data: bytes });
  };

  const play = (demo: DemoEmitter, id: string, index: number) => {
    if (chunks.length === 0) return;
    const chunk = chunks[index % chunks.length];
    if (chunk === undefined) return;
    const atEnd = index > 0 && index % chunks.length === 0;
    const wait = chunk.delayMs + (atEnd ? LOOP_PAUSE_MS : 0);
    playing.set(
      id,
      demo.clock.after(wait, () => {
        if (atEnd) send(demo, id, encoder.encode('\u001b[2J\u001b[H'));
        send(demo, id, chunk.bytes);
        play(demo, id, index + 1);
      }),
    );
  };

  return {
    /** Starts (or keeps) the replay for a terminal; returns the sequence number reached so far. */
    attach(demo: DemoEmitter, id: string): number {
      if (!playing.has(id)) play(demo, id, 0);
      return seqs.get(id) ?? 0;
    },
    /** Echoes typed text; Enter becomes a new line. */
    write(demo: DemoEmitter, id: string, data: string): void {
      send(demo, id, encoder.encode(data.replace(/\r/g, '\r\n')));
    },
    stop(id: string): void {
      playing.get(id)?.();
      playing.delete(id);
    },
  };
}
