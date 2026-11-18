import type { Envelope } from '@hsos/contracts/bus';
import type { ServiceId } from '@hsos/contracts/ids';
import { activityChannels } from '@hsos/contracts/channels/activity';
import { browserChannels } from '@hsos/contracts/channels/browser';
import { claudeLinkChannels } from '@hsos/contracts/channels/claude-link';
import { dashboardChannels } from '@hsos/contracts/channels/dashboard';
import { diagnosticsChannels } from '@hsos/contracts/channels/diagnostics';
import { filesChannels } from '@hsos/contracts/channels/files';
import { gitChannels } from '@hsos/contracts/channels/git';
import { graphChannels } from '@hsos/contracts/channels/graph';
import { historyChannels } from '@hsos/contracts/channels/history';
import { reviewChannels } from '@hsos/contracts/channels/review';
import { sessionsChannels } from '@hsos/contracts/channels/sessions';
import { settingsChannels } from '@hsos/contracts/channels/settings';
import { shellChannels } from '@hsos/contracts/channels/shell';
import { skillsChannels } from '@hsos/contracts/channels/skills';
import { terminalChannels } from '@hsos/contracts/channels/terminal';
import { workspaceChannels } from '@hsos/contracts/channels/workspace';
import type { Peer, Transport } from '../../modules/shell/bus/transport';

/** How the broker reaches one peer: the renderer over IPC, a service over its parent port. */
export type PeerLink = { send(envelope: Envelope): void };

export type Broker = {
  /** The transport for main's own bus. */
  readonly mainTransport: Transport;
  /** Feeds an envelope that arrived from a peer. */
  receive(envelope: Envelope, from: Peer): void;
  connect(peer: Peer, link: PeerLink): void;
  disconnect(peer: Peer): void;
};

/** Owner of every channel declared in the contracts, by name. Service-to-service routing (§2.2). */
export function buildOwnerIndex(): ReadonlyMap<string, ServiceId> {
  const maps = [
    activityChannels,
    browserChannels,
    claudeLinkChannels,
    dashboardChannels,
    diagnosticsChannels,
    filesChannels,
    gitChannels,
    graphChannels,
    historyChannels,
    reviewChannels,
    sessionsChannels,
    settingsChannels,
    shellChannels,
    skillsChannels,
    terminalChannels,
    workspaceChannels,
  ];
  const index = new Map<string, ServiceId>();
  for (const map of maps) for (const channel of Object.values(map)) index.set(channel.name, channel.owner);
  return index;
}

/**
 * Routes envelopes between main's bus, the renderer and the services. Requests go to their channel's owner,
 * responses go back to whoever sent the request, events go to everyone but their sender. Card 010.
 */
export function createBroker(ownerOf: ReadonlyMap<string, ServiceId>): Broker {
  const links = new Map<Peer, PeerLink>();
  const replyTo = new Map<string, Peer>();
  let mainListener: (envelope: Envelope, from: Peer) => void = () => undefined;

  const sendTo = (peer: Peer, envelope: Envelope) => {
    if (peer === 'main') return mainListener(envelope, 'main');
    links.get(peer)?.send(envelope);
  };
  const route = (envelope: Envelope, from: Peer) => {
    if (envelope.kind === 'evt') {
      if (from !== 'main') mainListener(envelope, from);
      for (const [peer, link] of links) if (peer !== from) link.send(envelope);
      return;
    }
    if (envelope.kind === 'res') {
      const target = replyTo.get(envelope.id);
      replyTo.delete(envelope.id);
      return target === undefined ? mainListener(envelope, from) : sendTo(target, envelope);
    }
    const owner = ownerOf.get(envelope.channel) ?? 'main';
    replyTo.set(envelope.id, from);
    if (owner === 'main') return mainListener(envelope, from);
    sendTo(owner, envelope);
  };

  return {
    mainTransport: {
      send: (envelope) => route(envelope, 'main'),
      onMessage: (listener) => {
        mainListener = listener;
      },
    },
    receive: route,
    connect: (peer, link) => void links.set(peer, link),
    disconnect: (peer) => void links.delete(peer),
  };
}
