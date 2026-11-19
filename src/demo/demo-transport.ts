import type { Envelope } from '@hsos/contracts/bus';
import type { Clock, Logger } from '@hsos/contracts/module';
import { err, ok } from '@hsos/contracts/result';
import type { Peer, Transport } from '../modules/shell/bus/transport';
import { EVENT_CHANNELS, REQUEST_CHANNELS } from './all-channels';
import { mockFromSchema } from './mock-from-schema';

/** The answer to one request: a value, or a function of the request payload. */
export type RequestFixture = unknown;
export type RequestFixtureFn = (payload: never, demo: DemoEmitter) => unknown;

/** An event the demo emits on a timer, or once after `afterMs`. */
export type EventFixture = {
  readonly channel: string;
  readonly payload: unknown | (() => unknown);
  readonly everyMs?: number;
  readonly afterMs?: number;
};

/** One module's fixtures (src/demo/fixtures/<module>.ts). */
export type ModuleFixtures = {
  readonly requests?: Readonly<Record<string, RequestFixture | RequestFixtureFn>>;
  readonly events?: readonly EventFixture[];
};

/** Lets a fixture function emit events, for example terminal output after a write. */
export type DemoEmitter = { emit(channel: string, payload: unknown): void; clock: Clock };

export type DemoTransportOptions = {
  readonly fixtures: readonly ModuleFixtures[];
  readonly clock: Clock;
  readonly log: Logger;
  /** 0 to 1; the answer delay is 80 to 400 ms (card 026). Injected so tests are deterministic. */
  readonly random?: () => number;
  /** Fill channels without a hand-written fixture from their schema. Default true; tests may turn it off. */
  readonly generateMissing?: boolean;
};

export type FixtureProblem = { readonly channel: string; readonly message: string };

const MIN_DELAY_MS = 80;
const MAX_DELAY_MS = 400;

function isFunction(value: unknown): value is (...args: never[]) => unknown {
  return typeof value === 'function';
}

/**
 * Merges the hand-written fixtures over generated ones and parses every static one with its channel's
 * response schema (Stage U rule). Returns the table and the problems; a problem is never silent.
 */
export function buildFixtureTable(
  fixtures: readonly ModuleFixtures[],
  generateMissing = true,
): { table: Map<string, RequestFixture | RequestFixtureFn>; problems: FixtureProblem[] } {
  const table = new Map<string, RequestFixture | RequestFixtureFn>();
  const problems: FixtureProblem[] = [];
  for (const module of fixtures)
    for (const [channel, fixture] of Object.entries(module.requests ?? {})) {
      const declared = REQUEST_CHANNELS.get(channel);
      if (declared === undefined) {
        problems.push({ channel, message: 'No such request channel in the contracts.' });
        continue;
      }
      if (!isFunction(fixture)) {
        const parsed = declared.response.safeParse(fixture);
        if (!parsed.success) {
          problems.push({
            channel,
            message: parsed.error.issues[0]?.message ?? 'Does not match the schema.',
          });
          continue;
        }
      }
      table.set(channel, fixture);
    }
  if (generateMissing)
    for (const [name, channel] of REQUEST_CHANNELS) {
      if (table.has(name)) continue;
      const value = mockFromSchema(channel.response, name.split('.')[1] ?? name);
      const parsed = channel.response.safeParse(value);
      if (parsed.success) table.set(name, parsed.data);
      else
        problems.push({
          channel: name,
          message: `Generated data does not fit: ${parsed.error.issues[0]?.message ?? ''}`,
        });
    }
  for (const module of fixtures)
    for (const event of module.events ?? []) {
      const declared = EVENT_CHANNELS.get(event.channel);
      if (declared === undefined)
        problems.push({ channel: event.channel, message: 'No such event channel in the contracts.' });
      else if (!isFunction(event.payload) && !declared.payload.safeParse(event.payload).success)
        problems.push({ channel: event.channel, message: 'Event payload does not match the schema.' });
    }
  return { table, problems };
}

/**
 * A `Transport` (card 009) that answers every request from fixtures after 80 to 400 ms, so loading states
 * show, and emits fixture events on timers. A request without a fixture answers `INTERNAL` "No demo data".
 * Card 026.
 */
export function createDemoTransport(
  options: DemoTransportOptions,
): Transport & { readonly problems: readonly FixtureProblem[] } {
  const random = options.random ?? Math.random;
  const listeners: ((envelope: Envelope, from: Peer) => void)[] = [];
  const { table, problems } = buildFixtureTable(options.fixtures, options.generateMissing ?? true);
  for (const problem of problems)
    options.log.log('error', 'demo.fixture_invalid', { channel: problem.channel, message: problem.message });

  const deliver = (envelope: Envelope) => {
    for (const listener of listeners) listener(envelope, 'main');
  };
  const emitter: DemoEmitter = {
    clock: options.clock,
    emit: (channel, payload) => deliver({ v: 1, kind: 'evt', channel, payload }),
  };

  const answer = (envelope: Extract<Envelope, { kind: 'req' }>) => {
    const fixture = table.get(envelope.channel);
    const channel = REQUEST_CHANNELS.get(envelope.channel);
    if (fixture === undefined || channel === undefined)
      return err('INTERNAL', `No demo data for ${envelope.channel}.`);
    try {
      const value = isFunction(fixture)
        ? (fixture as RequestFixtureFn)(envelope.payload as never, emitter)
        : fixture;
      const parsed = channel.response.safeParse(value);
      if (parsed.success) return ok(parsed.data);
      options.log.log('error', 'demo.fixture_invalid', {
        channel: envelope.channel,
        message: parsed.error.issues[0]?.message,
      });
      return err('INTERNAL', `Demo data for ${envelope.channel} does not match its schema.`);
    } catch (error) {
      return err('INTERNAL', `Demo data for ${envelope.channel} failed: ${String(error)}`);
    }
  };

  for (const module of options.fixtures)
    for (const event of module.events ?? []) {
      const fire = () =>
        emitter.emit(event.channel, isFunction(event.payload) ? event.payload() : event.payload);
      if (event.afterMs !== undefined) options.clock.after(event.afterMs, fire);
      if (event.everyMs !== undefined) options.clock.every(event.everyMs, fire);
    }

  return {
    problems,
    send(envelope) {
      if (envelope.kind !== 'req') return;
      const delay = MIN_DELAY_MS + Math.round(random() * (MAX_DELAY_MS - MIN_DELAY_MS));
      options.clock.after(delay, () =>
        deliver({ v: 1, kind: 'res', id: envelope.id, channel: envelope.channel, payload: answer(envelope) }),
      );
    },
    onMessage: (listener) => void listeners.push(listener),
  };
}
