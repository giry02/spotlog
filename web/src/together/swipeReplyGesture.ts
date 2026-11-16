export const SWIPE_REPLY_THRESHOLD = 56;
export const SWIPE_REPLY_MAX_OFFSET = 64;
export const SWIPE_REPLY_AXIS_SLOP = 8;
export const MESSAGE_HOLD_DELAY_MS = 450;
export const MESSAGE_HOLD_MOVE_SLOP = 8;
const HORIZONTAL_DOMINANCE = 1.4;

export interface SwipeReplyTarget {
  tagName: string;
  role?: string | null;
  editable?: boolean;
  focusable?: boolean;
  ignore?: boolean;
  surface?: boolean;
  sticker?: boolean;
}
const interactiveTags = new Set(['A', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'LABEL', 'SUMMARY', 'DETAILS', 'VIDEO', 'AUDIO', 'IFRAME', 'CANVAS', 'SVG', 'BLOCKQUOTE']);
const interactiveRoles = new Set(['button', 'link', 'checkbox', 'radio', 'switch', 'textbox', 'combobox', 'listbox', 'option', 'slider', 'spinbutton', 'tab', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'treeitem']);

/** Target first, then its ancestors up to (excluding) the swipe wrapper. */
export function canStartSwipeReplyOnTargetPath(path: readonly SwipeReplyTarget[]): boolean {
  if (!path.length) return false;
  let optedSurface = false, needsStickerSurface = false;
  for (const target of path) {
    const tag = target.tagName.toUpperCase();
    const optedButton = tag === 'BUTTON' && target.surface === true;
    if (target.ignore || target.editable) return false;
    if (tag === 'IMG' || tag === 'PICTURE') {
      if (tag !== 'IMG' || !target.sticker) return false;
      needsStickerSurface = true;
    }
    if (target.role?.split(/\s+/).some(role => interactiveRoles.has(role.toLowerCase()) && (!optedButton || role.toLowerCase() !== 'button'))) return false;
    if (!optedButton && (interactiveTags.has(tag) || target.focusable)) return false;
    if (optedButton || tag === 'DIV' && target.surface === true) optedSurface = true;
  }
  return !needsStickerSurface || optedSurface;
}

export interface SwipeReplyPoint { pointerId: number; x: number; y: number }
export interface SwipeReplyStart extends SwipeReplyPoint {
  enabled: boolean;
  targetAllowed: boolean;
  pointerType: string;
  isPrimary: boolean;
  button: number;
}
export interface SwipeReplyGesture {
  pointerId: number;
  startX: number;
  startY: number;
  phase: 'PENDING' | 'DRAGGING' | 'BLOCKED';
  offset: number;
  dragged: boolean;
  crossed: boolean;
}
const validPoint = (point: SwipeReplyPoint) => Number.isInteger(point.pointerId) && point.pointerId >= 0 && Number.isFinite(point.x) && Number.isFinite(point.y);

export function beginSwipeReplyGesture(input: SwipeReplyStart): SwipeReplyGesture | null {
  if (!input.enabled || !input.targetAllowed || !input.isPrimary || input.button !== 0 || !['touch', 'pen'].includes(input.pointerType) || !validPoint(input)) return null;
  return { pointerId: input.pointerId, startX: input.x, startY: input.y, phase: 'PENDING', offset: 0, dragged: false, crossed: false };
}

export function moveSwipeReplyGesture(gesture: SwipeReplyGesture | null, point: SwipeReplyPoint, enabled = true): SwipeReplyGesture | null {
  if (!gesture || !enabled) return null;
  if (point.pointerId !== gesture.pointerId) return gesture;
  if (!validPoint(point)) return { ...gesture, phase: 'BLOCKED', offset: 0 };
  if (gesture.phase === 'BLOCKED') return gesture;
  const dx = point.x - gesture.startX, dy = Math.abs(point.y - gesture.startY);
  if (dx <= -SWIPE_REPLY_AXIS_SLOP || dy >= SWIPE_REPLY_AXIS_SLOP && dy * HORIZONTAL_DOMINANCE >= Math.max(dx, 0)) return { ...gesture, phase: 'BLOCKED', offset: 0 };
  if (gesture.phase === 'PENDING' && (dx < SWIPE_REPLY_AXIS_SLOP || dx < dy * HORIZONTAL_DOMINANCE)) return gesture;
  const offset = Math.min(SWIPE_REPLY_MAX_OFFSET, Math.max(0, dx));
  return { ...gesture, phase: 'DRAGGING', offset, dragged: true, crossed: gesture.crossed || offset >= SWIPE_REPLY_THRESHOLD };
}

/** Clear the returned gesture before invoking the callback so one pointer can reply only once. */
export function finishSwipeReplyGesture(gesture: SwipeReplyGesture | null, pointerId: number, enabled = true) {
  if (!gesture || pointerId !== gesture.pointerId) return { gesture, reply: false, suppressClick: false };
  return { gesture: null, reply: enabled && gesture.phase === 'DRAGGING' && gesture.offset >= SWIPE_REPLY_THRESHOLD, suppressClick: gesture.dragged };
}

export interface MessageHoldGesture {
  pointerId: number;
  startX: number;
  startY: number;
  startedAt: number;
  phase: 'WAITING' | 'CANCELLED' | 'FIRED';
}

/** Same opted-in touch/pen surface as swipe reply. A hold never sends or replies. */
export function beginMessageHoldGesture(input: SwipeReplyStart, at: number): MessageHoldGesture | null {
  if (!Number.isFinite(at) || !beginSwipeReplyGesture(input)) return null;
  return { pointerId: input.pointerId, startX: input.x, startY: input.y, startedAt: at, phase: 'WAITING' };
}

/** Once a finger moves out of the small stationary area it cannot become a hold again. */
export function moveMessageHoldGesture(hold: MessageHoldGesture | null, point: SwipeReplyPoint, enabled = true): MessageHoldGesture | null {
  if (!hold || !enabled) return null;
  if (point.pointerId !== hold.pointerId || hold.phase !== 'WAITING') return hold;
  if (!validPoint(point) || Math.hypot(point.x - hold.startX, point.y - hold.startY) > MESSAGE_HOLD_MOVE_SLOP) return { ...hold, phase: 'CANCELLED' };
  return hold;
}

/** Timer callers must clear this record on pointer-up, scroll, scope change and unmount. */
export function fireMessageHoldGesture(hold: MessageHoldGesture | null, at: number, enabled = true) {
  if (!hold || !enabled || hold.phase !== 'WAITING' || !Number.isFinite(at) || at - hold.startedAt < MESSAGE_HOLD_DELAY_MS) return { hold: enabled ? hold : null, open: false };
  return { hold: { ...hold, phase: 'FIRED' as const }, open: true };
}
