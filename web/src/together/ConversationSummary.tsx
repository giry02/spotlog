import { useId, useState } from 'react';
import { memberName, type TogetherState } from './model';
import { canReadChatDigest, chatDigestSelectionKey, createChatDigest, groupChatDigestSources, projectChatDigest, selectChatDigestMessages,
  type ChatDigestContext, type ChatDigestFilters, type ChatDigestScope, type ChatDigestSnapshot } from './chatDigest';
import './conversation-summary.css';

export interface ConversationSummaryProps {
  state: TogetherState;
  userId: string;
  groupId: string;
  roomId: string;
  unreadAfter: string | undefined;
  onSource: (messageId: string) => void;
}
const scopeLabels: Record<ChatDigestScope, string> = { unread: '안 읽은 대화', today: '오늘', recent7: '최근 7일', date: '기간 선택', all: '이 채팅 전체' };
const timeLabel = (value: string) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(value));

/** Revoking access unmounts all private snapshots; a new account/room never reuses their state. */
export default function ConversationSummary(props: ConversationSummaryProps) {
  if (!canReadChatDigest(props)) return <section className="conversation-digest"><p role="status">이 대화를 볼 권한이 없어요.</p></section>;
  return <ConversationSummaryPanel key={JSON.stringify([props.userId, props.groupId, props.roomId])} {...props} />;
}
function ConversationSummaryPanel({ state, userId, groupId, roomId, unreadAfter, onSource }: ConversationSummaryProps) {
  const labelId = useId();
  const [scope, setScope] = useState<ChatDigestScope>('unread');
  const [target, setTarget] = useState<'all' | 'person'>('all');
  const [personId, setPersonId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [snapshot, setSnapshot] = useState<ChatDigestSnapshot | null>(null);
  const [limit, setLimit] = useState(12);
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
    try { setSnapshot(createChatDigest(context, filters)); setLimit(12); setError(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '대화를 모아보지 못했어요. 다시 확인해 주세요.'); }
  };
  const source = (messageId: string) => {
    if (!snapshot || !projectChatDigest(context, snapshot).sources.some(message => message.id === messageId)) { setError('원문이 바뀌었거나 접근할 수 없어요. 다시 모아보세요.'); return; }
    onSource(messageId);
  };
  const snapshotScope = snapshot ? `${scopeLabels[snapshot.filters.scope]}${snapshot.filters.scope === 'date' ? ` · ${snapshot.filters.from}~${snapshot.filters.to}` : ''} · ${snapshot.filters.authorId ? memberName(state, snapshot.filters.authorId) : '전체 참여자'}` : '';

  return <section className="conversation-digest" aria-labelledby={labelId}>
    <header className="conversation-digest-heading"><h3 id={labelId}>발언 모아보기</h3><p>AI 호출 없이, 선택한 대화의 원문을 단어 기준으로 모아요.</p></header>
    <div className="conversation-digest-filters">
      <div className="conversation-digest-target" role="group" aria-label="모아볼 발언자">
        <button type="button" aria-pressed={target === 'all'} onClick={() => { setTarget('all'); setError(''); }}>전체 참여자</button>
        <button type="button" aria-pressed={target === 'person'} onClick={() => { setTarget('person'); if (!personId) setPersonId(speakers[0] ?? ''); setError(''); }}>특정인</button>
      </div>
      {target === 'person' && <label><span>발언한 참여자</span><select value={personId} onChange={event => { setPersonId(event.target.value); setError(''); }}><option value="">참여자 선택</option>{personId && !speakers.includes(personId) && <option value={personId}>선택한 참여자 · 발언 없음</option>}{speakers.map(id => <option value={id} key={id}>{memberName(state, id)}</option>)}</select></label>}
      <label><span>대화 기간 · 한국 시각</span><select value={scope} onChange={event => { setScope(event.target.value as ChatDigestScope); setError(''); }}>{Object.entries(scopeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {scope === 'date' && <div className="conversation-digest-dates"><label><span>시작 날짜</span><input type="date" value={from} onChange={event => { setFrom(event.target.value); setError(''); }} /></label><label><span>종료 날짜</span><input type="date" value={to} onChange={event => { setTo(event.target.value); setError(''); }} /></label></div>}
      <p className="conversation-digest-meta" role="status">{selectionError || `선택한 조건의 발언 ${selectedCount}개`}</p>
      {scope === 'unread' && <p className="conversation-digest-meta">마지막 읽음 이후 내 발언도 함께 포함해요.</p>}
      <button type="button" className="conversation-digest-collect" disabled={Boolean(selectionError)} onClick={collect}>선택한 대화 모아보기</button>
    </div>
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
  </section>;
}
