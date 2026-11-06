import { useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import TogetherApp from '../src/together/TogetherApp';
import { placeCatalog } from '../src/data';
import { createTogetherRepository } from '../src/together/repository';
import { TOGETHER_REVIEW_MEMBER_ID } from '../src/together/seed';
import { removeGroupMember } from '../src/together/model';
import '../src/styles.css';
import './group-membership-review.css';

/** Deliberately memory-only: no localStorage/sessionStorage reads or writes. */
function memoryStorage(): Storage {
  const entries = new Map<string, string>();
  return { get length() { return entries.size; }, clear: () => entries.clear(), getItem: key => entries.get(key) ?? null,
    key: index => [...entries.keys()][index] ?? null, removeItem: key => { entries.delete(key); }, setItem: (key, value) => { entries.set(key, value); } };
}
function SummaryReview() {
  const [repository] = useState(() => createTogetherRepository(TOGETHER_REVIEW_MEMBER_ID, '요약 검수 여행자', placeCatalog, memoryStorage()));
  const [route, setRoute] = useState('group-family-busan');
  const [snapshot, setSnapshot] = useState(() => repository.getSnapshot());
  const revokeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (revokeTimer.current) clearTimeout(revokeTimer.current); }, []);
  useEffect(() => repository.subscribe(() => setSnapshot(repository.getSnapshot())), [repository]);
  const member = snapshot.groups.find(item => item.id === 'weekend-walk')?.memberIds.includes(TOGETHER_REVIEW_MEMBER_ID);
  return <main className="membership-review-root">
    <header className="membership-review-controls" style={{ position: 'relative', zIndex: 120 }}><h1>대화 요약 흐름 확인</h1><p>이 페이지의 예시 자료는 메모리에서만 사용해요. 실제 고객·관리자 저장소와 연결되지 않아요.</p><div className="membership-review-status"><nav aria-label="요약 확인 화면">
      <button onClick={() => setRoute('group-family-busan')}>가족 모임 홈</button>
      <button onClick={() => setRoute('activitysummary-family-next')}>정모 요약 직접 열기</button>
      <button onClick={() => setRoute('groupsummary-family-busan')}>전체방 요약 직접 열기</button>
      <button onClick={() => setRoute('groupsummary-weekend-walk')}>취미 모임 요약</button>
      <button onClick={() => setRoute('activitysummary-friends-next')}>예시 없는 정모</button>
      <button disabled={!member} onClick={() => {
        if (revokeTimer.current) clearTimeout(revokeTimer.current);
        setRoute('groupsummary-weekend-walk');
        revokeTimer.current = setTimeout(() => repository.update(draft => { removeGroupMember(draft, 'weekend-walk', 'example-friend', TOGETHER_REVIEW_MEMBER_ID); }), 2500);
      }}>요약 도중 권한 회수 시험</button>
      <button disabled={!member} onClick={() => repository.update(draft => { removeGroupMember(draft, 'weekend-walk', 'example-friend', TOGETHER_REVIEW_MEMBER_ID); })}>취미 모임 접근 해제</button>
    </nav><strong role="status">취미 모임 권한: {member ? '모임원' : '접근 해제'}</strong></div></header>
    <section className="membership-review-app" aria-label="대화 요약 검수 화면"><TogetherApp route={route} onNavigate={setRoute} onBack={setRoute} viewer={{ id: TOGETHER_REVIEW_MEMBER_ID, name: '요약 검수 여행자' }} reviewRepository={repository} places={placeCatalog} journeys={[]} onLogin={() => {}} onOpenJourney={() => {}} onSavePlace={() => {}} onCopyJourney={() => {}}/></section>
  </main>;
}
const root = (import.meta.hot?.data.summaryRoot as Root | undefined) ?? createRoot(document.getElementById('root')!);
if (import.meta.hot) import.meta.hot.dispose(data => { data.summaryRoot = root; });
if (import.meta.env.DEV) root.render(<SummaryReview/>);
else root.render(<p>개발 환경에서만 확인할 수 있어요.</p>);
