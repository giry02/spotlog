import { useState } from 'react';
import { Archive, BriefcaseBusiness, ChevronRight, Clock3, Plus, RotateCcw, Trash2, Users, Utensils } from 'lucide-react';
import type { TogetherState } from './model';
import { isTemporaryRoomTrashed, temporaryRoomPurposeLabel } from './temporaryRooms';
import './temporary-rooms.css';

export default function TemporaryRoomsPanel({ state, userId, onCreate, onOpen, onRestore, onLogin }: { state: TogetherState; userId: string; onCreate: () => void; onOpen: (activityId: string) => void; onRestore: (groupId: string, activityId: string, revision: number) => boolean; onLogin: () => void }) {
  const [view, setView] = useState<'ACTIVE' | 'ARCHIVE' | 'TRASH'>('ACTIVE');
  const rows = state.groups.filter(group => group.spaceType === 'ACTIVITY' && group.temporaryRoom && group.memberIds.includes(userId) && !group.blockedMemberIds?.includes(userId) && (!isTemporaryRoomTrashed(group) || group.ownerId === userId)).flatMap(group => {
    const activity = state.activities.find(item => item.groupId === group.id);
    return activity ? [{ group, activity, view: isTemporaryRoomTrashed(group) ? 'TRASH' : group.archived ? 'ARCHIVE' : 'ACTIVE' }] : [];
  });
  return <section className="temporary-room-directory">
    <div className="temporary-room-heading"><div><h2>이번 만남만 가볍게</h2><p>회식·고객 미팅·지인 약속을 준비해요.</p></div><button type="button" className="temporary-room-primary" onClick={userId ? onCreate : onLogin}><Plus size={17}/>만들기</button></div>
    {!userId ? <div className="temporary-room-empty"><Users size={28}/><h3>초대할 사람들과 따로 준비해요</h3><p>로그인하고 이번 만남을 위한 비공개 공간을 만들 수 있어요.</p><button type="button" onClick={onLogin}>로그인</button></div> : <>
      <div className="temporary-room-filters" role="group" aria-label="일회성 모임 상태">{([{ id: 'ACTIVE', label: '진행 중', Icon: Clock3 }, { id: 'ARCHIVE', label: '보관함', Icon: Archive }, { id: 'TRASH', label: '휴지통', Icon: Trash2 }] as const).map(({ id, label, Icon }) => <button type="button" key={id} aria-pressed={view === id} onClick={() => setView(id)}><Icon size={16}/>{label}<span>{rows.filter(row => row.view === id).length}</span></button>)}</div>
      {rows.filter(row => row.view === view).length ? <div className="temporary-room-list">{rows.filter(row => row.view === view).map(({ group, activity }) => {
        const purpose = group.temporaryRoom!.purpose, Icon = purpose === 'DINNER' ? Utensils : purpose === 'BUSINESS' ? BriefcaseBusiness : Users;
        return <article key={group.id}><button type="button" className="temporary-room-open" disabled={view === 'TRASH'} onClick={() => onOpen(activity.id)}><span className="temporary-room-symbol"><Icon size={22}/></span><span><small>{temporaryRoomPurposeLabel(purpose)}{group.region ? ` · ${group.region}` : ''}</small><strong>{group.name}</strong><span>{activity.date || '날짜 미정'}{activity.startTime ? ` · ${activity.startTime}` : ''} · {group.memberIds.length}명</span><small>{view === 'TRASH' ? '휴지통 · 만든 사람이 복원 가능' : group.archived ? '종료한 모임 · 기록 보관' : group.temporaryRoom!.expiresAt ? `자동 종료 ${new Date(group.temporaryRoom!.expiresAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : '만든 사람이 직접 종료'}</small></span>{view !== 'TRASH' && <ChevronRight size={18}/>}</button>{view === 'TRASH' && <button type="button" className="temporary-room-restore" onClick={() => { if (onRestore(group.id, activity.id, activity.revision)) setView('ARCHIVE'); }}><RotateCcw size={16}/>보관함으로 복원</button>}</article>;
      })}</div> : <div className="temporary-room-empty"><Clock3 size={28}/><h3>{view === 'ACTIVE' ? '이번 만남을 준비해 볼까요?' : view === 'ARCHIVE' ? '보관한 일회성 모임이 없어요' : '휴지통이 비어 있어요'}</h3><p>{view === 'ACTIVE' ? '음식점·카페·숙소를 함께 고르고, 지도와 대화로 준비해요.' : view === 'ARCHIVE' ? '종료할 때 기록을 남기면 여기서 다시 볼 수 있어요.' : '만든 사람이 휴지통으로 보낸 모임은 여기서 복원할 수 있어요.'}</p>{view === 'ACTIVE' && <button type="button" onClick={onCreate}>첫 일회성 모임 만들기</button>}</div>}
    </>}
  </section>;
}
