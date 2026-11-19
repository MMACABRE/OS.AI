import { Badge, Button, Icon, IconButton } from '@hsos/ui-kit';
import type { GraphNode } from '@hsos/contracts/channels/graph';
import { lineBadge } from './graph-model';
import styles from './Graph.module.css';

/** What the hover card shows (GRAPH-44): the node, its place on screen, its hop count and the preview. */
export type HoverCardData = {
  readonly node: GraphNode;
  readonly x: number;
  readonly y: number;
  readonly hops: number | null;
  readonly preview: { readonly lines: readonly string[]; readonly cut: boolean } | null;
};

const HOP_WORD = (hops: number): string =>
  hops === 0 ? 'start file' : hops >= 3 ? '3+ hops' : `${hops} hop${hops === 1 ? '' : 's'}`;

/** The card beside a hovered node. It never takes focus and closes on Escape (GRAPH-44). */
export function HoverCard({ card, agent }: { readonly card: HoverCardData; readonly agent: boolean }) {
  const { node } = card;
  const badge = lineBadge(node);
  return (
    <div className={styles.hover} style={{ left: card.x + 16, top: card.y + 16 }} role="tooltip">
      <p className={styles.cardTitle}>{node.label}</p>
      <p className={styles.muted}>{node.path ?? 'Not a file yet'}</p>
      <p className={styles.muted}>{node.kind}</p>
      {agent && card.hops !== null ? <p className={styles.muted}>{HOP_WORD(card.hops)}</p> : null}
      {badge === null ? null : <Badge tone="warn" text={badge} />}
      {card.preview === null ? null : (
        <pre className={styles.preview}>
          {card.preview.lines.join('\n')}
          {card.preview.cut ? '\n…' : ''}
        </pre>
      )}
    </div>
  );
}

export type DetailsCardProps = {
  readonly node: GraphNode;
  readonly backlinks: number;
  readonly chain: readonly { readonly id: string; readonly label: string }[];
  readonly agent: boolean;
  readonly onOpen: () => void;
  readonly onLocal: () => void;
  readonly onPick: (id: string) => void;
  readonly onClose: () => void;
};

/** The details card in the graph's corner: label, kind, path, tags, backlinks and the actions of GRAPH-24. */
export function DetailsCard({
  node,
  backlinks,
  chain,
  agent,
  onOpen,
  onLocal,
  onPick,
  onClose,
}: DetailsCardProps) {
  const badge = lineBadge(node);
  return (
    <section className={styles.details} aria-label="Selected node">
      <header className={styles.detailsHeader}>
        <span className={styles.cardTitle}>{node.label}</span>
        <IconButton icon={<Icon name="close" />} label="Close details" onPress={onClose} />
      </header>
      <p
        className={styles.muted}
      >{`${node.kind} · ${node.lineCount} lines · ${node.degree} links · ${backlinks} backlinks`}</p>
      <p className={styles.muted}>{node.path ?? 'Unresolved link'}</p>
      {node.tags.length === 0 ? null : (
        <p className={styles.muted}>{node.tags.map((tag) => `#${tag}`).join(' ')}</p>
      )}
      {badge === null ? null : <Badge tone="warn" text={badge} />}
      <div className={styles.actions}>
        <Button variant="primary" onPress={onOpen} disabled={node.path === null}>
          Open
        </Button>
        <Button onPress={onLocal} disabled={node.path === null}>
          Show Local Graph
        </Button>
      </div>
      {agent ? (
        <div className={styles.chain}>
          <p className={styles.muted}>How an agent gets here</p>
          {chain.length === 0 ? (
            <p className={styles.muted}>No link reaches this note. An agent finds it only by searching.</p>
          ) : (
            <ol className={styles.chainList}>
              {chain.map((entry) => (
                <li key={entry.id}>
                  <button type="button" className={styles.chainStep} onClick={() => onPick(entry.id)}>
                    {entry.label}
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : null}
    </section>
  );
}
