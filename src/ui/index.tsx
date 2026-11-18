import { createRoot } from 'react-dom/client';
import './fonts.css';
import type { Bus } from '@hsos/contracts/bus';
import { settingsChannels } from '@hsos/contracts/channels/settings';
import { shellChannels } from '@hsos/contracts/channels/shell';
import { createKeyDispatcher, resolveBindings } from '../modules/ui-kit/keys/key-dispatcher';
import type { ServiceId } from '@hsos/contracts/ids';
import { loadModules } from '../modules/shell/loader/load-modules';
import { createUiContext, createUiRegistry } from '../modules/shell/loader/ui-context';
import type { UiRegistry } from '../modules/shell/loader/ui-context';
import { createModuleLogger, uiModules } from './module-list';
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

/** Registers the renderer's modules (SHELL-20, card 014). The workspace reads the registry later. */
/** The window key listener over the registered commands and the effective bindings (UI-20, SET-18, card 019). */
function startKeys(bus: Bus, registry: UiRegistry): void {
  const keyLog = createModuleLogger(bus, systemClock, 'ui-kit');
  const dispatcher = createKeyDispatcher({
    target: window,
    clock: systemClock,
    log: keyLog,
    command: (id) => registry.commands.get(id),
  });
  const apply = (overrides: Readonly<Record<string, string | null>>) => {
    const resolved = resolveBindings(registry.commands.values(), overrides);
    for (const conflict of resolved.conflicts)
      keyLog.log('warn', 'ui-kit.key_conflict', {
        key: conflict.key,
        winner: conflict.winner,
        loser: conflict.loser,
      });
    dispatcher.setBindings(resolved.byKey);
  };
  apply({});
  void bus.call(settingsChannels.getKeybindings, {}).then((result) => {
    if (result.ok) apply(result.value);
  });
  bus.on(settingsChannels.keybindingsChanged, apply);
}

function loadUiModules(bus: Bus): UiRegistry {
  const registry = createUiRegistry();
  const shellLog = createModuleLogger(bus, systemClock, 'shell');
  loadModules(
    uiModules,
    (id) =>
      createUiContext(id, {
        bus,
        clock: systemClock,
        registry,
        logFor: (module) => createModuleLogger(bus, systemClock, module),
      }),
    shellLog,
  );
  return registry;
}

if (root !== null) {
  const view = createRoot(root);
  view.render(<p>HSOS</p>);
  if (new URLSearchParams(window.location.search).get('e2e') !== '1')
    checkPorts((text) => view.render(<p>{text}</p>));
  const bus = preload === null ? null : createRendererBus(preload, systemClock, log);
  if (bus !== null) {
    startKeys(bus, loadUiModules(bus));
    // SHELL-5: the window shows now; the workspace restore (WS cards) will move this after it.
    void bus.call(shellChannels.uiReady, {});
  }
  if (bus !== null && new URLSearchParams(window.location.search).get('e2e') === '1') {
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
