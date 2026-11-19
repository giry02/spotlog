import { lazy, Suspense, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, Check, CheckCheck, ChevronRight, Clock3, MapPin, Route, Search, ShieldCheck } from 'lucide-react';
import type { Place } from '../data';
import { ActivityPlaceDetail } from './ActivityPlacesRoute';
import { MemberAvatar } from './GroupMembersPanel';
import { memberName, type TogetherState } from './model';
import { resolveRoomIdentity } from './roomIdentity';
import { selectPlanningPlaceCatalogue } from './planningPlaces';
import { previewPersonalRouteAcknowledgement, selectPersonalRoutes, type savePersonalRoute, type removePersonalRoute } from './personalRoutes';
import './personal-route-panel.css';

const RouteMap = lazy(() => import('../RouteMap'));
type ActionResult = boolean | Promise<boolean>;
type SaveInput = Parameters<typeof savePersonalRoute>[3];
type WithdrawInput = Parameters<typeof removePersonalRoute>[3];
type Acknowledgement = ReturnType<typeof previewPersonalRouteAcknowledgement>;
type PersonalRouteContext = ReturnType<typeof selectPersonalRoutes>;
type RouteStop = PersonalRouteContext['route']['stops'][number];
type RouteView = PersonalRouteContext['members'][number];
export interface PersonalRoutePanelProps {
  state: TogetherState; userId: string; groupId: string; activityId: string; places: Place[];
  onSave: (input: SaveInput) => ActionResult;
  onWithdraw: (input: WithdrawInput) => ActionResult;
  onAcknowledge: (preview: Acknowledgement) => ActionResult;
  renderPlaceDetail?: (place: Place) => ReactNode;
  onOpenSharedRoute?: () => void;
  onOpenMember?: (userId: string) => void;
  initialTab?: 'MY' | 'MEMBERS' | 'CHANGES';
}
const formatStop = (stop: RouteStop) => `DAY ${stop.day} · ${stop.name}`;
const statusLabel = (view: RouteView) => view.status === 'INVALID' ? '구간 다시 선택' : view.status === 'CHANGED' ? '변경 확인 필요' : '최신 일정 확인';
const printable = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : '';

export default function PersonalRoutePanel(props: PersonalRoutePanelProps) {
  let context: PersonalRouteContext;
  try { context = selectPersonalRoutes(props.state, props.userId, { groupId: props.groupId, activityId: props.activityId }, props.places); }
  catch { return <section className="personal-route-panel"><p role="alert">현재 이 약속의 개인별 참여 구간을 볼 수 없어요.</p></section>; }
  return <PersonalRouteBody key={`${props.userId}:${props.groupId}:${props.activityId}`} {...props} context={context}/>;
}

