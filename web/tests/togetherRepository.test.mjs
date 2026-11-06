import test from 'node:test';
import assert from 'node:assert/strict';
import { createTogetherRepository, togetherStorageKey, isTogetherState } from '../src/together/repository.ts';
import { createEmptyState, createGroupFromJourney, acceptInvite, copyJourneyForGroup, roomIdForGroup, roomIdForActivity, canEditActivity, isShareableJourney, snapshotJourneyForGroup, removeGroupMember, restoreGroupMemberAccess, approveGroupApplication, rejectGroupApplication, countGroupParticipants, setGroupParticipation, isMember } from '../src/together/model.ts';
import { createSeedState, TOGETHER_REVIEW_MEMBER_ID } from '../src/together/seed.ts';

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key), key: index => [...values.keys()][index], clear: () => values.clear(), get length() { return values.size; } };
}
const place = { id: 'food', kind: 'FOOD', name: '기존 음식점', area: '부산', address: '부산', lat: 35, lng: 129, image: '/existing.jpg', note: '비공개 메모', description: '공용 소개', duration: '1시간', visitId: 'old-visit', bookingFixed: true };
const journey = () => ({ id: 'personal-plan', purpose: 'PLAN', title: '원본 여행', region: '부산', dateRange: '', duration: '1박 2일', status: 'PLANNING', visibility: 'PRIVATE', cover: '/existing.jpg', summary: '개인 요약', story: '개인 이야기', tags: [], saves: 5, author: '원작자', isMine: true,
  planningPreferences: { prompt: '개인 요청' }, editorDraft: { secret: true }, travelProgress: { secret: true }, businessCandidates: [{ secret: true }],
  days: [{ dayId: 'old-day', day: 1, date: '', title: '첫날', story: '개인 DAY 메모', places: [{ ...place }], blocks: [{ id: 'old-block', type: 'PLACE', visitId: 'old-visit', placeId: 'food' }] }] });

test('together writes only an account-specific new namespace and preserves existing customer/admin bytes', () => {
  const disk = storage({ 'spotlog.web.journeys.v4': 'private-old', 'spotlog.admin.store': 'admin-old' });
  const one = createTogetherRepository('account-a', '가', [], disk);
  const two = createTogetherRepository('account-b', '나', [], disk);
  assert.equal(one.update(state => { state.members[0].name = '새 이름'; }), true);
  assert.equal(two.getSnapshot().members[0].name, '나');
  assert.equal(disk.getItem('spotlog.web.journeys.v4'), 'private-old');
  assert.equal(disk.getItem('spotlog.admin.store'), 'admin-old');
  assert.equal(disk.values.size, 3);
  assert.ok(disk.getItem(togetherStorageKey('account-a')));
  assert.notEqual(togetherStorageKey('a/b'), togetherStorageKey('a%2Fb'));
});

test('only the existing local review identity receives fictional joined scenes; other accounts remain nonmembers', () => {
  for (const viewer of ['', 'actual-member']) {
    const state = createSeedState(viewer, '이름', [place]);
    assert.ok(state.groups.every(group => group.visibility === 'PUBLIC' && !group.memberIds.includes(viewer)));
    assert.equal(state.messages.length, 0);
    assert.ok(state.activities.every(activity => state.groups.some(group => group.id === activity.groupId && group.visibility === 'PUBLIC' && group.promotionActivityIds.includes(activity.id))));
    assert.equal(state.media.length, 0);
  }
  const state = createSeedState(TOGETHER_REVIEW_MEMBER_ID, '검수', [place]);
  assert.ok(state.groups.some(group => group.memberIds.includes(TOGETHER_REVIEW_MEMBER_ID)));
  assert.ok(state.messages.some(message => message.roomId === roomIdForGroup('family-busan')));
  assert.ok(state.messages.some(message => message.roomId === roomIdForActivity('family-next')));
  assert.equal(state.invites[0].id, 'seed-family-invite');
  const accepted = structuredClone(state);
  const newGroupId = acceptInvite(accepted, 'seed-family-invite', TOGETHER_REVIEW_MEMBER_ID);
  assert.equal(accepted.groups.find(group => group.id === newGroupId).ownerId, 'example-friend');
  assert.equal(accepted.groups.length, state.groups.length + 1);
  assert.equal(isTogetherState(state), true);
});

