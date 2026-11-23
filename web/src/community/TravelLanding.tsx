import { useId, useMemo, useState } from 'react';
import { BookOpen, Bookmark, CalendarDays, ChevronRight, ImageOff, MapPin, Plus, Route } from 'lucide-react';
import type { Journey, Place } from '../data';
import type { HomeTripTemplate } from '../consumerPublicSeed';
import type { HomeRegionReference } from '../homeDiscovery';
import { interestKindLabels } from '../interestCollectionStore';
import TravelDiscovery from './TravelDiscovery';
import TravelHomeSections from './TravelHomeSections';
import { homeJournalSourceLabel, homeTravelDurations, type HomeTravelDuration } from './travelHomeModel';
import { selectTravelLandingContent, travelLandingSection, type TravelSection } from './travelLandingModel';
import './travel-landing.css';

export interface TravelLandingProps {
  templates: ReadonlyArray<HomeTripTemplate>;
  journals: ReadonlyArray<Journey>;
  places: ReadonlyArray<Place>;
  references: ReadonlyArray<HomeRegionReference>;
  region: string; query: string; duration?: HomeTravelDuration;
  onDurationChange: (duration: HomeTravelDuration) => void;
  onRegionChange: (region: string) => void;
  onClearFilters?: () => void;
  onOpen: (template: HomeTripTemplate) => void;
  onOpenJournal: (id: string) => void;
  onMyTrips: () => void; onCreateTrip: () => void; onJournals: () => void;
  onPlaces: () => void; onSavedPlaces: () => void; onOpenPlace?: (place: Place) => void;
  onTryCourse?: (id: string) => void;
  savedCourseIds?: readonly string[]; onToggleCourseSaved?: (id: string) => void;
  section?: TravelSection; onSectionChange?: (section: TravelSection) => void;
}

export type { TravelSection } from './travelLandingModel';
const sections: ReadonlyArray<{ id: TravelSection; label: string }> = [
  { id: 'recommended', label: '추천' }, { id: 'courses', label: '여행 코스' }, { id: 'journals', label: '여행기' },
];

function Thumbnail({ src }: { src: string }) {
  const [failed, setFailed] = useState('');
  return src && failed !== src ? <img src={src} alt="" loading="lazy" onError={() => setFailed(src)}/>
    : <span className="travel-landing__no-photo" aria-hidden="true"><ImageOff size={22}/></span>;
}

