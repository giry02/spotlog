import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import ConversationSummary from '../src/together/ConversationSummary';
import { canReadChatDigest } from '../src/together/chatDigest';
import { createEmptyState } from '../src/together/model';
import type { ChatAiSummaryRequest } from '../src/together/chatAiSummary';
import '../src/styles.css';
import '../src/together/together.css';
import './group-membership-review.css';

/** Synthetic page-memory data and an injected fetch only: never reads storage or contacts a model/server. */
function fixture() {
  const state = createEmptyState('review-me', '검수 나');
  state.members.push({ id: 'review-other', name: '검수 참여자' });
  state.groups.push({ id: 'review-group', name: 'AI 연결 검수용 모임', kind: 'FAMILY', region: '검수 지역', introduction: '', cover: '', visibility: 'PRIVATE', ownerId: 'review-me', memberIds: ['review-me', 'review-other'], managerIds: [], archived: false, promotionPublished: false });
  state.activities.push({ id: 'review-trip', groupId: 'review-group', title: '검수 약속', date: '', endDate: '', meetingPoint: '', description: '', status: 'PLANNED', leadId: 'review-me', editorIds: [], participants: {}, arrivedIds: [], revision: 1 });
  state.messages.push(
    { id: 'review-group-one', roomId: 'group:review-group', authorId: 'review-other', body: '물과 편한 신발을 챙겨 주세요.', createdAt: new Date(Date.now() - 120000).toISOString() },
    { id: 'review-group-two', roomId: 'group:review-group', authorId: 'review-me', body: '점심 예약 가능 여부를 확인할까요?', createdAt: new Date(Date.now() - 60000).toISOString() },
    { id: 'review-trip-one', roomId: 'activity:review-trip', authorId: 'review-other', body: '약속 대화방의 별도 원문이에요.', createdAt: new Date(Date.now() - 30000).toISOString() },
  );
  return state;
}
function Review() {
  const [state, setState] = useState(fixture), [roomId, setRoomId] = useState('group:review-group');
  const [mode, setMode] = useState('success'), [configured, setConfigured] = useState(true), [sourceId, setSourceId] = useState('');
  const [requestInfo, setRequestInfo] = useState('아직 요청하지 않았어요.');
  const context = { state, userId: 'review-me', groupId: 'review-group', roomId };
  const fakeFetch: typeof fetch = async (input, options) => {
    if (String(input) !== '/__isolated_chat_ai_review__' || options?.method !== 'POST') throw new Error('이 검수에서는 실제 네트워크 요청을 허용하지 않아요.');
    const request = JSON.parse(String(options.body)) as ChatAiSummaryRequest;
    setRequestInfo(`${request.scope.roomId} · ${request.payload.purpose} · ${request.payload.sources.map(item => item.id).join(', ')}`);
    if (mode === 'slow') await new Promise(resolve => setTimeout(resolve, 1800)); // Deliberately ignores abort to verify rejection of late output.
    if (mode === 'offline') throw new Error('synthetic offline');
    if (mode === 'denied') return new Response('{}', { status: 403 });
    const first = request.payload.sources[0];
    return new Response(JSON.stringify({ schemaVersion: 1, requestId: request.requestId, scope: request.scope,
      output: { title: '모의 HTTP 응답 · 실제 AI 생성 아님', sections: [{ heading: '인용 형식 검수', items: [{ text: '이 문장은 실행·출처 UI를 확인하는 고정 검수 응답이에요.', sourceIds: [mode === 'bad-citation' ? 'not-in-selection' : first.id] }] }] } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const original = canReadChatDigest(context) ? state.messages.find(item => item.id === sourceId && item.roomId === roomId) : undefined;
  return <main className="membership-review-root">
    <details className="membership-review-controls"><summary>모의 HTTP 검수 · 실제 AI 모델·서버 연결 없음</summary><p>고정 응답과 가상의 원문만 사용해요. 실제 저장소나 외부 서버에 접근하지 않아요.</p><div className="membership-review-status"><nav aria-label="AI 계약 검수 제어">
      <select aria-label="모의 응답" value={mode} onChange={event => setMode(event.target.value)}><option value="success">정상 인용</option><option value="bad-citation">잘못된 인용</option><option value="denied">권한 오류</option><option value="offline">연결 오류</option><option value="slow">늦은 응답 · 1.8초</option></select>
      <button onClick={() => setConfigured(value => !value)}>{configured ? '서버 설정 해제' : '모의 서버 설정'}</button>
      <button onClick={() => { setRoomId(value => value.startsWith('group:') ? 'activity:review-trip' : 'group:review-group'); setSourceId(''); }}>대화방 바꾸기</button>
      <button onClick={() => setState(value => { const next = structuredClone(value); const message = next.messages.find(item => item.roomId === roomId)!; message.body += ' 수정됨'; return next; })}>첫 원문 수정</button>
      <button onClick={() => setState(value => { const next = structuredClone(value); next.groups[0].memberIds = next.groups[0].memberIds.includes('review-me') ? ['review-other'] : ['review-me', 'review-other']; return next; })}>읽기 권한 해제·복구</button>
    </nav><p role="status">요청 범위: {requestInfo}</p></div></details>
    <section className="membership-review-app tg tg-pad" aria-label="AI 요약 연결 검수 화면"><ConversationSummary {...context} unreadAfter={undefined} aiEndpoint={configured ? '/__isolated_chat_ai_review__' : ''} reviewAiFetch={fakeFetch} onSource={setSourceId}/>{original && <section className="tg-card" aria-label="선택한 근거 원문"><h3>근거 원문 · 검수용</h3><p>{original.body}</p></section>}</section>
  </main>;
}
if (import.meta.env.DEV) createRoot(document.getElementById('root')!).render(<Review/>);
else document.getElementById('root')!.textContent = '개발 환경에서만 확인할 수 있어요.';
