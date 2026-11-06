import { useEffect, useMemo, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import TogetherApp from '../src/together/TogetherApp';
import { createTogetherRepository } from '../src/together/repository';
import { createMembershipReviewState, MEMBERSHIP_REVIEW_ACCOUNT, MEMBERSHIP_REVIEW_ACTIVITY, MEMBERSHIP_REVIEW_GROUP, MEMBERSHIP_REVIEW_KEY, MEMBERSHIP_REVIEW_ROLES, membershipReviewPhase, membershipReviewStorage } from './membershipReviewFixture';
import '../src/styles.css';
import './group-membership-review.css';

function MembershipReview() {
  const [role, setRole] = useState<'applicant' | 'owner'>('applicant');
  const [route, setRoute] = useState('together-find');
  const [epoch, setEpoch] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [resetError, setResetError] = useState('');
  const setup = useMemo(() => {
    try {
      const storage = membershipReviewStorage(window.sessionStorage);
      if (storage.getItem(MEMBERSHIP_REVIEW_KEY) === null) storage.setItem(MEMBERSHIP_REVIEW_KEY, JSON.stringify(createMembershipReviewState()));
      return { storage, repository: createTogetherRepository(MEMBERSHIP_REVIEW_ACCOUNT, '모임 화면 확인', [], storage), error: '' };
    } catch { return { storage: null, repository: null, error: '이 탭의 검수 자료를 보관할 수 없어요. 브라우저 저장 설정을 확인해 주세요.' }; }
  }, [epoch]);
  const [snapshot, setSnapshot] = useState(() => setup.repository?.getSnapshot() ?? createMembershipReviewState());
  useEffect(() => { if (!setup.repository) return; setSnapshot(setup.repository.getSnapshot()); return setup.repository.subscribe(() => setSnapshot(setup.repository!.getSnapshot())); }, [setup]);
  const phase = membershipReviewPhase(snapshot);
  const chooseRole = (next: 'applicant' | 'owner') => { setRole(next); setRoute(`group-${MEMBERSHIP_REVIEW_GROUP}`); };
  const member = snapshot.groups.find(group => group.id === MEMBERSHIP_REVIEW_GROUP)?.memberIds.includes('review-applicant');
  const reset = () => {
    if (!confirmed || !setup.storage) return;
    try { setup.storage.setItem(MEMBERSHIP_REVIEW_KEY, JSON.stringify(createMembershipReviewState())); setEpoch(value => value + 1); setRole('applicant'); setRoute('together-find'); setConfirmed(false); setResetError(''); }
    catch { setResetError('초기화하지 못했어요. 이전 자료는 그대로 유지했어요.'); }
  };
  return <main className="membership-review-root"><header className="membership-review-controls"><h1>모임 가입 → 승인 → 참석</h1><p>신청자와 모임장을 바꿔 같은 화면 흐름을 확인하는 전용 페이지예요. 실제 로그인·고객 자료와 연결되지 않아요.</p><div className="membership-review-roles" aria-label="화면에서 확인할 역할"><button type="button" aria-pressed={role === 'applicant'} onClick={() => chooseRole('applicant')}>{member ? '가입한 수아' : '신청자 수아'}</button><button type="button" aria-pressed={role === 'owner'} onClick={() => chooseRole('owner')}>모임장 지민</button></div><ol className="membership-review-steps" aria-label={`수아의 가입 상태: ${phase}`}><li aria-current={phase === '신청 전' ? 'step' : undefined}><span>1</span>가입 신청</li><li aria-current={phase === '승인 대기' ? 'step' : undefined}><span>2</span>모임장 승인</li><li aria-current={phase === '가입 완료' ? 'step' : undefined}><span>3</span>모임 이용</li></ol><div className="membership-review-status"><strong role="status">수아 · {phase}</strong><nav aria-label="검수 화면 이동"><button type="button" onClick={() => setRoute('together-find')}>모임 찾기</button><button type="button" onClick={() => setRoute(`group-${MEMBERSHIP_REVIEW_GROUP}`)}>모임 홈</button><button type="button" disabled={role === 'applicant' && !member} onClick={() => setRoute(`activity-${MEMBERSHIP_REVIEW_ACTIVITY}`)}>정모 참석 확인</button></nav></div><details className="membership-review-reset"><summary>검수 처음부터</summary><label><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />이 탭의 가입·참석 검수 기록만 초기화할게요.</label><button type="button" disabled={!confirmed || !setup.storage} onClick={reset}>확인한 검수 자료 초기화</button>{resetError && <p role="alert">{resetError}</p>}</details></header><section className="membership-review-app" aria-label={`${role === 'applicant' ? '수아' : '지민'}의 Spotlog 화면`}>{setup.error ? <p role="alert">{setup.error}</p> : setup.repository && <TogetherApp key={`${role}-${epoch}`} route={route} reviewRepository={setup.repository} viewer={MEMBERSHIP_REVIEW_ROLES[role]} onNavigate={setRoute} onBack={setRoute} onLogin={() => {}} places={[]} journeys={[]} discoveryFilters={{ query: '동네 한 잔' }} onOpenJourney={() => {}} onSavePlace={() => {}} onCopyJourney={() => {}} />}</section></main>;
}

const root = (import.meta.hot?.data.membershipRoot as Root | undefined) ?? createRoot(document.getElementById('root')!);
if (import.meta.hot) import.meta.hot.dispose(data => { data.membershipRoot = root; });
if (import.meta.env.DEV) root.render(<MembershipReview />);
else root.render(<p>개발 환경에서만 볼 수 있는 화면이에요.</p>);
