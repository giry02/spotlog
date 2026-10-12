import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { JourneyDay, Place } from './data';
import { canDragPlanVisit, planVisitGroups } from './tripPlan';

type Options = {
  day: JourneyDay | undefined;
  enabled: boolean;
  en: boolean;
  onDrop: (visitId: string, beforeVisitId: string | null) => void;
  onStep: (visitId: string, direction: -1 | 1) => void;
};
type Preview = { visitIds: string[]; before: string | null; valid: boolean; label: string; left: number; top: number; width: number };
type Gesture = { pointerId: number; visitId: string; x: number; y: number; startX: number; startY: number; active: boolean; handle: HTMLButtonElement; list: HTMLElement; scroll: HTMLElement; groups: Place[][]; before: string | null; valid: boolean };

function scrollParent(element: HTMLElement): HTMLElement {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY) && parent.scrollHeight > parent.clientHeight) return parent;
  }
  return document.scrollingElement as HTMLElement;
}

function visibleViewport(current: Gesture) {
  const bounds = current.scroll === document.scrollingElement ? { top: 0, bottom: innerHeight } : current.scroll.getBoundingClientRect();
  let top = bounds.top;
  current.list.closest('.personal-trip')?.querySelectorAll<HTMLElement>('.editor-topbar, .day-tabs').forEach(element => {
    const box = element.getBoundingClientRect();
    if (box.top <= top + 2 && box.bottom > top) top = box.bottom;
  });
  return { top, bottom: bounds.bottom };
}

