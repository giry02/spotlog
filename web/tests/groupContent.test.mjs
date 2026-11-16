import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { addGroupPost, changeGroupRole, createFactualReviewDraft, selectGroupMembers, selectPublicGroupIntroduction, selectReviewDraftFacts, setOwnMemberAvatar, withdrawPublicReviewPreview } from '../src/together/groupContent.ts';
import { isPublicReviewPreview, isSafeTogetherImageUrl, isTogetherPhotoAttachments, MAX_POST_PHOTO_BYTES, MAX_STORED_PHOTO_BYTES } from '../src/together/contentMedia.ts';
import { isTogetherState } from '../src/together/repository.ts';

const photo = `data:image/png;base64,${Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]).toString('base64')}`;
const attachment = (id = 'p', url = photo) => ({ id, url, caption: '내가 선택한 사진' });
function fixture() {
  const state = createEmptyState('me', '나');
  state.members.push({ id: 'owner', name: '모임장' }, { id: 'member', name: '다른 멤버' }, { id: 'outsider', name: '외부인' });
  state.groups.push({ id: 'g', name: '산책 모임', kind: 'HOBBY', region: '부산', introduction: '공개 소개', cover: '', visibility: 'PUBLIC', promotionPublished: true,
    ownerId: 'owner', memberIds: ['owner', 'me', 'member'], managerIds: [], archived: false, promotionActivityIds: ['a'],
    memberProfiles: { member: { nickname: '가명', introduction: '선택 가입 소개 비밀', answers: [], availableTimes: [], rulesAccepted: true } } });
  state.groups.push({ ...structuredClone(state.groups[0]), id: 'other', ownerId: 'outsider', memberIds: ['outsider'], promotionActivityIds: [] });
  state.activities.push(...['a', 'b'].map(id => ({ id, groupId: 'g', title: `약속 ${id}`, date: '2026-11-09', endDate: '2026-11-09', meetingPoint: '정확한 만남 장소 비밀', description: '', status: 'PLANNED', leadId: 'owner', editorIds: [], participants: { me: 'JOINED' }, arrivedIds: ['me'], revision: 1 })));
  state.messages.push({ id: 'secret', roomId: 'activity:a', authorId: 'owner', body: '비밀 채팅', createdAt: '2026-11-09T00:00:00Z' });
  for (const [id, authorId, activityId, groupId] of [['own-root','me',undefined,'g'],['own-a','me','a','g'],['own-b','me','b','g'],['another-a','member','a','g'],['foreign','outsider',undefined,'other']]) state.posts.push({ id, authorId, activityId, groupId, title: id, body: `${id} 본문`, category: 'REVIEW', createdAt: '2026-11-09T00:00:00Z', likes: [], comments: [] });
  return state;
}

test('photo validation accepts bounded raster URLs and rejects executable, credentialed, SVG and unbounded payloads', () => {
  for (const value of [photo, 'https://example.test/photo.jpg', '/spotlog/media/photo.webp']) assert.equal(isSafeTogetherImageUrl(value), true, value);
  for (const value of ['', 'javascript:alert(1)', '//evil.test/a.jpg', 'http://example.test/a.jpg', 'https://user:secret@example.test/a.jpg', 'data:image/svg+xml;base64,PHN2Zy8+', 'data:text/html;base64,PHNjcmlwdD4=', 'data:image/png;base64,YWJj', 'data:image/png;base64,' + 'A'.repeat(MAX_STORED_PHOTO_BYTES * 2), '/media/../a.jpg', '/media\\a.jpg']) assert.equal(isSafeTogetherImageUrl(value), false, value.slice(0, 80));
  assert.equal(isTogetherPhotoAttachments([attachment()]), true);
  assert.equal(isTogetherPhotoAttachments([attachment(), attachment()]), false);
  assert.equal(isTogetherPhotoAttachments(Array.from({ length: 5 }, (_, i) => attachment(`${i}`))), false);
  assert.equal(isTogetherPhotoAttachments([{ ...attachment(), attackerField: 'discard me' }]), false);
});

test('post photo budget is enforced across all attachments rather than only per image', () => {
  const bytes = Buffer.alloc(MAX_STORED_PHOTO_BYTES); Buffer.from([137,80,78,71,13,10,26,10]).copy(bytes);
  const url = `data:image/png;base64,${bytes.toString('base64')}`;
  assert.equal(isSafeTogetherImageUrl(url), true);
  assert.ok(MAX_STORED_PHOTO_BYTES * 3 > MAX_POST_PHOTO_BYTES);
  assert.equal(isTogetherPhotoAttachments([attachment('1',url), attachment('2',url)]), true);
  assert.equal(isTogetherPhotoAttachments([attachment('1',url), attachment('2',url), attachment('3',url)]), false);
});

