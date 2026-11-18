import { z } from 'zod';
import { request } from '@hsos/contracts/bus';
import type { RequestChannel } from '@hsos/contracts/bus';
import type { ServiceId } from '@hsos/contracts/ids';

/** The test-only channel of card 010: each service answers `pong` on its own `shell.ping`. */
export function pingChannel(
  owner: ServiceId,
): RequestChannel<Record<string, never>, { reply: 'pong'; from: ServiceId }> {
  return request(
    'shell.ping',
    owner,
    z.object({}).strict(),
    z.object({
      reply: z.literal('pong'),
      from: z.enum(['main', 'pty-host', 'workspace-service', 'link-service']),
    }),
    2_000,
  );
}
