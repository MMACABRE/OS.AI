/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
import { EVENT_CHANNELS, REQUEST_CHANNELS } from '../../src/demo/all-channels';
import { buildFixtureTable } from '../../src/demo/demo-transport';
import type { DemoEmitter, RequestFixtureFn } from '../../src/demo/demo-transport';
import { ALL_FIXTURES } from '../../src/demo/fixtures';
import { mockFromSchema } from '../../src/demo/mock-from-schema';
import { createFakeClock } from '../fakes/fake-clock';

describe('Stage U fixtures', () => {
  it('STAGE-U every hand-written fixture parses with its channel schema (generateMissing off)', () => {
    const { problems } = buildFixtureTable(ALL_FIXTURES, false);
    expect(problems).toEqual([]);
  });

  it('STAGE-U with generateMissing on, every request channel has an entry and there are no problems', () => {
    const { table, problems } = buildFixtureTable(ALL_FIXTURES, true);
    expect(problems).toEqual([]);
    expect(REQUEST_CHANNELS.size).toBeGreaterThanOrEqual(155);
    for (const name of REQUEST_CHANNELS.keys()) expect(table.has(name), name).toBe(true);
  });

  it('STAGE-U every event fixture names a declared event channel', () => {
    for (const module of ALL_FIXTURES)
      for (const event of module.events ?? [])
        expect(EVENT_CHANNELS.has(event.channel), event.channel).toBe(true);
  });

  it('STAGE-U every function fixture, given a request built from the request schema, returns a valid response', () => {
    const demo: DemoEmitter = { emit: () => undefined, clock: createFakeClock() };
    let checked = 0;
    for (const module of ALL_FIXTURES)
      for (const [name, fixture] of Object.entries(module.requests ?? {})) {
        if (typeof fixture !== 'function') continue;
        const channel = REQUEST_CHANNELS.get(name);
        expect(channel, name).toBeDefined();
        if (channel === undefined) continue;
        const payload = channel.request.parse(mockFromSchema(channel.request, name.split('.')[1] ?? name));
        const value = (fixture as RequestFixtureFn)(payload as never, demo);
        const parsed = channel.response.safeParse(value);
        expect(
          parsed.success,
          `${name}: ${parsed.success ? '' : (parsed.error.issues[0]?.message ?? '')}`,
        ).toBe(true);
        checked += 1;
      }
    expect(checked).toBeGreaterThan(0);
  });
});