test('a shared itinerary remaps independent DAY/visit/block IDs and booking constraints while stripping private notes and drafts', () => {
  const source = journey();
  source.days[0].places.push({ ...place, id: 'cafe', kind: 'CAFE', visitId: 'old-cafe', anchorVisitId: 'old-visit' });
  source.days[0].places[0].stayDayIds = ['old-day', 'old-day-2'];
  source.days.push({ ...source.days[0], dayId: 'old-day-2', day: 2, places: [] });
  const snapshot = structuredClone(source);
  const one = copyJourneyForGroup(source, '가족');
  const two = copyJourneyForGroup(source, '친구');
  assert.deepEqual(source, snapshot);
  assert.notEqual(one.id, two.id);
  assert.notEqual(one.days[0].dayId, source.days[0].dayId);
  assert.notEqual(one.days[0].places[0].visitId, two.days[0].places[0].visitId);
  assert.equal(one.days[0].places[1].anchorVisitId, one.days[0].places[0].visitId);
  assert.equal(one.days[0].blocks[0].visitId, one.days[0].places[0].visitId);
  assert.equal(one.days[0].places[0].note, '');
  assert.equal(one.days[0].places[0].bookingFixed, true);
  assert.deepEqual(one.days[0].places[0].stayDayIds, one.days.map(day => day.dayId));
  for (const field of ['editorDraft', 'travelProgress', 'planningPreferences', 'businessCandidates']) assert.equal(one[field], undefined);
  assert.equal(one.story, ''); assert.equal(one.days[0].story, ''); assert.notEqual(one.id, source.id);
  const missingIds = copyJourneyForGroup({ ...journey(), days: journey().days.concat(journey().days).map(day => ({ ...day, dayId: undefined })) }, '가족');
  assert.notEqual(missingIds.days[0].dayId, missingIds.days[1].dayId);
});

test('first acceptance binds one group to the shared intent; retries and a second token never duplicate it', () => {
  const state = createEmptyState('sender', '보낸 사람');
  state.members.push({ id: 'a', name: '가' }, { id: 'b', name: '나' });
  const invite = { id: 'token-a', intentId: 'one-intent', sourceTripId: 'personal-plan', sourceJourney: { ...journey(), businessCandidates: undefined }, senderId: 'sender', name: '가족', kind: 'FAMILY', region: '부산', acceptedBy: [], expiresAt: '2099-01-01T00:00:00Z', revoked: false };
  state.invites.push(invite, { ...structuredClone(invite), id: 'token-b' });
  const id = acceptInvite(state, 'token-a', 'a');
  assert.equal(acceptInvite(state, 'token-a', 'a'), id);
  assert.equal(acceptInvite(state, 'token-b', 'b'), id);
  assert.equal(state.groups.length, 1); assert.equal(state.activities.length, 1);
  assert.equal(state.groups[0].ownerId, 'sender');
  assert.deepEqual(state.groups[0].memberIds, ['sender', 'a', 'b']);
  assert.deepEqual(state.activities[0].participants, {});
  assert.deepEqual(state.invites[0].acceptedBy, ['a']);
  assert.throws(() => acceptInvite(state, 'token-a', 'sender'));
});

test('different intents from the same personal source create independent groups; expired/revoked invites do not create', () => {
  const state = createEmptyState('sender', '보낸 사람'); state.members.push({ id: 'a', name: '가' });
  for (const id of ['a', 'b', 'expired', 'revoked']) state.invites.push({ id, intentId: id, sourceTripId: 'same', senderId: 'sender', name: id, kind: 'FAMILY', region: '부산', acceptedBy: [], expiresAt: id === 'expired' ? '2000-01-01T00:00:00Z' : '2099-01-01T00:00:00Z', revoked: id === 'revoked' });
  assert.notEqual(acceptInvite(state, 'a', 'a'), acceptInvite(state, 'b', 'a'));
  assert.throws(() => acceptInvite(state, 'expired', 'a'));
  assert.throws(() => acceptInvite(state, 'revoked', 'a'));
  assert.equal(state.groups.length, 2);
});

