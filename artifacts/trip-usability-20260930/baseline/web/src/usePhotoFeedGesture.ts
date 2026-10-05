import { useRef, type MouseEvent, type PointerEvent, type RefObject } from 'react';
import { swipeAxis, swipeStep, type SwipeAxis } from './photoFeedNavigation';

type Gesture = { id: number; x: number; y: number; at: number; dx: number; dy: number;
  axis: SwipeAxis | null; top: number; left: number; track: HTMLElement; photo: number };

/** One pointer owns one axis; touch and mouse use the same snapping path. */
export function usePhotoFeedGesture(feedRef: RefObject<HTMLDivElement | null>, onPlace: (step: number) => void,
  onPhoto: (index: number) => void, isBlocked: () => boolean, beforeStart: () => void) {
  const gesture = useRef<Gesture | null>(null);
  const suppressClick = useRef(false);
  const finish = (event: PointerEvent<HTMLDivElement>, cancel = false) => {
    const current = gesture.current;
    const feed = feedRef.current;
    if (!current || !feed || current.id !== event.pointerId) return;
    gesture.current = null;
    delete feed.dataset.gestureAxis;
    if (feed.hasPointerCapture(current.id)) feed.releasePointerCapture(current.id);
    if (!current.axis) return;
    const elapsed = performance.now() - current.at;
    if (current.axis === 'x') onPhoto(current.photo + (cancel ? 0 : swipeStep(current.dx, current.track.clientWidth, elapsed)));
    else onPlace(cancel ? 0 : swipeStep(current.dy, feed.clientHeight, elapsed));
  };
  return {
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      if (!event.isPrimary || event.button !== 0 || isBlocked()) return;
      const target = event.target as HTMLElement;
      if (target.closest('button,a,input,textarea,select,[contenteditable="true"]')) return;
      beforeStart();
      const feed = feedRef.current;
      const slot = feed?.clientHeight ? Math.round(feed.scrollTop / feed.clientHeight) : 0;
      const track = feed?.children[slot]?.querySelector<HTMLElement>('.photo-reel-track');
      if (!feed || !track) return;
      suppressClick.current = false;
      gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, at: performance.now(),
        dx: 0, dy: 0, axis: null, top: feed.scrollTop, left: track.scrollLeft, track,
        photo: Number(track.dataset.photoIndex ?? 0) };
      feed.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
      const current = gesture.current;
      const feed = feedRef.current;
      if (!current || !feed || current.id !== event.pointerId) return;
      current.dx = event.clientX - current.x;
      current.dy = event.clientY - current.y;
      current.axis ??= swipeAxis(current.dx, current.dy);
      if (!current.axis) return;
      suppressClick.current = true;
      feed.dataset.gestureAxis = current.axis;
      event.preventDefault();
      if (current.axis === 'x') current.track.scrollLeft = current.left - current.dx;
      else feed.scrollTop = current.top - current.dy;
    },
    onPointerUp: (event: PointerEvent<HTMLDivElement>) => finish(event),
    onPointerCancel: (event: PointerEvent<HTMLDivElement>) => finish(event, true),
    onLostPointerCapture: (event: PointerEvent<HTMLDivElement>) => finish(event, true),
    onClickCapture: (event: MouseEvent<HTMLDivElement>) => {
      if (suppressClick.current && event.detail !== 0) {
        suppressClick.current = false;
        event.preventDefault(); event.stopPropagation();
      }
    },
  };
}
