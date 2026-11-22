import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronRight, Search, Sparkles, X } from 'lucide-react';
import { BottomSheet } from '../BottomSheet';
import { configuredChatAiEndpoint } from './chatAiSummary';
import { canReadChatDigest, type ChatDigestContext } from './chatDigest';
import { memberName } from './model';
import { chatSearchMessageText, chatSearchSelectionKey, createChatSearchRequest, projectChatSearchRequest, requestChatSearchAnswer, selectChatSearchMessages,
  type ChatSearchFilters, type ChatSearchMemory, type ChatSearchSession, type ChatSearchSnapshot } from './chatSearch';
import './chat-search.css';

interface Props { context: ChatDigestContext; memory: ChatSearchMemory; onClose: () => void; onSource: (id: string) => void }
const kindOptions = [['ALL', '모든 내용'], ['TEXT', '텍스트'], ['LINK', '링크'], ['POLL', '투표'], ['TASK', '준비할 일'], ['NOTICE', '공지'], ['STICKER', '이모티콘']] as const;
const timestamp = (value: string) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));

/** Search and AI question drafts stay in parent-owned actor/room memory, independently from the composer. */
export default function ChatSearchPanel({ context, memory, onClose, onSource }: Props) {
  const [session, setSession] = useState(() => memory.read(context));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const current = useRef(context); current.current = context;
  const value = useRef(session); value.current = session;
  const request = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const results = useRef<HTMLDivElement>(null);
  const activityId = context.roomId.startsWith('activity:') ? context.roomId.slice(9) : undefined;
  const name = (id: string) => memberName(context.state, id, context.groupId, activityId);
  const group = context.state.groups.find(item => item.id === context.groupId);
  const authorIds = [...new Set([...(group?.memberIds || []), ...context.state.messages.filter(message => message.roomId === context.roomId && !message.deleted).map(message => message.authorId)])];
  const selection = chatSearchSelectionKey(session.question, session.filters);
  const ai = session.ai && projectChatSearchRequest(context, session.ai.request, session.question, session.filters) ? session.ai : undefined;
  let endpoint = '', endpointError = '';
  try { endpoint = configuredChatAiEndpoint(); } catch { endpointError = 'AI 연결 주소를 확인하지 못했어요. 대화 검색은 계속 이용할 수 있어요.'; }
  let matches: ReturnType<typeof selectChatSearchMessages> = [], filterError = '';
  try { matches = selectChatSearchMessages(context, session.query, session.filters); }
  catch (reason) { filterError = reason instanceof Error ? reason.message : '검색 조건을 확인해 주세요.'; }
  const cancel = () => { request.current?.abort(); request.current = null; setBusy(false); };
  const update = (patch: Partial<ChatSearchSession>, resetScroll = true) => {
    cancel();
    const next = { ...value.current, ...patch, ...(resetScroll ? { scrollTop: 0 } : {}) };
    if (!memory.write(current.current, next)) return;
    value.current = next; setSession(next); setError('');
    if (resetScroll && results.current) results.current.scrollTop = 0;
  };
  const updateFilters = (patch: Partial<ChatSearchFilters>) => update({ filters: { ...value.current.filters, ...patch } });
  const rememberScroll = () => {
    const next = { ...value.current, scrollTop: results.current?.scrollTop || 0 };
    if (memory.write(current.current, next)) value.current = next;
  };
  useLayoutEffect(() => { if (results.current) results.current.scrollTop = session.scrollTop; input.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => () => { request.current?.abort(); request.current = null; }, []);
  useEffect(() => { request.current?.abort(); request.current = null; setBusy(false); }, [selection, session.mode]);
  useEffect(() => {
    if (value.current.ai && !projectChatSearchRequest(context, value.current.ai.request, value.current.question, value.current.filters)) {
      const next = { ...value.current, ai: undefined }; value.current = next; setSession(next); memory.write(context, next);
    }
    if (!canReadChatDigest(context)) { request.current?.abort(); request.current = null; setBusy(false); }
  }, [context.state, context.userId, context.groupId, context.roomId]);
  const jump = (id: string) => {
    try {
      // Source buttons are checked again against current canonical data, not a cached row.
      if (!selectChatSearchMessages(current.current, '', { scope: 'all', kind: 'ALL' }).some(message => message.id === id)) throw new Error('이 대화가 바뀌었거나 더는 볼 수 없어요. 다시 검색해 주세요.');
      const next = { ...value.current, selectedId: id, scrollTop: results.current?.scrollTop || 0 };
      if (!memory.write(current.current, next)) throw new Error('이 방의 검색 내용을 보관하지 못했어요.');
      request.current?.abort(); request.current = null; onClose(); onSource(id);
    } catch (reason) { setError(reason instanceof Error ? reason.message : '원문을 열지 못했어요.'); }
  };
  const ask = async () => {
    if (request.current || !endpoint) return;
    let captured;
    try { captured = createChatSearchRequest(current.current, value.current.question, value.current.filters); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '질문할 범위를 확인해 주세요.'); return; }
    const controller = new AbortController(); request.current = controller; setBusy(true); setError('');
    const pending = { ...value.current, ai: undefined }; value.current = pending; setSession(pending); memory.write(current.current, pending);
    try {
      const output = await requestChatSearchAnswer(endpoint, captured, controller.signal, () => current.current);
      if (request.current !== controller || controller.signal.aborted || !projectChatSearchRequest(current.current, captured, value.current.question, value.current.filters)) return;
      const snapshot: ChatSearchSnapshot = { request: captured, output };
      const next = { ...value.current, ai: snapshot };
      if (memory.write(current.current, next)) { value.current = next; setSession(next); }
    } catch (reason) {
      if (request.current === controller && !controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'AI 답변을 받지 못했어요. 다시 시도해 주세요.');
    } finally { if (request.current === controller) { request.current = null; setBusy(false); } }
  };
  if (!canReadChatDigest(context)) return <BottomSheet title="대화 검색" onClose={onClose}><p role="alert">이 대화를 볼 권한이 바뀌었어요. 모임 화면에서 참여 상태를 확인해 주세요.</p></BottomSheet>;
  return <BottomSheet title="대화 검색" description="이 대화방 안에서 찾아요." onClose={() => { rememberScroll(); onClose(); }}>
    <div className="tg tg-search-panel">
      <div className="tg-search-modes" role="tablist" aria-label="대화 찾기 방식">
        <button type="button" role="tab" aria-selected={session.mode === 'KEYWORD'} onClick={() => update({ mode: 'KEYWORD' })}><Search size={16}/>대화 검색</button>
        <button type="button" role="tab" aria-selected={session.mode === 'AI'} onClick={() => update({ mode: 'AI' })}><Sparkles size={16}/>AI에게 질문</button>
      </div>
      <form className="tg-search-form" onSubmit={event => { event.preventDefault(); if (session.mode === 'AI') void ask(); }}>
        <label className="tg-search-input"><span className="ui-sr-only">{session.mode === 'AI' ? 'AI에게 질문할 내용' : '대화 검색어'}</span><Search size={17}/><input ref={input} aria-label={session.mode === 'AI' ? 'AI에게 질문할 내용' : '대화 검색어'} maxLength={500} value={session.mode === 'AI' ? session.question : session.query} placeholder={session.mode === 'AI' ? '예: 집결 시간이 몇 시로 바뀌었어?' : '내용·사람 이름으로 검색'} onChange={event => update(session.mode === 'AI' ? { question: event.target.value } : { query: event.target.value })}/>{(session.mode === 'AI' ? session.question : session.query) && <button type="button" aria-label="검색 입력 지우기" onClick={() => update(session.mode === 'AI' ? { question: '' } : { query: '' })}><X size={16}/></button>}</label>
        <details open={session.filtersOpen} onToggle={event => { const next = { ...value.current, filtersOpen: event.currentTarget.open }; value.current = next; memory.write(current.current, next); setSession(next); }}>
          <summary>검색 조건<span>{session.filters.authorId ? name(session.filters.authorId) : '모든 멤버'} · {session.filters.scope === 'all' ? '전체 기간' : session.filters.scope === 'today' ? '오늘' : session.filters.scope === 'recent7' ? '최근 7일' : '날짜 지정'}</span></summary>
          <div className="tg-search-filters"><label>발언한 사람<select aria-label="대화 검색 대상" value={session.filters.authorId || ''} onChange={event => updateFilters({ authorId: event.target.value || undefined })}><option value="">모든 멤버</option>{authorIds.map(id => <option key={id} value={id}>{name(id)}</option>)}</select></label><label>기간<select aria-label="대화 검색 기간" value={session.filters.scope} onChange={event => updateFilters({ scope: event.target.value as ChatSearchFilters['scope'] })}><option value="all">전체 기간</option><option value="today">오늘</option><option value="recent7">최근 7일</option><option value="date">날짜 지정</option></select></label>
          {session.filters.scope === 'date' && <><label>시작 날짜<input type="date" aria-label="검색 시작 날짜" value={session.filters.from || ''} onChange={event => updateFilters({ from: event.target.value })}/></label><label>종료 날짜<input type="date" aria-label="검색 종료 날짜" value={session.filters.to || ''} onChange={event => updateFilters({ to: event.target.value })}/></label></>}
          {session.mode === 'KEYWORD' && <label>내용 종류<select aria-label="검색할 내용 종류" value={session.filters.kind} onChange={event => updateFilters({ kind: event.target.value as ChatSearchFilters['kind'] })}>{kindOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>}</div>
        </details>
        {session.mode === 'AI' && <><p className="tg-search-help">선택한 사람·기간의 텍스트 대화만 확인해 답해요. 사진·투표 카드는 보내지 않아요.</p>{!endpoint && <p className="tg-search-help">{endpointError || 'AI 서버가 아직 연결되지 않았어요. 대화 검색으로 원문을 찾을 수 있어요.'}</p>}<div className="tg-search-submit"><button type="submit" disabled={!endpoint || busy || !session.question.trim() || !canReadChatDigest(context)}>{busy ? '대화에서 답을 찾는 중…' : '이 대화에서 답 찾기'}</button>{busy && <button type="button" onClick={cancel}>취소</button>}</div></>}
      </form>
      {(error || filterError) && <p className="tg-search-error" role="alert">{error || filterError}</p>}
      <div className="tg-search-results" ref={results} onScroll={rememberScroll} aria-label={session.mode === 'AI' ? 'AI 답변과 원문' : '대화 검색 결과'} aria-busy={busy}>
        {session.mode === 'KEYWORD' ? <><p className="tg-search-count" aria-live="polite">{matches.length}개 대화 · 최근 대화부터</p>{matches.map(message => <button type="button" key={message.id} className={session.selectedId === message.id ? 'is-selected' : ''} onClick={() => jump(message.id)}><small><span>{name(message.authorId)}</span><time dateTime={message.createdAt}>{timestamp(message.createdAt)}</time></small><span>{chatSearchMessageText(context, message)}</span><ChevronRight size={16}/></button>)}{!matches.length && !filterError && <p className="tg-search-help">검색 결과가 없어요. 검색어나 조건을 바꿔 보세요.</p>}</> : ai ? <article className="tg-search-answer"><h3>{ai.output.unknown ? '확인할 내용이 없어요' : '대화에서 찾은 답'}</h3><>{Boolean(ai.output.speakerIds?.length) && <p className="tg-search-answer-speakers">관련 발언자 · <strong>{ai.output.speakerIds!.map(name).join(', ')}</strong></p>}<p>{ai.output.answer}</p></><small>확인한 원문 {ai.request.payload.sources.length}개 · {timestamp(ai.request.payload.cutoff)} 기준</small>{ai.output.sourceIds.map(id => { const source = ai.request.payload.sources.find(item => item.id === id)!; return <button type="button" key={id} onClick={() => jump(id)}><span><strong>{name(source.authorId)}</strong><time dateTime={source.createdAt}>{timestamp(source.createdAt)}</time><span>{source.body}</span></span><ChevronRight size={16}/></button>; })}</article> : !busy && <p className="tg-search-help">“누가 물을 챙기기로 했어?”, “장소가 정해졌어?”처럼 물어보세요. 모르는 내용은 미정으로 안내해요.</p>}
      </div>
    </div>
  </BottomSheet>;
}
