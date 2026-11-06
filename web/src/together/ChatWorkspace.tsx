import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowDown, ArrowLeft, Bell, BellOff, CalendarDays, Check, ChevronDown, ChevronRight, ListChecks, MapPin, MessageCircle, MoreHorizontal, Plus, Reply, Search, Send, Smile, SmilePlus, Users, X } from 'lucide-react';
import { BottomSheet } from '../BottomSheet';
import { memberName, type TogetherActivity, type TogetherGroup, type TogetherMessage, type TogetherNotice, type TogetherState } from './model';
import { ALLOWED_MESSAGE_REACTIONS } from './chatActions';
import ChatEmojiPicker from './ChatEmojiPicker';
import { getChatSticker } from './chatExpressions';
import { emptyChatDraft, type ChatComposerDraft, type ChatDraftMemory } from './chatDrafts';
import { readChatEntity } from './chatEntities';
import ChatEntityCard from './ChatEntityCard';
import { chatViewOptions, selectChatChromeContext } from './chatChrome';
import './chat-workspace.css';
import './chat-entity-card.css';

interface Props {
  draftMemory: ChatDraftMemory;
  state: TogetherState; userId: string; group: TogetherGroup; activity?: TogetherActivity; roomId: string;
  messages: TogetherMessage[]; notices: TogetherNotice[]; highlight: string; canManage: boolean; error: string;
  onSummary: (unreadAfter?: string) => void; onSource: (id: string) => void; onClearHighlight: () => void;
  onNotice: (body?: string) => void; onReport: (id: string) => void; onNavigate: (route: string) => void;
  onRead: () => boolean; onSend: (body: string, stickerId?: string, replyToMessageId?: string) => boolean;
  onReaction: (messageId: string, emoji: string) => void;
  onAssistant?: () => void;
  onTool?: (tool: 'places' | 'dates' | 'departure' | 'plan') => void;
  onVotePoll?: (pollId: string, optionId: string) => boolean;
  onToggleTask?: (taskId: string) => boolean;
  onToggleMute?: () => void;
  onBack?: () => void;
  onOpenView?: (view: string) => void;
  onManage?: () => void;
}