test('journal sharing keeps authored text as an independent snapshot, without creating a future activity', () => {
  const state = createEmptyState('a', '가');
  const source = { ...journey(), purpose: 'JOURNAL', story: '공유할 여행기', days: journey().days.map(day => ({ ...day, story: '여행 후기', blocks: [{ id: 'text', type: 'TEXT', body: '후기 본문' }, ...day.blocks] })) };
  createGroupFromJourney(state, source, 'a');
  assert.equal(state.activities.length, 0); assert.equal(state.sharedJournals.length, 1);
  assert.equal(state.sharedJournals[0].journey.story, '공유할 여행기');
  assert.equal(state.sharedJournals[0].journey.days[0].blocks[0].body, '후기 본문');
  source.story = '나중에 수정'; assert.equal(state.sharedJournals[0].journey.story, '공유할 여행기');
});

test('malformed storage is preserved and blocked from overwrite', () => {
  const key = togetherStorageKey('a'); const disk = storage({ [key]: '{broken json' });
  const repo = createTogetherRepository('a', '가', [], disk);
  assert.ok(repo.getError());
  assert.equal(repo.update(state => { state.groups.length = 0; }), false);
  assert.equal(disk.getItem(key), '{broken json');
});

test('quota failure preserves previous snapshot and bytes; invalid recipes cannot persist', () => {
  const disk = storage(); const repo = createTogetherRepository('a', '가', [], disk);
  assert.equal(repo.update(state => { state.members[0].name = '저장된 이름'; }), true);
  const before = repo.getSnapshot(); const raw = disk.getItem(togetherStorageKey('a'));
  disk.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.equal(repo.update(state => { state.members[0].name = '실패한 이름'; }), false);
  assert.equal(repo.getSnapshot(), before); assert.equal(disk.getItem(togetherStorageKey('a')), raw); assert.ok(repo.getError());
  assert.equal(repo.update(state => { state.groups.push({ id: 'invalid' }); }), false);
  assert.equal(repo.getSnapshot(), before);
});

test('a concurrent tab change is loaded before rejecting stale edits', () => {
  const disk = storage(); const one = createTogetherRepository('a', '가', [], disk); const two = createTogetherRepository('a', '가', [], disk);
  assert.equal(one.update(state => { state.members[0].name = '첫 창'; }), true);
  let called = false;
  assert.equal(two.update(state => { called = true; state.members[0].name = '덮어쓰기'; }), false);
  assert.equal(called, false); assert.equal(two.getSnapshot().members[0].name, '첫 창');
  assert.equal(two.update(state => { state.members[0].name = '다시 확인 후'; }), true);
});

test('activity editors must still be active group members; archiving revokes editing', () => {
  const state = createSeedState(TOGETHER_REVIEW_MEMBER_ID, '검수', []); const activity = state.activities.find(item => item.id === 'family-next');
  assert.equal(canEditActivity(state, TOGETHER_REVIEW_MEMBER_ID, activity), true);
  activity.editorIds.push('outsider'); assert.equal(canEditActivity(state, 'outsider', activity), false);
  state.groups.find(group => group.id === activity.groupId).archived = true;
  assert.equal(canEditActivity(state, TOGETHER_REVIEW_MEMBER_ID, activity), false);
});

test('unfinished route candidates cannot be silently converted to confirmed group visits', () => {
  const state = createEmptyState('a', '가'); const source = journey();
  assert.equal(isShareableJourney(source), false);
  assert.throws(() => createGroupFromJourney(state, source, 'a'));
  assert.equal(state.groups.length, 0);
  assert.throws(() => createGroupFromJourney(state, { ...source, businessCandidates: undefined, planStage: 'DRAFT' }, 'a'));
  const ready = { ...source, businessCandidates: undefined, planStage: 'READY', startDate: '2026-11-01', days: source.days.map(day => ({ ...day, date: '2026-11-02' })) };
  assert.equal(isShareableJourney(ready), true);
  createGroupFromJourney(state, ready, 'a');
  assert.equal(state.activities[0].date, '2026-11-01');
  assert.equal(state.activities[0].endDate, '2026-11-02');
  assert.equal(state.activities[0].journey.startDate, '2026-11-01');
});

