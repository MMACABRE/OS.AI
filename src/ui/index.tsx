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
import { COMMAND_MODE } from '../modules/ui-kit/palette/CommandPalette';
import { AppRoot, createMessageControl, createPaletteControl } from './app-root';
import type { PaletteControl } from './app-root';
import { createModuleLogger, uiModules } from './module-list';
import { pingChannel } from '../modules/shell/bus/ping-channel';
import { systemClock } from '../modules/shell/system-clock';
import { createDemoRendererBus, createRendererBus, isDemoMode } from './bus';
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

/**
 * The window key listener over the registered commands and the effective bindings (UI-20, SET-18, card 019).
 * Returns the effective key of a command, for the palette (UI-10).
 */
function startKeys(bus: Bus, registry: UiRegistry): (commandId: string) => string | null {
  let byCommand: ReadonlyMap<string, string | null> = new Map();
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
    byCommand = resolved.byCommand;
  };
  apply({});
  void bus.call(settingsChannels.getKeybindings, {}).then((result) => {
    if (result.ok) apply(result.value);
  });
  bus.on(settingsChannels.keybindingsChanged, apply);
  return (commandId) => byCommand.get(commandId) ?? null;
}

/** Registers the renderer's modules (SHELL-20, card 014) and the shell's own palette command (card 023). */
function loadUiModules(bus: Bus, palette: PaletteControl): UiRegistry {
  const registry = createUiRegistry();
  registry.commandRegistry.add({
    id: 'shell.commandPalette',
    title: 'Show all commands',
    defaultKey: 'Ctrl+Shift+P',
    global: true,
    run: () => palette.open(COMMAND_MODE),
  });
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

/** The bus: the demo transport for `npm run demo` (card 026), else main and the services. */
async function chooseBus(): Promise<Bus | null> {
  if (isDemoMode()) return createDemoRendererBus(systemClock, log);
  return preload === null ? null : createRendererBus(preload, systemClock, log);
}

async function start(root: HTMLElement): Promise<void> {
  // Card 036: the state gallery (`npm run demo -- --gallery`) replaces the app.
  if (new URLSearchParams(window.location.search).get('gallery') === '1') {
    const { Gallery } = await import('../demo/gallery');
    createRoot(root).render(<Gallery />);
    return;
  }
  const message = createMessageControl();
  const palette = createPaletteControl();
  const bus = await chooseBus();
  const registry = bus === null ? null : loadUiModules(bus, palette);
  const keyFor = bus === null || registry === null ? () => null : startKeys(bus, registry);
  createRoot(root).render(
    <AppRoot bus={bus} registry={registry} keyFor={keyFor} palette={palette} message={message} />,
  );
  if (new URLSearchParams(window.location.search).get('e2e') !== '1') checkPorts(message.set);
  // SHELL-5: the window shows now; the workspace restore (WS cards) will move this after it.
  if (bus !== null) void bus.call(shellChannels.uiReady, {});
  if (bus !== null && new URLSearchParams(window.location.search).get('e2e') === '1') {
    const pingAll = async () => {
      const replies = await Promise.all(PING_TARGETS.map((service) => bus.call(pingChannel(service), {})));
      message.set(
        replies
          .map((reply) => (reply.ok ? `${reply.value.reply} ${reply.value.from}` : reply.error.code))
          .join(', '),
      );
    };
    setTimeout(() => void pingAll(), 500);
  }
}

if (root !== null) void start(root);
