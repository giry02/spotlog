import { useState } from 'react';
import { BarChart3, Bell, CalendarDays, ChevronRight, ClipboardList, Dices, FolderOpen, Image, MessageSquare, Plus, Trophy, Users } from 'lucide-react';
import { memberName, type TogetherState } from './model';
import { resolveRoomIdentity } from './roomIdentity';
import { MemberAvatar } from './GroupMembersPanel';
import { selectRoomResources } from './roomResources';
import { isPollClosed } from './polls';
import { koreaDay } from './discovery';
import './room-resource-hub.css';

type Tab = 'ALL' | 'ACTIVITIES' | 'MEDIA' | 'POSTS' | 'POLLS' | 'NOTICES' | 'MEMBERS';
interface Props {
  state: TogetherState; userId: string; groupId: string; activityId?: string; canCreate?: boolean;
  onActivity: (id: string) => void; onParticipation: (tool: 'poll' | 'games' | 'challenges', id?: string) => void;
  onNotice: (id: string) => void; onTasks: () => void; onMembers: () => void;
  onRecord?: (type: 'POST' | 'MEDIA', id: string) => void;
  onMemberRecords?: (id: string) => void; onBoard?: () => void;
  onCreateActivity?: () => void; onCreatePoll?: () => void;
}
const dayLabel = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  ? new Date(`${value}T12:00:00+09:00`).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short', timeZone: 'Asia/Seoul' }) : '날짜 미정';

