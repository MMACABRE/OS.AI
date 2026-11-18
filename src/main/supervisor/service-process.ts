import { join } from 'node:path';
import { utilityProcess } from 'electron';
import type { MessagePortMain } from 'electron';
import type { ServiceId } from '@hsos/contracts/ids';

/** A utility process the supervisor runs: every service except main. */
export type ServiceName = Exclude<ServiceId, 'main'>;

/** One running service process, as the supervisor sees it. Tests use a fake. */
export type ServiceProcess = {
  postMessage(message: unknown, ports?: MessagePortMain[]): void;
  /** Ends the process at once. Its exit listeners still run. */
  kill(): void;
  onMessage(listener: (message: unknown) => void): void;
  /** Runs once, when the process has exited for any reason. */
  onExit(listener: (code: number) => void): void;
};

/** Starts a fresh process for one service (card 011, step 1). */
export type ProcessLauncher = (name: ServiceName) => ServiceProcess;

/** The real launcher: each service runs from `<out>/main/<name>.js` in an Electron utility process. */
export const utilityProcessLauncher: ProcessLauncher = (name) => {
  const child = utilityProcess.fork(join(import.meta.dirname, `${name}.js`), [], {
    serviceName: name,
    stdio: 'pipe',
  });
  child.stdout?.on('data', (data: Buffer) => process.stdout.write(data));
  child.stderr?.on('data', (data: Buffer) => process.stderr.write(data));
  return {
    postMessage: (message, ports) => child.postMessage(message, ports),
    kill: () => void child.kill(),
    onMessage: (listener) => void child.on('message', listener),
    onExit: (listener) => void child.once('exit', listener),
  };
};
