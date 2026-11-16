import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { memberName, type TogetherState } from './model';
import { canReadChatDigest, chatDigestSelectionKey, createChatDigest, groupChatDigestSources, projectChatDigest, selectChatDigestMessages,
  type ChatDigestContext, type ChatDigestFilters, type ChatDigestScope, type ChatDigestSnapshot } from './chatDigest';
import { chatAiSummaryPurposes, configuredChatAiEndpoint, createChatAiSummaryRequest, normalizeAiEndpoint, projectChatAiRequest, requestChatAiSummary,
  type ChatAiSummaryPurpose, type ChatAiSummaryRequest, type ChatAiSummarySnapshot } from './chatAiSummary';
import './conversation-summary.css';

export interface ConversationSummaryProps {
  state: TogetherState;
  userId: string;
  groupId: string;
  roomId: string;
  unreadAfter: string | undefined;
  onSource: (messageId: string) => void;
  /** A service URL only; credentials for an AI provider stay on the server. */
  aiEndpoint?: string;
  /** Isolated development review may inject an HTTP transport without sending private text. */
  reviewAiFetch?: typeof fetch;
}
const scopeLabels: Record<ChatDigestScope, string> = { unread: '안 읽은 대화', today: '오늘', recent7: '최근 7일', date: '기간 선택', all: '이 채팅 전체' };
const timeLabel = (value: string) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(value));

