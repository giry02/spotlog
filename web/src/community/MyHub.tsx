import { useEffect, useState } from 'react';
import { BookOpen, CalendarDays, ChevronRight, FolderOpen, Plus, Settings, Trash2, UserRound } from 'lucide-react';
import type { Journey } from '../data';
import { ScreenHeader, ScreenTabs } from '../ScreenHeader';
import { AppMenuButton } from '../AppMenu';
import type { TogetherState } from '../together/model';
import { ActivityRow, PlanRow } from './PlatformHubs';
import { myHubContent, myHubSection, type MySection } from './myHubModel';
import './platform-hubs.css';

export type { MySection } from './myHubModel';
export interface MyHubProps {
  state: TogetherState;
  userId: string;
  userName?: string;
  plans: Journey[];
  journals: Journey[];
  onActivity: (id: string) => void;
  onPlan: (id: string) => void;
  onJournal: (id: string) => void;
  onLogin: () => void;
  onInvites: () => void;
  onTrash: () => void;
  onPersonalLibrary: () => void;
  onAccount: () => void;
  onCalendar: () => void;
  onCreateAppointment: () => void;
  onCreateTravel: () => void;
  section?: MySection;
  onSectionChange?: (section: MySection) => void;
}

/** One personal root; account, calendar and existing editors keep their own detail screens. */
export function MyHub({ state, userId, userName, plans, journals, onActivity, onPlan, onJournal, onLogin, onInvites, onTrash, onPersonalLibrary, onAccount, onCalendar, onCreateAppointment, onCreateTravel, section: suppliedSection, onSectionChange }: MyHubProps) {
  const [localSelection, setLocalSelection] = useState<{ owner: string; section: MySection }>({ owner: userId, section: 'schedule' });
  useEffect(() => { setLocalSelection({ owner: userId, section: 'schedule' }); }, [userId]);
  const section = myHubSection(suppliedSection ?? (localSelection.owner === userId ? localSelection.section : 'schedule'));
  const setSection = (value: string) => { const next = myHubSection(value); setLocalSelection({ owner: userId, section: next }); onSectionChange?.(next); };
  const member = state.members.find(item => item.id === userId);
  const authenticated = Boolean(userId && member);
  const content = myHubContent(state, userId, plans, journals);
  return <div className="platform-hub my-hub">
    <ScreenHeader title="마이" actions={<><button type="button" aria-label={authenticated ? '계정·프로필 관리' : '로그인·회원가입'} onClick={authenticated ? onAccount : onLogin}><Settings size={22}/></button><AppMenuButton/></>}/>
    <div className="my-hub-identity-wrap">{authenticated ? <button className="my-hub-identity" type="button" onClick={onAccount}><span className="my-hub-avatar" aria-hidden="true"><UserRound size={22}/></span><span><strong>{userName || member?.name || '내 계정'}</strong><small>계정·프로필 관리</small></span><ChevronRight size={18}/></button> : <div className="my-hub-guest"><span><strong>로그인하고 함께해요</strong><small>내 모임과 초대받은 일정을 이어볼 수 있어요.</small></span><button type="button" onClick={onLogin}>로그인</button></div>}</div>
    <ScreenTabs label="마이 구분" idPrefix="my-hub" value={section} onChange={setSection} items={[{ id: 'schedule', label: '내 일정', panelId: 'my-hub-panel' }, { id: 'travel', label: '내 여행', panelId: 'my-hub-panel' }, { id: 'records', label: '기록', panelId: 'my-hub-panel' }]}/>
    <div className="platform-hub-body my-hub-body" id="my-hub-panel" role="tabpanel" aria-labelledby={`my-hub-${section}`}>
      {section === 'schedule' ? <>
        <div className="my-hub-tools"><button type="button" onClick={authenticated ? onCalendar : onLogin}><CalendarDays size={18}/>캘린더</button><button type="button" onClick={onCreateAppointment}><Plus size={18}/>약속 만들기</button></div>
        {!authenticated ? <div className="my-hub-empty"><CalendarDays size={26}/><strong>모임과 약속 일정을 모아봐요</strong><p>내 여행은 로그인 없이도 이 기기의 보관함에서 확인할 수 있어요.</p><button type="button" className="my-hub-text-action" onClick={() => setSection('travel')}>이 기기의 내 여행 보기<ChevronRight size={16}/></button></div> : <>
          {content.schedule.length ? <><div className="my-hub-section-heading"><h2>다가오는 일정</h2></div><div className="platform-row-list">{content.schedule.map(item => item.type === 'activity' && item.activity ? <ActivityRow key={`activity:${item.id}`} activity={item.activity} state={state} onOpen={() => onActivity(item.id)}/> : item.plan ? <PlanRow key={`plan:${item.id}`} plan={item.plan} onOpen={() => onPlan(item.id)}/> : null)}</div></> : <div className="my-hub-empty"><CalendarDays size={26}/><strong>예정된 일정이 없어요</strong><p>모임에서 정한 약속과 날짜를 정한 개인 여행이 여기에 모여요.</p></div>}
          {content.undatedActivities.length > 0 && <><div className="my-hub-section-heading"><h2>날짜를 정할 약속</h2></div>{content.undatedActivities.map(activity => <ActivityRow key={activity.id} activity={activity} state={state} onOpen={() => onActivity(activity.id)}/>)}</>}
          <button type="button" className="my-hub-utility" onClick={onInvites}>초대·가입 신청 확인<ChevronRight size={16}/></button>
        </>}
      </> : section === 'travel' ? <>
        <div className="my-hub-section-heading"><h2>내 여행</h2><button type="button" onClick={onCreateTravel}><Plus size={16}/>여행 만들기</button></div>
        <p className="my-hub-device-note">이 기기에 저장한 개인 일정이에요. 계정·모임 일정과 자동으로 합쳐지지 않아요.</p>
        {content.ownPlans.length ? <div className="platform-row-list">{content.ownPlans.map(plan => <PlanRow key={plan.id} plan={plan} onOpen={() => onPlan(plan.id)}/>)}</div> : <div className="my-hub-empty"><FolderOpen size={26}/><strong>아직 만든 여행이 없어요</strong><p>저장한 장소를 골라 하루 동선부터 만들 수 있어요.</p><button type="button" className="outline" onClick={onCreateTravel}>여행 만들기</button></div>}
        <button type="button" className="my-hub-utility" onClick={onPersonalLibrary}>여행·여행기 전체 보관함<ChevronRight size={16}/></button>
      </> : <>
        {content.ownJournals.length ? <><div className="my-hub-section-heading"><h2>내 여행기·후기</h2></div><p className="my-hub-device-note">이 기기에 저장한 기록이에요.</p>{content.ownJournals.map(journal => <button type="button" className="platform-journal-row" key={journal.id} onClick={() => onJournal(journal.id)}><BookOpen size={24}/><span className="platform-row-copy"><strong>{journal.title}</strong><small>{journal.region} · {journal.visibility === 'PUBLIC' ? '공개' : '비공개'} · {journal.days.length} DAY</small></span><ChevronRight size={18}/></button>)}</> : <div className="my-hub-empty"><BookOpen size={26}/><strong>여행기와 후기가 여기에 남아요</strong><p>일정과 여행기는 따로 보관해요. 여행을 연 뒤 기록을 남겨보세요.</p><button type="button" className="my-hub-text-action" onClick={() => setSection('travel')}>내 여행 보기<ChevronRight size={16}/></button></div>}
        {authenticated && content.pastActivities.length > 0 && <><div className="my-hub-section-heading"><h2>지난 약속</h2></div>{content.pastActivities.map(activity => <ActivityRow key={activity.id} activity={activity} state={state} onOpen={() => onActivity(activity.id)}/>)}</>}
        {content.pastPlans.length > 0 && <><div className="my-hub-section-heading"><h2>지난 개인 여행</h2></div>{content.pastPlans.map(plan => <PlanRow key={plan.id} plan={plan} onOpen={() => onPlan(plan.id)}/>)}</>}
      </>}
      <footer className="my-hub-footer"><button type="button" onClick={onTrash}><Trash2 size={16}/>기기 휴지통</button></footer>
    </div>
  </div>;
}
