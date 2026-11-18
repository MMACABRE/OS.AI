import type { Bus, Envelope } from '@hsos/contracts/bus';
import type { ServiceId } from '@hsos/contracts/ids';
import type { Clock, Logger } from '@hsos/contracts/module';
import { createBus } from '../modules/shell/bus/create-bus';
import type { BusClient } from '../modules/shell/bus/create-bus';
import { domPortEndpoint, isEnvelope } from '../modules/shell/bus/port-transport';
import type { Peer, Transport } from '../modules/shell/bus/transport';

/** `window.hsos.bus` as the preload exposes it (spec/modules/shell.md, "Preload API"). */
export type PreloadBus = {
  send(envelope: Envelope): void;
  onMessage(listener: (envelope: Envelope) => void): void;
  /** Notice that a new port for `service` was posted to this window (the port arrives as a window message). */
  onServicePort(listener: (service: ServiceId) => void): void;
};

const SERVICES: readonly ServiceId[] = ['pty-host', 'workspace-service', 'link-service'];

/** The service named by a port hand-off from the preload, or null for any other message. */
function servicePortMessage(event: MessageEvent<unknown>): ServiceId | null {
  if (event.source !== window) return null;
  const data = event.data;
  if (typeof data !== 'object' || data === null || !('type' in data) || data.type !== 'hsos-service-port')
    return null;
  const service = 'service' in data ? data.service : null;
  return SERVICES.find((name) => name === service) ?? null;
}

/** A transport whose port can be swapped when its service restarts (SHELL-11). */
function swappablePortTransport(peer: Peer): Transport & { swap(port: MessagePort): void } {
  const listeners: ((envelope: Envelope, from: Peer) => void)[] = [];
  let current: MessagePort | null = null;
  return {
    send: (envelope) => current?.postMessage(envelope),
    onMessage: (listener) => void listeners.push(listener),
    swap(port) {
      current?.close();
      current = port;
      domPortEndpoint(port).listen((message) => {
        if (!isEnvelope(message)) return;
        for (const listener of listeners) listener(message, peer);
      });
    },
  };
}

/**
 * The renderer's bus: main over IPC, each service over its own port, chosen by the channel's owner.
 * A new port for a service replaces the old one, and calls pending on the old one end with SERVICE_DOWN. Card 010.
 */
export function createRendererBus(preload: PreloadBus, clock: Clock, log: Logger): Bus {
  const ipc: Transport = {
    send: (envelope) => preload.send(envelope),
    onMessage: (listener) =>
      preload.onMessage((envelope) => isEnvelope(envelope) && listener(envelope, 'main')),
  };
  const buses = new Map<ServiceId, BusClient>([
    ['main', createBus({ process: 'ui', transport: ipc, clock, log })],
  ]);
  const ports = new Map<ServiceId, ReturnType<typeof swappablePortTransport>>();
  for (const service of SERVICES) {
    const transport = swappablePortTransport(service);
    ports.set(service, transport);
    buses.set(service, createBus({ process: 'ui', transport, clock, log }));
  }
  window.addEventListener('message', (event: MessageEvent<unknown>) => {
    const service = servicePortMessage(event);
    const port = event.ports[0];
    if (service === null || port === undefined) return;
    buses.get(service)?.failPending(service);
    ports.get(service)?.swap(port);
  });
  const busFor = (owner: ServiceId): BusClient =>
    buses.get(owner) ?? buses.get('main') ?? createBus({ process: 'ui', transport: ipc, clock, log });
  return {
    call: (channel, payload) => busFor(channel.owner).call(channel, payload),
    handle: (channel, handler) => busFor(channel.owner).handle(channel, handler),
    emit: (channel, payload) => busFor(channel.owner).emit(channel, payload),
    on: (channel, listener) => busFor(channel.owner).on(channel, listener),
  };
}
