import test from 'node:test';
import assert from 'node:assert/strict';
import { createMembershipReviewState, MEMBERSHIP_REVIEW_GROUP, MEMBERSHIP_REVIEW_ACTIVITY, MEMBERSHIP_REVIEW_SECOND_ACTIVITY } from './membershipReviewFixture.ts';
import { captureWorkspaceReturn, navigateFromChat, resolveWorkspaceReturn } from '../src/together/workspaceReturn.ts';

const actor = 'review-member';
const fixture = () => createMembershipReviewState(new Date('2099-10-28T16:00:00Z'), { multiplePublicActivities: true });

test('returning from group chat restores the exact board and scroll position without carrying content or changing state', () => {
  const state = fixture(), before = structuredClone(state);
  const origin = captureWorkspaceReturn(state, actor, MEMBERSHIP_REVIEW_GROUP, undefined, 'board', 412.5);
  assert.deepEqual(origin, { accountId: actor, groupId: MEMBERSHIP_REVIEW_GROUP, view: 'board', scrollTop: 412.5 });
  assert.deepEqual(resolveWorkspaceReturn(state, actor, MEMBERSHIP_REVIEW_GROUP, undefined, origin), { ...origin, route: `group-${MEMBERSHIP_REVIEW_GROUP}` });
  assert.deepEqual(state, before);
  assert.equal(Object.hasOwn(origin, 'activityId'), false);
  assert.equal(JSON.stringify(origin).includes('각자 읽는'), false);
});

test('returning from an activity chat restores its prep view and scroll without returning to another meetup', () => {
  const state = fixture(), before = structuredClone(state);
  const origin = captureWorkspaceReturn(state, actor, MEMBERSHIP_REVIEW_GROUP, MEMBERSHIP_REVIEW_SECOND_ACTIVITY, 'prep', 789);
  assert.deepEqual(resolveWorkspaceReturn(state, actor, MEMBERSHIP_REVIEW_GROUP, MEMBERSHIP_REVIEW_SECOND_ACTIVITY, origin), {
    accountId: actor, groupId: MEMBERSHIP_REVIEW_GROUP, activityId: MEMBERSHIP_REVIEW_SECOND_ACTIVITY,
    view: 'prep', scrollTop: 789, route: `activity-${MEMBERSHIP_REVIEW_SECOND_ACTIVITY}`,
  });
  assert.equal(resolveWorkspaceReturn(state, actor, MEMBERSHIP_REVIEW_GROUP, MEMBERSHIP_REVIEW_ACTIVITY, origin), null);
  assert.equal(resolveWorkspaceReturn(state, actor, MEMBERSHIP_REVIEW_GROUP, undefined, origin), null);
  assert.deepEqual(state, before, 'navigation must not RSVP, mark arrivals or update read cursors');
});

test('account, group and activity identities must all match before any saved location is reused', () => {
  const state = fixture();
  const other = { ...structuredClone(state.groups[0]), id: 'other-group', name: '다른 비공개 모임', visibility: 'PRIVATE' };
  state.groups.push(other);
  const groupOrigin = captureWorkspaceReturn(state, actor, MEMBERSHIP_REVIEW_GROUP, undefined, 'board', 100);
  const activityOrigin = captureWorkspaceReturn(state, actor, MEMBERSHIP_REVIEW_GROUP, MEMBERSHIP_REVIEW_ACTIVITY, 'record', 200);
  assert.equal(resolveWorkspaceReturn(state, 'review-owner', MEMBERSHIP_REVIEW_GROUP, undefined, groupOrigin), null);
  assert.equal(resolveWorkspaceReturn(state, '', MEMBERSHIP_REVIEW_GROUP, undefined, groupOrigin), null);
  assert.equal(resolveWorkspaceReturn(state, actor, other.id, undefined, groupOrigin), null);
  assert.equal(resolveWorkspaceReturn(state, actor, MEMBERSHIP_REVIEW_GROUP, MEMBERSHIP_REVIEW_ACTIVITY, groupOrigin), null);
  assert.equal(resolveWorkspaceReturn(state, actor, other.id, MEMBERSHIP_REVIEW_ACTIVITY, activityOrigin), null);
  assert.equal(resolveWorkspaceReturn(state, actor, MEMBERSHIP_REVIEW_GROUP, MEMBERSHIP_REVIEW_SECOND_ACTIVITY, activityOrigin), null);
  assert.equal(resolveWorkspaceReturn(state, actor, MEMBERSHIP_REVIEW_GROUP, undefined, null), null);
});

