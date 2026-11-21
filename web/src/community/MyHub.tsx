import { useEffect, useState } from 'react';
import { BookOpen, CalendarDays, ChevronRight, FolderOpen, MapPin, Plus, Settings, Trash2, UserRound, Users } from 'lucide-react';
import type { Journey } from '../data';
import { ScreenHeader, ScreenTabs } from '../ScreenHeader';
import { AppMenuButton } from '../AppMenu';
import type { TogetherState } from '../together/model';
import { MemberAvatar } from '../together/GroupMembersPanel';
import { discoveryProfile, topicOptions } from '../together/discovery';
import type { MyGroupDirectoryItem } from '../together/myGroupDirectory';
import { ActivityRow, PlanRow } from './PlatformHubs';
import { myHubContent, myHubGroups, myHubOwnGroupRecords, myHubOwnRecordFeed, resolveMyOwnRecordDestination, myHubSection, type MyOwnRecordTarget, type MySection } from './myHubModel';
import { MyOwnRecordCollection } from './MyOwnRecordCollection';
import './platform-hubs.css';
import './my-hub-groups.css';
import './own-group-profiles.css';

export type { MySection } from './myHubModel';
export interface MyHubProps {
  state: TogetherState;
  userId: string;
  userName?: string;
  plans: Journey[];
  journals: Journey[];
  onActivity: (id: string) => void;
  onGroup: (id: string) => void;
  onFindGroups: () => void;
  onPlan: (id: string) => void;
  onJournal: (id: string) => void;
  onLogin: () => void;
  onInvites: () => void;
  onTrash: () => void;
  onPersonalLibrary: () => void;
  onAccount: () => void;
  onEditGroupProfiles?: () => void;
  onOpenOwnGroupRecords?: (groupId: string, activityId?: string) => void;
  onOpenOwnGroupRecord?: (target: MyOwnRecordTarget) => void;
  onCalendar: () => void;
  onCreateAppointment: () => void;
  onCreateTravel: () => void;
  myRegionLabel?: string;
  onManageMyRegions?: () => void;
  section?: MySection;
  onSectionChange?: (section: MySection) => void;
}

const groupKindNames = { FAMILY: '가족', FRIENDS: '친구', HOBBY: '취미·지역', GUIDE: '가이드' };

function MyGroupRow({ item, userId, onOpen }: { item: MyGroupDirectoryItem; userId: string; onOpen: () => void }) {
  const [failedCover, setFailedCover] = useState('');
  const { group, nextActivity, lastMessage, unreadCount } = item;
  const profile = discoveryProfile(group);
  const topics = profile.topics.map(topic => topicOptions.find(option => option.id === topic)?.label).filter(Boolean);
  const location = [group.region, profile.district, profile.neighborhood].filter(Boolean).join(' ');
  const role = group.ownerId === userId ? '모임장' : group.managerIds.includes(userId) ? '운영진' : '모임원';
  return <button type="button" className="my-hub-group-row" onClick={onOpen}>
    <span className="my-hub-group-cover">{group.cover && failedCover !== group.cover ? <img src={group.cover} alt="" loading="lazy" onError={() => setFailedCover(group.cover)}/> : <Users size={26} aria-hidden="true"/>}</span>
    <span className="my-hub-group-copy"><strong>{group.name}</strong><small>{[groupKindNames[group.kind] || '기타', location, topics[0]].filter(Boolean).join(' · ')}</small>
      {nextActivity ? <span className="my-hub-group-next"><CalendarDays size={13} aria-hidden="true"/><span>{Number(nextActivity.date.slice(5, 7))}/{Number(nextActivity.date.slice(8, 10))}{nextActivity.startTime ? ` ${nextActivity.startTime}` : ''} · {nextActivity.title}</span></span> : <span className="my-hub-group-preview">{lastMessage?.body || `${group.memberIds.length}명과 함께하는 모임`}</span>}
      <small className="my-hub-group-role">{role}{nextActivity || lastMessage ? ` · ${group.memberIds.length}명` : ''}</small>
    </span>
    {unreadCount > 0 ? <span className="my-hub-group-unread" aria-label={`안 읽은 대화 ${unreadCount}개`}>{unreadCount > 99 ? '99+' : unreadCount}</span> : <ChevronRight size={18} aria-hidden="true"/>}
  </button>;
}

