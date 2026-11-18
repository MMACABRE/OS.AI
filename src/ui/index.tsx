import { createRoot } from 'react-dom/client';
import type { ServiceId } from '@hsos/contracts/ids';
import { pingChannel } from '../modules/shell/bus/ping-channel';
import { systemClock } from '../modules/shell/system-clock';
import { createRendererBus } from './bus';
import type { PreloadBus } from './bus';

function preloadBus(): PreloadBus | null {
  const hsos: unknown = Reflect.get(window, 'hsos');
  const bus: unknown = typeof hsos === 'object' && hsos !== null ? Reflect.get(hsos, 'bus') : null;
  return isPreloadBus(bus) ? bus : null;
}

function isPreloadBus(value: unknown): value is PreloadBus {
  return (
    typeof value === 'object' &&
    value !== null &&
    'send' in value &&
    'onMessage' in value &&
    'onServicePort' in value
  );
}

const PING_TARGETS: readonly ServiceId[] = ['pty-host', 'workspace-service', 'link-service'];
const log = { log: () => undefined };
const root = document.getElementById('root');
const preload = preloadBus();

/** Card 005 check: counts the raw messages pty-host sends on its port, beside the bus. */
function checkPorts(show: (text: string) => void): void {
  window.addEventListener('message', (event: MessageEvent<unknown>) => {
    const data = event.data;
    const isPtyPort =
      typeof data === 'object' && data !== null && Reflect.get(data, 'service') === 'pty-host';
    const port = event.ports[0];
    if (event.source !== window || !isPtyPort || port === undefined) return;
    let expected = 0;
    let total = 0;
    port.addEventListener('message', (message: MessageEvent<unknown>) => {
      const bytes = message.data;
      if (!(bytes instanceof Uint8Array)) return;
      if (bytes.some((value) => value !== expected % 256)) return show('ports-failed');
      expected += 1;
      total += bytes.byteLength;
      if (expected === 1_000) show(`ports-ok ${total}`);
    });
    port.start();
  });
}

if (root !== null) {
  const view = createRoot(root);
  view.render(<p>HSOS</p>);
  if (new URLSearchParams(window.location.search).get('e2e') !== '1')
    checkPorts((text) => view.render(<p>{text}</p>));
  if (preload !== null && new URLSearchParams(window.location.search).get('e2e') === '1') {
    const bus = createRendererBus(preload, systemClock, log);
    const pingAll = async () => {
      const replies = await Promise.all(PING_TARGETS.map((service) => bus.call(pingChannel(service), {})));
      view.render(
        <p>
          {replies
            .map((reply) => (reply.ok ? `${reply.value.reply} ${reply.value.from}` : reply.error.code))
            .join(', ')}
        </p>,
      );
    };
    setTimeout(() => void pingAll(), 500);
  }
}