/** Pointer capture works for mouse, pen and touch; only the handle prevents normal page scrolling. */
export function usePlanDragOrder(options: Options) {
  const latest = useRef(options);
  latest.current = options;
  const gesture = useRef<Gesture | null>(null);
  const frame = useRef(0);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [announcement, setAnnouncement] = useState('');
  // Cancel if an incoming update changes the group's links, reservations or visit timing.
  const identity = `${options.enabled}:${options.day?.dayId}:${JSON.stringify(options.day?.places.map(({ visitId, anchorVisitId, kind, bookingFixed, time, planningSlot, stayDayIds }) => [visitId, anchorVisitId, kind, bookingFixed, time, planningSlot, stayDayIds]))}`;

  useEffect(() => {
    const cancel = () => {
      const current = gesture.current;
      gesture.current = null;
      cancelAnimationFrame(frame.current);
      if (current?.handle.hasPointerCapture(current.pointerId)) current.handle.releasePointerCapture(current.pointerId);
      setPreview(null);
      if (current?.active) setAnnouncement(latest.current.en ? 'Reordering cancelled.' : '순서 변경을 취소했어요.');
    };
    const locate = (current: Gesture) => {
      const sourceIndex = current.groups.findIndex(group => group.some(place => place.visitId === current.visitId));
      const barrier = (group: Place[]) => group.some(place => place.kind === 'STAY' || place.bookingFixed);
      let first = sourceIndex, last = sourceIndex;
      while (first > 0 && !barrier(current.groups[first - 1])) first--;
      while (last + 1 < current.groups.length && !barrier(current.groups[last + 1])) last++;
      const groups = current.groups.slice(first, last + 1).filter(group => !group.some(place => place.visitId === current.visitId));
      const box = current.list.getBoundingClientRect();
      const viewport = visibleViewport(current);
      current.valid = current.x >= box.left - 12 && current.x <= box.right + 12 && current.y >= Math.max(box.top, viewport.top) && current.y <= Math.min(box.bottom, viewport.bottom);
      current.before = current.groups[last + 1]?.[0].visitId ?? null;
      for (const group of groups) {
        const cards = group.map(place => current.list.querySelector<HTMLElement>(`[data-plan-visit="${CSS.escape(place.visitId!)}"]`)).filter((element): element is HTMLElement => Boolean(element));
        if (!cards.length) continue;
        const top = cards[0].getBoundingClientRect().top;
        const bottom = cards.at(-1)!.getBoundingClientRect().bottom;
        if (current.y < (top + bottom) / 2) { current.before = group[0].visitId!; break; }
      }
      const source = current.groups[sourceIndex];
      const label = source.length > 1 ? latest.current.en ? `${source[0].name} + ${source.length - 1} linked stops` : `${source[0].name} 외 ${source.length - 1}곳 함께 이동` : source[0].name;
      const width = Math.min(260, box.width - 16);
      setPreview({ visitIds: source.map(place => place.visitId!), before: current.before, valid: current.valid,
        label: current.valid ? label : latest.current.en ? 'Drop inside the list.' : '카드 목록 안에 놓아주세요.',
        left: box.left + (box.width - width) / 2, top: Math.min(Math.max(viewport.top + 8, current.y + 18), viewport.bottom - 70), width });
    };
    let previousTime = 0;
    const tick = (time: number) => {
      const current = gesture.current;
      if (!current?.active) return;
      const box = visibleViewport(current);
      const edge = 60;
      const speed = current.y < box.top + edge ? -Math.min(1, Math.max(0, (box.top + edge - current.y) / edge)) : current.y > box.bottom - edge ? Math.min(1, Math.max(0, (current.y - box.bottom + edge) / edge)) : 0;
      const bounds = current.list.getBoundingClientRect();
      if (speed && current.x >= bounds.left - 12 && current.x <= bounds.right + 12) current.scroll.scrollTop += speed * Math.min(32, previousTime ? time - previousTime : 16) * .7;
      previousTime = time;
      locate(current);
      frame.current = requestAnimationFrame(tick);
    };
    const move = (event: PointerEvent) => {
      const current = gesture.current;
      if (!current || event.pointerId !== current.pointerId) return;
      current.x = event.clientX; current.y = event.clientY;
      if (!current.active && Math.hypot(current.x - current.startX, current.y - current.startY) < 6) return;
      if (event.cancelable) event.preventDefault();
      if (!current.active) { current.active = true; previousTime = 0; frame.current = requestAnimationFrame(tick); }
      locate(current);
    };
    const end = (event: PointerEvent) => {
      const current = gesture.current;
      if (!current || event.pointerId !== current.pointerId) return;
      current.x = event.clientX; current.y = event.clientY;
      if (current.active) locate(current);
      const apply = current.active && current.valid;
      gesture.current = null;
      cancelAnimationFrame(frame.current);
      if (current.handle.hasPointerCapture(current.pointerId)) current.handle.releasePointerCapture(current.pointerId);
      setPreview(null);
      if (apply) latest.current.onDrop(current.visitId, current.before);
      else if (current.active) setAnnouncement(latest.current.en ? 'Reordering cancelled.' : '순서 변경을 취소했어요.');
    };
    const pointerCancel = (event: PointerEvent) => { if (gesture.current?.pointerId === event.pointerId) cancel(); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape' && gesture.current) { event.preventDefault(); cancel(); } };
    document.addEventListener('pointermove', move, { passive: false });
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', pointerCancel);
    document.addEventListener('lostpointercapture', pointerCancel);
    document.addEventListener('keydown', key);
    window.addEventListener('blur', cancel);
    return () => {
      document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', end);
      document.removeEventListener('pointercancel', pointerCancel); document.removeEventListener('lostpointercapture', pointerCancel); document.removeEventListener('keydown', key);
      window.removeEventListener('blur', cancel); cancel();
    };
  }, [identity]);

  const start = (event: ReactPointerEvent<HTMLButtonElement>, visitId: string) => {
    const { day, enabled } = latest.current;
    if (!enabled || !day || gesture.current || !event.isPrimary || event.button !== 0 || !canDragPlanVisit(day, visitId)) return;
    const list = event.currentTarget.closest<HTMLElement>('.plan-stops');
    if (!list) return;
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { pointerId: event.pointerId, visitId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY,
      active: false, handle: event.currentTarget, list, scroll: scrollParent(list), groups: planVisitGroups(day), before: null, valid: false };
    setAnnouncement('');
  };
  const keyboard = (event: ReactKeyboardEvent<HTMLButtonElement>, visitId: string) => {
    if (!latest.current.enabled || gesture.current || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault(); latest.current.onStep(visitId, event.key === 'ArrowUp' ? -1 : 1);
  };
  return { preview, announcement, start, keyboard };
}
