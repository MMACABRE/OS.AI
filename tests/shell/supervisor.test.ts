import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { request } from '@hsos/contracts/bus';
import { createBus } from '../../src/modules/shell/bus/create-bus';
import { createLoopbackTransport } from '../../src/modules/shell/bus/transport';
import { createSupervisor } from '../../src/main/supervisor/supervisor';
import type { SupervisorHooks } from '../../src/main/supervisor/supervisor';
import type { ProcessLauncher, ServiceName, ServiceProcess } from '../../src/main/supervisor/service-process';
import { shellChannels } from '@hsos/contracts/channels/shell';
import { createFakeClock } from '../fakes/fake-clock';

const silent = { log: () => undefined };
const ptyCall = request('test.pty', 'pty-host', z.object({}), z.object({}), 600_000);

type FakeChild = ServiceProcess & {
  readonly sent: unknown[];
  killed: number;
  say(message: unknown): void;
  exit(code: number): void;
};

/** A fake process: kill() ends it, like a real one, and fires the exit listeners. */
function fakeChild(onKill?: (child: FakeChild) => void): FakeChild {
  const messageListeners: ((message: unknown) => void)[] = [];
  const exitListeners: ((code: number) => void)[] = [];
  let exited = false;
  const child: FakeChild = {
    sent: [],
    killed: 0,
    postMessage: (message) => void child.sent.push(message),
    kill: () => {
      child.killed += 1;
      onKill?.(child);
      child.exit(1);
    },
    onMessage: (listener) => void messageListeners.push(listener),
    onExit: (listener) => void exitListeners.push(listener),
    say: (message) => {
      for (const listener of messageListeners) listener(message);
    },
    exit: (code) => {
      if (exited) return;
      exited = true;
      for (const listener of exitListeners) listener(code);
    },
  };
  return child;
}

function setup(onLaunch: (child: FakeChild, name: ServiceName) => void = () => undefined) {
  const clock = createFakeClock();
  const [mainSide] = createLoopbackTransport('main', 'pty-host');
  const bus = createBus({ process: 'main', transport: mainSide, clock, log: silent });
  const launched: { name: ServiceName; child: FakeChild }[] = [];
  const launch: ProcessLauncher = (name) => {
    const child = fakeChild();
    launched.push({ name, child });
    onLaunch(child, name);
    return child;
  };
  const deaths: { name: ServiceName; code: number }[] = [];
  const ready: ServiceName[] = [];
  const hooks: SupervisorHooks = {
    attach: () => undefined,
    detach: () => undefined,
    onMessage: () => undefined,
    onReady: (name) => void ready.push(name),
    reportDeath: (name, code) => void deaths.push({ name, code }),
  };
  const supervisor = createSupervisor({
    services: ['pty-host', 'workspace-service', 'link-service'],
    launch,
    clock,
    bus,
    log: silent,
    hooks,
  });
  const only = (name: ServiceName) => launched.filter((item) => item.name === name);
  const statusOf = (name: ServiceName) => supervisor.status().find((item) => item.service === name);
  return { clock, bus, supervisor, launched, deaths, ready, only, statusOf };
}

