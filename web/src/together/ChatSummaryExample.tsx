import { useId, useState } from 'react';
import { memberName, type TogetherState } from './model';
import { canReadChatDigest, type ChatDigestContext } from './chatDigest';
import { chatSummaryExampleCategories, getChatSummaryExample, validateChatSummaryExampleSelection,
  type ChatSummaryExampleApplyRequest, type ChatSummaryExampleFilters } from './chatSummaryExample';
import './chat-summary-example.css';

export interface ChatSummaryExampleViewState {
  key: string; mode: 'unread' | 'all' | 'person'; personId: string; selectedIds: string[];
}
export const chatSummaryExampleViewKey = ({ userId, groupId, roomId }: Pick<ChatDigestContext, 'userId' | 'groupId' | 'roomId'>) => JSON.stringify([userId, groupId, roomId]);
export function createChatSummaryExampleViewState(context: Pick<ChatDigestContext, 'userId' | 'groupId' | 'roomId'>): ChatSummaryExampleViewState {
  return { key: chatSummaryExampleViewKey(context), mode: 'unread', personId: '', selectedIds: [] };
}
export interface ChatSummaryExampleProps {
  state: TogetherState; userId: string; groupId: string; roomId: string; unreadAfter?: string;
  onSource: (messageId: string) => void;
  onApply?: (request: ChatSummaryExampleApplyRequest) => void;
  /** Optional page-memory state lets an isolated review panel return from an original without losing its selection. */
  viewState?: ChatSummaryExampleViewState;
  onViewStateChange?: (value: ChatSummaryExampleViewState) => void;
}

