import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCreationGroupDraft, buildCreationPlans, interpretCreationPrompt } from '../src/together/creationPlanner.ts';
import { completeCreationReview, creationPreviewCatalog, restoreCreationPreview, snapshotCreationPreview } from '../src/together/creationPreview.ts';

const place = (id, extra = {}) => ({ id, kind: 'FOOD', name: '같은 상호', area: '부산 중구', address: `부산 중구 ${id} 지점`, lat: 35.1, lng: 129.03, image: '', description: '공개 소개', note: '개인 메모', duration: '1시간', ...extra });
const catalog = [place('branch-a'), place('branch-b')];
const brief = () => interpretCreationPrompt('부산에서 친구와 식사', { region: '부산', date: '2026-11-10' });
const review = (extra = {}) => { const input = brief(); return { brief: input, plan: buildCreationPlans(input, catalog)[0], previewOnly: true, checked: true, dateUnconfirmed: false, ...extra }; };

test('guest catalog preserves exact branches and public media identities without visit or personal metadata', () => {
  const records = [place('branch-a', { visitId: 'private-visit', anchorVisitId: 'private-anchor', stayDayIds: ['private-day'], time: '개인 시각', move: '개인 이동', creator: '개인 작성자',
    tags: ['식사'], photos: [{ mediaId: 'media-a', placeId: 'branch-a', sourceId: 'source-a', image: 'a.jpg', alt: '공개 사진', caption: '공개 설명', ownerEmail: 'secret@example.com' }] }),
    place('branch-b'), place('personal', { personal: true }), place('fixed', { bookingFixed: true }),
    place('draft', { publicationStatus: 'DRAFT' }), place('private', { visibility: 'PRIVATE' }),
    place('withdrawn', { publicationStatus: 'WITHDRAWN' }), place('duplicate'), place('duplicate')];
  const before = structuredClone(records);
  const result = creationPreviewCatalog(records);
  assert.deepEqual(result.map(item => item.id), ['branch-a', 'branch-b']);
  assert.equal(result[0].note, '');
  for (const key of ['visitId', 'anchorVisitId', 'stayDayIds', 'time', 'move', 'creator']) assert.equal(key in result[0], false);
  assert.equal(result[0].photos[0].mediaId, 'media-a');
  assert.equal('ownerEmail' in result[0].photos[0], false);
  result[0].tags.push('변경'); result[0].photos[0].caption = '변경';
  assert.deepEqual(records, before);
});

test('explicit guest final action only requests login and never invokes the member save/share callback', async () => {
  let logins = 0, saves = 0, handedOff;
  const input = review();
  const before = structuredClone(input);
  assert.equal(await completeCreationReview(input, catalog, { onReview() { saves++; return true; }, onLoginRequired(draft) { logins++; handedOff = draft; } }), 'LOGIN_REQUIRED');
  assert.equal(logins, 1); assert.equal(saves, 0);
  assert.deepEqual(handedOff.plan.placeIds, input.plan.placeIds);
  assert.deepEqual(handedOff.plan.days, input.plan.days);
  assert.equal('checked' in handedOff, false);
  assert.equal('previewOnly' in handedOff, false);
  handedOff.plan.placeIds.push('changed');
  assert.deepEqual(input, before);
});

test('login restoration is not confirmation: reset consent and require a new explicit review before one save', async () => {
  const input = review(); let saves = 0;
  const snapshot = snapshotCreationPreview(input.brief, input.plan);
  const restored = restoreCreationPreview({ ...snapshot, checked: true, dateUnconfirmed: true, groupId: 'old-private-group' }, catalog);
  assert.equal(restored.ready, true); assert.equal(restored.checked, false); assert.equal(restored.dateUnconfirmed, false);
  assert.equal('groupId' in restored, false);
  assert.equal(saves, 0);
  const actions = { onReview() { saves++; return true; } };
  await assert.rejects(completeCreationReview({ ...restored, previewOnly: false }, catalog, actions), /체크/);
  assert.equal(saves, 0);
  assert.equal(await completeCreationReview({ ...restored, previewOnly: false, checked: true }, catalog, actions), 'SAVED');
  assert.equal(saves, 1);
});

test('a place withdrawn or replaced by a namesake after login is never silently substituted', async () => {
  const input = review();
  const snapshot = snapshotCreationPreview(input.brief, input.plan);
  const exactId = snapshot.plan.placeIds[0];
  const changed = catalog.map(item => item.id === exactId ? { ...item, publicationStatus: 'WITHDRAWN' } : item).concat(place('new-branch'));
  const restored = restoreCreationPreview(snapshot, changed);
  assert.equal(restored.ready, false);
  assert.deepEqual(restored.plan.placeIds, snapshot.plan.placeIds);
  let saves = 0;
  await assert.rejects(completeCreationReview({ ...restored, previewOnly: false, checked: true }, changed, { onReview() { saves++; return true; } }), /공개 상태/);
  assert.equal(saves, 0);
});

test('date-undecided drafts must be explicitly reconfirmed and preserve empty multi-DAY travel', async () => {
  const input = interpretCreationPrompt('부산 가족 2박 3일 여행', { locationUndecided: true });
  const plan = buildCreationPlans(input, [])[0];
  const restored = restoreCreationPreview(snapshotCreationPreview(input, plan), []);
  assert.equal(restored.ready, true); assert.equal(restored.plan.days.length, 3);
  assert.ok(restored.plan.days.every(day => !day.placeIds.length));
  let logins = 0;
  const actions = { onReview() { throw new Error('guest must not save'); }, onLoginRequired() { logins++; } };
  await assert.rejects(completeCreationReview({ ...restored, previewOnly: true, checked: true }, [], actions), /체크/);
  assert.equal(logins, 0);
  assert.equal(await completeCreationReview({ ...restored, previewOnly: true, checked: true, dateUnconfirmed: true }, [], actions), 'LOGIN_REQUIRED');
  assert.equal(logins, 1);
});

test('guest persistent-group preview carries only its editable proposal and never creates membership', async () => {
  const input = interpretCreationPrompt('부산에서 책 모임 만들기');
  const groupDraft = { ...buildCreationGroupDraft(input), memberIds: ['private-member'], ownerId: 'private-owner', promotionPublished: true };
  let handedOff;
  assert.equal(await completeCreationReview({ brief: input, plan: null, groupDraft, previewOnly: true, checked: true, dateUnconfirmed: false }, [], {
    onReview() { throw new Error('no group creation before login'); }, onLoginRequired(value) { handedOff = value; },
  }), 'LOGIN_REQUIRED');
  assert.deepEqual(handedOff.groupDraft.topics, ['BOOK']);
  for (const key of ['memberIds', 'ownerId', 'promotionPublished']) assert.equal(key in handedOff.groupDraft, false);
  assert.equal(restoreCreationPreview(handedOff, []).checked, false);
});

test('missing login handler and noncatalog proposals never report a successful save', async () => {
  await assert.rejects(completeCreationReview(review(), catalog, { onReview() { throw new Error('must not save'); } }), /로그인 화면/);
  const input = review();
  await assert.rejects(completeCreationReview({ ...input, plan: { ...input.plan, source: 'LLM' } }, catalog, { onReview() { throw new Error('must not save'); }, onLoginRequired() { throw new Error('must not login with invalid draft'); } }), /연결되지 않은/);
});
