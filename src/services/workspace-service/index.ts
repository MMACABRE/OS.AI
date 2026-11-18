import { ok } from '@hsos/contracts/result';
import { pingChannel } from '../../modules/shell/bus/ping-channel';
import { startServiceRuntime } from '../shared/service-main';

const runtime = startServiceRuntime('workspace-service');
runtime.bus.handle(pingChannel('workspace-service'), () => ok({ reply: 'pong', from: 'workspace-service' }));
runtime.ready();