test('leaving, blocking or deleting the current group invalidates both capture and a previously valid return', () => {
  for (const change of [
    state => { state.groups[0].memberIds = ['review-owner']; },
    state => { state.groups[0].blockedMemberIds = [actor]; },
    state => { state.groups = []; },
  ]) {
    const state = fixture();
    const origin = captureWorkspaceReturn(state, actor, MEMBERSHIP_REVIEW_GROUP, undefined, 'album', 55);
    change(state);
    const before = structuredClone(state);
    assert.equal(captureWorkspaceReturn(state, actor, MEMBERSHIP_REVIEW_GROUP, undefined, 'album', 55), null);
    assert.equal(resolveWorkspaceReturn(state, actor, MEMBERSHIP_REVIEW_GROUP, undefined, origin), null);
    assert.deepEqual(state, before);
  }
  const state = fixture();
  for (const actorId of ['', 'review-applicant', 'unknown-account']) assert.equal(captureWorkspaceReturn(state, actorId, MEMBERSHIP_REVIEW_GROUP, undefined, 'home', 0), null);
});

test('foreign, removed or reassigned activity references never become navigable return locations', () => {
  const state = fixture();
  const origin = captureWorkspaceReturn(state, actor, MEMBERSHIP_REVIEW_GROUP, MEMBERSHIP_REVIEW_ACTIVITY, 'prep', 90);
  const foreign = { ...structuredClone(state.activities[0]), id: 'foreign-activity', groupId: 'private-foreign-group' };
  state.activities.push(foreign);
  assert.equal(captureWorkspaceReturn(state, actor, MEMBERSHIP_REVIEW_GROUP, foreign.id, 'prep', 0), null);
  assert.equal(captureWorkspaceReturn(state, actor, MEMBERSHIP_REVIEW_GROUP, 'missing-activity', 'schedule', 0), null);
  state.activities[0].groupId = foreign.groupId;
  assert.equal(resolveWorkspaceReturn(state, actor, MEMBERSHIP_REVIEW_GROUP, MEMBERSHIP_REVIEW_ACTIVITY, origin), null);
  state.activities = state.activities.filter(item => item.id !== MEMBERSHIP_REVIEW_ACTIVITY);
  assert.equal(resolveWorkspaceReturn(state, actor, MEMBERSHIP_REVIEW_GROUP, MEMBERSHIP_REVIEW_ACTIVITY, origin), null);
});

test('only workspace views are captured and group-only or activity-only tabs cannot be crossed', () => {
  const state = fixture();
  for (const view of ['home', 'activities', 'board', 'album']) assert.equal(captureWorkspaceReturn(state, actor, MEMBERSHIP_REVIEW_GROUP, undefined, view, 10).view, view);
  for (const view of ['schedule', 'prep', 'record', 'album']) assert.equal(captureWorkspaceReturn(state, actor, MEMBERSHIP_REVIEW_GROUP, MEMBERSHIP_REVIEW_ACTIVITY, view, 10).view, view);
  for (const view of ['chat', 'prep', 'schedule', 'record', 'settings', '', 'https://untrusted.example']) assert.equal(captureWorkspaceReturn(state, actor, MEMBERSHIP_REVIEW_GROUP, undefined, view, 10), null);
  for (const view of ['chat', 'home', 'activities', 'board', 'settings', '']) assert.equal(captureWorkspaceReturn(state, actor, MEMBERSHIP_REVIEW_GROUP, MEMBERSHIP_REVIEW_ACTIVITY, view, 10), null);
  const forged = { accountId: actor, groupId: MEMBERSHIP_REVIEW_GROUP, view: 'chat', scrollTop: 1 };
  assert.equal(resolveWorkspaceReturn(state, actor, MEMBERSHIP_REVIEW_GROUP, undefined, forged), null);
});

