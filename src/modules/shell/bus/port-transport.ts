import type { Envelope } from '@hsos/contracts/bus';
import type { Peer, Transport } from './transport';

/** The two things a transport needs from a message port, whatever kind of port it is. */
export type PortEndpoint = {
  post(message: unknown): void;
  listen(listener: (message: unknown) => void): void;
};

/** A `Transport` over one port whose far end is `peer`. Anything that is not an envelope is ignored. */
export function createPortTransport(endpoint: PortEndpoint, peer: Peer): Transport {
  return {
    send: (envelope) => endpoint.post(envelope),
    onMessage: (listener) =>
      endpoint.listen((message) => {
        if (isEnvelope(message)) listener(message, peer);
      }),
  };
}

/** A browser `MessagePort`, as the renderer holds it. */
export function domPortEndpoint(port: MessagePort): PortEndpoint {
  return {
    post: (message) => port.postMessage(message),
    listen(listener) {
      port.addEventListener('message', (event: MessageEvent<unknown>) => listener(event.data));
      port.start();
    },
  };
}

/** Electron's `MessagePortMain`, as main and utility processes hold it. Typed by shape so no Electron import is needed. */
export type MainPortLike = {
  postMessage(message: unknown): void;
  on(event: 'message', listener: (event: { data: unknown }) => void): unknown;
  start(): void;
};

export function mainPortEndpoint(port: MainPortLike): PortEndpoint {
  return {
    post: (message) => port.postMessage(message),
    listen(listener) {
      port.on('message', (event) => listener(event.data));
      port.start();
    },
  };
}

/** Checks the outer shape of an envelope. Payloads are validated later by the channel schema (BUS-1). */
export function isEnvelope(value: unknown): value is Envelope {
  if (typeof value !== 'object' || value === null) return false;
  if (!('v' in value) || value.v !== 1 || !('kind' in value) || !('channel' in value)) return false;
  if (typeof value.channel !== 'string') return false;
  if (value.kind === 'evt') return true;
  return (value.kind === 'req' || value.kind === 'res') && 'id' in value && typeof value.id === 'string';
}
