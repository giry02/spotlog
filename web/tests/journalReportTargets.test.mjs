import test from 'node:test';
import assert from 'node:assert/strict';
import { journalReportChoices } from '../src/journalReportTargets.ts';
import { cardKey } from '../src/cardSocialState.ts';
import { createReportAdapter } from '../src/reportService.ts';
import { validateReportTarget } from '../src/reviewServiceBridge.ts';

const place = { id: 'branch-1', name: '부산 식당', kind: 'FOOD', area: '부산', address: '공개 주소', lat: 35.1, lng: 129.1, description: '공개 소개', duration: '1시간', note: 'PRIVATE_NOTE', image: '/main.jpg', photos: [{ mediaId: 'main-media', image: '/main.jpg', caption: '첫 사진', alt: '첫 사진' }, { image: '/second.jpg', caption: '다른 사진', alt: '다른 사진' }] };
const journey = { id: 'journal-1', title: '여행기', purpose: 'JOURNAL', visibility: 'PUBLIC', status: 'PUBLISHED', author: '작성자', publicAuthorId: 'author-1', isMine: false, region: '부산', dateRange: '미정', duration: '1박 2일', cover: '/cover.jpg', summary: '공개 요약', story: '공개 본문', tags: [], saves: 0, days: [{ day: 1, date: 'DAY 1', title: '첫날', story: '', places: [{ ...place, visitId: 'visit-1' }], blocks: [{ id: 'card-1', type: 'PLACE', placeId: place.id, visitId: 'visit-1' }, { id: 'photo-block', type: 'IMAGE', images: [{ id: 'journal-photo-1', image: '/journal-photo.jpg', caption: '여행 장면' }] }] }, { day: 2, date: 'DAY 2', title: '둘째 날', story: '', places: [{ ...place, visitId: 'visit-2' }], blocks: [{ id: 'card-2', type: 'PLACE', placeId: place.id, visitId: 'visit-2' }] }] };
const comment = { commentId: 'other-comment', revision: 1, journalId: journey.id, cardId: 'card-1', authorId: 'other-user', authorName: '댓글 작성자', original: '카드 댓글', english: '', moderation: 'VISIBLE', createdAt: '2026-10-06T00:00:00.000Z' };

test('one journal entry offers exact journal, author, cover, place and individual photo identities', () => {
  const choices = journalReportChoices({ journey });
  assert.equal(choices[0].target.type, 'JOURNAL');
  choices.forEach(choice => assert.doesNotThrow(() => validateReportTarget(choice.target)));
  assert.equal(choices.find(choice => choice.target.type === 'PROFILE').target.id, 'author-1');
  assert.equal(choices.find(choice => choice.label === '표지 사진').target.photo.image, '/cover.jpg');
  assert.ok(choices.some(choice => choice.target.id === 'journal-photo-1' && choice.target.cardId === 'photo-block'));
  assert.ok(choices.some(choice => choice.target.id === 'branch-1:1' && choice.target.photo.image === '/second.jpg'));
});
test('same venue on different DAYs keeps journal/card identity instead of merging report targets', () => {
  const targets = journalReportChoices({ journey }).filter(choice => choice.target.type === 'PLACE');
  assert.deepEqual(targets.map(choice => [choice.target.id, choice.target.cardId]), [['branch-1', 'card-1'], ['branch-1', 'card-2']]);
});
test('all private, deleted and planning journeys have no report choices', () => {
  for (const patch of [{ visibility: 'PRIVATE' }, { status: 'PLANNING' }, { purpose: 'PLAN' }, { trash: { deletedAt: 'x' } }]) assert.deepEqual(journalReportChoices({ journey: { ...journey, ...patch } }), []);
});
test('only visible comments and replies of this journal can be selected; own or removed content is excluded', () => {
  const thread = { likes: [], comments: [{ id: 'reply', authorId: 'friend', author: '답글 작성자', body: '답글', parentId: 'other-comment', createdAt: '2026-10-06T01:00:00.000Z' }, { id: 'mine', authorId: 'local-self', author: '나', body: '내 댓글', createdAt: '2026-10-06T01:00:00.000Z' }, { id: 'deleted', authorId: 'friend', author: '친구', body: '', deleted: true, createdAt: '2026-10-06T01:00:00.000Z' }] };
  const choices = journalReportChoices({ journey, threads: { [cardKey(journey.id, 'card-1')]: thread }, publicComments: [comment, { ...comment, commentId: 'wrong-journal', journalId: 'elsewhere' }, { ...comment, commentId: 'hidden', moderation: 'HIDDEN' }, { ...comment, commentId: 'photo-comment', cardId: 'photo-block' }], hiddenCommentIds: ['removed'], comments: [{ id: 'removed', journeyId: journey.id, author: '친구', body: '숨긴 댓글', createdAt: '2026-10-06T00:00:00.000Z', authorCopies: 0 }] });
  const reports = choices.filter(choice => choice.target.type === 'COMMENT');
  assert.deepEqual(reports.map(choice => choice.target.id), ['other-comment', 'reply']);
  assert.equal(reports[1].target.comment.parentId, 'other-comment');
  assert.equal(reports[1].target.cardId, 'card-1');
});
test('choosing a specific photo or comment produces the same receipt contract without leaking private notes', async () => {
  const entries = new Map(), storage = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) };
  const adapter = createReportAdapter({ localReview: true, storage });
  const choices = journalReportChoices({ journey, publicComments: [comment] });
  const selected = choices.find(choice => choice.target.id === 'journal-photo-1').target;
  const receipt = await adapter.submit(selected, 'COPYRIGHT', '확인 요청', new AbortController().signal);
  assert.equal(receipt.report.targetId, 'journal-photo-1'); assert.equal(receipt.report.cardId, 'photo-block');
  assert.equal(receipt.report.photoSnapshot.image, '/journal-photo.jpg');
  const commentReceipt = await adapter.submit(choices.find(choice => choice.target.type === 'COMMENT').target, 'ABUSE', '댓글 확인', new AbortController().signal);
  assert.equal(commentReceipt.report.targetId, 'other-comment'); assert.equal(commentReceipt.report.cardId, 'card-1');
  assert.ok(!JSON.stringify([...entries.values()]).includes('PRIVATE_NOTE'));
});