function PersonalRouteBody({ state, userId, groupId, activityId, places, onSave, onWithdraw, onAcknowledge, renderPlaceDetail, onOpenSharedRoute, onOpenMember, initialTab, context }: PersonalRoutePanelProps & { context: PersonalRouteContext }) {
  const { activity, route, own, members, writable, canWithdraw, missingMemberIds } = context;
  const [tab, setTab] = useState<'MY' | 'MEMBERS' | 'CHANGES'>(initialTab || (own?.status === 'INVALID' || own?.status === 'CHANGED' ? 'CHANGES' : 'MY'));
  const [startKey, setStartKey] = useState(own?.startKey || ''), [endKey, setEndKey] = useState(own?.endKey || '');
  const [originId, setOriginId] = useState(own?.originPlaceId || ''), [joinTime, setJoinTime] = useState(own?.joinTime || '');
  const [formVersion, setFormVersion] = useState(route.version), [formRevision, setFormRevision] = useState(own?.revision || 0);
  const [originQuery, setOriginQuery] = useState(''), [detail, setDetail] = useState<Place | null>(null);
  const [preview, setPreview] = useState<Acknowledgement | null>(null), [confirmed, setConfirmed] = useState(false);
  const [withdrawConfirm, setWithdrawConfirm] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [status, setStatus] = useState('');
  const pending = useRef(false);
  const scope = { groupId, activityId };
  const stale = formVersion !== route.version || formRevision !== (own?.revision || 0);
  const startIndex = route.stops.findIndex(stop => stop.key === startKey), endIndex = route.stops.findIndex(stop => stop.key === endKey);
  const validSelection = startIndex >= 0 && endIndex >= startIndex;
  const selectedStops = validSelection ? route.stops.slice(startIndex, endIndex + 1) : [];
  const draftChanged = startKey !== (own?.startKey || '') || endKey !== (own?.endKey || '') || originId !== (own?.originPlaceId || '') || joinTime !== (own?.joinTime || '');
  const currentOwnChanges = own?.status === 'CHANGED' || own?.status === 'INVALID';
  const previewCurrent = Boolean(preview && preview.routeVersion === route.version && preview.expectedRevision === own?.revision);
  const region = state.groups.find(item => item.id === groupId)?.region.trim().split(/[·,\s]+/)[0] || '';
  const originPlace = places.find(place => place.id === originId && !place.personal);
  const origins = selectPlanningPlaceCatalogue(places, originQuery, 'ALL', '', region).slice(0, 8);
  const rawPlace = (stop: RouteStop): Place | undefined => {
    const original = activity.journey?.days.find(day => day.dayId === stop.dayId)?.places.find(place => place.visitId === stop.visitId);
    return original || places.find(place => place.id === stop.placeId && !place.personal);
  };
  const dayGroups = selectedStops.reduce<Array<{ dayId: string; day: number; date: string; stops: RouteStop[] }>>((items, stop) => {
    const last = items[items.length - 1];
    if (last?.dayId === stop.dayId) last.stops.push(stop);
    else items.push({ dayId: stop.dayId, day: stop.day, date: stop.date, stops: [stop] });
    return items;
  }, []);
  const run = async (action: () => ActionResult, success: string, done?: () => void) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(''); setStatus('');
    try {
      if (await action()) { setStatus(success); done?.(); }
      else setError('저장하지 못했어요. 입력은 유지했으니 최신 내용을 확인하고 다시 시도해 주세요.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '처리하지 못했어요. 입력은 유지해요.'); }
    finally { pending.current = false; setBusy(false); }
  };
  const reviewChanges = () => {
    try { const next = previewPersonalRouteAcknowledgement(state, userId, scope, places); setPreview(next); setConfirmed(false); setError(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '현재 변경 내용을 확인하지 못했어요.'); }
  };
  const refreshForm = () => {
    setFormVersion(route.version); setFormRevision(own?.revision || 0); setPreview(null); setConfirmed(false);
    setStatus('최신 일정으로 선택지를 갱신했어요. 작성 중인 선택과 입력은 유지했어요.'); setError('');
  };
  const save = () => void run(() => onSave({ startKey, endKey, originPlaceId: originId || undefined, joinTime: joinTime || undefined, expectedRevision: formRevision, routeVersion: formVersion }), '내 참여 구간을 공유했어요. 약속 참석 응답은 바꾸지 않았어요.', () => { setFormRevision(formRevision + 1); setPreview(null); setConfirmed(false); setWithdrawConfirm(false); });
  const resetToSaved = () => {
    setStartKey(own?.startKey || ''); setEndKey(own?.endKey || ''); setOriginId(own?.originPlaceId || ''); setJoinTime(own?.joinTime || '');
    setFormRevision(own?.revision || 0); setFormVersion(route.version); setWithdrawConfirm(false); setError(''); setStatus('');
  };
  const go = (next: typeof tab) => { setTab(next); setDetail(null); setError(''); setStatus(''); setWithdrawConfirm(false); };
  const openStop = (stop: RouteStop) => { const place = rawPlace(stop); if (place) { setDetail(place); setError(''); } else setError('이 방문의 현재 상세 정보를 찾지 못했어요.'); };
  const memberRoute = (view: RouteView) => {
    const first = route.stops.find(stop => stop.key === view.startKey), last = route.stops.find(stop => stop.key === view.endKey);
    const previousFirst = view.previousStops.find(stop => stop.key === view.startKey), previousLast = view.previousStops.find(stop => stop.key === view.endKey);
    const origin = places.find(place => place.id === view.originPlaceId && !place.personal);
    return <div className="pr-member-route"><span><MapPin size={15}/><span>{first ? formatStop(first) : `${previousFirst?.name || '시작 방문'} · 삭제 또는 이동됨`}{view.startKey !== view.endKey && <><br/>{'→ '}{last ? formatStop(last) : `${previousLast?.name || '마지막 방문'} · 삭제 또는 이동됨`}</>}</span></span>{view.joinTime && <span><Clock3 size={15}/><span>공유한 합류 시각 {view.joinTime} · 직접 입력</span></span>}{view.originPlaceId && <small>공개 출발 장소 · {origin?.name || '현재 정보 미확인'}</small>}<span><span className="pr-badge" data-alert={view.status !== 'CURRENT'}>{view.status === 'CURRENT' ? <CheckCheck size={13}/> : <AlertCircle size={13}/>} {statusLabel(view)}</span></span></div>;
  };
  return <section className="personal-route-panel" aria-label="개인별 참여 구간">
    <div className="pr-tabs" role="tablist" aria-label="개인별 동선 보기">
      {([{ id: 'MY', label: '내 참여' }, { id: 'MEMBERS', label: '함께하는 구간' }, { id: 'CHANGES', label: '바뀐 내용' }] as const).map(item => <button type="button" key={item.id} role="tab" aria-selected={tab === item.id} aria-controls={`personal-route-${item.id}`} id={`personal-route-tab-${item.id}`} onClick={() => go(item.id)}>{item.label}{item.id === 'CHANGES' && currentOwnChanges && <span aria-label="미확인 변경 있음">!</span>}</button>)}
    </div>
    {detail ? <div className="pr-inline-detail"><button type="button" className="pr-text-action" onClick={() => setDetail(null)}><ArrowLeft size={17}/>선택한 구간으로</button>{renderPlaceDetail ? renderPlaceDetail(detail) : <ActivityPlaceDetail place={detail}/>}</div> : <>
      {tab === 'MY' && <div className="pr-section" role="tabpanel" id="personal-route-MY" aria-labelledby="personal-route-tab-MY">
        <header className="pr-heading"><div><h3>어디부터 함께할까요?</h3><p className="pr-muted">전체 일정 중 내가 함께할 시작과 마지막 방문을 골라요.</p></div>{onOpenSharedRoute && <button type="button" onClick={onOpenSharedRoute}>전체 동선<ChevronRight size={15}/></button>}</header>
        {own && <div className="pr-summary"><div><Route size={18}/><strong>공유한 내 참여 구간</strong></div>{memberRoute(own)}{currentOwnChanges && <button type="button" className="pr-text-action" onClick={() => go('CHANGES')}>바뀐 내용 확인하기<ChevronRight size={16}/></button>}</div>}
        {route.issues.length > 0 && <aside className="pr-notice" data-important="true"><AlertCircle size={18}/><div><strong>일정 확인이 필요해요</strong>{route.issues.map((issue, index) => <p key={index}>{issue}</p>)}</div></aside>}
        {!route.stops.length ? <div className="pr-empty"><Route size={26}/><strong>방문 동선이 먼저 필요해요</strong><p>이 약속의 방문 장소를 담은 뒤 내 참여 구간을 고를 수 있어요.</p>{onOpenSharedRoute && <button type="button" className="pr-primary" onClick={onOpenSharedRoute}>약속 동선 보기<ChevronRight size={17}/></button>}</div> : <>
          {!writable && <p className="pr-notice"><ShieldCheck size={18}/>지금은 기존 참여 구간만 볼 수 있어요.</p>}
          <div className="pr-form">
            <div className="pr-boundaries"><label className="pr-field">함께할 시작<select value={startKey} disabled={!writable || busy} onChange={event => { setStartKey(event.target.value); setWithdrawConfirm(false); }}><option value="">시작 방문 선택</option>{startKey && startIndex < 0 && <option value={startKey} disabled>이전에 고른 시작 방문 · 삭제됨</option>}{route.stops.map(stop => <option key={stop.key} value={stop.key}>{formatStop(stop)}</option>)}</select></label><label className="pr-field">함께할 마지막<select value={endKey} disabled={!writable || busy} onChange={event => { setEndKey(event.target.value); setWithdrawConfirm(false); }}><option value="">마지막 방문 선택</option>{endKey && endIndex < 0 && <option value={endKey} disabled>이전에 고른 마지막 방문 · 삭제됨</option>}{route.stops.map((stop, index) => <option key={stop.key} value={stop.key} disabled={startIndex >= 0 && index < startIndex}>{formatStop(stop)}</option>)}</select></label></div>
            {startKey && endKey && !validSelection && <p className="pr-notice" data-important="true"><AlertCircle size={18}/>시작과 마지막을 현재 일정에서 순서대로 골라 주세요. 삭제된 방문은 다른 곳으로 자동 대체하지 않아요.</p>}
            <label className="pr-field">합류 예정 시각 · 선택<input type="time" value={joinTime} disabled={!writable || busy} onInput={event => setJoinTime(event.currentTarget.value)} onChange={event => setJoinTime(event.target.value)}/><small>첫 참여 방문에서 만날 시각을 직접 입력해 공유해요. 이동 시간이나 도착 예측은 아니에요.</small></label>
            <details className="pr-origin"><summary><MapPin size={18}/><span><strong>내 공개 출발 장소 · 선택</strong><small>{originId ? originPlace?.name || '이전에 고른 장소 · 현재 정보 미확인' : '역·공개 장소를 출발 기준으로 공유해요'}</small></span><ChevronRight size={16}/></summary><p className="pr-muted">선택한 공개 장소가 이 약속의 모임원에게 보여요. 기기 GPS나 집 주소는 수집하지 않아요.</p><label className="pr-search"><Search size={17}/><input type="search" aria-label="내 공개 출발 장소 검색" value={originQuery} disabled={!writable || busy} onChange={event => setOriginQuery(event.target.value)} placeholder="역·공개 장소 이름"/></label><div className="pr-origin-results">{origins.map(place => <button type="button" className="pr-origin-option" key={place.id} aria-pressed={originId === place.id} disabled={!writable || busy} onClick={() => setOriginId(place.id)}><span><strong>{place.name}</strong><small>{place.address || place.area}</small></span>{originId === place.id && <Check size={17}/>}</button>)}{!origins.length && <p className="pr-muted">현재 검색 결과가 없어요. 다른 공개 장소 이름을 찾아 주세요.</p>}</div>{originId && <button type="button" className="pr-secondary" disabled={!writable || busy} onClick={() => setOriginId('')}>출발 장소 공유 안 함</button>}</details>
            {stale && <aside className="pr-notice" data-important="true"><AlertCircle size={18}/><div><p>일정이나 내 공유 구간이 바뀌었어요. 최신 내용을 확인한 뒤 저장해 주세요.</p><button type="button" className="pr-secondary" disabled={busy} onClick={refreshForm}>최신 일정 확인 · 내 입력 유지</button></div></aside>}
            {writable && <div className="pr-form-actions"><p className="pr-muted">이 구간·합류 시각·공개 출발 장소를 모임원에게 공유해요. 약속 참석 응답과 예약은 바뀌지 않아요.</p><button type="button" className="pr-primary" disabled={busy || stale || !validSelection || !draftChanged && own?.status === 'CURRENT'} onClick={save}>{own ? '내 참여 구간 다시 공유' : '내 참여 구간 공유'}<ArrowRight size={17}/></button>{draftChanged && own && <button type="button" className="pr-text-action" disabled={busy} onClick={resetToSaved}>저장된 내 선택으로 돌리기</button>}</div>}
          </div>
          {selectedStops.length > 0 && <div className="pr-days"><header className="pr-heading"><div><h4>{draftChanged || !own ? '선택한 내 구간' : '내가 함께할 동선'}</h4><p className="pr-muted">{selectedStops.length}곳{draftChanged || !own ? ' · 아직 공유 전' : ''} · {dayGroups.length}일</p></div></header>{dayGroups.map(day => <section className="pr-day" key={day.dayId}><header><h4>DAY {day.day}</h4><small>{day.date || '날짜 미정'} · {day.stops.length}곳</small></header><div className="pr-map"><Suspense fallback={<p className="pr-map-loading">선택한 구간 지도를 불러오는 중…</p>}><RouteMap places={day.stops.flatMap(stop => { const place = rawPlace(stop); return place ? [place] : []; })} onSelectVisit={visitId => { const stop = day.stops.find(stop => stop.visitId === visitId); if (stop) openStop(stop); }}/></Suspense></div><ol className="pr-stops">{day.stops.map((stop, index) => <li key={stop.key} className="pr-stop"><span>{index + 1}</span><button type="button" onClick={() => openStop(stop)}><small>{stop.time || '시각 미정'}{stop.key === startKey ? ' · 내 합류 방문' : ''}{stop.key === endKey ? ' · 내 마지막 방문' : ''}</small><strong>{stop.name}</strong><small>{stop.address || stop.area}</small></button></li>)}</ol></section>)}<p className="pr-muted">현재 공유된 방문 순서를 표시해요. 실시간 위치·교통·합류 시각 계산은 제공하지 않아요.</p></div>}
        </>}
        {own && canWithdraw && <div><button type="button" className="pr-text-action" disabled={busy} aria-expanded={withdrawConfirm} onClick={() => setWithdrawConfirm(value => !value)}>내 구간 공유 해제</button>{withdrawConfirm && <div className="pr-confirm"><h4>내 구간만 공유 해제할까요?</h4><p>모임 가입·약속 참석 응답·전체 동선은 그대로 유지해요.</p><button type="button" className="pr-secondary" disabled={busy} onClick={() => void run(() => onWithdraw({ expectedRevision: own.revision, routeVersion: route.version }), '내 참여 구간 공유를 해제했어요. 참석 응답은 그대로예요.', () => { setStartKey(''); setEndKey(''); setOriginId(''); setJoinTime(''); setFormRevision(0); setFormVersion(route.version); setWithdrawConfirm(false); setPreview(null); })}>내 구간 공유 해제하기</button><button type="button" className="pr-text-action" disabled={busy} onClick={() => setWithdrawConfirm(false)}>계속 공유하기</button></div>}</div>}
      </div>}
      {tab === 'MEMBERS' && <div className="pr-section" role="tabpanel" id="personal-route-MEMBERS" aria-labelledby="personal-route-tab-MEMBERS"><header className="pr-heading"><div><h3>각자 어디서 만날까요?</h3><p className="pr-muted">직접 공유한 구간만 보여요. 구간 선택과 약속 참석 응답은 별개예요.</p></div></header><div className="pr-member-list">{members.map(view => <article className="pr-member" key={view.userId}><button type="button" className="pr-person" disabled={!onOpenMember} onClick={() => onOpenMember?.(view.userId)} aria-label={`${memberName(state, view.userId, groupId, activityId)}님 프로필 보기`}><MemberAvatar name={memberName(state, view.userId, groupId, activityId)} avatar={resolveRoomIdentity(state, view.userId, groupId, activityId).avatar}/><span><strong>{memberName(state, view.userId, groupId, activityId)}{view.userId === userId ? ' · 나' : ''}</strong><small>{view.stops.length}곳 · {activity.participants[view.userId] === 'JOINED' ? '약속 참석' : activity.participants[view.userId] === 'MAYBE' ? '참석 미정' : activity.participants[view.userId] === 'DECLINED' ? '약속 불참' : '참석 응답 전'}</small></span>{onOpenMember && <ChevronRight size={16}/>}</button>{memberRoute(view)}</article>)}{missingMemberIds.map(id => <article className="pr-member" key={id}><button type="button" className="pr-person" disabled={!onOpenMember} onClick={() => onOpenMember?.(id)} aria-label={`${memberName(state, id, groupId, activityId)}님 프로필 보기`}><MemberAvatar name={memberName(state, id, groupId, activityId)} avatar={resolveRoomIdentity(state, id, groupId, activityId).avatar}/><span><strong>{memberName(state, id, groupId, activityId)}{id === userId ? ' · 나' : ''}</strong><small>아직 참여 구간을 공유하지 않았어요.</small></span>{onOpenMember && <ChevronRight size={16}/>}</button></article>)}</div>{!members.length && <p className="pr-muted">내 구간을 먼저 공유해 보세요. 다른 멤버가 선택하면 함께 볼 수 있어요.</p>}</div>}
      {tab === 'CHANGES' && <div className="pr-section" role="tabpanel" id="personal-route-CHANGES" aria-labelledby="personal-route-tab-CHANGES"><header className="pr-heading"><div><h3>내 참여에 영향을 준 변경</h3><p className="pr-muted">내가 마지막으로 공유·확인한 일정과 현재 일정을 비교해요.</p></div></header>{!own ? <div className="pr-empty"><Route size={26}/><strong>내 구간을 먼저 골라 주세요</strong><p>공유한 구간을 기준으로 장소·순서·날짜 변경을 확인할 수 있어요.</p><button type="button" className="pr-primary" onClick={() => go('MY')}>내 참여 구간 고르기</button></div> : !currentOwnChanges ? <div className="pr-empty"><CheckCheck size={26}/><strong>확인할 새 변경이 없어요</strong><p>공유한 구간은 현재 일정과 같아요.</p><button type="button" className="pr-secondary" onClick={() => go('MY')}>내 참여 구간 보기</button></div> : <>
        <aside className="pr-notice" data-important="true"><AlertCircle size={18}/><div><strong>{own.status === 'INVALID' ? '선택한 구간을 다시 확인해 주세요' : '공유 일정이 바뀌었어요'}</strong><p>{own.needsReselect ? '시작·마지막 방문이 삭제되거나 순서가 바뀌어 구간을 유지할 수 없어요. 직접 다시 선택해 주세요.' : '아래 변경을 확인하고 내 참여 구간을 유지할지 정해 주세요.'}</p></div></aside>
        <div className="pr-change-list">{own.changes.map((change, index) => <article key={`${change.kind}:${change.stopKey || ''}:${index}`} className="pr-change"><header>{change.kind === 'TIME' || change.kind === 'DATE' ? <Clock3 size={18}/> : <Route size={18}/>}<strong>{change.label}</strong></header>{(printable(change.before) || printable(change.after)) && <dl className="pr-review-facts">{printable(change.before) && <div><dt>이전</dt><dd>{printable(change.before)}</dd></div>}{printable(change.after) && <div><dt>현재</dt><dd>{printable(change.after)}</dd></div>}</dl>}</article>)}</div>
        {!writable ? <p className="pr-muted">종료된 약속은 기록을 볼 수 있고 참여 구간은 바꾸지 않아요.</p> : own.needsReselect || own.status === 'INVALID' ? <button type="button" className="pr-primary" onClick={() => go('MY')}>내 참여 구간 다시 선택<ArrowRight size={17}/></button> : <>
          {!preview && <button type="button" className="pr-primary" onClick={reviewChanges}>현재 변경 내용 확인<CheckCheck size={17}/></button>}
          {preview && <div className="pr-confirm"><h4>이 구간으로 계속 함께할까요?</h4>{memberRoute(own)}<p className="pr-muted">아래 확인은 변경 내용을 읽었다는 표시예요. 예약·참석 응답·다른 멤버 선택은 바꾸지 않아요. 직접 입력한 합류 시각도 유지되므로 필요하면 내 참여에서 수정해 주세요.</p>{!previewCurrent ? <><p role="alert" className="pr-notice">확인 중 일정이 다시 바뀌었어요. 최신 변경을 다시 확인해 주세요.</p><button type="button" className="pr-secondary" onClick={reviewChanges}>최신 변경 다시 확인</button></> : <><label className="pr-check"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)}/><span>변경된 일정과 내 참여 구간을 확인했어요.</span></label><button type="button" className="pr-primary" disabled={busy || !confirmed} onClick={() => void run(() => onAcknowledge(preview), '변경된 내 참여 구간을 확인했어요.', () => { setPreview(null); setConfirmed(false); setFormVersion(route.version); setFormRevision((own?.revision || 0) + 1); })}>이 구간 유지 · 변경 확인<Check size={17}/></button></>}<button type="button" className="pr-text-action" disabled={busy} onClick={() => go('MY')}>참여 구간을 바꿀래요</button></div>}
        </>}
      </>}</div>}
    </>}
    {error && <p className="pr-error" role="alert"><AlertCircle size={18}/>{error}</p>}{status && <p className="pr-status" role="status"><Check size={18}/>{status}</p>}
  </section>;
}
