import { useEffect, useRef, useState } from 'react';
import { ChevronRight, MessageCircle, Search, Users, X } from 'lucide-react';
import { ScreenHeader } from '../ScreenHeader';
import { AppMenuButton } from '../AppMenu';
import type { TogetherState } from './model';
import { selectConversationInbox } from './conversationInbox';
import { createConversationInboxView, filterConversationInbox, resolveConversationInboxView, type ConversationInboxFilter, type ConversationInboxViewState } from './conversationInboxState';
import './conversation-inbox.css';

export interface ConversationInboxProps {
  state: TogetherState; userId: string; onOpen: (route: string) => void; onLogin: () => void; onFindGroups: () => void;
  view?: ConversationInboxViewState;
  onViewChange?: (next: ConversationInboxViewState) => void;
}

export default function ConversationInbox({ state, userId, onOpen, onLogin, onFindGroups, view, onViewChange }: ConversationInboxProps) {
  const [localView, setLocalView] = useState(() => createConversationInboxView(userId));
  const root = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => { setLocalView(createConversationInboxView(userId)); }, [userId]);
  const current = resolveConversationInboxView(view ?? localView, userId);
  const { query, filter } = current;
  const change = (patch: Partial<Omit<ConversationInboxViewState, 'actorId'>>) => {
    const next = resolveConversationInboxView({ ...current, ...patch, actorId: userId }, userId);
    setLocalView(next); onViewChange?.(next);
  };
  const open = (route: string) => {
    change({ scrollTop: root.current?.closest('.content')?.scrollTop ?? current.scrollTop });
    onOpen(route);
  };
  const reset = () => {
    change({ query: '', filter: 'ALL', scrollTop: 0 });
    root.current?.closest('.content')?.scrollTo({ top: 0, behavior: 'instant' });
    search.current?.focus({ preventScroll: true });
  };
  const all = selectConversationInbox(state, userId);
  const rooms = filterConversationInbox(all, current);
  return <div className="conversation-inbox" ref={root}><ScreenHeader title="대화함" actions={<AppMenuButton/>}/>
    <div className="conversation-inbox__body"><label className="conversation-inbox__search"><Search size={18}/><input ref={search} type="search" aria-label="대화방 검색" placeholder="모임·약속 이름 검색" value={query} onChange={event => change({ query: event.target.value, scrollTop: 0 })}/>{query && <button type="button" aria-label="대화방 검색어 지우기" onClick={() => { change({ query: '', scrollTop: 0 }); search.current?.focus({ preventScroll: true }); }}><X size={18}/></button>}</label>
      <div className="conversation-inbox__filters" role="group" aria-label="대화방 종류">{([['ALL','전체'],['GROUP','모임'],['ACTIVITY','약속·여행'],['UNREAD','안 읽음']] as const).map(([id,label]: readonly [ConversationInboxFilter, string])=><button type="button" key={id} aria-pressed={filter===id} onClick={()=>change({ filter: id, scrollTop: 0 })}>{label}</button>)}</div>
      {!userId ? <section className="conversation-inbox__empty"><MessageCircle size={30}/><h2>함께 나눈 대화를 모아봐요</h2><p>모임 전체 대화와 각 약속의 대화방으로 바로 이어져요.</p><button type="button" onClick={onLogin}>로그인하고 대화 보기</button></section>
      : !all.length ? <section className="conversation-inbox__empty"><Users size={30}/><h2>아직 참여한 대화방이 없어요</h2><p>모임에 가입하거나 약속을 만들면 이곳에서 대화를 이어갈 수 있어요.</p><button type="button" onClick={onFindGroups}>모임 둘러보기</button></section>
      : !rooms.length ? <section className="conversation-inbox__empty"><MessageCircle size={26}/><h2>조건에 맞는 대화방이 없어요</h2><p>{filter === 'UNREAD' && !query.trim() ? '현재 안 읽은 대화가 없어요. 전체 대화방을 확인할 수 있어요.' : '검색어나 대화방 종류를 바꾸어 찾아보세요.'}</p><button type="button" onClick={reset}>전체 대화방 보기</button></section>
      : <div className="conversation-inbox__list">{rooms.map(room=><button type="button" className="conversation-inbox__room" key={room.roomId} onClick={()=>open(room.route)}><span className="conversation-inbox__photo">{room.cover?<img src={room.cover} alt="" loading="lazy"/>:<MessageCircle size={26}/>}</span><span className="conversation-inbox__copy"><small>{room.type==='ACTIVITY'?`${room.groupName} › 약속·여행`:'모임 전체'}{room.archived?' · 보관된 모임':''}</small><strong>{room.title}</strong><span>{room.preview}</span></span>{room.unread>0?<span className="conversation-inbox__badge" aria-label={`안 읽은 대화 ${room.unread}개`}>{room.unread>99?'99+':room.unread}</span>:<ChevronRight size={17}/>}</button>)}</div>}
    </div></div>;
}
