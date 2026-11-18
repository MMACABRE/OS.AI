import { createBus } from '../../src/modules/shell/bus/create-bus';
import type { BusClient } from '../../src/modules/shell/bus/create-bus';
import { createLoopbackTransport } from '../../src/modules/shell/bus/transport';
import type { Clock, Logger } from '@hsos/contracts/module';
import { createFakeClock } from './fake-clock';

const silent: Logger = { log: () => undefined };

/** A bus over a loopback transport that may handle and emit channels of any owner. */
export function createFakeBus(clock: Clock = createFakeClock(), log: Logger = silent): BusClient {
  const [side] = createLoopbackTransport('main', 'ui');
  return createBus({ process: 'main', transport: side, clock, log, owns: () => true });
}
