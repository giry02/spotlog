import test from 'node:test';
import assert from 'node:assert/strict';
import { createMembershipReviewState, MEMBERSHIP_REVIEW_GROUP } from './membershipReviewFixture.ts';
import { selectJoinOnboarding, selectPendingMemberships } from '../src/together/joinOnboarding.ts';
import { createPublicActivityIntent, joinPublicGroup, publicGroupJoinVersion, requestGroupApplication } from '../src/together/publicActivityIntent.ts';
import { approveGroupApplication } from '../src/together/model.ts';

const actor = 'review-applicant';
const fixture = () => createMembershipReviewState(new Date('2099-10-28T16:00:00Z'), { multiplePublicActivities: true });
const receipt = (extra = {}) => ({ id: 'joined-receipt', groupId: MEMBERSHIP_REVIEW_GROUP, userId: actor, status: 'APPROVED', createdAt: '2099-10-27T09:00:00Z', decidedAt: '2099-10-28T10:00:00Z', ...extra });
const join = state => { state.groups[0].memberIds.push(actor); };

test('direct and approval first-entry hints use the accepted receipt without changing attendance or other shared content', () => {
  for (const mode of ['DIRECT', 'APPROVAL', undefined]) {
    const state = fixture();
    join(state);
    state.applications.push(receipt(mode ? { joinMode: mode } : {}));
    const before = structuredClone(state), hint = selectJoinOnboarding(state, actor, MEMBERSHIP_REVIEW_GROUP);
    assert.deepEqual(hint, { key: `${actor}:${MEMBERSHIP_REVIEW_GROUP}:joined-receipt:2099-10-28T10:00:00Z`, mode: mode ?? 'APPROVAL' });
    assert.deepEqual(state, before);
    assert.deepEqual(state.activities.map(item => item.participants[actor]), [undefined, undefined]);
    assert.deepEqual(selectPendingMemberships(state, actor), []);
  }
});

test('current membership alone cannot fabricate a join receipt, and another account or group receipt cannot be reused', () => {
  const state = fixture();
  join(state);
  assert.equal(selectJoinOnboarding(state, actor, MEMBERSHIP_REVIEW_GROUP), null);
  state.applications.push(receipt({ userId: 'review-owner' }), receipt({ id: 'other-group-receipt', groupId: 'another-group' }));
  assert.equal(selectJoinOnboarding(state, actor, MEMBERSHIP_REVIEW_GROUP), null);
  assert.equal(selectJoinOnboarding(state, '', MEMBERSHIP_REVIEW_GROUP), null);
  assert.equal(selectJoinOnboarding(state, actor, 'missing-group'), null);
  state.applications.push(receipt());
  assert.notEqual(selectJoinOnboarding(state, actor, MEMBERSHIP_REVIEW_GROUP), null);
  assert.equal(selectJoinOnboarding(state, 'review-member', MEMBERSHIP_REVIEW_GROUP), null);
});

test('the most recent accepted receipt determines the account-scoped hint while pending and declined records do not', () => {
  const state = fixture();
  join(state);
  state.applications.push(
    receipt({ id: 'old-direct', decidedAt: '2099-10-26T10:00:00Z', joinMode: 'DIRECT' }),
    receipt({ id: 'new-approval', decidedAt: '2099-10-29T10:00:00Z', joinMode: 'APPROVAL' }),
    receipt({ id: 'newer-pending', decidedAt: '2099-10-30T10:00:00Z', status: 'PENDING', joinMode: 'DIRECT' }),
    receipt({ id: 'newest-declined', decidedAt: '2099-10-31T10:00:00Z', status: 'DECLINED' }),
  );
  const before = structuredClone(state);
  assert.deepEqual(selectJoinOnboarding(state, actor, MEMBERSHIP_REVIEW_GROUP), {
    key: `${actor}:${MEMBERSHIP_REVIEW_GROUP}:new-approval:2099-10-29T10:00:00Z`, mode: 'APPROVAL',
  });
  assert.deepEqual(state, before, 'receipt sorting must not reorder or mutate application records');
});

test('legacy accepted receipt falls back to created time and group policy changes do not rewrite how the user joined', () => {
  const state = fixture();
  join(state);
  state.groups[0].discovery.joinMode = 'DIRECT';
  state.applications.push(receipt({ decidedAt: undefined }));
  assert.deepEqual(selectJoinOnboarding(state, actor, MEMBERSHIP_REVIEW_GROUP), {
    key: `${actor}:${MEMBERSHIP_REVIEW_GROUP}:joined-receipt:2099-10-27T09:00:00Z`, mode: 'APPROVAL',
  });
  state.groups[0].discovery.joinMode = 'APPROVAL';
  state.applications[0].joinMode = 'DIRECT';
  assert.equal(selectJoinOnboarding(state, actor, MEMBERSHIP_REVIEW_GROUP).mode, 'DIRECT');
});

