import { useEffect, useRef, useState } from 'react';
import type { Journey, Place } from './data';
import { BottomSheet, hasActiveSheet } from './BottomSheet';
import { Button, Field } from './ui';
import { useAccount, type AccountEntry } from './accountContext';
import { useReport } from './ReportSheet';
import { PrivacySheet } from './PrivacySheet';
import { CardSocial } from './CardSocial';
import './chatbot-host.css';
import { CHATBOT_TARGET_LABELS, CHATBOT_ENTRY_LABELS, clearChatbotLaunch, installChatbotHostBridge, isLocalChatbotHost, isChatbotPlaceSocialEntry, isChatbotPublicSocialEntry, resolveChatbotSocialSelection, previewChatbotDraft, projectChatbotContext, readChatbotLaunch, type ChatbotContextScope, type ChatbotOpenAction, type ChatbotDraft } from './chatbotHostBridge';

type Reply = (value: { ok: true; result?: unknown } | { ok: false; error: string }) => void;
type Pending = { kind: 'open'; action: ChatbotOpenAction; reply?: Reply } | { kind: 'context'; scope: ChatbotContextScope; reply: Reply } | { kind: 'connect'; reply?: Reply } | { kind: 'draft'; draft: ChatbotDraft; action: ChatbotOpenAction; reply: Reply };
/** Reuses existing customer flows. Receiving a message never writes customer data or approves a report/member action. */
export function ChatbotHostController({ journeys, catalog, savedPlaces, selectedJourney, selectedDay, onNavigate, onCreateDraft }: {
  journeys: Journey[]; catalog: Place[]; savedPlaces: Place[]; selectedJourney: Journey | null; selectedDay: number;
  onNavigate(action: ChatbotOpenAction, options?: { placeKind?: Place['kind'] }): void;
  onCreateDraft(draft: ChatbotDraft, allowUnverified: boolean, action: ChatbotOpenAction): { journeyId: string };
}) {
  const account = useAccount()!, report = useReport();
  const [pending, setPending] = useState<Pending | null>(null), pendingRef = useRef<Pending | null>(null);
  const [privacyOpen, setPrivacyOpen] = useState(false), [journeyId, setJourneyId] = useState(''), [day, setDay] = useState(1);
  const [iframeConnected, setIframeConnected] = useState(false), [iframeVisible, setIframeVisible] = useState(false);
  const [placeIds, setPlaceIds] = useState<string[]>([]), [error, setError] = useState('');
  const [blockId, setBlockId] = useState(''), [placeKind, setPlaceKind] = useState<Place['kind']>('LANDMARK'), [allowUnverified, setAllowUnverified] = useState(false);
  const [comment, setComment] = useState<{ journeyId: string; blockId: string; name: string; panel: 'comments' | 'reactions' } | null>(null);
  const launch = useRef(readChatbotLaunch(window.location.search));
  const connectLaunch = useRef(new URLSearchParams(window.location.search).get('chatbotConnect') === '1');
  const current = useRef({ journeys, savedPlaces, selectedJourney, selectedDay });
  current.current = { journeys, savedPlaces, selectedJourney, selectedDay };
  const choose = (request: Pending) => {
    if (pendingRef.current || hasActiveSheet()) { request.reply?.({ ok: false, error: '작성 중인 팝업을 마친 뒤 다시 선택해 주세요.' }); return; }
    const values = current.current;
    if (request.kind === 'connect' || request.kind === 'draft') { pendingRef.current = request; setPending(request); setError(''); setAllowUnverified(false); return; }
    let initial = values.selectedJourney;
    if (request.kind === 'open' && request.action.journeyId) initial = values.journeys.find(item => item.id === request.action.journeyId) ?? null;
    const scope = request.kind === 'context' ? request.scope : request.action.target;
    const entry = request.kind === 'open' ? request.action.entry : undefined;
    if (scope === 'report' || isChatbotPublicSocialEntry(entry)) initial = initial?.visibility === 'PUBLIC' && initial.status === 'PUBLISHED' && initial.purpose !== 'PLAN' && !initial.trash ? initial : null;
    if (scope === 'share_source') initial = values.journeys.find(item => item.id === initial?.sourceJourneyId && item.visibility === 'PUBLIC' && item.status === 'PUBLISHED') ?? (initial?.visibility === 'PUBLIC' ? initial : null);
    if (scope === 'selected-trip' || scope === 'selected-day' || entry === 'personal-place') initial = initial?.isMine && initial.visibility === 'PRIVATE' && initial.purpose === 'PLAN' ? initial : null;
    if (scope === 'journal') initial = initial?.isMine ? initial : null;
    pendingRef.current = request; setPending(request); setJourneyId(initial?.id ?? '');
    const requestedDay = request.kind === 'open' ? request.action.day : undefined;
    setDay(initial?.days.some(item => item.day === requestedDay) ? requestedDay! : initial?.days.some(item => item.day === values.selectedDay) ? values.selectedDay : initial?.days[0]?.day ?? 1);
    setPlaceIds([]); setBlockId(''); setPlaceKind('LANDMARK'); setError('');
  };
  useEffect(() => {
    if (!isLocalChatbotHost(window.location.origin)) return;
    const stop = installChatbotHostBridge({ onOpen: (action, reply) => choose({ kind: 'open', action, reply }), onContext: (scope, reply) => choose({ kind: 'context', scope, reply }), onDraft: (draft, action, reply) => choose({ kind: 'draft', draft, action, reply }) });
    const action = launch.current;
    if (action || connectLaunch.current) {
      // Wait until the navigation state/StrictMode probe settles; no records are changed.
      const timer = window.setTimeout(() => { launch.current = null; connectLaunch.current = false; window.history.replaceState(window.history.state, '', clearChatbotLaunch(window.location.href)); choose(action ? { kind: 'open', action } : { kind: 'connect' }); }, 0);
      return () => { window.clearTimeout(timer); stop(); };
    }
    return stop;
  }, []);
  // Reject pending requests when this host disappears, without replaying later.
  useEffect(() => () => { pendingRef.current?.reply?.({ ok: false, error: '앱 화면 연결이 종료됐어요.' }); }, []);
  const finish = (value?: unknown) => { pendingRef.current?.reply?.({ ok: true, result: value }); pendingRef.current = null; setPending(null); };
  const cancel = () => { pendingRef.current?.reply?.({ ok: false, error: '앱에서 요청을 취소했어요.' }); pendingRef.current = null; setPending(null); };
  const privatePlans = journeys.filter(item => item.isMine && item.purpose === 'PLAN' && item.visibility === 'PRIVATE' && !item.trash);
  const publicJournals = journeys.filter(item => item.visibility === 'PUBLIC' && item.status === 'PUBLISHED' && item.purpose !== 'PLAN' && !item.trash);
  const selected = journeys.find(item => item.id === journeyId);
  const selectedDate = selected?.days.find(item => item.day === day);
  const placeCards = selectedDate?.blocks.flatMap(block => { const place = block.type === 'PLACE' ? selectedDate.places.find(place => block.visitId ? place.visitId === block.visitId : place.id === block.placeId) : undefined; return place ? [{ blockId: block.id, place }] : []; }) ?? [];
  const selectJourney = (id: string) => { const item = journeys.find(item => item.id === id), action = pending?.kind === 'open' ? pending.action : undefined; const date = item?.days.find(item => item.day === action?.day) ?? item?.days[0]; setJourneyId(id); setDay(date?.day ?? 1); setBlockId(isChatbotPlaceSocialEntry(action?.entry) ? date?.blocks.find(block => block.type === 'PLACE' && date.places.some(place => (block.visitId ? place.visitId === block.visitId : place.id === block.placeId) && place.id === action?.placeId))?.id ?? '' : ''); setError(''); };
  const confirm = () => {
    if (!pending || pendingRef.current !== pending) return;
    try {
      if (pending.kind === 'connect') { finish({ opened: 'chatbot' }); setIframeConnected(true); setIframeVisible(true); return; }
      if (pending.kind === 'draft') { const result = onCreateDraft(pending.draft, allowUnverified, pending.action); finish({ created: true, journeyId: result.journeyId, stage: 'DRAFT', overwritten: false, editorReady: false }); setIframeVisible(false); return; }
      if (pending.kind === 'context') {
        const context = projectChatbotContext(pending.scope, account.session.state !== 'SIGNED_IN' ? 'guest-device' : account.adapter.reviewAccount ? 'local-review' : 'verified-member', { journey: selected, day, places: savedPlaces.filter(item => placeIds.includes(item.id)) });
        finish(context); return;
      }
      const action = { ...pending.action }, target = action.target, entry = action.entry;
      if (target === 'profile') { onNavigate({ type: 'open_spotlog', target, entry }); finish({ opened: entry ?? target, submitted: false }); setIframeVisible(false); return; }
      if (action.journeyId && !['report', 'share_source', 'journal'].includes(target) && entry !== 'personal-place' && !isChatbotPublicSocialEntry(entry) && !journeys.some(item => item.id === action.journeyId && !item.trash)) throw new Error('해당 여행이 이 앱에 없어요. 앱의 내 여행에서 다시 선택해 주세요.');
      if (target === 'account') { const member = account.session.state === 'SIGNED_IN'; const accountEntry = entry?.startsWith('account-') ? entry.slice(8) as AccountEntry : undefined; finish({ opened: accountEntry ?? 'account', submitted: false }); setIframeVisible(false); account.openAccount(member ? 'manage' : 'login', accountEntry === 'delete' ? '탈퇴는 계정 화면에서 내용을 확인하고 직접 실행해 주세요. 로컬 검수 계정은 실제 탈퇴를 하지 않아요.' : accountEntry === 'logout' ? '로그아웃은 계정 화면에서 직접 눌러 주세요. 기기 여행은 유지됩니다.' : undefined, accountEntry); return; }
      if (target === 'privacy') { finish({ opened: 'privacy' }); setIframeVisible(false); setPrivacyOpen(true); return; }
      if (target === 'report') {
        const targetJourney = publicJournals.find(item => item.id === journeyId);
        if (!targetJourney || !report) throw new Error('신고할 공개 여행기를 선택해 주세요.');
        finish({ opened: 'report', submitted: false });
        setIframeVisible(false);
        report.openReport({ type: 'JOURNAL', id: targetJourney.id, label: targetJourney.title, journey: targetJourney }); return;
      }
      if (target === 'share_source') {
        if (!publicJournals.some(item => item.id === journeyId)) throw new Error('앱에 있는 공개 원본을 선택해 주세요.');
        action.journeyId = journeyId;
      }
      if (isChatbotPublicSocialEntry(entry)) {
        const resolved = resolveChatbotSocialSelection(action, journeys, journeyId, day, blockId);
        if (resolved.blockId && resolved.placeName) setComment({ journeyId: resolved.journeyId, blockId: resolved.blockId, name: resolved.placeName, panel: entry === 'place-reaction' ? 'reactions' : 'comments' });
        else onNavigate({ type: 'open_spotlog', target: 'community', entry, journeyId: resolved.journeyId });
        finish({ opened: entry, submitted: false }); setIframeVisible(false); return;
      }
      if (target === 'journal' || entry === 'personal-place') {
        if (!journeys.some(item => item.id === journeyId && item.isMine && !item.trash)) throw new Error('내 여행이나 여행기를 선택해 주세요.');
        if (!selectedDate) throw new Error('연결할 여행의 DAY를 선택해 주세요.');
        if (entry === 'personal-place' && !privatePlans.some(item => item.id === journeyId)) throw new Error('개인 장소를 담을 내 비공개 여행을 선택해 주세요.');
        if (target === 'journal' && selected?.purpose === 'PLAN' && (selected.planStage === 'DRAFT' || selected.businessCandidates?.length)) throw new Error('앱에서 개인 일정의 후보를 확인하고 완료한 뒤 여행기로 기록해 주세요.');
        action.journeyId = journeyId; action.day = day;
      }
      if (action.journeyId) {
        const targetJourney = journeys.find(item => item.id === action.journeyId)!;
        if (action.day && !targetJourney.days.some(item => item.day === action.day)) throw new Error('여행에 없는 DAY예요. 다시 선택해 주세요.');
      }
      if (target === 'notifications' && account.session.state !== 'SIGNED_IN') { finish({ opened: 'login-required', settingsChanged: false }); setIframeVisible(false); account.openAccount('login', '알림 설정은 로그인한 뒤 앱 프로필에서 확인해 주세요.'); return; }
      onNavigate(action, { placeKind }); finish({ opened: entry ?? target, dataChanged: target === 'journal' && selected?.purpose === 'PLAN' }); setIframeVisible(false);
    } catch (failure) { setError(failure instanceof Error ? failure.message : '요청 내용을 다시 확인해 주세요.'); }
  };
  const frame = iframeConnected && <>
    <section className="chatbot-host-panel" hidden={!iframeVisible} aria-label="Spotlog 로컬 챗봇">
      <header className="chatbot-host-header"><Button variant="secondary" onClick={() => setIframeVisible(false)}>앱으로 돌아가기</Button><span>Spotlog 챗봇</span></header>
      <iframe src="http://localhost:3001/" title="Spotlog 실제 LLM 챗봇" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" referrerPolicy="strict-origin-when-cross-origin" />
    </section>
    {!iframeVisible && !pending && !privacyOpen && !comment && <div className="chatbot-host-return"><Button variant="secondary" onClick={() => setIframeVisible(true)}>챗봇으로 돌아가기</Button></div>}
  </>;
  const sheet = (() => {
  if (privacyOpen) return <PrivacySheet onClose={() => setPrivacyOpen(false)} />;
  if (comment) return <CardSocial key={`${comment.journeyId}:${comment.blockId}`} journeyId={comment.journeyId} blockId={comment.blockId} placeName={comment.name} initialPanel={comment.panel} controlsHidden onClosePanel={() => setComment(null)} />;
  if (!pending) return null;
  if (pending.kind === 'connect') return <BottomSheet title="Spotlog 안에서 챗봇 연결" onClose={cancel}><div className="plan-form chatbot-host-sheet"><p className="plan-help">이 PC에서 실행 중인 실제 LLM 챗봇을 Spotlog 안에 열어요. 앱의 계정·여행·저장 장소는 자동으로 전달하지 않아요.</p><p className="plan-help">챗봇에서 자료 연결을 요청하면 이 앱에서 공유할 여행·DAY·저장 장소를 직접 고른 뒤 확인할 수 있어요.</p><Button onClick={confirm}>연결해서 열기</Button><Button variant="secondary" onClick={cancel}>취소</Button></div></BottomSheet>;
  if (pending.kind === 'draft') { const days = previewChatbotDraft(pending.draft, catalog), unknown = days.flatMap(day => day.places).filter(item => !item.verified); return <BottomSheet title="새 비공개 일정 초안 가져오기" description={pending.draft.title} onClose={cancel}><div className="plan-form chatbot-host-sheet"><p className="plan-help">모든 DAY와 방문 순서를 새 DRAFT 사본으로 추가해요. 기존 여행을 덮어쓰지 않으며 사진·메모·시간·예약 고정·진행 상태는 가져오지 않아요.</p>{days.map(day => <section className="chatbot-draft-day" key={day.day}><h3>DAY {day.day}</h3>{day.places.length ? <ol>{day.places.map((item, index) => <li key={index}><strong>{item.source.name}</strong><span>{({ LANDMARK: '장소', FOOD: '음식점', CAFE: '카페', SHOP: '상점', STAY: '숙소', LEISURE: '레저' })[item.source.kind]} · {item.reason}</span></li>)}</ol> : <p className="plan-help">장소가 없는 이 DAY도 유지해요.</p>}</section>)}{unknown.length > 0 && <label className="chatbot-host-import-consent"><input type="checkbox" checked={allowUnverified} onChange={event => setAllowUnverified(event.target.checked)} /><span>미확인 {unknown.length}개도 등록 정보·좌표 미확인인 개인 입력으로 가져올게요.</span></label>}<p className="plan-help">여행기로 쓰려면 가져온 개인 일정을 앱에서 확인하고 ‘완료’를 눌러 주세요. 예약·게시 완료 상태로 만들지 않습니다.</p>{error && <p className="ui-error" role="alert">{error}</p>}<Button disabled={Boolean(unknown.length && !allowUnverified)} onClick={confirm}>새 비공개 초안으로 가져오기</Button><Button variant="secondary" onClick={cancel}>취소</Button></div></BottomSheet>; }
  const context = pending.kind === 'context', scope = context ? pending.scope : null;
  const target = pending.kind === 'open' ? pending.action.target : null;
  const entry = pending.kind === 'open' ? pending.action.entry : undefined;
  const choices = context || entry === 'personal-place' ? privatePlans : target === 'report' || target === 'share_source' || isChatbotPublicSocialEntry(entry) ? publicJournals : target === 'journal' ? journeys.filter(item => item.isMine && !item.trash) : [];
  const chooseJourney = scope !== 'saved-places' && (context || ['report', 'share_source', 'journal'].includes(target ?? '') || entry === 'personal-place' || isChatbotPublicSocialEntry(entry));
  return <BottomSheet title={context ? '챗봇에 공유할 자료 선택' : 'Spotlog 화면 열기'} onClose={cancel}>
    <div className="plan-form chatbot-host-sheet">
      <p className="plan-help">{context ? '직접 선택한 여행 제목·지역·DAY·장소 이름과 종류만 로컬 챗봇에 보냅니다. 메모·예약·사진·위치·계정 정보는 보내지 않아요.' : `${entry ? CHATBOT_ENTRY_LABELS[entry] : CHATBOT_TARGET_LABELS[target!]} 화면으로 이동해요. 저장·게시·신고 접수·계정 변경은 해당 화면에서 직접 확인해 주세요.`}</p>
      {chooseJourney && <Field label={context ? '공유할 내 여행' : target === 'report' ? '신고할 공개 여행기' : target === 'share_source' ? '공유 원본 여행기' : isChatbotPublicSocialEntry(entry) ? '반응을 볼 공개 여행기' : '기록할 내 여행 · 여행기'}><select aria-label={context ? '공유할 내 여행' : '연결할 여행'} value={journeyId} onChange={event => selectJourney(event.target.value)}><option value="">{target === 'journal' ? '내 여행 목록에서 선택하기' : '여행을 선택해 주세요'}</option>{choices.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></Field>}
      {(scope === 'selected-day' || target === 'journal' || entry === 'personal-place' || isChatbotPlaceSocialEntry(entry)) && selected && <Field label={context ? '공유할 DAY' : '연결할 DAY'}><select aria-label={context ? '공유할 DAY' : '연결할 DAY'} value={day} onChange={event => { setDay(Number(event.target.value)); setBlockId(''); }}>{selected.days.map(item => <option key={item.day} value={item.day}>DAY {item.day}</option>)}</select></Field>}
      {isChatbotPlaceSocialEntry(entry) && selected && <Field label={entry === 'place-reaction' ? '좋아요를 볼 장소 카드' : '댓글을 볼 장소 카드'}><select aria-label={entry === 'place-reaction' ? '좋아요를 볼 장소 카드' : '댓글을 볼 장소 카드'} value={blockId} onChange={event => setBlockId(event.target.value)}><option value="">실제 장소 카드를 선택해 주세요</option>{placeCards.map(item => <option key={item.blockId} value={item.blockId}>{item.place.name}</option>)}</select></Field>}
      {entry === 'personal-place' && <Field label="직접 등록할 장소 종류"><select aria-label="직접 등록할 장소 종류" value={placeKind} onChange={event => setPlaceKind(event.target.value as Place['kind'])}>{(['LANDMARK', 'FOOD', 'CAFE', 'SHOP', 'LEISURE'] as const).map(kind => <option key={kind} value={kind}>{({ LANDMARK: '장소', FOOD: '음식점', CAFE: '카페', SHOP: '상점', LEISURE: '레저' })[kind]}</option>)}</select></Field>}
      {scope === 'saved-places' && <fieldset className="chatbot-host-place-choices"><legend>공유할 저장 장소 · 최대 30개</legend>{savedPlaces.map(place => <label key={place.id}><input type="checkbox" checked={placeIds.includes(place.id)} onChange={event => { if (event.target.checked && placeIds.length >= 30) { setError('저장 장소는 최대 30개까지 공유할 수 있어요.'); return; } setPlaceIds(event.target.checked ? [...placeIds, place.id] : placeIds.filter(id => id !== place.id)); setError(''); }} /><span>{place.name} · {place.area}</span></label>)}{!savedPlaces.length && <p className="plan-help">저장한 장소가 없어요. 장소 화면에서 먼저 저장해 주세요.</p>}</fieldset>}
      {context && selected && <p className="plan-help">{selected.title} · {scope === 'selected-day' ? `DAY ${day}` : `${selected.days.length}개 DAY`}의 장소 목록을 공유합니다.</p>}
      {context && <p className="plan-help">{account.session.state !== 'SIGNED_IN' ? '비회원 기기 기록이에요. 계정에 동기화된 자료가 아닙니다.' : account.adapter.reviewAccount ? '로컬 검수 계정 · 기기 기록이에요. 실제 서비스 회원 자료가 아닙니다.' : '로그인 상태와 별개로 이 기기에서 선택한 기록만 공유합니다.'}</p>}
      {target === 'journal' && <p className="plan-help">완료된 개인 일정은 원본을 유지하고 별도 비공개 여행기 초안을 하나 만듭니다. DRAFT 일정은 먼저 앱에서 완료해 주세요. 기존 여행기는 선택 DAY에서 이어 씁니다.</p>}
      {isChatbotPublicSocialEntry(entry) && <p className="plan-help">선택한 공개 여행의 화면만 열어요. 반응·댓글에는 샘플과 기기 검수 기록이 포함될 수 있으며, 직접 누르기 전에는 등록하지 않아요. 실제 전송은 서버 연결 후 제공해요.</p>}
      {(target === 'report' || target === 'share_source' || isChatbotPublicSocialEntry(entry)) && !choices.length && <p className="ui-error" role="status">지금 앱에서 연결할 공개 여행기가 없어요.</p>}
      {error && <p className="ui-error" role="alert">{error}</p>}
      <Button onClick={confirm} disabled={Boolean((scope === 'saved-places' && !placeIds.length) || (chooseJourney && !journeyId) || (isChatbotPlaceSocialEntry(entry) && !blockId))}>{context ? '선택한 자료만 공유' : target === 'journal' && selected?.purpose === 'PLAN' ? '별도 여행기 초안을 만들고 열기' : '화면 열기'}</Button>
      <Button variant="secondary" onClick={cancel}>취소</Button>
    </div>
  </BottomSheet>;
  })();
  return <>{frame}{sheet}</>;
}
