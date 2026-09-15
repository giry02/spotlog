import { useMemo, useState, type FormEvent } from 'react';
import { Check, Plus } from 'lucide-react';
import { BottomSheet } from './BottomSheet';
import { Button, Field } from './ui';
import { LandmarkGuideCard } from './LandmarkGuideCard';
import type { Journey, Place } from './data';
import { tripPeriodLabel, type TripPlacementRequest } from './tripPlacement';
import './trip-placement.css';

interface AddToTripSheetProps {
  places: Place[];
  journeys: Journey[];
  initialJourneyId?: string | null;
  initialDay?: number;
  onClose: () => void;
  /** The owner saves atomically, then closes/navigates after BottomSheet history cleanup. */
  onConfirm: (request: TripPlacementRequest) => string | null;
  onRemove?: (journeyId: string, dayNumber: number, visitId: string) => string | null;
}

export function AddToTripSheet({ places, journeys, initialJourneyId, initialDay = 1, onClose, onConfirm, onRemove }: AddToTripSheetProps) {
  const mine = journeys.filter((journey) => journey.isMine);
  const initialJourney = initialJourneyId === null ? undefined : mine.find((journey) => journey.id === initialJourneyId) ?? mine[0];
  const [journeyId, setJourneyId] = useState(initialJourney?.id ?? '');
  const [dayCount, setDayCount] = useState(2);
  const [targetDay, setTargetDay] = useState(initialJourney?.days.some((day) => day.day === initialDay) ? initialDay : initialJourney?.days[0]?.day ?? 1);
  const region = [...new Set(places.map((place) => place.area.trim().split(/\s+/)[0]))].filter(Boolean).join(' · ') || '국내';
  const [title, setTitle] = useState(`${region} 여행`);
  const [startDate, setStartDate] = useState('');
  const [error, setError] = useState('');
  const selected = mine.find((journey) => journey.id === journeyId);
  const isNew = journeyId === '';
  const uniquePlaces = useMemo(() => [...new Map(places.map((place) => [place.id, place])).values()], [places]);
  const days = isNew ? Array.from({ length: dayCount }, (_, index) => {
    const date = startDate ? new Date(`${startDate}T00:00:00Z`) : null;
    if (date && Number.isFinite(date.getTime())) date.setUTCDate(date.getUTCDate() + index);
    return { day: index + 1, date: date && Number.isFinite(date.getTime()) ? `${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일` : '' };
  }) : selected?.days ?? [];
  const chosenDay = selected?.days.find((day) => day.day === targetDay);
  const includedVisits = chosenDay?.places.filter((visit) => uniquePlaces.some((place) => place.id === visit.id)) ?? [];
  const alreadyCount = uniquePlaces.filter((place) => chosenDay?.places.some((visit) => visit.id === place.id)).length;
  const canConfirm = uniquePlaces.length > 0 && days.some((day) => day.day === targetDay) && (!isNew || Boolean(title.trim()));

  const selectJourney = (id: string) => {
    setJourneyId(id); setError('');
    const next = mine.find((journey) => journey.id === id);
    setTargetDay(next?.days[0]?.day ?? 1);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canConfirm) return;
    const result = onConfirm({ journeyId: isNew ? null : journeyId, title, region, dayCount: isNew ? dayCount : selected!.days.length, startDate, targetDay, places: uniquePlaces });
    setError(result ?? '');
  };

  return <BottomSheet title="내 여행에 담기" description={uniquePlaces.length === 1 ? uniquePlaces[0].name : `선택한 ${uniquePlaces.length}곳을 담아요`} onClose={onClose}>
    <form className="trip-placement-form" onSubmit={submit}>
      <div className="landmark-guide-list trip-placement-places" aria-label="담을 장소 확인">
        {uniquePlaces.map((place) => {
          const visits = includedVisits.filter((visit) => visit.id === place.id);
          const otherPlacements = mine.flatMap((journey) => journey.days.filter((day) => !(journey.id === selected?.id && day.day === targetDay) && day.places.some((visit) => visit.id === place.id)).map((day) => `${journey.title} DAY ${day.day}`));
          return <LandmarkGuideCard key={place.id} place={place}
            actions={onRemove && selected && visits.some((visit) => visit.visitId) ? <>{visits.filter((visit) => visit.visitId).map((visit) => <Button key={visit.visitId} size="card" className="trip-placement-card-remove" onClick={() => setError(onRemove(selected.id, targetDay, visit.visitId!) ?? '')} aria-label={`${place.name} DAY ${targetDay} 담김 해제`}><Check size={16} />DAY {targetDay} 담김 해제</Button>)}</> : null}
            footer={<div className="trip-placement-card-state" aria-live="polite"><p className={visits.length ? 'is-included' : ''}>{visits.length ? <><Check size={14} />선택한 여행 DAY {targetDay}에 담김</> : <>DAY {targetDay}에 담을 장소</>}</p>{otherPlacements.length > 0 && <small>다른 일정에도 담김 · {otherPlacements.join(' · ')}</small>}</div>} />;
        })}
        {!uniquePlaces.length && <p className="phase-hint">담을 장소가 없어요. 장소를 선택한 뒤 다시 열어 주세요.</p>}
      </div>
      {mine.length > 0 && <Field label="담을 여행"><select value={journeyId} onChange={(event) => selectJourney(event.target.value)}>
        {mine.map((journey) => { const included = journey.days.filter((day) => day.places.some((place) => uniquePlaces.some((selectedPlace) => selectedPlace.id === place.id))); return <option key={journey.id} value={journey.id}>{journey.title}{included.length ? ` · DAY ${included.map((day) => day.day).join(', ')} 담김` : ''}</option>; })}
        <option value="">＋ 새 여행 만들기</option>
      </select></Field>}
      {isNew && <>
        <Field label="여행 제목"><input value={title} maxLength={80} onChange={(event) => { setTitle(event.target.value); setError(''); }} placeholder={`${region} 여행`} required /></Field>
        <Field label="여행 기간"><select value={dayCount} onChange={(event) => { const count = Number(event.target.value); setDayCount(count); setTargetDay((day) => Math.min(day, count)); setError(''); }}>
          {Array.from({ length: 7 }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{tripPeriodLabel(count)}</option>)}
        </select></Field>
        <Field label="출발 날짜 (선택)" hint="날짜를 아직 몰라도 DAY별로 담을 수 있어요."><input type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); setError(''); }} /></Field>
      </>}
      <div className="trip-placement-day-field">
        <p className="ui-field-label">담을 날짜{!isNew && selected && <span> · {tripPeriodLabel(selected.days.length)}</span>}</p>
        <div className="phase-day-options" role="group" aria-label="담을 DAY">
          {days.map((day) => <button key={day.day} type="button" className={targetDay === day.day ? 'active' : ''} aria-pressed={targetDay === day.day} onClick={() => { setTargetDay(day.day); setError(''); }}>
            <span>DAY {day.day}{selected?.days.find((item) => item.day === day.day)?.places.some((place) => uniquePlaces.some((candidate) => candidate.id === place.id)) ? ' · 담김' : ''}</span>{day.date && day.date !== `DAY ${day.day}` && <small>{day.date}</small>}
          </button>)}
        </div>
        {!days.length && <p className="phase-hint">내 여행에서 날짜를 추가한 뒤 담아 주세요.</p>}
        {alreadyCount > 0 && <p className="trip-placement-included"><Check size={14} />{alreadyCount === uniquePlaces.length ? `이미 DAY ${targetDay}에 담겨 있어요.` : `${alreadyCount}곳은 이미 담겨 있어 나머지 장소만 추가해요.`}</p>}
      </div>
      <p className="phase-hint trip-placement-note">{isNew ? '만들면 내 여행에서 이어서 일정을 수정할 수 있어요.' : '담은 뒤 내 여행의 선택한 DAY로 이동해요.'}</p>
      {error && <p className="ui-error" role="alert">{error}</p>}
      <Button type="submit" disabled={!canConfirm}>
        {alreadyCount === uniquePlaces.length && uniquePlaces.length > 0 ? <Check size={17} /> : <Plus size={17} />}
        {alreadyCount === uniquePlaces.length && uniquePlaces.length > 0 ? `DAY ${targetDay} 보기` : isNew ? `여행 만들고 DAY ${targetDay}에 담기` : `DAY ${targetDay}에 담기`}
      </Button>
    </form>
  </BottomSheet>;
}
