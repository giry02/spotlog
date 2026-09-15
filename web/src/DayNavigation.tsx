import { ArrowLeft, MoveHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { JourneyDay } from './data';

export function DayNavigation({ days, selectedDay, onSelect, onBack }: {
  days: JourneyDay[]; selectedDay: number; onSelect: (day: number) => void; onBack: () => void;
}) {
  const navRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerId: number; x: number; scrollLeft: number } | null>(null);
  const dragged = useRef(false);
  const hinted = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const mouseHint = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  useEffect(() => {
    const nav = navRef.current;
    const track = trackRef.current;
    if (!nav || !track) return;
    let visible = false;
    const offerHint = () => {
      if (visible && track.scrollWidth > track.clientWidth + 1 && !hinted.current) {
        hinted.current = true;
        setShowHint(true);
      }
    };
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio >= 0.7;
      offerHint();
    }, { threshold: [0, 0.7] });
    const resize = new ResizeObserver(offerHint);
    intersection.observe(nav);
    resize.observe(track);
    return () => { intersection.disconnect(); resize.disconnect(); };
  }, []);

  useEffect(() => {
    if (!showHint) return;
    const timer = window.setTimeout(() => setShowHint(false), 3000);
    return () => window.clearTimeout(timer);
  }, [showHint]);

  const reveal = (button: HTMLElement) => {
    const track = trackRef.current;
    if (!track) return;
    const viewport = track.getBoundingClientRect();
    const bounds = button.getBoundingClientRect();
    if (bounds.left < viewport.left) track.scrollLeft += bounds.left - viewport.left;
    else if (bounds.right > viewport.right) track.scrollLeft += bounds.right - viewport.right;
  };

  useEffect(() => {
    const button = trackRef.current?.querySelector<HTMLElement>(`[data-day="${selectedDay}"]`);
    if (button) reveal(button);
  }, [selectedDay, days]);

  const endDrag = () => { drag.current = null; setDragging(false); };

  return <nav ref={navRef} className="day-tabs day-tabs-draggable" aria-label="여행 날짜">
    <button type="button" className="day-tabs-back" onClick={onBack} aria-label="목록으로 돌아가기"><ArrowLeft size={20} /></button>
    <div ref={trackRef} className={`day-tabs-track${dragging ? ' is-dragging' : ''}`}
      onPointerDown={(event) => {
        hinted.current = true;
        setShowHint(false);
        dragged.current = false;
        if (event.pointerType !== 'mouse' || event.button !== 0) return;
        drag.current = { pointerId: event.pointerId, x: event.clientX, scrollLeft: event.currentTarget.scrollLeft };
      }}
      onPointerMove={(event) => {
        const start = drag.current;
        if (!start || start.pointerId !== event.pointerId) return;
        const distance = event.clientX - start.x;
        if (!dragged.current && Math.abs(distance) < 5) return;
        if (!dragged.current) {
          dragged.current = true;
          setDragging(true);
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        event.preventDefault();
        event.currentTarget.scrollLeft = start.scrollLeft - distance;
      }}
      onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}
      onPointerLeave={() => { if (!dragged.current) endDrag(); }}
      onClickCapture={(event) => {
        // A drag beginning on a date must not select that date on release.
        if (dragged.current && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); }
      }}
      onDragStart={(event) => event.preventDefault()}
      onFocus={(event) => reveal(event.target)}
      onKeyDown={(event) => {
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-day]')];
        const index = buttons.indexOf(event.target as HTMLButtonElement);
        if (index < 0) return;
        const next = event.key === 'ArrowRight' ? Math.min(index + 1, buttons.length - 1)
          : event.key === 'ArrowLeft' ? Math.max(index - 1, 0)
          : event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : -1;
        if (next < 0) return;
        event.preventDefault();
        buttons[next]?.focus({ preventScroll: true });
        if (buttons[next]) { reveal(buttons[next]); onSelect(Number(buttons[next].dataset.day)); }
      }}>
      {days.map((day) => <button type="button" key={day.day} data-day={day.day}
        className={selectedDay === day.day ? 'active' : ''} aria-current={selectedDay === day.day ? 'page' : undefined}
        onClick={() => onSelect(day.day)}><small>DAY {day.day}</small><strong>{day.date}</strong></button>)}
    </div>
    {showHint && <span className="day-swipe-hint" role="status"><MoveHorizontal size={18} aria-hidden="true" />{mouseHint ? '드래그해서 날짜 보기' : '좌우로 밀어 날짜 보기'}</span>}
  </nav>;
}
