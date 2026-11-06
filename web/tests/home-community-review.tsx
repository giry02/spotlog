import { useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { placeCatalog } from '../src/data';
import HomeCommunity from '../src/together/HomeCommunity';
import TogetherApp from '../src/together/TogetherApp';
import type { GroupDiscoveryFilters } from '../src/together/GroupDiscovery';
import { createTogetherRepository } from '../src/together/repository';
import { TOGETHER_REVIEW_MEMBER_ID } from '../src/together/seed';
import { isDiscoverableGroup } from '../src/together/discovery';
import { useConsumerDensity } from '../src/consumerDensity';
import '../src/styles.css';
import '../src/theme.css';
import './group-membership-review.css';

function pageStorage(): Storage {
  const data = new Map<string, string>();
  return { get length() { return data.size; }, clear: () => data.clear(), getItem: key => data.get(key) ?? null, key: index => [...data.keys()][index] ?? null, removeItem: key => { data.delete(key); }, setItem: (key, value) => { data.set(key, value); } };
}
function Review() {
  useConsumerDensity();
  const params = new URLSearchParams(location.search);
  const [role, setRole] = useState(params.get('role') === 'member' ? 'member' : 'guest');
  const [region, setRegion] = useState(params.get('region') || '부산');
  const [query, setQuery] = useState(params.get('q') || '');
  const [mode, setMode] = useState<'all' | 'groups'>(params.get('mode') === 'groups' ? 'groups' : 'all');
  const [showContinuation, setShowContinuation] = useState(true);
  const [status, setStatus] = useState('');
  const [repositories] = useState(() => ({
    guest: createTogetherRepository('', '', placeCatalog, pageStorage()),
    member: createTogetherRepository(TOGETHER_REVIEW_MEMBER_ID, '홈 검수 회원', placeCatalog, pageStorage()),
  }));
  const [history, setHistory] = useState<{ route: string; filters?: GroupDiscoveryFilters }[]>([]);
  const viewer = role === 'member' ? { id: TOGETHER_REVIEW_MEMBER_ID, name: '홈 검수 회원' } : null;
  const repository = role === 'member' ? repositories.member : repositories.guest;
  const current = history.at(-1);
  const navigate = (route: string, filters?: GroupDiscoveryFilters) => setHistory(items => [...items, { route, filters }]);
  return <main className="membership-review-root">
    <details className="membership-review-controls" style={{ padding: 10 }}><summary style={{ minHeight: 44, fontSize: 14, cursor: 'pointer' }}>추천 홈 검수 · 모든 자료는 이 페이지 메모리만 사용</summary><div style={{ display: 'grid', gap: 8 }}>
      <label>예시 상태<select aria-label="검수 회원 상태" value={role} onChange={event => { setRole(event.target.value); setHistory([]); }}><option value="guest">비회원</option><option value="member">예시 회원</option></select></label>
      <label>선택 지역<input aria-label="검수 지역" value={region} onChange={event => setRegion(event.target.value)} /></label>
      <label>모임 이름·관심사<input aria-label="검수 검색어" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <label>화면<select aria-label="검수 모임 화면" value={mode} onChange={event => setMode(event.target.value as 'all' | 'groups')}><option value="all">정모와 모임</option><option value="groups">모임만</option></select></label>
      <label><input type="checkbox" checked={showContinuation} onChange={event => setShowContinuation(event.target.checked)} />내 모임 복귀 표시</label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button onClick={() => setHistory([])}>홈 검수로</button><button onClick={() => repository.update(draft => { const group = draft.groups.find(isDiscoverableGroup); if (group) group.promotionPublished = false; })}>첫 공개 모임 철회</button><button onClick={() => repositories.member.update(draft => { const group = draft.groups.find(item => item.id === 'family-busan'); if (group) group.memberIds = group.memberIds.filter(id => id !== TOGETHER_REVIEW_MEMBER_ID); })}>예시 가족모임 권한 회수</button></div>
      <p role="status">{status}</p>
    </div></details>
    <section className="membership-review-app" aria-label="추천 홈 모임 검수 화면">{current ? <TogetherApp key={role} reviewRepository={repository} route={current.route} discoveryFilters={current.filters} onDiscoveryFiltersChange={filters => setHistory(items => items.map((item, index) => index === items.length - 1 ? { ...item, filters } : item))} onNavigate={navigate} onBack={() => setHistory(items => items.slice(0, -1))} viewer={viewer} places={placeCatalog} journeys={[]} onLogin={() => setStatus('실제 로그인은 실행하지 않아요. 위에서 예시 회원으로 바꿀 수 있어요.')} onOpenJourney={() => setStatus('개인 여행은 이 검수본과 연결하지 않아요.')} onSavePlace={() => setStatus('이 검수본은 고객 관심 장소를 변경하지 않아요.')} onCopyJourney={() => setStatus('이 검수본은 고객 개인 여행을 변경하지 않아요.')} /> : <div style={{ padding: '0 16px 24px' }}><HomeCommunity key={role} viewer={viewer} places={placeCatalog} region={region} query={query} mode={mode} showContinuation={showContinuation} reviewRepository={repository} onNavigate={navigate} onExplore={filters => navigate('together-find', filters)} onResetFilters={() => { setRegion(''); setQuery(''); }} /></div>}</section>
  </main>;
}
const root = (import.meta.hot?.data.homeCommunityReviewRoot as Root | undefined) ?? createRoot(document.getElementById('root')!);
if (import.meta.hot) import.meta.hot.dispose(data => { data.homeCommunityReviewRoot = root; });
if (import.meta.env.DEV) root.render(<Review />); else root.render(<p>개발 환경에서만 확인할 수 있어요.</p>);
