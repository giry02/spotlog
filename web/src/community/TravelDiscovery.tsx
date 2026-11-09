import { useId, useState } from 'react';
import { BookOpen, ChevronRight, ImageOff, Plus, Route } from 'lucide-react';
import type { HomeTripTemplate } from '../consumerPublicSeed';
import { interestPlaceRegion } from '../interestCollectionStore';
import { homeTravelDurations, matchesHomeTravelDuration, type HomeTravelDuration } from './travelHomeModel';
import './travel-discovery.css';

export interface TravelDiscoveryProps {
  templates: ReadonlyArray<HomeTripTemplate>;
  region: string;
  query: string;
  onOpen: (template: HomeTripTemplate) => void;
  onMyTrips: () => void;
  onCreateTrip: () => void;
  onJournals: () => void;
  duration?: HomeTravelDuration;
  onDurationChange?: (duration: HomeTravelDuration) => void;
}

const normalized = (value: string) => value.normalize('NFKC').trim().toLocaleLowerCase('ko-KR');

/** Display filters only. The caller supplies approved public templates in their intended order. */
export function filterTravelTemplates(templates: ReadonlyArray<HomeTripTemplate>, region: string, query: string): HomeTripTemplate[] {
  const selected = region.trim(), search = normalized(query);
  return templates.filter(template => {
    if (selected && template.region !== selected && !template.places.some(place => interestPlaceRegion(place) === selected)) return false;
    return !search || normalized([template.title, template.region, template.eyebrow, template.summary, template.duration,
      ...template.places.flatMap(place => [place.name, place.area])].join(' ')).includes(search);
  });
}

function Cover({ template }: { template: HomeTripTemplate }) {
  const [failed, setFailed] = useState('');
  return template.cover && failed !== template.cover
    ? <img src={template.cover} alt="" loading="lazy" onError={() => setFailed(template.cover)}/>
    : <span className="travel-discovery__image-empty" aria-hidden="true"><ImageOff size={24}/></span>;
}

export default function TravelDiscovery({ templates, region, query, onOpen, onMyTrips, onCreateTrip, onJournals, duration = 'ALL', onDurationChange }: TravelDiscoveryProps) {
  const uid = useId();
  const visible = filterTravelTemplates(templates, region, query).filter(template => matchesHomeTravelDuration(template.dayCount, duration));
  const filtered = Boolean(region.trim() || query.trim() || duration !== 'ALL');
  return <section className="travel-discovery" aria-labelledby={`${uid}-title`}>
    <div className="travel-discovery__actions" aria-label="여행 바로가기">
      <button type="button" onClick={onMyTrips}><Route size={17} aria-hidden="true"/><span>내 여행</span></button>
      <button type="button" aria-label="여행 만들기" onClick={onCreateTrip}><Plus size={17} aria-hidden="true"/><span>새 여행</span></button>
      <button type="button" aria-label="여행기 보기" onClick={onJournals}><BookOpen size={17} aria-hidden="true"/><span>여행기</span></button>
    </div>
    {onDurationChange && <div className="travel-discovery__durations" role="group" aria-label="여행 일정 기간">{homeTravelDurations.map(item => <button key={item.id} type="button" aria-pressed={item.id === duration} onClick={() => onDurationChange(item.id)}>{item.label}</button>)}</div>}
    <div className="travel-discovery__list-heading"><h2 id={`${uid}-title`}>{region.trim() ? `${region.trim()}의 추천 여행` : '추천 여행 일정'}</h2><span>{visible.length}개</span></div>
    {visible.length ? <div className="travel-discovery__list">{visible.map(template => <article className="travel-discovery__row" key={template.id}>
      <button type="button" onClick={() => onOpen(template)} aria-label={`${template.title} 여행 일정 미리보기`}>
        <span className="travel-discovery__image"><Cover template={template}/></span>
        <span className="travel-discovery__copy"><span className="travel-discovery__meta">{template.region} · {template.duration}</span><strong>{template.title}</strong><span className="travel-discovery__summary">{template.summary}</span></span>
        <ChevronRight size={17} aria-hidden="true"/>
      </button>
    </article>)}</div> : <div className="travel-discovery__empty"><Route size={24} aria-hidden="true"/><p>{filtered ? '선택한 조건에 맞는 공개 여행 일정이 없어요.' : '공개 여행 일정을 준비하고 있어요.'}</p>{filtered && <span>위에서 지역이나 검색어를 바꾸어 찾아보세요.</span>}</div>}
  </section>;
}