test('sanitized journal invitation snapshots preserve journal mode and never create an unintended future trip', () => {
  const source = { ...journey(), purpose: 'JOURNAL', story: '함께 볼 후기', sourceJourneyId: 'older-public-source' };
  const snapshot = snapshotJourneyForGroup(source, '보낸 사람');
  assert.equal(snapshot.purpose, 'JOURNAL'); assert.equal(snapshot.story, '함께 볼 후기');
  assert.equal(snapshot.sourceJourneyId, source.id);
  assert.equal(snapshot.planningPreferences, undefined); assert.equal(snapshot.days[0].places[0].note, '');
  const state = createEmptyState('sender', '보낸 사람'); state.members.push({ id: 'recipient', name: '받는 사람' });
  state.invites.push({ id: 'journal-invite', intentId: 'journal-intent', sourceTripId: source.id, sourceJourney: snapshot, senderId: 'sender', name: '추억 모임', kind: 'FAMILY', region: '부산', acceptedBy: [], expiresAt: '2099-01-01T00:00:00Z', revoked: false });
  acceptInvite(state, 'journal-invite', 'recipient');
  assert.equal(state.activities.length, 0); assert.equal(state.sharedJournals.length, 1);
  assert.equal(state.sharedJournals[0].journey.story, '함께 볼 후기');
  assert.equal(state.sharedJournals[0].sourceJourneyId, source.id);
});

test('member removal revokes only the selected group, retains history and blocks old invites and approvals', () => {
  const state = createSeedState(TOGETHER_REVIEW_MEMBER_ID, '검수', [place]);
  const group = state.groups.find(item => item.id === 'family-busan');
  const other = state.groups.find(item => item.id === 'weekend-walk'); other.memberIds.push('example-sibling');
  const messageHistory = structuredClone(state.messages); const photoHistory = structuredClone(state.media);
  const activity = state.activities.find(item => item.id === 'family-next'); activity.arrivedIds.push('example-sibling');
  state.invites.push({ id: 'old-family-link', intentId: 'old-family-intent', groupId: group.id, senderId: TOGETHER_REVIEW_MEMBER_ID, name: group.name, kind: 'FAMILY', region: '부산', acceptedBy: ['example-sibling'], expiresAt: '2099-01-01T00:00:00Z', revoked: false });
  state.applications.push({ id: 'kicked-application', groupId: group.id, userId: 'example-sibling', status: 'PENDING' });
  removeGroupMember(state, group.id, TOGETHER_REVIEW_MEMBER_ID, 'example-sibling');
  assert.equal(isMember(state, 'example-sibling', group.id), false);
  assert.equal(isMember(state, 'example-sibling', other.id), true);
  assert.equal(canEditActivity(state, 'example-sibling', activity), false);
  assert.equal(activity.editorIds.includes('example-sibling'), false);
  assert.equal(activity.arrivedIds.includes('example-sibling'), true);
  assert.equal(activity.participants['example-sibling'], 'MAYBE');
  assert.deepEqual(state.messages, messageHistory); assert.deepEqual(state.media, photoHistory);
  assert.throws(() => acceptInvite(state, 'old-family-link', 'example-sibling'));
  assert.throws(() => approveGroupApplication(state, 'kicked-application', TOGETHER_REVIEW_MEMBER_ID));
  assert.equal(state.applications.find(item => item.id === 'kicked-application').status, 'DECLINED');
  restoreGroupMemberAccess(state, group.id, TOGETHER_REVIEW_MEMBER_ID, 'example-sibling');
  assert.equal(isMember(state, 'example-sibling', group.id), false);
  assert.throws(() => approveGroupApplication(state, 'kicked-application', TOGETHER_REVIEW_MEMBER_ID));
  state.applications.find(item => item.id === 'kicked-application').status = 'PENDING'; // an explicit new request
  approveGroupApplication(state, 'kicked-application', TOGETHER_REVIEW_MEMBER_ID);
  assert.equal(isMember(state, 'example-sibling', group.id), true);
});

test('owner and manager removal permissions cannot be bypassed; old schema stays valid', () => {
  const state = createSeedState(TOGETHER_REVIEW_MEMBER_ID, '검수', [place]);
  const group = state.groups.find(item => item.id === 'family-busan'); group.managerIds.push('example-sibling', 'example-parent');
  assert.equal(isTogetherState(state), true);
  assert.throws(() => removeGroupMember(state, group.id, 'example-sibling', group.ownerId));
  assert.throws(() => removeGroupMember(state, group.id, group.ownerId, group.ownerId));
  assert.throws(() => removeGroupMember(state, group.id, 'example-sibling', 'example-parent'));
  assert.throws(() => removeGroupMember(state, group.id, 'outsider', 'example-parent'));
  assert.throws(() => restoreGroupMemberAccess(state, group.id, 'outsider', 'example-parent'));
  removeGroupMember(state, group.id, group.ownerId, 'example-parent');
  assert.equal(group.managerIds.includes('example-parent'), false);
  assert.equal(group.blockedMemberIds.includes('example-parent'), true);
  assert.equal(isTogetherState(state), true);
});

