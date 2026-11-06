import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowDown, Bell, Check, ChevronDown, MessageCircle, MoreHorizontal, Reply, Search, Send, Smile, SmilePlus, Sparkles, Users, X } from 'lucide-react';
import { BottomSheet } from '../BottomSheet';
import { memberName, type TogetherActivity, type TogetherGroup, type TogetherMessage, type TogetherNotice, type TogetherState } from './model';
import { ALLOWED_MESSAGE_REACTIONS } from './chatActions';
import ChatEmojiPicker from './ChatEmojiPicker';
import { getChatSticker } from './chatExpressions';
import { emptyChatDraft, type ChatComposerDraft, type ChatDraftMemory } from './chatDrafts';
import './chat-workspace.css';

interface Props {
  draftMemory: ChatDraftMemory;
  state: TogetherState; userId: string; group: TogetherGroup; activity?: TogetherActivity; roomId: string;
  messages: TogetherMessage[]; notices: TogetherNotice[]; highlight: string; canManage: boolean; error: string;
  onSummary: (unreadAfter?: string) => void; onSource: (id: string) => void; onClearHighlight: () => void;
  onNotice: (body?: string) => void; onReport: (id: string) => void; onNavigate: (route: string) => void;
  onRead: () => boolean; onSend: (body: string, stickerId?: string, replyToMessageId?: string) => boolean;
  onReaction: (messageId: string, emoji: string) => void;
}

