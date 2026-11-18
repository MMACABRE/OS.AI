import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject, UIEvent } from 'react';

/** Above this many rows only the visible ones are in the DOM (UI-7). */
export const VIRTUALISE_ABOVE = 200;
const OVERSCAN = 8;

export type VirtualRows = {
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly onScroll: (event: UIEvent<HTMLDivElement>) => void;
  /** First and one-past-last index to render. */
  readonly start: number;
  readonly end: number;
  readonly totalHeight: number;
  readonly virtual: boolean;
  /** Scrolls so the row is fully visible. */
  scrollToIndex(index: number): void;
};

/** Fixed-height row windowing shared by `List` and `Tree` (UI-7). */
export function useVirtualRows(count: number, rowHeight: number): VirtualRows {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(rowHeight * 20);
  const virtual = count > VIRTUALISE_ABOVE;

  useEffect(() => {
    const element = containerRef.current;
    if (element === null) return;
    const measure = () => setViewport(element.clientHeight > 0 ? element.clientHeight : rowHeight * 20);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [rowHeight]);

  const onScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => setScrollTop(event.currentTarget.scrollTop),
    [],
  );

  const scrollToIndex = useCallback(
    (index: number) => {
      const element = containerRef.current;
      if (element === null) return;
      const top = index * rowHeight;
      const bottom = top + rowHeight;
      if (top < element.scrollTop) element.scrollTop = top;
      else if (bottom > element.scrollTop + element.clientHeight)
        element.scrollTop = bottom - element.clientHeight;
    },
    [rowHeight],
  );

  const start = virtual ? Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN) : 0;
  const end = virtual ? Math.min(count, Math.ceil((scrollTop + viewport) / rowHeight) + OVERSCAN) : count;
  return { containerRef, onScroll, start, end, totalHeight: count * rowHeight, virtual, scrollToIndex };
}

/** Type-ahead: letters typed within 500 ms add up; the next row whose text starts with them is chosen. */
export function useTypeAhead(
  texts: () => readonly string[],
  current: number,
  choose: (index: number) => void,
) {
  const buffer = useRef('');
  const lastAt = useRef(0);
  return (key: string): boolean => {
    if (key.length !== 1 || key === ' ') return false;
    const now = Date.now();
    buffer.current = now - lastAt.current > 500 ? key.toLowerCase() : buffer.current + key.toLowerCase();
    lastAt.current = now;
    const list = texts();
    for (let offset = buffer.current.length === 1 ? 1 : 0; offset <= list.length; offset += 1) {
      const index = (Math.max(current, 0) + offset) % Math.max(list.length, 1);
      if (list[index]?.toLowerCase().startsWith(buffer.current) === true) {
        choose(index);
        return true;
      }
    }
    return true;
  };
}
