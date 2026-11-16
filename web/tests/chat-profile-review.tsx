// DEV-only, fictional family records. Product modules load only after page-local storage isolation.
import { useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Journey } from '../src/data';
import { MESSAGE_HOLD_DELAY_MS } from '../src/together/swipeReplyGesture';
import '../src/styles.css';
import '../src/theme.css';
import '../src/product-ux-refinement.css';

function memoryStorage(beforeWrite?: () => void): Storage {
  const values = new Map<string, string>();
  return { get length() { return values.size; }, getItem: key => values.get(key) ?? null, setItem: (key, value) => { beforeWrite?.(); values.set(key, value); },
    removeItem: key => { values.delete(key); }, clear: () => values.clear(), key: index => [...values.keys()][index] ?? null };
}
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

async function boot() {
  if (!import.meta.env.DEV) { document.getElementById('root')!.textContent = '개발 환경에서만 확인할 수 있어요.'; return; }
  // Includes TogetherApp's recent-group store: no real localStorage/sessionStorage is read or written.
  let failNextWrite = false;
  const storage = memoryStorage(() => { if (failNextWrite) { failNextWrite = false; throw new DOMException('Fictional review write failure', 'QuotaExceededError'); } }), session = memoryStorage();
  Object.defineProperty(window, 'localStorage', { configurable: true, get: () => storage });
  Object.defineProperty(window, 'sessionStorage', { configurable: true, get: () => session });
  const [{ default: TogetherApp }, { createTogetherRepository }, { TOGETHER_REVIEW_MEMBER_ID }, { placeCatalog }] = await Promise.all([
    import('../src/together/TogetherApp'), import('../src/together/repository'), import('../src/together/seed'), import('../src/data'),
  ]);
  const viewer = { id: TOGETHER_REVIEW_MEMBER_ID, name: '가상 검수 여행자' }, groupId = 'family-busan', activityId = 'family-next';
  const parameters = new URLSearchParams(location.search), mode = parameters.get('screen'), stress = parameters.get('stress') === '1';
  const photo = '/media/groups/coastal-walking-20261109.jpg';
  const repository = createTogetherRepository(viewer.id, viewer.name, placeCatalog, storage);
  const makeJournal = (id: string, isMine = false): Journey => ({ id, purpose: 'JOURNAL', title: '바다를 함께 본 가상 여행기', region: '부산', dateRange: '당일', duration: '당일',
    status: 'PUBLISHED', visibility: 'PRIVATE', cover: photo, summary: '사진과 글로 확인하는 가상 공유 여행기입니다.', story: '한 곳에서 천천히 쉬었다는 가상의 기록입니다.', tags: ['검수'], saves: 0,
    author: isMine ? viewer.name : '엄마', isMine, days: [{ day: 1, dayId: `${id}-day`, date: '', title: '함께 쉬는 하루', story: '실제 방문을 주장하지 않는 검수용 이야기입니다.', places: [],
      blocks: [{ id: `${id}-text`, type: 'TEXT', body: '사진·글·동선의 공유 범위를 확인합니다.' }, { id: `${id}-image`, type: 'IMAGE', image: photo, caption: '기존 로컬 합성 활동 사진 · 가상 검수' }] }] });
  const ownJournal = makeJournal('chat-profile-own-journal', true);
  const initialized = repository.update(draft => {
    const group = draft.groups.find(item => item.id === groupId)!;
    group.archived = mode === 'archived';
    group.memberPresentations = {
      [viewer.id]: { nickname: '검수 여행자', introduction: '사진과 이름표를 편집할 수 있는 가상 검수 프로필입니다.' },
      'example-parent': { nickname: '엄마', introduction: '천천히 걷고 바다를 보며 쉬는 시간을 좋아해요. 모임원에게 직접 공유한 가상 소개입니다.' },
      'example-sibling': { nickname: '지우', introduction: '책과 사진 이야기를 좋아하는 가상 모임원이에요.' },
    };
    if (stress) {
      group.name = '이름이 긴 가족과 친구가 함께 천천히 준비하는 바다 여행 모임 · 좁은 화면 검수';
      group.memberPresentations['example-parent'].nickname = 'LongMemberNameWithoutSpaces'.repeat(2).slice(0, 40);
      group.memberPresentations['example-sibling'].nickname = 'AnotherLongMemberNameWithoutSpaces'.repeat(2).slice(0, 40);
      draft.activities.find(item => item.id === activityId)!.title = '함께 가는 길이 즐거운 아주 긴 가족 여행 약속 이름 · 좁은 화면 검수';
      draft.messages.find(item => item.id === 'family-chat-1')!.body = `긴 주소도 가로로 넘치지 않아야 해요. https://example.invalid/${'verylongpath'.repeat(24)}`;
    }
    draft.members.find(item => item.id === viewer.id)!.avatar = '/media/groups/riverside-running-20261109.jpg';
    const timestamp = new Date().toISOString();
    for (const activityScope of [undefined, activityId]) {
      const key = activityScope || 'group';
      draft.posts.push({ id: `chat-profile-photo-${key}`, groupId, activityId: activityScope, authorId: 'example-parent', title: '사진과 함께 남기는 가상 이야기', body: '이 모임에 공유한 글과 사진의 정확한 원문을 확인합니다.', category: 'FREE', createdAt: timestamp, likes: [], comments: [],
        attachments: [{ id: `chat-profile-attachment-${key}`, url: photo, caption: '기존 로컬 합성 사진 · 가상 검수' }] });
      draft.posts.push({ id: `chat-profile-question-${key}`, groupId, activityId: activityScope, authorId: viewer.id, title: '함께 준비할 내용을 정리해요', body: '멤버 프로필의 댓글을 누르면 이 글과 정확한 댓글이 열립니다.', category: 'QUESTION', createdAt: timestamp, likes: [],
        comments: [{ id: `chat-profile-comment-${key}`, authorId: 'example-parent', body: '저는 편한 신발을 준비할게요. 가상 댓글입니다.', createdAt: timestamp }] });
      draft.media.push({ id: `chat-profile-media-${key}`, groupId, activityId: activityScope, authorId: 'example-parent', kind: 'PHOTO', url: photo, caption: '모임에 공유한 가상 앨범 사진', createdAt: timestamp });
      draft.sharedJournals.push({ id: `chat-profile-journal-${key}`, groupId, activityId: activityScope, authorId: 'example-parent', journey: makeJournal(`chat-profile-shared-${key}`) });
    }
    for (let index = 0; index < 12; index++) draft.messages.push({ id: `chat-profile-scroll-${index}`, roomId: `activity:${activityId}`, authorId: index % 2 ? 'example-parent' : 'example-sibling',
      body: `가상 대화 ${index + 1}. 사진이나 이름을 누르면 이 모임의 프로필과 공유 기록을 볼 수 있어요.`, createdAt: new Date(Date.now() - (15 - index) * 60000).toISOString() });
    draft.messages.push({ id: 'chat-profile-sticker', roomId: `activity:${activityId}`, authorId: 'example-parent', body: '', stickerId: 'bunny-hi', createdAt: new Date(Date.now() - 60000).toISOString() });
  });
  if (!initialized) throw new Error(repository.getError() || '가상 검수 자료를 구성하지 못했어요.');

  function Review() {
    const [route, setRoute] = useState(mode === 'group' ? `group-${groupId}` : `activitychat-${activityId}`);
    const [status, setStatus] = useState('DEV · 가상 자료 · 저장은 이 페이지 메모리만 사용');
    const controls = useRef<HTMLDetailsElement>(null), busy = useRef(false), pointerSequence = useRef(40), lastSource = useRef('');
    const firstBubble = () => [...document.querySelectorAll<HTMLElement>('[data-swipe-reply-surface]')].find(item => !item.classList.contains('tg-message-select-sticker'));
    const sourceId = (bubble?: HTMLElement) => bubble?.closest('[data-message]')?.id.replace('tg-message-', '');
    const trigger = (bubble: HTMLElement) => document.getElementById(`tg-message-select-${sourceId(bubble)}`);
    const runGesture = async (kind: 'right' | 'short' | 'vertical' | 'hold' | 'moved-hold') => {
      if (busy.current) return;
      busy.current = true;
      try {
        controls.current?.removeAttribute('open');
        document.querySelector<HTMLButtonElement>('button[aria-label="답장 취소"]')?.click();
        await frame(); await frame();
        const bubble = firstBubble();
        if (!bubble) { setStatus('먼저 약속 대화 또는 모임 전체 대화를 열어 주세요.'); return; }
        if (!window.PointerEvent) { setStatus('이 브라우저에서는 합성 PointerEvent 검수를 실행할 수 없어요.'); return; }
        if (trigger(bubble)?.getAttribute('aria-expanded') === 'true') trigger(bubble)?.click();
        bubble.scrollIntoView({ block: 'center', inline: 'nearest' });
        await frame();
        const rect = bubble.getBoundingClientRect(), x = rect.left + Math.min(24, rect.width / 2), y = rect.top + Math.min(18, rect.height / 2), pointerId = ++pointerSequence.current;
        lastSource.current = sourceId(bubble) || '';
        const dispatch = (type: string, dx: number, dy: number) => bubble.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId, pointerType: 'touch', isPrimary: true, button: 0, buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1, clientX: x + dx, clientY: y + dy }));
        dispatch('pointerdown', 0, 0);
        if (kind === 'hold' || kind === 'moved-hold') {
          if (kind === 'moved-hold') dispatch('pointermove', 2, 18);
          await new Promise<void>(resolve => setTimeout(resolve, MESSAGE_HOLD_DELAY_MS + 70));
          dispatch(kind === 'moved-hold' ? 'pointercancel' : 'pointerup', 0, kind === 'moved-hold' ? 18 : 0);
          if (kind === 'hold') bubble.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1, view: window }));
        } else if (kind === 'vertical') {
          dispatch('pointermove', 2, 30); dispatch('pointermove', 3, 100); dispatch('pointercancel', 3, 100);
          // Synthetic pointer events do not perform native scrolling. This separate scroll request only checks the container.
          let scroller: HTMLElement | null = bubble.parentElement;
          while (scroller && !(scroller.scrollHeight > scroller.clientHeight && /auto|scroll/.test(getComputedStyle(scroller).overflowY))) scroller = scroller.parentElement;
          scroller?.scrollBy({ top: 100, behavior: 'instant' });
        } else {
          const distance = kind === 'right' ? 72 : 20;
          dispatch('pointermove', 10, 1); dispatch('pointermove', distance, 2); dispatch('pointerup', distance, 2);
          // Real untrusted PointerEvents do not generate a click, so also exercise the wrapper's post-drag click guard explicitly.
          bubble.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1, view: window }));
        }
        await frame(); await frame();
        const reply = Boolean(document.querySelector('.tg-reply-preview')), opened = trigger(bubble)?.getAttribute('aria-expanded') === 'true';
        const label = { right: '오른쪽', short: '짧은', vertical: '세로', hold: '길게 누르기', 'moved-hold': '움직인 길게 누르기' }[kind];
        setStatus(`${label} 합성 검수 · 답장 ${reply ? '표시' : '없음'} · 도구 ${opened ? '열림' : '닫힘'}${kind === 'vertical' ? ' · 스크롤은 별도 코드 요청' : ''}`);
      } finally { busy.current = false; }
    };
    const deleteSource = () => {
      const messageId = lastSource.current || sourceId(firstBubble());
      if (!messageId) { setStatus('삭제할 가상 원문을 먼저 선택해 주세요.'); return; }
      const ok = repository.update(draft => { const message = draft.messages.find(item => item.id === messageId); if (message) message.deleted = true; });
      setStatus(ok ? '가상 원문 삭제 · 답장 원문 무효 상태를 확인해 주세요.' : '가상 원문을 바꾸지 못했어요.');
    };
    return <main className="chat-profile-review">
      <div className="chat-profile-controls"><details ref={controls}><summary>DEV · 채팅 답장·프로필 검수 도구</summary><p>모든 사람·대화·글은 가상 자료입니다. 사진은 기존 로컬 합성 활동 사진입니다. 도구 버튼은 합성 PointerEvent를 보내며 실제 기기 터치·키보드·기본 세로 스크롤 검증을 대신하지 않습니다.</p>
        <nav aria-label="검수 시작 화면"><a href="?screen=chat">약속 대화</a><a href="?screen=chat&amp;stress=1">긴 이름 대화</a><a href="?screen=group">모임 홈</a><a href="?screen=archived">보관 대화</a></nav>
        <div className="test-buttons"><button type="button" onClick={() => void runGesture('right')}>오른쪽 스와이프 검수</button><button type="button" onClick={() => void runGesture('hold')}>길게 누르기 검수</button><button type="button" onClick={() => void runGesture('moved-hold')}>길게 누르기 취소 검수</button><button type="button" onClick={() => void runGesture('short')}>짧은 스와이프</button><button type="button" onClick={() => void runGesture('vertical')}>세로 스크롤 동작</button><button type="button" onClick={deleteSource}>원문 삭제</button><button type="button" onClick={() => { failNextWrite = true; setStatus('다음 가상 저장을 한 번 실패시킵니다. 메시지 전송 후 입력 보존·재전송을 확인해 주세요.'); }}>다음 저장 실패</button><button type="button" onClick={() => location.reload()}>가상 자료 초기화</button></div>
      </details><output aria-live="polite" title={status}>{status}</output></div>
      <section className="app-shell chat-profile-host"><div className="content"><TogetherApp repository={repository} route={route} onNavigate={setRoute} onBack={fallback => setRoute(fallback.startsWith('activity') || fallback.startsWith('group') ? fallback : `group-${groupId}`)} viewer={viewer} places={placeCatalog} journeys={[ownJournal]} onLogin={() => setStatus('이 검수는 가상 모임원으로만 실행합니다.')} onOpenJourney={() => setStatus('개인 여행 화면은 이 검수 범위 밖입니다.')} onSavePlace={() => setStatus('개인 장소 저장은 이 검수 범위 밖입니다.')} onCopyJourney={() => setStatus('개인 여행 복사는 이 검수 범위 밖입니다.')}/></div></section>
    </main>;
  }
  const root = (import.meta.hot?.data.chatProfileReviewRoot as Root | undefined) ?? createRoot(document.getElementById('root')!);
  if (import.meta.hot) import.meta.hot.dispose(data => { data.chatProfileReviewRoot = root; });
  root.render(<Review/>);
}
void boot().catch(error => { document.getElementById('root')!.textContent = `검수 화면을 시작하지 못했어요: ${error instanceof Error ? error.message : '검수 초기화 오류'}`; });
