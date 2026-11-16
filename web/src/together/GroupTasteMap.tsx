import { lazy, Suspense, useState } from 'react';
import { ChevronRight, List, Map, MapPin, SlidersHorizontal, Star, ThumbsUp } from 'lucide-react';
import type { Place, PlaceKind } from '../data';
import { getPlacePhotos } from '../PhotoPlaceCard';
import type { TogetherState } from './model';
import { businessPurposes, placeExperienceTags, type BusinessPurpose, type PlaceExperienceTag } from './businessAssessments';
import { resolveGroupTasteSource, selectGroupTasteMemory, type GroupTasteFilters, type GroupTasteRecord, type GroupTasteSource } from './groupTasteMemory';
import './group-taste-map.css';

const TasteMap = lazy(() => import('../InterestPlacesMap'));
const kindNames: Record<PlaceKind, string> = { LANDMARK: '명소', FOOD: '음식점', CAFE: '카페', STAY: '숙소', SHOP: '쇼핑', LEISURE: '레저' };
export interface GroupTasteMapProps {
  state: TogetherState; userId: string; groupId: string; places: Place[];
  onOpenPlace: (place: Place, activityId?: string) => void;
  onBrowse: () => void;
  onOpenActivity?: (activityId: string) => void;
}

export default function GroupTasteMap(props: GroupTasteMapProps) {
  return <GroupTasteMapBody key={`${props.userId}:${props.groupId}`} {...props}/>;
}
function GroupTasteMapBody({ state, userId, groupId, places, onOpenPlace, onBrowse, onOpenActivity }: GroupTasteMapProps) {
  const [filters, setFilters] = useState<GroupTasteFilters>({ source: { kind: 'ALL' } });
  const [showFilters, setShowFilters] = useState(false), [map, setMap] = useState(false), [limit, setLimit] = useState(12), [error, setError] = useState('');
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());
  let memory: ReturnType<typeof selectGroupTasteMemory>;
  try { memory = selectGroupTasteMemory(state, userId, groupId, places, filters); }
  catch { return <section className="group-taste-map"><p role="alert">현재 이 모임의 취향 지도를 볼 수 없어요.</p></section>; }
  const update = (next: Partial<GroupTasteFilters>) => { setFilters(current => ({ ...current, ...next })); setLimit(12); setError(''); };
  const sourceValue = filters.source?.kind === 'ACTIVITY' ? `activity:${filters.source.activityId}` : filters.source?.kind || 'ALL';
  const filterCount = Number(Boolean(filters.kind && filters.kind !== 'ALL')) + Number(Boolean(filters.experienceTag)) + Number(Boolean(filters.purpose)) + Number(Boolean(filters.recommendedOnly));
  const sourceActivityId = filters.source?.kind === 'ACTIVITY' ? filters.source.activityId : '';
  const sourceLabel = sourceActivityId ? memory.activities.find(activity => activity.id === sourceActivityId)?.title || '선택한 약속' : filters.source?.kind === 'GROUP' ? '모임 전체 기록' : '전체 기록';
  const sourceFor = (record: GroupTasteRecord, openActivity = false) => {
    try {
      const latest = resolveGroupTasteSource(state, userId, groupId, record.id, places);
      if (!latest) { setError('이 평가가 변경되거나 삭제됐어요. 현재 기록을 다시 확인해 주세요.'); return; }
      setError('');
      if (openActivity && latest.record.activityId && onOpenActivity) onOpenActivity(latest.record.activityId);
      else onOpenPlace(latest.place, latest.record.activityId);
    } catch { setError('현재 이 기록을 볼 수 없어요. 모임 접근 권한을 다시 확인해 주세요.'); }
  };
  const browse = () => {
    try { selectGroupTasteMemory(state, userId, groupId, places); onBrowse(); }
    catch { setError('현재 이 모임의 업체를 볼 수 없어요.'); }
  };
  return <section className="group-taste-map" aria-label="우리 취향 지도">
    <header className="taste-intro"><div><p>멤버가 직접 남긴 {memory.totalPlaceCount}곳 · 기록 {memory.totalRecordCount}개</p></div><button type="button" className="taste-view-switch" aria-pressed={map} onClick={() => setMap(value => !value)}>{map ? <List size={17}/> : <Map size={17}/>} {map ? '목록' : '지도'}</button></header>
    <div className="taste-quick-filters" role="group" aria-label="경험으로 찾기">{([{ tag: '', label: '전체 경험' }, { tag: 'RETURN_VISIT', label: '다시 갈 곳' }, { tag: 'QUIET', label: '조용한 곳' }] as const).map(item => <button type="button" key={item.tag} aria-pressed={(filters.experienceTag || '') === item.tag} onClick={() => update({ experienceTag: item.tag })}>{item.label}</button>)}</div>
    <div className="taste-source-row"><button type="button" className="taste-condition-summary" aria-expanded={showFilters} onClick={() => setShowFilters(value => !value)}><SlidersHorizontal size={17}/><span>{sourceLabel}{filterCount > 0 ? ` · 조건 ${filterCount}개` : ''}</span><ChevronRight size={16}/></button></div>
    {showFilters && <div className="taste-filters"><label className="taste-scope-field">기록 범위<select value={sourceValue} onChange={event => {
      const value = event.target.value;
      const source: GroupTasteSource = value.startsWith('activity:') ? { kind: 'ACTIVITY', activityId: value.slice(9) } : { kind: value === 'GROUP' ? 'GROUP' : 'ALL' };
      update({ source });
    }}><option value="ALL">모임 전체와 지난 약속</option>{memory.hasGroupScope && <option value="GROUP">모임 전체에 남긴 기록</option>}{filters.source?.kind === 'ACTIVITY' && !memory.activities.some(activity => `activity:${activity.id}` === sourceValue) && <option value={sourceValue} disabled>선택한 약속의 기록이 변경됐어요</option>}{memory.activities.map(activity => <option key={activity.id} value={`activity:${activity.id}`}>{activity.date ? `${activity.date} · ` : ''}{activity.title}</option>)}</select></label><label>장소 종류<select value={filters.kind || 'ALL'} onChange={event => update({ kind: event.target.value as PlaceKind | 'ALL' })}><option value="ALL">모든 종류</option>{Object.entries(kindNames).map(([kind, name]) => <option key={kind} value={kind}>{name}</option>)}</select></label><label>직접 선택한 경험<select value={filters.experienceTag || ''} onChange={event => update({ experienceTag: event.target.value as PlaceExperienceTag | '' })}><option value="">모든 경험</option>{placeExperienceTags.map(tag => <option key={tag.id} value={tag.id}>{tag.filterLabel}</option>)}</select></label><label>어울리는 만남<select value={filters.purpose || ''} onChange={event => update({ purpose: event.target.value as BusinessPurpose | '' })}><option value="">모든 만남</option>{businessPurposes.map(purpose => <option key={purpose.id} value={purpose.id}>{purpose.label}</option>)}</select></label><label className="taste-recommended"><input type="checkbox" checked={filters.recommendedOnly || false} onChange={event => update({ recommendedOnly: event.target.checked })}/>추천한 기록만</label>{filterCount > 0 && <button type="button" className="taste-reset" onClick={() => { setFilters({ source: filters.source }); setLimit(12); }}>조건 지우기</button>}</div>}
    {!memory.totalRecordCount ? <div className="taste-empty"><MapPin size={26}/><strong>함께 쌓은 경험이 아직 없어요</strong><p>{memory.canAddFeedback ? '음식점·카페·숙소에서 직접 경험한 특징과 평가를 남겨 보세요.' : '이 모임에 남겨둔 평가가 있으면 여기에서 볼 수 있어요.'}</p><button type="button" onClick={browse}>{memory.canAddFeedback ? '업체 찾고 평가 남기기' : '업체 정보 보기'}<ChevronRight size={17}/></button></div> : <>
      <div className="taste-results-head"><strong>{memory.items.length}곳 · 조건에 맞는 기록 {memory.matchedRecordCount}개</strong><button type="button" onClick={browse}>업체 찾기<ChevronRight size={16}/></button></div>
      {map && memory.items.length > 0 && <Suspense fallback={<p role="status">우리 취향 지도를 불러오는 중…</p>}><TasteMap places={memory.items.slice(0, 60).map(item => item.place)} onSelectPlace={place => { const item = memory.items.find(item => item.place.id === place.id); if (item?.records[0]) sourceFor(item.records[0]); }} heading="우리 기록이 있는 장소" ariaLabel="우리 취향 지도" mapLabel="우리 모임의 명시 평가가 있는 장소 지도"/>{memory.items.length > 60 && <p className="taste-muted">앞 60곳을 표시해요. 종류나 경험으로 범위를 줄일 수 있어요.</p>}</Suspense>}
      <div className="taste-results">{memory.items.slice(0, limit).map(item => {
        const photo = getPlacePhotos(item.place, true)[0], imageKey = `${item.place.id}:${photo?.image || ''}`;
        const recent = item.records[0];
        return <article className="taste-place" key={item.place.id}><button type="button" className="taste-place-info" onClick={() => sourceFor(recent)} aria-label={`${item.place.name} 최근 기록의 업체 정보 보기`}>{photo && !failedImages.has(imageKey) ? <img src={photo.image} alt="" loading="lazy" onError={() => setFailedImages(current => new Set([...current, imageKey]))}/> : <span className="taste-place-image"><MapPin size={22}/></span>}<span><small>{kindNames[item.place.kind]} · {item.place.area}</small><strong>{item.place.name}</strong><small>{item.memberCount}명이 남긴 경험 {item.reviewCount}개</small></span><ChevronRight size={17}/></button>
          {item.tagCounts.length > 0 && <div className="taste-tags">{item.tagCounts.map(tag => <span key={tag.tag}>{placeExperienceTags.find(value => value.id === tag.tag)?.filterLabel} {tag.count}</span>)}</div>}
          {recent && <button type="button" className="taste-source-preview" onClick={() => sourceFor(recent)}><span><strong>{recent.authorName} · {recent.sourceTitle}</strong><span>{recent.note || `${recent.rating}점${recent.recommended ? ' · 이 멤버가 추천한 장소' : ' · 직접 남긴 평가'}`}</span></span><ChevronRight size={16}/></button>}
          <div className="taste-place-score"><span><Star size={13}/>모임 평가 평균 {item.averageRating.toFixed(1)}</span>{item.recommendationCount > 0 && <span><ThumbsUp size={12}/>추천 {item.recommendationCount}건</span>}</div>
          <details className="taste-record-sources"><summary>누가 어디에 남겼나요? · 기록 {item.records.length}개</summary><div>{item.records.map(record => <section key={record.id}><header><strong>{record.authorName}</strong><small>{record.updatedAt.slice(0, 10)}</small></header><span>{record.sourceTitle} · {record.rating}점{record.recommended ? ' · 추천' : ''}</span>{record.note && <p>{record.note}</p>}<div><button type="button" onClick={() => sourceFor(record)}>원래 평가 보기<ChevronRight size={15}/></button>{record.activityId && onOpenActivity && <button type="button" onClick={() => sourceFor(record, true)}>약속 열기<ChevronRight size={15}/></button>}</div></section>)}</div></details>
        </article>;
      })}</div>
      {memory.items.length > limit && <button type="button" className="taste-more" onClick={() => setLimit(value => value + 12)}>장소 더 보기 · {Math.min(memory.items.length, limit)}/{memory.items.length}</button>}
      {!memory.items.length && <div className="taste-empty"><MapPin size={26}/><strong>이 조건으로 남긴 경험은 아직 없어요</strong><p>다른 기록 범위나 경험을 선택해 보세요.</p><button type="button" onClick={() => { setFilters({ source: { kind: 'ALL' } }); setLimit(12); }}>모든 기록 보기</button><button type="button" onClick={browse}>{memory.canAddFeedback ? '업체 찾고 평가 남기기' : '업체 정보 보기'}</button></div>}
    </>}
    <p className="taste-muted">직접 고른 경험 태그와 모임 안 평가만 모아요. 공식 시설 정보나 방문 인증은 아니에요.</p>
    {error && <p role="alert" className="taste-error">{error}</p>}
  </section>;
}
