import { ArrowLeft, Check, ChevronRight, Plus, Sparkles } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { Journey, JourneyDay, Place } from './data';
import type { NewJourneyOptions } from './journeyCreation';
import { Button, Field, IconButton } from './ui';
import './my-trips-from-saved.css';

interface MyTripsFromSavedProps {
  mode: 'add' | 'create' | 'ai';
  places: Place[];
  journeys: Journey[];
  onBack: () => void;
  onAdd: (journeyId: string, day: number, place: Place) => boolean;
  onCreate: (options: NewJourneyOptions) => string | null;
  onGenerate: (places: Place[], days: number) => boolean;
  onOpenJourney: (id: string, day?: number) => void;
  onRequestCreate: () => void;
}

const periodLabel = (days: number) => days === 1 ? '당일치기' : `${days - 1}박 ${days}일`;
function dateLabel(day: JourneyDay) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(day.date)) {
    const date = new Date(`${day.date}T00:00:00Z`);
    if (Number.isFinite(date.getTime())) return `${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일`;
  }
  return day.date && !/^DAY\s*\d+$/i.test(day.date) ? day.date : `${day.day}일차`;
}

/** The route is My Trips before users choose a day or enter any creation details. */
export function MyTripsFromSaved({ mode, places, journeys, onBack, onAdd, onCreate, onGenerate, onOpenJourney, onRequestCreate }: MyTripsFromSavedProps) {
  const mine = journeys.filter((journey) => journey.isMine);
  const [journeyId, setJourneyId] = useState(mine.length === 1 ? mine[0].id : '');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [title, setTitle] = useState(`${places[0]?.area.trim().split(/\s+/)[0] || '나의'} 여행`);
  const [period, setPeriod] = useState(2);
  const [startDate, setStartDate] = useState('');
  const [error, setError] = useState('');
  const target = mine.find((journey) => journey.id === journeyId);
  const day = target?.days.find((item) => item.day === selectedDay);
  const place = places[0];
  const placeSummary = `${places.slice(0, 3).map((item) => item.name).join(' · ')}${places.length > 3 ? ` 외 ${places.length - 3}곳` : ''}`;
  const alreadyIncluded = Boolean(place && day?.places.some((visit) => visit.id === place.id));

  function submitCreate(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) { setError('여행 이름을 입력해 주세요.'); return; }
    if (!onCreate({ title: title.trim(), days: period, startDate, places })) setError('여행을 만들지 못했습니다. 입력 내용과 저장 상태를 확인해 주세요.');
  }
  function submitAdd(event: FormEvent) {
    event.preventDefault();
    if (!target || !day || !place) { setError('담을 여행과 날짜를 선택해 주세요.'); return; }
    if (alreadyIncluded) { onOpenJourney(target.id, day.day); return; }
    if (!onAdd(target.id, day.day, place)) setError('장소를 담지 못했습니다. 저장 상태를 확인해 주세요.');
  }

  return <section className="my-trips-from-saved page">
    <header className="my-trips-flow-header"><IconButton aria-label="저장한 장소로 돌아가기" onClick={onBack}><ArrowLeft size={22} /></IconButton><h1>내 여행</h1></header>
    <div className="my-trips-flow-intro"><h2>{mode === 'add' ? '어느 날짜에 담을까요?' : mode === 'ai' ? 'AI로 여행 만들기' : '새 여행 만들기'}</h2><p>{mode === 'add' ? '내 여행과 날짜를 선택해 장소를 담으세요.' : '만든 여행의 날짜별 일정과 내용은 여기서 관리해요.'}</p></div>
    {places.length > 0 && <div className="my-trips-carried-places"><span>저장에서 가져온 장소 {places.length}곳</span><strong>{mode === 'add' ? place.name : placeSummary}</strong>{mode === 'add' && <small>{place.area}</small>}</div>}

    {mode === 'add' && (!place ? <div className="my-trips-flow-empty"><p>담을 장소를 찾지 못했습니다. 저장한 장소에서 다시 선택해 주세요.</p><Button onClick={onBack}>저장한 장소로 돌아가기</Button></div> : mine.length === 0 ? <div className="my-trips-flow-empty"><h3>아직 내 여행이 없어요</h3><p>새 여행을 만들어 이 장소부터 담아 보세요.</p><Button onClick={onRequestCreate}><Plus size={18} />새 여행 만들기</Button></div> : <form className="my-trips-flow-form" onSubmit={submitAdd}>
      <Field label="담을 여행"><select aria-label="담을 여행 선택" value={target?.id || ''} onChange={(event) => { setJourneyId(event.target.value); setSelectedDay(null); setError(''); }}><option value="" disabled>여행을 선택해 주세요</option>{mine.map((journey) => <option key={journey.id} value={journey.id}>{journey.title}</option>)}</select></Field>
      {target && (target.days.length ? <div className="ui-field"><span className="ui-field-label" id="my-trips-day-label">담을 날짜</span><div className="my-trips-day-strip" role="group" aria-labelledby="my-trips-day-label">{target.days.map((item) => <Button key={item.day} variant={selectedDay === item.day ? 'primary' : 'secondary'} aria-pressed={selectedDay === item.day} onClick={() => { setSelectedDay(item.day); setError(''); }}><strong>DAY {item.day}</strong><span>{dateLabel(item)}</span></Button>)}</div></div> : <div className="my-trips-flow-empty"><p>이 여행에는 아직 날짜가 없습니다. 여행을 열어 날짜를 추가해 주세요.</p><Button variant="secondary" onClick={() => onOpenJourney(target.id)}>여행 열기<ChevronRight size={18} /></Button></div>)}
      {alreadyIncluded && <p className="my-trips-included" role="status"><Check size={18} />이미 DAY {selectedDay}에 담겨 있어요.</p>}
      <Button type="submit" disabled={!target || !day}>{alreadyIncluded ? '이 날짜 보기' : day ? `DAY ${day.day}에 담기` : '담을 날짜를 선택해 주세요'}<ChevronRight size={18} /></Button>
      <Button variant="ghost" onClick={onRequestCreate}><Plus size={18} />새 여행에 담기</Button>
    </form>)}

    {mode === 'create' && <form className="my-trips-flow-form" onSubmit={submitCreate}>
      <Field label="여행 이름"><input aria-label="여행 이름" autoComplete="off" maxLength={60} placeholder="예: 제주 주말 여행" value={title} onChange={(event) => setTitle(event.target.value)} required /></Field>
      <div className="my-trips-create-fields"><Field label="여행 기간"><select aria-label="새 여행 기간" value={period} onChange={(event) => setPeriod(Number(event.target.value))}>{Array.from({ length: 7 }, (_, index) => index + 1).map((days) => <option key={days} value={days}>{periodLabel(days)}</option>)}</select></Field><Field label="출발 날짜 (선택)"><input aria-label="출발 날짜" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></Field></div>
      <p className="my-trips-flow-note">{places.length ? `${places.length}곳을 DAY 1에 담아 시작합니다. 만든 여행에서 다른 날짜로 옮기거나 내용을 수정할 수 있어요.` : '빈 여행으로 시작합니다. 날짜별 장소와 내용은 만든 여행에서 추가할 수 있어요.'}</p>
      <Button type="submit">여행 만들기<ChevronRight size={18} /></Button>
    </form>}

    {mode === 'ai' && <div className="my-trips-flow-form">
      <Field label="여행 기간"><select aria-label="AI 여행 기간" value={period} onChange={(event) => setPeriod(Number(event.target.value))}>{Array.from({ length: 7 }, (_, index) => index + 1).map((days) => <option key={days} value={days}>{periodLabel(days)}</option>)}</select></Field>
      <p className="my-trips-ai-disclosure">현재는 거리 기반으로 순서를 정하는 로컬 시연입니다. 실제 AI·교통 정보는 연결되지 않았습니다.</p>
      {!places.length && <p className="my-trips-flow-note">저장한 장소에서 여행에 사용할 장소를 먼저 선택해 주세요.</p>}
      <Button disabled={!places.length} onClick={() => { if (!onGenerate(places, period)) setError('여행을 만들지 못했습니다. 장소와 저장 상태를 확인해 주세요.'); }}><Sparkles size={18} />이 장소로 여행 만들기</Button>
      <p className="my-trips-flow-note">만든 여행에서 날짜별 일정과 내용을 확인하고 수정할 수 있어요.</p>
    </div>}
    {error && <p className="my-trips-flow-error" role="alert">{error}</p>}
  </section>;
}
