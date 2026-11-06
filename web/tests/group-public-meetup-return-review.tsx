import { useEffect, useMemo, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import TogetherApp from '../src/together/TogetherApp';
import type { GroupDiscoveryFilters } from '../src/together/GroupDiscovery';
import { createTogetherRepository, togetherStorageKey } from '../src/together/repository';
import { createMembershipReviewState, MEMBERSHIP_REVIEW_GROUP, MEMBERSHIP_REVIEW_ROLES, membershipReviewPhase } from './membershipReviewFixture';
import '../src/styles.css';
import './group-membership-review.css';

/** No localStorage/sessionStorage access: this scenario exists in page memory only. */
function createReviewRepository() {
  const account = 'public-meetup-return-memory-review';
  const key = togetherStorageKey(account);
  const entries = new Map([[key, JSON.stringify(createMembershipReviewState(new Date(), { multiplePublicActivities: true }))]]);
  const storage: Storage = {
    get length() { return entries.size; }, key: index => [...entries.keys()][index] ?? null,
    getItem: id => entries.get(id) ?? null, setItem: (id, value) => { if (id !== key) throw new Error('검수 자료만 사용할 수 있어요.'); entries.set(id, value); },
    removeItem: id => { if (id !== key) throw new Error('검수 자료만 사용할 수 있어요.'); entries.delete(id); }, clear: () => { throw new Error('전체 자료를 지울 수 없어요.'); },
  };
  return createTogetherRepository(account, '정모 복귀 확인', [], storage);
}

function PublicMeetupReturnReview() {
  const repository = useMemo(createReviewRepository, []);
  const [state, setState] = useState(() => repository.getSnapshot());
  const [role, setRole] = useState<'applicant' | 'owner'>('applicant');
  const [route, setRoute] = useState('together-find');
  const [filters, setFilters] = useState<GroupDiscoveryFilters>({ query: '동네 한 잔', view: 'MEETUPS' });
  useEffect(() => repository.subscribe(() => setState(repository.getSnapshot())), [repository]);
  const navigate = (next: string, nextFilters?: GroupDiscoveryFilters) => { if (nextFilters) setFilters(nextFilters); setRoute(next); };
  const chooseRole = (next: 'applicant' | 'owner') => { setRole(next); setRoute(`group-${MEMBERSHIP_REVIEW_GROUP}`); };
  return <main className="membership-review-root"><header className="membership-review-controls"><h1>두 번째 공개 정모 → 가입 → 승인 → 복귀</h1><p>아래 두 정모 중 ‘주말 보드게임과 동네 수다’를 눌러 신청해 주세요. 모임장으로 바꿔 승인한 뒤 수아에게 돌아오면 선택한 정모로 가는 버튼이 나와요.</p><p>이 페이지 메모리만 사용해요. 새로고침하면 처음 상태로 돌아가며 실제 고객·관리자 자료와 연결되지 않아요.</p><div className="membership-review-roles"><button aria-pressed={role === 'applicant'} onClick={() => chooseRole('applicant')}>신청자 수아</button><button aria-pressed={role === 'owner'} onClick={() => chooseRole('owner')}>모임장 지민</button></div><div className="membership-review-status"><strong role="status">수아 · {membershipReviewPhase(state)}</strong><nav><button onClick={() => navigate('together-find', { query: '동네 한 잔', view: 'MEETUPS' })}>공개 정모 두 개 보기</button><button onClick={() => setRoute('together-invites')}>내 가입 신청</button></nav></div></header><section className="membership-review-app" aria-label={`${role === 'applicant' ? '수아' : '지민'}의 정모 복귀 화면`}><TogetherApp key={role} route={route} viewer={MEMBERSHIP_REVIEW_ROLES[role]} reviewRepository={repository} onNavigate={navigate} onBack={fallback => setRoute(fallback)} onLogin={() => {}} discoveryFilters={filters} onDiscoveryFiltersChange={setFilters} places={[]} journeys={[]} onOpenJourney={() => {}} onSavePlace={() => {}} onCopyJourney={() => {}} /></section></main>;
}

const root = (import.meta.hot?.data.meetupReturnRoot as Root | undefined) ?? createRoot(document.getElementById('root')!);
if (import.meta.hot) import.meta.hot.dispose(data => { data.meetupReturnRoot = root; });
if (import.meta.env.DEV) root.render(<PublicMeetupReturnReview />);
else root.render(<p>개발 환경에서만 볼 수 있는 화면이에요.</p>);
