import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { LayoutDashboard, MapPin, PanelsTopLeft, MessageSquare, Users, Sparkles, Settings, Menu, X, ChevronRight, ExternalLink } from 'lucide-react';
import type { AdminAdapter, AdminCommandInput, AdminMenu, AdminPageProps, AdminSession, AdminState } from './types';
import './admin-preview.css';
import { ADMIN_STORAGE_KEY, createApiAdminAdapter, createLocalAdminAdapter } from './repository';
import { makeAdminSeed } from './seed';
import { REVIEW_SERVICE_EVENT, REVIEW_SERVICE_KEY } from '../reviewServiceBridge';
import { AdminSelect, Badge, EmptyState, Notice, Panel, Tabs } from './components';
import PlacesPage from './PlacesPage';
import AIPage from './AIPage';
import { CommunityPage, ExposurePage, MembersPage, RegionManager, SettingsPage } from './OperationsPages';
import OverviewPage from './AdminOverview';

const menus = [
  { id: 'overview', label: '운영 현황', icon: LayoutDashboard },
  { id: 'places', label: '장소·업체', icon: MapPin },
  { id: 'exposure', label: '노출·추천', icon: PanelsTopLeft },
  { id: 'community', label: '여행기·커뮤니티', icon: MessageSquare },
  { id: 'members', label: '회원·문의', icon: Users },
  { id: 'ai', label: 'AI·검색 운영', icon: Sparkles },
  { id: 'settings', label: '운영 설정·이력', icon: Settings },
] as const;
const pageDescriptions: Record<AdminMenu, string> = { overview: '지역을 선택하고 등록·검수·추천 여행 작업을 시작하세요.', places: '지역별 장소와 업체를 등록하고, 확인한 자료를 공개하세요.', exposure: '추천 여행을 만들고 공개한 콘텐츠를 메인 화면에 배치하세요.', community: '공개 여행기·댓글을 확인하고 신고를 처리하세요.', members: '회원 상태와 문의를 확인하세요.', ai: '검색에 반영된 정보와 추천 결과를 확인하세요.', settings: '운영자·분류·연결 설정과 변경 이력을 관리하세요.' };

class ScreenBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <Notice tone="danger">화면 자료를 읽지 못했어요. 입력을 지우지 않고 중단했습니다. 새로고침 후 다시 확인해 주세요.</Notice> : this.props.children; }
}

