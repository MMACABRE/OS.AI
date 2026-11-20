/// <reference types="vite/client" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { Envelope } from '@hsos/contracts/bus';
import { settingsChannels } from '@hsos/contracts/channels/settings';
import { createDemoTransport } from '../../src/demo/demo-transport';
import type { ModuleFixtures } from '../../src/demo/demo-transport';
import { parseReplay } from '../../src/demo/terminal-replay';
import { createFakeClock } from '../fakes/fake-clock';

const silent = { log: () => undefined };

/** Collects every envelope the transport delivers. */
function collect(transport: ReturnType<typeof createDemoTransport>): Envelope[] {
  const seen: Envelope[] = [];
  transport.onMessage((envelope) => seen.push(envelope));
  return seen;
}

const request = (channel: string): Envelope => ({ v: 1, kind: 'req', id: 'r1', channel, payload: {} });

describe('demo transport', () => {
  it('STAGE-U a request for a declared channel with no fixture answers INTERNAL "No demo data"', () => {
    const clock = createFakeClock();
    const transport = createDemoTransport({
      fixtures: [],
      clock,
      log: silent,
      generateMissing: false,
      random: () => 0,
    });
    const seen = collect(transport);
    transport.send(request(settingsChannels.getProblems.name));
    clock.advance(400);
    expect(seen).toHaveLength(1);
    const reply = seen[0];
    expect(reply?.kind).toBe('res');
    const payload = (reply as Extract<Envelope, { kind: 'res' }>).payload as {
      ok: boolean;
      error: { code: string; message: string };
    };
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe('INTERNAL');
    expect(payload.error.message).toContain('No demo data');
  });

  it('STAGE-U a request is answered after 80 ms with random 0, and not before', () => {
    const clock = createFakeClock();
    const fixtures: ModuleFixtures = { requests: { [settingsChannels.getProblems.name]: [] } };
    const transport = createDemoTransport({ fixtures: [fixtures], clock, log: silent, random: () => 0 });
    const seen = collect(transport);
    transport.send(request(settingsChannels.getProblems.name));
    clock.advance(79);
    expect(seen).toHaveLength(0);
    clock.advance(1);
    expect(seen).toHaveLength(1);
    expect((seen[0] as Extract<Envelope, { kind: 'res' }>).payload).toEqual({ ok: true, value: [] });
  });

  it('STAGE-U a request is answered after 400 ms with random 1, and not before', () => {
    const clock = createFakeClock();
    const fixtures: ModuleFixtures = { requests: { [settingsChannels.getProblems.name]: [] } };
    const transport = createDemoTransport({ fixtures: [fixtures], clock, log: silent, random: () => 1 });
    const seen = collect(transport);
    transport.send(request(settingsChannels.getProblems.name));
    clock.advance(399);
    expect(seen).toHaveLength(0);
    clock.advance(1);
    expect(seen).toHaveLength(1);
  });

  it('STAGE-U an event fixture with everyMs fires on the clock', () => {
    const clock = createFakeClock();
    const fixtures: ModuleFixtures = {
      events: [{ channel: settingsChannels.problemsChanged.name, payload: [], everyMs: 1000 }],
    };
    const transport = createDemoTransport({ fixtures: [fixtures], clock, log: silent, random: () => 0 });
    const seen = collect(transport);
    clock.advance(999);
    expect(seen).toHaveLength(0);
    clock.advance(1);
    expect(seen).toHaveLength(1);
    clock.advance(2000);
    expect(seen).toHaveLength(3);
    expect(seen[0]).toEqual({
      v: 1,
      kind: 'evt',
      channel: settingsChannels.problemsChanged.name,
      payload: [],
    });
    expect(z.array(z.unknown()).parse((seen[0] as Extract<Envelope, { kind: 'evt' }>).payload)).toEqual([]);
  });
});

describe('terminal replay recording', () => {
  const bin = new Uint8Array(
    readFileSync(resolve(import.meta.dirname, '../../src/demo/fixtures/terminal-claude.bin')),
  );

  it('STAGE-U parseReplay reads the records of terminal-claude.bin', () => {
    const chunks = parseReplay(bin);
    expect(chunks.length).toBeGreaterThan(0);
    const bytes = chunks.reduce((sum, chunk) => sum + chunk.bytes.byteLength, 0);
    // Every record is 8 header bytes plus its payload, and the file holds nothing else.
    expect(bin.byteLength).toBe(bytes + chunks.length * 8);
  });

  it('STAGE-U parseReplay stops at a truncated record', () => {
    const all = parseReplay(bin);
    const cut = bin.slice(0, bin.byteLength - 1);
    expect(parseReplay(cut)).toHaveLength(all.length - 1);
    const headerOnly = new Uint8Array(8);
    new DataView(headerOnly.buffer).setUint32(4, 50, true);
    expect(parseReplay(headerOnly)).toEqual([]);
  });
});
