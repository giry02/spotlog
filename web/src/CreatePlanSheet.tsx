import { useState } from 'react';
import { Check, MapPin } from 'lucide-react';
import type { Journey, Place } from './data';
import { BottomSheet } from './BottomSheet';
import { Button, Field } from './ui';
import { buildPersonalPlan, setPlanDates } from './tripPlan';
import { localizedTripError, tripMessage, useLocale, type TripMessageKey } from './locale';

export function CreatePlanSheet({ places, author, onClose, onCreate }: { places: Place[]; author: string; onClose: () => void; onCreate: (journey: Journey) => boolean }) {
  const { locale } = useLocale();
  const s = (key: TripMessageKey, values?: Record<string, string | number>) => tripMessage(locale, key, values);
  const period = (day: number) => locale === 'en' ? day === 1 ? 'Day trip' : `${day} days / ${day - 1} ${day === 2 ? 'night' : 'nights'}` : day === 1 ? '당일' : `${day - 1}박 ${day}일`;
  const regions = [...new Set(places.map(place => place.area.split(' ')[0]))];
  const [region, setRegion] = useState(regions[0] ?? '');
  const [selected, setSelected] = useState<string[]>(places.filter(place => place.area.split(' ')[0] === regions[0]).map(place => place.id));
  const [days, setDays] = useState(2);
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [error, setError] = useState('');
  return <BottomSheet title={s('createTitle')} description={s('createHint')} onClose={onClose}>
    <div className="plan-form">
      {!!regions.length && <div className="saved-region-chips">{regions.map(item => <button key={item} className={item === region ? 'active' : ''} onClick={() => { setRegion(item); setSelected(places.filter(place => place.area.split(' ')[0] === item).map(place => place.id)); }}>{item}</button>)}</div>}
      <div className="plan-place-choices">{places.filter(place => place.area.split(' ')[0] === region).map(place => <button key={place.id} aria-pressed={selected.includes(place.id)} onClick={() => setSelected(current => current.includes(place.id) ? current.filter(id => id !== place.id) : [...current, place.id])}>
        {place.image ? <img src={place.image} alt="" /> : <MapPin size={20} />}<span>{place.name}</span>{selected.includes(place.id) && <Check size={18} />}
      </button>)}</div>
      {!places.length && <p className="plan-help">{s('emptyHint')}</p>}
      <Field label={s('period')}><select value={days} onChange={event => setDays(Number(event.target.value))}>{Array.from({ length: 7 }, (_, i) => i + 1).map(day => <option key={day} value={day}>{period(day)}</option>)}</select></Field>
      <Field label={s('tripName')}><input value={title} onChange={event => setTitle(event.target.value)} placeholder={`${region || s('domestic')} ${s('tripPlaceholder', { period: period(days) })}`} /></Field>
      <Field label={s('startDate')}><input type="date" value={startDate} onInput={event=>setStartDate(event.currentTarget.value)} onChange={event=>setStartDate(event.target.value)}/></Field>
      <p className="plan-help">{s('orderHint')}</p>
      {error && <p role="alert" className="ui-error">{error}</p>}
      <Button disabled={places.length > 0 && !selected.length} onClick={() => { try { const result = setPlanDates(buildPersonalPlan(selected.map(id => places.find(place => place.id === id)!).filter(Boolean), days, title, author),startDate); if (!onCreate(result)) setError(s('saveFailed')); } catch(error) { setError(localizedTripError(locale, error)); } }}>{s('createMyTrip')}{selected.length > 0 ? ` · ${s('count', { count: selected.length })}` : ''}</Button>
    </div>
  </BottomSheet>;
}
