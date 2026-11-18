import type { EpochMs } from '@hsos/contracts/ids';
import type { Unsubscribe } from '@hsos/contracts/bus';
import type { Clock, Logger } from '@hsos/contracts/module';
import { shellChannels } from '@hsos/contracts/channels/shell';
import type { ServiceStatus } from '@hsos/contracts/channels/shell';
import { err, ok } from '@hsos/contracts/result';
import type { BusClient } from '../../modules/shell/bus/create-bus';
import type { ProcessLauncher, ServiceName, ServiceProcess } from './service-process';

export const READY_TIMEOUT_MS = 5_000;
export const STOP_TIMEOUT_MS = 3_000;
export const DEATH_WINDOW_MS = 60_000;
/** The death that stops automatic restart (SHELL-13). */
export const MAX_DEATHS = 6;

/** What main does around the supervisor: broker links, ports, crash reports. */
export type SupervisorHooks = {
  /** A process was started; route its bus messages (non-control messages arrive in `onMessage`). */
  attach(name: ServiceName, child: ServiceProcess): void;
  /** Its process is gone; drop its broker link. */
  detach(name: ServiceName): void;
  /** A message from the service that is not `ready`. */
  onMessage(name: ServiceName, message: unknown): void;
  /** The service sent `ready` (SHELL-3); give the renderer a fresh port (SHELL-11). */
  onReady(name: ServiceName, child: ServiceProcess): void;
  /** An unrequested exit (SHELL-10). Card 013 writes the crash report here (DIAG-7). */
  reportDeath(name: ServiceName, exitCode: number): void;
};

export type SupervisorOptions = {
  readonly services: readonly ServiceName[];
  readonly launch: ProcessLauncher;
  readonly clock: Clock;
  /** main's bus: status events, the shell channels, and `failPending` (BUS-4). */
  readonly bus: BusClient;
  readonly log: Logger;
  readonly hooks: SupervisorHooks;
};

export type Supervisor = {
  /** Starts every service (architecture §6 step 3). */
  start(): void;
  status(): ServiceStatus[];
  /** Starts a service again and clears its death count (SHELL-13). */
  restart(name: ServiceName): void;
  /** Sends `stop` to every service; kills those still alive after 3 000 ms (SHELL-7). */
  stop(): Promise<void>;
};

type Entry = {
  readonly name: ServiceName;
  child: ServiceProcess | null;
  state: ServiceStatus['state'];
  deaths: EpochMs[];
  needsManualRestart: boolean;
  readyMisses: number;
  cancelReadyTimer: Unsubscribe;
  /** Resolves `stop()` for this service. */
  onStopped: (() => void) | null;
};

function isReadyMessage(message: unknown): boolean {
  return typeof message === 'object' && message !== null && 'type' in message && message.type === 'ready';
}

/**
 * Starts, watches and restarts the utility processes. SHELL-3, SHELL-4, SHELL-7, SHELL-10 to SHELL-13,
 * and the `getServiceStatus`, `restartService` and `serviceStatusChanged` channels. Card 011.
 */
export function createSupervisor(options: SupervisorOptions): Supervisor {
  const { clock, bus, hooks, log } = options;
  const entries = new Map<ServiceName, Entry>();
  for (const name of options.services)
    entries.set(name, {
      name,
      child: null,
      state: 'stopped',
      deaths: [],
      needsManualRestart: false,
      readyMisses: 0,
      cancelReadyTimer: () => undefined,
      onStopped: null,
    });

  const statusOf = (entry: Entry): ServiceStatus => {
    const since = clock.now() - DEATH_WINDOW_MS;
    entry.deaths = entry.deaths.filter((time) => time > since);
    return {
      service: entry.name,
      state: entry.state,
      recentDeaths: entry.deaths.length,
      needsManualRestart: entry.needsManualRestart,
    };
  };
  const setState = (entry: Entry, state: ServiceStatus['state']) => {
    entry.state = state;
    bus.emit(shellChannels.serviceStatusChanged, statusOf(entry));
  };

  /** Ends the current process on purpose: its exit is not a death. */
  const dropProcess = (entry: Entry) => {
    entry.cancelReadyTimer();
    const current = entry.child;
    entry.child = null;
    if (current === null) return;
    hooks.detach(entry.name);
    bus.failPending(entry.name);
    current.kill();
  };

  const launch = (entry: Entry) => {
    const child = options.launch(entry.name);
    entry.child = child;
    child.onMessage((message) => {
      if (entry.child !== child) return;
      if (!isReadyMessage(message)) return hooks.onMessage(entry.name, message);
      entry.cancelReadyTimer();
      entry.readyMisses = 0;
      setState(entry, 'ready');
      hooks.onReady(entry.name, child);
    });
    child.onExit((code) => onExit(entry, child, code));
    hooks.attach(entry.name, child);
    entry.cancelReadyTimer = clock.after(READY_TIMEOUT_MS, () => onReadyMiss(entry));
    setState(entry, 'starting');
  };

  const onReadyMiss = (entry: Entry) => {
    entry.readyMisses += 1;
    log.log('warn', 'service_ready_missed', { service: entry.name, misses: entry.readyMisses });
    dropProcess(entry);
    if (entry.readyMisses < 2) return launch(entry);
    entry.needsManualRestart = true;
    setState(entry, 'down');
  };

  const onExit = (entry: Entry, child: ServiceProcess, code: number) => {
    if (entry.onStopped !== null && entry.child === child) {
      entry.child = null;
      hooks.detach(entry.name);
      bus.failPending(entry.name);
      entry.onStopped();
      return;
    }
    // A process the supervisor already dropped (ready miss, manual restart) is not a death.
    if (entry.child !== child) return;
    entry.cancelReadyTimer();
    entry.child = null;
    hooks.detach(entry.name);
    bus.failPending(entry.name);
    hooks.reportDeath(entry.name, code);
    entry.deaths.push(clock.now());
    log.log('error', 'service_died', { service: entry.name, exitCode: code });
    if (statusOf(entry).recentDeaths >= MAX_DEATHS) entry.needsManualRestart = true;
    setState(entry, 'down');
    if (!entry.needsManualRestart) launch(entry);
  };

  const restart = (entry: Entry) => {
    entry.deaths = [];
    entry.needsManualRestart = false;
    entry.readyMisses = 0;
    dropProcess(entry);
    launch(entry);
  };

  const stopOne = (entry: Entry) =>
    new Promise<void>((resolve) => {
      entry.cancelReadyTimer();
      const child = entry.child;
      if (child === null) {
        entry.state = 'stopped';
        return resolve();
      }
      const cancelKill = clock.after(STOP_TIMEOUT_MS, () => child.kill());
      entry.onStopped = () => {
        cancelKill();
        entry.onStopped = null;
        setState(entry, 'stopped');
        resolve();
      };
      child.postMessage({ type: 'stop' });
    });

  bus.handle(shellChannels.getServiceStatus, () => ok([...entries.values()].map(statusOf)));
  bus.handle(shellChannels.restartService, ({ service }) => {
    const entry = service === 'main' ? undefined : entries.get(service);
    if (entry === undefined) return err('BAD_REQUEST', `${service} is not a supervised service.`);
    restart(entry);
    return ok({});
  });

  return {
    start: () => {
      for (const entry of entries.values()) launch(entry);
    },
    status: () => [...entries.values()].map(statusOf),
    restart: (name) => {
      const entry = entries.get(name);
      if (entry !== undefined) restart(entry);
    },
    stop: async () => {
      await Promise.all([...entries.values()].map(stopOne));
    },
  };
}
