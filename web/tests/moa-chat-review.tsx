import { useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import TogetherApp from '../src/together/TogetherApp';
import { createTogetherRepository } from '../src/together/repository';
import { TOGETHER_REVIEW_MEMBER_ID } from '../src/together/seed';
import { placeCatalog } from '../src/data';
import '../src/styles.css';
import '../src/theme.css';
import '../src/product-ux-refinement.css';
import './group-membership-review.css';

/** Entire repository stays in this page's memory, including sent messages/reactions. */
function storage(): Storage {
  const data = new Map<string, string>();
  return { get length() { return data.size; }, clear: () => data.clear(), getItem: key => data.get(key) ?? null, key: i => [...data.keys()][i] ?? null, removeItem: key => { data.delete(key); }, setItem: (key, value) => { data.set(key, value); } };
}
function Review() {
  const [repository] = useState(() => {
    const repo = createTogetherRepository(TOGETHER_REVIEW_MEMBER_ID, '채팅 확인 여행자', placeCatalog, storage());
    repo.update(draft => {
      const group = draft.groups.find(item => item.id === 'family-busan')!;
      const bodies = ['물과 보조배터리는 각자 챙겨요.', '부산역 2번 출구 앞에서 10시 30분에 만나요.', '점심 예약이 가능한지 확인이 필요해요. 아직 예약한 건 아니에요.', '오래 걷기 힘들면 카페에서 잠깐 쉬어요.', '저는 비가 오면 우산을 챙길게요.', '식당은 두 곳을 비교한 뒤 함께 골라요.', '이동 시간은 지도에서 다시 확인해 주세요.', '주말에 함께 만나니 기대돼요.'];
      const start = Date.now() - 48 * 12 * 60000;
      for (let index = 0; index < 48; index++) draft.messages.push({ id: `moa-review-${index}`, roomId: 'activity:family-next', authorId: group.memberIds[index % group.memberIds.length], body: bodies[index % bodies.length], createdAt: new Date(start + index * 12 * 60000).toISOString() });
      draft.readCursors['activity:family-next'] = new Date(start + 4 * 12 * 60000).toISOString();
    });
    return repo;
  });
  const [route, setRoute] = useState(() => new URLSearchParams(window.location.search).get('view') === 'summary' ? 'activitysummary-family-next' : 'activitychat-family-next');
  return <main className="membership-review-root">
    <details className="membership-review-controls" style={{ padding: 10 }}><summary style={{ cursor: 'pointer', fontSize: 14 }}>채팅·요약 확인 화면 · 저장은 이 페이지 메모리만 사용</summary><nav style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}><button onClick={() => setRoute('groupchat-family-busan')}>모임 전체 채팅</button><button onClick={() => setRoute('activitychat-family-next')}>정모 채팅</button><button onClick={() => setRoute('activitysummary-family-next')}>대화 정리 바로 열기</button><button onClick={() => repository.update(draft => { draft.messages.push({ id: `incoming-${crypto.randomUUID()}`, roomId: 'activity:family-next', authorId: 'example-mom', body: '편한 신발을 챙겨 주세요. 만날 시간도 한 번 더 확인해요.', createdAt: new Date().toISOString() }); })}>새 대화 도착 확인</button></nav></details>
    <section className="membership-review-app" aria-label="채팅 확인 화면"><TogetherApp route={route} onNavigate={setRoute} onBack={setRoute} viewer={{ id: TOGETHER_REVIEW_MEMBER_ID, name: '채팅 확인 여행자' }} reviewRepository={repository} places={placeCatalog} journeys={[]} onLogin={() => {}} onOpenJourney={() => {}} onSavePlace={() => {}} onCopyJourney={() => {}}/></section>
  </main>;
}
const root = (import.meta.hot?.data.moaReviewRoot as Root | undefined) ?? createRoot(document.getElementById('root')!);
if (import.meta.hot) import.meta.hot.dispose(data => { data.moaReviewRoot = root; });
if (import.meta.env.DEV) root.render(<Review/>);
else root.render(<p>개발 환경에서만 확인할 수 있어요.</p>);
