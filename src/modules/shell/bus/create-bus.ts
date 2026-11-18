import type { Bus, CallMeta, Envelope, EventChannel, RequestChannel } from '@hsos/contracts/bus';
import type { ServiceId } from '@hsos/contracts/ids';
import type { Clock, Logger } from '@hsos/contracts/module';
import { err } from '@hsos/contracts/result';
import type { Result } from '@hsos/contracts/result';
import type { Peer, Transport } from './transport';

export type BusOptions = {
  readonly process: Peer;
  readonly transport: Transport;
  readonly clock: Clock;
  readonly log: Logger;
  /** Which channel owners this process may handle. Defaults to its own name only (SHELL-18). */
  readonly owns?: (owner: ServiceId) => boolean;
};

/** A `Bus` plus the hook the supervisor uses when a process dies (BUS-4). */
export type BusClient = Bus & {
  failPending(owner: ServiceId): void;
};

type Handler = (payload: unknown, meta: CallMeta) => Promise<Result<unknown>> | Result<unknown>;
type Registered = { channel: RequestChannel<unknown, unknown>; handler: Handler };
type Pending = { owner: ServiceId; resolve: (result: Result<unknown>) => void; cancel: () => void };
type Subscribers = { channel: EventChannel<unknown>; listeners: Set<(payload: unknown) => void> };
type State = {
  readonly options: BusOptions;
  readonly owns: (owner: ServiceId) => boolean;
  readonly handlers: Map<string, Registered>;
  readonly pending: Map<string, Pending>;
  readonly subscribers: Map<string, Subscribers>;
  nextId: number;
};

const INTERNAL_MESSAGE = 'Something went wrong inside HSOS.';

/** The bus used in every process: validation, timeouts, routing by owner. SHELL-16 to SHELL-19, BUS-1 to BUS-7. */
export function createBus(options: BusOptions): BusClient {
  const state: State = {
    options,
    owns: options.owns ?? ((owner: ServiceId) => owner === options.process),
    handlers: new Map(),
    pending: new Map(),
    subscribers: new Map(),
    nextId: 0,
  };
  options.transport.onMessage((envelope, from) => receive(state, envelope, from));
  return {
    call: (channel, payload) =>
      narrow(
        channel,
        state.owns(channel.owner)
          ? runHandler(state, channel.name, payload, { from: options.process })
          : callRemote(state, channel, payload),
      ),
    handle: (channel, handler) => registerHandler(state, channel, handler),
    emit: (channel, payload) => emitEvent(state, channel, payload),
    on: (channel, listener) => subscribe(state, channel, listener),
    failPending: (owner) => failPending(state, owner),
  };
}

/** Handles one envelope from the transport; `from` comes from the transport, never the payload (BUS-7). */
function receive(state: State, envelope: Envelope, from: Peer): void {
  if (envelope.kind === 'req') {
    void runHandler(state, envelope.channel, envelope.payload, { from }).then((result) =>
      state.options.transport.send({
        v: 1,
        kind: 'res',
        id: envelope.id,
        channel: envelope.channel,
        payload: result,
      }),
    );
    return;
  }
  if (envelope.kind === 'res') return settle(state, envelope.id, envelope.payload);
  deliverEvent(state, envelope.channel, envelope.payload);
}

/** Validates the request, runs the handler, and turns a throw or a bad response into INTERNAL. BUS-1, BUS-2. */
async function runHandler(
  state: State,
  name: string,
  payload: unknown,
  meta: CallMeta,
): Promise<Result<unknown>> {
  const registered = state.handlers.get(name);
  if (registered === undefined) return err('NOT_FOUND', `No handler for ${name}.`);
  const parsed = registered.channel.request.safeParse(payload);
  if (!parsed.success) {
    state.options.log.log('warn', 'bus.invalidRequest', { channel: name });
    return err('BAD_REQUEST', 'The request was not valid.');
  }
  try {
    const result = await registered.handler(parsed.data, meta);
    if (result.ok && !registered.channel.response.safeParse(result.value).success) {
      state.options.log.log('error', 'bus.invalidResponse', { channel: name });
      return err('INTERNAL', INTERNAL_MESSAGE);
    }
    return result;
  } catch (error) {
    state.options.log.log('error', 'bus.handlerThrew', { channel: name, error: String(error) });
    return err('INTERNAL', INTERNAL_MESSAGE);
  }
}

