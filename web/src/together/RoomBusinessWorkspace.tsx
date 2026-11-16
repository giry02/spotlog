import { lazy, Suspense, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, List, Map, Plus, Search, Star, ThumbsUp, Trash2, Utensils, X } from 'lucide-react';
import type { Place, PlaceKind } from '../data';
import { getPlacePhotos } from '../PhotoPlaceCard';
import { ActivityPlaceDetail } from './ActivityPlacesRoute';
import { memberName, togetherId, type TogetherPhotoAttachment, type TogetherState } from './model';
import { selectAssistantPlaces } from './activityAssistant';
import { planningPlaceIdentity, planningPlaceRegion, selectPlanningPlaceCatalogue } from './planningPlaces';
import { PostPhotoGallery, TogetherPhotoPicker } from './ReviewPostComposer';
import { isTogetherPhotoAttachments, MAX_POST_PHOTOS } from './contentMedia';
import { businessPurposes, placeExperienceTags, readPlaceAssessment, type BusinessPurpose, type PlaceAssessmentScope, type PlaceFeedbackInput, type PlaceMenuInput } from './businessAssessments';
import './room-business-workspace.css';

const BusinessMap = lazy(() => import('../InterestPlacesMap'));
const kindNames: Record<PlaceKind, string> = { LANDMARK: '명소', FOOD: '음식점', CAFE: '카페', STAY: '숙소', SHOP: '쇼핑', LEISURE: '레저' };
type ActionResult = boolean | Promise<boolean>;
export type RoomBusinessDetailTab = 'INFO' | 'MENU' | 'REVIEWS';
export interface RoomBusinessWorkspaceProps {
  state: TogetherState; userId: string; groupId: string; activityId?: string; places: Place[]; initialPlace?: Place;
  initialTab?: RoomBusinessDetailTab;
  onSavePlace?: (place: Place) => void;
  onAddCandidate?: (placeId: string, expectedRevision?: number) => ActionResult;
  onSaveFeedback?: (scope: PlaceAssessmentScope, input: PlaceFeedbackInput) => ActionResult;
  onWithdrawFeedback?: (scope: PlaceAssessmentScope, expectedRevision: number) => ActionResult;
  onSaveMenu?: (scope: PlaceAssessmentScope, input: PlaceMenuInput) => ActionResult;
  onWithdrawMenu?: (scope: PlaceAssessmentScope, menuId: string, expectedRevision: number) => ActionResult;
}
type DetailProps = Omit<RoomBusinessWorkspaceProps, 'initialPlace'> & { place: Place; onBack?: () => void; backLabel?: string };

