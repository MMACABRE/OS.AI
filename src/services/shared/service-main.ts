import type { Envelope } from '@hsos/contracts/bus';
import type { ServiceId } from '@hsos/contracts/ids';
import type { Logger, ServiceContext } from '@hsos/contracts/module';
import type { DataPaths } from '@hsos/contracts/paths';
import { createRemoteSettingsReader } from '../../modules/settings/service/remote-settings';
import { loadModules } from '../../modules/shell/loader/load-modules';
import type { ModuleEntry } from '../../modules/shell/loader/load-modules';
import {
  createContributionStore,
  createServiceContext,
  environmentDataPaths,
} from '../../modules/shell/loader/service-context';
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

/** A process's logger as the diagnostics module builds it (its file logger), seen by shape. */
export type ProcessLogger = Logger & {
  forModule(module: string): Logger;
  close(): Promise<void>;
  flushSync(): void;
};

/** Logs an uncaught exception or unhandled rejection with its stack, then exits with 70; the supervisor restarts the service (DIAG-8). */
function installCrashHandlers(log: ProcessLogger): void {
  const crash = (event: string, reason: unknown) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    log.log('error', event, { message: error.message, stack: error.stack });
    log.flushSync();
    process.exit(CRASH_EXIT_CODE);
  };
  process.on('uncaughtException', (error) => crash('uncaught_exception', error));
  process.on('unhandledRejection', (reason) => crash('unhandled_rejection', reason));
}

/** A logger that writes to stdout (main pipes it to its own); for a service started without a file logger. */
function consoleLogger(name: ServiceId): ProcessLogger {
  const line = (module: string): Logger => ({
    log: (level, event, data) =>
      console.log(JSON.stringify({ level, event, process: name, module, ...data })),
  });
  return { ...line('shell'), forModule: line, close: () => Promise.resolve(), flushSync: () => undefined };
}

/** Starts a service: runtime, its module list through the loader (SHELL-20), then `ready` (SHELL-3). Card 014. */
export function runService(
  name: Exclude<ServiceId, 'main'>,
  modules: readonly ModuleEntry<ServiceContext>[],
  makeLogger: (paths: DataPaths) => ProcessLogger,
): ServiceRuntime {
  const paths = environmentDataPaths();
  const log = makeLogger(paths);
  const runtime = startServiceRuntime(name, log);
  const store = createContributionStore();
  loadModules(
    modules,
    (id) =>
      createServiceContext(id, {
        bus: runtime.bus,
        clock: systemClock,
        paths,
        store,
        logFor: (module) => log.forModule(module),
        onStop: runtime.onStop,
        // SET-10: sections come from main over the bus.
        registerSettings: (section) => createRemoteSettingsReader(runtime.bus, section, log.forModule(id)),
      }),
    log,
  );
  runtime.onStop(() => log.close());
  return runtime;
}

/**
 * Shared start code of every service entry: the bus on the parent port and on the renderer's port,
 * the ready message, and the stop message. Card 010.
 */
export function startServiceRuntime(
  name: ServiceId,
  log: ProcessLogger = consoleLogger(name),
): ServiceRuntime {
  const parent: unknown = Reflect.get(process, 'parentPort');
  if (!isParentPort(parent)) throw new Error(`${name} must run as an Electron utility process.`);
  installCrashHandlers(log);
  const stopHandlers: (() => Promise<void>)[] = [];
  const listeners: ((envelope: Envelope, from: Peer) => void)[] = [];
  const replyTo = new Map<string, 'ui' | 'main'>();
  let uiPort: MainPortLike | null = null;
  // DIAG-8 (E2E): the service the launcher marked throws once, after it is ready.
  const throwAfterReady = process.env['HSOS_E2E_THROW_SERVICE'] === name;

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
    ready: () => {
      parent.postMessage({ type: 'ready' });
      if (throwAfterReady)
        setTimeout(() => {
          throw new Error('deliberate uncaught exception (DIAG-8)');
        }, 0);
    },
    onStop: (handler) => void stopHandlers.push(handler),
  };
}
