import { useState } from 'react';
import { Check, MapPin } from 'lucide-react';
import type { Journey, Place } from './data';
import { BottomSheet } from './BottomSheet';
import { Button, Field } from './ui';
import { buildPersonalPlan } from './tripPlan';

export function CreatePlanSheet({ places, author, onClose, onCreate }: { places: Place[]; author: string; onClose: () => void; onCreate: (journey: Journey) => boolean }) {
  const regions = [...new Set(places.map(place => place.area.split(' ')[0]))];
  const [region, setRegion] = useState(regions[0] ?? '');
  const [selected, setSelected] = useState<string[]>(places.filter(place => place.area.split(' ')[0] === regions[0]).map(place => place.id));
  const [days, setDays] = useState(2);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  return <BottomSheet title="저장한 곳으로 여행 만들기" description="가고 싶은 곳을 고르면 DAY별 동선이 만들어져요." onClose={onClose}>
    <div className="plan-form">
      {!!regions.length && <div className="saved-region-chips">{regions.map(item => <button key={item} className={item === region ? 'active' : ''} onClick={() => { setRegion(item); setSelected(places.filter(place => place.area.split(' ')[0] === item).map(place => place.id)); }}>{item}</button>)}</div>}
      <div className="plan-place-choices">{places.filter(place => place.area.split(' ')[0] === region).map(place => <button key={place.id} aria-pressed={selected.includes(place.id)} onClick={() => setSelected(current => current.includes(place.id) ? current.filter(id => id !== place.id) : [...current, place.id])}>
        {place.image ? <img src={place.image} alt="" /> : <MapPin size={20} />}<span>{place.name}</span>{selected.includes(place.id) && <Check size={18} />}
      </button>)}</div>
      {!places.length && <p className="plan-help">빈 여행을 먼저 만들고, 저장한 장소에서 하나씩 담아도 좋아요.</p>}
      <Field label="여행 기간"><select value={days} onChange={event => setDays(Number(event.target.value))}>{Array.from({ length: 7 }, (_, i) => i + 1).map(day => <option key={day} value={day}>{day === 1 ? '당일' : `${day - 1}박 ${day}일`}</option>)}</select></Field>
      <Field label="여행 이름 (선택)"><input value={title} onChange={event => setTitle(event.target.value)} placeholder={`${region || '국내'} ${days === 1 ? '당일' : `${days - 1}박 ${days}일`} 여행`} /></Field>
      <p className="plan-help">선택 순서로 날짜에 나눠 담아요. 내 여행에서 자유롭게 옮길 수 있어요.</p>
      {error && <p role="alert" className="ui-error">{error}</p>}
      <Button disabled={places.length > 0 && !selected.length} onClick={() => { const result = buildPersonalPlan(selected.map(id => places.find(place => place.id === id)!).filter(Boolean), days, title, author); if (!onCreate(result)) setError('여행을 저장하지 못했어요. 선택한 장소는 그대로예요.'); }}>내 여행 만들기{selected.length > 0 ? ` · ${selected.length}곳` : ''}</Button>
    </div>
  </BottomSheet>;
}