/** A single host sheet changes between catalogue and detail; it never stacks another room sheet. */
export default function RoomBusinessWorkspace(props: RoomBusinessWorkspaceProps) {
  return <BusinessWorkspaceBody key={`${props.userId}:${props.groupId}:${props.activityId || 'group'}:${props.initialPlace?.id || 'list'}:${props.initialTab || 'INFO'}`} {...props}/>;
}
function BusinessWorkspaceBody(props: RoomBusinessWorkspaceProps) {
  const { state, userId, groupId, activityId, places, initialPlace } = props;
  const [selected, setSelected] = useState<Place | null>(initialPlace || null);
  const [query, setQuery] = useState(''), [kind, setKind] = useState<PlaceKind | 'ALL'>('ALL'), [region, setRegion] = useState('');
  const [sort, setSort] = useState<'REGION' | 'RECOMMENDED' | 'RATING'>('REGION'), [map, setMap] = useState(false), [limit, setLimit] = useState(12), [purpose, setPurpose] = useState<BusinessPurpose | ''>('');
  const group = state.groups.find(item => item.id === groupId), activity = activityId ? state.activities.find(item => item.id === activityId && item.groupId === groupId) : undefined;
  let shared: ReturnType<typeof selectAssistantPlaces>;
  try { shared = selectAssistantPlaces(state, userId, { groupId, activityId }, places); }
  catch { return <section className="room-business"><p role="alert">현재 이 공간의 업체 정보를 볼 수 없어요.</p></section>; }
  if (!group || activityId && !activity) return null;
  if (selected) return <RoomBusinessDetail {...props} place={selected} onBack={() => setSelected(null)}/>;
  const preferredRegion = group.region.trim().split(/[·,\s]+/)[0] || '';
  const catalogue = selectPlanningPlaceCatalogue(places, '', 'ALL', '', '', shared.map(place => place.id));
  const regions = [...new Set(catalogue.map(planningPlaceRegion).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko-KR'));
  let summaries: globalThis.Map<string, ReturnType<typeof readPlaceAssessment>['summary']>;
  try {
    readPlaceAssessment(state, userId, { groupId, activityId, placeId: catalogue[0]?.id || 'empty-catalogue' }, places);
    summaries = new globalThis.Map(catalogue.map(place => [place.id, readPlaceAssessment(state, userId, { groupId, activityId, placeId: place.id }, places).summary]));
  } catch { return <section className="room-business"><p role="alert">현재 이 공간의 업체 정보를 볼 수 없어요.</p></section>; }
  const results = selectPlanningPlaceCatalogue(places, query, kind, region, preferredRegion, shared.map(place => place.id)).filter(place => !purpose || summaries.get(place.id)?.purposeCounts.some(item => item.purpose === purpose && item.count > 0)).sort((a, b) => {
    if (sort === 'REGION') {
      const businessOrder: Record<PlaceKind, number> = { FOOD: 0, CAFE: 1, STAY: 2, LEISURE: 3, SHOP: 4, LANDMARK: 5 };
      return Number(Boolean(preferredRegion && planningPlaceRegion(b) === preferredRegion)) - Number(Boolean(preferredRegion && planningPlaceRegion(a) === preferredRegion)) || businessOrder[a.kind] - businessOrder[b.kind];
    }
    const left = summaries.get(a.id)!, right = summaries.get(b.id)!;
    return sort === 'RECOMMENDED' ? right.recommendationCount - left.recommendationCount || right.reviewCount - left.reviewCount : (right.averageRating || 0) - (left.averageRating || 0) || right.reviewCount - left.reviewCount;
  });
  return <section className="room-business" aria-label="업체 찾기와 우리 평가">
    <header className="room-business-intro"><h3>어디서 만날까요?</h3><p>{activity?.title || group.name}에서 고를 음식점·카페·숙소를 찾아요.</p></header>
    <label className="room-business-search"><Search size={18} aria-hidden="true"/><input type="search" value={query} onChange={event => { setQuery(event.target.value); setLimit(12); }} placeholder="이름·지역·주소 검색" aria-label="업체 검색"/></label>
    <div className="room-business-condition"><label>지역<select value={region} onChange={event => { setRegion(event.target.value); setLimit(12); }}><option value="">전체{preferredRegion ? ` · ${preferredRegion} 우선` : ''}</option>{regions.map(value => <option key={value}>{value}</option>)}</select></label><button type="button" aria-pressed={map} onClick={() => setMap(value => !value)}>{map ? <List size={17}/> : <Map size={17}/>} {map ? '목록 보기' : '지도 보기'}</button></div>
    <div className="room-business-kinds" role="group" aria-label="업체 종류">{(['ALL', 'FOOD', 'CAFE', 'STAY', 'LANDMARK', 'SHOP', 'LEISURE'] as const).map(value => <button type="button" key={value} aria-pressed={kind === value} onClick={() => { setKind(value); setLimit(12); }}>{value === 'ALL' ? '전체' : kindNames[value]}</button>)}</div>
    <label className="room-business-purpose-filter">어울리는 만남<select value={purpose} onChange={event => { setPurpose(event.target.value as BusinessPurpose | ''); setLimit(12); }}><option value="">전체 · 직접 남긴 추천 기준</option>{businessPurposes.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><div className="room-business-results-head"><strong>{results.length}곳</strong><label>정렬<select value={sort} onChange={event => setSort(event.target.value as typeof sort)}><option value="REGION">지역 우선</option><option value="RECOMMENDED">우리 추천 많은 순</option><option value="RATING">우리 평가 높은 순</option></select></label></div>
    <p className="room-business-muted">평가·추천 수는 {activity ? '이 약속' : '이 모임'}에 직접 남긴 기록만 집계해요.</p>
    {map && results.length > 0 && <Suspense fallback={<p role="status">업체 지도를 불러오는 중…</p>}><BusinessMap places={results.slice(0, 60)} onSelectPlace={setSelected} heading="업체 위치" ariaLabel="업체 위치 지도" mapLabel="현재 조건의 업체 위치 지도"/>{results.length > 60 && <p className="room-business-muted">현재 조건의 앞 60곳을 표시해요. 지역을 선택하면 더 쉽게 찾을 수 있어요.</p>}</Suspense>}
    <div className="room-business-results">{results.slice(0, limit).map(place => { const score = summaries.get(place.id)!, photo = getPlacePhotos(place, true)[0]; return <button className="room-business-result" type="button" key={place.id} onClick={() => setSelected(place)} aria-label={`${place.name} 정보·메뉴·평가 보기`}>
      {photo ? <img src={photo.image} alt="" loading="lazy"/> : <span className="room-business-photo-placeholder"><Utensils size={22}/></span>}
      <span className="room-business-result-copy"><small>{kindNames[place.kind]} · {place.area}</small><strong>{place.name}</strong><span>{place.address || '주소 확인 전'}</span><span className="room-business-score"><Star size={13}/>{score.reviewCount ? `${score.averageRating?.toFixed(1)} · 우리 평가 ${score.reviewCount}` : '아직 우리 평가 없음'}{score.recommendationCount > 0 && <span> · 추천 {score.recommendationCount}</span>}</span></span><ChevronRight size={18}/>
    </button>; })}</div>
    {!results.length && <div className="room-business-empty"><Search size={24}/><strong>{purpose ? '아직 이 만남에 맞는 우리 추천이 없어요' : '조건에 맞는 장소가 없어요'}</strong><p>{purpose ? '전체 업체를 확인하고 직접 경험한 곳을 추천해 보세요.' : '지역이나 종류를 바꿔 보세요.'}</p><button type="button" onClick={() => { if (purpose) setPurpose(''); else { setQuery(''); setKind('ALL'); setRegion(''); } }}>{purpose ? '전체 업체 보기' : '조건 지우기'}</button></div>}
    {results.length > limit && <button className="room-business-secondary" type="button" onClick={() => setLimit(value => value + 12)}>업체 더 보기 · {Math.min(limit, results.length)}/{results.length}</button>}
  </section>;
}

export function RoomBusinessDetail(props: DetailProps) {
  return <BusinessDetailBody key={`${props.userId}:${props.groupId}:${props.activityId || 'group'}:${props.place.id}:${props.initialTab || 'INFO'}`} {...props}/>;
}
function BusinessDetailBody(props: DetailProps) {
  const { state, userId, groupId, activityId, places, place, onBack, backLabel = '업체 목록', onSavePlace, onAddCandidate, onSaveFeedback, onWithdrawFeedback, onSaveMenu, onWithdrawMenu } = props;
  const [tab, setTab] = useState<RoomBusinessDetailTab>(props.initialTab || 'INFO');
  const [reviewing, setReviewing] = useState(false), [menuEditing, setMenuEditing] = useState(false), [withdrawReview, setWithdrawReview] = useState<number | null>(null), [withdrawMenu, setWithdrawMenu] = useState<{ id: string; revision: number } | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [status, setStatus] = useState('');
  const [review, setReview] = useState<PlaceFeedbackInput>({ rating: 0, note: '', recommended: false, purposes: [] });
  const [menu, setMenu] = useState<PlaceMenuInput>({ name: '', priceText: '', note: '', sourceUrl: '', checkedOn: '' });
  const pending = useRef(false);
  const scope = { groupId, activityId, placeId: place.id };
  let assessment: ReturnType<typeof readPlaceAssessment>, shared: ReturnType<typeof selectAssistantPlaces>;
  try { assessment = readPlaceAssessment(state, userId, scope, places); shared = selectAssistantPlaces(state, userId, { groupId, activityId }, places); }
  catch { return <section className="room-business"><p role="alert">현재 이 공간의 업체 정보를 볼 수 없어요.</p>{onBack && <button type="button" onClick={onBack}>{backLabel}</button>}</section>; }
  const { summary, reviews, menus, ownReview, canReview, canMenuEdit, placeAvailable } = assessment;
  const activity = activityId ? state.activities.find(item => item.id === activityId && item.groupId === groupId) : undefined;
  const identity = planningPlaceIdentity(place), added = shared.some(item => item.id === place.id || identity && planningPlaceIdentity(item) === identity);
  const canAdd = placeAvailable && canMenuEdit && (!activity || activity.status === 'PLANNED');
  const run = async (action: (() => ActionResult) | undefined, success: string, done?: () => void) => {
    if (!action || pending.current) return;
    pending.current = true; setBusy(true); setError(''); setStatus('');
    try { if (await action()) { setStatus(success); done?.(); } else setError('저장하지 못했어요. 입력은 유지했으니 현재 정보를 확인하고 다시 시도해 주세요.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '저장하지 못했어요. 입력한 내용은 유지해요.'); }
    finally { pending.current = false; setBusy(false); }
  };
  const beginReview = () => {
    setReview({ rating: ownReview?.rating || 0, note: ownReview?.note || '', recommended: ownReview?.recommended || false, purposes: ownReview?.purposes || [], experienceTags: [...(ownReview?.experienceTags || [])], photos: ownReview?.photos || [], ...(ownReview ? { expectedRevision: ownReview.revision } : {}) });
    setReviewing(true); setWithdrawReview(null); setError('');
  };
  return <section className="room-business room-business-detail" aria-label={`${place.name} 업체 상세`}>
    {onBack && <button className="room-business-back" type="button" disabled={busy} onClick={onBack}><ArrowLeft size={18}/>{backLabel}</button>}
    <div className="room-business-detail-title"><span><small>{kindNames[place.kind]} · {place.area}</small><h3>{place.name}</h3></span><span className="room-business-detail-rating"><Star size={17}/><strong>{summary.reviewCount ? summary.averageRating?.toFixed(1) : '—'}</strong><small>우리 평가 {summary.reviewCount}개</small></span></div>
    <nav className="room-business-tabs" aria-label="업체 상세 메뉴">{([{ id: 'INFO', text: '정보·지도' }, { id: 'MENU', text: `${place.kind === 'STAY' ? '객실·가격' : '메뉴·가격'} ${menus.length}` }, { id: 'REVIEWS', text: `우리 평가 ${summary.reviewCount}` }] as const).map(item => <button type="button" key={item.id} aria-current={tab === item.id ? 'page' : undefined} onClick={() => { setTab(item.id); setError(''); setStatus(''); }}>{item.text}</button>)}</nav>
    {!placeAvailable && <p className="room-business-muted">현재 장소 목록에서 확인되지 않는 업체예요. 남겨 둔 기록을 확인할 수 있어요.</p>}
    {tab === 'INFO' && <div className="room-business-tab-content"><ActivityPlaceDetail place={place} onSavePlace={onSavePlace}/><Suspense fallback={<p role="status">위치 지도를 불러오는 중…</p>}><BusinessMap places={[place]} onSelectPlace={() => setStatus('현재 보고 있는 업체의 위치예요. 길찾기로 이동 방법을 확인할 수 있어요.')} heading="이 업체 위치" ariaLabel={`${place.name} 위치`} mapLabel={`${place.name} 지도`}/></Suspense>{onAddCandidate && <button className="room-business-primary" type="button" disabled={busy || added || !canAdd} onClick={() => void run(() => onAddCandidate(place.id, activity?.revision), '이 공간의 장소 후보에 담았어요.')} aria-label={`${place.name} ${added ? '담은 후보' : '이 공간 후보로 담기'}`}>{added ? <Check size={18}/> : <Plus size={18}/>} {added ? '이 공간에 담은 장소' : '이 공간 후보로 담기'}</button>}<p className="room-business-muted">후보 담기와 업체 평가는 예약·만나는 장소·방문 동선을 자동으로 바꾸지 않아요.</p></div>}
    {tab === 'MENU' && <div className="room-business-tab-content"><div className="room-business-section-head"><h4>{place.kind === 'STAY' ? '객실·이용 가격' : '메뉴·이용 가격'}</h4>{canMenuEdit && onSaveMenu && !menuEditing && <button type="button" onClick={() => { setMenu({ name: '', priceText: '', note: '', sourceUrl: '', checkedOn: '' }); setMenuEditing(true); setError(''); }}><Plus size={17}/>정보 등록</button>}</div><p className="room-business-muted">이 공간의 멤버가 직접 등록한 참고 정보예요. 최신 메뉴·요금·예약 가능 여부는 업체에 확인해 주세요.</p>
      {!menus.length && (!menuEditing || !canMenuEdit) && <div className="room-business-empty"><Utensils size={24}/><strong>{place.kind === 'STAY' ? '등록된 객실·요금 정보가 없어요' : '등록된 메뉴·가격이 없어요'}</strong><p>{canMenuEdit ? '확인한 메뉴나 객실 정보를 출처·확인일과 함께 남길 수 있어요.' : '이 공간은 읽기 전용이에요. 등록된 정보가 있으면 여기서 볼 수 있어요.'}</p></div>}
      {menuEditing && canMenuEdit && <form className="room-business-form" onSubmit={event => { event.preventDefault(); void run(onSaveMenu ? () => onSaveMenu(scope, menu) : undefined, '메뉴·가격 정보를 저장했어요.', () => setMenuEditing(false)); }}><h4>{menu.id ? '메뉴·가격 수정' : '확인한 메뉴·가격 등록'}</h4><label>메뉴·객실·이용권 이름<input required maxLength={100} value={menu.name} onChange={event => setMenu({ ...menu, name: event.target.value })} placeholder="직접 확인한 항목 이름"/></label><label>가격·기준 · 선택<input maxLength={80} value={menu.priceText} onChange={event => setMenu({ ...menu, priceText: event.target.value })} placeholder="확인한 금액·통화·인원 기준, 모르면 비워두기"/></label><label>추가 안내<textarea maxLength={600} rows={3} value={menu.note} onChange={event => setMenu({ ...menu, note: event.target.value })}/></label><label>확인한 원문 주소 · 선택<input type="url" maxLength={2048} value={menu.sourceUrl || ''} onChange={event => setMenu({ ...menu, sourceUrl: event.target.value })} placeholder="https://"/></label><label>직접 확인한 날짜 · 선택<input type="date" value={menu.checkedOn || ''} onInput={event => { const checkedOn = event.currentTarget.value; setMenu(current => ({ ...current, checkedOn })); }} onChange={event => setMenu(current => ({ ...current, checkedOn: event.target.value }))}/></label><BusinessPhotoDrafts photos={menu.photos || []} disabled={busy} onChange={photos => setMenu(current => ({ ...current, photos }))} onError={setError}/><div className="room-business-form-actions"><button className="room-business-primary" type="submit" disabled={busy || !canMenuEdit}>저장</button><button type="button" disabled={busy} onClick={() => setMenuEditing(false)}>작성 취소</button></div></form>}
      {menus.map(item => <article className="room-business-menu" key={item.id}><div><strong>{item.name}</strong><b>{item.priceText || '가격 미등록'}</b></div>{item.note && <p>{item.note}</p>}<PostPhotoGallery attachments={item.photos}/><small>{memberName(state, item.authorId, groupId)} 등록 · {item.checkedOn ? `${item.checkedOn} 확인` : '확인일 미등록'}</small>{item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">등록한 출처 보기<ChevronRight size={14}/></a>}{canMenuEdit && item.authorId === userId && <div className="room-business-record-actions"><button type="button" disabled={busy} onClick={() => { setMenu({ id: item.id, name: item.name, priceText: item.priceText, note: item.note, sourceUrl: item.sourceUrl || '', checkedOn: item.checkedOn || '', photos: item.photos, expectedRevision: item.revision }); setMenuEditing(true); setWithdrawMenu(null); }}>수정</button><button type="button" disabled={busy} onClick={() => setWithdrawMenu({ id: item.id, revision: item.revision })}>삭제</button></div>}{withdrawMenu?.id === item.id && <div className="room-business-confirm"><p>내가 등록한 이 정보를 삭제할까요?</p><button type="button" disabled={busy} onClick={() => void run(onWithdrawMenu ? () => onWithdrawMenu(scope, item.id, withdrawMenu.revision) : undefined, '등록한 정보를 삭제했어요.', () => setWithdrawMenu(null))}>삭제 확인</button><button type="button" disabled={busy} onClick={() => setWithdrawMenu(null)}>유지</button></div>}</article>)}
    </div>}
    {tab === 'REVIEWS' && <div className="room-business-tab-content"><section className="room-business-review-summary"><div><strong>{summary.reviewCount ? `${summary.averageRating?.toFixed(1)} / 5` : '첫 평가를 기다려요'}</strong><span>우리 평가 {summary.reviewCount}개 · 추천 {summary.recommendationCount}명</span></div><p>이 {activityId ? '약속' : '모임'}에 직접 남긴 경험이에요. 전체 이용자 평점이나 방문 인증이 아니에요.</p>{summary.purposeCounts.length > 0 && <div className="room-business-purpose-summary">{summary.purposeCounts.map(item => <span key={item.purpose}>{businessPurposes.find(purpose => purpose.id === item.purpose)?.label || item.purpose} {item.count}</span>)}</div>}</section>
      {canReview && onSaveFeedback && !reviewing && <button type="button" className="room-business-primary" onClick={beginReview}><Star size={17}/>{ownReview && !ownReview.withdrawnAt ? '내 평가 수정' : '평가·추천 남기기'}</button>}
      {reviewing && canReview && <form className="room-business-form" onSubmit={event => { event.preventDefault(); void run(onSaveFeedback ? () => onSaveFeedback(scope, review) : undefined, '우리 평가에 저장했어요.', () => setReviewing(false)); }}><h4>내 경험 남기기</h4><fieldset><legend>별점</legend><div className="room-business-stars" role="group" aria-label="내 업체 별점">{[1, 2, 3, 4, 5].map(value => <button key={value} type="button" aria-label={`${value}점`} aria-pressed={review.rating === value} onClick={() => setReview({ ...review, rating: value })}><Star size={23} fill={value <= review.rating ? 'currentColor' : 'none'}/></button>)}<span>{review.rating ? `${review.rating}점` : '선택'}</span></div></fieldset><label>이용 경험<textarea required rows={4} maxLength={2000} value={review.note} onChange={event => setReview({ ...review, note: event.target.value })} placeholder="좋았던 점과 방문 전에 알아두면 좋을 점을 적어 주세요."/></label><label className="room-business-check"><input type="checkbox" checked={review.recommended} onChange={event => setReview({ ...review, recommended: event.target.checked })}/><ThumbsUp size={17}/>이 공간의 멤버에게 추천해요</label><fieldset><legend>어떤 만남에 어울렸나요? · 선택</legend><div className="room-business-purpose-picker">{businessPurposes.map(purpose => <button type="button" key={purpose.id} aria-pressed={review.purposes.includes(purpose.id)} onClick={() => setReview({ ...review, purposes: review.purposes.includes(purpose.id) ? review.purposes.filter(value => value !== purpose.id) : [...review.purposes, purpose.id] })}>{purpose.label}</button>)}</div></fieldset><fieldset><legend>직접 경험한 특징 · 선택</legend><p className="room-business-muted">직접 선택한 특징만 우리 취향 지도에 모여요. 장소의 공식 시설 정보는 아니에요.</p><div className="room-business-experience-picker">{placeExperienceTags.map(tag => <button type="button" key={tag.id} aria-pressed={(review.experienceTags || []).includes(tag.id)} onClick={() => setReview({ ...review, experienceTags: (review.experienceTags || []).includes(tag.id) ? review.experienceTags!.filter(value => value !== tag.id) : [...(review.experienceTags || []), tag.id] })}>{tag.label}</button>)}</div></fieldset><BusinessPhotoDrafts photos={review.photos || []} disabled={busy} onChange={photos => setReview(current => ({ ...current, photos }))} onError={setError}/><div className="room-business-form-actions"><button className="room-business-primary" type="submit" disabled={busy || !canReview || review.rating < 1}>평가 저장</button><button type="button" disabled={busy} onClick={() => setReviewing(false)}>작성 취소</button></div></form>}
      {!reviews.length && (!reviewing || !canReview) && <div className="room-business-empty"><Star size={24}/><strong>아직 우리 평가가 없어요</strong><p>{canReview ? '직접 경험한 내용으로 다음 만남에 도움을 주세요.' : '이 공간은 읽기 전용이에요. 남겨진 평가가 있으면 여기서 볼 수 있어요.'}</p></div>}
      {reviews.map(item => <article className="room-business-review" key={item.id}><header><strong>{memberName(state, item.authorId, groupId)}{item.authorId === userId ? ' · 나' : ''}</strong><span><Star size={14} fill="currentColor"/>{item.rating}</span></header><small>{item.updatedAt.slice(0, 10)}{item.recommended ? ' · 추천해요' : ''}</small><p>{item.note}</p>{item.purposes.length > 0 && <div className="room-business-purpose-summary">{item.purposes.map(value => <span key={value}>{businessPurposes.find(purpose => purpose.id === value)?.label || value}</span>)}</div>}{Boolean(item.experienceTags?.length) && <div className="room-business-experience-tags" aria-label="직접 선택한 경험 특징">{item.experienceTags!.map(tag => <span key={tag}>{placeExperienceTags.find(value => value.id === tag)?.label}</span>)}</div>}<PostPhotoGallery attachments={item.photos}/>{item.authorId === userId && canReview && onWithdrawFeedback && <div className="room-business-record-actions"><button type="button" disabled={busy} onClick={beginReview}>수정</button><button type="button" disabled={busy} onClick={() => setWithdrawReview(item.revision)}><Trash2 size={14}/>삭제</button></div>}{item.authorId === userId && withdrawReview !== null && <div className="room-business-confirm"><p>내 평가를 삭제할까요? 이 공간의 집계에서도 빠져요.</p><button type="button" disabled={busy} onClick={() => void run(onWithdrawFeedback ? () => onWithdrawFeedback(scope, withdrawReview) : undefined, '내 평가를 삭제했어요.', () => { setWithdrawReview(null); setReviewing(false); })}>평가 삭제 확인</button><button type="button" disabled={busy} onClick={() => setWithdrawReview(null)}>유지</button></div>}</article>)}
    </div>}
    {error && <p className="room-business-error" role="alert">{error}</p>}{status && <p className="room-business-status" role="status">{status}</p>}
  </section>;
}


function BusinessPhotoDrafts({ photos, disabled, onChange, onError }: { photos: TogetherPhotoAttachment[]; disabled: boolean; onChange: (photos: TogetherPhotoAttachment[]) => void; onError: (message: string) => void }) {
  const latestPhotos = useRef(photos); latestPhotos.current = photos;
  return <section className="room-business-photo-editor"><div className="room-business-section-head"><strong>사진 {photos.length}/{MAX_POST_PHOTOS}</strong><TogetherPhotoPicker disabled={disabled || photos.length >= MAX_POST_PHOTOS} onSelect={url => {
    const next = [...latestPhotos.current, { id: togetherId('photo'), url, caption: '' }];
    if (!isTogetherPhotoAttachments(next)) return onError('사진은 4장까지, 합계 2MB 이내로 남겨 주세요.');
    latestPhotos.current = next; onChange(next);
  }}/></div><div className="room-business-photo-drafts">{photos.map((photo, index) => <div key={photo.id}><img src={photo.url} alt={`첨부할 사진 ${index + 1}`}/><button type="button" disabled={disabled} aria-label={`첨부 사진 ${index + 1} 제외`} onClick={() => onChange(latestPhotos.current.filter(item => item.id !== photo.id))}><X size={16}/></button></div>)}</div></section>;
}
