/**
 * The typed message bus. See spec/02-architecture.md §2.
 *
 * A channel is declared once with `request(...)` or `event(...)` in
 * contracts/channels/<module>.ts. Callers and handlers both import that
 * declaration, so the name and the payload types cannot drift apart.
 */
import type { z } from 'zod';
import type { Result } from './result';
import type { ServiceId } from './ids';

export const BUS_VERSION = 1;
export const DEFAULT_TIMEOUT_MS = 10_000;

export type RequestChannel<Req, Res> = {
  readonly kind: 'request';
  /** `module.verb`, for example `terminal.create`. */
  readonly name: string;
  /** The process that handles this channel. */
  readonly owner: ServiceId;
  readonly request: z.ZodType<Req>;
  readonly response: z.ZodType<Res>;
  readonly timeoutMs: number;
};

export type EventChannel<Payload> = {
  readonly kind: 'event';
  readonly name: string;
  readonly owner: ServiceId;
  readonly payload: z.ZodType<Payload>;
};

export function request<Req, Res>(
  name: string,
  owner: ServiceId,
  requestSchema: z.ZodType<Req>,
  responseSchema: z.ZodType<Res>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): RequestChannel<Req, Res> {
  return { kind: 'request', name, owner, request: requestSchema, response: responseSchema, timeoutMs };
}

export function event<Payload>(
  name: string,
  owner: ServiceId,
  payloadSchema: z.ZodType<Payload>,
): EventChannel<Payload> {
  return { kind: 'event', name, owner, payload: payloadSchema };
}

/** What crosses the wire. `payload` is validated by the receiver (BUS-1). */
export type Envelope =
  | { readonly v: 1; readonly kind: 'req'; readonly id: string; readonly channel: string; readonly payload: unknown }
  | { readonly v: 1; readonly kind: 'res'; readonly id: string; readonly channel: string; readonly payload: Result<unknown> }
  | { readonly v: 1; readonly kind: 'evt'; readonly channel: string; readonly payload: unknown };

export type Unsubscribe = () => void;

/**
 * Facts about a request that the receiving side sets from the port it arrived on,
 * never from the payload (BUS-7). Handlers use it to refuse callers (SHELL-26, FILE-27).
 */
export type CallMeta = {
  readonly from: ServiceId | 'ui';
};

/** The bus as seen by any module, in any process. */
export type Bus = {
  /** Sends a request. Never rejects: failures arrive as `{ ok: false }` (BUS-2, BUS-3, BUS-4). */
  call<Req, Res>(channel: RequestChannel<Req, Res>, payload: Req): Promise<Result<Res>>;

  /** Registers the handler for a request channel. Only the owner process may call this. */
  handle<Req, Res>(
    channel: RequestChannel<Req, Res>,
    handler: (payload: Req, meta: CallMeta) => Promise<Result<Res>> | Result<Res>,
  ): void;

  /** Publishes an event to every subscriber. Only the owner process may call this. */
  emit<Payload>(channel: EventChannel<Payload>, payload: Payload): void;

  /** Subscribes to an event. Returns a function that removes the subscription. */
  on<Payload>(channel: EventChannel<Payload>, listener: (payload: Payload) => void): Unsubscribe;
};
