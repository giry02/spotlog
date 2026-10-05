import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, CalendarDays, ChevronRight, Sparkles, X } from 'lucide-react';
import type { Journey, Place } from './data';
import { BottomSheet } from './BottomSheet';
import { DayNavigation } from './DayNavigation';
import { Field } from './ui';
import { localizedTripError, tripMessage, useLocale, type TripMessageKey } from './locale';
import { buildSavedTrip, forgetSavedTripPlace, reorderSavedTripPlace, resizeSavedTrip, savedTripDate, savedTripPeriod, savedTripRegion, validTripDate, type SavedTripDraft, type SavedTripMode } from './savedTripBuilder';
import './saved-trip-builder.css';

export function SavedTripControls({ draft, places, automaticPlaces, onChange, onCreate }: {
  draft: SavedTripDraft; places: Place[]; automaticPlaces: Place[];
  onChange: (next: SavedTripDraft) => void; onCreate: (journey: Journey) => string | null;
}) {
  const { locale } = useLocale();
  const s = (key: TripMessageKey, values?: Record<string, string | number>) => tripMessage(locale, key, values);
  const period = (days: number) => locale === 'en' ? days === 1 ? '1 day' : `${days} days` : savedTripPeriod(days);
  const [setup, setSetup] = useState<SavedTripMode | null>(null);
  const [more, setMore] = useState(draft.dayCount > 4);
  const [error, setError] = useState('');
  const [automaticRegion, setAutomaticRegion] = useState('');
  const saving = useRef(false);
  const toolbar = useRef<HTMLDivElement>(null);
  const unplaced = draft.assignments.filter(item => item.day === null);
  const selectedDay = draft.assignments.filter(item => item.day === draft.activeDay);
  const automaticRegions = Array.from(new Set(automaticPlaces.map(savedTripRegion)));
  const chosenRegion = automaticRegions.length === 1 ? automaticRegions[0] : automaticRegions.includes(automaticRegion) ? automaticRegion : '';
  const scopedPlaces = automaticPlaces.filter(place => savedTripRegion(place) === chosenRegion);
  const update = (next: SavedTripDraft) => { setError(''); onChange(next); };
  const openSetup = (mode: SavedTripMode) => { setError(''); setMore(draft.dayCount > 4); setSetup(mode); };
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
    <section className="ai-trip-card saved-trip-maker" aria-labelledby="ai-trip-title">
      <div className="ai-trip-heading"><span className="ai-trip-icon"><Sparkles size={19} /></span><div><small>TRIP MAKER</small><h2 id="ai-trip-title">{s('title')}</h2></div><span className="ai-trip-kpi">{s('count', { count: automaticPlaces.length })}</span></div>
      <p>{s('intro')}</p>
      <div className="saved-trip-modes" role="group" aria-label={s('modes')}>
        <button type="button" aria-pressed={draft.active} aria-haspopup="dialog" disabled={!places.length} onClick={() => openSetup('manual')}><CalendarDays size={15} />{s('manual')}</button>
        <button type="button" aria-haspopup="dialog" disabled={!automaticPlaces.length} onClick={() => openSetup('auto')}><Sparkles size={15} />{s('auto')}</button>
      </div>
    </section>
    {draft.active && <>
      <div className="saved-trip-toolbar" ref={toolbar}>
        <div className="saved-trip-toolbar-row"><button type="button" className="saved-trip-period-link" aria-haspopup="dialog" onClick={() => openSetup('manual')}>{period(draft.dayCount)}<ChevronRight size={13} /></button><span aria-live="polite">{s('selectedCount', { count: draft.assignments.length })}</span><button type="button" className="saved-trip-confirm" disabled={!draft.assignments.length || unplaced.length > 0 || !validTripDate(draft.startDate)} onClick={() => save(draft)}>{s('create')}<ChevronRight size={14} /></button></div>
        <DayNavigation days={dayRows} selectedDay={draft.activeDay} onSelect={day => update({ ...draft, activeDay: day })} onBack={() => update({ ...draft, active: false })} />
      </div>
      <div className="saved-trip-status"><span>{s('currentDay', { day: draft.activeDay })}</span><button type="button" onClick={() => update({ ...draft, active: false })}>{s('collapse')}</button></div>
      {error && !setup && <p className="ui-error" role="alert">{error}</p>}
      {unplaced.length > 0 && <div className="saved-trip-unplaced" role="status"><p>{s('unplaced', { count: unplaced.length })}</p>{unplaced.map(item => <div key={item.placeId}><span>{places.find(place => place.id === item.placeId)?.name ?? s('unsaved')}</span><button type="button" onClick={() => update({ ...draft, assignments: draft.assignments.map(entry => entry.placeId === item.placeId ? { ...entry, day: draft.activeDay } : entry) })}>{s('addToDay', { day: draft.activeDay })}</button><button type="button" aria-label={(places.find(place => place.id === item.placeId)?.name ?? '') + ' ' + s('remove')} onClick={() => update(forgetSavedTripPlace(draft,item.placeId))}><X size={15} /></button></div>)}</div>}
      {selectedDay.length > 0 && <details className="saved-trip-order"><summary>{s('order', { day: draft.activeDay, count: selectedDay.length })}</summary><ol>{selectedDay.map((item,index) => <li key={item.placeId}><span>{index + 1}. {places.find(place => place.id === item.placeId)?.name}</span><button type="button" disabled={index === 0} aria-label={places.find(place => place.id === item.placeId)?.name + ' ' + s('up')} onClick={() => update(reorderSavedTripPlace(draft,item.placeId,-1))}><ArrowUp size={15} /></button><button type="button" disabled={index === selectedDay.length - 1} aria-label={places.find(place => place.id === item.placeId)?.name + ' ' + s('down')} onClick={() => update(reorderSavedTripPlace(draft,item.placeId,1))}><ArrowDown size={15} /></button><button type="button" aria-label={places.find(place => place.id === item.placeId)?.name + ' ' + s('remove')} onClick={() => update(forgetSavedTripPlace(draft,item.placeId))}><X size={15} /></button></li>)}</ol></details>}
    </>}
    {setup && <BottomSheet title={s('periodTitle')} description={setup === 'manual' ? s('manualHint') : chosenRegion ? s('autoHint', { region: chosenRegion, count: scopedPlaces.length }) : s('autoRegionHint')} onClose={() => setSetup(null)}>
      <div className="saved-trip-period-sheet">
        {setup === 'auto' && automaticRegions.length > 1 && <div className="saved-trip-region-picker">
          <strong>{s('autoRegion')}</strong>
          <div className="saved-trip-region-options" role="group" aria-label={s('autoRegion')}>
            {automaticRegions.map(region => <button type="button" key={region} aria-pressed={chosenRegion === region} onClick={() => { setAutomaticRegion(region); setError(''); }}>{region}<span>{s('count', { count: automaticPlaces.filter(place => savedTripRegion(place) === region).length })}</span></button>)}
          </div>
          <p className="phase-hint">{chosenRegion ? s('autoOtherRegions', { count: places.length - scopedPlaces.length }) : s('autoRegionNote')}</p>
        </div>}
        <div className="saved-trip-period-options" role="group" aria-label={s('period')}>{[1,2,3,4].map(days => <button key={days} type="button" aria-pressed={draft.dayCount === days} onClick={() => update(resizeSavedTrip(draft, days))}>{period(days)}</button>)}</div>
        <button type="button" className="saved-trip-more" aria-expanded={more} aria-controls="saved-trip-long-periods" onClick={() => setMore(!more)}>{more ? s('collapse') : draft.dayCount > 4 ? period(draft.dayCount) + ' · ' + s('more') : s('more')}<ChevronRight size={14} /></button>
        <div id="saved-trip-long-periods" className="saved-trip-period-options" role="group" aria-label={s('longer')} hidden={!more}>{[5,6,7].map(days => <button key={days} type="button" aria-pressed={draft.dayCount === days} onClick={() => update(resizeSavedTrip(draft, days))}>{period(days)}</button>)}</div>
        <details className="saved-trip-settings"><summary>{draft.startDate ? s('startDateValue', { date: draft.startDate }) : s('optional')}</summary><div>
          <Field label={s('startDate')}><input aria-label={s('startDate')} type="date" value={draft.startDate} onInput={event => update({ ...draft, startDate: event.currentTarget.value })} onChange={event => update({ ...draft, startDate: event.target.value })} /></Field>
          <Field label={s('tripName')}><input aria-label={s('tripName')} maxLength={80} value={draft.title} placeholder={s('tripPlaceholder', { period: period(draft.dayCount) })} onChange={event => update({ ...draft, title: event.target.value })} /></Field>
        </div></details>
        {setup === 'manual' && unplaced.length > 0 && <p className="phase-hint">{s('unplacedHint', { count: unplaced.length })}</p>}
        {setup === 'auto' && <p className="phase-hint">{s('autoNote')}</p>}
        {!validTripDate(draft.startDate) && <p className="ui-error" role="alert">{s('invalidDate')}</p>}
        {error && <p className="ui-error" role="alert">{error}</p>}
        <button type="button" className="primary" disabled={!validTripDate(draft.startDate) || (setup === 'auto' && !scopedPlaces.length)} onClick={confirmSetup}>{setup === 'auto' && !chosenRegion ? s('autoRegionRequired') : `${period(draft.dayCount)} · ${setup === 'manual' ? s('addPlaces') : s('auto')}`}<ChevronRight size={16} /></button>
      </div>
    </BottomSheet>}
  </>;
}