test('a rejected domain operation keeps input feedback and never partially saves draft changes', () => {
  const disk = storage(); const repo = createTogetherRepository('a', '가', [], disk); const snapshot = repo.getSnapshot();
  assert.equal(repo.update(draft => { draft.members[0].name = '실패할 변경'; throw new Error('후보와 방문 장소를 먼저 확인해 주세요.'); }), false);
  assert.equal(repo.getError(), '후보와 방문 장소를 먼저 확인해 주세요.');
  assert.equal(repo.getSnapshot(), snapshot); assert.equal(disk.length, 0);
});

test('messages accept only a closed sticker identifier with the required text contract and reject remote image injection', () => {
  const disk = storage(); const repo = createTogetherRepository('a', '가', [], disk);
  const base = { id: 'sticker-message', roomId: 'group:own', authorId: 'a', body: '함께 가요!', createdAt: '2026-10-28T00:00:00Z', stickerId: 'bunny-hi' };
  assert.equal(repo.update(state => { state.messages.push(base); }), true);
  const saved = repo.getSnapshot(); const bytes = disk.getItem(togetherStorageKey('a'));
  assert.equal(saved.messages.at(-1).body, '함께 가요!');
  for (const id of ['unknown-sticker', 'https://example.com/track.svg', 'data:image/svg+xml,<svg onload=alert(1)>', 'javascript:alert(1)', '', 17]) {
    assert.equal(repo.update(state => { state.messages.push({ ...base, id: `invalid-${id}`, stickerId: id }); }), false);
    assert.equal(repo.getSnapshot(), saved); assert.equal(disk.getItem(togetherStorageKey('a')), bytes);
  }
  assert.equal(repo.update(state => { const { body: _body, ...missingText } = base; state.messages.push(missingText); }), false);
  assert.equal(repo.getSnapshot(), saved);
  assert.equal(repo.update(state => { state.messages.push({ ...base, id: 'plain-text', stickerId: undefined }); }), true);
});

test('application decisions require operating permission, respect pending state, and cannot duplicate or revive old memberships', () => {
  const state = createSeedState(TOGETHER_REVIEW_MEMBER_ID, '검수', []); const group = state.groups.find(group => group.id === 'family-busan');
  const application = state.applications.find(item => item.id === 'seed-family-application'); application.message = '책과 취미 이야기를 함께하고 싶어요.'; application.createdAt = '2026-10-28T00:00:00Z';
  assert.throws(() => approveGroupApplication(state, application.id, 'example-parent'));
  assert.throws(() => rejectGroupApplication(state, application.id, 'outsider'));
  approveGroupApplication(state, application.id, TOGETHER_REVIEW_MEMBER_ID);
  const decided = application.decidedAt; approveGroupApplication(state, application.id, TOGETHER_REVIEW_MEMBER_ID);
  assert.equal(group.memberIds.filter(id => id === application.userId).length, 1);
  assert.equal(application.decidedAt, decided); assert.equal(application.decidedBy, TOGETHER_REVIEW_MEMBER_ID);
  assert.equal(application.message, '책과 취미 이야기를 함께하고 싶어요.');
  group.memberIds = group.memberIds.filter(id => id !== application.userId);
  assert.throws(() => approveGroupApplication(state, application.id, TOGETHER_REVIEW_MEMBER_ID));
  application.status = 'PENDING'; rejectGroupApplication(state, application.id, TOGETHER_REVIEW_MEMBER_ID);
  assert.equal(application.status, 'DECLINED');
  assert.throws(() => approveGroupApplication(state, application.id, TOGETHER_REVIEW_MEMBER_ID));
  assert.throws(() => rejectGroupApplication(state, application.id, TOGETHER_REVIEW_MEMBER_ID));
  application.status = 'PENDING'; group.archived = true;
  assert.throws(() => approveGroupApplication(state, application.id, TOGETHER_REVIEW_MEMBER_ID));
});

