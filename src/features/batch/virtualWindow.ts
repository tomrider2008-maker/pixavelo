export interface VirtualWindow {
  readonly start: number;
  readonly end: number;
  readonly before: number;
  readonly after: number;
}

export function calculateVirtualWindow(
  itemCount: number,
  rowHeight: number,
  viewportHeight: number,
  scrollTop: number,
  overscan = 4
): VirtualWindow {
  if (itemCount <= 0 || rowHeight <= 0 || viewportHeight <= 0) {
    return { start: 0, end: 0, before: 0, after: 0 };
  }
  const visibleStart = Math.floor(Math.max(0, scrollTop) / rowHeight);
  const visibleCount = Math.ceil(viewportHeight / rowHeight);
  const start = Math.max(0, visibleStart - overscan);
  const end = Math.min(itemCount, visibleStart + visibleCount + overscan);
  return {
    start,
    end,
    before: start * rowHeight,
    after: Math.max(0, (itemCount - end) * rowHeight)
  };
}
