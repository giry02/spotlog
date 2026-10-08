import { BedDouble, Check, Coffee, MapPin, Trash2, Utensils } from 'lucide-react';
import type { Journey } from './data';
import { BottomSheet } from './BottomSheet';
import { Button, IconButton } from './ui';
import { candidateSelection, confirmTripCandidates, currentCandidateVisit, KEEP_CURRENT, removeTripCandidate, selectTripCandidate, SKIP_CANDIDATES } from './tripCandidates';
import { planningSlotLabel } from './plannerTimeline';
import { useState } from 'react';
import './trip-candidates.css';

export function TripCandidateReview({ journey, onChange, onClose }: { journey: Journey; onChange: (next: Journey) => boolean; onClose: () => void }) {
  const [error, setError] = useState('');
  const groups = journey.businessCandidates ?? [];
  const unresolved = groups.filter(group => !candidateSelection(journey, group)).length;
  const update = (operation: () => Journey) => { try { if (onChange(operation())) setError(''); else setError('저장하지 못했어요. 선택한 후보는 유지돼요.'); } catch (error) { setError(error instanceof Error ? error.message : '다시 확인해 주세요.'); } };
  return <BottomSheet title="여행 마지막 확인" description="후보 묶음마다 한 곳만 골라요. 나머지 방문 일정은 유지해요." onClose={onClose}>
    <div className="trip-candidate-review">
      {journey.days.map(day => <section key={day.dayId} className="candidate-review-day">
        <h3>DAY {day.day}</h3><p className="candidate-route-summary"><MapPin size={14}/>{day.places.filter(place => place.kind === 'LANDMARK').map(place => place.name).join(' → ') || '등록된 방문 일정'}</p>
        {groups.filter(group => group.dayId === day.dayId).map(group => {
          const current = currentCandidateVisit(journey, group), selected = candidateSelection(journey, group);
          const anchor = journey.days.flatMap(day => day.places).find(place => place.visitId === group.anchorVisitId);
          const Icon = group.kind === 'STAY' ? BedDouble : group.kind === 'FOOD' ? Utensils : Coffee;
          const label = group.kind === 'STAY' ? `DAY ${day.day} 밤 · 숙소` : `${anchor?.name} 방문 후 · ${group.slot ? planningSlotLabel(group.slot, false) + ' · ' : ''}${group.kind === 'FOOD' ? '음식점' : '카페'}`;
          return <fieldset key={group.id} className="candidate-choice-group"><legend><Icon size={16}/>{label}</legend>
            {current && <label className="candidate-radio"><input type="radio" name={group.id} value={KEEP_CURRENT} checked={selected === KEEP_CURRENT} onChange={() => update(() => selectTripCandidate(journey, group.id, KEEP_CURRENT))}/><span><strong>{current.name}</strong><small>{current.bookingFixed ? '예약 고정 · 변경하지 않음' : '현재 일정 유지'}</small></span></label>}
            {group.options.map(({ place, fixed }) => <div className="candidate-choice-row" key={place.id}><label className="candidate-radio"><input type="radio" name={group.id} value={place.id} checked={selected === place.id} disabled={current?.bookingFixed} onChange={() => update(() => selectTripCandidate(journey, group.id, place.id))}/><span><strong>{place.name}</strong><small>{place.address}{fixed ? ' · 예약 고정' : ''}</small></span></label><IconButton aria-label={`${place.name} · 후보에서 빼기`} variant="ghost" onClick={() => update(() => removeTripCandidate(journey, group.id, place.id))}><Trash2 size={16}/></IconButton></div>)}
            {!current?.bookingFixed && <label className="candidate-radio candidate-skip"><input type="radio" name={group.id} value={SKIP_CANDIDATES} checked={selected === SKIP_CANDIDATES} onChange={() => update(() => selectTripCandidate(journey, group.id, SKIP_CANDIDATES))}/><span>이번 후보는 제외{current ? ' · 현재 일정 유지' : ''}</span></label>}
          </fieldset>;
        })}
      </section>)}
      {!groups.length && <p className="plan-help">담은 랜드마크로 바로 만들 수 있어요. 음식점·숙소는 나중에 추가해도 돼요.</p>}
      {error && <p className="ui-error" role="alert">{error}</p>}
      <div className="candidate-confirm"><p role="status">{unresolved ? `${unresolved}개 후보 묶음에서 한 곳을 골라주세요.` : '선택한 곳만 일정에 반영돼요.'}</p><Button disabled={unresolved > 0} onClick={() => { try { if (onChange(confirmTripCandidates(journey))) onClose(); else setError('완성하지 못했어요. 후보와 일정은 그대로예요.'); } catch (error) { setError(error instanceof Error ? error.message : '다시 확인해 주세요.'); } }}><Check size={17}/>{journey.planStage === 'DRAFT' ? '내 여행 완성' : '선택한 후보 반영'}</Button></div>
    </div>
  </BottomSheet>;
}
