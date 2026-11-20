import type { Bus, EventChannel, RequestChannel } from '@hsos/contracts/bus';
import { err } from '@hsos/contracts/result';
import type { Result } from '@hsos/contracts/result';

type Answer = (payload: unknown) => Result<unknown> | Promise<Result<unknown>>;

export type RecordedCall = { readonly channel: string; readonly payload: unknown };

/** A Bus for component tests: `call` answers from a map by channel name, `on` records listeners. */
export type StubBus = Bus & {
  /** Sets (or replaces) the answer for one request channel. */
  answer<Req, Res>(
    channel: RequestChannel<Req, Res>,
    answer: (payload: Req) => Result<Res> | Promise<Result<Res>>,
  ): void;
  /** Every call made so far, in order. */
  readonly calls: RecordedCall[];
  /** The payloads of the calls to one channel, in order. */
  payloadsOf<Req, Res>(channel: RequestChannel<Req, Res>): Req[];
  /** How many listeners a channel has now. */
  listenerCount(channel: EventChannel<never> | EventChannel<unknown>): number;
};

/** A promise that never settles, for "pending" states. */
export const never = <T>(): Promise<T> => new Promise<T>(() => undefined);

export function createStubBus(): StubBus {
  const answers = new Map<string, Answer>();
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  const calls: RecordedCall[] = [];
  return {
    calls,
    answer(channel, answer) {
      answers.set(channel.name, (payload) => answer(payload as never));
    },
    payloadsOf(channel) {
      return calls.filter((call) => call.channel === channel.name).map((call) => call.payload as never);
    },
    listenerCount(channel) {
      return listeners.get(channel.name)?.size ?? 0;
    },
    call(channel, payload) {
      calls.push({ channel: channel.name, payload });
      const answer = answers.get(channel.name);
      if (answer === undefined) return Promise.resolve(err('INTERNAL', `No stub answer for ${channel.name}`));
      return Promise.resolve(answer(payload)).then((result) => result as never);
    },
    handle() {
      throw new Error('StubBus does not handle channels');
    },
    emit(channel, payload) {
      for (const listener of [...(listeners.get(channel.name) ?? [])]) listener(payload);
    },
    on(channel, listener) {
      const set = listeners.get(channel.name) ?? new Set();
      listeners.set(channel.name, set);
      const wrapped = (payload: unknown) => listener(payload as never);
      set.add(wrapped);
      return () => {
        set.delete(wrapped);
      };
    },
  };
}
