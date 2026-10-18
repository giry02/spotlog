import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { LayoutDashboard, MapPin, PanelsTopLeft, MessageSquare, Users, Sparkles, Settings, Menu, X, ChevronRight, ExternalLink, Plus, Upload, ClipboardCheck, ArrowRight } from 'lucide-react';
import type { AdminAdapter, AdminCommandInput, AdminMenu, AdminPageProps, AdminSession, AdminState } from './types';
import './admin-preview.css';
import { ADMIN_STORAGE_KEY, createApiAdminAdapter, createLocalAdminAdapter } from './repository';
import { makeAdminSeed } from './seed';
import { REVIEW_SERVICE_EVENT, REVIEW_SERVICE_KEY } from '../reviewServiceBridge';
import { publicationIssues } from './selectors';
import { AdminSelect, Badge, EmptyState, Notice, Panel } from './components';
import { regionLabel } from './regions';
import PlacesPage from './PlacesPage';
import AIPage from './AIPage';
import { CommunityPage, ExposurePage, MembersPage, SettingsPage } from './OperationsPages';

const menus = [
  { id: 'overview', label: '운영 현황', icon: LayoutDashboard },
  { id: 'places', label: '장소·업체', icon: MapPin },
  { id: 'exposure', label: '노출·추천', icon: PanelsTopLeft },
  { id: 'community', label: '여행기·커뮤니티', icon: MessageSquare },
  { id: 'members', label: '회원·문의', icon: Users },
  { id: 'ai', label: 'AI·검색 운영', icon: Sparkles },
  { id: 'settings', label: '운영 설정·이력', icon: Settings },
] as const;
const pageDescriptions: Record<AdminMenu, string> = { overview: '지역별 자료를 쌓고, 검수한 장소로 추천 여행을 만들어 보세요.', places: '지역과 담당자를 선택해 스팟·주변 업체 자료를 등록하고 검수하세요.', exposure: '추천 여행 초안을 만들고 고객에게 보여줄 콘텐츠를 골라 주세요.', community: '고객이 보는 여행기·사진·댓글의 문맥에서 신고를 처리하세요.', members: '공개 프로필과 활동 집계, 이용 상태를 확인하세요.', ai: '승인 자료와 검증한 버전으로 검색·생성을 운영하세요.', settings: '지역·권한·연결 설정과 작업 이력을 관리하세요.' };

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
    scrollPositions.current[currentMenu.current] = main.current?.scrollTop ?? 0;
    currentMenu.current = next; setMenu(next); setVisited(previous => previous.includes(next) ? previous : [...previous, next]);
    const action = requestedAction ?? (target?.startsWith('action:') ? target.slice(7) as AdminPageProps['entryAction'] : undefined);
    setPageTargets(previous => ({ ...previous, [next]: target?.startsWith('action:') ? undefined : target }));
    setEntityId(target?.startsWith('action:') ? undefined : target); setEntryAction(action); setSidebar(false); setSuccess(''); if (accessRef.current) setError('');
    requestAnimationFrame(() => { if (main.current) main.current.scrollTop = scrollPositions.current[next] ?? 0; });
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
        <div className="admin-page-heading"><p>SPOTLOG OPERATIONS</p><h1>{menus.find(item => item.id === menu)?.label}</h1><span>{pageDescriptions[menu]}</span></div>
        {previewAdapter && <section className="admin-preview-status" role="note"><div><strong>관리자 화면 미리보기</strong><p>예시 자료로 등록·수정·공개 흐름을 확인하세요. 저장한 수정은 이 탭의 예시에만 반영돼요.</p></div><a href={import.meta.env.BASE_URL + 'admin.html'}>서비스 관리자</a></section>}
        {!previewAdapter && !loading && !accessReady && <section className="admin-preview-entry"><div><h2>관리자 화면을 미리 확인해 보세요</h2><p>서버 연결 없이 예시 자료로 장소 등록, 추천 여행, 신고 처리 등 관리자 기능을 둘러볼 수 있어요.</p></div><div className="admin-preview-entry-actions"><a className="admin-preview-open" href={import.meta.env.BASE_URL + 'admin-preview.html'}>관리자 미리보기 열기 <ExternalLink size={16}/></a><a href={import.meta.env.BASE_URL + 'manual/admin/'}>사용 설명서</a></div></section>}
        {error && <div role="alert" className="admin-feedback"><Notice tone="danger">{error}</Notice></div>}
        {success && <div role="status" className="admin-feedback"><Notice tone="success">{success}</Notice></div>}
        {loading && <p role="status" className="admin-loading">관리자 자료를 불러오는 중…</p>}
        {!loading && (!props || !accessReady) && <Panel title="관리자 연결 대기"><EmptyState title="아직 관리자 자료를 불러오지 못했어요" description="인증과 자료 조회를 확인한 뒤 작업을 이어갈 수 있어요. 작성 중인 입력은 유지했어요." action={<button onClick={() => void load()}>다시 연결</button>}/></Panel>}
        {props && <div hidden={!accessReady}><ScreenBoundary key={session!.operatorId}>{visited.map(id => {
          const pageProps = { ...props, entityId: pageTargets[id], entryAction: menu === id ? entryAction : undefined, clearEntryAction: menu === id ? props.clearEntryAction : undefined };
          return <div key={id} hidden={menu !== id} className="admin-page-body">{id === 'overview' ? <OverviewPage {...pageProps}/> : id === 'places' ? <PlacesPage {...pageProps}/> : id === 'exposure' ? <ExposurePage {...pageProps}/> : id === 'community' ? <CommunityPage {...pageProps}/> : id === 'members' ? <MembersPage {...pageProps}/> : id === 'ai' ? <AIPage {...pageProps}/> : <SettingsPage {...pageProps}/>}</div>;
        })}</ScreenBoundary></div>}
      </main>
    </div>
  </div>;
}