/** One personal root; account, calendar and existing editors keep their own detail screens. */
export function MyHub({ state, userId, userName, plans, journals, onActivity, onGroup, onFindGroups, onPlan, onJournal, onLogin, onInvites, onTrash, onPersonalLibrary, onAccount, onEditGroupProfiles, onOpenOwnGroupRecords, onOpenOwnGroupRecord, onCalendar, onCreateAppointment, onCreateTravel, myRegionLabel, onManageMyRegions, section: suppliedSection, onSectionChange }: MyHubProps) {
  const [localSelection, setLocalSelection] = useState<{ owner: string; section: MySection }>({ owner: userId, section: 'schedule' });
  useEffect(() => { setLocalSelection({ owner: userId, section: 'schedule' }); }, [userId]);
  const section = myHubSection(suppliedSection ?? (localSelection.owner === userId ? localSelection.section : 'schedule'));
  const setSection = (value: string) => { const next = myHubSection(value); setLocalSelection({ owner: userId, section: next }); onSectionChange?.(next); };
  const member = state.members.find(item => item.id === userId);
  const authenticated = Boolean(userId && member);
  const content = myHubContent(state, userId, plans, journals);
  const groups = myHubGroups(state, userId);
  const ownGroupRecords = myHubOwnGroupRecords(state, userId);
  const ownRecordFeed = myHubOwnRecordFeed(state, userId);
  const openOwnRecord = (target: MyOwnRecordTarget) => {
    if (!resolveMyOwnRecordDestination(state, userId, target)) return;
    if (onOpenOwnGroupRecord) onOpenOwnGroupRecord(target);
    else if (onOpenOwnGroupRecords) onOpenOwnGroupRecords(target.groupId, target.activityId);
    else onGroup(target.groupId);
  };
  return <div className="platform-hub my-hub">
    <ScreenHeader title="마이" actions={<><button type="button" aria-label={authenticated ? '계정 관리' : '로그인·회원가입'} onClick={authenticated ? onAccount : onLogin}><Settings size={22}/></button><AppMenuButton/></>}/>
    <ScreenTabs label="마이 구분" idPrefix="my-hub" value={section} onChange={setSection} items={[{ id: 'schedule', label: '내 일정', panelId: 'my-hub-panel' }, { id: 'groups', label: '내 모임', panelId: 'my-hub-panel' }, { id: 'travel', label: '내 여행', panelId: 'my-hub-panel' }, { id: 'records', label: '기록', panelId: 'my-hub-panel' }]}/>
    <div className="platform-hub-body my-hub-body" id="my-hub-panel" role="tabpanel" aria-labelledby={`my-hub-${section}`}>
      {onManageMyRegions && <button type="button" className="my-hub-area" onClick={onManageMyRegions}><MapPin size={20}/><span><strong>내 동네·위치 관리</strong><small>{myRegionLabel || '현재 위치로 동네를 정하고 모임을 찾아요'}</small></span><ChevronRight size={17}/></button>}
      {section === 'schedule' ? <>
        <div className="my-hub-tools"><button type="button" onClick={authenticated ? onCalendar : onLogin}><CalendarDays size={18}/>캘린더</button><button type="button" onClick={onCreateAppointment}><Plus size={18}/>약속 만들기</button></div>
        {!authenticated ? <div className="my-hub-empty"><CalendarDays size={26}/><strong>모임과 약속 일정을 모아봐요</strong><p>내 여행은 로그인 없이도 이 기기의 보관함에서 확인할 수 있어요.</p><button type="button" className="my-hub-text-action" onClick={() => setSection('travel')}>이 기기의 내 여행 보기<ChevronRight size={16}/></button></div> : <>
          {content.schedule.length ? <><div className="my-hub-section-heading"><h2>다가오는 일정</h2></div><div className="platform-row-list">{content.schedule.map(item => item.type === 'activity' && item.activity ? <ActivityRow key={`activity:${item.id}`} activity={item.activity} state={state} onOpen={() => onActivity(item.id)}/> : item.plan ? <PlanRow key={`plan:${item.id}`} plan={item.plan} onOpen={() => onPlan(item.id)}/> : null)}</div></> : <div className="my-hub-empty"><CalendarDays size={26}/><strong>예정된 일정이 없어요</strong><p>모임에서 정한 약속과 날짜를 정한 개인 여행이 여기에 모여요.</p></div>}
          {content.undatedActivities.length > 0 && <><div className="my-hub-section-heading"><h2>날짜를 정할 약속</h2></div>{content.undatedActivities.map(activity => <ActivityRow key={activity.id} activity={activity} state={state} onOpen={() => onActivity(activity.id)}/>)}</>}
          <button type="button" className="my-hub-utility" onClick={onInvites}>초대·가입 신청 확인<ChevronRight size={16}/></button>
        </>}
      </> : section === 'groups' ? <>
        <div className="my-hub-section-heading"><h2>가입한 모임{authenticated ? ` ${groups.counts.ALL}` : ''}</h2><button type="button" onClick={onFindGroups}><Plus size={16}/>모임 찾기</button></div>
        {authenticated ? <>
          {groups.groups.length ? <div className="my-hub-group-list" aria-label="가입한 모임 목록">{groups.groups.map(item => <MyGroupRow key={item.group.id} item={item} userId={userId} onOpen={() => onGroup(item.group.id)}/>)}</div> : <div className="my-hub-empty"><Users size={26}/><strong>아직 가입한 모임이 없어요</strong><p>가족·친구와 함께하거나 관심사가 맞는 모임을 찾아보세요.</p><button type="button" className="outline" onClick={onFindGroups}>모임 둘러보기</button></div>}
          <button type="button" className="my-hub-group-invites my-hub-group-invites--secondary" onClick={onInvites}><Users size={19}/><span><strong>초대·가입 신청{groups.pendingApplicationCount > 0 ? ` · 승인 대기 ${groups.pendingApplicationCount}건` : ''}</strong><small>초대 링크와 신청 상태 확인</small></span><ChevronRight size={18}/></button>
        </> : <div className="my-hub-empty"><Users size={26}/><strong>내가 가입한 모임을 모아봐요</strong><p>로그인하면 내 모임과 다음 약속, 초대를 확인할 수 있어요.</p><button type="button" className="my-hub-group-login" onClick={onLogin}>로그인하고 내 모임 보기</button><button type="button" className="my-hub-text-action" onClick={onFindGroups}>가입할 모임 둘러보기<ChevronRight size={16}/></button></div>}
      </> : section === 'travel' ? <>
        <div className="my-hub-section-heading"><h2>내 여행</h2><button type="button" onClick={onCreateTravel}><Plus size={16}/>여행 만들기</button></div>
        {content.ownPlans.length ? <div className="platform-row-list">{content.ownPlans.map(plan => <PlanRow key={plan.id} plan={plan} onOpen={() => onPlan(plan.id)}/>)}</div> : <div className="my-hub-empty"><FolderOpen size={26}/><strong>아직 만든 여행이 없어요</strong><p>저장한 장소를 골라 하루 동선부터 만들 수 있어요.</p><button type="button" className="outline" onClick={onCreateTravel}>여행 만들기</button></div>}
        <p className="my-hub-device-note">이 기기에 저장한 개인 일정이에요. 계정·모임 일정과 자동으로 합쳐지지 않아요.</p>
        <button type="button" className="my-hub-utility" onClick={onPersonalLibrary}>여행·여행기 전체 보관함<ChevronRight size={16}/></button>
      </> : <>
        <section className="my-hub-own-group-records" aria-labelledby="my-hub-own-records-title">
          <div className="my-hub-section-heading"><h2 id="my-hub-own-records-title">모임에 공유한 내 기록</h2></div>
          {authenticated ? <MyOwnRecordCollection key={userId} entries={ownRecordFeed} groups={ownGroupRecords} onOpen={openOwnRecord} onScope={(groupId, activityId) => onOpenOwnGroupRecords ? onOpenOwnGroupRecords(groupId, activityId) : onGroup(groupId)}/> : <div className="my-hub-record-empty"><p>로그인하면 모임에 남긴 내 글과 사진을 확인할 수 있어요.</p><button type="button" className="my-hub-text-action" onClick={onLogin}>로그인하고 기록 보기<ChevronRight size={16}/></button></div>}
        </section>
        <section aria-labelledby="my-hub-personal-records-title"><div className="my-hub-section-heading"><h2 id="my-hub-personal-records-title">개인 여행기</h2></div><p className="my-hub-device-note">이 기기에 저장한 개인 기록이에요. 모임에 공유한 사본과 따로 보관해요.</p>
        {content.ownJournals.length ? content.ownJournals.map(journal => <button type="button" className="platform-journal-row" key={journal.id} onClick={() => onJournal(journal.id)}><BookOpen size={24}/><span className="platform-row-copy"><strong>{journal.title}</strong><small>{journal.region} · {journal.visibility === 'PUBLIC' ? '공개' : '비공개'} · {journal.days.length} DAY</small></span><ChevronRight size={18}/></button>) : <div className="my-hub-record-empty"><p>아직 이 기기에 저장한 개인 여행기가 없어요.</p><button type="button" className="my-hub-text-action" onClick={() => setSection('travel')}>내 여행에서 기록 남기기<ChevronRight size={16}/></button></div>}
        </section>
        {authenticated && content.pastActivities.length > 0 && <><div className="my-hub-section-heading"><h2>지난 약속</h2></div>{content.pastActivities.map(activity => <ActivityRow key={activity.id} activity={activity} state={state} onOpen={() => onActivity(activity.id)}/>)}</>}
        {content.pastPlans.length > 0 && <><div className="my-hub-section-heading"><h2>지난 개인 여행</h2></div>{content.pastPlans.map(plan => <PlanRow key={plan.id} plan={plan} onOpen={() => onPlan(plan.id)}/>)}</>}
      </>}
      <footer className="my-hub-footer my-hub-footer--account">
        {authenticated ? <><button type="button" className="my-hub-account-line" onClick={onAccount}><MemberAvatar name={userName || member?.name || '내 계정'} avatar={member?.avatar}/><span>{userName || member?.name || '내 계정'}</span><small>계정 관리</small><ChevronRight size={16}/></button>{onEditGroupProfiles && <button type="button" onClick={onEditGroupProfiles}><UserRound size={18}/><span>내 멀티프로필</span><ChevronRight size={16}/></button>}</> : <button type="button" onClick={onLogin}><UserRound size={18}/>로그인·회원가입<ChevronRight size={16}/></button>}
        <button type="button" onClick={onTrash}><Trash2 size={16}/>기기 휴지통</button>
      </footer>
    </div>
  </div>;
}
