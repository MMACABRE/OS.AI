import type { Envelope } from '@hsos/contracts/bus';
import type { ServiceId } from '@hsos/contracts/ids';

export type Peer = ServiceId | 'ui';

/** One side of a link between two processes. `from` names the peer that sent the envelope (BUS-7). */
export type Transport = {
  send(envelope: Envelope): void;
  onMessage(listener: (envelope: Envelope, from: Peer) => void): void;
};

/** Two transports joined in memory, for tests. Delivery is asynchronous, like a real port. */
export function createLoopbackTransport(sideA: Peer, sideB: Peer): readonly [Transport, Transport] {
  const listenersA: ((envelope: Envelope, from: Peer) => void)[] = [];
  const listenersB: ((envelope: Envelope, from: Peer) => void)[] = [];
  const deliver = (listeners: typeof listenersA, envelope: Envelope, from: Peer) =>
    queueMicrotask(() => {
      for (const listener of listeners) listener(structuredClone(envelope), from);
    });
  const a: Transport = {
    send: (envelope) => deliver(listenersB, envelope, sideA),
    onMessage: (listener) => void listenersA.push(listener),
  };
  const b: Transport = {
    send: (envelope) => deliver(listenersA, envelope, sideB),
    onMessage: (listener) => void listenersB.push(listener),
  };
  return [a, b];
}