test('revoked, blocked, archived, deleted or standalone membership never produces an accepted-entry hint', () => {
  for (const change of [
    state => { state.groups[0].memberIds = ['review-owner', 'review-member']; },
    state => { state.groups[0].blockedMemberIds = [actor]; },
    state => { state.groups[0].archived = true; },
    state => { state.groups[0].spaceType = 'ACTIVITY'; },
    state => { state.groups = []; },
  ]) {
    const state = fixture();
    join(state);
    state.applications.push(receipt());
    change(state);
    const before = structuredClone(state);
    assert.equal(selectJoinOnboarding(state, actor, MEMBERSHIP_REVIEW_GROUP), null);
    assert.deepEqual(state, before);
  }
});

test('pending memberships are exact-account requests and exclude declined, accepted, already joined and blocked entries', () => {
  const state = fixture();
  state.applications.push(receipt({ status: 'PENDING', message: '공개하면 안 되는 가입 인사' }),
    receipt({ id: 'another-account-pending', userId: 'review-member', status: 'PENDING' }),
    receipt({ id: 'already-declined', status: 'DECLINED' }), receipt({ id: 'already-accepted' }));
  const before = structuredClone(state);
  assert.deepEqual(selectPendingMemberships(state, actor), [{ id: 'joined-receipt', groupId: MEMBERSHIP_REVIEW_GROUP, title: state.groups[0].name, publicNow: true }]);
  assert.deepEqual(selectPendingMemberships(state, ''), []);
  assert.deepEqual(selectPendingMemberships(state, 'another-account'), []);
  assert.deepEqual(state, before);
  join(state);
  assert.deepEqual(selectPendingMemberships(state, actor), []);
  state.groups[0].memberIds = state.groups[0].memberIds.filter(id => id !== actor);
  state.groups[0].blockedMemberIds = [actor];
  assert.deepEqual(selectPendingMemberships(state, actor), []);
});

test('ended public listings never reveal the current private name, invitation text, place or membership details', () => {
  for (const change of [
    state => { state.groups[0].visibility = 'PRIVATE'; },
    state => { state.groups[0].promotionPublished = false; },
    state => { state.groups[0].archived = true; },
    state => { state.groups[0].spaceType = 'ACTIVITY'; },
    state => { state.groups = []; },
  ]) {
    const state = fixture();
    state.groups[0].name = 'SECRET-PRIVATE-GROUP-NAME';
    state.groups[0].introduction = 'SECRET-PRIVATE-INTRODUCTION';
    state.applications.push(receipt({ status: 'PENDING', message: 'SECRET-APPLICATION-MESSAGE', publicActivityIntent: { groupId: MEMBERSHIP_REVIEW_GROUP, activityId: state.activities[0].id, date: state.activities[0].date } }));
    change(state);
    const before = structuredClone(state), pending = selectPendingMemberships(state, actor);
    assert.deepEqual(pending, [{ id: 'joined-receipt', groupId: MEMBERSHIP_REVIEW_GROUP, title: '공개가 종료된 모임', publicNow: false }]);
    assert.equal(JSON.stringify(pending).includes('SECRET'), false);
    assert.equal(JSON.stringify(pending).includes('meetingPoint'), false);
    assert.equal(JSON.stringify(pending).includes('memberIds'), false);
    assert.deepEqual(state, before);
  }
});

test('pending selectors preserve every request identity and never choose another group when one listing disappears', () => {
  const state = fixture();
  state.groups.push({ ...structuredClone(state.groups[0]), id: 'second-club', name: '두 번째 공개 모임' });
  state.applications.push(receipt({ status: 'PENDING' }), receipt({ id: 'second-request', groupId: 'second-club', status: 'PENDING' }));
  state.groups = state.groups.filter(group => group.id !== MEMBERSHIP_REVIEW_GROUP);
  const before = structuredClone(state);
  assert.deepEqual(selectPendingMemberships(state, actor), [
    { id: 'joined-receipt', groupId: MEMBERSHIP_REVIEW_GROUP, title: '공개가 종료된 모임', publicNow: false },
    { id: 'second-request', groupId: 'second-club', title: '두 번째 공개 모임', publicNow: true },
  ]);
  assert.deepEqual(state, before);
});

