import { createContext, useContext, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Bookmark, CalendarDays, CheckSquare, ChevronRight, CircleUserRound, Compass, HelpCircle, House, LogIn, MapPin, Menu, Route, Settings, Share2, Sparkles, Users, WifiOff } from 'lucide-react';
import { BottomSheet } from './BottomSheet';
import { useAccount } from './accountContext';
import type { Journey } from './data';
import { useOfflineTrip } from './OfflineTripControl';
import './app-navigation.css';
import { primaryTabs } from './primaryNavigation';

export const AppMenuContext = createContext<(() => void) | null>(null);
export function AppMenuButton() {
  const open = useContext(AppMenuContext);
  return open ? <button type="button" className="app-menu-button" aria-label="전체 메뉴" onClick={open}><Menu size={23}/></button> : null;
}

export function AppMenu({ onClose, onNavigate, myRegionLabel }: { onClose: () => void; onNavigate: (route: string) => void; myRegionLabel?: string }) {
  const account = useAccount();
  const member = account?.session.state === 'SIGNED_IN' ? account.session.user : null;
  const [help, setHelp] = useState(false);
  const go = (route: string) => { onClose(); onNavigate(route); };
  const icons = { home: House, together: Users, travel: Route, saved: Bookmark, my: CircleUserRound };
  const tools = [
    { label: '초대·가입 신청', description: '받은 초대와 신청 상태', icon: LogIn, route: 'together-invites', group: '모임 준비' },
    { label: '내 할 일', description: '모임에서 맡은 준비 항목', icon: CheckSquare, route: 'together-tasks', group: '모임 준비' },
    { label: '내 공유 관리', description: '공유한 여행기 확인·공유 해제', icon: Share2, route: 'together-shares', group: '모임 준비' },
    { label: '여행 만들기', description: '저장 장소 또는 조건으로 계획', icon: Route, route: 'create-trip', group: '여행 도구' },
    { label: '오프라인 저장', description: '이 기기에 내려받은 내 여행', icon: WifiOff, route: 'offline', group: '여행 도구' },
    { label: '내 지역 설정', description: myRegionLabel || '주 활동 지역과 관심 지역', icon: MapPin, route: 'my-regions', group: '설정·안내' },
  ];
  return <BottomSheet title={help ? '이용 안내' : '전체 메뉴'} onClose={onClose}>
    {help ? <div className="app-menu-help">
      <p>홈에서 지역의 모임·장소를 둘러봐요. 모임에서는 가입한 모임과 새 모임을 찾고, 여행에서는 추천 일정·내 여행·여행기를 확인해요. 저장에서는 모아 둔 장소를 지역·종류별로 확인해요.</p>
      <p>마이의 내 일정에서 약속을, 내 여행에서 개인 여행·동선을, 기록에서 지난 활동과 여행기·후기를 찾아요. 모임에 가입하지 않아도 친구·가족과의 약속을 만들 수 있어요.</p>
      <p>대화는 모임과 개별 약속 안에서 이어가요. 여행 만들기에서는 저장 장소로 직접 만들거나 조건을 적어 후보를 비교해요.</p>
      <button className="outline" onClick={() => setHelp(false)}><ArrowLeft size={17}/>메뉴로 돌아가기</button>
    </div> : <>
      <button className="app-menu-account" onClick={() => member ? go('profile') : (onClose(), account?.openAccount('login'))}><CircleUserRound size={35}/><span><strong>{member ? member.displayName : '로그인하고 함께해요'}</strong><small>{member ? '계정·프로필·알림 설정' : '이메일·카카오·네이버·구글·애플'}</small></span><ChevronRight size={18}/></button>
      <nav className="app-menu-shortcuts" aria-label="주요 화면으로 이동">{primaryTabs.map(item => { const Icon = icons[item.id]; return <button type="button" key={item.id} onClick={() => go(item.id)}><Icon size={21}/><span>{item.label}</span></button>; })}</nav>
      <div className="app-menu-links">{['모임 준비','여행 도구','설정·안내'].map(group => <section key={group}><h3>{group}</h3>{tools.filter(item => item.group === group).map(({label,description,icon:Icon,route}) => <button type="button" key={route} onClick={() => go(route)}><Icon size={21}/><span><strong>{label}</strong><small>{description}</small></span><ChevronRight size={17}/></button>)}{group === '설정·안내' && <button type="button" onClick={() => setHelp(true)}><HelpCircle size={21}/><span><strong>이용 안내</strong><small>홈·모임·여행·저장·마이 사용 방법</small></span><ChevronRight size={17}/></button>}</section>)}</div>
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
