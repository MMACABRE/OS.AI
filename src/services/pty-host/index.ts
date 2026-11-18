import { ok } from '@hsos/contracts/result';
import { pingChannel } from '../../modules/shell/bus/ping-channel';
import type { MainPortLike } from '../../modules/shell/bus/port-transport';
import { startServiceRuntime } from '../shared/service-main';

const runtime = startServiceRuntime('pty-host');
runtime.bus.handle(pingChannel('pty-host'), () => ok({ reply: 'pong', from: 'pty-host' }));
runtime.ready();

type PortEvent = { data: unknown; ports: readonly MainPortLike[] };
type Parent = { on(event: 'message', listener: (event: PortEvent) => void): unknown };

function isParent(value: unknown): value is Parent {
  return typeof value === 'object' && value !== null && 'on' in value;
}

/** Card 005 check, kept beside the bus: 1 000 raw 10 000-byte messages on the renderer's port. The bus ignores them. */
const parent: unknown = Reflect.get(process, 'parentPort');
if (isParent(parent)) {
  parent.on('message', (event) => {
    const port = event.ports[0];
    const isPort =
      typeof event.data === 'object' && event.data !== null && Reflect.get(event.data, 'type') === 'port';
    if (!isPort || port === undefined) return;
    for (let index = 0; index < 1_000; index += 1) port.postMessage(new Uint8Array(10_000).fill(index % 256));
  });
}