/** Preview sections and category views use only records shared into this exact room. */
export default function RoomResourceHub({ state, userId, groupId, activityId, canCreate = false, onActivity, onParticipation, onNotice, onTasks, onMembers, onRecord, onMemberRecords, onBoard, onCreateActivity, onCreatePoll }: Props) {
  const [tab, setTab] = useState<Tab>('ALL');
  const value = selectRoomResources(state, userId, groupId, activityId);
  if (!value) return <p role="alert">이 대화방의 자료를 볼 수 없어요.</p>;
  const today = koreaDay(new Date());
  const planned = (item: typeof value.activities[number]) => item.status === 'PLANNED' && (!item.date || (item.endDate || item.date) >= today);
  const activities = value.activities.slice().sort((a, b) => Number(planned(b)) - Number(planned(a)) || (a.date || '9999').localeCompare(b.date || '9999'));
  const activePolls = value.polls.filter(item => !isPollClosed(item));
  const overview = tab === 'ALL', show = (id: Tab) => overview || tab === id;
  const tabs = [
    { id: 'ALL' as const, label: '전체', Icon: FolderOpen }, { id: 'ACTIVITIES' as const, label: '일정', Icon: CalendarDays },
    { id: 'MEDIA' as const, label: '사진', Icon: Image }, { id: 'POSTS' as const, label: '게시글', Icon: MessageSquare },
    { id: 'POLLS' as const, label: '투표', Icon: BarChart3 }, { id: 'NOTICES' as const, label: '공지', Icon: Bell }, { id: 'MEMBERS' as const, label: '멤버', Icon: Users },
  ];
  const visibleActivities = overview ? activities.slice(0, 3) : activities;
  const visiblePolls = overview ? [...activePolls, ...value.polls.filter(item => isPollClosed(item))].slice(0, 2) : value.polls;
  const visibleMembers = overview ? value.memberIds.slice(0, 5) : value.memberIds;
  return <div className="tg-room-resources">
    <div className="tg-room-resource-identity"><strong>{value.activity?.title || value.group.name}</strong><p className="tg-room-resource-scope">{value.activity ? '이 약속 대화방' : '모임 전체 대화방'}에 공유한 자료<span>모임원 {value.memberIds.length}명</span></p></div>
    <nav className="tg-resource-tabs" aria-label="모아볼 자료">{tabs.map(({ id, label, Icon }) => <button type="button" key={id} aria-pressed={tab === id} onClick={() => setTab(id)}><Icon size={18}/><span>{label}</span></button>)}</nav>

    {show('NOTICES') && (value.notices.length > 0 || !overview) && <section className="tg-resource-section"><header><h3><Bell size={16}/>공지 <span>{value.notices.length}</span></h3>{overview && value.notices.length > 1 && <button type="button" className="tg-resource-more" onClick={() => setTab('NOTICES')}>전체 보기<ChevronRight size={14}/></button>}</header>{value.notices.length ? value.notices.slice(0, overview ? 1 : undefined).map(item => <button className="tg-resource-notice" type="button" key={item.id} onClick={() => onNotice(item.id)}><span><strong>{item.title}</strong><small>{item.body}</small></span><ChevronRight size={16}/></button>) : <p>이 방에 등록한 공지가 없어요.</p>}</section>}

    {show('ACTIVITIES') && <section className="tg-resource-section"><header><h3><CalendarDays size={16}/>{activityId ? '이 약속·여행' : '모임의 약속·여행'} <span>{activities.length}</span></h3>{overview && activities.length > 3 && <button type="button" className="tg-resource-more" onClick={() => setTab('ACTIVITIES')}>전체 보기<ChevronRight size={14}/></button>}</header>
      {visibleActivities.length ? <div className="tg-resource-schedules">{visibleActivities.map(item => <button type="button" className="tg-resource-schedule" key={item.id} onClick={() => onActivity(item.id)}><span className="tg-resource-date">{item.date ? <><small>{Number(item.date.slice(5, 7))}월</small><strong>{Number(item.date.slice(8, 10))}</strong></> : <CalendarDays size={22}/>}</span><span><strong>{item.title}</strong><small>{item.status === 'CANCELLED' ? '취소됨' : item.status === 'COMPLETED' || !planned(item) ? '지난 약속' : dayLabel(item.date)}{item.startTime ? ` · ${item.startTime}` : ''}</small>{item.meetingPoint && <small>{item.meetingPoint}</small>}</span><ChevronRight size={16}/></button>)}</div> : <p>아직 만든 약속이 없어요.</p>}
      {!activityId && canCreate && onCreateActivity && <button type="button" className="tg-resource-create" onClick={onCreateActivity}><Plus size={16}/>약속·여행 만들기</button>}
      {value.activity && <div className="tg-resource-participants"><strong>참가로 선택한 멤버 {value.participantIds.length}명</strong>{value.participantIds.length ? <div>{value.participantIds.map(id => <button type="button" key={id} disabled={!onMemberRecords} aria-label={`${memberName(state, id, groupId, activityId)}님의 모임 프로필`} onClick={() => onMemberRecords?.(id)}><MemberAvatar name={memberName(state, id, groupId, activityId)} avatar={resolveRoomIdentity(state, id, groupId, activityId).avatar}/><span>{memberName(state, id, groupId, activityId)}</span></button>)}</div> : <p>아직 참가로 선택한 멤버가 없어요.</p>}<small>모임 가입과 약속 참가는 별도로 선택해요.</small></div>}
    </section>}

    {show('MEDIA') && <section className="tg-resource-section"><header><h3><Image size={16}/>사진·영상 <span>{value.photos.length + value.media.filter(item => item.kind === 'VIDEO').length}</span></h3>{overview && (value.photos.length > 6 || value.media.some(item => item.kind === 'VIDEO')) && <button type="button" className="tg-resource-more" onClick={() => setTab('MEDIA')}>전체 보기<ChevronRight size={14}/></button>}</header>
      {value.photos.length ? <div className="tg-resource-media">{value.photos.slice(0, overview ? 6 : undefined).map(item => <figure key={item.id}>{onRecord ? <button type="button" aria-label={`${item.caption || '공유 사진'} 원문 보기`} onClick={() => onRecord(item.source, item.recordId)}><img src={item.url} alt="" loading="lazy"/></button> : <a href={item.url} target="_blank" rel="noreferrer"><img src={item.url} alt={item.caption || '공유 사진'} loading="lazy"/></a>}<figcaption>{item.caption || '공유 사진'}{item.source === 'POST' && <small>게시글 사진</small>}</figcaption></figure>)}</div> : <p>이 방에 공유한 사진이 없어요.</p>}
      {!overview && value.media.filter(item => item.kind === 'VIDEO').map(item => <figure className="tg-resource-video" key={item.id}><video src={item.url} controls preload="metadata" aria-label={item.caption || '공유 영상'}/><figcaption>{item.caption || '공유 영상'}</figcaption></figure>)}
    </section>}

    {show('POSTS') && <section className="tg-resource-section"><header><h3><MessageSquare size={16}/>게시글 <span>{value.posts.length}</span></h3>{overview && onBoard && <button type="button" className="tg-resource-more" onClick={onBoard}>게시판<ChevronRight size={14}/></button>}</header>{value.posts.length ? value.posts.slice(0, overview ? 2 : undefined).map(item => <button type="button" className="tg-resource-row" key={item.id} disabled={!onRecord} onClick={() => onRecord?.('POST', item.id)}><span><strong>{item.title}</strong><small>{memberName(state, item.authorId, groupId, activityId)} · 댓글 {item.comments.length}</small></span><ChevronRight size={16}/></button>) : <p>이 방에 공유한 게시글이 없어요.</p>}</section>}

    {show('POLLS') && <section className="tg-resource-section"><header><h3><BarChart3 size={16}/>투표 <span>{activePolls.length}개 진행 중</span></h3>{overview && value.polls.length > 2 && <button type="button" className="tg-resource-more" onClick={() => setTab('POLLS')}>전체 보기<ChevronRight size={14}/></button>}</header>{visiblePolls.length ? visiblePolls.map(item => <button className="tg-resource-poll" type="button" key={item.id} onClick={() => onParticipation('poll', item.id)}><BarChart3 size={18}/><span><strong>{item.question}</strong><small>{item.confirmedOptionId ? '결과 확정' : isPollClosed(item) ? '마감 · 결과 보기' : '진행 중 · 투표 보기'} · 선택지 {item.options.length}개</small></span><ChevronRight size={16}/></button>) : <p>이 방에서 만든 투표가 없어요.</p>}{canCreate && onCreatePoll && <button type="button" className="tg-resource-create" onClick={onCreatePoll}><Plus size={16}/>투표 만들기</button>}</section>}

    {overview && <div className="tg-resource-tools"><button type="button" onClick={onTasks}><ClipboardList size={19}/><span>준비물·할 일<small>{value.tasks.filter(item => !item.completed).length}개 남음</small></span><ChevronRight size={16}/></button><button type="button" onClick={() => onParticipation('games')}><Dices size={19}/><span>함께 놀기<small>결과 {value.games.length}개</small></span><ChevronRight size={16}/></button><button type="button" onClick={() => onParticipation('challenges')}><Trophy size={19}/><span>챌린지<small>{value.challenges.length}개</small></span><ChevronRight size={16}/></button></div>}

    {show('MEMBERS') && <section className="tg-resource-section"><header><h3><Users size={16}/>모임 전체 멤버 <span>{value.memberIds.length}</span></h3><button type="button" className="tg-resource-more" onClick={onMembers}>멤버 보기<ChevronRight size={14}/></button></header>{activityId && <p>위의 참가 멤버와 구분한 모임 전체 명단이에요.</p>}<div className="tg-resource-members">{visibleMembers.map(id => <button type="button" key={id} disabled={!onMemberRecords} onClick={() => onMemberRecords?.(id)} aria-label={`${memberName(state, id, groupId, activityId)}님의 모임 프로필`}><MemberAvatar name={memberName(state, id, groupId, activityId)} avatar={resolveRoomIdentity(state, id, groupId, activityId).avatar}/><span><strong>{memberName(state, id, groupId, activityId)}</strong><small>{id === value.group.ownerId ? '모임장' : value.group.managerIds.includes(id) ? '운영진' : '멤버'}</small></span><ChevronRight size={15}/></button>)}</div>{overview && value.memberIds.length > 5 && <button type="button" className="tg-resource-create" onClick={() => setTab('MEMBERS')}>전체 {value.memberIds.length}명 보기</button>}</section>}
  </div>;
}
