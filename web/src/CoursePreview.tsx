import { useState, type ReactNode } from 'react';
import { ArrowLeft, Bookmark, ChevronRight, Clock3, Copy, ImageOff, MapPin, Map as MapIcon, Share2, Users } from 'lucide-react';
import type { Journey, Place } from './data';
import { placeKindLabel } from './data';
import { BottomSheet } from './BottomSheet';
import { DayNavigation } from './DayNavigation';
import { PhotoCredit } from './PublicTourismCredit';
import { SavedLandmarkDetailSheet } from './SavedLandmarkDetailSheet';
import { courseDayFacts, courseStayLabel } from './coursePreviewModel';
import './course-preview.css';

/** A course is a reusable visit order, not a journal or a claim of actual attendance. */
export default function CoursePreview({ journey, initialDay = 1, saved = false, onToggleSaved, onBack, onShare, onPersonal, onTogether, onUsePlace, renderMap }: {
  journey: Journey; initialDay?: number; onBack: () => void; onShare: () => void;
  saved?: boolean; onToggleSaved?: () => void;
  onPersonal: () => void; onTogether: () => void; onUsePlace?: (place: Place) => void;
  renderMap: (places: Place[]) => ReactNode;
}) {
  const [selectedDay, setSelectedDay] = useState(journey.days.some(day => day.day === initialDay) ? initialDay : journey.days[0]?.day ?? 1);
  const [mapOpen, setMapOpen] = useState(true), [useOpen, setUseOpen] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const day = journey.days.find(item => item.day === selectedDay) ?? journey.days[0];
  const facts = day && courseDayFacts(day);
  return <div className="course-preview">
    <header className="detail-topbar"><button type="button" onClick={onBack} aria-label="코스 목록으로"><ArrowLeft size={21}/></button><strong>여행 코스</strong><button type="button" onClick={onShare} aria-label="이 코스 공유"><Share2 size={20}/></button></header>
    <section className="course-preview__intro"><div><small>{journey.region} · {journey.duration}</small><h1>{journey.title}</h1><p>{journey.summary}</p><span>{journey.days.length}개 DAY · {journey.days.reduce((n,item) => n + item.places.length, 0)}곳 · 가져와 수정 가능</span></div>{journey.cover && <img src={journey.cover} alt=""/>}</section>
    {journey.cover && <div className="course-preview__credit"><PhotoCredit image={journey.cover}/></div>}
    <DayNavigation compact showBack={false} days={journey.days} selectedDay={day?.day ?? selectedDay} onSelect={setSelectedDay} onBack={onBack}/>
    {day && facts ? <section className="course-preview__day">
      <div className="course-preview__day-heading"><div><h2>DAY {day.day} · {facts.stopCount}곳</h2><p><Clock3 size={14}/>{courseStayLabel(facts.stayMinutes)}{facts.overnightCount ? ` · 숙소 ${facts.overnightCount}곳` : ''}</p></div><button type="button" className="course-preview__map-toggle" aria-expanded={mapOpen} onClick={() => setMapOpen(value => !value)}><MapIcon size={16}/>{mapOpen ? '지도 접기' : '동선 지도'}</button></div>
      <p className="course-preview__basis">등록된 체류시간 합계예요. 이동·대기 시간은 포함하지 않아요.{facts.unknownStays ? ` ${facts.unknownStays}곳은 체류시간 미등록이에요.` : ''}</p>
      {mapOpen && <div className="course-preview__map">{renderMap(day.places)}</div>}
      <ol className="course-preview__stops" aria-label={`DAY ${day.day} 방문 순서`}>{day.places.map((place,index) => <li key={place.visitId ?? `${place.id}-${index}`}><span className="course-preview__number">{index + 1}</span><button type="button" onClick={() => setSelectedPlace(place)} aria-label={`${index + 1}번째 ${place.name} 상세`}><span className="course-preview__photo">{place.image ? <img src={place.image} alt="" loading="lazy"/> : <ImageOff size={22}/>}</span><span className="course-preview__stop-copy"><small>{placeKindLabel[place.kind]}{place.duration ? ` · ${place.duration}` : ''}</small><strong>{place.name}</strong><span>{place.address || place.area}</span></span><ChevronRight size={18}/></button></li>)}</ol>
      {!day.places.length && <p className="course-preview__basis">이 DAY에 등록된 장소가 없어요. 내 여행으로 가져와 채울 수 있어요.</p>}
    </section> : <p className="course-preview__basis">등록된 DAY가 없어요.</p>}
    <p className="course-preview__notice">방문 순서를 살펴보는 코스예요. 운영·예약 정보는 방문 전에 확인하고, 날짜와 장소는 가져온 뒤 바꿀 수 있어요.</p>
    <footer className="course-preview__footer" data-can-save={Boolean(onToggleSaved)}>{onToggleSaved && <button type="button" className="course-preview__save" aria-label={saved ? '코스 저장 해제' : '나중에 쓸 코스 저장'} aria-pressed={saved} onClick={onToggleSaved}><Bookmark size={18} fill={saved ? 'currentColor' : 'none'} aria-hidden="true"/>{saved ? '저장됨' : '코스 저장'}</button>}<button type="button" className="primary wide" disabled={!journey.days.length} onClick={() => setUseOpen(true)}><Copy size={18}/>이 코스 사용하기</button></footer>
    {selectedPlace && <SavedLandmarkDetailSheet place={selectedPlace} onClose={() => setSelectedPlace(null)} actions={onUsePlace ? <button type="button" className="primary wide place-use-action" onClick={() => { const place = selectedPlace; setSelectedPlace(null); onUsePlace(place); }}><MapPin size={18}/>여행·약속에 담기</button> : undefined}/>}
    {useOpen && <BottomSheet title="이 코스를 어디에 쓸까요?" onClose={() => setUseOpen(false)}><div className="course-preview__destinations"><button type="button" onClick={() => { setUseOpen(false); onPersonal(); }}><Copy size={22}/><span><strong>내 여행으로 가져오기</strong><small>나만의 일정으로 날짜와 장소를 수정해요.</small></span><ChevronRight size={18}/></button><button type="button" onClick={() => { setUseOpen(false); onTogether(); }}><Users size={22}/><span><strong>이 코스로 약속 만들기</strong><small>내 모임에서 만들거나 친구·가족과 새로 시작해요.</small></span><ChevronRight size={18}/></button></div></BottomSheet>}
  </div>;
}