/** Mount only inside an explicitly enabled review surface. Nothing is inferred from arbitrary customer messages. */
export default function ChatSummaryExample(props: ChatSummaryExampleProps) {
  if (!canReadChatDigest(props) || !getChatSummaryExample(props)) return null;
  return <ChatSummaryExamplePanel key={chatSummaryExampleViewKey(props)} {...props}/>;
}
function ChatSummaryExamplePanel(props: ChatSummaryExampleProps) {
  const { state, userId, groupId, roomId, unreadAfter, onSource, onApply, viewState, onViewStateChange } = props;
  const context = { state, userId, groupId, roomId, unreadAfter };
  const headingId = useId();
  const [local, setLocal] = useState(() => createChatSummaryExampleViewState(context));
  const [error, setError] = useState('');
  const key = chatSummaryExampleViewKey(context);
  const supplied = viewState ?? local;
  const view = supplied.key === key ? supplied : createChatSummaryExampleViewState(context);
  const update = (next: ChatSummaryExampleViewState) => { setLocal(next); onViewStateChange?.(next); setError(''); };
  const all = getChatSummaryExample(context)!;
  const speakers = [...new Set(all.sources.map(source => source.authorId))];
  const filters: ChatSummaryExampleFilters = { scope: view.mode === 'unread' ? 'unread' : 'all', ...(view.mode === 'person' ? { authorId: view.personId } : {}) };
  let result = null as ReturnType<typeof getChatSummaryExample>, selectionError = '';
  try { result = getChatSummaryExample(context, filters); }
  catch (cause) { selectionError = cause instanceof Error ? cause.message : '대화 범위를 다시 선택해 주세요.'; }
  const items = result?.items ?? [];
  // Current originals are authoritative even when a parent restores an older panel selection.
  const selectedIds = view.selectedIds.filter(id => items.some(item => item.id === id && item.category !== 'CHANGED'));
  const selected = items.filter(item => selectedIds.includes(item.id));
  const tasks = selected.filter(item => Boolean(item.taskTitle));
  const changeMode = (mode: ChatSummaryExampleViewState['mode']) => update({ ...view, mode, personId: mode === 'person' ? view.personId || speakers[0] || '' : view.personId, selectedIds: [] });
  const source = (messageId: string) => {
    const latest = getChatSummaryExample(context, filters);
    if (!latest?.sources.some(item => item.id === messageId)) { setError('원문이 바뀌었거나 현재 범위에서 볼 수 없어요.'); return; }
    onViewStateChange?.({ ...view, selectedIds });
    onSource(messageId);
  };
  const apply = (kind: ChatSummaryExampleApplyRequest['kind']) => {
    const request: ChatSummaryExampleApplyRequest = { kind, roomId, filters: { ...filters }, itemIds: (kind === 'TASK' ? tasks : selected).map(item => item.id) };
    const checked = validateChatSummaryExampleSelection(context, request);
    if (!checked.ok) { setError(checked.reason); return; }
    try { onApply?.(request); }
    catch { setError('항목을 전달하지 못했어요. 선택은 유지했으니 다시 확인해 주세요.'); }
  };

  return <section className="chat-summary-example" aria-labelledby={headingId}>
    <header className="chat-summary-example-heading"><h3 id={headingId}>AI 정리 예시</h3><p>AI 모델 미연결 · 지정된 예시 원문만 정리한 결과예요. 새로 쓴 자유 대화는 분석하지 않아요.</p></header>
    <div className="chat-summary-example-scopes" role="group" aria-label="AI 정리 예시 범위">
      <button type="button" aria-pressed={view.mode === 'unread'} onClick={() => changeMode('unread')}>안 읽은 대화</button>
      <button type="button" aria-pressed={view.mode === 'all'} onClick={() => changeMode('all')}>전체</button>
      <button type="button" aria-pressed={view.mode === 'person'} onClick={() => changeMode('person')}>특정인</button>
    </div>
    {view.mode === 'person' && <label className="chat-summary-example-person"><span>예시 원문을 쓴 사람</span><select value={view.personId} onChange={event => update({ ...view, personId: event.target.value, selectedIds: [] })}><option value="">참여자 선택</option>{view.personId && !speakers.includes(view.personId) && <option value={view.personId}>선택한 참여자 · 현재 예시 없음</option>}{speakers.map(id => <option key={id} value={id}>{memberName(state, id)}</option>)}</select></label>}
    <p className="chat-summary-example-meta" role="status">{selectionError || `선택 범위 발언 ${result?.sourceCount ?? 0}개 · 정리에 연결된 예시 원문 ${result?.sources.length ?? 0}개`}</p>
    {view.mode === 'unread' && <p className="chat-summary-example-meta">마지막 읽음 이후 내 발언도 포함해요. 이전 근거가 범위 밖이면 해당 정리 항목은 제외해요.</p>}
    {view.mode === 'person' && <p className="chat-summary-example-meta">선택한 사람의 원문만 근거로 삼아요. 여러 사람의 근거가 필요한 변경 내용은 모두 포함될 때만 보여요.</p>}
    {(selectionError || !items.length) && <div className="chat-summary-example-empty"><p>이 범위에는 연결된 예시 정리가 없어요.</p><button type="button" onClick={() => changeMode('all')}>전체 예시 보기</button></div>}
    {chatSummaryExampleCategories.map(category => {
      const rows = items.filter(item => item.category === category.id);
      if (!rows.length) return null;
      return <section className="chat-summary-example-category" key={category.id}><h4>{category.label}<span>{rows.length}</span></h4>{rows.map(item => <article className="chat-summary-example-item" key={item.id}>
        <label className={`chat-summary-example-choice${item.category === 'CHANGED' || !onApply ? ' is-readonly' : ''}`}>
          {onApply && item.category !== 'CHANGED' && <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => update({ ...view, selectedIds: selectedIds.includes(item.id) ? selectedIds.filter(id => id !== item.id) : [...selectedIds, item.id] })}/>}
          <span><strong>{item.title}</strong><span>{item.text}</span></span>
        </label>
        {item.ownerId && <p className="chat-summary-example-meta">원문에서 맡겠다고 한 사람 · {memberName(state, item.ownerId)}</p>}
        {item.category === 'CHANGED' && <p className="chat-summary-example-meta">이전 제안 · 준비나 공지로 반영하지 않아요.</p>}
        <details className="chat-summary-example-sources"><summary>근거 원문 {item.sourceIds.length}개</summary><div>{item.sourceIds.map(id => {
          const original = result!.sources.find(message => message.id === id)!;
          return <div className="chat-summary-example-original" key={id}><small>{memberName(state, original.authorId)}</small><blockquote>{original.body}</blockquote><button type="button" onClick={() => source(id)}>이 원문으로 이동</button></div>;
        })}</div></details>
      </article>)}</section>;
    })}
    {error && <p className="chat-summary-example-error" role="alert">{error}</p>}
    {onApply && items.length > 0 && <div className="chat-summary-example-actions"><span className="chat-summary-example-meta">{selected.length}개 선택 · 확인할 일 {tasks.length}개</span><div><button type="button" disabled={!tasks.length || Boolean(state.groups.find(group => group.id === groupId)?.archived)} onClick={() => apply('TASK')}>준비 목록에 담기 {tasks.length || ''}</button><button type="button" disabled={!selected.length || Boolean(state.groups.find(group => group.id === groupId)?.archived)} onClick={() => apply('NOTICE_DRAFT')}>공지 초안 만들기</button></div></div>}
  </section>;
}
