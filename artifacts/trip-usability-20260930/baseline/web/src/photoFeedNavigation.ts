export type SwipeAxis = 'x' | 'y';

export function swipeAxis(dx: number, dy: number): SwipeAxis | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return null;
  if (Math.abs(dx) > Math.abs(dy) * 1.15) return 'x';
  if (Math.abs(dy) > Math.abs(dx) * 1.15) return 'y';
  return null;
}

export function swipeStep(distance: number, extent: number, elapsed: number): number {
  const moved = Math.abs(distance);
  const threshold = Math.min(80, Math.max(36, extent * .14));
  return moved >= threshold || (moved >= 20 && moved / Math.max(1, elapsed) > .5)
    ? distance < 0 ? 1 : -1 : 0;
}

export function wrapPlace(index: number, count: number): number {
  return count > 0 ? ((index % count) + count) % count : 0;
}

/** The first and last slots are visual copies for a continuous boundary swipe. */
export function realSlot(slot: number, count: number): number {
  return count > 1 ? wrapPlace(slot - 1, count) + 1 : 0;
}