/** Revoking access unmounts all private snapshots; a new account/room never reuses their state. */
export default function ConversationSummary(props: ConversationSummaryProps) {
  if (!canReadChatDigest(props)) return <section className="conversation-digest"><p role="status">이 대화를 볼 권한이 없어요.</p></section>;
  return <ConversationSummaryPanel key={JSON.stringify([props.userId, props.groupId, props.roomId])} {...props} />;
}
function ConversationSummaryPanel({ state, userId, groupId, roomId, unreadAfter, onSource, aiEndpoint, reviewAiFetch }: ConversationSummaryProps) {
  const labelId = useId();
  let connected = false;
  try { connected = Boolean(normalizeAiEndpoint(aiEndpoint ?? configuredChatAiEndpoint())); } catch { /* The AI tab explains invalid configuration without blocking readable originals. */ }
  const [mode, setMode] = useState<'ai' | 'originals'>(() => connected ? 'ai' : 'originals');
  const [purpose, setPurpose] = useState<ChatAiSummaryPurpose>('KEY_POINTS');
  const [scope, setScope] = useState<ChatDigestScope>('unread');
  const [target, setTarget] = useState<'all' | 'person'>('all');
  const [personId, setPersonId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [snapshot, setSnapshot] = useState<ChatDigestSnapshot | null>(null);
  const [limit, setLimit] = useState(12);
  const [conditionsOpen, setConditionsOpen] = useState(false);
  const [error, setError] = useState('');
  const context: ChatDigestContext = { state, userId, groupId, roomId, unreadAfter };
  const filters: ChatDigestFilters = { scope, authorId: target === 'person' ? personId : undefined, from, to };
  const speakers = [...new Set(state.messages.filter(message => message.roomId === roomId && !message.deleted && message.entity === undefined && message.body.trim()).map(message => message.authorId))];
  let selectedCount = 0, selectionError = '';
  try { selectedCount = selectChatDigestMessages(context, filters).length; }
  catch (cause) { selectionError = cause instanceof Error ? cause.message : '선택한 조건을 확인해 주세요.'; }
  const projection = snapshot ? projectChatDigest(context, snapshot) : null;
  const stale = Boolean(snapshot && chatDigestSelectionKey(filters, unreadAfter) !== chatDigestSelectionKey(snapshot.filters, snapshot.unreadAfter));
  const groups = groupChatDigestSources(projection?.sources.slice(0, limit) ?? []);
  const collect = () => {
    try { setSnapshot(createChatDigest(context, filters)); setLimit(12); setConditionsOpen(false); setError(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '대화를 모아보지 못했어요. 다시 확인해 주세요.'); }
  };
  const source = (messageId: string) => {
    if (!snapshot || !projectChatDigest(context, snapshot).sources.some(message => message.id === messageId)) { setError('원문이 바뀌었거나 접근할 수 없어요. 다시 모아보세요.'); return; }
    onSource(messageId);
  };
  const snapshotScope = snapshot ? `${scopeLabels[snapshot.filters.scope]}${snapshot.filters.scope === 'date' ? ` · ${snapshot.filters.from}~${snapshot.filters.to}` : ''} · ${snapshot.filters.authorId ? memberName(state, snapshot.filters.authorId) : '전체 참여자'}` : '';

  return <section className="conversation-digest" aria-labelledby={labelId}>
    <header className="conversation-digest-heading"><h3 id={labelId}>대화 정리</h3>{!connected && <small>지금은 원문 모아보기를 사용할 수 있어요. AI 요약은 서버 연결 후 제공돼요.</small>}</header>
    <div className="conversation-summary-tabs" role="tablist" aria-label="대화 정리 방식" onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 'ai' : event.key === 'End' ? 'originals' : mode === 'ai' ? 'originals' : 'ai';
      setMode(next); document.getElementById(`${labelId}-tab-${next}`)?.focus();
    }}>{([['ai', 'AI 요약'], ['originals', '원문 모아보기']] as const).map(([id, label]) => <button type="button" key={id} id={`${labelId}-tab-${id}`} role="tab" aria-selected={mode === id} aria-controls={`${labelId}-panel-${id}`} tabIndex={mode === id ? 0 : -1} onClick={() => setMode(id)}>{label}</button>)}</div>
    {selectionError && <p className="conversation-digest-error" role="alert">{selectionError}</p>}
    <div hidden={mode !== 'ai'} id={`${labelId}-panel-ai`} role="tabpanel" aria-labelledby={`${labelId}-tab-ai`}><AiSummaryPanel active={mode === 'ai'} context={context} filters={filters} purpose={purpose} selectionError={selectionError} selectedCount={selectedCount} endpoint={aiEndpoint} fetcher={reviewAiFetch} onSource={onSource}/></div>
    <div hidden={mode !== 'originals'} id={`${labelId}-panel-originals`} role="tabpanel" aria-labelledby={`${labelId}-tab-originals`}>
    {error && <p className="conversation-digest-error" role="alert">{error}</p>}
    {snapshot && projection && !projection.forbidden && <div className="conversation-digest-results">
      {stale && <p className="conversation-digest-status" role="status">조건이 바뀌었어요. 아래는 이전 조건의 결과예요. 선택한 대화를 다시 모아보세요.</p>}
      <div className="conversation-digest-result-meta"><strong>모아본 발언 {projection.sources.length}개</strong><span>{snapshotScope}</span><span>기준 시각 {timeLabel(snapshot.cutoff)} KST</span></div>
      {projection.removedCount > 0 && <p className="conversation-digest-status" role="status">원문이 수정·삭제된 {projection.removedCount}개 발언은 결과에서 제외했어요.</p>}
      {projection.newMessageCount > 0 && <div className="conversation-digest-refresh" role="status"><span>모아본 범위에 새 발언 {projection.newMessageCount}개가 있어요.</span><button type="button" disabled={Boolean(selectionError)} onClick={collect}>다시 모아보기</button></div>}
      {!projection.sources.length && <div className="conversation-digest-empty"><p>선택한 범위에 모아볼 원문이 없어요.</p><span>기간이나 참여자를 바꿔 다시 모아볼 수 있어요.</span></div>}
      {groups.map(group => <section className="conversation-digest-group" key={group.id}><h4>{group.label}</h4>{group.sources.map(message => <article className="conversation-digest-source" key={message.id}><div className="conversation-digest-meta">{memberName(state, message.authorId)} · {timeLabel(message.createdAt)}</div><blockquote>{message.body}</blockquote><button type="button" aria-label={`${memberName(state, message.authorId)}님의 원문 보기`} onClick={() => source(message.id)}>원문 보기</button></article>)}</section>)}
      {projection.sources.length > limit && <button type="button" className="conversation-digest-more" onClick={() => setLimit(current => current + 12)}>발언 더 보기 · 남은 {projection.sources.length - limit}개</button>}
      <p className="conversation-digest-meta">원문은 그대로 표시하며 결정·담당자·예약 상태를 판단하지 않아요. 읽음 위치와 일정도 바꾸지 않아요.</p>
    </div>}
    {!snapshot && <div className="conversation-digest-empty"><strong>필요한 대화부터 모아봐요</strong><p>{scopeLabels[scope]} · {target === 'person' ? '선택한 참여자' : '전체 참여자'} · 발언 {selectedCount}개</p><span>원문을 주제별로 모아 보여줘요. 결정·미정 여부를 AI가 판단한 결과는 아니에요.</span></div>}
    <div className="conversation-digest-actions"><button type="button" className="conversation-digest-collect" disabled={Boolean(selectionError)} onClick={collect}>{snapshot ? '선택한 대화 다시 모아보기' : '선택한 대화 모아보기'}</button></div>
    </div>
    <details className="conversation-digest-conditions" open={conditionsOpen} onToggle={event => setConditionsOpen(event.currentTarget.open)}>
      <summary><span><strong>정리 조건</strong><small>{scope === 'date' ? `${from || '시작일'}~${to || '종료일'}` : scopeLabels[scope]} · {target === 'person' ? personId ? memberName(state, personId, groupId) : '참여자 선택' : '전체 참여자'}{mode === 'ai' ? ` · ${chatAiSummaryPurposes.find(item => item.id === purpose)?.label}` : ''}</small></span><ChevronDown size={18}/></summary>
      <div className="conversation-digest-filters">
      {mode === 'ai' && <label><span>요약 목적</span><select value={purpose} onChange={event => {
        const next = event.target.value as ChatAiSummaryPurpose; setPurpose(next);
        if (next === 'PERSON') { setTarget('person'); if (!personId) setPersonId(speakers[0] ?? ''); }
      }}>{chatAiSummaryPurposes.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}
      <div className="conversation-digest-target" role="group" aria-label="모아볼 발언자">
        <button type="button" aria-pressed={target === 'all'} onClick={() => { setTarget('all'); if (purpose === 'PERSON') setPurpose('KEY_POINTS'); setError(''); }}>전체 참여자</button>
        <button type="button" aria-pressed={target === 'person'} onClick={() => { setTarget('person'); if (!personId) setPersonId(speakers[0] ?? ''); setError(''); }}>특정인</button>
      </div>
      {target === 'person' && <label><span>발언한 참여자</span><select value={personId} onChange={event => { setPersonId(event.target.value); setError(''); }}><option value="">참여자 선택</option>{personId && !speakers.includes(personId) && <option value={personId}>선택한 참여자 · 발언 없음</option>}{speakers.map(id => <option value={id} key={id}>{memberName(state, id)}</option>)}</select></label>}
      <label><span>대화 기간 · 한국 시각</span><select value={scope} onChange={event => { setScope(event.target.value as ChatDigestScope); setError(''); }}>{Object.entries(scopeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {scope === 'date' && <div className="conversation-digest-dates"><label><span>시작 날짜</span><input type="date" value={from} onChange={event => { setFrom(event.target.value); setError(''); }} /></label><label><span>종료 날짜</span><input type="date" value={to} onChange={event => { setTo(event.target.value); setError(''); }} /></label></div>}
      <p className="conversation-digest-meta" role="status">{selectionError || `선택한 조건의 발언 ${selectedCount}개`}</p>
      {scope === 'unread' && <p className="conversation-digest-meta">마지막 읽음 이후 내 발언도 함께 포함해요.</p>}
    </div>
    </details>
  </section>;
}

function AiSummaryPanel({ active, context, filters, purpose, selectionError, selectedCount, endpoint: suppliedEndpoint, fetcher, onSource }: {
  active: boolean; context: ChatDigestContext; filters: ChatDigestFilters; purpose: ChatAiSummaryPurpose;
  selectionError: string; selectedCount: number; endpoint?: string; fetcher?: typeof fetch; onSource: (messageId: string) => void;
}) {
  const [snapshot, setSnapshot] = useState<ChatAiSummarySnapshot | null>(null);
  const [generating, setGenerating] = useState(false), [error, setError] = useState(''), [status, setStatus] = useState('');
  const pending = useRef<{ controller: AbortController; request: ChatAiSummaryRequest } | null>(null);
  const generation = useRef(0), live = useRef(true);
  const latest = useRef({ context, filters, purpose, active });
  latest.current = { context, filters, purpose, active };
  const selectionKey = chatDigestSelectionKey(filters, context.unreadAfter);
  let endpoint = '', configurationError = '';
  try { endpoint = suppliedEndpoint === undefined ? configuredChatAiEndpoint() : normalizeAiEndpoint(suppliedEndpoint); }
  catch (cause) { configurationError = cause instanceof Error ? cause.message : 'AI 서버 연결 설정을 확인해 주세요.'; }
  useEffect(() => { live.current = true; return () => { live.current = false; generation.current += 1; pending.current?.controller.abort(); pending.current = null; }; }, []);
  useEffect(() => {
    if (pending.current && (!active || !projectChatAiRequest(context, pending.current.request, filters, purpose).available)) {
      generation.current += 1; pending.current.controller.abort(); pending.current = null; setGenerating(false);
      setStatus(active ? '조건이나 원문이 바뀌어 요청을 취소했어요. 다시 요약해 주세요.' : '요약 요청을 취소했어요.');
    }
  }, [active, selectionKey, purpose, context.state]);
  const projection = snapshot ? projectChatAiRequest(context, snapshot.request, filters, purpose) : null;
  const output = projection?.available ? snapshot?.output : null;
  const generate = async () => {
    setError(''); setStatus('');
    let request: ChatAiSummaryRequest;
    try { request = createChatAiSummaryRequest(context, filters, purpose); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '요약할 대화를 확인해 주세요.'); return; }
    pending.current?.controller.abort();
    const controller = new AbortController(), token = ++generation.current;
    pending.current = { controller, request }; setGenerating(true);
    try {
      const result = await requestChatAiSummary(endpoint, request, controller.signal, fetcher);
      if (!live.current || controller.signal.aborted || token !== generation.current) return;
      const current = latest.current;
      if (!current.active || !projectChatAiRequest(current.context, request, current.filters, current.purpose).available) {
        setStatus('조건이나 원문이 바뀌어 응답을 숨겼어요. 다시 요약해 주세요.'); return;
      }
      setSnapshot({ request, output: result });
    } catch (cause) {
      if (live.current && !controller.signal.aborted && token === generation.current) setError(cause instanceof Error ? cause.message : 'AI 요약을 받지 못했어요. 다시 시도해 주세요.');
    } finally {
      if (live.current && token === generation.current) { pending.current = null; setGenerating(false); }
    }
  };
  const cancel = () => {
    generation.current += 1; pending.current?.controller.abort(); pending.current = null; setGenerating(false); setStatus('요약 요청을 취소했어요.');
  };
  const source = (messageId: string) => {
    if (!snapshot || !projectChatAiRequest(context, snapshot.request, filters, purpose).available || !snapshot.request.payload.sources.some(item => item.id === messageId)) {
      setError('원문이 바뀌었거나 접근할 수 없어요. 다시 요약해 주세요.'); return;
    }
    onSource(messageId);
  };
  return <div className="conversation-ai-panel" aria-busy={generating}>
    {output && snapshot && <div className="conversation-ai-results">
      <div className="conversation-digest-result-meta"><strong>{output.title}</strong><span>{scopeLabels[snapshot.request.payload.filters.scope]} · {chatAiSummaryPurposes.find(item => item.id === snapshot.request.payload.purpose)?.label} · 원문 {snapshot.request.payload.sources.length}개</span><span>기준 시각 {timeLabel(snapshot.request.payload.cutoff)} KST</span></div>
      {projection && projection.newMessageCount > 0 && <p className="conversation-digest-meta" role="status">새 발언 {projection.newMessageCount}개는 아직 포함하지 않았어요. 다시 요약하면 반영해요.</p>}
      {output.sections.map((section, sectionIndex) => <section className="conversation-ai-section" key={sectionIndex}><h4>{section.heading}</h4><ul>{section.items.map((item, itemIndex) => <li key={itemIndex}><p>{item.text}</p><div className="conversation-ai-citations" aria-label="요약의 원문 근거">{item.sourceIds.map((id, index) => {
        const original = snapshot.request.payload.sources.find(message => message.id === id)!;
        return <button type="button" key={id} aria-label={`${memberName(context.state, original.authorId, context.groupId)}님의 근거 원문 보기`} onClick={() => source(id)}>원문 {index + 1} · {memberName(context.state, original.authorId, context.groupId)}</button>;
      })}</div></li>)}</ul></section>)}
      <p className="conversation-digest-meta">AI 요약은 원문과 함께 확인해 주세요. 결정·담당자·예약이나 읽음 위치를 자동으로 바꾸지 않아요.</p>
    </div>}
    {!endpoint && <p className="conversation-ai-unavailable" role="status">{configurationError || 'AI 서버가 아직 연결되지 않았어요. 원문 모아보기는 바로 사용할 수 있어요.'}</p>}
    {endpoint && !output && !selectedCount && <p className="conversation-digest-meta">현재 조건에 요약할 대화가 없어요. 아래 정리 조건에서 기간이나 발언자를 바꿔 주세요.</p>}
    {endpoint && <p className="conversation-digest-meta">선택한 원문 {selectedCount}개를 연결된 AI 서버로 보내요. 요약에서 원문 근거를 확인할 수 있어요.</p>}
    <div className="conversation-ai-actions"><button type="button" className="conversation-digest-collect" disabled={!endpoint || generating || Boolean(selectionError) || !selectedCount} onClick={generate}>{generating ? 'AI 요약 만드는 중…' : snapshot && projection?.available ? 'AI 다시 요약하기' : 'AI 요약 만들기'}</button>{generating && <button type="button" onClick={cancel}>요청 취소</button>}</div>
    {generating && <p className="conversation-digest-meta" role="status">선택한 대화를 요약하고 있어요. 화면을 나가면 요청을 취소해요.</p>}
    {status && <p className="conversation-digest-meta" role="status">{status}</p>}
    {error && <p className="conversation-digest-error" role="alert">{error}</p>}
    {snapshot && projection && !projection.available && <p className="conversation-digest-status" role="status">{projection.reason === 'sources' ? '원문이 수정·삭제되어 이전 AI 요약을 숨겼어요. 다시 요약해 주세요.' : '대화 범위나 목적이 바뀌어 이전 AI 요약을 숨겼어요. 다시 요약해 주세요.'}</p>}

  </div>;
}