export default function AdminApp({ previewAdapter }: { previewAdapter?: AdminAdapter } = {}) {
  const [accessReady, setAccessReady] = useState(false), accessRef = useRef(false);
  const [error, setError] = useState(''), [success, setSuccess] = useState('');
  const setAccess = useCallback((ready: boolean) => { accessRef.current = ready; setAccessReady(ready); }, []);
  const adapter = useMemo(() => previewAdapter ?? (import.meta.env.DEV && new URLSearchParams(location.search).get('mode') !== 'api' ? createLocalAdminAdapter(localStorage, makeAdminSeed) : createApiAdminAdapter(() => { setAccess(false); setSuccess(''); setError('관리자 인증과 접근 권한을 다시 확인해 주세요. 입력은 유지했어요.'); })), [setAccess, previewAdapter]);
  const [session, setSession] = useState<AdminSession | null>(null), [state, setState] = useState<AdminState | null>(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState<AdminMenu>('overview'), [entityId, setEntityId] = useState<string | undefined>(), [sidebar, setSidebar] = useState(false);
  const [regionId, setRegionId] = useState('');
  const [entryAction, setEntryAction] = useState<AdminPageProps['entryAction']>();
  const [pageTargets, setPageTargets] = useState<Partial<Record<AdminMenu, string | undefined>>>({});
  const [visited, setVisited] = useState<AdminMenu[]>(['overview']);
  const [compact,setCompact] = useState(() => window.matchMedia('(max-width:1100px)').matches);
  const stateRef = useRef(state), running = useRef(false), scrollPositions = useRef<Partial<Record<AdminMenu, number>>>({}), currentMenu = useRef(menu);
  const main = useRef<HTMLElement>(null);
  const placeListScrollTop = useRef(0);
  const sidebarPanel = useRef<HTMLElement>(null), menuOpener = useRef<HTMLButtonElement>(null);
  const acceptState = useCallback((next: AdminState) => { stateRef.current = next; setState(next); }, []);
  const load = useCallback(async () => {
    setLoading(true); setError(''); setSuccess('');
    if (adapter.mode === 'API') setAccess(false);
    try { const account = await adapter.session(); const snapshot = await adapter.load(); setSession(previous => adapter.mode === 'LOCAL' && previous && snapshot.ops.operators.some(operator => operator.operatorId === previous.operatorId && operator.active) ? previous : account); acceptState(snapshot); setAccess(true); }
    catch (failure) { setError(failure instanceof Error ? failure.message : '관리자 연결을 확인해 주세요.'); }
    finally { setLoading(false); }
  }, [adapter, acceptState, setAccess]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const media=window.matchMedia('(max-width:1100px)'); const changed=()=>{setCompact(media.matches); if(!media.matches)setSidebar(false);}; media.addEventListener('change',changed); return()=>media.removeEventListener('change',changed); },[]);
  useEffect(() => {
    if (!compact || !sidebar) return;
    const focusable = () => Array.from(sidebarPanel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]') ?? []).filter(element => element.getClientRects().length);
    focusable()[0]?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setSidebar(false); }
      if (event.key === 'Tab') { const items = focusable(), index = items.indexOf(document.activeElement as HTMLElement); if (!items.length) return; if (event.shiftKey && index <= 0) { event.preventDefault(); items.at(-1)?.focus(); } else if (!event.shiftKey && (index < 0 || index === items.length - 1)) { event.preventDefault(); items[0].focus(); } }
    };
    document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('keydown', keyboard); if (menuOpener.current?.getClientRects().length) menuOpener.current.focus(); };
  }, [compact, sidebar]);
  useEffect(() => {
    if (adapter.mode !== 'LOCAL' || previewAdapter) return;
    const refresh = () => { void adapter.load().then(acceptState).catch(failure => setError((failure as Error).message)); };
    const sync = (event: StorageEvent) => { if (event.key === ADMIN_STORAGE_KEY || event.key === REVIEW_SERVICE_KEY) refresh(); };
    window.addEventListener('storage', sync); window.addEventListener(REVIEW_SERVICE_EVENT, refresh);
    return () => { window.removeEventListener('storage', sync); window.removeEventListener(REVIEW_SERVICE_EVENT, refresh); };
  }, [adapter, acceptState, previewAdapter]);
  useEffect(() => { if (!success) return; const timer = setTimeout(() => setSuccess(''), 6000); return () => clearTimeout(timer); }, [success]);
  const navigate = (next: AdminMenu, target?: string, requestedAction?: AdminPageProps['entryAction']) => {
    if (currentMenu.current === 'places' && !pageTargets.places) placeListScrollTop.current = main.current?.scrollTop ?? 0;
    scrollPositions.current[currentMenu.current] = main.current?.scrollTop ?? 0;
    currentMenu.current = next; setMenu(next); setVisited(previous => previous.includes(next) ? previous : [...previous, next]);
    const action = requestedAction ?? (target?.startsWith('action:') ? target.slice(7) as AdminPageProps['entryAction'] : undefined);
    setPageTargets(previous => ({ ...previous, [next]: target?.startsWith('action:') ? undefined : target }));
    setEntityId(target?.startsWith('action:') ? undefined : target); setEntryAction(action); setSidebar(false); setSuccess(''); if (accessRef.current) setError('');
    requestAnimationFrame(() => { if (main.current) main.current.scrollTop = next === 'places' && !target ? placeListScrollTop.current : scrollPositions.current[next] ?? 0; });
  };
  const run = async (input: AdminCommandInput): Promise<boolean> => {
    if (running.current || loading || !accessRef.current || !session || !stateRef.current) return false;
    running.current = true; setBusy(true); setError(''); setSuccess('');
    try {
      const result = await adapter.execute({ ...input, expectedRevision: stateRef.current.revision, idempotencyKey: crypto.randomUUID() }, session);
      acceptState(result.state); setSuccess(result.message); return true;
    } catch (failure) {
      const issue = failure as Error & { code?: string }; setError(issue.message || '처리하지 못했어요. 입력을 유지했어요.');
      if (issue.code === 'CONFLICT' || issue.code === '409' || issue.code === 'REVISION_CONFLICT') try { acceptState(await adapter.load()); } catch { /* preserve input and original error */ }
      return false;
    } finally { running.current = false; setBusy(false); }
  };
  const props: AdminPageProps | null = state && session ? { state, session, run, navigate, busy: busy || loading || !accessReady, mode: adapter.mode, adapter, entityId, entryAction, clearEntryAction: () => setEntryAction(undefined), regionId, setRegionId } : null;
  return <div className="admin-app">
    <a href="#admin-main" className="admin-skip">본문으로 이동</a>
    {sidebar && <button className="admin-backdrop" aria-label="메뉴 닫기" onClick={() => setSidebar(false)}/>}
    <aside id="admin-navigation" ref={sidebarPanel} className={'admin-sidebar ' + (sidebar ? 'open' : '')} role={compact ? 'dialog' : undefined} aria-label={compact ? '관리자 메뉴' : undefined} aria-modal={compact && sidebar ? true : undefined} inert={compact && !sidebar} aria-hidden={compact && !sidebar ? true : undefined}>
      <div className="admin-brand"><strong>spotlog<span>관리자</span></strong><button className="admin-icon-button admin-mobile-only" aria-label="메뉴 닫기" onClick={() => setSidebar(false)}><X size={20}/></button></div>
      <p className="admin-sidebar-caption">자료 등록부터 운영까지</p>
      <nav aria-label="관리자 메뉴">{menus.map(item => <button key={item.id} aria-current={menu === item.id ? 'page' : undefined} onClick={() => navigate(item.id)}><item.icon size={19}/><span>{item.label}</span>{menu === item.id && <ChevronRight size={15}/>}</button>)}</nav>
      <div className="admin-sidebar-footer"><Badge tone={adapter.mode === 'LOCAL' ? 'warning' : 'info'}>{previewAdapter ? '미리보기' : adapter.mode === 'LOCAL' ? '로컬' : '서비스'}</Badge><a href={import.meta.env.BASE_URL} target="_blank" rel="noreferrer">고객 화면 열기 <ExternalLink size={14}/></a></div>
    </aside>
    <div className="admin-workspace" inert={compact && sidebar}>
      <header className="admin-topbar">
        <div className="admin-actions"><button ref={menuOpener} className="admin-icon-button admin-mobile-only" aria-label="관리자 메뉴 열기" aria-expanded={sidebar} aria-controls="admin-navigation" onClick={() => setSidebar(true)}><Menu size={20}/></button><span>운영 콘솔</span></div>
        <div className="admin-actions">
          {session && accessReady && <>
            {adapter.mode === 'LOCAL' && state ? <AdminSelect aria-label="작업자" value={session.operatorId} onChange={e => { const operator = state.ops.operators.find(item => item.operatorId === e.target.value && item.active); if (operator) setSession({ operatorId: operator.operatorId, name: operator.name, role: operator.role }); }} disabled={busy}>{state.ops.operators.filter(operator => operator.active).map(operator => <option key={operator.operatorId} value={operator.operatorId}>{operator.name}</option>)}</AdminSelect> : <span className="admin-topbar-name">{session.name}</span>}
            {adapter.mode === 'LOCAL' ? <AdminSelect aria-label="역할 전환" value={session.role} onChange={e => setSession({ ...session, role: e.target.value as AdminSession['role'] })} disabled={busy}><option value="ADMIN">최고관리자</option><option value="OPERATOR">운영자</option></AdminSelect> : <Badge>{session.role === 'ADMIN' ? '최고관리자' : '운영자'}</Badge>}
          </>}
          <button disabled={busy || loading} onClick={() => void load()}>새로 조회</button>
        </div>
      </header>
      <main id="admin-main" ref={main} className="admin-main" tabIndex={-1}>
        <div className="admin-page-heading"><h1>{menus.find(item => item.id === menu)?.label}</h1><span>{pageDescriptions[menu]}</span></div>
        {previewAdapter && <section className="admin-preview-status" role="note"><div><strong>관리자 화면 미리보기</strong><p>예시 자료로 등록·수정·공개 흐름을 확인하세요. 저장한 수정은 이 탭의 예시에만 반영돼요.</p></div><a href={import.meta.env.BASE_URL + 'admin.html'}>서비스 관리자</a></section>}
        {!previewAdapter && !loading && !accessReady && <section className="admin-preview-entry"><div><h2>관리자 화면을 미리 확인해 보세요</h2><p>서버 연결 없이 예시 자료로 장소 등록, 추천 여행, 신고 처리 등 관리자 기능을 둘러볼 수 있어요.</p></div><div className="admin-preview-entry-actions"><a className="admin-preview-open" href={import.meta.env.BASE_URL + 'admin-preview.html'}>관리자 미리보기 열기 <ExternalLink size={16}/></a><a href={import.meta.env.BASE_URL + 'manual/admin/'}>사용 설명서</a></div></section>}
        {error && <div role="alert" className="admin-feedback"><Notice tone="danger">{error}</Notice></div>}
        {success && <div role="status" className="admin-feedback"><Notice tone="success">{success}</Notice></div>}
        {loading && <p role="status" className="admin-loading">관리자 자료를 불러오는 중…</p>}
        {!loading && (!props || !accessReady) && <Panel title="관리자 연결 대기"><EmptyState title="아직 관리자 자료를 불러오지 못했어요" description="인증과 자료 조회를 확인한 뒤 작업을 이어갈 수 있어요. 작성 중인 입력은 유지했어요." action={<button onClick={() => void load()}>다시 연결</button>}/></Panel>}
        {props && <div hidden={!accessReady}><ScreenBoundary key={session!.operatorId}>{visited.map(id => {
          const pageProps = { ...props, entityId: pageTargets[id], entryAction: menu === id ? entryAction : undefined, clearEntryAction: menu === id ? props.clearEntryAction : undefined };
          return <div key={id} hidden={menu !== id} className="admin-page-body">{id === 'overview' ? <OverviewPage {...pageProps}/> : id === 'places' ? <PlacesWorkspace {...pageProps}/> : id === 'exposure' ? <ExposurePage {...pageProps}/> : id === 'community' ? <CommunityPage {...pageProps}/> : id === 'members' ? <MembersPage {...pageProps}/> : id === 'ai' ? <AIPage {...pageProps}/> : <SettingsPage {...pageProps}/>}</div>;
        })}</ScreenBoundary></div>}
      </main>
    </div>
  </div>;
}

function PlacesWorkspace(props: AdminPageProps) {
  const [view, setView] = useState('places');
  useEffect(() => {
    if (props.entryAction === 'regions') { setView('regions'); props.clearEntryAction?.(); }
    else if (props.entryAction === 'place-list') setView('places');
    else if (props.entryAction || props.entityId) setView('places');
  }, [props.entryAction, props.entityId]);
  return <div className="admin-places-workspace"><Tabs items={[{ id: 'places', label: '장소 목록' }, { id: 'regions', label: '지역 설정' }]} value={view} onChange={setView}/><div hidden={view !== 'places'}><PlacesPage {...props}/></div><div hidden={view !== 'regions'}><RegionManager {...props}/></div></div>;
}