function OverviewPage({ state, navigate, mode, session, regionId = '', setRegionId }: AdminPageProps) {
  const [scope, setScope] = useState('ALL');
  const regions = state.regions ?? [];
  const belongs = (place: AdminState['places'][number], selected: string) => {
    if (!selected) return true;
    let current = place.draft.regionId;
    const visited = new Set<string>();
    while (current && !visited.has(current)) { if (current === selected) return true; visited.add(current); current = regions.find(region => region.regionId === current)?.parentId; }
    return false;
  };
  const scoped = state.places.filter(place => belongs(place, regionId) && (scope !== 'MINE' || place.meta?.assignedToId === session.operatorId));
  const connections = state.ops.connections.filter(connection => !['팔로우', '받은 알림함'].includes(connection.name));
  const metrics = mode === 'API' && state.metrics?.source === 'SERVER' && state.metrics.observedAt ? state.metrics : null;
  const metricNames = [['members','회원'],['saves','장소 저장'],['generatedTrips','여행 생성'],['publicJournals','공개 여행기']] as const;
  const missing = scoped.filter(p => publicationIssues(p.draft).length > 0), drafts = scoped.filter(p => p.state === 'DRAFT' || p.meta?.reviewStatus === 'NEEDS_CHECK'), reports = state.ops.reports.filter(r => r.status === 'OPEN'), failedJobs = state.ai.jobs.filter(job => job.state === 'FAILED');
  const shortcuts = [
    { title: '스팟·업체 등록', description: '선택한 지역에 새 장소 추가', icon: Plus, action: () => navigate('places', 'action:create-place') },
    { title: '자료 가져오기', description: '출처를 보존해 초안으로 등록', icon: Upload, action: () => navigate('places', 'action:import') },
    { title: '검수 이어하기', description: '담당 자료·사진·위치 확인', icon: ClipboardCheck, action: () => navigate('places', undefined, scope === 'MINE' ? 'review-mine' : 'review') },
    { title: '추천 여행 만들기', description: '등록 장소로 DAY·여행기 초안', icon: Sparkles, action: () => navigate('exposure', 'action:generate') },
  ];
  const tasks = [
    { label: '장소 초안 검수', count: drafts.length, help: '원본·출처·공개 요건', action: () => navigate('places', drafts[0]?.placeId) },
    { label: '좌표·사용 범위 확인', count: missing.length, help: '좌표 검증과 자료 사용 허가', action: () => navigate('places', missing[0]?.placeId) },
    { label: '미처리 신고', count: reports.length, help: '대상·문맥과 처리 사유', action: () => navigate('community') },
    { label: '운영 정보 재확인', count: scoped.filter(p => p.draft.operation === 'CHECK' || p.draft.operation === 'TEMP_CLOSED').length, help: '영업·임시휴업 상태', action: () => navigate('places', scoped.find(p => p.draft.operation === 'CHECK' || p.draft.operation === 'TEMP_CLOSED')?.placeId) },
    { label: 'RAG 갱신 실패', count: failedJobs.length, help: '실패 항목과 정상 버전', action: () => navigate('ai', undefined, 'failed-indices') },
    { label: '알림 실패 검수', count: state.ops.notifications.filter(n => n.status === 'FAILED').length, help: '발송 실패·재시도 조건', action: () => navigate('settings', undefined, 'failed-notifications') },
    { label: '수급 실패 검수', count: state.ops.supplyJobs.filter(j => j.status === 'FAILED').length, help: '자료 가져오기·재시도 조건', action: () => navigate('settings', undefined, 'failed-supply') },
  ];
  return <div className="admin-stack">
    <Panel title="오늘의 운영 작업" description="지역 → 자료 등록·검수 → 추천 여행 → 고객 미리보기"><div className="admin-toolbar admin-work-filters"><label className="admin-field"><span>작업 지역</span><AdminSelect aria-label="운영 현황 작업 지역" value={regionId} onChange={e => setRegionId?.(e.target.value)}><option value="">전체 지역</option>{regions.filter(region => region.enabled && region.level !== 'COUNTRY').map(region => <option key={region.regionId} value={region.regionId}>{regionLabel(regions, region.regionId).replace('대한민국 · ', '')}</option>)}</AdminSelect></label><label className="admin-field"><span>담당 범위</span><AdminSelect aria-label="운영 현황 담당 범위" value={scope} onChange={e => setScope(e.target.value)}><option value="ALL">전체 담당</option><option value="MINE">내 담당 자료</option></AdminSelect></label></div><div className="admin-start-grid">{shortcuts.map(action => <button key={action.title} className="admin-start-action" onClick={action.action}><span className="admin-start-icon"><action.icon size={20}/></span><span><strong>{action.title}</strong><small>{action.description}</small></span><ArrowRight size={16}/></button>)}</div></Panel>
    <Panel title="처리할 항목"><div className="admin-task-grid">{tasks.map(task => <button key={task.label} className="admin-task" onClick={task.action}><span>{task.label}<small>{task.help}</small></span><strong>{task.count}</strong><ChevronRight size={16}/></button>)}</div></Panel>
    <Panel title="지역별 자료 현황" description="랜드마크와 주변 업체를 같은 지역 안에서 등록·검수합니다." actions={<button onClick={() => navigate('settings', undefined, 'regions')}>지역 관리</button>}><div className="admin-table-wrap"><table className="admin-table admin-region-table"><colgroup><col style={{width:"20%"}}/>{[1,2,3,4,5].map(column=><col key={column} style={{width:"16%"}}/>)}</colgroup><thead><tr><th scope="col">지역</th><th scope="col" className="admin-table-number">랜드마크</th><th scope="col" className="admin-table-number">업체</th><th scope="col" className="admin-table-number">검수 대기</th><th scope="col" className="admin-table-number">공개</th><th scope="col" className="admin-table-action">작업</th></tr></thead><tbody>{regions.filter(region => region.enabled && (regionId ? region.regionId === regionId : region.level === 'PROVINCE')).map(region => { const places = scoped.filter(place => belongs(place, region.regionId)); return <tr key={region.regionId}><td>{region.name}</td><td className="admin-table-number">{places.filter(place => place.draft.kind === 'LANDMARK').length}</td><td className="admin-table-number">{places.filter(place => place.draft.kind !== 'LANDMARK').length}</td><td className="admin-table-number">{places.filter(place => place.state === 'DRAFT').length}</td><td className="admin-table-number">{places.filter(place => place.state === 'PUBLISHED' && !place.revoked).length}</td><td className="admin-table-action"><button onClick={() => { setRegionId?.(region.regionId); navigate('places'); }}>{region.name} 자료 보기</button></td></tr>; })}</tbody></table>{!regions.length && <EmptyState title="지역 자료를 불러오지 못했어요" action={<button onClick={() => navigate('settings', undefined, 'regions')}>지역 기준 확인</button>}/>}</div></Panel>
    {metrics && <Panel title="실제 서비스 집계" description={'서버 집계 기준 시각: ' + new Date(metrics.observedAt!).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}><div className="admin-metrics">{metricNames.map(([key,label]) => <article key={key}><span>{label}</span><strong>{metrics[key]?.toLocaleString('ko-KR') ?? '—'}</strong><Badge>{metrics[key] !== null && metrics[key] !== undefined ? '서버 집계' : '집계 미제공'}</Badge></article>)}</div></Panel>}
    <div className="admin-health-summary">{mode === 'API' && <span>{`연결 확인 ${connections.filter(connection => connection.status === 'CONNECTED').length} · 장애 ${connections.filter(connection => connection.status === 'FAILED' || connection.status === 'DEGRADED').length}`}</span>}<button onClick={() => navigate('settings', 'action:connections')}>연결 설정 확인 <ChevronRight size={14}/></button></div>
  </div>;
}
