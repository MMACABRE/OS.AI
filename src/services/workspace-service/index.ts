import { ok } from '@hsos/contracts/result';
import { pingChannel } from '../../modules/shell/bus/ping-channel';
import { runService } from '../shared/service-main';
import { createProcessLogger, serviceModules } from './module-list';

const runtime = runService('workspace-service', serviceModules, createProcessLogger);
runtime.bus.handle(pingChannel('workspace-service'), () => ok({ reply: 'pong', from: 'workspace-service' }));
runtime.ready();
