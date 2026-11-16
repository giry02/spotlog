import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { Reply } from 'lucide-react';
import { beginMessageHoldGesture, beginSwipeReplyGesture, canStartSwipeReplyOnTargetPath, finishSwipeReplyGesture, fireMessageHoldGesture, MESSAGE_HOLD_DELAY_MS, moveMessageHoldGesture, moveSwipeReplyGesture, SWIPE_REPLY_THRESHOLD, type MessageHoldGesture, type SwipeReplyGesture, type SwipeReplyTarget } from './swipeReplyGesture';
import './swipe-reply.css';

export interface SwipeReplyProps {
  children: ReactNode;
  /** Current room/member/message permission. The caller also rechecks in onReply. */
  enabled: boolean;
  /** Include account, room and message identity; changing scope cancels a pending gesture. */
  resetKey: string | number;
  onReply: () => void;
  /** Open current message actions; the caller rechecks permission. Also used for desktop right-click. */
  onLongPress?: () => void;
  className?: string;
}

function targetPath(target: EventTarget | null, wrapper: HTMLElement): SwipeReplyTarget[] {
  const path: SwipeReplyTarget[] = [];
  let element = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
  while (element && element !== wrapper) {
    path.push({ tagName: element.tagName, role: element.getAttribute('role'), editable: element instanceof HTMLElement && element.isContentEditable,
      focusable: element.hasAttribute('tabindex') && Number(element.getAttribute('tabindex')) >= 0,
      ignore: element.hasAttribute('data-swipe-reply-ignore'), surface: element.hasAttribute('data-swipe-reply-surface') && element.getAttribute('data-swipe-reply-surface') !== 'false', sticker: element.hasAttribute('data-swipe-reply-sticker') && element.getAttribute('data-swipe-reply-sticker') !== 'false' });
    element = element.parentElement;
  }
  return element === wrapper ? path : [];
}

