import { useMemo } from 'react';
import type { MouseEvent } from 'react';
import { micromark } from 'micromark';
import styles from './MarkdownView.module.css';

export type MarkdownViewProps = {
  readonly source: string;
  /** A link was clicked or activated with Enter; the view never navigates itself. */
  readonly onLinkActivate: (href: string) => void;
};

/**
 * Markdown rendered with `micromark`. Raw HTML in the source is escaped and shown as text, and
 * `javascript:` style links are dropped (micromark's defaults, UI-5).
 */
export function MarkdownView({ source, onLinkActivate }: MarkdownViewProps) {
  const html = useMemo(() => micromark(source, { allowDangerousHtml: false, allowDangerousProtocol: false }), [source]);
  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    const link = (event.target as Element).closest('a');
    if (link === null) return;
    event.preventDefault();
    const href = link.getAttribute('href');
    if (href !== null && href !== '') onLinkActivate(href);
  };
  return (
    // Links inside are real anchors, so Enter on a focused link raises this click too.
    <div className={styles.markdown} onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />
  );
}
