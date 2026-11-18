import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { event, request } from '@hsos/contracts/bus';
import type { CallMeta } from '@hsos/contracts/bus';
import { err, ok } from '@hsos/contracts/result';
import { createBus } from '../../src/modules/shell/bus/create-bus';
import { createLoopbackTransport } from '../../src/modules/shell/bus/transport';
import { createFakeClock } from '../fakes/fake-clock';
import { createFakeBus } from '../fakes/fake-bus';

const silent = { log: () => undefined };

const echo = request(
  'test.echo',
  'main',
  z.object({ text: z.string() }),
  z.object({ text: z.string() }),
  1_000,
);
const ptyOwned = request('test.pty', 'pty-host', z.object({}), z.object({}));
const ticked = event('test.ticked', 'main', z.object({ count: z.number() }));

/** A `main` bus and a `ui` bus joined by a loopback transport. */
function twoBuses() {
  const clock = createFakeClock();
  const [mainSide, uiSide] = createLoopbackTransport('main', 'ui');
  const main = createBus({ process: 'main', transport: mainSide, clock, log: silent });
  const ui = createBus({ process: 'ui', transport: uiSide, clock, log: silent });
  return { clock, main, ui };
}

describe('bus', () => {
  it('BUS-7: meta.from is the process name in-process and ui over the transport', async () => {
    const { main, ui } = twoBuses();
    const seen: CallMeta[] = [];
    main.handle(echo, (payload, meta) => {
      seen.push(meta);
      return ok(payload);
    });

    await main.call(echo, { text: 'a' });
    await ui.call(echo, { text: 'b' });

    expect(seen).toEqual([{ from: 'main' }, { from: 'ui' }]);
  });

  it('SHELL-16, BUS-1: a wrong payload never reaches the handler and returns BAD_REQUEST', async () => {
    const { main, ui } = twoBuses();
    let calls = 0;
    main.handle(echo, (payload) => {
      calls += 1;
      return ok(payload);
    });
    const loose = request('test.echo', 'main', z.unknown(), z.unknown());

    const result = await ui.call(loose, { text: 42 });

    expect(calls).toBe(0);
    expect(result.ok ? null : result.error.code).toBe('BAD_REQUEST');
  });

  it('SHELL-16, BUS-2: a handler that throws gives INTERNAL', async () => {
    const { main, ui } = twoBuses();
    main.handle(echo, () => {
      throw new Error('boom');
    });

    const result = await ui.call(echo, { text: 'x' });

    expect(result.ok ? null : result.error.code).toBe('INTERNAL');
  });

  it('SHELL-16, BUS-3: a handler that never answers times out', async () => {
    const { clock, main, ui } = twoBuses();
    main.handle(echo, () => new Promise(() => undefined));

    const pending = ui.call(echo, { text: 'x' });
    await Promise.resolve();
    clock.advance(1_000);
    const result = await pending;

    expect(result.ok ? null : result.error.code).toBe('TIMEOUT');
  });

  it('BUS-4: pending requests to a dead owner resolve with SERVICE_DOWN', async () => {
    const { main, ui } = twoBuses();
    main.handle(echo, () => new Promise(() => undefined));

    const pending = ui.call(echo, { text: 'x' });
    ui.failPending('main');

    const result = await pending;
    expect(result.ok ? null : result.error.code).toBe('SERVICE_DOWN');
  });

  it('SHELL-17: a call to a channel owned by the same process runs the handler directly', async () => {
    const { main } = twoBuses();
    main.handle(echo, (payload) => ok({ text: payload.text.toUpperCase() }));

    expect(await main.call(echo, { text: 'hi' })).toEqual(ok({ text: 'HI' }));
  });

  it('SHELL-17: the in-process path validates too', async () => {
    const { main } = twoBuses();
    main.handle(echo, () => err('NOT_FOUND', 'No.'));
    const loose = request('test.echo', 'main', z.unknown(), z.unknown());

    const result = await main.call(loose, 'not an object');

    expect(result.ok ? null : result.error.code).toBe('BAD_REQUEST');
  });

  it('SHELL-18: handle for a channel owned by another process throws', () => {
    const { main } = twoBuses();
    expect(() => main.handle(ptyOwned, () => ok({}))).toThrow();
  });

  it('SHELL-19: a second handler for the same channel throws', () => {
    const { main } = twoBuses();
    main.handle(echo, (payload) => ok(payload));
    expect(() => main.handle(echo, (payload) => ok(payload))).toThrow();
  });

  it('BUS-1: an event with a wrong payload is dropped; a valid one reaches every subscriber', async () => {
    const { main, ui } = twoBuses();
    const counts: number[] = [];
    ui.on(ticked, (payload) => counts.push(payload.count));
    const loose = event('test.ticked', 'main', z.unknown());

    main.emit(loose, { count: 'one' });
    main.emit(ticked, { count: 1 });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(counts).toEqual([1]);
  });

  it('BUS-5: an event is not queued for a subscriber that arrives later', async () => {
    const { main, ui } = twoBuses();
    main.emit(ticked, { count: 1 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const counts: number[] = [];
    ui.on(ticked, (payload) => counts.push(payload.count));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(counts).toEqual([]);
  });

  it('on returns a function that removes the subscription', () => {
    const { main } = twoBuses();
    const counts: number[] = [];
    const stop = main.on(ticked, (payload) => counts.push(payload.count));
    main.emit(ticked, { count: 1 });
    stop();
    main.emit(ticked, { count: 2 });

    expect(counts).toEqual([1]);
  });

  it('the fake bus takes handlers for any owner', async () => {
    const bus = createFakeBus();
    bus.handle(ptyOwned, () => ok({}));

    expect(await bus.call(ptyOwned, {})).toEqual(ok({}));
  });
});
