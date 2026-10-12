import { BedDouble, Check, Coffee, MapPin, Trash2, Utensils } from 'lucide-react';
import type { Journey, Place } from './data';
import { BottomSheet } from './BottomSheet';
import { Button, IconButton } from './ui';
import { candidateSelection, confirmTripCandidates, currentCandidateVisit, KEEP_CURRENT, removeTripCandidate, selectTripCandidate, SKIP_CANDIDATES } from './tripCandidates';
import { planningSlotLabel } from './plannerTimeline';
import { useState } from 'react';
import { PhotoCredit } from './PublicTourismCredit';
import { candidateComparison, candidatePhoto } from './tripCandidatePresentation';
import { usePublicReview } from './publicReview';
import './trip-candidates.css';

function CandidateInformation({ place, image, anchor, status }: { place: Place; image: string; anchor?: Place; status?: string }) {
  const [failedImage, setFailedImage] = useState('');
  const { distance, features, description } = candidateComparison(place, anchor);
  const Icon = place.kind === 'STAY' ? BedDouble : place.kind === 'FOOD' ? Utensils : Coffee;
  return <span className="candidate-place-content">
    <span className="candidate-place-photo">{image && failedImage !== image
      ? <img src={image} alt={`${place.name} 등록 사진`} onError={() => setFailedImage(image)} />
      : <span className="candidate-photo-empty"><Icon size={22} aria-hidden="true"/><small>{image ? '사진 미표시' : '사진 없음'}</small></span>}</span>
    <span className="candidate-place-copy"><strong>{place.name}</strong><small className="candidate-distance">{distance}</small>
      {features.length > 0 && <span className="candidate-features" aria-label="등록된 특징">{features.map(feature => <small key={feature}>{feature}</small>)}</span>}
      {description && <span className="candidate-description">{description}</span>}
      {!features.length && !description && <small>상세 특징 미등록</small>}
      {place.address && <small className="candidate-address">{place.address}</small>}
      {status && <small className="candidate-selection-status">{status}</small>}
    </span>
  </span>;
}

export function TripCandidateReview({ journey, onChange, onClose }: { journey: Journey; onChange: (next: Journey) => boolean; onClose: () => void }) {
  const [error, setError] = useState('');
  const { state } = usePublicReview();
  const photo = (place: Place) => candidatePhoto(place, state.withdrawnImages);
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
            <p className="candidate-distance-basis">{anchor ? `${anchor.name} 기준 직선거리 · 이동 시간과 달라요` : '기준 장소 위치를 확인하면 거리를 비교할 수 있어요'}</p>
            {current && <div className="candidate-option"><label className="candidate-radio"><input type="radio" name={group.id} value={KEEP_CURRENT} checked={selected === KEEP_CURRENT} onChange={() => update(() => selectTripCandidate(journey, group.id, KEEP_CURRENT))}/><CandidateInformation place={current} image={photo(current)} anchor={anchor} status={current.bookingFixed ? '예약 고정 · 변경하지 않음' : '현재 일정 유지'}/></label><PhotoCredit image={photo(current)}/></div>}
            {group.options.map(({ place, fixed }) => <div className="candidate-option" key={place.id}><div className="candidate-choice-row"><label className="candidate-radio"><input type="radio" name={group.id} value={place.id} checked={selected === place.id} disabled={current?.bookingFixed} onChange={() => update(() => selectTripCandidate(journey, group.id, place.id))}/><CandidateInformation place={place} image={photo(place)} anchor={anchor} status={fixed ? '선택하면 예약 고정' : undefined}/></label><IconButton aria-label={`${place.name} · 후보에서 빼기`} variant="ghost" onClick={() => update(() => removeTripCandidate(journey, group.id, place.id))}><Trash2 size={16}/></IconButton></div><PhotoCredit image={photo(place)}/></div>)}
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