describe('supervisor', () => {
  it('SHELL-4 kills a service that never sends ready, starts it once more, then gives up', () => {
    const { clock, supervisor, only, statusOf } = setup();
    supervisor.start();
    expect(only('pty-host')).toHaveLength(1);

    clock.advance(5_000);
    expect(only('pty-host')).toHaveLength(2);
    expect(only('pty-host')[0]?.child.killed).toBe(1);

    clock.advance(5_000);
    expect(only('pty-host')).toHaveLength(2);
    expect(only('pty-host')[1]?.child.killed).toBe(1);
    expect(statusOf('pty-host')).toEqual({
      service: 'pty-host',
      state: 'down',
      recentDeaths: 0,
      needsManualRestart: true,
    });
  });

  it('SHELL-4 a service that sends ready in time is ready and is not killed', () => {
    const { clock, supervisor, only, statusOf, ready } = setup();
    supervisor.start();
    for (const { child } of only('pty-host')) child.say({ type: 'ready' });
    clock.advance(20_000);

    expect(only('pty-host')).toHaveLength(1);
    expect(only('pty-host')[0]?.child.killed).toBe(0);
    expect(statusOf('pty-host')?.state).toBe('ready');
    expect(ready).toEqual(['pty-host']);
  });

  it('SHELL-12 a request pending to a service resolves with SERVICE_DOWN when the service exits', async () => {
    const { bus, supervisor, only } = setup();
    supervisor.start();
    const pending = bus.call(ptyCall, {});

    only('pty-host')[0]?.child.exit(1);

    const result = await pending;
    expect(result.ok ? null : result.error.code).toBe('SERVICE_DOWN');
  });

  it('SHELL-13 stops restarting after the sixth death in a minute; restart launches again and clears deaths', () => {
    const { clock, supervisor, only, statusOf, deaths } = setup();
    supervisor.start();
    for (let death = 1; death <= 6; death += 1) only('pty-host').at(-1)?.child.exit(1);

    expect(only('pty-host')).toHaveLength(6);
    expect(deaths.filter((item) => item.name === 'pty-host')).toHaveLength(6);
    expect(statusOf('pty-host')?.needsManualRestart).toBe(true);
    expect(statusOf('pty-host')?.recentDeaths).toBe(6);
    clock.advance(1_000);
    expect(only('pty-host')).toHaveLength(6);

    supervisor.restart('pty-host');

    expect(only('pty-host')).toHaveLength(7);
    expect(statusOf('pty-host')?.needsManualRestart).toBe(false);
    expect(statusOf('pty-host')?.recentDeaths).toBe(0);
  });

  it('SHELL-13 five deaths do not stop restarting', () => {
    const { supervisor, only, statusOf } = setup();
    supervisor.start();
    for (let death = 1; death <= 5; death += 1) only('pty-host').at(-1)?.child.exit(1);

    expect(only('pty-host')).toHaveLength(6);
    expect(statusOf('pty-host')?.needsManualRestart).toBe(false);
  });

  it('SHELL-13 shell.restartService launches a service that needs a manual restart and clears recentDeaths', async () => {
    const { supervisor, bus, only, statusOf } = setup();
    supervisor.start();
    for (let death = 1; death <= 6; death += 1) only('pty-host').at(-1)?.child.exit(1);
    expect(statusOf('pty-host')?.needsManualRestart).toBe(true);

    const result = await bus.call(shellChannels.restartService, { service: 'pty-host' });

    expect(result.ok).toBe(true);
    expect(only('pty-host')).toHaveLength(7);
    expect(statusOf('pty-host')?.recentDeaths).toBe(0);
    expect(statusOf('pty-host')?.needsManualRestart).toBe(false);
  });

  it('SHELL-13 shell.restartService refuses main', async () => {
    const { supervisor, bus } = setup();
    supervisor.start();
    const result = await bus.call(shellChannels.restartService, { service: 'main' });
    expect(result.ok ? null : result.error.code).toBe('BAD_REQUEST');
  });

  it('SHELL-13 deaths older than 60 seconds do not count towards the limit', () => {
    const { clock, supervisor, only, statusOf } = setup();
    supervisor.start();
    for (let death = 1; death <= 5; death += 1) only('pty-host').at(-1)?.child.exit(1);
    only('pty-host').at(-1)?.child.say({ type: 'ready' });
    clock.advance(61_000);
    only('pty-host').at(-1)?.child.exit(1);

    expect(statusOf('pty-host')?.recentDeaths).toBe(1);
    expect(statusOf('pty-host')?.needsManualRestart).toBe(false);
  });

  it('SHELL-7 stop() sends stop and kills a process still alive after 3 000 ms', async () => {
    const { clock, supervisor, only } = setup();
    supervisor.start();
    const stopping = supervisor.stop();
    for (const { child } of only('pty-host')) expect(child.sent).toEqual([{ type: 'stop' }]);
    expect(only('pty-host')[0]?.child.killed).toBe(0);

    clock.advance(3_000);
    await stopping;

    for (const name of ['pty-host', 'workspace-service', 'link-service'] as const)
      expect(only(name)[0]?.child.killed).toBe(1);
  });

  it('SHELL-7 stop() resolves without killing a process that exits when told to stop', async () => {
    const { supervisor, only, statusOf } = setup((child) => {
      const post = child.postMessage;
      child.postMessage = (message) => {
        post(message);
        child.exit(0);
      };
    });
    supervisor.start();
    await supervisor.stop();

    expect(only('pty-host')[0]?.child.killed).toBe(0);
    expect(statusOf('pty-host')?.state).toBe('stopped');
  });

  it('SHELL-10 an unrequested exit is reported as a death and the service starts again', () => {
    const { supervisor, only, deaths, statusOf } = setup();
    supervisor.start();
    only('pty-host')[0]?.child.say({ type: 'ready' });
    only('pty-host')[0]?.child.exit(3);

    expect(deaths).toEqual([{ name: 'pty-host', code: 3 }]);
    expect(only('pty-host')).toHaveLength(2);
    expect(statusOf('pty-host')?.recentDeaths).toBe(1);
  });

  it('SHELL-10 a process killed on purpose (ready miss, manual restart) is not counted as a death', () => {
    const { clock, supervisor, only, deaths, statusOf } = setup();
    supervisor.start();
    clock.advance(5_000);
    supervisor.restart('workspace-service');

    expect(deaths).toEqual([]);
    expect(statusOf('pty-host')?.recentDeaths).toBe(0);
    expect(statusOf('workspace-service')?.recentDeaths).toBe(0);
    expect(only('workspace-service')[0]?.child.killed).toBe(1);
  });

  it('SHELL-3 getServiceStatus lists the three services', async () => {
    const { supervisor, bus } = setup();
    supervisor.start();
    const result = await bus.call(shellChannels.getServiceStatus, {});
    expect(result.ok ? result.value.map((item) => item.service) : null).toEqual([
      'pty-host',
      'workspace-service',
      'link-service',
    ]);
  });
});