test('RSVP checks active membership, cancellation, capacity and concurrent last-seat writes', () => {
  const disk = storage(); const initial = createTogetherRepository('owner', '운영자', [], disk);
  initial.update(state => {
    state.members.push({ id: 'a', name: '가' }, { id: 'b', name: '나' });
    state.groups.push({ id: 'capacity-group', name: '동네 모임', kind: 'HOBBY', region: '부산', introduction: '', cover: '', visibility: 'PRIVATE', ownerId: 'owner', memberIds: ['owner', 'a', 'b'], managerIds: [], archived: false, promotionPublished: false });
    state.activities.push({ id: 'last-seat', groupId: 'capacity-group', title: '책 한 권 이야기', date: '', endDate: '', startTime: '19:30', capacity: 1, kind: 'MEETUP', meetingPoint: '', description: '', status: 'PLANNED', leadId: 'owner', editorIds: [], participants: { removed: 'JOINED' }, arrivedIds: [], revision: 1 });
  });
  const first = createTogetherRepository('owner', '운영자', [], disk); const second = createTogetherRepository('owner', '운영자', [], disk);
  assert.equal(first.update(state => setGroupParticipation(state, 'last-seat', 'a', 'JOINED')), true);
  assert.equal(second.update(state => setGroupParticipation(state, 'last-seat', 'b', 'JOINED')), false); // stale snapshot refreshed first
  assert.equal(second.update(state => setGroupParticipation(state, 'last-seat', 'b', 'JOINED')), false); // capacity protects retry
  assert.equal(countGroupParticipants(second.getSnapshot(), 'last-seat'), 1);
  assert.equal(first.update(state => setGroupParticipation(state, 'last-seat', 'a', 'JOINED')), true); // idempotent
  assert.equal(second.update(state => setGroupParticipation(state, 'last-seat', 'b', 'MAYBE')), true);
  const state = structuredClone(second.getSnapshot());
  assert.throws(() => setGroupParticipation(state, 'last-seat', 'outsider', 'JOINED'));
  state.activities.find(item => item.id === 'last-seat').status = 'COMPLETED';
  assert.throws(() => setGroupParticipation(state, 'last-seat', 'a', 'DECLINED'));
  assert.equal(isTogetherState(state), true);
  state.activities.find(item => item.id === 'last-seat').capacity = 501; assert.equal(isTogetherState(state), false);
});

test('existing-group invites require a currently active owner or manager, including after a personal intent was accepted', () => {
  const state = createEmptyState('owner', '모임장'); state.members.push({ id: 'manager', name: '운영진' }, { id: 'ordinary', name: '모임원' }, { id: 'recipient', name: '수락자' }, { id: 'second', name: '다음 수락자' });
  state.groups.push({ id: 'g', name: '모임', kind: 'HOBBY', region: '부산', introduction: '', cover: '', visibility: 'PRIVATE', ownerId: 'owner', memberIds: ['owner', 'manager', 'ordinary'], managerIds: ['manager'], archived: false, promotionPublished: false });
  const invite = { id: 'link', intentId: 'existing', groupId: 'g', senderId: 'ordinary', name: '모임', kind: 'HOBBY', region: '부산', acceptedBy: [], expiresAt: '2099-01-01T00:00:00Z', revoked: false }; state.invites.push(invite);
  assert.throws(() => acceptInvite(state, invite.id, 'recipient'));
  invite.senderId = 'manager'; assert.equal(acceptInvite(state, invite.id, 'recipient'), 'g');
  state.groups[0].memberIds = state.groups[0].memberIds.filter(id => id !== 'manager');
  assert.throws(() => acceptInvite(state, invite.id, 'second'));
  const personal = { ...invite, id: 'personal-intent', intentId: 'personal-intent', groupId: undefined, senderId: 'owner', sourceJourney: { ...journey(), businessCandidates: undefined }, acceptedBy: [] }; state.invites.push(personal);
  const created = acceptInvite(state, personal.id, 'second'); const newGroup = state.groups.find(group => group.id === created);
  assert.equal(newGroup.ownerId, 'owner');
  newGroup.memberIds.push('manager'); newGroup.ownerId = 'manager'; newGroup.managerIds.push('owner');
  assert.throws(() => acceptInvite(state, personal.id, 'recipient')); // new personal-intent owner must still be the sender
});
