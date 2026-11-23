import { useState } from 'react';
import { ChevronRight, Ellipsis, Pencil, ShieldCheck, UserRound } from 'lucide-react';
import type { TogetherState } from './model';
import { selectGroupMembers } from './groupContent';
import { canUseRoomProfiles } from './roomIdentity';
import GroupProfileDetails from './GroupProfileDetails';
import { isSafeTogetherImageUrl } from './contentMedia';
import './content-panels.css';

export function MemberAvatar({ name, avatar, large = false, onImageError }: { name: string; avatar?: string; large?: boolean; onImageError?: () => void }) {
  const [failedUrl, setFailedUrl] = useState('');
  return <span className={`tg-member-avatar${large ? ' tg-member-avatar--large' : ''}`} aria-label={`${name} 프로필 사진`}>{avatar && isSafeTogetherImageUrl(avatar) && failedUrl !== avatar ? <img src={avatar} alt="" onError={() => { setFailedUrl(avatar); onImageError?.(); }}/> : <UserRound size={large ? 30 : 22} aria-hidden="true"/>}</span>;
}

interface GroupMembersProps {
  state: TogetherState; viewerId: string; groupId: string; activityId?: string; onViewRecords: (memberId: string) => void;
  onOpenManagers?: () => void;
  onManageMember?: (memberId: string) => void; onOpenApplications?: () => void;
  onEditProfile?: () => void;
}
/** Member browsing and personal presentation; role changes live in GroupManagersPanel. */
export default function GroupMembersPanel({ state, viewerId, groupId, activityId, onViewRecords, onOpenManagers, onManageMember, onOpenApplications, onEditProfile }: GroupMembersProps) {
  const members = selectGroupMembers(state, viewerId, groupId, activityId);
  const group = state.groups.find(item => item.id === groupId);
  if (!members || !group) return <p>현재 모임원만 멤버를 볼 수 있어요.</p>;
  const own = members.find(item => item.id === viewerId);
  const manager = !group.archived && (group.ownerId === viewerId || group.managerIds.includes(viewerId));
  return <div className="tg-members-panel">
    {own && <section className="tg-own-member"><MemberAvatar name={own.name} avatar={own.avatar} large/><div><small>{canUseRoomProfiles(group) ? '이 방의 멀티프로필' : '내 기본 프로필'}</small><strong>{own.name}</strong><span>{own.role}</span></div>{!group.archived && onEditProfile && <button type="button" className="tg-member-action-icon" aria-label="멀티프로필 편집" title="멀티프로필 편집" onClick={onEditProfile}><Pencil size={18} aria-hidden="true"/></button>}</section>}
    <header className="tg-member-directory-heading"><h3>함께하는 멤버 <span>{members.length}명</span></h3>{onOpenManagers && group.ownerId === viewerId && !group.archived && <button type="button" className="tg-member-action-icon" aria-label="운영진 관리" title="운영진 관리" onClick={onOpenManagers}><ShieldCheck size={19} aria-hidden="true"/></button>}</header>
    <div className="tg-member-directory">{members.map(item => <article className="tg-member-directory__item" key={item.id}>
      <div className="tg-member-directory__row">
        <button type="button" className="tg-member-directory__person" aria-label={`${item.name}님의 기록 보기`} onClick={() => onViewRecords(item.id)}><MemberAvatar name={item.name} avatar={item.avatar}/><span><strong>{item.name}{item.id === viewerId && <small>나</small>}</strong><small>{item.role}</small></span><ChevronRight size={16} aria-hidden="true"/></button>
        {manager && onManageMember && item.id !== viewerId && item.id !== group.ownerId && (group.ownerId === viewerId || !group.managerIds.includes(item.id)) && <button type="button" className="tg-member-action-icon" aria-label={`${item.name} 멤버 관리`} title="멤버 관리" onClick={() => onManageMember(item.id)}><Ellipsis size={19} aria-hidden="true"/></button>}
      </div>
      {item.sharedIntroduction && <p>{item.sharedIntroduction}</p>}
      {(item.id === viewerId || manager) && group.memberProfiles?.[item.id] && <details className="tg-member-introduction"><summary>모임에 남긴 소개</summary><GroupProfileDetails profile={group.memberProfiles[item.id]} fields={group.joinFields}/></details>}
    </article>)}</div>
    {manager && onOpenApplications && <button type="button" className="tg-content-menu" onClick={onOpenApplications}><UserRound size={18}/>가입 신청 관리<ChevronRight size={17}/></button>}
  </div>;
}

export function GroupManagersPanel({ state, viewerId, groupId, onChangeRole }: {
  state: TogetherState; viewerId: string; groupId: string; onChangeRole: (memberId: string, role: 'MEMBER' | 'MANAGER' | 'OWNER') => boolean;
}) {
  const members = selectGroupMembers(state, viewerId, groupId), group = state.groups.find(item => item.id === groupId);
  const [transfer, setTransfer] = useState('');
  if (!members || !group || group.ownerId !== viewerId || group.archived) return <p>모임장만 운영진을 임명하고 권한을 변경할 수 있어요.</p>;
  const selected = members.find(item => item.id === transfer);
  return <div className="tg-managers-panel"><div className="tg-content-scope"><strong><ShieldCheck size={19}/>운영진 임명·권한</strong><small>운영진은 가입 신청, 공지, 모임 정보를 관리할 수 있어요.</small></div>
    {members.filter(item => item.id !== viewerId).map(item => <div className="tg-manager-row" key={item.id}><MemberAvatar name={item.name} avatar={item.avatar}/><span><strong>{item.name}</strong><small>{item.role}</small></span><button type="button" onClick={() => onChangeRole(item.id, group.managerIds.includes(item.id) ? 'MEMBER' : 'MANAGER')}>{group.managerIds.includes(item.id) ? '운영진 해제' : '운영진 임명'}</button><button type="button" className="tg-text-button" onClick={() => setTransfer(item.id)}>모임장 위임</button></div>)}
    {members.length <= 1 && <p className="tg-muted">다른 모임원이 가입하면 운영진을 임명할 수 있어요.</p>}
    {selected && <section className="tg-role-confirm" role="alert"><strong>{selected.name}님에게 모임장을 위임할까요?</strong><p>위임하면 모임장 권한이 새 모임장에게 넘어가요. 내 모임원 자격은 유지돼요.</p><div className="tg-row"><button type="button" onClick={() => setTransfer('')}>취소</button><button type="button" className="tg-primary" onClick={() => { if (onChangeRole(transfer, 'OWNER')) setTransfer(''); }}>모임장 위임 확인</button></div></section>}
  </div>;
}
