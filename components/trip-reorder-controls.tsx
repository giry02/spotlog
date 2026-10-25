'use client';
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { ArrowDown, ArrowUp, GripVertical, LockKeyhole, ListOrdered } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { visitName, type TripAction, type TripState } from '@/lib/trip-engine';
import { finishVisitOrderGesture, proposedVisitOrder, visitOrderGroups, visitOrderIdentity, type VisitOrderGroup } from '@/lib/trip-reorder';
import './trip-reorder-controls.css';

type Gesture = { pointerId: number | null; source: string; handle: HTMLButtonElement; identity: string; ids: string[]; startX: number; startY: number; x: number; y: number; active: boolean; valid: boolean };
export function TripReorderControls({ state, day = state.activeDay, act, disabled = false }: { state: TripState; day?: number; act: (action: TripAction) => void; disabled?: boolean }) {
  const root = useRef<HTMLDivElement>(null), list = useRef<HTMLOListElement>(null), scroll = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false), [container, setContainer] = useState<HTMLElement | null>(null);
  const [preview, setPreview] = useState<string[] | null>(null), [source, setSource] = useState<string | null>(null), [message, setMessage] = useState('');
  const gesture = useRef<Gesture | null>(null), frame = useRef(0), latest = useRef({ state, day, act, disabled });
  latest.current = { state, day, act, disabled };
  const identity = visitOrderIdentity(state, day);
  let groups: VisitOrderGroup[] = [], issue = '';
  try { groups = visitOrderGroups(state.plan, day); }
  catch (error) { issue = error instanceof Error ? error.message : '방문을 확인해 주세요.'; }
  const baseIds = groups.flatMap(group => group.visits.map(visit => visit.id));
  const canEdit = groups.some((group, index) => !group.fixed && ((!groups[index - 1]?.fixed && index > 0) || (!groups[index + 1]?.fixed && index < groups.length - 1)));
  const positions = new Map((preview ?? baseIds).map((id, index) => [id, index]));
  const displayed = [...groups].sort((a, b) => (positions.get(a.id) ?? 0) - (positions.get(b.id) ?? 0));
  const displayPositions = new Map(displayed.map((group, index) => [group.id, index]));

  function cancel(announce = true) {
    const current = gesture.current; gesture.current = null;
    cancelAnimationFrame(frame.current);
    if (current?.pointerId !== null && current?.handle.hasPointerCapture(current.pointerId)) current.handle.releasePointerCapture(current.pointerId);
    setPreview(null); setSource(null);
    if (announce && current?.active) setMessage('순서 변경을 취소했어요. 일정은 그대로예요.');
  }
  function finish(inside: boolean) {
    const current = gesture.current;
    if (!current) return;
    const action = finishVisitOrderGesture(latest.current.state, latest.current.day, current.identity, current.ids, current.active ? 'drop' : 'cancel', inside && current.valid && !latest.current.disabled);
    cancel(false);
    if (action) { setOpen(false); latest.current.act(action); }
    else setMessage('순서 변경을 적용하지 않았어요. 일정은 그대로예요.');
  }
  function locate(current: Gesture) {
    const listElement = list.current, scrollElement = scroll.current;
    if (!listElement || !scrollElement) return;
    const bounds = listElement.getBoundingClientRect(), viewport = scrollElement.getBoundingClientRect();
    current.valid = current.x >= bounds.left && current.x <= bounds.right && current.y >= Math.max(bounds.top, viewport.top) && current.y <= Math.min(bounds.bottom, viewport.bottom);
    const currentGroups = visitOrderGroups(latest.current.state.plan, latest.current.day);
    const sourceIndex = currentGroups.findIndex(group => group.id === current.source);
    let first = sourceIndex, last = sourceIndex;
    while (first > 0 && !currentGroups[first - 1].fixed) first--;
    while (last + 1 < currentGroups.length && !currentGroups[last + 1].fixed) last++;
    const row = (id: string) => listElement.querySelector<HTMLElement>(`[data-order-group="${CSS.escape(id)}"]`);
    const previousBarrier = currentGroups[first - 1], nextBarrier = currentGroups[last + 1];
    if (previousBarrier && current.y < (row(previousBarrier.id)?.getBoundingClientRect().bottom ?? -Infinity) || nextBarrier && current.y > (row(nextBarrier.id)?.getBoundingClientRect().top ?? Infinity)) current.valid = false;
    const candidates = [...currentGroups].filter(group => group.id !== current.source).sort((a, b) => (row(a.id)?.getBoundingClientRect().top ?? 0) - (row(b.id)?.getBoundingClientRect().top ?? 0));
    const before = candidates.find(group => { const box = row(group.id)?.getBoundingClientRect(); return box && current.y < (box.top + box.bottom) / 2; })?.id ?? null;
    try {
      const ids = proposedVisitOrder(latest.current.state.plan, latest.current.day, current.source, before);
      if (current.valid) { current.ids = ids; setPreview(ids); }
    } catch { current.valid = false; }
    setMessage(current.valid ? '연결된 방문을 함께 옮기고 있어요. 놓으면 한 번 적용해요.' : '숙소 경계를 넘지 않는 목록 안에 놓아 주세요. 밖에 놓으면 취소해요.');
  }

  useEffect(() => {
    if (!open) return;
    const move = (event: globalThis.PointerEvent) => {
      const current = gesture.current;
      if (!current || current.pointerId === null || event.pointerId !== current.pointerId) return;
      current.x = event.clientX; current.y = event.clientY;
      if (!current.active && Math.hypot(current.x - current.startX, current.y - current.startY) < 6) return;
      if (event.cancelable) event.preventDefault();
      current.active = true; locate(current);
    };
    const end = (event: globalThis.PointerEvent) => { const current = gesture.current; if (current?.pointerId === event.pointerId) { current.x = event.clientX; current.y = event.clientY; if (current.active) locate(current); finish(true); } };
    const interrupted = (event: globalThis.PointerEvent) => { if (gesture.current?.pointerId === event.pointerId) cancel(); };
    const escape = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape' && gesture.current) { event.preventDefault(); event.stopPropagation(); cancel(); } };
    const blurred = () => cancel();
    const tick = () => {
      const current = gesture.current, element = scroll.current;
      if (current?.active && current.pointerId !== null && element) {
        const bounds = element.getBoundingClientRect(), listBounds = list.current?.getBoundingClientRect();
        if (listBounds && current.x >= listBounds.left && current.x <= listBounds.right) {
          const delta = current.y < bounds.top + 48 ? -Math.min(10, (bounds.top + 48 - current.y) / 5) : current.y > bounds.bottom - 48 ? Math.min(10, (current.y - bounds.bottom + 48) / 5) : 0;
          if (delta) { element.scrollTop += delta; locate(current); }
        }
      }
      frame.current = requestAnimationFrame(tick);
    };
    document.addEventListener('pointermove', move, { passive: false }); document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', interrupted); document.addEventListener('lostpointercapture', interrupted);
    document.addEventListener('keydown', escape, true); window.addEventListener('blur', blurred); frame.current = requestAnimationFrame(tick);
    return () => {
      document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', end);
      document.removeEventListener('pointercancel', interrupted); document.removeEventListener('lostpointercapture', interrupted);
      document.removeEventListener('keydown', escape, true); window.removeEventListener('blur', blurred); cancel();
    };
    // A changed snapshot invalidates any active pointer or keyboard gesture before it can submit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, identity, disabled]);

  function start(event: PointerEvent<HTMLButtonElement>, group: VisitOrderGroup) {
    if (disabled || group.fixed || gesture.current || !event.isPrimary || event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.focus({ preventScroll: true }); event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { pointerId: event.pointerId, source: group.id, handle: event.currentTarget, identity, ids: baseIds, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, active: false, valid: false };
    setSource(group.id); setMessage('손잡이를 위아래로 움직여 주세요.');
  }
  function keyboard(event: KeyboardEvent<HTMLButtonElement>, group: VisitOrderGroup) {
    if (disabled || group.fixed) return;
    const current = gesture.current;
    if ([' ', 'Enter'].includes(event.key)) {
      event.preventDefault();
      if (current?.pointerId === null && current.source === group.id) { finish(true); return; }
      if (current) return;
      gesture.current = { pointerId: null, source: group.id, handle: event.currentTarget, identity, ids: baseIds, startX: 0, startY: 0, x: 0, y: 0, active: true, valid: true };
      setSource(group.id); setMessage('잡았어요. 위·아래 화살표로 옮기고 Enter로 적용하거나 Escape로 취소하세요.');
    } else if (['ArrowUp', 'ArrowDown'].includes(event.key) && current?.pointerId === null && current.source === group.id) {
      event.preventDefault();
      const ordered = [...groups].sort((a, b) => current.ids.indexOf(a.id) - current.ids.indexOf(b.id)), index = ordered.findIndex(row => row.id === group.id), direction = event.key === 'ArrowUp' ? -1 : 1;
      const neighbor = ordered[index + direction];
      if (!neighbor || neighbor.fixed) { setMessage('숙소 경계를 넘거나 목록 밖으로 옮길 수 없어요.'); return; }
      const next = [...ordered]; [next[index], next[index + direction]] = [next[index + direction], next[index]];
      current.ids = next.flatMap(row => row.visits.map(visit => visit.id)); setPreview(current.ids); setMessage(`${index + direction + 1}번째 그룹으로 옮겼어요. Enter로 적용하거나 Escape로 취소하세요.`);
    } else if (event.key === 'Tab' && current?.pointerId === null) cancel();
  }
  return <div ref={root} className="tr-order-controls">
    <button className="tr-text-link" disabled={disabled || !state.plan.some(visit => visit.day === day)} onClick={() => { setContainer(root.current?.closest<HTMLElement>('[data-spotlog-device]') ?? null); setMessage(''); setPreview(null); setOpen(true); }}><ListOrdered size={16}/>방문 순서 편집</button>
    <Dialog open={open} onOpenChange={value => { if (!value) cancel(); setOpen(value); }}><DialogContent presentation="bottom-sheet" className="tr-sheet tr-order-sheet" portalContainer={container ?? undefined}>
      <div className="tr-sheet-handle" aria-hidden="true"/><DialogHeader><DialogTitle>DAY {day} 방문 순서 편집</DialogTitle><DialogDescription>손잡이를 끌어 놓으면 한 번 적용해요. 장소와 연결된 식당·카페·상점은 함께 이동해요.</DialogDescription></DialogHeader>
      <div className="sheet-body tr-order-body" ref={scroll}>
        <p className="tr-order-hint"><ArrowUp size={14}/><ArrowDown size={14}/>키보드: 손잡이에서 Space → 화살표 → Enter. Escape로 취소해요.</p>
        {issue ? <p role="status">{issue}</p> : <ol className="tr-order-list" ref={list} aria-label={`DAY ${day} 방문 순서`}>
          {/* Keep the captured handle in its original DOM position until drop. Moving its DOM node loses pointer capture. */}
          {groups.map(group => <li key={group.id} data-order-group={group.id} style={{ order: displayPositions.get(group.id) }} aria-posinset={(displayPositions.get(group.id) ?? 0) + 1} aria-setsize={groups.length} className={`tr-order-group${source === group.id ? ' is-moving' : ''}${group.fixed ? ' is-fixed' : ''}`}>
            <span className="tr-order-number">{(displayPositions.get(group.id) ?? 0) + 1}</span><div className="tr-order-names">{group.visits.map((visit, visitIndex) => <div key={visit.id}><strong>{visitIndex ? '↳ ' : ''}{visitName(visit)}</strong><small>{visit.label}{visit.time ? ` · ${visit.time}` : ''}</small></div>)}{group.visits.length > 1 && <span className="tr-order-linked">{group.visits.length}곳 함께 이동</span>}</div>
            {group.fixed ? <span className="tr-order-lock" aria-label="숙소 또는 예약 고정 방문"><LockKeyhole size={17}/><small>고정</small></span> : <button className="tr-order-handle" disabled={disabled || !canEdit} aria-label={`${visitName(group.visits[0])} 순서 이동`} aria-pressed={source === group.id} onPointerDown={event => start(event, group)} onKeyDown={event => keyboard(event, group)} onBlur={() => { if (gesture.current?.pointerId === null) cancel(); }}><GripVertical size={23}/></button>}
          </li>)}
        </ol>}
        {!issue && !canEdit && <p className="tr-order-hint">같은 숙소 경계 안에 옮길 수 있는 방문 그룹이 두 개 이상 있어야 해요.</p>}
        <p className="tr-order-status" role="status" aria-live="polite">{message || '끌어 놓기 전까지 일정과 대화는 바뀌지 않아요. 방문 시각은 유지돼요.'}</p>
        <button className="tr-order-cancel" disabled={!source} onClick={() => cancel()}>이동 취소</button>
      </div>
    </DialogContent></Dialog>
  </div>;
}