test('nonfinite and negative scroll positions become zero while valid positions and input objects remain unchanged', () => {
  const state = fixture(), before = structuredClone(state);
  for (const scrollTop of [NaN, Infinity, -Infinity, -100, '40', undefined]) {
    const origin = { accountId: actor, groupId: MEMBERSHIP_REVIEW_GROUP, view: 'board', scrollTop, privateDraft: '절대 복사하지 않을 입력' };
    const resolved = resolveWorkspaceReturn(state, actor, MEMBERSHIP_REVIEW_GROUP, undefined, origin);
    assert.deepEqual(resolved, { accountId: actor, groupId: MEMBERSHIP_REVIEW_GROUP, view: 'board', scrollTop: 0, route: `group-${MEMBERSHIP_REVIEW_GROUP}` });
    assert.deepEqual(captureWorkspaceReturn(state, actor, MEMBERSHIP_REVIEW_GROUP, undefined, 'board', scrollTop), {
      accountId: actor, groupId: MEMBERSHIP_REVIEW_GROUP, view: 'board', scrollTop: 0,
    });
    assert.equal(origin.scrollTop, scrollTop);
    assert.equal(origin.privateDraft, '절대 복사하지 않을 입력');
  }
  assert.equal(captureWorkspaceReturn(state, actor, MEMBERSHIP_REVIEW_GROUP, undefined, 'home', 123.25).scrollTop, 123.25);
  assert.deepEqual(state, before);
});

test('chat entered directly from Home or Saved delegates back to host history instead of inventing a workspace origin', () => {
  const state = fixture(), before = structuredClone(state);
  for (const activityId of [undefined, MEMBERSHIP_REVIEW_ACTIVITY]) {
    const calls = [];
    navigateFromChat(state, actor, MEMBERSHIP_REVIEW_GROUP, activityId, null, {
      restore: origin => calls.push(['restore', origin]),
      onHostBack: route => calls.push(['host', route]),
      fallback: view => calls.push(['fallback', view]),
    });
    assert.deepEqual(calls, [['host', activityId ? `activity-${activityId}` : `group-${MEMBERSHIP_REVIEW_GROUP}`]]);
  }
  assert.deepEqual(state, before);
});

test('valid board and prep origins restore exactly once and take precedence over host history and fixture defaults', () => {
  const state = fixture(), before = structuredClone(state);
  for (const [activityId, view, scrollTop] of [[undefined, 'board', 321], [MEMBERSHIP_REVIEW_SECOND_ACTIVITY, 'prep', 654]]) {
    const origin = captureWorkspaceReturn(state, actor, MEMBERSHIP_REVIEW_GROUP, activityId, view, scrollTop), calls = [];
    navigateFromChat(state, actor, MEMBERSHIP_REVIEW_GROUP, activityId, origin, {
      restore: value => calls.push(['restore', value]),
      onHostBack: route => calls.push(['host', route]),
      fallback: value => calls.push(['fallback', value]),
    });
    assert.deepEqual(calls, [['restore', { ...origin, route: activityId ? `activity-${activityId}` : `group-${MEMBERSHIP_REVIEW_GROUP}` }]]);
  }
  assert.deepEqual(state, before);
});

test('stale, foreign-account and wrong-activity origins use the host while only standalone fixtures use fallback tabs', () => {
  for (const change of [
    (state, origin) => { origin.accountId = 'review-owner'; },
    (state, origin) => { origin.activityId = MEMBERSHIP_REVIEW_SECOND_ACTIVITY; },
    state => { state.groups[0].memberIds = ['review-owner']; },
    state => { state.groups[0].blockedMemberIds = [actor]; },
    state => { state.activities = []; },
  ]) {
    const state = fixture();
    const origin = captureWorkspaceReturn(state, actor, MEMBERSHIP_REVIEW_GROUP, MEMBERSHIP_REVIEW_ACTIVITY, 'prep', 80);
    change(state, origin);
    const before = structuredClone(state), calls = [];
    navigateFromChat(state, actor, MEMBERSHIP_REVIEW_GROUP, MEMBERSHIP_REVIEW_ACTIVITY, origin, {
      restore: value => calls.push(['restore', value]), onHostBack: route => calls.push(['host', route]), fallback: view => calls.push(['fallback', view]),
    });
    assert.deepEqual(calls, [['host', `activity-${MEMBERSHIP_REVIEW_ACTIVITY}`]]);
    assert.deepEqual(state, before);
  }
  const state = fixture();
  for (const activityId of [undefined, MEMBERSHIP_REVIEW_ACTIVITY]) {
    const calls = [];
    navigateFromChat(state, actor, MEMBERSHIP_REVIEW_GROUP, activityId, null, {
      restore: value => calls.push(['restore', value]), fallback: view => calls.push(['fallback', view]),
    });
    assert.deepEqual(calls, [['fallback', activityId ? 'schedule' : 'home']]);
  }
});
