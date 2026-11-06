import { ArrowRight, ClipboardCheck, Plus, Sparkles, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AdminPageProps } from './types';
import { matchesPlaceFilters, publicationIssues } from './selectors';
import { AdminSelect, Badge, EmptyState, Panel, kindLabel } from './components';
import { regionLabel } from './regions';
import './admin-workflow.css';

export default function AdminOverview({ state, navigate, mode, session, regionId = '', setRegionId }: AdminPageProps) {
  const [scope, setScope] = useState(session.role === 'ADMIN' ? 'ALL' : 'MINE');
  useEffect(() => setScope(session.role === 'ADMIN' ? 'ALL' : 'MINE'), [session.operatorId, session.role]);
  const regions = state.regions ?? [];
  const scoped = state.places.filter(place => matchesPlaceFilters(place, state, { regionId, assignedToId: scope === 'MINE' ? session.operatorId : '' }));
  const drafts = scoped.filter(place => place.state === 'DRAFT');
  const unfinished = scoped.filter(place => place.state !== 'INACTIVE' && (place.state === 'DRAFT' || place.meta?.reviewStatus === 'NEEDS_CHECK' || place.published && JSON.stringify(place.draft) !== JSON.stringify(place.published)))
    .sort((a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0)).slice(0, 5);
  const reports = state.ops.reports.filter(report => report.status === 'OPEN');
  const connectionProblems = state.ops.connections.filter(connection => ['FAILED', 'DEGRADED'].includes(connection.status));
  const shortcuts = [
    { title: '장소 등록', description: '랜드마크·식당·카페·숙소 추가', icon: Plus, action: () => navigate('places', undefined, 'create-place') },
    { title: '검수하기', description: `${scope === 'MINE' ? '내 담당 ' : ''}공개 전 초안 ${drafts.length}개 확인`, icon: ClipboardCheck, action: () => navigate('places', undefined, scope === 'MINE' ? 'review-mine' : 'review') },
    { title: '추천 여행 만들기', description: '등록한 장소로 여행 구성', icon: Sparkles, action: () => navigate('exposure', undefined, 'generate') },
  ];
  return <div className="admin-stack admin-overview-simple">
    <Panel title="어떤 작업을 할까요?">
      <div className="admin-toolbar admin-work-filters">
        <div className="admin-field"><label htmlFor="admin-work-region">작업 지역</label><AdminSelect id="admin-work-region" aria-label="운영 현황 작업 지역" value={regionId} onChange={event => setRegionId?.(event.target.value)}><option value="">전체 지역</option>{regions.filter(region => region.enabled && region.level !== 'COUNTRY').map(region => <option key={region.regionId} value={region.regionId}>{regionLabel(regions, region.regionId).replace('대한민국 · ', '')}</option>)}</AdminSelect></div>
        <div className="admin-field"><label htmlFor="admin-work-scope">담당 범위</label><AdminSelect id="admin-work-scope" aria-label="운영 현황 담당 범위" value={scope} onChange={event => setScope(event.target.value)}><option value="MINE">내 담당 자료</option><option value="ALL">전체 담당</option></AdminSelect></div>
      </div>
      <div className="admin-start-grid admin-primary-work">{shortcuts.map(action => <button key={action.title} className="admin-start-action" onClick={action.action}><span className="admin-start-icon"><action.icon size={20}/></span><span><strong>{action.title}</strong><small>{action.description}</small></span><ArrowRight size={16}/></button>)}</div>
      <div className="admin-work-secondary"><button onClick={() => navigate('places', undefined, 'import')}><Upload size={16}/>자료 가져오기</button><button onClick={() => navigate('places', undefined, 'regions')}>지역 설정</button></div>
    </Panel>
    <Panel title="이어서 확인할 자료" description={`${regionLabel(regions, regionId)} · ${scope === 'MINE' ? '내 담당' : '전체 담당'}`} actions={<button onClick={() => navigate('places', undefined, scope === 'MINE' ? 'review-mine' : 'review')}>초안 전체 보기</button>}>
      {unfinished.length ? <div className="admin-work-list">{unfinished.map(place => <button key={place.placeId} onClick={() => navigate('places', place.placeId)}><span><strong>{place.draft.name || '이름을 입력해 주세요'}</strong><small>{kindLabel[place.draft.kind]} · {place.draft.area || regionLabel(regions, place.draft.regionId ?? '')}{publicationIssues(place.draft).length ? ' · 공개 전 확인 필요' : ' · 공개 준비 완료'}</small></span><Badge>{place.state === 'DRAFT' ? '미공개 초안' : JSON.stringify(place.draft) !== JSON.stringify(place.published) ? '공개본 수정 중' : '공개 정보 재확인'}</Badge><ArrowRight size={16}/></button>)}</div> : <EmptyState title={scope === 'MINE' ? '내 담당 자료에 진행 중인 작업이 없어요' : '진행 중인 장소 작업이 없어요'} action={scope === 'MINE' ? <button onClick={() => setScope('ALL')}>전체 담당 자료 보기</button> : <button onClick={() => navigate('places', undefined, 'create-place')}>장소 등록</button>}/>}
    </Panel>
    {reports.length > 0 && <button className="admin-report-summary" onClick={() => navigate('community')}><span><strong>미처리 신고 {reports.length}건</strong><small>서비스 전체 · 내용을 확인하고 처리</small></span><ArrowRight size={18}/></button>}
    <details className="admin-more-operations"><summary>전체 현황·연결 관리{connectionProblems.length ? ` · 연결 문제 ${connectionProblems.length}건` : ''}</summary><div className="admin-stack">
      <Panel title="지역별 자료 현황" actions={<button onClick={() => navigate('places', undefined, 'regions')}>지역 관리</button>}><div className="admin-table-wrap"><table className="admin-table admin-region-table"><colgroup><col style={{ width: '20%' }}/>{[1, 2, 3, 4, 5].map(column => <col key={column} style={{ width: '16%' }}/>)}</colgroup><thead><tr><th>지역</th><th className="admin-table-number">랜드마크</th><th className="admin-table-number">업체</th><th className="admin-table-number">미공개 초안</th><th className="admin-table-number">공개</th><th className="admin-table-action">작업</th></tr></thead><tbody>{regions.filter(region => region.enabled && (regionId ? region.regionId === regionId : region.level === 'PROVINCE')).map(region => { const places = scoped.filter(place => matchesPlaceFilters(place, state, { regionId: region.regionId })); return <tr key={region.regionId}><td>{region.name}</td><td className="admin-table-number">{places.filter(place => place.draft.kind === 'LANDMARK').length}</td><td className="admin-table-number">{places.filter(place => place.draft.kind !== 'LANDMARK').length}</td><td className="admin-table-number">{places.filter(place => place.state === 'DRAFT').length}</td><td className="admin-table-number">{places.filter(place => place.state === 'PUBLISHED' && !place.revoked).length}</td><td className="admin-table-action"><button onClick={() => { setRegionId?.(region.regionId); navigate('places', undefined, 'place-list'); }}>{region.name} 자료 보기</button></td></tr>; })}</tbody></table></div></Panel>
      <Panel title="관리할 항목"><div className="admin-task-grid">
        <button className="admin-task" onClick={() => navigate('places', scoped.find(place => ['CHECK', 'TEMP_CLOSED'].includes(place.draft.operation))?.placeId)}><span>운영 정보 확인<small>영업·임시휴업 상태</small></span><strong>{scoped.filter(place => ['CHECK', 'TEMP_CLOSED'].includes(place.draft.operation)).length}</strong></button>
        <button className="admin-task" onClick={() => navigate('ai', undefined, 'failed-indices')}><span>검색 반영 오류<small>자료 반영·재시도 확인</small></span><strong>{state.ai.jobs.filter(job => job.state === 'FAILED').length}</strong></button>
        <button className="admin-task" onClick={() => navigate('settings', undefined, 'failed-notifications')}><span>알림 발송 오류<small>실패 내용·재시도 확인</small></span><strong>{state.ops.notifications.filter(item => item.status === 'FAILED').length}</strong></button>
        <button className="admin-task" onClick={() => navigate('settings', undefined, 'failed-supply')}><span>자료 가져오기 오류<small>실패한 가져오기 확인</small></span><strong>{state.ops.supplyJobs.filter(job => job.status === 'FAILED').length}</strong></button>
      </div><button onClick={() => navigate('settings', undefined, 'connections')}>연결 설정 확인</button></Panel>
      {mode === 'API' && state.metrics?.source === 'SERVER' && state.metrics.observedAt && <Panel title="실제 서비스 집계"><div className="admin-metrics">{([['members', '회원'], ['saves', '장소 저장'], ['generatedTrips', '여행 생성'], ['publicJournals', '공개 여행기']] as const).map(([key, label]) => <article key={key}><span>{label}</span><strong>{state.metrics![key]?.toLocaleString('ko-KR') ?? '—'}</strong></article>)}</div><small className="admin-muted">{new Date(state.metrics.observedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} 기준</small></Panel>}
    </div></details>
  </div>;
}
