import { useState } from 'react';
import { Check, MapPin } from 'lucide-react';
import type { Journey, Place } from './data';
import { BottomSheet } from './BottomSheet';
import { Button, Field } from './ui';
import { buildPersonalPlan, setPlanDates } from './tripPlan';
import { localizedTripError, tripMessage, useLocale, type TripMessageKey } from './locale';
import { restorePlanCreationDraft, type PlanCreationDraft } from './planCreationDraft';

export function CreatePlanSheet({ places, author, draft, onDraftChange, onClose, onCreate }: { places: Place[]; author: string; draft: PlanCreationDraft | null; onDraftChange: (draft: PlanCreationDraft) => boolean; onClose: () => void; onCreate: (journey: Journey) => boolean }) {
  const { locale } = useLocale();
  const s = (key: TripMessageKey, values?: Record<string, string | number>) => tripMessage(locale, key, values);
  const period = (day: number) => locale === 'en' ? day === 1 ? 'Day trip' : `${day} days / ${day - 1} ${day === 2 ? 'night' : 'nights'}` : day === 1 ? '당일' : `${day - 1}박 ${day}일`;
  const regions = [...new Set(places.map(place => place.area.split(' ')[0]))];
  const [input, setInput] = useState(() => restorePlanCreationDraft(draft, places));
  const { region, selectedIds: selected, dayCount: days, title, startDate } = input;
  const [error, setError] = useState('');
  const change = (patch: Partial<PlanCreationDraft>) => {
    const next = { ...input, ...patch }; setInput(next);
    if (!onDraftChange(next)) setError('입력은 유지했어요. 기기에 보관하지 못했으니 이 화면에서 이어서 만들어 주세요.');
  };
  return <BottomSheet title={s('createTitle')} description={s('createHint')} onClose={onClose}>
    <div className="plan-form">
      {!!regions.length && <div className="saved-region-chips">{regions.map(item => <button key={item} className={item === region ? 'active' : ''} onClick={() => change({ region: item, selectedIds: places.filter(place => place.area.split(' ')[0] === item).map(place => place.id) })}>{item}</button>)}</div>}
      <div className="plan-place-choices">{places.filter(place => place.area.split(' ')[0] === region).map(place => <button key={place.id} aria-pressed={selected.includes(place.id)} onClick={() => change({ selectedIds: selected.includes(place.id) ? selected.filter(id => id !== place.id) : [...selected, place.id] })}>
        {place.image ? <img src={place.image} alt="" /> : <MapPin size={20} />}<span>{place.name}</span>{selected.includes(place.id) && <Check size={18} />}
      </button>)}</div>
      {!places.length && <p className="plan-help">{s('emptyHint')}</p>}
      <Field label={s('period')}><select value={days} onChange={event => change({ dayCount: Number(event.target.value) })}>{Array.from({ length: 7 }, (_, i) => i + 1).map(day => <option key={day} value={day}>{period(day)}</option>)}</select></Field>
      <Field label={s('tripName')}><input value={title} onChange={event => change({ title: event.target.value })} placeholder={`${region || s('domestic')} ${s('tripPlaceholder', { period: period(days) })}`} /></Field>
      <Field label={s('startDate')}><input type="date" value={startDate} onChange={event=>change({ startDate: event.target.value })}/></Field>
      <p className="plan-help">{s('orderHint')}</p>
      {error && <p role="alert" className="ui-error">{error}</p>}
      <Button disabled={places.length > 0 && !selected.length} onClick={() => { try { const result = setPlanDates(buildPersonalPlan(selected.map(id => places.find(place => place.id === id)!).filter(Boolean), days, title, author),startDate); if (!onCreate(result)) setError(s('saveFailed')); } catch(error) { setError(localizedTripError(locale, error)); } }}>{s('createMyTrip')}{selected.length > 0 ? ` · ${s('count', { count: selected.length })}` : ''}</Button>
    </div>
  </BottomSheet>;
}