/** Touch/pen enhancement only. Keep the existing accessible Reply button in the caller. */
export default function SwipeReply({ children, enabled, resetKey, onReply, onLongPress, className = '' }: SwipeReplyProps) {
  const wrapper = useRef<HTMLDivElement>(null), gesture = useRef<SwipeReplyGesture | null>(null);
  const hold = useRef<MessageHoldGesture | null>(null), holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const consumedPointer = useRef<number | null>(null);
  const sessionCleanup = useRef<(() => void) | null>(null), ignoredPointerStart = useRef<number | null>(null);
  const scopeAtStart = useRef(resetKey), suppressPointerClick = useRef(false);
  const currentProps = useRef({ enabled, resetKey, onReply, onLongPress });
  currentProps.current = { enabled, resetKey, onReply, onLongPress };
  const [offset, setOffset] = useState(0);
  const [held, setHeld] = useState(false);
  const release = (id: number) => { try { if (wrapper.current?.hasPointerCapture(id)) wrapper.current.releasePointerCapture(id); } catch { /* The browser may already have cancelled native scrolling. */ } };
  const clearHold = () => {
    if (holdTimer.current !== null) clearTimeout(holdTimer.current);
    holdTimer.current = null; hold.current = null;
  };
  const stopSession = () => { sessionCleanup.current?.(); sessionCleanup.current = null; };
  const cancel = () => {
    const active = gesture.current, heldPointer = consumedPointer.current; gesture.current = null;
    clearHold(); stopSession();
    if (active?.dragged || heldPointer !== null) suppressPointerClick.current = true;
    consumedPointer.current = null; setHeld(false);
    if (heldPointer !== null) release(heldPointer);
    if (active) release(active.pointerId);
    setOffset(0);
  };
  useLayoutEffect(() => { cancel(); }, [enabled, resetKey]);
  const startSession = () => {
    stopSession();
    const extraPointer = (event: globalThis.PointerEvent) => {
      const activeId = gesture.current?.pointerId ?? consumedPointer.current;
      if (activeId !== null && activeId !== undefined && event.pointerId !== activeId) { ignoredPointerStart.current = event.pointerId; cancel(); }
    };
    const holdMove = (event: globalThis.PointerEvent) => {
      if (!hold.current || event.pointerId !== hold.current.pointerId) return;
      hold.current = moveMessageHoldGesture(hold.current, { pointerId: event.pointerId, x: event.clientX, y: event.clientY });
      if (hold.current?.phase !== 'WAITING') clearHold();
    };
    const pointerEnd = (event: globalThis.PointerEvent) => {
      const activeId = gesture.current?.pointerId ?? consumedPointer.current;
      if (event.pointerId !== activeId) return;
      if (event.pointerId === hold.current?.pointerId) clearHold();
      if (event.pointerId === consumedPointer.current) {
        suppressPointerClick.current = true;
        consumedPointer.current = null; setHeld(false); release(event.pointerId);
      }
      if (event.pointerId === gesture.current?.pointerId && (event.type === 'pointercancel' || !(event.target instanceof Node) || !wrapper.current?.contains(event.target))) cancel();
      else stopSession();
    };
    const scroll = () => { if (gesture.current || hold.current || consumedPointer.current !== null) cancel(); };
    window.addEventListener('pointerdown', extraPointer, true); window.addEventListener('pointermove', holdMove, true);
    window.addEventListener('pointerup', pointerEnd, true); window.addEventListener('pointercancel', pointerEnd, true);
    window.addEventListener('scroll', scroll, true);
    sessionCleanup.current = () => {
      window.removeEventListener('pointerdown', extraPointer, true); window.removeEventListener('pointermove', holdMove, true);
      window.removeEventListener('pointerup', pointerEnd, true); window.removeEventListener('pointercancel', pointerEnd, true);
      window.removeEventListener('scroll', scroll, true);
    };
  };
  useEffect(() => {
    const blur = () => cancel();
    const visibility = () => { if (document.hidden) cancel(); };
    window.addEventListener('blur', blur); document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', visibility);
      clearHold(); stopSession();
      const active = gesture.current, heldPointer = consumedPointer.current; gesture.current = null; consumedPointer.current = null;
      if (active) release(active.pointerId);
      if (heldPointer !== null) release(heldPointer);
    };
  }, []);
  const point = (event: PointerEvent<HTMLDivElement>) => ({ pointerId: event.pointerId, x: event.clientX, y: event.clientY });
  const down = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerId === ignoredPointerStart.current) { ignoredPointerStart.current = null; return; }
    if (gesture.current || consumedPointer.current !== null) { cancel(); return; }
    const input = { ...point(event), enabled, targetAllowed: canStartSwipeReplyOnTargetPath(targetPath(event.target, event.currentTarget)), pointerType: event.pointerType, isPrimary: event.isPrimary, button: event.button };
    if (input.targetAllowed && input.isPrimary && (input.button === 0 || input.pointerType === 'mouse' && input.button === 2)) suppressPointerClick.current = false;
    gesture.current = beginSwipeReplyGesture(input);
    if (!gesture.current) return;
    setHeld(false);
    scopeAtStart.current = resetKey;
    startSession();
    if (onLongPress) {
      hold.current = beginMessageHoldGesture(input, performance.now());
      const fire = () => {
        holdTimer.current = null;
        const props = currentProps.current;
        const result = fireMessageHoldGesture(hold.current, performance.now(), props.enabled && props.resetKey === scopeAtStart.current && !!props.onLongPress);
        hold.current = result.hold;
        if (!result.open) {
          if (result.hold?.phase === 'WAITING') holdTimer.current = setTimeout(fire, Math.max(1, MESSAGE_HOLD_DELAY_MS - (performance.now() - result.hold.startedAt)));
          return;
        }
        const active = gesture.current; gesture.current = null;
        if (!active) { clearHold(); return; }
        consumedPointer.current = active.pointerId; suppressPointerClick.current = true;
        setOffset(0); setHeld(true);
        try { wrapper.current?.setPointerCapture(active.pointerId); } catch { /* Capture may be unavailable to synthetic events. */ }
        props.onLongPress?.();
      };
      holdTimer.current = setTimeout(fire, MESSAGE_HOLD_DELAY_MS);
    }
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (!gesture.current || event.pointerId !== gesture.current.pointerId) return;
    const next = moveSwipeReplyGesture(gesture.current, point(event), enabled && scopeAtStart.current === resetKey);
    gesture.current = next; setOffset(next?.offset || 0);
    hold.current = moveMessageHoldGesture(hold.current, point(event), enabled && scopeAtStart.current === resetKey);
    if (hold.current?.phase !== 'WAITING' || next?.phase !== 'PENDING') clearHold();
    if (next?.phase === 'DRAGGING') {
      if (event.cancelable) event.preventDefault();
      try { if (!event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Pointer capture is optional for synthetic/test events. */ }
    }
  };
  const up = (event: PointerEvent<HTMLDivElement>) => {
    clearHold();
    if (!gesture.current || event.pointerId !== gesture.current.pointerId) return;
    const current = moveSwipeReplyGesture(gesture.current, point(event), enabled && scopeAtStart.current === resetKey);
    const result = finishSwipeReplyGesture(current, event.pointerId, enabled && scopeAtStart.current === resetKey);
    gesture.current = result.gesture; setOffset(0);
    if (result.suppressClick) suppressPointerClick.current = true;
    release(event.pointerId);
    if (result.reply) currentProps.current.onReply();
  };
  return <div ref={wrapper} className={`tg-swipe-reply ${className}`.trim()} data-swiping={offset > 0 ? 'true' : undefined} data-held={held ? 'true' : undefined} data-reply-ready={offset >= SWIPE_REPLY_THRESHOLD ? 'true' : undefined} style={{ '--swipe-reply-offset': `${offset}px`, '--swipe-reply-progress': Math.min(1, offset / SWIPE_REPLY_THRESHOLD) } as CSSProperties}
    onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={event => { if (event.pointerId === gesture.current?.pointerId || event.pointerId === consumedPointer.current) cancel(); }} onLostPointerCapture={event => { if (event.pointerId === gesture.current?.pointerId || event.pointerId === consumedPointer.current) cancel(); }}
    onContextMenu={event => {
      if (!enabled || !onLongPress || !canStartSwipeReplyOnTargetPath(targetPath(event.target, event.currentTarget))) return;
      event.preventDefault(); event.stopPropagation();
      if (consumedPointer.current !== null || suppressPointerClick.current) return;
      if (gesture.current) return; // A touch/pen menu belongs to the stationary hold timer, never a second callback.
      cancel(); suppressPointerClick.current = true; currentProps.current.onLongPress?.();
    }}
    onClickCapture={event => { if (event.detail !== 0 && (consumedPointer.current !== null || suppressPointerClick.current)) { event.preventDefault(); event.stopPropagation(); } }}>
    <span className="tg-swipe-reply-indicator" aria-hidden="true"><Reply size={18}/></span><div className="tg-swipe-reply-content">{children}</div>
  </div>;
}
