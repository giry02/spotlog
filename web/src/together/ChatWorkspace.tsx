import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowDown, ArrowLeft, AtSign, BarChart3, Bell, BellOff, CalendarDays, Check, ChevronDown, ChevronRight, Dices, FolderOpen, ListChecks, MapPin, MessageCircle, MoreHorizontal, Plus, Reply, Search, Send, Smile, Trophy, Users, X } from 'lucide-react';
import { BottomSheet } from '../BottomSheet';
import { memberName, type TogetherActivity, type TogetherGroup, type TogetherMessage, type TogetherNotice, type TogetherState } from './model';
import { canReplyToMessage } from './chatActions';
import { canUseRoomProfiles, resolveRoomIdentity } from './roomIdentity';
import ChatMessageActions from './ChatMessageActions';
import { findChatMentionQuery, insertChatMention, rebaseChatMentions, selectChatMentionCandidates, selectReadableChatMentions, type ChatMemberMention } from './chatMentions';
import ChatEmojiPicker from './ChatEmojiPicker';
import { getChatSticker } from './chatExpressions';
import { emptyChatDraft, type ChatComposerDraft, type ChatDraftMemory } from './chatDrafts';
import { readChatEntity } from './chatEntities';
import { readChatPlaceProposal } from './placeProposal';
import ChatEntityCard from './ChatEntityCard';
import ChatPlaceProposalCard from './ChatPlaceProposalCard';
import { chatComposerLayout, chatViewOptions, selectChatChromeContext } from './chatChrome';
import type { Place } from '../data';
import { MemberAvatar } from './GroupMembersPanel';
import SwipeReply from './SwipeReply';
import ChatSearchPanel from './ChatSearchPanel';
import { createChatSearchMemory, type ChatSearchMemory } from './chatSearch';
import './chat-workspace.css';
import './chat-interactions.css';
import './chat-entity-card.css';

interface Props {
  draftMemory: ChatDraftMemory;
  searchMemory?: ChatSearchMemory;
  summaryResumable?: boolean;
  places?: Place[];
  onOpenPlace?: (place: Place) => void;
  onOpenPlaceProposal?: (messageId: string) => void;
  state: TogetherState; userId: string; group: TogetherGroup; activity?: TogetherActivity; roomId: string;
  messages: TogetherMessage[]; notices: TogetherNotice[]; highlight: string; canManage: boolean; error: string;
  onSummary: (unreadAfter?: string) => void; onSource: (id: string) => void; onClearHighlight: () => void;
  onNotice: (body?: string) => void; onReport: (id: string) => void; onNavigate: (route: string) => void;
  onRead: () => boolean; onSend: (body: string, stickerId?: string, replyToMessageId?: string, mentions?: ChatMemberMention[]) => boolean;
  onReaction: (messageId: string, emoji: string) => void;
  onAssistant?: () => void;
  onPersonalRoute?: () => void;
  onVisitGuide?: () => void;
  onTool?: (tool: 'places' | 'dates' | 'departure' | 'plan') => void;
  onVotePoll?: (pollId: string, optionId: string | null) => boolean;
  onClosePoll?: (pollId: string) => boolean;
  onConfirmPoll?: (pollId: string, optionId: string) => boolean;
  onEditPoll?: (pollId: string) => void;
  onApplyPollToActivity?: (pollId: string) => void;
  onParticipation?: (tool: 'poll' | 'games' | 'challenges', id?: string) => void;
  onToggleTask?: (taskId: string) => boolean;
  onToggleMute?: () => void;
  onBack?: () => void;
  onOpenView?: (view: string) => void;
  onManage?: () => void;
  onResources?: () => void;
  onMemberProfile?: (memberId: string) => void;
  onEditOwnProfile?: () => void;
  onCheckReply?: (messageId: string) => boolean;
}

