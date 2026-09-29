import { useState } from 'react';
import { ArrowDown, ArrowUp, ArrowLeft, MapPin, Plus, Trash2 } from 'lucide-react';
import type { Journey, Place } from './data';
import { DayNavigation } from './DayNavigation';
import { BottomSheet } from './BottomSheet';
import { PhotoCredit } from './PublicTourismCredit';
import { NearbyBusinessSheet } from './NearbyBusinessSheet';
import { appendPlanLandmark, insertNearby, normalizePlan, removePlanVisit, reorderPlanVisit } from './tripPlan';
import './trip-plan.css';
import './personal-trip-refinement.css';

export function PersonalTrip({ journey: input, initialDay = 1, catalog, savedPlaces, onBack, onChange, onAddLandmark }: { journey: Journey; initialDay?: number; catalog: Place[]; savedPlaces: Place[]; onBack: () => void; onChange: (next: Journey) => boolean; onAddLandmark: () => void }) {
  const journey = normalizePlan(input);
  const [selectedDay, setSelectedDay] = useState(initialDay);
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Place | null>(null);
  const [addingLandmark, setAddingLandmark] = useState(false);
  const [status, setStatus] = useState('');
  const day = journey.days.find(day => day.day === selectedDay) ?? journey.days[0];
  const anchor = day?.places.find(place => place.visitId === anchorId);
  const independentStops = day?.places.filter(place => !place.anchorVisitId || !day.places.some(parent => parent.visitId === place.anchorVisitId)) ?? [];
  const save = (next: Journey) => { const saved = onChange(next); setStatus(saved ? '변경한 일정을 저장했어요' : '저장하지 못했어요. 이전 일정은 그대로예요.'); return saved; };
  if (!day) return <div className="page"><button onClick={onBack}>내 여행으로</button><p>일정을 확인할 수 없어요.</p></div>;
  const remove = (related: boolean) => { if (removing?.visitId && save(removePlanVisit(journey, removing.visitId, related))) setRemoving(null); };
  return <div className="personal-trip">
    <header className="editor-topbar"><button onClick={onBack} aria-label="내 여행 목록"><ArrowLeft size={20} /></button><div><small>나를 위한 동선</small><strong>{journey.title}</strong></div><span className="plan-private">비공개</span></header>
    {journey.cover && <div className="plan-cover"><img src={journey.cover} alt="" /><div><span>{journey.region}</span><h1>{journey.title}</h1><p>{journey.duration} · {journey.days.reduce((n, day) => n + day.places.length, 0)}곳</p></div></div>}
    <DayNavigation days={journey.days} selectedDay={day.day} onSelect={next => { setSelectedDay(next); setAnchorId(null); }} onBack={onBack} />
    <section className="plan-day"><div className="section-heading"><div><h2>DAY {day.day}</h2><p>가고 싶은 곳과 주변 업체를 하나씩 채워보세요.</p></div></div>
      <div className="plan-stops">{day.places.map((place, index) => <article key={place.visitId} className={`plan-stop ${place.anchorVisitId ? 'plan-stop-related' : ''}`}>
        <div className="plan-stop-main"><span className="plan-stop-number">{index + 1}</span>{place.image ? <img src={place.image} alt="" /> : <span className="plan-image-empty"><MapPin size={22} /></span>}<div><small>{place.anchorVisitId ? '함께 담은 곳' : place.kind === 'LANDMARK' ? '랜드마크' : '방문 장소'}</small><h3>{place.name}</h3><p>{place.address || '주소 확인 필요'}</p></div></div>
        <PhotoCredit image={place.image} />
        <div className="plan-stop-actions">{place.kind === 'LANDMARK' && <button className="outline" onClick={() => setAnchorId(place.visitId!)}><Plus size={16} />주변 업체</button>}<span />{!place.anchorVisitId && <><button aria-label={`${place.name} 위로 이동`} disabled={independentStops[0]?.visitId === place.visitId} onClick={() => save(reorderPlanVisit(journey, day.dayId!, place.visitId!, -1))}><ArrowUp size={16} /></button><button aria-label={`${place.name} 아래로 이동`} disabled={independentStops[independentStops.length - 1]?.visitId === place.visitId} onClick={() => save(reorderPlanVisit(journey, day.dayId!, place.visitId!, 1))}><ArrowDown size={16} /></button></>}<button aria-label={`${place.name} 일정에서 제거`} onClick={() => setRemoving(place)}><Trash2 size={16} /></button></div>
      </article>)}</div>
      {!day.places.length && <div className="empty"><MapPin size={24} /><strong>이날 가고 싶은 곳을 담아보세요</strong><p>글을 작성하지 않아도 여행을 만들 수 있어요.</p></div>}
      <button className="outline wide" onClick={() => setAddingLandmark(true)}><Plus size={17} />저장한 랜드마크 담기</button>
      {status && <p className="plan-help" role="status">{status}</p>}
    </section>
    {anchor && <NearbyBusinessSheet journey={journey} dayId={day.dayId!} anchor={anchor} catalog={catalog} onClose={() => setAnchorId(null)} onAdd={place => { try { if (!save(insertNearby(journey, day.dayId!, anchor.visitId!, place))) return false; setAnchorId(null); return true; } catch (error) { setStatus(error instanceof Error ? error.message : '담지 못했어요.'); return false; } }} />}
    {removing && <BottomSheet title="일정에서 빼기" description={`${removing.name}을 일정에서 뺄까요? 저장한 장소는 유지돼요.`} onClose={() => setRemoving(null)}><div className="plan-form"><button className="primary" onClick={() => remove(false)}>이 장소만 빼기</button>{day.places.some(place => place.anchorVisitId === removing.visitId) && <button className="outline" onClick={() => remove(true)}>함께 담은 업체도 빼기</button>}</div></BottomSheet>}
    {addingLandmark && <BottomSheet title={`DAY ${day.day}에 장소 담기`} description="저장한 랜드마크에서 고르세요." onClose={() => setAddingLandmark(false)}><div className="plan-form plan-place-choices">{savedPlaces.filter(place => place.kind === 'LANDMARK').map(place => <button key={place.id} disabled={day.places.some(visit => visit.id === place.id)} onClick={() => { if (save(appendPlanLandmark(journey, day.dayId!, place))) setAddingLandmark(false); }}>{place.image && <img src={place.image} alt="" />}<span>{place.name}</span>{day.places.some(visit => visit.id === place.id) ? '담김' : '담기'}</button>)}{!savedPlaces.some(place => place.kind === 'LANDMARK') && <><p className="plan-help">장소를 먼저 저장하면 여기서 바로 담을 수 있어요.</p><button className="outline" onClick={onAddLandmark}>장소 둘러보기</button></>}</div></BottomSheet>}
  </div>;
}