/** Room-scoped interaction only. Opening/searching never advances the read cursor. */
export default function ChatWorkspace({ draftMemory, state, userId, group, activity, roomId, messages, notices, highlight, canManage, error, onSummary, onSource, onClearHighlight, onNotice, onReport, onNavigate, onRead, onSend, onReaction }: Props) {
  const draftContext = { state, userId, groupId: group.id, roomId };
  const [composer, setComposer] = useState(() => draftMemory.read(draftContext));
  const composerRef = useRef(composer);
  const { body, stickerId, replyToMessageId: replyId } = composer;
  const updateComposer = (patch: Partial<ChatComposerDraft>) => {
    const next = { ...composerRef.current, ...patch };
    if (!draftMemory.write(draftContext, next)) return;
    composerRef.current = next;
    setComposer(next);
  };
  const setBody = (value: string) => updateComposer({ body: value });
  const setStickerId = (value: string) => updateComposer({ stickerId: value });
  const setReplyId = (value: string) => updateComposer({ replyToMessageId: value });
  const [boundary, setBoundary] = useState<string | undefined>(state.readCursors[roomId]);
  const [query, setQuery] = useState('');
  const [person, setPerson] = useState('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [reactionMessage, setReactionMessage] = useState('');
  const [messageTools, setMessageTools] = useState('');
  const [selectedMessage, setSelectedMessage] = useState('');
  const input = useRef<HTMLTextAreaElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const stream = useRef<HTMLDivElement>(null);
  const anchor = useRef<{ id: string; top: number } | null>(null);
  const scrollRoot = () => {
    let element = stream.current?.parentElement;
    while (element) {
      if (['auto', 'scroll'].includes(getComputedStyle(element).overflowY)) return element;
      element = element.parentElement;
    }
    return document.scrollingElement as HTMLElement | null;
  };
  const sorted = [...messages].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const unread = sorted.filter(item => item.authorId !== userId && (!boundary || item.createdAt > boundary));
  const shown = sorted.filter(item => (person === 'all' || item.authorId === person) && (!query.trim() || `${memberName(state, item.authorId)} ${item.body} ${getChatSticker(item.stickerId)?.label || ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())));
  const reply = messages.find(item => item.id === replyId && !item.deleted);
  const sticker = getChatSticker(stickerId);
  const preserveMessagePosition = (id: string) => {
    const target = document.getElementById(`tg-message-${id}`);
    anchor.current = target ? { id: target.id, top: target.getBoundingClientRect().top } : null;
  };
  const closeMessageActions = (restoreFocus = false) => {
    if (!selectedMessage) return;
    const id = selectedMessage;
    preserveMessagePosition(id);
    setSelectedMessage(''); setReactionMessage(''); setMessageTools('');
    if (restoreFocus) requestAnimationFrame(() => document.getElementById(`tg-message-select-${id}`)?.focus({ preventScroll: true }));
  };
  const selectMessage = (id: string) => {
    preserveMessagePosition(id);
    setSelectedMessage(value => value === id ? '' : id);
    setReactionMessage(''); setMessageTools('');
  };
  const roomOptions = [{ id: `groupchat-${group.id}`, label: '모임 전체 채팅' }, ...state.activities.filter(item => item.groupId === group.id).map(item => ({ id: `activitychat-${item.id}`, label: `${(item.kind || (item.journey ? 'TRIP' : 'MEETUP')) === 'TRIP' ? '여행' : '정모'} · ${item.title}` }))];
  const roomRoute = activity ? `activitychat-${activity.id}` : `groupchat-${group.id}`;
  const insert = (text: string) => {
    const start = input.current?.selectionStart ?? body.length, end = input.current?.selectionEnd ?? start;
    const next = body.slice(0, start) + text + body.slice(end);
    if (next.length > 4000) return;
    setBody(next);
    requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(start + text.length, start + text.length); });
  };
  const latest = () => {
    setQuery(''); setPerson('all'); onClearHighlight();
    requestAnimationFrame(() => { const scroll = scrollRoot(); scroll?.scrollTo({ top: scroll.scrollHeight, behavior: 'instant' }); });
  };
  useEffect(() => { if (searchOpen) searchInput.current?.focus({ preventScroll: true }); }, [searchOpen]);
  useEffect(() => { if (highlight) { setQuery(''); setPerson('all'); } }, [highlight]);
  useEffect(() => {
    if (selectedMessage && !shown.some(item => item.id === selectedMessage && !item.deleted)) {
      setSelectedMessage(''); setReactionMessage(''); setMessageTools('');
    }
  }, [selectedMessage, shown]);
  useLayoutEffect(() => {
    if (!anchor.current) return;
    const scroll = scrollRoot();
    const target = document.getElementById(anchor.current.id);
    if (scroll && target) scroll.scrollTop += target.getBoundingClientRect().top - anchor.current.top;
    anchor.current = null;
  }, [fontSize, selectedMessage, reactionMessage, messageTools]);
  const resizeText = (size: number) => {
    const content = scrollRoot()?.getBoundingClientRect();
    const target = Array.from(stream.current?.querySelectorAll<HTMLElement>('[data-message]') ?? []).find(el => el.getBoundingClientRect().bottom > (content?.top ?? 0) + 80);
    anchor.current = target ? { id: target.id, top: target.getBoundingClientRect().top } : null;
    setFontSize(size);
  };
  return <div className="tg-chat-workspace" style={{ '--chat-text-size': `${fontSize}px` } as CSSProperties} onClick={event => {
    if (!(event.target as Element).closest('[data-message]')) closeMessageActions();
  }}>
    <div className="tg-room-tools"><button type="button" className="tg-room-summary" onClick={() => onSummary(boundary)}><Sparkles size={17}/><span>대화 요약·정리</span></button><button type="button" className="tg-icon" aria-label="대화 검색 열기" aria-expanded={searchOpen} onClick={() => setSearchOpen(value => !value)}><Search size={20}/></button><button type="button" className="tg-icon" aria-label="채팅방 도구" onClick={() => setMoreOpen(true)}><MoreHorizontal size={22}/></button></div>
    {unread.length > 0 && <button type="button" className="tg-unread-summary" onClick={() => onSummary(boundary)}><MessageCircle size={18}/><span>안 읽은 대화 <strong>{unread.length}개</strong></span><span>정리 보기 →</span></button>}
    {searchOpen && <div className="tg-room-search"><label><span className="ui-sr-only">대화 검색</span><Search size={17}/><input ref={searchInput} aria-label="대화 검색" placeholder="대화 내용·사람 검색" value={query} onChange={event => setQuery(event.target.value)}/>{query && <button type="button" className="tg-icon" aria-label="대화 검색 지우기" onClick={() => setQuery('')}><X size={16}/></button>}</label><select aria-label="대화 검색 대상" value={person} onChange={event => setPerson(event.target.value)}><option value="all">모든 멤버</option>{group.memberIds.map(id => <option key={id} value={id}>{memberName(state, id)}</option>)}</select><span aria-live="polite">{shown.length}개 대화</span></div>}
    {notices.length > 0 && <details className="tg-chat-pinned"><summary><Bell size={17}/><span>{notices[0].title}</span><small>공지 {notices.length}</small><ChevronDown size={16}/></summary><div>{notices.map(item => <article key={item.id}><strong>{item.title}</strong><p>{item.body}</p></article>)}</div></details>}
    <div className="tg-chat tg-room-stream" ref={stream} role="region" aria-label="채팅 대화">
      {!shown.length && <div className="tg-empty"><MessageCircle size={28}/><h2>{query || person !== 'all' ? '검색 결과가 없어요' : '첫 인사를 나눠보세요'}</h2><p>이 방의 모임원끼리 대화를 확인해요.</p>{(query || person !== 'all') && <button onClick={() => { setQuery(''); setPerson('all'); }}>검색 초기화</button>}</div>}
      {shown.map(message => {
        const original = message.replyToMessageId ? messages.find(item => item.id === message.replyToMessageId && !item.deleted) : null;
        const reactions = Object.entries(message.reactions ?? {}).map(([emoji, ids]) => ({ emoji, ids: ids.filter(id => group.memberIds.includes(id)) })).filter(item => item.ids.length);
        const author = memberName(state, message.authorId);
        const selected = selectedMessage === message.id;
        const messageSticker = getChatSticker(message.stickerId);
        return <div key={message.id}>
          {message.id === unread[0]?.id && <div className="tg-unread-divider">여기부터 안 읽은 대화</div>}
          <article data-message id={`tg-message-${message.id}`} className={`tg-chat-message ${message.authorId === userId ? 'mine' : ''} ${highlight === message.id ? 'tg-highlight' : ''} ${selected ? 'tg-message-selected' : ''}`} onKeyDown={event => {
            if (event.key === 'Escape' && selected) { event.preventDefault(); event.stopPropagation(); closeMessageActions(true); }
          }}>
            <span className="tg-avatar" aria-hidden="true">{author.slice(0, 1)}</span>
            <div>
              <div className="tg-message-meta"><small>{author}</small><small><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' })}</time></small></div>
              <div className="tg-message-content">
                {message.replyToMessageId && <button type="button" className="tg-quoted-message" disabled={!original} onClick={() => original && onSource(original.id)}><strong>{original ? `${memberName(state, original.authorId)}에게 답장` : '원문을 확인할 수 없는 답장'}</strong><span>{original?.body || (original ? '이모티콘' : '삭제되었거나 이 방에서 볼 수 없는 원문이에요.')}</span></button>}
                <button type="button" id={`tg-message-select-${message.id}`} className={`tg-message-select ${message.body ? '' : 'tg-message-select-sticker'}`} aria-label={`${author} 메시지 도구 ${selected ? '닫기' : '열기'}`} aria-describedby={`tg-message-body-${message.id}`} aria-expanded={selected} aria-controls={`tg-message-actions-${message.id}`} onClick={() => selectMessage(message.id)}>
                  <span id={`tg-message-body-${message.id}`} className="tg-message-body">{message.body || <span className="ui-sr-only">{messageSticker?.label || '메시지'}</span>}</span>
                  {messageSticker && <img className="tg-chat-sticker" src={messageSticker.src} alt={`이모티콘: ${messageSticker.label}`}/>}
                </button>
              </div>
              {reactions.length > 0 && <div className="tg-message-reactions" role="group" aria-label="메시지 반응">{reactions.map(item => <button type="button" key={item.emoji} aria-pressed={item.ids.includes(userId)} aria-label={`${item.emoji} 반응 ${item.ids.length}명`} disabled={group.archived} onClick={() => onReaction(message.id, item.emoji)}>{item.emoji} {item.ids.length}</button>)}</div>}
              {selected && <div id={`tg-message-actions-${message.id}`} className="tg-message-actions">
                <div className="tg-message-tools" role="group" aria-label={`${author} 메시지 도구`}>
                  <button type="button" aria-label={`${author} 메시지에 답장`} title="답장" disabled={group.archived} onClick={() => { setReplyId(message.id); closeMessageActions(); requestAnimationFrame(() => input.current?.focus()); }}><Reply size={18}/></button>
                  <button type="button" title="반응" aria-label={`${author} 메시지에 반응`} aria-expanded={reactionMessage === message.id} aria-controls={`tg-message-reactions-${message.id}`} disabled={group.archived} onClick={() => { preserveMessagePosition(message.id); setMessageTools(''); setReactionMessage(value => value === message.id ? '' : message.id); }}><SmilePlus size={18}/></button>
                  {(message.authorId !== userId || message.body.trim() && canManage) && <button type="button" title="더보기" aria-label={`${author} 메시지 더보기`} aria-expanded={messageTools === message.id} aria-controls={`tg-message-menu-${message.id}`} onClick={() => { preserveMessagePosition(message.id); setReactionMessage(''); setMessageTools(value => value === message.id ? '' : message.id); }}><MoreHorizontal size={18}/></button>}
                </div>
                {messageTools === message.id && <div id={`tg-message-menu-${message.id}`} className="tg-message-menu">{message.authorId !== userId && <button type="button" onClick={() => { setMessageTools(''); onReport(message.id); }}>메시지 신고</button>}{message.body.trim() && canManage && <button type="button" onClick={() => { setMessageTools(''); onNotice(message.body); }}>공지로 편집</button>}</div>}
                {reactionMessage === message.id && <div id={`tg-message-reactions-${message.id}`} className="tg-reaction-picker" role="group" aria-label="반응 고르기">{ALLOWED_MESSAGE_REACTIONS.map(emoji => <button type="button" key={emoji} aria-label={`${emoji} 반응 추가`} disabled={group.archived} onClick={() => { preserveMessagePosition(message.id); onReaction(message.id, emoji); setReactionMessage(''); }}>{emoji}</button>)}</div>}
              </div>}
            </div>
          </article>
        </div>;
      })}
    </div>
    {(highlight || sorted.length > 4) && <button type="button" className="tg-chat-latest" aria-label="최신 대화로 이동" title="최신 대화로 이동" onClick={latest}><ArrowDown size={20}/></button>}
    <div className="tg-composer-dock">{error && <div className="tg-composer-error tg-error" role="alert">{error}</div>}
      {replyId && <div className="tg-reply-preview"><div><strong>{reply ? `${memberName(state, reply.authorId)}에게 답장` : '원문을 다시 확인해 주세요'}</strong><p>{reply?.body || (reply ? '이모티콘' : '원문을 볼 수 없어요. 답장을 취소한 뒤 보낼 수 있어요.')}</p></div><button type="button" className="tg-icon" aria-label="답장 취소" onClick={() => setReplyId('')}><X size={18}/></button></div>}
      {emojiOpen && !group.archived && <ChatEmojiPicker onInsertEmoji={insert} onSelectSticker={id => { setStickerId(id); setEmojiOpen(false); input.current?.focus(); }} onClose={() => setEmojiOpen(false)}/>}
      {sticker && <div className="tg-sticker-preview"><img src={sticker.src} alt={`선택한 이모티콘: ${sticker.label}`}/><strong>{sticker.label}</strong><button type="button" className="tg-icon" aria-label="선택한 이모티콘 빼기" onClick={() => setStickerId('')}><X size={18}/></button></div>}
      <form className="tg-composer" onSubmit={event => { event.preventDefault(); if ((!body.trim() && !sticker) || group.archived || (replyId && !reply)) return; if (onSend(body, sticker?.id, replyId || undefined)) { draftMemory.clear(draftContext); const empty = emptyChatDraft(); composerRef.current = empty; setComposer(empty); setEmojiOpen(false); } }}>
        <button className="tg-icon" type="button" aria-label="이모티콘 선택" aria-expanded={emojiOpen} disabled={group.archived} onClick={() => setEmojiOpen(value => !value)}><Smile size={21}/></button><button className="tg-icon" type="button" aria-label="멤버 태그" disabled={group.archived} onClick={() => setMentionOpen(true)}>@</button><textarea ref={input} id="tg-chat-input" aria-label="메시지" placeholder={group.archived ? '보관된 모임이에요' : '함께 나눌 이야기를 적어주세요'} value={body} onChange={event => setBody(event.target.value)} maxLength={4000} disabled={group.archived} rows={1}/><button className="tg-primary tg-icon" type="submit" aria-label="메시지 보내기" disabled={(!body.trim() && !sticker) || group.archived || Boolean(replyId && !reply)}><Send size={18}/></button>
      </form>
    </div>
    {moreOpen && <BottomSheet title="채팅방 도구" onClose={() => setMoreOpen(false)}><div className="tg tg-room-options"><label>이 모임 안에서 대화방 이동<select value={roomRoute} onChange={event => { setMoreOpen(false); onNavigate(event.target.value); }}>{roomOptions.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><div><strong>채팅 글자 크기</strong><div className="tg-font-options" role="group" aria-label="채팅 글자 크기">{[14, 16, 18, 20].map(size => <button key={size} type="button" aria-pressed={fontSize === size} onClick={() => resizeText(size)}>{size}px</button>)}</div></div><button type="button" onClick={() => { if (onRead()) { setBoundary(sorted.at(-1)?.createdAt); setMoreOpen(false); } }}><Check size={17}/>여기까지 읽음으로 표시</button>{canManage && <button type="button" onClick={() => { setMoreOpen(false); onNotice(); }}><Bell size={17}/>공지 작성</button>}<button type="button" onClick={() => { setMoreOpen(false); onNavigate(`group-${group.id}`); }}><Users size={17}/>모임 홈으로</button>{activity && <button type="button" onClick={() => { setMoreOpen(false); onNavigate(`activity-${activity.id}`); }}><MessageCircle size={17}/>이 일정 상세 보기</button>}</div></BottomSheet>}
    {mentionOpen && <BottomSheet title="누구를 부를까요?" description="이 방의 모임원 이름을 메시지에 넣어요." onClose={() => setMentionOpen(false)}><div className="tg tg-mention-picker">{group.memberIds.filter(id => id !== userId).map(id => <button type="button" key={id} onClick={() => { setMentionOpen(false); insert(`@${memberName(state, id)} `); }}><span className="tg-avatar">{memberName(state, id).slice(0, 1)}</span>{memberName(state, id)}</button>)}</div></BottomSheet>}
  </div>;
}