/** Room-scoped interaction only. Opening/searching never advances the read cursor. */
export default function ChatWorkspace({ draftMemory, searchMemory, summaryResumable = false, places, onOpenPlace, onOpenPlaceProposal, state, userId, group, activity, roomId, messages, highlight, canManage, error, onSummary, onSource, onClearHighlight, onNotice, onReport, onNavigate, onRead, onSend, onReaction, onAssistant, onPersonalRoute, onVisitGuide, onTool, onVotePoll, onClosePoll, onConfirmPoll, onEditPoll, onApplyPollToActivity, onParticipation, onToggleTask, onToggleMute, onBack, onOpenView, onManage, onResources, onMemberProfile, onEditOwnProfile, onCheckReply }: Props) {
  const draftContext = { state, userId, groupId: group.id, roomId };
  const localSearchMemory = useRef<ChatSearchMemory | null>(null);
  if (!localSearchMemory.current) localSearchMemory.current = createChatSearchMemory();
  const currentSearchMemory = searchMemory || localSearchMemory.current;
  currentSearchMemory.activate(userId);
  const roomMemberName = (id: string) => memberName(state, id, group.id, activity?.id);
  const usesRoomProfiles = canUseRoomProfiles(group);
  const viewOwnProfile = onMemberProfile ? () => onMemberProfile(userId) : undefined;
  const ownProfileAction = usesRoomProfiles ? onEditOwnProfile || viewOwnProfile : viewOwnProfile;
  const [composer, setComposer] = useState(() => draftMemory.read(draftContext));
  const composerRef = useRef(composer);
  const { body, stickerId, replyToMessageId: replyId } = composer;
  const updateComposer = (patch: Partial<ChatComposerDraft>) => {
    const next = { ...composerRef.current, ...patch };
    if (!draftMemory.write(draftContext, next)) return;
    composerRef.current = next;
    setComposer(next);
  };
  const setBody = (value: string) => updateComposer({ body: value, mentions: rebaseChatMentions(composerRef.current.body, value, composerRef.current.mentions) });
  const setStickerId = (value: string) => updateComposer({ stickerId: value });
  const setReplyId = (value: string) => updateComposer({ replyToMessageId: value });
  const beginReply = (messageId: string) => {
    if (!canReplyToMessage(state, userId, roomId, messageId) || onCheckReply && !onCheckReply(messageId)) return;
    setReplyId(messageId);
    closeMessageActions();
    requestAnimationFrame(() => input.current?.focus());
  };
  const [boundary, setBoundary] = useState<string | undefined>(state.readCursors[roomId]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState('');
  const [caret, setCaret] = useState(body.length);
  const [inputFocused, setInputFocused] = useState(false);
  const [composing, setComposing] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [dismissedMention, setDismissedMention] = useState('');
  const [memberQuery, setMemberQuery] = useState('');
  const [interactionFeedback, setInteractionFeedback] = useState<{ text: string; error?: boolean }>();
  const [latestAvailable, setLatestAvailable] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const stream = useRef<HTMLDivElement>(null);
  const workspace = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLElement>(null);
  const dock = useRef<HTMLDivElement>(null);
  const mentionList = useRef<HTMLDivElement>(null);
  const pendingOwnSendScroll = useRef(false);
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
      const dockBudget = chatComposerLayout(available, headerHeight, minimum + formInset + 1, true).dockHeight;
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
  const placeProposalFor = (message: TogetherMessage) => readChatPlaceProposal(state, userId, roomId, message, places ?? []);
  const messageText = (message: TogetherMessage) => {
    const proposal = placeProposalFor(message);
    if (proposal) return [proposal.name, proposal.area].filter(Boolean).join(' · ');
    if (!hasEntity(message)) return message.body || getChatSticker(message.stickerId)?.label || '메시지';
    const entity = readChatEntity(state, userId, roomId, message);
    if (!entity) return '이 항목을 확인할 수 없어요';
    return entity.type === 'POLL' ? entity.value.question : entity.value.title;
  };
  const unread = sorted.filter(item => item.authorId !== userId && (!boundary || item.createdAt > boundary));
  const shown = sorted;
  const reply = sorted.find(item => item.id === replyId);
  const context = selectChatChromeContext(state, userId, group.id, activity?.id);
  const { notices, messages: activeCards, pollCount, taskCount, challengeCount } = context;
  const contextLabels = [notices.length ? `공지 ${notices.length}` : '', pollCount ? `투표 ${pollCount}` : '', taskCount ? `준비 ${taskCount}` : '', challengeCount ? `챌린지 ${challengeCount}` : ''].filter(Boolean);
  const sticker = getChatSticker(stickerId);
  const closeMessageActions = (restoreFocus = false) => {
    if (!selectedMessage) return;
    const id = selectedMessage;
    setSelectedMessage('');
    if (restoreFocus) requestAnimationFrame(() => document.getElementById(`tg-message-select-${id}`)?.focus({ preventScroll: true }));
  };
  const selectMessage = (id: string, toggle = true) => {
    if (!sorted.some(message => message.id === id)) return;
    setSelectedMessage(value => toggle && value === id ? '' : id);
    setDismissedMention(mentionKey);
  };
  const roomOptions = [...(group.spaceType === 'ACTIVITY' ? [] : [{ id: `groupchat-${group.id}`, label: '모임 전체 대화' }]), ...state.activities.filter(item => item.groupId === group.id).map(item => ({ id: `activitychat-${item.id}`, label: `${(item.kind || (item.journey ? 'TRIP' : 'MEETUP')) === 'TRIP' ? '여행' : '약속'} · ${item.title}` }))];
  const roomRoute = activity ? `activitychat-${activity.id}` : `groupchat-${group.id}`;
  const insert = (text: string) => {
    const start = input.current?.selectionStart ?? body.length, end = input.current?.selectionEnd ?? start;
    const next = body.slice(0, start) + text + body.slice(end);
    if (next.length > 4000) return;
    setBody(next); setCaret(start + text.length);
    requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(start + text.length, start + text.length); });
  };
  const mentionQuery = inputFocused && !composing && !group.archived ? findChatMentionQuery(body, caret, composer.mentions) : null;
  const mentionKey = mentionQuery ? JSON.stringify([body, mentionQuery.start, mentionQuery.end]) : '';
  const mentionCandidates = mentionQuery && mentionKey !== dismissedMention ? selectChatMentionCandidates(state, userId, roomId, mentionQuery.query).slice(0, 5) : [];
  const pickerCandidates = selectChatMentionCandidates(state, userId, roomId, memberQuery);
  const allMentionCandidates = selectChatMentionCandidates(state, userId, roomId);
  const memberTagHint = (memberId: string) => {
    const member = allMentionCandidates.find(item => item.userId === memberId);
    const sameName = allMentionCandidates.filter(item => item.name === member?.name);
    return member ? `${member.role}${sameName.length > 1 ? ` · 같은 이름 ${sameName.findIndex(item => item.userId === memberId) + 1}` : ''}` : '';
  };
  const activeMessage = sorted.find(message => message.id === selectedMessage);
  const chooseMention = (memberId: string, useTypedQuery = true) => {
    try {
      let text = composerRef.current.body, mentions = composerRef.current.mentions || [];
      const start = input.current?.selectionStart ?? text.length, end = input.current?.selectionEnd ?? start;
      let query = useTypedQuery && start === end ? findChatMentionQuery(text, start, mentions) : null;
      if (!query || !selectChatMentionCandidates(state, userId, roomId, query.query).some(item => item.userId === memberId)) {
        const prefix = start > 0 && !/[\s([{]/u.test(text[start - 1]) ? ' ' : '';
        const next = text.slice(0, start) + prefix + '@' + text.slice(end);
        mentions = rebaseChatMentions(text, next, mentions); text = next;
        query = findChatMentionQuery(text, start + prefix.length + 1, mentions);
      }
      if (!query) throw new Error('태그할 멤버를 다시 선택해 주세요.');
      const result = insertChatMention(state, userId, roomId, text, mentions, query, memberId);
      updateComposer({ body: result.body, mentions: result.mentions });
      setCaret(result.caret); setMentionIndex(0); setDismissedMention(''); setMentionOpen(false); closeMessageActions();
      requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(result.caret, result.caret); });
    } catch (caught) { setInteractionFeedback({ text: caught instanceof Error ? caught.message : '멤버 태그를 다시 선택해 주세요.', error: true }); }
  };
  const renderMessageBody = (message: TogetherMessage): ReactNode => {
    const mentions = onMemberProfile ? selectReadableChatMentions(state, userId, roomId, message) : [];
    if (!mentions.length) return message.body;
    let cursor = 0;
    const parts: ReactNode[] = [];
    for (const mention of mentions) {
      parts.push(message.body.slice(cursor, mention.start));
      parts.push(<button key={`${mention.start}:${mention.userId}`} type="button" data-swipe-reply-ignore className="tg-chat-member-tag" aria-label={`${roomMemberName(mention.userId)}님 프로필 보기`} onClick={event => { event.stopPropagation(); closeMessageActions(); onMemberProfile?.(mention.userId); }}>{mention.text}</button>);
      cursor = mention.end;
    }
    parts.push(message.body.slice(cursor));
    return parts;
  };
  const copyMessage = async (message: TogetherMessage) => {
    closeMessageActions(true);
    try {
      if (!navigator.clipboard?.writeText) throw new Error();
      await navigator.clipboard.writeText(message.body);
      setInteractionFeedback({ text: '메시지 내용을 복사했어요.' });
    } catch { setInteractionFeedback({ text: '복사하지 못했어요. 브라우저의 클립보드 권한을 확인해 주세요.', error: true }); }
  };
  const latest = () => {
    onClearHighlight();
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
  }, [messages.length]);
  useEffect(() => { if (highlight) { } }, [highlight]);
  useLayoutEffect(resizeComposer, [body, replyId, emojiOpen, stickerId, error, group.archived]);
  useLayoutEffect(() => {
    if (!pendingOwnSendScroll.current) return;
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      resizeComposer();
      secondFrame = requestAnimationFrame(() => {
        pendingOwnSendScroll.current = false;
        const container = scrollRoot();
        container?.scrollTo({ top: container.scrollHeight, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      });
    });
    return () => { cancelAnimationFrame(firstFrame); cancelAnimationFrame(secondFrame); };
  }, [body, replyId, emojiOpen, stickerId, messages.length]);
  useLayoutEffect(() => {
    const headerElement = header.current;
    const container = scrollRoot();
    const updateMetrics = () => {
      if (!workspace.current) return;
      const viewport = window.visualViewport;
      const viewportHeight = viewport?.scale === 1 ? Math.min(window.innerHeight, viewport.height) : window.innerHeight;
      const height = Math.min(viewportHeight, container?.clientHeight || viewportHeight);
      workspace.current.style.setProperty('--chat-viewport-height', `${height}px`);
      // iOS can resize only the visual viewport while the content scrollport keeps its height.
      const viewportBottom = viewport?.scale === 1 ? viewport.offsetTop + viewport.height : window.innerHeight;
      const bottomOffset = Math.max(0, (container?.getBoundingClientRect().bottom || viewportBottom) - viewportBottom);
      workspace.current.style.setProperty('--chat-bottom-offset', `${bottomOffset}px`);
      const composerHeight = dock.current?.querySelector<HTMLElement>('.tg-composer')?.getBoundingClientRect().height;
      const headerHeight = headerElement?.getBoundingClientRect().height || 56;
      const composerSize = composerHeight ? Math.ceil(composerHeight) + 1 : 76;
      const layout = chatComposerLayout(height, headerHeight, composerSize, Boolean(dock.current?.querySelector('.tg-composer-extras')));
      const { compactExtras } = layout;
      workspace.current.dataset.chatCompactExtras = compactExtras ? 'true' : 'false';
      workspace.current.style.setProperty('--chat-dock-reserve', `${layout.reserve}px`);
      workspace.current.style.setProperty('--chat-context-min', compactExtras ? '48px' : '56px');
      workspace.current.style.setProperty('--chat-context-message-min', compactExtras ? '44px' : '64px');
      workspace.current.style.setProperty('--chat-tools-padding', compactExtras ? '0px' : '8px');
      if (headerElement) workspace.current.style.setProperty('--chat-header-height', `${headerHeight}px`);
      workspace.current.style.setProperty('--chat-composer-height', `${composerSize}px`);
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
    window.visualViewport?.addEventListener('scroll', resized);
    resized();
    return () => { observer?.disconnect(); window.removeEventListener('resize', resized); window.visualViewport?.removeEventListener('resize', resized); window.visualViewport?.removeEventListener('scroll', resized); };
  }, []);
  useEffect(() => {
    if (selectedMessage && !shown.some(item => item.id === selectedMessage && !item.deleted)) {
      setSelectedMessage('');
    }
  }, [selectedMessage, shown]);
  useLayoutEffect(() => {
    if (!anchor.current) return;
    const scroll = scrollRoot();
    const target = document.getElementById(anchor.current.id);
    if (scroll && target) scroll.scrollTop += target.getBoundingClientRect().top - anchor.current.top;
    anchor.current = null;
  }, [fontSize]);
  useEffect(() => { setMentionIndex(0); }, [mentionKey]);
  useLayoutEffect(() => {
    const list = mentionList.current, option = document.getElementById(`tg-chat-mention-option-${mentionIndex}`);
    if (!list || !option) return;
    const bounds = list.getBoundingClientRect(), target = option.getBoundingClientRect();
    if (target.bottom > bounds.bottom) list.scrollTop += target.bottom - bounds.bottom;
    else if (target.top < bounds.top) list.scrollTop -= bounds.top - target.top;
  }, [mentionIndex, mentionKey]);
  useEffect(() => { if (!interactionFeedback) return; const timer = window.setTimeout(() => setInteractionFeedback(undefined), 5000); return () => window.clearTimeout(timer); }, [interactionFeedback]);
  const resizeText = (size: number) => {
    const content = scrollRoot()?.getBoundingClientRect();
    const target = Array.from(stream.current?.querySelectorAll<HTMLElement>('[data-message]') ?? []).find(el => el.getBoundingClientRect().bottom > (content?.top ?? 0) + 80);
    anchor.current = target ? { id: target.id, top: target.getBoundingClientRect().top } : null;
    setFontSize(size);
  };
  return <div ref={workspace} className="tg-chat-workspace" style={{ '--chat-text-size': `${fontSize}px` } as CSSProperties} onClick={event => {
    if (!(event.target as Element).closest('[data-message],.tg-chat-action-root')) closeMessageActions();
  }}>
    <header ref={header} className="tg-chat-header">
      <button type="button" className="tg-icon" aria-label="이전 화면으로 돌아가기" onClick={() => onBack ? onBack() : onNavigate(activity ? `activity-${activity.id}` : `group-${group.id}`)}><ArrowLeft size={20}/></button>
      <h1><button type="button" className="tg-chat-room-title" aria-label={`${activity?.title || group.name} · 화면과 대화방 이동`} aria-haspopup="dialog" onClick={() => setViewOpen(true)}><span><strong>{activity?.title || group.name}</strong><small>{activity ? group.spaceType === 'ACTIVITY' ? '약속 대화' : `${group.name} · 약속 대화` : '모임 전체 대화'}</small></span><ChevronDown size={15}/></button></h1>
      <button type="button" className="tg-chat-summary-action" onClick={() => onSummary(boundary)} aria-label={summaryResumable ? "대화 요약 이어보기" : unread.length ? `대화 요약 · 안 읽은 대화 ${unread.length}개` : "대화 요약"} title={summaryResumable ? "대화 요약 이어보기" : "대화 요약"}>{summaryResumable ? "요약 이어보기" : "대화 요약"}{unread.length > 0 && <span className="tg-chat-summary-dot" aria-hidden="true"/>}</button>
      <button type="button" className="tg-icon" aria-label="대화 검색 열기" aria-haspopup="dialog" onClick={() => setSearchOpen(true)}><Search size={20}/></button>
      <button type="button" className="tg-icon" aria-label="대화 설정" aria-haspopup="dialog" onClick={() => setMoreOpen(true)}><MoreHorizontal size={22}/></button>
    </header>
    <div className={`tg-chat-context tg-chat-quickbar${contextLabels.length ? ' has-context' : ''}`} role="region" aria-label="이 대화방의 공지와 빠른 이동">
      {contextLabels.length > 0 && <button type="button" className="tg-chat-context-entry" aria-label={`${contextLabels.join(' · ')} 확인`} aria-haspopup="dialog" onClick={() => setContextOpen(true)}>{notices.length ? <Bell size={16}/> : <ListChecks size={16}/>}<span>{notices.length ? `공지 ${notices.length}` : `진행 ${pollCount + taskCount + challengeCount}`}</span></button>}
      <button type="button" aria-label={activity ? '이 약속 일정과 지도 보기' : '모임 약속·여행 보기'} onClick={() => onOpenView ? onOpenView(activity ? 'schedule' : 'activities') : onNavigate(activity ? `activity-${activity.id}` : `group-${group.id}`)}><CalendarDays size={16}/><span>일정</span></button>
      {onParticipation && <button type="button" aria-label={`이 대화방 투표 보기${pollCount ? ` · ${pollCount}개 진행 중` : ''}`} onClick={() => onParticipation('poll')}><BarChart3 size={16}/><span>투표</span>{pollCount > 0 && <small>{pollCount}</small>}</button>}
      {onResources && <button type="button" aria-label="대화방 자료 모아보기" onClick={onResources}><FolderOpen size={16}/><span>자료</span></button>}
    </div>
    <div className="tg-chat tg-room-stream" ref={stream} role="region" aria-label="채팅 대화">
      {!shown.length && <div className="tg-empty"><MessageCircle size={28}/><h2>첫 인사를 나눠보세요</h2><p>이 방의 모임원끼리 대화를 확인해요.</p></div>}
      {shown.map(message => {
        const original = message.replyToMessageId ? sorted.find(item => item.id === message.replyToMessageId) : null;
        const reactions = Object.entries(message.reactions ?? {}).map(([emoji, ids]) => ({ emoji, ids: ids.filter(id => group.memberIds.includes(id)) })).filter(item => item.ids.length);
        const { name: author, avatar } = resolveRoomIdentity(state, message.authorId, group.id, activity?.id);
        const selected = selectedMessage === message.id;
        const messageSticker = getChatSticker(message.stickerId);
        const proposal = placeProposalFor(message);
        const toolsButton = <button type="button" id={`tg-message-select-${message.id}`} className="tg-message-access-tools"
          aria-label={`${author} 메시지 도구 ${selected ? '닫기' : '열기'}`} aria-expanded={selected} aria-haspopup="dialog"
          aria-controls={selected ? `tg-message-actions-${message.id}` : undefined} onClick={() => selectMessage(message.id)}><MoreHorizontal size={17}/></button>;
        const canOpenProfile = Boolean(onMemberProfile && state.members.some(item => item.id === message.authorId)
          && group.memberIds.includes(message.authorId) && !group.blockedMemberIds?.includes(message.authorId));
        return <div key={message.id}>
          {message.id === unread[0]?.id && <div className="tg-unread-divider">여기부터 안 읽은 대화</div>}
          <article data-message id={`tg-message-${message.id}`} className={`tg-chat-message ${message.authorId === userId ? 'mine' : ''} ${highlight === message.id ? 'tg-highlight' : ''} ${selected ? 'tg-message-selected' : ''}`} onKeyDown={event => {
            if (event.key === 'Escape' && selected) { event.preventDefault(); event.stopPropagation(); closeMessageActions(true); }
          }}>
            {canOpenProfile ? <button type="button" className="tg-chat-avatar-button" aria-label={`${author}님 프로필 보기`} onClick={() => onMemberProfile?.(message.authorId)}><MemberAvatar name={author} avatar={avatar}/></button> : <span className="tg-chat-avatar-button" aria-hidden="true"><MemberAvatar name={author} avatar={avatar}/></span>}
            <div>
              <div className="tg-message-meta">{canOpenProfile ? <button type="button" className="tg-chat-author-button" aria-label={`${author}님 프로필 보기`} onClick={() => onMemberProfile?.(message.authorId)}>{author}{message.authorId === userId && <span> · 나</span>}</button> : <small>{author}</small>}<small><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' })}</time></small></div>
              <div className="tg-message-content">
                {message.replyToMessageId && <button type="button" className="tg-quoted-message" disabled={!original} onClick={() => original && onSource(original.id)}><strong>{original ? `${roomMemberName(original.authorId)}에게 답장` : '원문을 확인할 수 없는 답장'}</strong><span>{original ? messageText(original) : '삭제되었거나 이 방에서 볼 수 없는 원문이에요.'}</span></button>}
                {hasEntity(message) ? <ChatEntityCard entity={readChatEntity(state, userId, roomId, message)} places={places} onOpenPlace={onOpenPlace} state={state} userId={userId} onVotePoll={onVotePoll} onClosePoll={onClosePoll} onConfirmPoll={onConfirmPoll} onEditPoll={onEditPoll} onApplyPollToActivity={onApplyPollToActivity} onToggleTask={onToggleTask} onOpenEntity={(type, id) => onParticipation?.(type === 'GAME' ? 'games' : 'challenges', id)} onNavigate={onNavigate}/> :
                  <SwipeReply className={proposal ? 'tg-proposal-surface' : undefined} enabled={canReplyToMessage(state, userId, roomId, message.id)} resetKey={`${userId}:${roomId}:${message.id}`} onReply={() => beginReply(message.id)} onLongPress={() => selectMessage(message.id, false)}>
                    <div data-swipe-reply-surface data-message-id={message.id} className={`tg-message-select${proposal ? ' tg-message-select--proposal' : message.body ? '' : ' tg-message-select-sticker'}`} onClick={() => selectMessage(message.id)}>
                      {proposal ? <ChatPlaceProposalCard proposal={proposal}/> : <>
                        <span id={`tg-message-body-${message.id}`} className="tg-message-body">{message.body ? renderMessageBody(message) : !messageSticker || messageSticker.svg ? <span className="ui-sr-only">{messageSticker?.label || '메시지'}</span> : null}</span>
                        {messageSticker && <><img data-swipe-reply-sticker className="tg-chat-sticker" src={messageSticker.src} alt={messageSticker.svg ? `이모티콘: ${messageSticker.label}` : ''}/>{!messageSticker.svg && <span className="tg-chat-sticker-label">{messageSticker.label}</span>}</>}
                      </>}
                    </div>
                  </SwipeReply>}
                {proposal && onOpenPlaceProposal ? <div className="tg-message-proposal-tools">
                  <button type="button" className="tg-message-place-detail" aria-label={`${proposal.name} 장소 상세 보기`} title="장소 상세 보기"
                    aria-haspopup="dialog" onClick={() => onOpenPlaceProposal?.(message.id)}><MapPin size={19} aria-hidden="true"/></button>
                  {toolsButton}
                </div> : toolsButton}
              </div>
              {reactions.length > 0 && <div className="tg-message-reactions" role="group" aria-label="메시지 반응">{reactions.map(item => <button type="button" key={item.emoji} aria-pressed={item.ids.includes(userId)} aria-label={`${item.emoji} 반응 ${item.ids.length}명`} disabled={group.archived} onClick={() => onReaction(message.id, item.emoji)}>{item.emoji} {item.ids.length}</button>)}</div>}

            </div>
          </article>
        </div>;
      })}
    </div>
    {activeMessage && <ChatMessageActions id={`tg-message-actions-${activeMessage.id}`} author={roomMemberName(activeMessage.authorId)} anchor={document.getElementById(`tg-message-${activeMessage.id}`)?.querySelector<HTMLElement>('.tg-message-select') || document.getElementById(`tg-message-select-${activeMessage.id}`)} boundary={workspace.current}
      canReply={canReplyToMessage(state, userId, roomId, activeMessage.id)} canReact={!group.archived} canMention={!group.archived && selectChatMentionCandidates(state, userId, roomId).some(item => item.userId === activeMessage.authorId)} canCopy={!hasEntity(activeMessage) && Boolean(activeMessage.body.trim())} canReport={activeMessage.authorId !== userId} canNotice={canManage && !hasEntity(activeMessage) && Boolean(activeMessage.body.trim())}
      activeReactions={Object.entries(activeMessage.reactions || {}).filter(([, ids]) => ids.includes(userId)).map(([emoji]) => emoji)}
      onReply={() => beginReply(activeMessage.id)} onReaction={emoji => { onReaction(activeMessage.id, emoji); closeMessageActions(true); }} onMention={() => chooseMention(activeMessage.authorId, false)} onCopy={() => void copyMessage(activeMessage)} onReport={() => { closeMessageActions(); onReport(activeMessage.id); }} onNotice={() => { closeMessageActions(); onNotice(activeMessage.body); }} onClose={closeMessageActions}/>}
    {interactionFeedback && <div className={`tg-chat-feedback${interactionFeedback.error ? ' is-error' : ''}`} role={interactionFeedback.error ? 'alert' : 'status'}>{interactionFeedback.text}<button type="button" aria-label="메시지 안내 닫기" onClick={() => setInteractionFeedback(undefined)}><X size={16}/></button></div>}
    {latestAvailable && !emojiOpen && <button type="button" className="tg-chat-latest" aria-label="최신 대화로 이동" title="최신 대화로 이동" onClick={latest}><ArrowDown size={20}/></button>}
    <div ref={dock} className="tg-composer-dock">
      {mentionCandidates.length > 0 && <div ref={mentionList} className="tg-chat-mention-suggestions"><div className="tg-chat-mention-label"><span>이 대화방의 멤버</span><button type="button" aria-label="멤버 추천 닫기" onClick={() => setDismissedMention(mentionKey)}><X size={16}/></button></div><div role="listbox" id="tg-chat-mention-suggestions" aria-label="태그할 멤버">{mentionCandidates.map((candidate, index) => <button type="button" role="option" tabIndex={-1} aria-selected={mentionIndex === index} id={`tg-chat-mention-option-${index}`} key={candidate.userId} onPointerDown={event => event.preventDefault()} onClick={() => chooseMention(candidate.userId)}><MemberAvatar name={candidate.name} avatar={candidate.avatar}/><span>{candidate.name}<small>{memberTagHint(candidate.userId)}</small></span><AtSign size={16}/></button>)}</div></div>}
      {(error || replyId || emojiOpen && !group.archived || sticker) && <div className="tg-composer-extras" role="region" aria-label="답장·이모티콘 미리보기" tabIndex={0}>
      {error && <div className="tg-composer-error tg-error" role="alert">{error}</div>}
      {replyId && <div className="tg-reply-preview"><button type="button" className="tg-reply-original" disabled={!reply} aria-label="답장할 원문 보기" onClick={() => reply && onSource(reply.id)}><Reply size={16}/><span><strong>{reply ? `${roomMemberName(reply.authorId)}에게 답장` : '원문을 다시 확인해 주세요'}</strong><p>{reply ? messageText(reply) : '원문을 볼 수 없어요. 답장을 취소한 뒤 보낼 수 있어요.'}</p></span></button><button type="button" className="tg-icon" aria-label="답장 취소" onClick={() => setReplyId('')}><X size={18}/></button></div>}
      {emojiOpen && !group.archived && <ChatEmojiPicker onInsertEmoji={insert} onSelectSticker={id => { setStickerId(id); setEmojiOpen(false); input.current?.focus(); }} onClose={() => setEmojiOpen(false)}/>}
      {sticker && <div className="tg-sticker-preview"><img src={sticker.src} alt={`선택한 이모티콘: ${sticker.label}`}/><strong>{sticker.label}</strong><button type="button" className="tg-icon" aria-label="선택한 이모티콘 빼기" onClick={() => setStickerId('')}><X size={18}/></button></div>}
      </div>}
      <form className="tg-composer" onSubmit={event => { event.preventDefault(); if ((!body.trim() && !sticker) || group.archived || (replyId && !reply)) return; if (onSend(body, sticker?.id, replyId || undefined, composer.mentions)) { pendingOwnSendScroll.current = true; draftMemory.clear(draftContext); const empty = emptyChatDraft(); composerRef.current = empty; setComposer(empty); setEmojiOpen(false); } }}>
        <button className="tg-icon" type="button" aria-label="대화에 추가 · 도우미와 도구" aria-haspopup="dialog" onClick={() => setAddOpen(true)}><Plus size={21}/></button><textarea ref={input} id="tg-chat-input" aria-label="메시지" placeholder={group.archived ? '보관된 모임' : '메시지 입력'} value={body} onChange={event => { setBody(event.target.value); setCaret(event.target.selectionStart); setDismissedMention(''); }} onSelect={event => setCaret(event.currentTarget.selectionStart)} onFocus={() => setInputFocused(true)} onBlur={() => setInputFocused(false)} onCompositionStart={() => setComposing(true)} onCompositionEnd={event => { setComposing(false); setCaret(event.currentTarget.selectionStart); }} onKeyDown={event => {
          if (composing || event.nativeEvent.isComposing || event.keyCode === 229) return;
          if (mentionCandidates.length && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) { event.preventDefault(); setMentionIndex(value => (value + (event.key === 'ArrowDown' ? 1 : -1) + mentionCandidates.length) % mentionCandidates.length); }
          else if (mentionCandidates.length && event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); chooseMention(mentionCandidates[Math.min(mentionIndex, mentionCandidates.length - 1)].userId); }
          else if (mentionCandidates.length && event.key === 'Escape') { event.preventDefault(); setDismissedMention(mentionKey); }
          else if (event.key === 'Enter' && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); }
        }} aria-autocomplete="list" aria-controls={mentionCandidates.length ? 'tg-chat-mention-suggestions' : undefined} aria-activedescendant={mentionCandidates.length ? `tg-chat-mention-option-${Math.min(mentionIndex, mentionCandidates.length - 1)}` : undefined} enterKeyHint="send" maxLength={4000} disabled={group.archived} rows={1}/><button className="tg-icon" type="button" aria-label="이모티콘 선택" aria-expanded={emojiOpen} disabled={group.archived} onClick={() => setEmojiOpen(value => !value)}><Smile size={21}/></button><button className="tg-primary tg-icon" type="submit" aria-label="메시지 보내기" disabled={(!body.trim() && !sticker) || group.archived || Boolean(replyId && !reply)}><Send size={18}/></button>
      </form>
    </div>
    {contextOpen && <BottomSheet title="공지·진행 항목" description={activity?.title || group.name} onClose={() => setContextOpen(false)}><div className="tg tg-chat-context-panel">
      {notices.length > 0 && <section><h3>공지 · {notices.length}</h3>{notices.map(item => <details key={item.id}><summary>{item.title}<ChevronDown size={16}/></summary><div className="tg-chat-notice-text">{item.body}</div></details>)}</section>}
      {activeCards.length > 0 && <section><h3>진행 중인 항목 · {activeCards.length}</h3>{activeCards.map(message => <button type="button" key={message.id} className="tg-chat-context-item" onClick={() => { setContextOpen(false); onSource(message.id); }}><span>{message.entity?.type === 'POLL' ? '투표' : message.entity?.type === 'CHALLENGE' ? '챌린지' : '준비'}</span><strong>{messageText(message)}</strong><ChevronRight size={16}/></button>)}</section>}
      {!notices.length && !activeCards.length && <p>현재 공지나 진행 중인 항목이 없어요.</p>}
    </div></BottomSheet>}
    {searchOpen && <ChatSearchPanel context={draftContext} memory={currentSearchMemory} onClose={() => setSearchOpen(false)} onSource={onSource}/> }
    {addOpen && <BottomSheet title="대화에 추가" description={activity?.title || group.name} onClose={() => setAddOpen(false)}><div className="tg tg-room-options">
      {activity && onPersonalRoute && <button type="button" onClick={() => { setAddOpen(false); onPersonalRoute(); }}><MapPin size={18}/><span>내 참여 구간·변경 확인</span><ChevronRight size={17}/></button>}
      {activity && onVisitGuide && <button type="button" onClick={() => { setAddOpen(false); onVisitGuide(); }}><ListChecks size={18}/><span>입구·주차·방문 안내</span><ChevronRight size={17}/></button>}
      {onParticipation && <section className="tg-room-participation" aria-label="함께 정하고 즐기기"><h3>함께 정하고 즐기기</h3><div>{([['poll', '투표', BarChart3], ['games', '함께 놀기', Dices], ['challenges', '챌린지', Trophy]] as const).map(([id, label, Icon]) => <button type="button" key={id} onClick={() => { setAddOpen(false); onParticipation(id); }}><Icon size={23}/><span>{label}</span></button>)}</div></section>}
      {onTool ? <>
        <button type="button" disabled={group.archived} onClick={() => { setAddOpen(false); onTool('places'); }}><MapPin size={18}/><span>장소 제안·투표</span><ChevronRight size={17}/></button>
        {!onParticipation && <button type="button" disabled={group.archived} onClick={() => { setAddOpen(false); onTool('dates'); }}><CalendarDays size={18}/><span>날짜 투표</span><ChevronRight size={17}/></button>}
        <button type="button" disabled={group.archived} onClick={() => { setAddOpen(false); onTool('departure'); }}><ListChecks size={18}/><span>준비물·할 일</span><ChevronRight size={17}/></button>
        <button type="button" disabled={group.archived} onClick={() => { setAddOpen(false); onTool('plan'); }}><Plus size={18}/><span>약속·여행 계획</span><ChevronRight size={17}/></button>
      </> : onAssistant && <button type="button" disabled={group.archived} onClick={() => { setAddOpen(false); onAssistant(); }}><ListChecks size={18}/><span>투표·준비·계획 도우미</span><ChevronRight size={17}/></button>}
      <button type="button" disabled={group.archived} onClick={() => { setAddOpen(false); setEmojiOpen(true); }}><Smile size={18}/>이모티콘</button>
      <button type="button" disabled={group.archived} onClick={() => { setAddOpen(false); setMemberQuery(''); setMentionOpen(true); }}><span aria-hidden="true">@</span>멤버 태그</button>
      {canManage && <button type="button" onClick={() => { setAddOpen(false); onNotice(); }}><Bell size={18}/>공지 작성</button>}
    </div></BottomSheet>}
    {viewOpen && <BottomSheet title="화면·대화방 이동" description={activity ? `${group.name} 안의 ${activity.title}` : group.name} onClose={() => setViewOpen(false)}><div className="tg tg-room-options">
      <nav className="tg-chat-view-menu" aria-label={activity ? '이 약속 안에서 이동' : '이 모임 안에서 이동'}>{chatViewOptions(activity).map(item => <button type="button" key={item.id} aria-current={item.id === 'chat' ? 'page' : undefined} onClick={() => { setViewOpen(false); if (item.id !== 'chat') { if (onOpenView) onOpenView(item.id); else onNavigate(activity ? `activity-${activity.id}` : `group-${group.id}`); } }}>{item.label}{item.id === 'chat' ? <Check size={16}/> : <ChevronRight size={16}/>}</button>)}</nav>
      {roomOptions.length > 1 && <label>이 모임 안에서 대화방 이동<select value={roomRoute} onChange={event => { setViewOpen(false); onNavigate(event.target.value); }}>{roomOptions.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}
      {activity && group.spaceType !== 'ACTIVITY' && <button type="button" onClick={() => { setViewOpen(false); onNavigate(`group-${group.id}`); }}><Users size={17}/>모임 화면으로</button>}
    </div></BottomSheet>}
    {moreOpen && <BottomSheet title="대화 설정" description={activity?.title || group.name} onClose={() => setMoreOpen(false)}><div className="tg tg-room-options">
      {ownProfileAction && <button type="button" onClick={() => { setMoreOpen(false); ownProfileAction(); }}><Users size={17}/>{usesRoomProfiles ? '이 방의 멀티프로필' : '내 프로필'}</button>}
      {onResources && <button type="button" onClick={() => { setMoreOpen(false); onResources(); }}><FolderOpen size={17}/>사진·일정·투표 모아보기</button>}
      <button type="button" onClick={() => { setMoreOpen(false); onSummary(boundary); }}><MessageCircle size={17}/>대화 요약{unread.length > 0 && <small>안 읽은 대화 {unread.length}개</small>}</button>
      {unread[0] && <button type="button" onClick={() => { setMoreOpen(false); onSource(unread[0].id); }}><MessageCircle size={17}/>첫 안 읽은 대화로 이동</button>}
      {onToggleMute && <button type="button" onClick={onToggleMute}>{state.mutedRooms.includes(roomId) ? <BellOff size={17}/> : <Bell size={17}/>}{state.mutedRooms.includes(roomId) ? '대화 알림 켜기' : '대화 알림 끄기'}</button>}
      <div><strong>채팅 글자 크기</strong><div className="tg-font-options" role="group" aria-label="채팅 글자 크기">{[14, 16, 18, 20].map(size => <button key={size} type="button" aria-pressed={fontSize === size} onClick={() => resizeText(size)}>{size}px</button>)}</div></div>
      <p className="tg-chat-gesture-help">메시지를 오른쪽으로 밀면 답장, 길게 누르면 반응과 도구가 열려요. @를 입력하면 멤버를 태그할 수 있어요. Enter로 전송하고 Shift+Enter로 줄을 바꿔요.</p>
      <button type="button" onClick={() => { if (onRead()) { setBoundary(sorted.at(-1)?.createdAt); setMoreOpen(false); } }}><Check size={17}/>여기까지 읽음으로 표시</button>
      {onManage && <button type="button" onClick={() => { setMoreOpen(false); onManage(); }}><MoreHorizontal size={17}/>{activity ? '약속 설정' : '모임 설정'}</button>}
    </div></BottomSheet>}
    {mentionOpen && <BottomSheet title="누구를 부를까요?" description="현재 대화방의 멤버를 선택해 태그해요." onClose={() => setMentionOpen(false)}><div className="tg tg-mention-picker"><label className="tg-mention-search"><Search size={18}/><input aria-label="태그할 멤버 검색" placeholder="멤버 이름 검색" value={memberQuery} onChange={event => setMemberQuery(event.target.value)}/></label>{pickerCandidates.map(candidate => <button type="button" key={candidate.userId} onClick={() => chooseMention(candidate.userId)}><MemberAvatar name={candidate.name} avatar={candidate.avatar}/><span>{candidate.name}<small>{memberTagHint(candidate.userId)}</small></span><AtSign size={16}/></button>)}{!pickerCandidates.length && <p>태그할 멤버가 없어요.</p>}</div></BottomSheet>}
  </div>;
}