test('a real direct join can show the one-entry welcome without inventing an application, message, invitation or RSVP', () => {
  const state = fixture(), at = new Date('2099-10-28T16:00:00Z');
  state.groups[0].discovery.joinMode = 'DIRECT';
  const before = structuredClone(state);
  const intent = createPublicActivityIntent(state, MEMBERSHIP_REVIEW_GROUP, state.activities[1].id, at);
  assert.equal(selectJoinOnboarding(state, actor, MEMBERSHIP_REVIEW_GROUP), null);
  const groupId = joinPublicGroup(state, MEMBERSHIP_REVIEW_GROUP, actor, publicGroupJoinVersion(state.groups[0]), intent, at);
  assert.equal(groupId, MEMBERSHIP_REVIEW_GROUP);
  assert.equal(state.applications.length, 0, 'direct membership must not create a fake approval request');
  assert.equal(selectJoinOnboarding(state, actor, groupId), null, 'membership alone does not imply a new entry');
  const marker = { accountId: actor, groupId, token: 'successful-direct-entry' };
  const afterJoin = structuredClone(state);
  assert.deepEqual(selectJoinOnboarding(state, actor, groupId, marker), {
    key: `direct:${actor}:${groupId}:successful-direct-entry`, mode: 'DIRECT',
  });
  assert.deepEqual(state, afterJoin, 'welcome selection is read-only');
  for (const field of Object.keys(before).filter(field => field !== 'groups')) assert.deepEqual(state[field], before[field], field);
  assert.deepEqual(state.activities.map(item => item.participants[actor]), [undefined, undefined]);
  assert.equal(selectJoinOnboarding(state, actor, groupId, null), null, 'discarding the page marker does not leave a persistent welcome receipt');
});

test('direct-entry markers require the exact current account and group, a nonempty token and live unblocked membership', () => {
  const source = fixture();
  join(source);
  const valid = { accountId: actor, groupId: MEMBERSHIP_REVIEW_GROUP, token: 'entry-one' };
  source.groups.push({ ...structuredClone(source.groups[0]), id: 'different-club' });
  const before = structuredClone(source);
  assert.equal(selectJoinOnboarding(source, 'review-member', MEMBERSHIP_REVIEW_GROUP, valid), null, 'another current member cannot reuse the marker');
  assert.equal(selectJoinOnboarding(source, actor, 'different-club', valid), null);
  for (const token of ['', '   ', undefined, null, 1, {}, ['entry-one']]) {
    assert.equal(selectJoinOnboarding(source, actor, MEMBERSHIP_REVIEW_GROUP, { ...valid, token }), null);
  }
  assert.equal(selectJoinOnboarding(source, '', MEMBERSHIP_REVIEW_GROUP, valid), null);
  assert.deepEqual(source, before);
  for (const change of [
    state => { state.groups[0].memberIds = ['review-owner']; },
    state => { state.groups[0].blockedMemberIds = [actor]; },
    state => { state.groups[0].archived = true; },
    state => { state.groups[0].spaceType = 'ACTIVITY'; },
    state => { state.groups = []; },
  ]) {
    const state = structuredClone(source);
    change(state);
    const snapshot = structuredClone(state);
    assert.equal(selectJoinOnboarding(state, actor, MEMBERSHIP_REVIEW_GROUP, valid), null);
    assert.deepEqual(state, snapshot);
  }
});

test('real approval flow keeps its approved receipt welcome and ignores unrelated direct-entry markers', () => {
  const state = fixture(), at = new Date('2099-10-28T16:00:00Z');
  state.groups[0].discovery.joinMode = 'APPROVAL';
  const beforeActivities = structuredClone(state.activities), beforeMessages = structuredClone(state.messages);
  const request = requestGroupApplication(state, MEMBERSHIP_REVIEW_GROUP, actor, '책 이야기를 나누고 싶어요.', undefined, at, publicGroupJoinVersion(state.groups[0]));
  assert.equal(selectJoinOnboarding(state, actor, MEMBERSHIP_REVIEW_GROUP), null);
  approveGroupApplication(state, request.id, 'review-owner');
  const beforeSelect = structuredClone(state), expected = selectJoinOnboarding(state, actor, MEMBERSHIP_REVIEW_GROUP);
  assert.equal(expected.mode, 'APPROVAL');
  for (const marker of [
    { accountId: 'review-member', groupId: MEMBERSHIP_REVIEW_GROUP, token: 'other-account' },
    { accountId: actor, groupId: 'another-group', token: 'other-group' },
    { accountId: actor, groupId: MEMBERSHIP_REVIEW_GROUP, token: '  ' },
  ]) assert.deepEqual(selectJoinOnboarding(state, actor, MEMBERSHIP_REVIEW_GROUP, marker), expected);
  assert.deepEqual(state, beforeSelect);
  assert.deepEqual(state.activities, beforeActivities);
  assert.deepEqual(state.messages, beforeMessages);
});