/** The travel tab's public subhome. App retains all search, region and period state and destination actions. */
export default function TravelLanding({ templates, journals, places, references, region, query, duration = 'ALL', onDurationChange, onClearFilters,
  onOpen, onOpenJournal, onMyTrips, onCreateTrip, onJournals, onPlaces, onSavedPlaces, onOpenPlace, onTryCourse, savedCourseIds, onToggleCourseSaved, section: suppliedSection, onSectionChange }: TravelLandingProps) {
  const uid = useId(), [localSection, setLocalSection] = useState<TravelSection>('recommended');
  const section = travelLandingSection(suppliedSection ?? localSection);
  const setSection = (next: TravelSection) => { setLocalSection(next); onSectionChange?.(next); };
  const projection = useMemo(() => selectTravelLandingContent(templates, journals, places, references, { region, query, duration }),
    [templates, journals, places, references, region, query, duration]);
  const safeTemplates = projection.templates;
  const durationLabel = homeTravelDurations.find(item => item.id === duration)?.label || '기간 전체';
  const filtered = Boolean(region.trim() || query.trim() || duration !== 'ALL');
  const openCourse = (id: string) => { const template = safeTemplates.find(item => item.id === id); if (template) onOpen(template); };
  const shownPlaces = projection.places.slice(0, 3);
  return <div className="travel-landing">
    <nav className="travel-landing__tabs" aria-label="여행에서 볼 내용">{sections.map(item => <button type="button" key={item.id} aria-pressed={section === item.id} onClick={() => setSection(item.id)}>{item.label}</button>)}</nav>
    <div className="travel-landing__toolbar">
      <div className="travel-landing__actions" role="group" aria-label="여행 빠른 실행">
        <button type="button" className="travel-landing__create" onClick={onCreateTrip}><Plus size={17} aria-hidden="true"/>여행 만들기</button>
        <div className="travel-landing__quick">
          <button type="button" onClick={onMyTrips}><Route size={17} aria-hidden="true"/><span>내 여행</span></button>
          <button type="button" onClick={onSavedPlaces}><Bookmark size={17} aria-hidden="true"/><span>보관함</span></button>
        </div>
      </div>
      <div className="travel-landing__browse">
        <label className="travel-landing__period"><CalendarDays size={17} aria-hidden="true"/><select aria-label="여행 일정 기간" value={duration} onChange={event => onDurationChange(event.target.value as HomeTravelDuration)}>{homeTravelDurations.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <button type="button" onClick={onPlaces}><MapPin size={17} aria-hidden="true"/>장소 둘러보기</button>
      </div>
    </div>
    {filtered && <div className="travel-landing__conditions" aria-label="적용된 여행 조건"><span>{region || '전체 지역'}{duration !== 'ALL' ? ` · ${durationLabel}` : ''}{query.trim() ? ` · “${query.trim()}”` : ''}</span>{duration !== 'ALL' && <button type="button" onClick={() => onDurationChange('ALL')}>기간 전체 보기</button>}</div>}
    <div className="travel-landing__body" aria-live="polite" aria-atomic="false">
      {section === 'recommended' && <>
        <TravelHomeSections onTryCourse={onTryCourse} savedCourseIds={savedCourseIds} onToggleCourseSaved={onToggleCourseSaved} courses={projection.courses} journals={projection.journals} onOpenCourse={openCourse} onOpenJournal={id => { if (projection.journals.some(item => item.id === id)) onOpenJournal(id); }} onMoreCourses={() => setSection('courses')} onMoreJournals={() => setSection('journals')}/>
        {!projection.courses.length && !projection.journals.length && <div className="travel-landing__empty"><Route size={24} aria-hidden="true"/><p>선택한 조건의 공개 코스와 여행기가 없어요.</p>{filtered && onClearFilters && <button type="button" onClick={onClearFilters}>여행 조건 초기화</button>}</div>}
        <section className="travel-landing__section" aria-labelledby={`${uid}-places`}><div className="travel-landing__heading"><h2 id={`${uid}-places`}>{region ? `${region}에서 들를 만한 곳` : '여행에 담고 싶은 장소'}</h2><button type="button" onClick={onPlaces}>더 보기<ChevronRight size={16}/></button></div>
          {shownPlaces.length ? <div className="travel-landing__places">{shownPlaces.map(place => <article className="travel-landing__place" key={place.id}><button type="button" onClick={() => onOpenPlace ? onOpenPlace(place) : onPlaces()}><span className="travel-landing__place-photo"><Thumbnail src={place.image}/></span><span className="travel-landing__place-copy"><small>{interestKindLabels[place.kind]} · {place.area}</small><strong>{place.name}</strong><span>{place.hook || place.description}</span></span><ChevronRight size={17} aria-hidden="true"/></button></article>)}</div> : <p className="travel-landing__none">이 조건의 공개 장소를 준비하고 있어요.</p>}
        </section>
      </>}
      {section === 'courses' && <TravelDiscovery templates={safeTemplates} region={region} query={query} duration={duration} onOpen={onOpen} onMyTrips={onMyTrips} onCreateTrip={onCreateTrip} onJournals={onJournals} onClearFilters={onClearFilters} showActions={false} preFiltered/>}
      {section === 'journals' && <section className="travel-landing__section" aria-labelledby={`${uid}-journals`}>
        <div className="travel-landing__heading"><h2 id={`${uid}-journals`}>{region ? `${region}의 공개 여행기` : '공개 여행기'}</h2><button type="button" onClick={onJournals}>더 보기<ChevronRight size={16}/></button></div>
        <p className="travel-landing__journal-guide">여행의 장면과 동선을 읽고, 내 여행에 담아보세요.</p>
        {projection.journals.length ? <div className="travel-landing__journals">{projection.journals.slice(0, 8).map(journal => <article className="travel-landing__journal" key={journal.id}><button type="button" onClick={() => onOpenJournal(journal.id)} aria-label={`${journal.title} · ${homeJournalSourceLabel(journal.sourceKind)} 보기`}><span className="travel-landing__journal-photo"><Thumbnail src={journal.cover}/></span><span className="travel-landing__journal-copy"><small>{homeJournalSourceLabel(journal.sourceKind)} · {journal.region}</small><strong>{journal.title}</strong><span>{journal.duration} · {journal.placeCount}곳{journal.sourceKind === 'SERVER' && journal.author ? ` · ${journal.author}` : ''}</span></span><ChevronRight size={17} aria-hidden="true"/></button></article>)}</div> : <div className="travel-landing__empty"><BookOpen size={24} aria-hidden="true"/><p>선택한 조건의 공개 여행기가 없어요.</p>{filtered && onClearFilters && <button type="button" onClick={onClearFilters}>여행 조건 초기화</button>}</div>}
        {projection.journals.length > 8 && <button type="button" className="travel-landing__all-journals" onClick={onJournals}>공개 여행기 모두 보기<ChevronRight size={17}/></button>}
      </section>}
    </div>
  </div>;
}
