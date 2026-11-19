import { useEffect, useRef } from 'react';
import { startBackdrop } from './backdrop-client';
import type { BackdropHandle } from './backdrop-client';
import styles from './Backdrop.module.css';

let current: BackdropHandle | null = null;

/** The running background, for checks that its frame counter never resets (MOT-7). */
export function backdropStats(): ReturnType<BackdropHandle['stats']> | null {
  return current?.stats() ?? null;
}

/**
 * The animated background behind every page (UI-30) and the still old-monitor overlay over the whole
 * window (UI-34). The app frame mounts it once and never unmounts it. Neither part takes input or is
 * read by screen readers (UI-33). The canvas is made here, not by React, because it can hand its
 * drawing to a worker only once.
 */
export function Backdrop() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const parent = host.current;
    if (parent === null) return undefined;
    const canvas = document.createElement('canvas');
    canvas.className = styles.canvas ?? '';
    canvas.setAttribute('aria-hidden', 'true');
    parent.append(canvas);
    const handle = startBackdrop(canvas);
    current = handle;
    return () => {
      handle.stop();
      if (current === handle) current = null;
      canvas.remove();
    };
  }, []);
  return (
    <>
      <div ref={host} className={styles.backdrop} aria-hidden="true" data-hsos-backdrop="" />
      <div className={styles.crt} aria-hidden="true" data-hsos-crt="">
        <div className={styles.scanlines} />
        <div className={styles.vignette} />
      </div>
    </>
  );
}
