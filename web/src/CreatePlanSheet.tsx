import { useRef, useState } from 'react';
import { Check, MapPin } from 'lucide-react';
import type { Journey, Place } from './data';
import { BottomSheet } from './BottomSheet';
import { Button, Field } from './ui';
import { localizedTripError, tripMessage, useLocale, type TripMessageKey } from './locale';
import { createPlanFromCreationDraft, restorePlanCreationDraft, type PlanCreationDraft } from './planCreationDraft';

export function CreatePlanSheet({ places, author, draft, onDraftChange, onClose, onCreate }: { places: Place[]; author: string; draft: PlanCreationDraft | null; onDraftChange: (draft: PlanCreationDraft) => boolean; onClose: () => void; onCreate: (journey: Journey) => boolean }) {
  const { locale } = useLocale();
  const s = (key: TripMessageKey, values?: Record<string, string | number>) => tripMessage(locale, key, values);
  const period = (day: number) => locale === 'en' ? day === 1 ? 'Day trip' : `${day} days / ${day - 1} ${day === 2 ? 'night' : 'nights'}` : day === 1 ? '당일' : `${day - 1}박 ${day}일`;
  const regions = [...new Set(places.map(place => place.area.split(' ')[0]))];
  const [input, setInput] = useState(() => restorePlanCreationDraft(draft, places));
  const { region, selectedIds: selected, dayCount: days, title, startDate } = input;
  const regionSelections = useRef<Record<string, string[]>>({});
  const [error, setError] = useState('');
  const selectedStays=places.filter(place=>place.kind==='STAY'&&selected.includes(place.id));
  const change = (patch: Partial<PlanCreationDraft>) => {
    const next = { ...input, ...patch }; setInput(next);
    if (!onDraftChange(next)) setError('입력은 유지했어요. 기기에 보관하지 못했으니 이 화면에서 이어서 만들어 주세요.');
  };
  const chooseRegion = (nextRegion: string) => {
    if (nextRegion === region) return;
    regionSelections.current[region] = [...selected];
    const available = places.filter(place => place.area.split(' ')[0] === nextRegion).map(place => place.id);
    const remembered = regionSelections.current[nextRegion];
    change({ region: nextRegion, selectedIds: remembered ? remembered.filter(id => available.includes(id)) : available });
  };
  return <BottomSheet title={s('createTitle')} description={s('createHint')} onClose={onClose}>
    <div className="plan-form">
      {!!regions.length && <div className="saved-region-chips">{regions.map(item => <button key={item} aria-pressed={item === region} className={item === region ? 'active' : ''} onClick={() => chooseRegion(item)}>{item}</button>)}</div>}
      <div className="plan-place-choices">{places.filter(place => place.area.split(' ')[0] === region).map(place => <button key={place.id} aria-pressed={selected.includes(place.id)} onClick={() => change({ selectedIds: selected.includes(place.id) ? selected.filter(id => id !== place.id) : [...selected, place.id] })}>
        {place.image ? <img src={place.image} alt="" /> : <MapPin size={20} />}<span>{place.name}</span>{selected.includes(place.id) && <Check size={18} />}
      </button>)}</div>
      {!places.length && <p className="plan-help">{s('emptyHint')}</p>}
      <Field label={s('period')}><select value={days} onChange={event => change({ dayCount: Number(event.target.value) })}>{Array.from({ length: 7 }, (_, i) => i + 1).map(day => <option key={day} value={day}>{period(day)}</option>)}</select></Field>
      {selectedStays.map(stay=>{const assignment=input.stayAssignments?.find(item=>item.placeId===stay.id);return <fieldset key={stay.id} className="ui-stack" style={{border:'1px solid var(--line)',borderRadius:12,padding:14,minWidth:0}}><legend style={{fontSize:'var(--type-body)',fontWeight:700}}>{stay.name} · 숙박일</legend><Field label="숙박 시작 DAY"><select value={assignment?.startDay??''} onChange={event=>change({stayAssignments:[...(input.stayAssignments??[]).filter(item=>item.placeId!==stay.id),{placeId:stay.id,startDay:Number(event.target.value),nights:assignment?.nights??1}]})}><option value="" disabled>숙박일 선택</option>{Array.from({length:Math.max(0,days-1)},(_,index)=><option key={index+1} value={index+1}>DAY {index+1} 숙박</option>)}</select></Field><Field label="숙박 기간"><select disabled={!assignment} value={assignment?.nights??1} onChange={event=>change({stayAssignments:[...(input.stayAssignments??[]).filter(item=>item.placeId!==stay.id),{placeId:stay.id,startDay:assignment!.startDay,nights:Number(event.target.value)}]})}>{Array.from({length:Math.max(1,days-(assignment?.startDay??1))},(_,index)=><option key={index+1} value={index+1}>{index+1}박</option>)}</select></Field>{days===1&&<p className="plan-help">숙소를 담으려면 1박 2일 이상을 선택해 주세요.</p>}</fieldset>;})}
      <Field label={s('tripName')}><input value={title} onChange={event => change({ title: event.target.value })} placeholder={`${region || s('domestic')} ${s('tripPlaceholder', { period: period(days) })}`} /></Field>
      <Field label={s('startDate')}><input type="date" value={startDate} onChange={event=>change({ startDate: event.target.value })}/></Field>
      <p className="plan-help">{s('orderHint')}</p>
      {error && <p role="alert" className="ui-error">{error}</p>}
      <Button disabled={places.length > 0 && !selected.length} onClick={() => { try { const result = createPlanFromCreationDraft(input,places,author); if (!onCreate(result)) setError(s('saveFailed')); } catch(error) { setError(localizedTripError(locale, error)); } }}>{s('createMyTrip')}{selected.length > 0 ? ` · ${s('count', { count: selected.length })}` : ''}</Button>
    </div>
  </BottomSheet>;
}
