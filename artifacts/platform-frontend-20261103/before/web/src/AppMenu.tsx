import { createContext, useContext, useState } from 'react';
import { ArrowLeft, ArrowRight, Bookmark, CalendarDays, CheckSquare, ChevronRight, CircleUserRound, HelpCircle, LogIn, Menu, Settings, Share2, Users, WifiOff } from 'lucide-react';
import { BottomSheet } from './BottomSheet';
import { useAccount } from './accountContext';
import type { Journey } from './data';
import { useOfflineTrip } from './OfflineTripControl';
import './app-navigation.css';

export const AppMenuContext = createContext<(() => void) | null>(null);
export function AppMenuButton() {
  const open = useContext(AppMenuContext);
  return open ? <button type="button" className="app-menu-button" aria-label="전체 메뉴" onClick={open}><Menu size={23}/></button> : null;
}

export function AppMenu({ onClose, onNavigate }: { onClose: () => void; onNavigate: (route: string) => void }) {
  const account = useAccount();
  const member = account?.session.state === 'SIGNED_IN' ? account.session.user : null;
  const [help, setHelp] = useState(false);
  const go = (route: string) => { onClose(); onNavigate(route); };
  const links = [
    { label: '함께하기', description: '내 모임과 새로운 만남', icon: Users, route: 'together' },
    { label: '초대·가입 신청', description: '받은 초대와 신청 상태', icon: LogIn, route: 'together-invites' },
    { label: '전체 캘린더', description: '내 모임의 번개·정모 일정', icon: CalendarDays, route: 'together-calendar' },
    { label: '내 할 일', description: '모임에서 맡은 준비 항목', icon: CheckSquare, route: 'together-tasks' },
    { label: '내 공유 관리', description: '모임에 공유한 여행기와 공유 해제', icon: Share2, route: 'together-shares' },
    { label: '관심 장소', description: '지역별로 모아 둔 장소', icon: Bookmark, route: 'saved' },
    { label: '오프라인 저장', description: '이 기기에 내려받은 내 여행', icon: WifiOff, route: 'offline' },
    { label: '프로필·알림 설정', description: '계정과 이용 설정', icon: Settings, route: 'profile' },
  ];
  return <BottomSheet title={help ? '이용 안내' : '전체 메뉴'} onClose={onClose}>
    {help ? <div className="app-menu-help"><p>관심 장소에서 가고 싶은 곳을 모으고, 내 여행에서 나만의 일정을 만들어요.</p><p>함께하기에서는 모임을 만들거나 가입할 수 있어요. 모임 전체 대화는 ‘전체 채팅’, 번개·정모에 관한 이야기는 해당 모임의 ‘준비’와 ‘이 모임 채팅’에서 이어가세요.</p><p>개인 여행을 모임에 담아도 원래 여행은 그대로 남아요. 사진·후기는 공유할 내용을 직접 선택해요.</p><button className="outline" onClick={() => setHelp(false)}><ArrowLeft size={17}/>메뉴로 돌아가기</button></div> : <>
      <button className="app-menu-account" onClick={() => member ? go('profile') : (onClose(), account?.openAccount('login'))}><CircleUserRound size={35}/><span><strong>{member ? member.displayName : '로그인하고 함께해요'}</strong><small>{member ? '내 프로필·계정 관리' : '이메일·카카오·네이버·구글·애플'}</small></span><ChevronRight size={18}/></button>
      <div className="app-menu-links">{links.map(({ label, description, icon: Icon, route }) => <button key={route} onClick={() => go(route)}><Icon size={21}/><span><strong>{label}</strong><small>{description}</small></span><ChevronRight size={17}/></button>)}<button onClick={() => setHelp(true)}><HelpCircle size={21}/><span><strong>이용 안내</strong><small>장소·여행·모임 사용 방법</small></span><ChevronRight size={17}/></button></div>
    </>}
  </BottomSheet>;
}

function OfflineItem({ journey, onOpen }: { journey: Journey; onOpen: (id: string) => void }) {
  const { status } = useOfflineTrip(journey);
  if (!status || !['saved', 'stale'].includes(status.state)) return null;
  return <button className="offline-library-item" onClick={() => onOpen(journey.id)}><WifiOff size={23}/><span><strong>{journey.title}</strong><small>{status.state === 'stale' ? '일정 변경됨 · 업데이트 필요' : '오프라인 저장됨'}</small></span><ChevronRight size={18}/></button>;
}
export function OfflineLibrary({ journeys, onBack, onOpen }: { journeys: Journey[]; onBack: () => void; onOpen: (id: string) => void }) {
  return <div className="page offline-library-page"><header className="utility-page-header"><button onClick={onBack} aria-label="뒤로"><ArrowLeft size={22}/></button><h1>오프라인 저장</h1></header><p>이 기기에 내려받은 개인 여행을 볼 수 있어요. 최신 업체 정보와 네이버 길찾기는 인터넷 연결이 필요해요.</p><div className="offline-library-items">{journeys.map(journey => <OfflineItem key={journey.id} journey={journey} onOpen={onOpen}/>)}</div><div className="offline-library-guide"><WifiOff size={26}/><h2>여행 상세에서 저장해요</h2><p>내 여행을 열고 ‘오프라인 저장’을 누르면 일정·주소·저장 가능한 사진을 내려받아요.</p><button className="outline" onClick={onBack}>돌아가기<ArrowRight size={17}/></button></div></div>;
}
