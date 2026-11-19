import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import type { Logger } from '@hsos/contracts/module';
import { ErrorState, Icon } from '@hsos/ui-kit';
import styles from './Hud.module.css';

export type SectionProps = {
  readonly title: string;
  readonly collapsed: boolean;
  readonly onToggle: () => void;
  /** Extra controls on the title row, right of the title. */
  readonly tools?: ReactNode;
  /** A short note beside the title, such as "updated 14m ago". */
  readonly note?: string | null;
  readonly log: Logger;
  readonly children: ReactNode;
};

/**
 * A HUD section: a title row that collapses it, and its content inside its own error boundary, so a
 * fault in one section leaves the others working (HUD "States", P-12).
 */
export function Section({ title, collapsed, onToggle, tools, note, log, children }: SectionProps) {
  return (
    <section className={styles.section} aria-label={title}>
      <div className={styles.sectionTitle}>
        <button type="button" className={styles.titleButton} aria-expanded={!collapsed} onClick={onToggle}>
          <span className={styles.titleIcon} aria-hidden="true">
            <Icon name={collapsed ? 'chevron-right' : 'chevron-down'} size={8} />
          </span>
          {title}
        </button>
        {note === null || note === undefined ? null : <span className={styles.titleNote}>{note}</span>}
        <span className={styles.grow} />
        {tools}
      </div>
      {collapsed ? null : (
        <SectionBoundary title={title} log={log}>
          {children}
        </SectionBoundary>
      )}
    </section>
  );
}

type BoundaryProps = { readonly title: string; readonly log: Logger; readonly children: ReactNode };

/** Catches a render fault in one section and shows its error state with Retry. */
export class SectionBoundary extends Component<BoundaryProps, { readonly error: Error | null; readonly attempt: number }> {
  override state = { error: null as Error | null, attempt: 0 };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.log.log('error', 'hud.section_failed', {
      section: this.props.title,
      message: error.message,
      stack: info.componentStack ?? '',
    });
  }

  override render() {
    if (this.state.error === null) return <div key={this.state.attempt}>{this.props.children}</div>;
    return (
      <ErrorState
        message={`${this.props.title} could not be shown: ${this.state.error.message}`}
        onRetry={() => this.setState((state) => ({ error: null, attempt: state.attempt + 1 }))}
      />
    );
  }
}