/** Room-scoped interaction only. Opening/searching never advances the read cursor. */
export default function ChatWorkspace({ draftMemory, state, userId, group, activity, roomId, messages, highlight, canManage, error, onSummary, onSource, onClearHighlight, onNotice, onReport, onNavigate, onRead, onSend, onReaction, onAssistant, onTool, onVotePoll, onToggleTask, onToggleMute, onBack, onOpenView, onManage }: Props) {
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
  const [viewOpen, setViewOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [reactionMessage, setReactionMessage] = useState('');
  const [messageTools, setMessageTools] = useState('');
  const [selectedMessage, setSelectedMessage] = useState('');
  const [latestAvailable, setLatestAvailable] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const stream = useRef<HTMLDivElement>(null);
  const workspace = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLElement>(null);
  const dock = useRef<HTMLDivElement>(null);
  const anchor = useRef<{ id: string; top: number } | null>(null);
  const scrollRoot = () => {
    let element = stream.current?.parentElement;
    while (element) {
      if (['auto', 'scroll'].includes(getComputedStyle(element).overflowY)) return element;
      element = element.parentElement;
    }
    return document.scrollingElement as HTMLElement | null;
  };
  const resizeComposer = () => {
    const element = input.current;
    if (!element) return;
    const style = getComputedStyle(element);
    const border = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const minimum = parseFloat(style.minHeight) || 46;
    let maximum = (parseFloat(style.lineHeight) || 24) * 4 + padding + border;
    const form = element.closest('form');
    if (dock.current?.querySelector('.tg-composer-extras') && form) {
      const viewport = window.visualViewport;
      const viewportHeight = viewport?.scale === 1 ? Math.min(window.innerHeight, viewport.height) : window.innerHeight;
      const available = Math.min(viewportHeight, scrollRoot()?.clientHeight || viewportHeight);
      const headerHeight = header.current?.getBoundingClientRect().height || 56;
      const formStyle = getComputedStyle(form);
      const formInset = parseFloat(formStyle.paddingTop) + parseFloat(formStyle.paddingBottom) + parseFloat(formStyle.borderTopWidth) + parseFloat(formStyle.borderBottomWidth);
      // Keep the current text, but make room for selectable preview controls.
      const previewMinimum = 96;
      const reservedContext = available < 500 ? 92 : 120;
      const dockBudget = Math.max(minimum + formInset + 1, available - headerHeight - reservedContext);
      maximum = Math.max(minimum, Math.min(maximum, dockBudget - formInset - previewMinimum - 1));
    }
    element.style.overflowY = 'hidden';
    element.style.height = 'auto';
    const needed = element.scrollHeight + border;
    element.style.height = `${Math.max(minimum, Math.min(needed, maximum))}px`;
    element.style.overflowY = element.scrollHeight > element.clientHeight ? 'auto' : 'hidden';
  };
  const sorted = messages.filter(item => item.roomId === roomId && !item.deleted).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const hasEntity = (message: TogetherMessage) => message.entity !== undefined;
  const messageText = (message: TogetherMessage) => {
    if (!hasEntity(message)) return message.body || getChatSticker(message.stickerId)?.label || '메시지';
    const entity = readChatEntity(state, userId, roomId, message);
    if (!entity) return '이 항목을 확인할 수 없어요';
    return entity.type === 'POLL' ? entity.value.question : entity.value.title;
  };
  const unread = sorted.filter(item => item.authorId !== userId && (!boundary || item.createdAt > boundary));
  const shown = sorted.filter(item => (person === 'all' || item.authorId === person) && (!query.trim() || `${memberName(state, item.authorId)} ${messageText(item)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())));
  const reply = sorted.find(item => item.id === replyId);
  const context = selectChatChromeContext(state, userId, group.id, activity?.id);
  const { notices, messages: activeCards, pollCount, taskCount } = context;
  const contextLabels = [notices.length ? `공지 ${notices.length}` : '', pollCount ? `투표 ${pollCount}` : '', taskCount ? `준비 ${taskCount}` : ''].filter(Boolean);
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
  const roomOptions = [...(group.spaceType === 'ACTIVITY' ? [] : [{ id: `groupchat-${group.id}`, label: '모임 전체 대화' }]), ...state.activities.filter(item => item.groupId === group.id).map(item => ({ id: `activitychat-${item.id}`, label: `${(item.kind || (item.journey ? 'TRIP' : 'MEETUP')) === 'TRIP' ? '여행' : '약속'} · ${item.title}` }))];
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
  useLayoutEffect(() => {
    const container = scrollRoot();
    const update = () => {
      if (!container || !stream.current) return;
      const visibleBottom = container.getBoundingClientRect().bottom - (dock.current?.getBoundingClientRect().height || 76);
      setLatestAvailable(stream.current.getBoundingClientRect().bottom > visibleBottom + 40);
    };
    container?.addEventListener('scroll', update, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    if (container) observer?.observe(container);
    if (stream.current) observer?.observe(stream.current);
    if (dock.current) observer?.observe(dock.current);
    update();
    return () => { container?.removeEventListener('scroll', update); observer?.disconnect(); };
  }, [messages.length, query, person]);
  useEffect(() => { if (searchOpen) searchInput.current?.focus({ preventScroll: true }); }, [searchOpen]);
  useEffect(() => { if (highlight) { setQuery(''); setPerson('all'); } }, [highlight]);
  useLayoutEffect(resizeComposer, [body, replyId, emojiOpen, stickerId, error, group.archived]);
  useLayoutEffect(() => {
    const headerElement = header.current;
    const container = scrollRoot();
    const updateMetrics = () => {
      if (!workspace.current) return;
      const viewport = window.visualViewport;
      const viewportHeight = viewport?.scale === 1 ? Math.min(window.innerHeight, viewport.height) : window.innerHeight;
      const height = Math.min(viewportHeight, container?.clientHeight || viewportHeight);
      workspace.current.style.setProperty('--chat-viewport-height', `${height}px`);
      const compactExtras = height < 500 && Boolean(dock.current?.querySelector('.tg-composer-extras'));
      workspace.current.style.setProperty('--chat-dock-reserve', compactExtras ? '92px' : '120px');
      workspace.current.style.setProperty('--chat-context-min', compactExtras ? '48px' : '56px');
      workspace.current.style.setProperty('--chat-context-message-min', compactExtras ? '44px' : '64px');
      workspace.current.style.setProperty('--chat-tools-padding', compactExtras ? '0px' : '8px');
      if (headerElement) workspace.current.style.setProperty('--chat-header-height', `${headerElement.getBoundingClientRect().height}px`);
      const composerHeight = dock.current?.querySelector<HTMLElement>('.tg-composer')?.getBoundingClientRect().height;
      workspace.current.style.setProperty('--chat-composer-height', `${composerHeight ? Math.ceil(composerHeight) + 1 : 76}px`);
      workspace.current.style.setProperty('--chat-dock-height', `${dock.current?.getBoundingClientRect().height || 76}px`);
    };
    const resized = () => { resizeComposer(); updateMetrics(); };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resized);
    if (headerElement) observer?.observe(headerElement);
    if (dock.current) observer?.observe(dock.current);
    if (input.current) observer?.observe(input.current);
    if (container) observer?.observe(container);
    window.addEventListener('resize', resized);
    window.visualViewport?.addEventListener('resize', resized);
    resized();
    return () => { observer?.disconnect(); window.removeEventListener('resize', resized); window.visualViewport?.removeEventListener('resize', resized); };
  }, []);
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
  return <div ref={workspace} className="tg-chat-workspace" style={{ '--chat-text-size': `${fontSize}px` } as CSSProperties} onClick={event => {
    if (!(event.target as Element).closest('[data-message]')) closeMessageActions();
  }}>
    <header ref={header} className="tg-chat-header">
      <button type="button" className="tg-icon" aria-label="이전 화면으로 돌아가기" onClick={() => onBack ? onBack() : onNavigate(activity ? `activity-${activity.id}` : `group-${group.id}`)}><ArrowLeft size={20}/></button>
      <h1><button type="button" className="tg-chat-room-title" aria-label={`${activity?.title || group.name} · 화면과 대화방 이동`} aria-haspopup="dialog" onClick={() => setViewOpen(true)}><span><strong>{activity?.title || group.name}</strong><small>{activity ? group.spaceType === 'ACTIVITY' ? '약속 대화' : `${group.name} · 약속 대화` : '모임 전체 대화'}</small></span><ChevronDown size={15}/></button></h1>
      <button type="button" className="tg-chat-summary-action" onClick={() => onSummary(boundary)} aria-label={unread.length ? `대화 요약 · 안 읽은 대화 ${unread.length}개` : '대화 요약'} title="대화 요약">대화 요약{unread.length > 0 && <span className="tg-chat-summary-dot" aria-hidden="true"/>}</button>
      <button type="button" className="tg-icon" aria-label="대화 검색 열기" aria-haspopup="dialog" onClick={() => setSearchOpen(true)}><Search size={20}/></button>
      <button type="button" className="tg-icon" aria-label="대화 설정" aria-haspopup="dialog" onClick={() => setMoreOpen(true)}><MoreHorizontal size={22}/></button>
    </header>
    {contextLabels.length > 0 && <div className="tg-chat-context" role="region" aria-label="이 대화방의 공지와 진행 항목"><button type="button" className="tg-chat-context-entry" aria-label={`${contextLabels.join(' · ')} 확인`} aria-haspopup="dialog" onClick={() => setContextOpen(true)}>{notices.length ? <Bell size={16}/> : <ListChecks size={16}/>}<span>{contextLabels.join(' · ')}</span><ChevronRight size={16}/></button></div>}
    <div className="tg-chat tg-room-stream" ref={stream} role="region" aria-label="채팅 대화">
      {!shown.length && <div className="tg-empty"><MessageCircle size={28}/><h2>{query || person !== 'all' ? '검색 결과가 없어요' : '첫 인사를 나눠보세요'}</h2><p>이 방의 모임원끼리 대화를 확인해요.</p>{(query || person !== 'all') && <button onClick={() => { setQuery(''); setPerson('all'); }}>검색 초기화</button>}</div>}
      {shown.map(message => {
        const original = message.replyToMessageId ? sorted.find(item => item.id === message.replyToMessageId) : null;
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
                {message.replyToMessageId && <button type="button" className="tg-quoted-message" disabled={!original} onClick={() => original && onSource(original.id)}><strong>{original ? `${memberName(state, original.authorId)}에게 답장` : '원문을 확인할 수 없는 답장'}</strong><span>{original ? messageText(original) : '삭제되었거나 이 방에서 볼 수 없는 원문이에요.'}</span></button>}
                {hasEntity(message) ? <><ChatEntityCard entity={readChatEntity(state, userId, roomId, message)} state={state} userId={userId} onVotePoll={onVotePoll} onToggleTask={onToggleTask} onNavigate={onNavigate}/><button type="button" id={`tg-message-select-${message.id}`} className="tg-entity-message-tools" aria-label={`${author} 공유 항목 도구 ${selected ? '닫기' : '열기'}`} aria-expanded={selected} aria-controls={`tg-message-actions-${message.id}`} onClick={() => selectMessage(message.id)}><MoreHorizontal size={17}/><span className="ui-sr-only">공유 항목 도구</span></button></> : <button type="button" id={`tg-message-select-${message.id}`} className={`tg-message-select ${message.body ? '' : 'tg-message-select-sticker'}`} aria-label={`${author} 메시지 도구 ${selected ? '닫기' : '열기'}`} aria-describedby={`tg-message-body-${message.id}`} aria-expanded={selected} aria-controls={`tg-message-actions-${message.id}`} onClick={() => selectMessage(message.id)}>
                  <span id={`tg-message-body-${message.id}`} className="tg-message-body">{message.body || <span className="ui-sr-only">{messageSticker?.label || '메시지'}</span>}</span>
                  {messageSticker && <img className="tg-chat-sticker" src={messageSticker.src} alt={`이모티콘: ${messageSticker.label}`}/>}
                </button>}
              </div>
              {reactions.length > 0 && <div className="tg-message-reactions" role="group" aria-label="메시지 반응">{reactions.map(item => <button type="button" key={item.emoji} aria-pressed={item.ids.includes(userId)} aria-label={`${item.emoji} 반응 ${item.ids.length}명`} disabled={group.archived} onClick={() => onReaction(message.id, item.emoji)}>{item.emoji} {item.ids.length}</button>)}</div>}
              {selected && <div id={`tg-message-actions-${message.id}`} className="tg-message-actions">
                <div className="tg-message-tools" role="group" aria-label={`${author} 메시지 도구`}>
                  <button type="button" aria-label={`${author} 메시지에 답장`} title="답장" disabled={group.archived} onClick={() => { setReplyId(message.id); closeMessageActions(); requestAnimationFrame(() => input.current?.focus()); }}><Reply size={18}/></button>
                  <button type="button" title="반응" aria-label={`${author} 메시지에 반응`} aria-expanded={reactionMessage === message.id} aria-controls={`tg-message-reactions-${message.id}`} disabled={group.archived} onClick={() => { preserveMessagePosition(message.id); setMessageTools(''); setReactionMessage(value => value === message.id ? '' : message.id); }}><SmilePlus size={18}/></button>
                  {(message.authorId !== userId || !hasEntity(message) && message.body.trim() && canManage) && <button type="button" title="더보기" aria-label={`${author} 메시지 더보기`} aria-expanded={messageTools === message.id} aria-controls={`tg-message-menu-${message.id}`} onClick={() => { preserveMessagePosition(message.id); setReactionMessage(''); setMessageTools(value => value === message.id ? '' : message.id); }}><MoreHorizontal size={18}/></button>}
                </div>
                {messageTools === message.id && <div id={`tg-message-menu-${message.id}`} className="tg-message-menu">{message.authorId !== userId && <button type="button" onClick={() => { setMessageTools(''); onReport(message.id); }}>메시지 신고</button>}{!hasEntity(message) && message.body.trim() && canManage && <button type="button" onClick={() => { setMessageTools(''); onNotice(message.body); }}>공지로 편집</button>}</div>}
                {reactionMessage === message.id && <div id={`tg-message-reactions-${message.id}`} className="tg-reaction-picker" role="group" aria-label="반응 고르기">{ALLOWED_MESSAGE_REACTIONS.map(emoji => <button type="button" key={emoji} aria-label={`${emoji} 반응 추가`} disabled={group.archived} onClick={() => { preserveMessagePosition(message.id); onReaction(message.id, emoji); setReactionMessage(''); }}>{emoji}</button>)}</div>}
              </div>}
            </div>
          </article>
        </div>;
      })}
    </div>
    {latestAvailable && !emojiOpen && <button type="button" className="tg-chat-latest" aria-label="최신 대화로 이동" title="최신 대화로 이동" onClick={latest}><ArrowDown size={20}/></button>}
    <div ref={dock} className="tg-composer-dock">
      {(error || replyId || emojiOpen && !group.archived || sticker) && <div className="tg-composer-extras" role="region" aria-label="답장·이모티콘 미리보기" tabIndex={0}>
      {error && <div className="tg-composer-error tg-error" role="alert">{error}</div>}
      {replyId && <div className="tg-reply-preview"><div><strong>{reply ? `${memberName(state, reply.authorId)}에게 답장` : '원문을 다시 확인해 주세요'}</strong><p>{reply ? messageText(reply) : '원문을 볼 수 없어요. 답장을 취소한 뒤 보낼 수 있어요.'}</p></div><button type="button" className="tg-icon" aria-label="답장 취소" onClick={() => setReplyId('')}><X size={18}/></button></div>}
      {emojiOpen && !group.archived && <ChatEmojiPicker onInsertEmoji={insert} onSelectSticker={id => { setStickerId(id); setEmojiOpen(false); input.current?.focus(); }} onClose={() => setEmojiOpen(false)}/>}
      {sticker && <div className="tg-sticker-preview"><img src={sticker.src} alt={`선택한 이모티콘: ${sticker.label}`}/><strong>{sticker.label}</strong><button type="button" className="tg-icon" aria-label="선택한 이모티콘 빼기" onClick={() => setStickerId('')}><X size={18}/></button></div>}
      </div>}
      <form className="tg-composer" onSubmit={event => { event.preventDefault(); if ((!body.trim() && !sticker) || group.archived || (replyId && !reply)) return; if (onSend(body, sticker?.id, replyId || undefined)) { draftMemory.clear(draftContext); const empty = emptyChatDraft(); composerRef.current = empty; setComposer(empty); setEmojiOpen(false); } }}>
        <button className="tg-icon" type="button" aria-label="대화에 추가 · 도우미와 도구" aria-haspopup="dialog" onClick={() => setAddOpen(true)}><Plus size={21}/></button><textarea ref={input} id="tg-chat-input" aria-label="메시지" placeholder={group.archived ? '보관된 모임' : '메시지 입력'} value={body} onChange={event => setBody(event.target.value)} maxLength={4000} disabled={group.archived} rows={1}/><button className="tg-icon" type="button" aria-label="이모티콘 선택" aria-expanded={emojiOpen} disabled={group.archived} onClick={() => setEmojiOpen(value => !value)}><Smile size={21}/></button><button className="tg-primary tg-icon" type="submit" aria-label="메시지 보내기" disabled={(!body.trim() && !sticker) || group.archived || Boolean(replyId && !reply)}><Send size={18}/></button>
      </form>
    </div>
    {contextOpen && <BottomSheet title="공지·진행 항목" description={activity?.title || group.name} onClose={() => setContextOpen(false)}><div className="tg tg-chat-context-panel">
      {notices.length > 0 && <section><h3>공지 · {notices.length}</h3>{notices.map(item => <details key={item.id}><summary>{item.title}<ChevronDown size={16}/></summary><div className="tg-chat-notice-text">{item.body}</div></details>)}</section>}
      {activeCards.length > 0 && <section><h3>진행 중인 투표·준비 · {activeCards.length}</h3>{activeCards.map(message => <button type="button" key={message.id} className="tg-chat-context-item" onClick={() => { setContextOpen(false); setQuery(''); setPerson('all'); onSource(message.id); }}><span>{message.entity?.type === 'POLL' ? '투표' : '준비'}</span><strong>{messageText(message)}</strong><ChevronRight size={16}/></button>)}</section>}
      {!notices.length && !activeCards.length && <p>현재 공지나 진행 중인 투표·준비가 없어요.</p>}
    </div></BottomSheet>}
    {searchOpen && <BottomSheet title="대화 검색" onClose={() => { setSearchOpen(false); setQuery(''); setPerson('all'); }}><div className="tg tg-chat-search-panel"><div className="tg-room-search"><label><span className="ui-sr-only">대화 검색</span><Search size={17}/><input ref={searchInput} aria-label="대화 검색" placeholder="대화 내용·사람 검색" value={query} onChange={event => setQuery(event.target.value)}/>{query && <button type="button" className="tg-icon" aria-label="대화 검색 지우기" onClick={() => setQuery('')}><X size={16}/></button>}</label><select aria-label="대화 검색 대상" value={person} onChange={event => setPerson(event.target.value)}><option value="all">모든 멤버</option>{group.memberIds.map(id => <option key={id} value={id}>{memberName(state, id)}</option>)}</select><span aria-live="polite">{shown.length}개 대화</span></div><div className="tg-chat-search-results">{shown.slice().reverse().map(message => <button type="button" key={message.id} onClick={() => { setSearchOpen(false); setQuery(''); setPerson('all'); onSource(message.id); }}><small>{memberName(state, message.authorId)}</small><span>{messageText(message)}</span><ChevronRight size={16}/></button>)}{!shown.length && <p>검색 결과가 없어요.</p>}</div></div></BottomSheet>}
    {addOpen && <BottomSheet title="대화에 추가" description={activity?.title || group.name} onClose={() => setAddOpen(false)}><div className="tg tg-room-options">
      {onTool ? <>
        <button type="button" disabled={group.archived} onClick={() => { setAddOpen(false); onTool('places'); }}><MapPin size={18}/><span>장소 제안·투표</span><ChevronRight size={17}/></button>
        <button type="button" disabled={group.archived} onClick={() => { setAddOpen(false); onTool('dates'); }}><CalendarDays size={18}/><span>날짜 투표</span><ChevronRight size={17}/></button>
        <button type="button" disabled={group.archived} onClick={() => { setAddOpen(false); onTool('departure'); }}><ListChecks size={18}/><span>준비물·할 일</span><ChevronRight size={17}/></button>
        <button type="button" disabled={group.archived} onClick={() => { setAddOpen(false); onTool('plan'); }}><Plus size={18}/><span>약속·여행 계획</span><ChevronRight size={17}/></button>
      </> : onAssistant && <button type="button" disabled={group.archived} onClick={() => { setAddOpen(false); onAssistant(); }}><ListChecks size={18}/><span>투표·준비·계획 도우미</span><ChevronRight size={17}/></button>}
      <button type="button" disabled={group.archived} onClick={() => { setAddOpen(false); setEmojiOpen(true); }}><Smile size={18}/>이모티콘</button>
      <button type="button" disabled={group.archived} onClick={() => { setAddOpen(false); setMentionOpen(true); }}><span aria-hidden="true">@</span>멤버 태그</button>
      {canManage && <button type="button" onClick={() => { setAddOpen(false); onNotice(); }}><Bell size={18}/>공지 작성</button>}
    </div></BottomSheet>}
    {viewOpen && <BottomSheet title="화면·대화방 이동" description={activity ? `${group.name} 안의 ${activity.title}` : group.name} onClose={() => setViewOpen(false)}><div className="tg tg-room-options">
      <nav className="tg-chat-view-menu" aria-label={activity ? '이 약속 안에서 이동' : '이 모임 안에서 이동'}>{chatViewOptions(activity).map(item => <button type="button" key={item.id} aria-current={item.id === 'chat' ? 'page' : undefined} onClick={() => { setViewOpen(false); if (item.id !== 'chat') { if (onOpenView) onOpenView(item.id); else onNavigate(activity ? `activity-${activity.id}` : `group-${group.id}`); } }}>{item.label}{item.id === 'chat' ? <Check size={16}/> : <ChevronRight size={16}/>}</button>)}</nav>
      {roomOptions.length > 1 && <label>이 모임 안에서 대화방 이동<select value={roomRoute} onChange={event => { setViewOpen(false); onNavigate(event.target.value); }}>{roomOptions.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}
      {activity && group.spaceType !== 'ACTIVITY' && <button type="button" onClick={() => { setViewOpen(false); onNavigate(`group-${group.id}`); }}><Users size={17}/>모임 화면으로</button>}
    </div></BottomSheet>}
    {moreOpen && <BottomSheet title="대화 설정" description={activity?.title || group.name} onClose={() => setMoreOpen(false)}><div className="tg tg-room-options">
      <button type="button" onClick={() => { setMoreOpen(false); onSummary(boundary); }}><MessageCircle size={17}/>대화 요약{unread.length > 0 && <small>안 읽은 대화 {unread.length}개</small>}</button>
      {unread[0] && <button type="button" onClick={() => { setMoreOpen(false); onSource(unread[0].id); }}><MessageCircle size={17}/>첫 안 읽은 대화로 이동</button>}
      {onToggleMute && <button type="button" onClick={onToggleMute}>{state.mutedRooms.includes(roomId) ? <BellOff size={17}/> : <Bell size={17}/>}{state.mutedRooms.includes(roomId) ? '대화 알림 켜기' : '대화 알림 끄기'}</button>}
      <div><strong>채팅 글자 크기</strong><div className="tg-font-options" role="group" aria-label="채팅 글자 크기">{[14, 16, 18, 20].map(size => <button key={size} type="button" aria-pressed={fontSize === size} onClick={() => resizeText(size)}>{size}px</button>)}</div></div>
      <button type="button" onClick={() => { if (onRead()) { setBoundary(sorted.at(-1)?.createdAt); setMoreOpen(false); } }}><Check size={17}/>여기까지 읽음으로 표시</button>
      {onManage && <button type="button" onClick={() => { setMoreOpen(false); onManage(); }}><MoreHorizontal size={17}/>{activity ? '약속 설정' : '모임 설정'}</button>}
    </div></BottomSheet>}
    {mentionOpen && <BottomSheet title="누구를 부를까요?" description="이 방의 모임원 이름을 메시지에 넣어요." onClose={() => setMentionOpen(false)}><div className="tg tg-mention-picker">{group.memberIds.filter(id => id !== userId).map(id => <button type="button" key={id} onClick={() => { setMentionOpen(false); insert(`@${memberName(state, id)} `); }}><span className="tg-avatar">{memberName(state, id).slice(0, 1)}</span>{memberName(state, id)}</button>)}</div></BottomSheet>}
  </div>;
}
