import type { Envelope } from '@hsos/contracts/bus';
import type { ServiceId } from '@hsos/contracts/ids';
import type { Logger } from '@hsos/contracts/module';
import { createBus } from '../../modules/shell/bus/create-bus';
import type { BusClient } from '../../modules/shell/bus/create-bus';
import { isEnvelope, mainPortEndpoint } from '../../modules/shell/bus/port-transport';
import type { MainPortLike } from '../../modules/shell/bus/port-transport';
import type { Peer, Transport } from '../../modules/shell/bus/transport';
import { systemClock } from '../../modules/shell/system-clock';

/** The parent port Electron gives a utility process, typed by shape. */
type ParentPort = {
  postMessage(message: unknown): void;
  on(event: 'message', listener: (event: { data: unknown; ports: readonly MainPortLike[] }) => void): unknown;
};

export type ServiceRuntime = {
  readonly bus: BusClient;
  readonly log: Logger;
  /** Tells main the service registered all its modules (SHELL-3). */
  ready(): void;
  /** Runs when main sends `{ type: 'stop' }`, before the process exits (SHELL-7). */
  onStop(handler: () => Promise<void>): void;
};

function isParentPort(value: unknown): value is ParentPort {
  return typeof value === 'object' && value !== null && 'postMessage' in value && 'on' in value;
}

function controlType(value: unknown): string | null {
  return typeof value === 'object' && value !== null && 'type' in value && typeof value.type === 'string'
    ? value.type
    : null;
}

/** Exit code of a process ended by an uncaught exception or unhandled rejection (DIAG-8). */
export const CRASH_EXIT_CODE = 70;

/** Logs an uncaught exception or unhandled rejection with its stack, then exits with 70; the supervisor restarts the service (DIAG-8). */
function installCrashHandlers(log: Logger): void {
  const crash = (event: string, reason: unknown) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    log.log('error', event, { message: error.message, stack: error.stack });
    process.exit(CRASH_EXIT_CODE);
  };
  process.on('uncaughtException', (error) => crash('uncaught_exception', error));
  process.on('unhandledRejection', (reason) => crash('unhandled_rejection', reason));
}

/**
 * Shared start code of every service entry: the bus on the parent port and on the renderer's port,
 * the ready message, and the stop message. Card 010.
 */
export function startServiceRuntime(name: ServiceId): ServiceRuntime {
  const parent: unknown = Reflect.get(process, 'parentPort');
  if (!isParentPort(parent)) throw new Error(`${name} must run as an Electron utility process.`);
  const log: Logger = {
    log: (level, event, data) => console.log(JSON.stringify({ level, event, process: name, ...data })),
  };
  installCrashHandlers(log);
  const stopHandlers: (() => Promise<void>)[] = [];
  const listeners: ((envelope: Envelope, from: Peer) => void)[] = [];
  const replyTo = new Map<string, 'ui' | 'main'>();
  let uiPort: MainPortLike | null = null;

  const toListeners = (envelope: Envelope, from: Peer) => {
    if (envelope.kind === 'req') replyTo.set(envelope.id, from === 'ui' ? 'ui' : 'main');
    for (const listener of listeners) listener(envelope, from);
  };
  const transport: Transport = {
    send(envelope) {
      const target = envelope.kind === 'res' ? replyTo.get(envelope.id) : 'main';
      if (envelope.kind === 'res') replyTo.delete(envelope.id);
      if (envelope.kind === 'evt') uiPort?.postMessage(envelope);
      if (target === 'ui') uiPort?.postMessage(envelope);
      else parent.postMessage(envelope);
    },
    onMessage: (listener) => void listeners.push(listener),
  };

  parent.on('message', (event) => {
    if (isEnvelope(event.data)) return toListeners(event.data, 'main');
    const type = controlType(event.data);
    const port = event.ports[0];
    if (type === 'port' && port !== undefined) {
      uiPort = port;
      mainPortEndpoint(port).listen((message) => {
        if (isEnvelope(message)) toListeners(message, 'ui');
      });
    }
    if (type === 'stop')
      void Promise.allSettled(stopHandlers.map((handler) => handler())).then(() => process.exit(0));
  });

  // A parent port listener alone does not keep a utility process alive; this handle does, until stop.
  setInterval(() => undefined, 1 << 30);
  const bus = createBus({ process: name, transport, clock: systemClock, log });
  return {
    bus,
    log,
    ready: () => parent.postMessage({ type: 'ready' }),
    onStop: (handler) => void stopHandlers.push(handler),
  };
}
