import { contextBridge, ipcRenderer } from 'electron';
import type { Envelope } from '@hsos/contracts/bus';
import type { ServiceId } from '@hsos/contracts/ids';

const SERVICES: readonly string[] = ['pty-host', 'workspace-service', 'link-service'];

function argument(name: string): string {
  const prefix = `--hsos-${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? '';
}

function isServiceName(value: unknown): value is ServiceId {
  return typeof value === 'string' && SERVICES.includes(value);
}

const portListeners: ((service: ServiceId) => void)[] = [];

/**
 * A MessagePort cannot cross the context bridge as an argument (it arrives as a plain object), so the
 * preload hands it to its own window with `window.postMessage`. The page takes it only when the
 * message's source is its own window. The page is `file:` (an opaque origin) and cannot navigate (SEC-2).
 */
ipcRenderer.on('hsos-service-port', (event, service: unknown) => {
  const port = event.ports[0];
  if (!isServiceName(service) || port === undefined) return;
  window.postMessage({ type: 'hsos-service-port', service }, '*', [port]);
  for (const listener of portListeners) listener(service);
});

/** The API of spec/modules/shell.md "Preload API" (SEC-3); the port itself comes by window message. */
contextBridge.exposeInMainWorld('hsos', {
  bus: {
    send: (envelope: Envelope) => ipcRenderer.send('hsos-bus', envelope),
    onMessage: (listener: (envelope: Envelope) => void) =>
      void ipcRenderer.on('hsos-bus', (_event, envelope: Envelope) => listener(envelope)),
    onServicePort: (listener: (service: ServiceId) => void) => void portListeners.push(listener),
  },
  platform: { appVersion: argument('version'), isPackaged: argument('packaged') === '1' },
});
