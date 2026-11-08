import type { TogetherState } from '../src/together/model';
import { createRoomPoll } from '../src/together/polls';
import { createRoomGame } from '../src/together/roomGames';
import { createRoomChallenge, joinRoomChallenge, certifyRoomChallenge, challengeToday } from '../src/together/challenges';
import { shareChatEntity } from '../src/together/chatEntities';

/** Authored examples only, installed after platform-review's storage/network isolation. */
export function installParticipationExamples(state: TogetherState, ownerId: string, at = new Date()) {
  const groupId = 'family-busan';
  const scope = { groupId };
  const day = (offset: number) => challengeToday(new Date(at.getTime() + offset * 86400000));
  const members = [ownerId, 'example-parent', 'example-sibling'];
  const poll = createRoomPoll(state, ownerId, scope, { id: 'review-date-poll', question: '다음 가족 산책, 가능한 날을 모두 골라요', kind: 'DATE', multiple: true, anonymous: true, options: [{ date: day(1), time: '14:00' }, { date: day(2), time: '11:00' }], closesAt: new Date(at.getTime() + 86400000).toISOString() }, at);
  shareChatEntity(state, ownerId, { type: 'POLL', id: poll.id });
  for (const input of [
    { id: 'review-wheel', type: 'WHEEL' as const, title: '산책 뒤 오늘의 메뉴', options: ['따뜻한 국수', '든든한 한식', '가벼운 샌드위치'] },
    { id: 'review-draw', type: 'DRAW' as const, title: '오늘 사진 찍을 사람', memberIds: members },
    { id: 'review-ladder', type: 'LADDER' as const, title: '가족 나들이 준비 역할', memberIds: members, options: ['돗자리 챙기기', '간식 챙기기', '보조배터리 챙기기'] },
  ]) { const game = createRoomGame(state, ownerId, scope, input, at); shareChatEntity(state, ownerId, { type: 'GAME', id: game.id }); }
  const challenge = createRoomChallenge(state, ownerId, scope, { id: 'review-walk-challenge', template: 'WALK', title: '가족과 주 3회, 산책 한 장', description: '가까운 길을 걷고 오늘 발견한 풍경이나 한마디를 남겨요.', startDate: day(0), endDate: day(14), frequency: 'WEEKLY', weeklyTarget: 3 }, at);
  joinRoomChallenge(state, ownerId, scope, challenge, at);
  joinRoomChallenge(state, 'example-sibling', scope, challenge, at);
  certifyRoomChallenge(state, 'example-sibling', scope, challenge, { text: '오늘은 동네 공원을 걸었어요. 다음에는 가족과 함께 걸어요.' }, at);
  shareChatEntity(state, ownerId, { type: 'CHALLENGE', id: challenge });
  const activityScope = { groupId, activityId: 'family-next' };
  const activityGame = createRoomGame(state, ownerId, activityScope, { id: 'review-trip-wheel', type: 'WHEEL', title: '여행 중 쉬어갈 곳 고르기', options: ['바다 산책', '카페에서 쉬기'] }, at);
  shareChatEntity(state, ownerId, { type: 'GAME', id: activityGame.id });
}