/** Sends a request over the transport and waits for its answer or its timeout. BUS-3. */
function callRemote<Req, Res>(
  state: State,
  channel: RequestChannel<Req, Res>,
  payload: Req,
): Promise<Result<unknown>> {
  return new Promise((resolve) => {
    const id = `${state.options.process}-${state.nextId++}`;
    const cancel = state.options.clock.after(channel.timeoutMs, () => {
      state.pending.delete(id);
      resolve(err('TIMEOUT', 'HSOS did not answer in time.'));
    });
    state.pending.set(id, { owner: channel.owner, resolve, cancel });
    state.options.transport.send({ v: 1, kind: 'req', id, channel: channel.name, payload });
  });
}

function settle(state: State, id: string, payload: unknown): void {
  const entry = state.pending.get(id);
  if (entry === undefined) return;
  state.pending.delete(id);
  entry.cancel();
  entry.resolve(isResult(payload) ? payload : err('INTERNAL', INTERNAL_MESSAGE));
}

/** Resolves every pending request to `owner` with SERVICE_DOWN. BUS-4. */
function failPending(state: State, owner: ServiceId): void {
  for (const [id, entry] of state.pending) {
    if (entry.owner !== owner) continue;
    state.pending.delete(id);
    entry.cancel();
    entry.resolve(err('SERVICE_DOWN', 'This part of HSOS stopped. It is restarting.'));
  }
}

/** SHELL-18, SHELL-19. */
function registerHandler<Req, Res>(
  state: State,
  channel: RequestChannel<Req, Res>,
  handler: (payload: Req, meta: CallMeta) => Promise<Result<Res>> | Result<Res>,
): void {
  if (!state.owns(channel.owner)) {
    throw new Error(`${state.options.process} may not handle ${channel.name}, owned by ${channel.owner}.`);
  }
  if (state.handlers.has(channel.name)) throw new Error(`A handler for ${channel.name} already exists.`);
  state.handlers.set(channel.name, {
    channel: widen(channel),
    handler: (payload, meta) => handler(channel.request.parse(payload), meta),
  });
}

function emitEvent<Payload>(state: State, channel: EventChannel<Payload>, payload: Payload): void {
  if (!state.owns(channel.owner)) throw new Error(`${state.options.process} may not emit ${channel.name}.`);
  deliverEvent(state, channel.name, payload);
  state.options.transport.send({ v: 1, kind: 'evt', channel: channel.name, payload });
}

/** Events reach only current subscribers, after validation by the subscriber's schema. BUS-1, BUS-5. */
function deliverEvent(state: State, name: string, payload: unknown): void {
  const entry = state.subscribers.get(name);
  if (entry === undefined) return;
  const parsed = entry.channel.payload.safeParse(payload);
  if (!parsed.success) return state.options.log.log('warn', 'bus.invalidEvent', { channel: name });
  for (const listener of entry.listeners) listener(parsed.data);
}

function subscribe<Payload>(
  state: State,
  channel: EventChannel<Payload>,
  listener: (payload: Payload) => void,
): () => void {
  const entry = state.subscribers.get(channel.name) ?? { channel: widenEvent(channel), listeners: new Set() };
  state.subscribers.set(channel.name, entry);
  const wrapped = (payload: unknown) => listener(channel.payload.parse(payload));
  entry.listeners.add(wrapped);
  return () => void entry.listeners.delete(wrapped);
}

function isResult(value: unknown): value is Result<unknown> {
  return typeof value === 'object' && value !== null && 'ok' in value && typeof value.ok === 'boolean';
}

function widen<Req, Res>(channel: RequestChannel<Req, Res>): RequestChannel<unknown, unknown> {
  return channel;
}

function widenEvent<Payload>(channel: EventChannel<Payload>): EventChannel<unknown> {
  return channel;
}

/** Brings an untyped result back to the channel's type through its response schema, never a cast. */
async function narrow<Req, Res>(
  channel: RequestChannel<Req, Res>,
  result: Promise<Result<unknown>>,
): Promise<Result<Res>> {
  const settled = await result;
  if (!settled.ok) return settled;
  const parsed = channel.response.safeParse(settled.value);
  return parsed.success ? { ok: true, value: parsed.data } : err('INTERNAL', INTERNAL_MESSAGE);
}
