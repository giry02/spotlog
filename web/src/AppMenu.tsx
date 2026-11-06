import { createContext, useContext, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Bookmark, CalendarDays, CheckSquare, ChevronRight, CircleUserRound, Compass, HelpCircle, LogIn, MapPin, Menu, Route, Settings, Share2, Sparkles, Users, WifiOff } from 'lucide-react';
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

export function AppMenu({ onClose, onNavigate, myRegionLabel }: { onClose: () => void; onNavigate: (route: string) => void; myRegionLabel?: string }) {
  const account = useAccount();
  const member = account?.session.state === 'SIGNED_IN' ? account.session.user : null;
  const [help, setHelp] = useState(false);
  const go = (route: string) => { onClose(); onNavigate(route); };
  const links = [
    { label: '발견', description: '지역의 공개 약속·모임·장소', icon: Compass, route: 'home' },
    { label: '약속', description: '친구·가족·모임의 다음 만남', icon: CalendarDays, route: 'appointments' },
    { label: '내 모임', description: '가입한 모임과 전체 대화', icon: Users, route: 'together' },
    { label: '새 모임 찾기', description: '지역·관심사로 모임 가입하기', icon: Compass, route: 'together-find' },
    { label: '초대·가입 신청', description: '받은 초대와 신청 상태', icon: LogIn, route: 'together-invites' },
    { label: '전체 캘린더', description: '모임의 약속과 여행 일정', icon: CalendarDays, route: 'together-calendar' },
    { label: '내 할 일', description: '모임에서 맡은 준비 항목', icon: CheckSquare, route: 'together-tasks' },
    { label: '내 공유 관리', description: '모임에 공유한 여행기와 공유 해제', icon: Share2, route: 'together-shares' },
    { label: '저장 장소', description: '지역별로 모아 둔 장소', icon: Bookmark, route: 'saved' },
    { label: '내 기록', description: '지난 약속과 사진·여행기', icon: BookOpen, route: 'records' },
    { label: '개인 여행 보관함', description: '기존 개인 일정과 여행기 전체', icon: Route, route: 'trips' },
    { label: '여행기 둘러보기', description: '다른 사람이 공개한 동선·기록', icon: BookOpen, route: 'community' },
    { label: '추천 여행 일정', description: '공개 코스를 내 일정으로 담기', icon: Route, route: 'recommended-trips' },
    { label: '여행 만들기', description: '저장한 장소로 개인 일정 만들기', icon: CalendarDays, route: 'create-trip' },
    { label: '여행 계획 만들기', description: '여행 조건 입력과 초안 확인', icon: Sparkles, route: 'ai-trip' },
    { label: '오프라인 저장', description: '이 기기에 내려받은 내 여행', icon: WifiOff, route: 'offline' },
    { label: '프로필·알림 설정', description: '계정과 이용 설정', icon: Settings, route: 'profile' },
    { label: '내 지역 설정', description: myRegionLabel || '주 활동 지역과 관심 지역', icon: MapPin, route: 'my-regions' },
  ];
  const primaryRoutes = ['home', 'appointments', 'together', 'saved', 'records'];
  const travelRoutes = ['trips', 'community', 'recommended-trips', 'create-trip', 'ai-trip'];
  const renderLink = ({ label, description, icon: Icon, route }: typeof links[number]) => <button type="button" key={route} onClick={() => go(route)}><Icon size={21}/><span><strong>{label}</strong><small>{description}</small></span><ChevronRight size={17}/></button>;
  return <BottomSheet title={help ? '이용 안내' : '전체 메뉴'} onClose={onClose}>
    {help ? <div className="app-menu-help"><p>발견에서 지역의 공개 약속과 모임·장소를 둘러봐요. 저장 장소에서는 내가 저장한 곳을 지역·종류별로 찾아요.</p><p>약속에서는 친구·가족과 만날 일을 바로 만들어요. 계속 함께할 모임은 별도로 만들거나 가입해요. 모임 전체 이야기는 모임의 ‘대화’, 이번 약속의 준비는 약속 안의 ‘준비’와 ‘대화’에서 이어가요.</p><p>지난 약속은 내 기록에 남아요. 기존 개인 여행·여행기는 개인 여행 보관함에서도 볼 수 있어요. 개인 여행을 모임에 담아도 원래 여행은 그대로 남고, 공유할 내용은 직접 선택해요.</p><button className="outline" onClick={() => setHelp(false)}><ArrowLeft size={17}/>메뉴로 돌아가기</button></div> : <>
      <button className="app-menu-account" onClick={() => member ? go('profile') : (onClose(), account?.openAccount('login'))}><CircleUserRound size={35}/><span><strong>{member ? member.displayName : '로그인하고 함께해요'}</strong><small>{member ? '내 프로필·계정 관리' : '이메일·카카오·네이버·구글·애플'}</small></span><ChevronRight size={18}/></button>
      <nav className="app-menu-shortcuts" aria-label="주요 화면으로 이동">{primaryRoutes.map(route => { const item = links.find(item => item.route === route)!; const Icon = item.icon; return <button type="button" key={route} onClick={() => go(route)}><Icon size={21}/><span>{({home:'발견',appointments:'약속',together:'모임',saved:'저장 장소',records:'내 기록'} as Record<string,string>)[route]}</span></button>; })}</nav>
      <div className="app-menu-links"><h3>함께 준비하기</h3>{links.filter(item => !primaryRoutes.includes(item.route) && !travelRoutes.includes(item.route) && !['offline','profile','my-regions'].includes(item.route)).map(renderLink)}
        <details className="app-menu-travel"><summary><Route size={21}/><strong>개인 여행·동선 도구</strong><ChevronRight size={17}/></summary>{links.filter(item => travelRoutes.includes(item.route)).map(renderLink)}</details>
        <h3>기기·계정</h3>{links.filter(item => ['offline','profile','my-regions'].includes(item.route)).map(renderLink)}<button onClick={() => setHelp(true)}><HelpCircle size={21}/><span><strong>이용 안내</strong><small>장소·약속·모임 사용 방법</small></span><ChevronRight size={17}/></button></div>
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