test('factual and AI source facts intersect exact own author/group/activity and omit private attendance, chat and route', () => {
  const state = fixture(), before = structuredClone(state);
  const facts = selectReviewDraftFacts(state, 'me', 'g', 'a');
  assert.deepEqual(facts.ownReviews.map(item => item.id), ['own-a']);
  assert.deepEqual(facts.activities.map(item => item.id), ['a']);
  assert.deepEqual(selectReviewDraftFacts(state, 'me', 'g').ownReviews.map(item => item.id), ['own-root']);
  const output = JSON.stringify(facts);
  for (const secret of ['비밀 채팅', '정확한 만남 장소 비밀', 'participants', 'arrivedIds', 'another-a', 'own-b', 'foreign']) assert.equal(output.includes(secret), false);
  const draft = createFactualReviewDraft(facts);
  assert.match(draft.body, /약속 a/); assert.match(draft.body, /2026-11-09/);
  for (const fabricated of ['참석했', '즐거웠', '사진을 찍', 'AI가']) assert.equal(draft.body.includes(fabricated), false);
  assert.deepEqual(state, before);
});

test('draft source rejects guests, unrelated accounts, blocked users and sibling appointment scopes', () => {
  for (const actor of ['', 'outsider', 'ghost']) assert.throws(() => selectReviewDraftFacts(fixture(), actor, 'g', 'a'));
  assert.throws(() => selectReviewDraftFacts(fixture(), 'me', 'g', 'missing'));
  const state = fixture(); state.groups[0].blockedMemberIds = ['me'];
  assert.throws(() => selectReviewDraftFacts(state, 'me', 'g', 'a'));
});

test('post write rechecks current membership, archived/cancelled scopes and notice authority without partial changes', () => {
  const input = { title:'직접 쓴 후기',body:'내용',category:'REVIEW',attachments:[attachment()] };
  for (const change of [state => state.groups[0].memberIds = ['owner'], state => state.groups[0].blockedMemberIds = ['me'], state => state.groups[0].archived = true, state => state.activities[0].status = 'CANCELLED']) {
    const state = fixture(); change(state); const before = structuredClone(state);
    assert.throws(() => addGroupPost(state, 'me', 'g', input, 'a')); assert.deepEqual(state, before);
  }
  assert.throws(() => addGroupPost(fixture(), 'me', 'g', { ...input, category:'NOTICE' }));
  const state = fixture(), id = addGroupPost(state,'me','g',input,'a');
  const result = state.posts.find(item => item.id === id); assert.equal(result.activityId,'a'); assert.equal(result.attachments[0].url,photo);
  input.attachments[0].caption = '후속 편집'; assert.notEqual(result.attachments[0].caption,input.attachments[0].caption);
  assert.ok(isTogetherState(state));
});

test('public introduction contains only public metadata and separate explicit review previews', () => {
  const state = fixture();
  let intro = selectPublicGroupIntroduction(state,'g'); assert.equal(intro.publicReviewCount,0);
  addGroupPost(state,'me','g',{title:'내 공개 제목',body:'개인 본문 비밀',category:'REVIEW',attachments:[attachment()],publicExcerpt:'직접 공개한 짧은 후기'},'a');
  intro = selectPublicGroupIntroduction(state,'g');
  assert.equal(intro.memberCount,3); assert.equal(intro.publicReviewCount,1); assert.equal(intro.publishedActivityCount,1);
  const output = JSON.stringify(intro);
  for (const secret of ['개인 본문 비밀', 'own-root', 'own-a', 'authorId', 'memberIds', 'participants', 'arrivedIds', '정확한 만남 장소 비밀', '비밀 채팅', '선택 가입 소개 비밀', 'data:image']) assert.equal(output.includes(secret),false,secret);
  assert.match(output,/직접 공개한 짧은 후기/);
  state.groups[0].memberIds = ['owner','member']; assert.equal(selectPublicGroupIntroduction(state,'g').publicReviewCount,0);
});

