import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, CalendarDays, ChevronRight, Sparkles, X } from 'lucide-react';
import type { Journey, Place } from './data';
import { BottomSheet } from './BottomSheet';
import { DayNavigation } from './DayNavigation';
import { Field } from './ui';
import { buildSavedTrip, forgetSavedTripPlace, reorderSavedTripPlace, resizeSavedTrip, savedTripDate, savedTripPeriod, validTripDate, type SavedTripDraft, type SavedTripMode } from './savedTripBuilder';
import './saved-trip-builder.css';

export function SavedTripControls({ draft, places, automaticPlaces, regionLabel, onChange, onCreate }: {
  draft: SavedTripDraft; places: Place[]; automaticPlaces: Place[]; regionLabel: string;
  onChange: (next: SavedTripDraft) => void; onCreate: (journey: Journey) => string | null;
}) {
  const [setup, setSetup] = useState<SavedTripMode | null>(null);
  const [more, setMore] = useState(draft.dayCount > 4);
  const [error, setError] = useState('');
  const saving = useRef(false);
  const toolbar = useRef<HTMLDivElement>(null);
  const unplaced = draft.assignments.filter(item => item.day === null);
  const selectedDay = draft.assignments.filter(item => item.day === draft.activeDay);
  const update = (next: SavedTripDraft) => { setError(''); onChange(next); };
  const openSetup = (mode: SavedTripMode) => { setError(''); setMore(draft.dayCount > 4); setSetup(mode); };
  const save = (next: SavedTripDraft) => {
    if (saving.current) return;
    saving.current = true;
    try {
      const journey = buildSavedTrip(next, places);
      if (!onCreate(journey)) {
        setError('여행을 저장하지 못했어요. 담은 내용은 유지됩니다. 다시 시도해 주세요.');
        saving.current = false;
      }
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : '여행을 저장하지 못했어요. 담은 내용은 유지됩니다.');
      saving.current = false;
    }
  };
  const confirmSetup = () => {
    if (setup === 'auto') {
      // All saved places in the current region filter, with no extra selection step.
      save({ ...draft, mode: 'auto', automaticIds: automaticPlaces.map(place => place.id) });
    } else {
      update({ ...draft, active: true, mode: 'manual' });
      setSetup(null);
      window.requestAnimationFrame(() => toolbar.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
    }
  };
  const dayRows = Array.from({ length: draft.dayCount }, (_, index) => {
    const day = index + 1;
    const amount = draft.assignments.filter(item => item.day === day).length;
    const date = savedTripDate(draft.startDate, day);
    return { day, date: (date ? date.slice(5).replace('-', '.') + ' · ' : '') + amount + '곳', title: '', story: '', places: [], blocks: [] };
  });
  return <>
    <section className="ai-trip-card saved-trip-maker" aria-labelledby="ai-trip-title">
      <div className="ai-trip-heading"><span className="ai-trip-icon"><Sparkles size={19} /></span><div><small>TRIP MAKER</small><h2 id="ai-trip-title">저장한 장소로 여행 만들기</h2></div><span className="ai-trip-kpi">{automaticPlaces.length}곳</span></div>
      <p>날짜별로 직접 담거나, 기간만 정해 바로 만들어보세요.</p>
      <div className="saved-trip-modes" role="group" aria-label="여행 만드는 방법">
        <button type="button" aria-pressed={draft.active} aria-haspopup="dialog" disabled={!places.length} onClick={() => openSetup('manual')}><CalendarDays size={15} />날짜별로 담기</button>
        <button type="button" aria-haspopup="dialog" disabled={!automaticPlaces.length} onClick={() => openSetup('auto')}><Sparkles size={15} />바로 만들기</button>
      </div>
    </section>
    {draft.active && <>
      <div className="saved-trip-toolbar" ref={toolbar}>
        <div className="saved-trip-toolbar-row"><button type="button" className="saved-trip-period-link" aria-haspopup="dialog" onClick={() => openSetup('manual')}>{savedTripPeriod(draft.dayCount)}<ChevronRight size={13} /></button><span aria-live="polite">{draft.assignments.length}곳 담음</span><button type="button" className="saved-trip-confirm" disabled={!draft.assignments.length || unplaced.length > 0 || !validTripDate(draft.startDate)} onClick={() => save(draft)}>일정 만들기<ChevronRight size={14} /></button></div>
        <DayNavigation days={dayRows} selectedDay={draft.activeDay} onSelect={day => update({ ...draft, activeDay: day })} onBack={() => update({ ...draft, active: false })} />
      </div>
      <div className="saved-trip-status"><span>DAY {draft.activeDay} 선택 · 카드에서 바로 담으세요.</span><button type="button" onClick={() => update({ ...draft, active: false })}>접기</button></div>
      {error && !setup && <p className="ui-error" role="alert">{error}</p>}
      {unplaced.length > 0 && <div className="saved-trip-unplaced" role="status"><p>기간이 줄어든 {unplaced.length}곳의 DAY를 다시 골라주세요.</p>{unplaced.map(item => <div key={item.placeId}><span>{places.find(place => place.id === item.placeId)?.name ?? '저장 해제한 장소'}</span><button type="button" onClick={() => update({ ...draft, assignments: draft.assignments.map(entry => entry.placeId === item.placeId ? { ...entry, day: draft.activeDay } : entry) })}>DAY {draft.activeDay}에 담기</button><button type="button" aria-label={(places.find(place => place.id === item.placeId)?.name ?? '장소') + ' 이번 여행에서 제외'} onClick={() => update(forgetSavedTripPlace(draft,item.placeId))}><X size={15} /></button></div>)}</div>}
      {selectedDay.length > 0 && <details className="saved-trip-order"><summary>DAY {draft.activeDay}에 담은 {selectedDay.length}곳 · 순서 조정</summary><ol>{selectedDay.map((item,index) => <li key={item.placeId}><span>{index + 1}. {places.find(place => place.id === item.placeId)?.name}</span><button type="button" disabled={index === 0} aria-label={places.find(place => place.id === item.placeId)?.name + ' 위로'} onClick={() => update(reorderSavedTripPlace(draft,item.placeId,-1))}><ArrowUp size={15} /></button><button type="button" disabled={index === selectedDay.length - 1} aria-label={places.find(place => place.id === item.placeId)?.name + ' 아래로'} onClick={() => update(reorderSavedTripPlace(draft,item.placeId,1))}><ArrowDown size={15} /></button><button type="button" aria-label={places.find(place => place.id === item.placeId)?.name + ' 담김 해제'} onClick={() => update(forgetSavedTripPlace(draft,item.placeId))}><X size={15} /></button></li>)}</ol></details>}
    </>}
    {setup && <BottomSheet title="여행 기간 선택" description={setup === 'manual' ? '기간을 정한 뒤 날짜별로 장소를 담으세요.' : regionLabel + ' 저장 장소 ' + automaticPlaces.length + '곳으로 바로 만듭니다.'} onClose={() => setSetup(null)}>
      <div className="saved-trip-period-sheet">
        <div className="saved-trip-period-options" role="group" aria-label="여행 기간">{[1,2,3,4].map(days => <button key={days} type="button" aria-pressed={draft.dayCount === days} onClick={() => update(resizeSavedTrip(draft, days))}>{savedTripPeriod(days)}</button>)}</div>
        <button type="button" className="saved-trip-more" aria-expanded={more} aria-controls="saved-trip-long-periods" onClick={() => setMore(!more)}>{more ? '접기' : draft.dayCount > 4 ? savedTripPeriod(draft.dayCount) + ' · 더 많은 일정' : '더 많은 일정'}<ChevronRight size={14} /></button>
        <div id="saved-trip-long-periods" className="saved-trip-period-options" role="group" aria-label="더 긴 여행 기간" hidden={!more}>{[5,6,7].map(days => <button key={days} type="button" aria-pressed={draft.dayCount === days} onClick={() => update(resizeSavedTrip(draft, days))}>{savedTripPeriod(days)}</button>)}</div>
        <details className="saved-trip-settings"><summary>{draft.startDate ? '출발일 ' + draft.startDate : '출발일 · 여행 이름 (선택)'}</summary><div>
          <Field label="출발일 (선택)"><input aria-label="출발일 (선택)" type="date" value={draft.startDate} onInput={event => update({ ...draft, startDate: event.currentTarget.value })} onChange={event => update({ ...draft, startDate: event.target.value })} /></Field>
          <Field label="여행 이름 (선택)"><input aria-label="여행 이름 (선택)" maxLength={80} value={draft.title} placeholder={savedTripPeriod(draft.dayCount) + ' 여행'} onChange={event => update({ ...draft, title: event.target.value })} /></Field>
        </div></details>
        {setup === 'manual' && unplaced.length > 0 && <p className="phase-hint">기간이 줄어든 장소 {unplaced.length}곳은 담기 화면에서 DAY를 다시 지정할 수 있어요.</p>}
        {setup === 'auto' && <p className="phase-hint">지역과 거리를 참고해 나눕니다. 만든 뒤 DAY별로 확인하고 수정할 수 있어요.</p>}
        {!validTripDate(draft.startDate) && <p className="ui-error" role="alert">출발 날짜를 확인해 주세요.</p>}
        {error && <p className="ui-error" role="alert">{error}</p>}
        <button type="button" className="primary" disabled={!validTripDate(draft.startDate) || (setup === 'auto' && !automaticPlaces.length)} onClick={confirmSetup}>{savedTripPeriod(draft.dayCount)} · {setup === 'manual' ? '장소 담기' : '바로 생성'}<ChevronRight size={16} /></button>
      </div>
    </BottomSheet>}
  </>;
}
