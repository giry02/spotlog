import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { CalendarDays, Car, Check, ChevronLeft, ClipboardList, Copy, DoorOpen, Link, LockKeyhole, MapPin, Pencil, Route, ShieldCheck } from 'lucide-react';
import type { Place } from '../data';
import type { TogetherState } from './model';
import { previewVisitGuide, selectVisitGuide } from './visitGuides';
import type { VisitGuideFields, VisitGuideInput, VisitGuidePreview, VisitGuideProjection, VisitGuidePublication } from './visitGuideTypes';
import './visit-guide.css';

const GuideMap = lazy(() => import('../InterestPlacesMap'));
const labels = { LANDMARK: '명소', FOOD: '음식점', CAFE: '카페', STAY: '숙소', SHOP: '쇼핑', LEISURE: '레저' };
export interface VisitGuidePanelProps {
  state: TogetherState; userId: string; groupId: string; activityId: string; places: Place[];
  onSave: (input: VisitGuideInput) => boolean | Promise<boolean>;
  onPublish: (preview: VisitGuidePreview) => boolean | Promise<boolean>;
  onRevoke: (guideId: string, expectedRevision: number) => boolean | Promise<boolean>;
  getLink?: (token: string) => string | undefined;
  onOpenLink?: (token: string) => void;
}
export function VisitGuideReadOnly({ projection, updatedAt }: { projection: VisitGuideProjection; updatedAt?: string }) {
  const [map, setMap] = useState(false), [selectedDay, setSelectedDay] = useState(0), [selectedPlaceId, setSelectedPlaceId] = useState('');
  const days = [...new Set(projection.stops.map(stop => stop.day))], currentDay = days.includes(selectedDay) ? selectedDay : days[0];
  const currentStops = projection.stops.filter(stop => stop.day === currentDay);
  const mapPlaces: Place[] = currentStops.map(stop => ({ id: stop.placeId, name: stop.name, kind: stop.kind, address: stop.address, area: '', lat: stop.lat ?? 0, lng: stop.lng ?? 0, locationVerified: stop.lat !== undefined && stop.lng !== undefined, image: '', note: '', description: '', duration: '' }));
  const detail = currentStops.find(stop => stop.placeId === selectedPlaceId);
  return <article className="visit-guide-content">
    <header className="vg-content-title"><span><ShieldCheck size={18}/>방문 안내</span><h3>{projection.title}</h3></header>
    <div className="vg-facts"><p><CalendarDays size={18}/><span>{projection.date || '날짜 미정'}{projection.endDate && projection.endDate !== projection.date ? ` ~ ${projection.endDate}` : ''}{projection.time ? ` · ${projection.time}` : ' · 시각 미정'}<small>한국 시각</small></span></p><p><MapPin size={18}/><span>{projection.meetingText || '집합 위치를 아직 적지 않았어요.'}</span></p></div>
    {([{ icon: DoorOpen, title: '어디로 들어가나요?', body: projection.entry, empty: '입구 안내를 아직 적지 않았어요.' }, { icon: Car, title: '주차는 어디에 하나요?', body: projection.parking, empty: '주차 정보는 확인이 필요해요.' }, { icon: ClipboardList, title: '준비할 것', body: projection.preparations, empty: '별도로 적은 준비물이 없어요.' }]).map(({ icon: Icon, title, body, empty }) => <section className="vg-info-block" key={title}><h4><Icon size={18}/>{title}</h4><p className={body ? undefined : 'vg-muted'}>{body || empty}</p></section>)}
    <section className="vg-route"><header><h4><Route size={18}/>방문 순서 · {projection.stops.length}곳</h4>{projection.stops.length > 0 && <button type="button" className="vg-text" aria-pressed={map} onClick={() => setMap(value => !value)}>{map ? '지도 접기' : '지도 보기'}</button>}</header>
      {days.length > 1 && <label className="vg-field vg-day">날짜별 동선<select value={currentDay || ''} onChange={event => { setSelectedDay(Number(event.target.value)); setSelectedPlaceId(''); }}>{days.map(value => <option value={value} key={value}>DAY {value}</option>)}</select></label>}
      {map && currentStops.length > 0 && <Suspense fallback={<p className="vg-muted" role="status">지도를 불러오는 중…</p>}><GuideMap places={mapPlaces} onSelectPlace={place => setSelectedPlaceId(place.id)} heading="방문할 장소 위치" ariaLabel="방문 안내의 공개 장소 지도" mapLabel="방문 순서의 공개 장소 위치 지도"/></Suspense>}
      {detail && <p className="vg-map-detail"><MapPin size={16}/>{detail.name} · {detail.address || '주소 확인 전'}</p>}
      {!projection.stops.length ? <p className="vg-muted">이번 안내에서 공유한 방문 장소가 없어요.</p> : <ol>{currentStops.map((stop, index) => <li key={`${stop.day}:${stop.order}`}><span className="vg-stop-number">{index + 1}</span><div><small>DAY {stop.day} · {labels[stop.kind]}</small><strong>{stop.name}</strong><p>{stop.address || '주소 확인 전'}</p></div></li>)}</ol>}
      <p className="vg-muted">선택한 공개 장소의 방문 순서예요. 지도는 위치 참고용이며 실제 이동 경로·시간과 영업·주차 가능 여부는 별도 확인해 주세요.</p>
    </section>
    {updatedAt && <p className="vg-muted">안내 갱신 · {new Date(updatedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</p>}
  </article>;
}
export function VisitGuideGuest({ publication }: { publication: VisitGuidePublication }) {
  return <section className="visit-guide" aria-label="공유받은 방문 안내"><div className="vg-local-note"><LockKeyhole size={17}/><p>이 브라우저에 저장된 방문 안내예요. 링크를 열어도 모임 가입이나 참석 신청은 되지 않아요. 다른 기기 공유와 실시간 갱신은 아직 지원하지 않아요.</p></div><VisitGuideReadOnly projection={publication.projection} updatedAt={publication.issuedAt}/><p className="vg-muted">열람 기한 · {new Date(publication.expiresAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (한국 시각)</p></section>;
}
export default function VisitGuidePanel(props: VisitGuidePanelProps) {
  return <VisitGuideBody key={`${props.userId}:${props.groupId}:${props.activityId}`} {...props}/>;
}
function VisitGuideBody({ state, userId, groupId, activityId, places, onSave, onPublish, onRevoke, getLink, onOpenLink }: VisitGuidePanelProps) {
  let context;
  try { context = selectVisitGuide(state, userId, { groupId, activityId }, places); } catch { return <p className="visit-guide vg-error" role="alert">현재 이 약속의 방문 안내를 볼 수 없어요.</p>; }
  return <VisitGuideEditor key={`${userId}:${groupId}:${activityId}:loaded`} context={context} state={state} userId={userId} groupId={groupId} activityId={activityId} places={places} onSave={onSave} onPublish={onPublish} onRevoke={onRevoke} getLink={getLink} onOpenLink={onOpenLink}/>;
}
function VisitGuideEditor({ context, ...props }: VisitGuidePanelProps & { context: ReturnType<typeof selectVisitGuide> }) {
  const { state, userId, groupId, activityId, places, onSave, onPublish, onRevoke, getLink, onOpenLink } = props;
  const [fields, setFields] = useState<VisitGuideFields>(context.fields), [activityRevision, setActivityRevision] = useState(context.activity.revision), [guideRevision, setGuideRevision] = useState(context.guide?.revision || 0);
  const [hours, setHours] = useState(24), [mode, setMode] = useState<'READ' | 'EDIT' | 'PREVIEW'>(context.guide ? 'READ' : context.canEdit ? 'EDIT' : 'READ');
  const [reviewed, setReviewed] = useState<VisitGuidePreview | null>(null), [consent, setConsent] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [status, setStatus] = useState('');
  const pending = useRef(false), ownWrite = useRef(false);
  const latestGuideRevision = context.guide?.revision || 0, stale = activityRevision !== context.activity.revision || guideRevision !== latestGuideRevision;
  const eligibleKeys = context.sourceStops.filter(stop => stop.publicStop).map(stop => stop.key);
  const unavailableSelectedKeys = fields.selectedStopKeys.filter(key => !eligibleKeys.includes(key));
  useEffect(() => {
    if (!ownWrite.current) return;
    ownWrite.current = false; setFields(context.fields); setActivityRevision(context.activity.revision); setGuideRevision(latestGuideRevision); setReviewed(null); setConsent(false); setMode('READ');
  }, [latestGuideRevision, context.activity.revision]);
  const update = (patch: Partial<VisitGuideFields>) => { setFields(value => ({ ...value, ...patch })); setReviewed(null); setConsent(false); setError(''); setStatus(''); };
  const input: VisitGuideInput = { ...fields, expectedActivityRevision: activityRevision, expectedGuideRevision: guideRevision, validityHours: hours };
  const run = async (operation: () => boolean | Promise<boolean>, success: string) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(''); setStatus(''); ownWrite.current = true;
    try { if (await operation()) { setStatus(success); } else { ownWrite.current = false; setError('저장하지 못했어요. 현재 내용과 브라우저 저장 공간을 확인한 뒤 다시 시도해 주세요.'); } }
    catch (cause) { ownWrite.current = false; setError(cause instanceof Error ? cause.message : '안내를 저장하지 못했어요.'); }
    finally { pending.current = false; setBusy(false); }
  };
  const publication = context.guide?.publication;
  let localLink: string | undefined; if (publication && !publication.revoked) { try { localLink = getLink?.(publication.token); } catch { localLink = undefined; } }
  const review = () => { try { setReviewed(previewVisitGuide(state, userId, { groupId, activityId }, input, places)); setConsent(false); setMode('PREVIEW'); setError(''); } catch (cause) { setError(cause instanceof Error ? cause.message : '공유할 내용을 다시 확인해 주세요.'); } };
  return <section className="visit-guide" aria-label="방문 안내 만들기">
    <header className="vg-panel-heading"><div><h3>설명은 한 번, 안내는 한곳에</h3><p>집합 위치·입구·주차·준비물과 방문 순서를 모아요.</p></div>{mode === 'READ' && context.canEdit && <button type="button" className="vg-icon" aria-label="방문 안내 편집" onClick={() => { setMode('EDIT'); setError(''); }}><Pencil size={18}/></button>}</header>
    {stale && <div className="vg-alert"><strong>일정이나 안내가 바뀌었어요.</strong><p>최신 내용을 확인한 후 저장·발급해 주세요.</p><button type="button" className="vg-secondary" onClick={() => { setFields(context.fields); setActivityRevision(context.activity.revision); setGuideRevision(latestGuideRevision); setReviewed(null); setConsent(false); setMode(context.canEdit ? 'EDIT' : 'READ'); }}>최신 내용으로 다시 확인</button></div>}
    {mode === 'READ' ? <>
      {context.outdated && <p className="vg-alert">일정 변경 후 아직 검토하지 않은 안내예요. 편집자가 다시 확인해야 링크를 사용할 수 있어요.</p>}
      {context.guide ? <VisitGuideReadOnly projection={context.projection} updatedAt={context.guide.updatedAt}/> : <div className="vg-empty"><ClipboardList size={25}/><strong>아직 작성한 방문 안내가 없어요</strong><p>편집자가 입구·주차·준비물을 적으면 여기에서 함께 확인할 수 있어요.</p></div>}
      {localLink && <section className="vg-link"><strong><Link size={17}/>이 브라우저에서 열 수 있는 링크</strong>{onOpenLink && context.guide?.publication && <button type="button" className="vg-secondary" onClick={() => onOpenLink(context.guide!.publication!.token)}>안내 열어보기</button>}<input aria-label="방문 안내 로컬 링크" readOnly value={localLink} onFocus={event => event.currentTarget.select()}/><button type="button" className="vg-secondary" onClick={() => { void navigator.clipboard?.writeText(localLink!).then(() => setStatus('링크를 복사했어요. 같은 브라우저에서 열어 확인할 수 있어요.')).catch(() => setError('링크를 선택한 뒤 직접 복사해 주세요.')); }}><Copy size={16}/>링크 복사</button></section>}
      {publication && !publication.revoked && !localLink && <p className="vg-alert">링크를 열 수 있는 저장본이 없거나 일정이 변경됐어요. 편집에서 내용을 다시 확인하고 발급해 주세요.</p>}
      {context.canRevoke && context.guide && <button type="button" className="vg-text" disabled={busy} onClick={() => { void run(() => onRevoke(context.guide!.id, context.guide!.revision), '방문 안내 링크를 회수했어요.'); }}>발급한 링크 회수</button>}
    </> : <>
      <nav className="vg-steps" aria-label="방문 안내 단계"><span aria-current={mode === 'EDIT' ? 'step' : undefined}>1 안내 작성</span><span aria-current={mode === 'PREVIEW' ? 'step' : undefined}>2 공유 내용 확인</span></nav>
      {mode === 'EDIT' ? <>
        <label className="vg-field">안내 제목<input value={fields.title} maxLength={100} onChange={event => update({ title: event.target.value })}/></label>
        <p className="vg-date"><CalendarDays size={17}/>{context.activity.date || '날짜 미정'}{context.activity.startTime ? ` · ${context.activity.startTime}` : ' · 시각 미정'}<small>현재 약속 기준</small></p>
        <label className="vg-field">집합 위치<textarea rows={2} placeholder="예: 식당 정문 앞에서 만나요" maxLength={300} value={fields.meetingText} onChange={event => update({ meetingText: event.target.value })}/></label>
        <details className="vg-extra" open><summary>입구·주차·준비물</summary><label className="vg-field">입구 안내<textarea rows={2} placeholder="예: 건물 옆 골목 입구, 2층" maxLength={600} value={fields.entry} onChange={event => update({ entry: event.target.value })}/></label><label className="vg-field">주차 안내<textarea rows={2} placeholder="직접 확인한 주차장 위치와 이용 조건" maxLength={600} value={fields.parking} onChange={event => update({ parking: event.target.value })}/></label><label className="vg-field">준비할 것<textarea rows={2} placeholder="예: 편한 신발, 물. 확인이 필요한 내용은 따로 적어 주세요." maxLength={1000} value={fields.preparations} onChange={event => update({ preparations: event.target.value })}/></label></details>
        <fieldset className="vg-route-selection"><legend>안내에 넣을 공개 장소</legend><p className="vg-muted">현재 동선에서 직접 고른 장소만 원래 순서대로 넣어요. 개인 장소·메모·예약·대화·멤버 정보는 가져오지 않아요.</p>{unavailableSelectedKeys.length > 0 && <div className="vg-alert"><p>기존 선택 중 {unavailableSelectedKeys.length}곳은 삭제됐거나 지금 공유할 수 없어요. 선택에서 제외한 뒤 다시 확인해 주세요.</p><button type="button" className="vg-secondary" onClick={() => update({ selectedStopKeys: fields.selectedStopKeys.filter(key => eligibleKeys.includes(key)) })}>공유할 수 없는 장소 선택 해제</button></div>}{eligibleKeys.length > 0 && eligibleKeys.length <= 100 && <button type="button" className="vg-text" onClick={() => update({ selectedStopKeys: [...eligibleKeys] })}>공개 장소 {eligibleKeys.length}곳 모두 선택</button>}{context.sourceStops.length ? context.sourceStops.map(stop => <label className="vg-check" key={stop.key}><input type="checkbox" checked={Boolean(stop.publicStop && fields.selectedStopKeys.includes(stop.key))} disabled={!stop.publicStop || !fields.selectedStopKeys.includes(stop.key) && fields.selectedStopKeys.length >= 100} onChange={event => update({ selectedStopKeys: event.target.checked ? [...fields.selectedStopKeys, stop.key] : fields.selectedStopKeys.filter(key => key !== stop.key) })}/><span><strong>DAY {stop.day} · {stop.label}</strong><small>{stop.unavailableReason || stop.publicStop?.address || '주소 확인 전'}</small></span></label>) : <p className="vg-muted">약속에서 장소와 동선을 먼저 정하면 여기에서 선택할 수 있어요. 장소 없이 안내만 작성해도 돼요.</p>}</fieldset>
        <label className="vg-field">링크 열람 기간<select value={hours} onChange={event => { setHours(Number(event.target.value)); setConsent(false); setReviewed(null); }}><option value={1}>발급 후 1시간</option><option value={24}>발급 후 24시간</option><option value={72}>발급 후 3일</option><option value={168}>발급 후 7일</option></select></label>
        <button type="button" className="vg-primary" disabled={busy || stale || !context.canEdit} onClick={review}>공유될 내용 확인</button>
        <button type="button" className="vg-secondary" disabled={busy || stale || !context.canEdit} onClick={() => { void run(() => onSave(input), '모임 멤버용 안내를 저장했어요. 공유 링크는 발급하지 않았어요.'); }}><LockKeyhole size={16}/>공유 없이 멤버 안내로 저장</button>
      </> : reviewed && <>
        <button type="button" className="vg-text" onClick={() => { setMode('EDIT'); setConsent(false); }}><ChevronLeft size={17}/>작성으로 돌아가기</button>
        <VisitGuideReadOnly projection={reviewed.projection}/>
        {reviewed.omissions.length > 0 && <details className="vg-omissions"><summary>링크에서 제외되는 장소 · {reviewed.omissions.length}곳</summary><ul>{reviewed.omissions.map((item, index) => <li key={index}><strong>{item.label}</strong><small>{item.reason}</small></li>)}</ul><p className="vg-muted">이 제외 목록과 개인 장소 이름은 링크에 표시하지 않아요.</p></details>}
        <div className="vg-local-note"><LockKeyhole size={17}/><p>링크는 이 브라우저에서만 열려요. 안내를 발급해도 모임 가입·참석 신청은 되지 않아요. 현재 화면의 안내 문구와 선택한 공개 장소만 공유해요.</p></div>
        <label className="vg-check"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)}/><span>집합·입구·주차 안내에 개인 주소 등 공유하면 안 되는 내용이 없는지 확인했고, 위 내용으로 {hours}시간 동안 열 수 있는 링크를 발급합니다.</span></label>
        <button type="button" className="vg-primary" disabled={!consent || busy || stale || !context.canEdit} onClick={() => { void run(() => onPublish(reviewed), '방문 안내를 발급했어요. 같은 브라우저에서 링크를 확인할 수 있어요.'); }}><Link size={17}/>{busy ? '저장 중…' : '확인한 내용으로 로컬 링크 발급'}</button>
      </>}
      {context.guide && <button type="button" className="vg-text" disabled={busy} onClick={() => { setMode('READ'); setReviewed(null); setConsent(false); }}>저장된 안내 보기</button>}
    </>}
    {status && <p className="vg-status" role="status"><Check size={17}/>{status}</p>}{error && <p className="vg-error" role="alert">{error}</p>}
  </section>;
}
