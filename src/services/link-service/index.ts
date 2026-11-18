import { ok } from '@hsos/contracts/result';
import { pingChannel } from '../../modules/shell/bus/ping-channel';
import { startServiceRuntime } from '../shared/service-main';

const runtime = startServiceRuntime('link-service');
runtime.bus.handle(pingChannel('link-service'), () => ok({ reply: 'pong', from: 'link-service' }));
runtime.ready();