test('private, unpublished, archived and blocked group introductions do not become public', () => {
  for (const change of [state => state.groups[0].visibility = 'PRIVATE', state => state.groups[0].promotionPublished = false, state => state.groups[0].archived = true, state => state.groups[0].spaceType = 'ACTIVITY']) {
    const state = fixture(); change(state); assert.equal(selectPublicGroupIntroduction(state,'g'),null);
    assert.throws(() => addGroupPost(state,'me','g',{title:'후기',body:'글',category:'REVIEW',attachments:[],publicExcerpt:'공개요약'}));
  }
  const state = fixture(); state.groups[0].blockedMemberIds = ['me']; assert.equal(selectPublicGroupIntroduction(state,'g','me'),null);
  assert.equal(isPublicReviewPreview({title:'a',excerpt:'b',publishedAt:'2026-11-09',authorId:'private'}),false);
});

test('member directory preserves prior join-profile visibility and own avatar changes cannot target another account', () => {
  const state = fixture();
  assert.equal(selectGroupMembers(state,'outsider','g'),null);
  assert.equal(selectGroupMembers(state,'me','g').find(item => item.id === 'member').introduction,'');
  assert.equal(selectGroupMembers(state,'owner','g').find(item => item.id === 'member').introduction,'선택 가입 소개 비밀');
  const owner = structuredClone(state.members.find(item => item.id === 'owner'));
  setOwnMemberAvatar(state,'me','g',photo); assert.equal(state.members.find(item => item.id === 'me').avatar,photo);
  assert.deepEqual(state.members.find(item => item.id === 'owner'),owner);
  assert.ok(isTogetherState(state)); setOwnMemberAvatar(state,'me','g',''); assert.equal(state.members.find(item => item.id === 'me').avatar,undefined);
  assert.throws(() => setOwnMemberAvatar(state,'outsider','g',photo));
  assert.throws(() => setOwnMemberAvatar(state,'me','g','javascript:alert(1)'));
});

test('manager appointment and ownership transfer are separate owner-only operations with stale membership checks', () => {
  const state = fixture();
  for (const actor of ['', 'me', 'outsider']) assert.throws(() => changeGroupRole(state,actor,'g','member','MANAGER'));
  changeGroupRole(state,'owner','g','member','MANAGER'); assert.deepEqual(state.groups[0].managerIds,['member']);
  assert.throws(() => changeGroupRole(state,'member','g','me','MANAGER'));
  changeGroupRole(state,'owner','g','member','MEMBER'); assert.deepEqual(state.groups[0].managerIds,[]);
  assert.throws(() => changeGroupRole(state,'owner','g','outsider','MANAGER'));
  assert.throws(() => changeGroupRole(state,'owner','g','owner','OWNER'));
  assert.throws(() => changeGroupRole(state,'owner','g','me','UNKNOWN'));
  changeGroupRole(state,'owner','g','me','OWNER'); assert.equal(state.groups[0].ownerId,'me'); assert.ok(state.groups[0].memberIds.includes('owner'));
  assert.throws(() => changeGroupRole(state,'owner','g','member','MANAGER'));
});

test('public excerpt can be withdrawn without changing the private post, including by its departed author', () => {
  const state = fixture(), id = addGroupPost(state,'me','g',{title:'공개 제목',body:'원래 본문',category:'REVIEW',attachments:[attachment()],publicExcerpt:'공개 요약'});
  const before = structuredClone(state.posts.find(item => item.id === id));
  assert.throws(() => withdrawPublicReviewPreview(state,'member',id));
  assert.throws(() => withdrawPublicReviewPreview(state,'outsider',id));
  state.groups[0].memberIds = ['owner','member'];
  withdrawPublicReviewPreview(state,'me',id);
  const after = state.posts.find(item => item.id === id); delete before.publicPreview; assert.deepEqual(after,before);
  assert.equal(selectPublicGroupIntroduction(state,'g').publicReviewCount,0);
});

test('schema-v1 optional additions reject unsafe images and private fields in public preview payloads', () => {
  assert.ok(isTogetherState(fixture()));
  for (const modify of [state => state.members[0].avatar = 'javascript:alert(1)', state => state.activities[0].cover = 'data:image/svg+xml;base64,PHN2Zy8+', state => state.posts[0].attachments = [attachment('x','javascript:alert(1)')], state => state.posts[0].publicPreview = {title:'공개',excerpt:'요약',publishedAt:'2026-11-09',privateRoute:'숨겨야 함'}]) {
    const state = fixture(); modify(state); assert.equal(isTogetherState(state),false);
  }
});
