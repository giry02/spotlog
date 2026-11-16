import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, CalendarDays, ChevronRight, Route, X } from 'lucide-react';
import type { Journey, Place } from './data';
import { BottomSheet } from './BottomSheet';
import { DayNavigation } from './DayNavigation';
import { Field } from './ui';
import { localizedTripError, tripMessage, useLocale, type TripMessageKey } from './locale';
import { buildSavedTrip, forgetSavedTripPlace, reorderSavedTripPlace, resizeSavedTrip, savedTripDate, savedTripPeriod, savedTripRegion, validTripDate, type SavedTripDraft, type SavedTripMode } from './savedTripBuilder';
import './saved-trip-builder.css';

export function SavedTripControls({ draft, places, automaticPlaces, onChange, onCreate, browseControls }: {
  draft: SavedTripDraft; places: Place[]; automaticPlaces: Place[];
  onChange: (next: SavedTripDraft) => void; onCreate: (journey: Journey) => string | null;
  browseControls?: ReactNode;
}) {
  const { locale } = useLocale();
  const s = (key: TripMessageKey, values?: Record<string, string | number>) => tripMessage(locale, key, values);
  const period = (days: number) => locale === 'en' ? days === 1 ? '1 day' : `${days} days` : savedTripPeriod(days);
  const [setup, setSetup] = useState<SavedTripMode | null>(null);
  const [modeChoice, setModeChoice] = useState(false);
  const [error, setError] = useState('');
  const [automaticRegion, setAutomaticRegion] = useState('');
  const saving = useRef(false);
  const toolbar = useRef<HTMLDivElement>(null);
  const periodPanel = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (setup) periodPanel.current?.querySelector<HTMLElement>('select,button:not(:disabled)')?.focus({ preventScroll: true });
  }, [setup]);
  const unplaced = draft.assignments.filter(item => item.day === null);
  const selectedDay = draft.assignments.filter(item => item.day === draft.activeDay);
  const automaticRegions = Array.from(new Set(automaticPlaces.map(savedTripRegion)));
  const chosenRegion = automaticRegions.length === 1 ? automaticRegions[0] : automaticRegions.includes(automaticRegion) ? automaticRegion : '';
  const scopedPlaces = automaticPlaces.filter(place => savedTripRegion(place) === chosenRegion);
  const update = (next: SavedTripDraft) => { setError(''); onChange(next); };
  const openSetup = (mode: SavedTripMode) => { setError(''); setModeChoice(false); setSetup(mode); };
  const save = (next: SavedTripDraft) => {
    if (saving.current) return;
    saving.current = true;
    try {
      const journey = buildSavedTrip(next, places);
      if (!onCreate(journey)) {
        setError(s('saveFailed'));
        saving.current = false;
      }
    } catch (issue) {
      setError(localizedTripError(locale, issue));
      saving.current = false;
    }
  };
  const confirmSetup = () => {
    if (setup === 'auto') {
      if (!scopedPlaces.length) { setError(s('autoRegionRequired')); return; }
      save({ ...draft, mode: 'auto', automaticIds: scopedPlaces.map(place => place.id) });
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
    return { day, date: (date ? date.slice(5).replace('-', '.') + ' · ' : '') + s('count', { count: amount }), title: '', story: '', places: [], blocks: [] };
  });
  return <>
    <div className="saved-place-toolbar">
      {browseControls}
      <button type="button" className="saved-trip-launch" aria-haspopup="dialog" disabled={!places.length} onClick={() => { setError(''); setModeChoice(true); }}><CalendarDays size={16} aria-hidden="true"/>{locale === 'en' ? 'Make a trip' : '여행 만들기'}</button>
    </div>
    {draft.active && <>
      <div className="saved-trip-toolbar" ref={toolbar}>
        <div className="saved-trip-toolbar-row"><button type="button" className="saved-trip-period-link" aria-haspopup="dialog" onClick={() => openSetup('manual')}>{period(draft.dayCount)}<ChevronRight size={13} /></button><span aria-live="polite">{s('selectedCount', { count: draft.assignments.length })}</span><button type="button" className="saved-trip-confirm" disabled={!draft.assignments.length || unplaced.length > 0 || !validTripDate(draft.startDate)} onClick={() => save(draft)}>{s('create')}<ChevronRight size={14} /></button></div>
        <DayNavigation days={dayRows} selectedDay={draft.activeDay} onSelect={day => update({ ...draft, activeDay: day })} onBack={() => update({ ...draft, active: false })} />
      </div>
      <div className="saved-trip-status"><span>{s('currentDay', { day: draft.activeDay })}</span><button type="button" onClick={() => update({ ...draft, active: false })}>{s('collapse')}</button></div>
      {error && !setup && <p className="ui-error" role="alert">{error}</p>}
      {unplaced.length > 0 && <div className="saved-trip-unplaced" role="status"><p>{s('unplaced', { count: unplaced.length })}</p>{unplaced.map(item => <div key={item.placeId}><span>{places.find(place => place.id === item.placeId)?.name ?? s('unsaved')}</span><button type="button" onClick={() => update({ ...draft, assignments: draft.assignments.map(entry => entry.placeId === item.placeId ? { ...entry, day: draft.activeDay } : entry) })}>{s('addToDay', { day: draft.activeDay })}</button><button type="button" aria-label={(places.find(place => place.id === item.placeId)?.name ?? '') + ' ' + s('remove')} onClick={() => update(forgetSavedTripPlace(draft,item.placeId))}><X size={15} /></button></div>)}</div>}
      {selectedDay.length > 0 ? <details key={draft.activeDay} open className="saved-trip-order"><summary>{s('order', { day: draft.activeDay, count: selectedDay.length })}</summary><ol>{selectedDay.map((item,index) => <li key={item.placeId}><span>{index + 1}. {places.find(place => place.id === item.placeId)?.name}</span><button type="button" disabled={index === 0} aria-label={places.find(place => place.id === item.placeId)?.name + ' ' + s('up')} onClick={() => update(reorderSavedTripPlace(draft,item.placeId,-1))}><ArrowUp size={15} /></button><button type="button" disabled={index === selectedDay.length - 1} aria-label={places.find(place => place.id === item.placeId)?.name + ' ' + s('down')} onClick={() => update(reorderSavedTripPlace(draft,item.placeId,1))}><ArrowDown size={15} /></button><button type="button" aria-label={places.find(place => place.id === item.placeId)?.name + ' ' + s('remove')} onClick={() => update(forgetSavedTripPlace(draft,item.placeId))}><X size={15} /></button></li>)}</ol></details> : <p className="saved-trip-empty-day">{locale === 'en' ? `DAY ${draft.activeDay} has no places yet. Add them from your saved list below.` : `DAY ${draft.activeDay}에 담은 곳이 없어요. 아래 저장한 장소에서 담아주세요.`}</p>}
    </>}
    {(modeChoice || setup) && <BottomSheet title={setup ? s('periodTitle') : s('title')} description={setup ? setup === 'manual' ? s('manualHint') : chosenRegion ? s('autoHint', { region: chosenRegion, count: scopedPlaces.length }) : s('autoRegionHint') : locale === 'en' ? 'Choose how to use your saved places.' : '저장한 장소를 일정으로 담는 방법을 골라보세요.'} onClose={() => { setModeChoice(false); setSetup(null); }}>
      {!setup ? <div className="saved-trip-methods" role="group" aria-label={s('modes')}>
        <button type="button" disabled={!places.length} onClick={() => openSetup('manual')}><CalendarDays size={21} aria-hidden="true"/><span><strong>{s('manual')}</strong><small>{locale === 'en' ? 'Pick saved places for each day.' : '저장한 장소를 DAY별로 직접 담아요.'}</small></span><ChevronRight size={18} aria-hidden="true"/></button>
        <button type="button" disabled={!automaticPlaces.length} onClick={() => openSetup('auto')}><Route size={21} aria-hidden="true"/><span><strong>{s('auto')}</strong><small>{locale === 'en' ? `Use ${automaticPlaces.length} places in the current list.` : `현재 목록 ${automaticPlaces.length}곳으로 일정을 만들어요.`}</small></span><ChevronRight size={18} aria-hidden="true"/></button>
      </div> : <div className="saved-trip-period-sheet" ref={periodPanel}>
        {setup === 'auto' && automaticRegions.length > 1 && <div className="saved-trip-region-picker">
          <Field label={s('autoRegion')}><select aria-label={s('autoRegion')} value={chosenRegion} onChange={event => { setAutomaticRegion(event.target.value); setError(''); }}><option value="">{s('autoRegionRequired')}</option>{automaticRegions.map(region => <option key={region} value={region}>{region} · {s('count', { count: automaticPlaces.filter(place => savedTripRegion(place) === region).length })}</option>)}</select></Field>
          <p className="phase-hint">{chosenRegion ? s('autoOtherRegions', { count: places.length - scopedPlaces.length }) : s('autoRegionNote')}</p>
        </div>}
        <Field label={s('period')}><select aria-label={s('period')} value={draft.dayCount} onChange={event => update(resizeSavedTrip(draft, Number(event.target.value)))}>{Array.from({ length: 7 }, (_, index) => index + 1).map(days => <option key={days} value={days}>{period(days)}</option>)}</select></Field>
        <p className="saved-trip-setup-result">{setup === 'manual' ? (locale === 'en' ? `${draft.dayCount} days to arrange your saved places.` : `${period(draft.dayCount)} 동안 직접 고른 장소를 DAY별로 배치해요.`) : (locale === 'en' ? `${scopedPlaces.length} places in ${chosenRegion || 'the selected region'} · ${period(draft.dayCount)}` : `${chosenRegion || '지역 선택 필요'} · ${scopedPlaces.length}곳 · ${period(draft.dayCount)}`)}</p>
        <details className="saved-trip-settings"><summary>{draft.startDate ? s('startDateValue', { date: draft.startDate }) : s('optional')}</summary><div>
          <Field label={s('startDate')}><input aria-label={s('startDate')} type="date" value={draft.startDate} onInput={event => update({ ...draft, startDate: event.currentTarget.value })} onChange={event => update({ ...draft, startDate: event.target.value })} /></Field>
          <Field label={s('tripName')}><input aria-label={s('tripName')} maxLength={80} value={draft.title} placeholder={s('tripPlaceholder', { period: period(draft.dayCount) })} onChange={event => update({ ...draft, title: event.target.value })} /></Field>
        </div></details>
        {setup === 'manual' && unplaced.length > 0 && <p className="phase-hint">{s('unplacedHint', { count: unplaced.length })}</p>}
        {setup === 'auto' && <p className="phase-hint">{s('autoNote')}</p>}
        {!validTripDate(draft.startDate) && <p className="ui-error" role="alert">{s('invalidDate')}</p>}
        {error && <p className="ui-error" role="alert">{error}</p>}
        <button type="button" className="primary" disabled={!validTripDate(draft.startDate) || (setup === 'auto' && !scopedPlaces.length)} onClick={confirmSetup}>{setup === 'auto' && !chosenRegion ? s('autoRegionRequired') : `${period(draft.dayCount)} · ${setup === 'manual' ? s('addPlaces') : s('auto')}`}<ChevronRight size={16} /></button>
      </div>}
    </BottomSheet>}
  </>;
}
