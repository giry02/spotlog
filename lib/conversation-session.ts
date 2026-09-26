import {
  initialShared,
  reduceShared,
  type Action,
  type SharedState,
} from './connected-engine';
import { getMonitor, getPlace, type Domain } from './connected-data';

export type ConversationTurn = {
  id: number;
  state: SharedState;
  restoredFrom?: number;
};
export type ConversationSession = { turns: ConversationTurn[]; nextId: number };
const copy = (s: SharedState): SharedState => ({
  ...s,
  compareIds: [...s.compareIds],
});
export function createConversation(domain: Domain): ConversationSession {
  return { turns: [{ id: 1, state: initialShared(domain) }], nextId: 2 };
}
export function latestState(session: ConversationSession) {
  return session.turns[session.turns.length - 1].state;
}
export function appendConversation(
  session: ConversationSession,
  action: Action,
): ConversationSession {
  const before = latestState(session),
    next = reduceShared(before, action);
  if (action.type === 'map')
    next.question = action.value ? '지도도 함께 보여줘' : '지도는 접어줘';
  if (action.type === 'compare')
    next.question = `${getMonitor(action.id).name}${before.compareIds.includes(action.id) ? ' 비교를 해제할래' : '도 비교해줘'}`;
  if (action.type === 'use-anchor')
    next.question = `${next.domain === 'places' ? getPlace(action.id).name : getMonitor(action.id).name}을 기준으로 다시 찾아줘`;
  return {
    turns: [...session.turns, { id: session.nextId, state: copy(next) }],
    nextId: session.nextId + 1,
  };
}
export function resumeConversation(
  session: ConversationSession,
  id: number,
): ConversationSession {
  const index = session.turns.findIndex((t) => t.id === id);
  if (index < 0) return session;
  const state = copy(session.turns[index].state);
  state.revision = latestState(session).revision + 1;
  state.question = `${index + 1}번째 결과의 조건으로 다시 이어갈래`;
  state.lastAction = '이전 결과의 기준·선택·조건을 가져왔어요';
  state.notice = '';
  return {
    turns: [
      ...session.turns,
      { id: session.nextId, state, restoredFrom: index + 1 },
    ],
    nextId: session.nextId + 1,
  };
}
export function undoConversation(
  session: ConversationSession,
): ConversationSession {
  return session.turns.length > 1
    ? { ...session, turns: session.turns.slice(0, -1) }
    : session;
}
