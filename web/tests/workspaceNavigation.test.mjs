import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { getScopedWorkspaceRouteContext, isTogetherWorkspaceSwitch } from '../src/together/workspaceNavigation.ts';

function fixture() {
  const state = createEmptyState('member', '모임원');
  state.members.push({ id: 'other', name: '다른 사람' });
  const group = (id, members) => ({ id, name: id, kind: 'HOBBY', region: '부산', introduction: '공개 소개', cover: '', visibility: 'PUBLIC', ownerId: 'other', memberIds: members, managerIds: [], archived: false, promotionPublished: true });
  state.groups.push(group('one', ['member', 'other']), group('two', ['member', 'other']), group('public-only', ['other']));
  const activity = (id, groupId) => ({ id, groupId, title: id, date: '', endDate: '', meetingPoint: '내부 위치', description: '내부 소개', status: 'PLANNED', leadId: 'other', editorIds: [], participants: {}, arrivedIds: [], revision: 1 });
  state.activities.push(activity('first', 'one'), activity('second', 'one'), activity('another', 'two'), activity('unjoined', 'public-only'));
  return state;
}

test('a current member may switch all peer views of one group without treating an identical route as navigation', () => {
  const state = fixture(), routes = ['group-one', 'groupchat-one', 'groupsummary-one'];
  for (const from of routes) for (const to of routes) assert.equal(isTogetherWorkspaceSwitch(state, 'member', from, to), from !== to, `${from} → ${to}`);
  state.groups[0].visibility = 'PRIVATE'; state.groups[0].promotionPublished = false;
  assert.equal(isTogetherWorkspaceSwitch(state, 'member', 'group-one', 'groupchat-one'), true, 'private member workspaces retain their normal context');
});

test('activity detail, chat and summary are peers only for the same exact activity', () => {
  const state = fixture(), routes = ['activity-first', 'activitychat-first', 'activitysummary-first'];
  for (const from of routes) for (const to of routes) assert.equal(isTogetherWorkspaceSwitch(state, 'member', from, to), from !== to, `${from} → ${to}`);
  for (const [from, to] of [['activity-first', 'activity-second'], ['activitychat-first', 'activitysummary-second'], ['activity-first', 'activitychat-another']]) assert.equal(isTogetherWorkspaceSwitch(state, 'member', from, to), false);
});

test('entering a child activity, returning to its parent, and moving across groups preserve the original history boundary', () => {
  const state = fixture();
  const transitions = [['group-one', 'activity-first'], ['activitychat-first', 'groupchat-one'], ['activitysummary-first', 'group-one'], ['groupsummary-one', 'activitysummary-first'], ['groupchat-one', 'group-two'], ['group-one', 'groupchat-two']];
  for (const [from, to] of transitions) assert.equal(isTogetherWorkspaceSwitch(state, 'member', from, to), false, `${from} → ${to}`);
  // A caller replacing only true peer switches keeps the discovery origin and each activity boundary.
  const history = ['together-find'];
  for (const route of ['group-one', 'groupchat-one', 'groupsummary-one', 'activity-first', 'activitychat-first', 'activitysummary-first', 'activity-second']) {
    const replace = isTogetherWorkspaceSwitch(state, 'member', history.at(-1), route);
    if (replace) history[history.length - 1] = route; else history.push(route);
  }
  assert.deepEqual(history, ['together-find', 'groupsummary-one', 'activitysummary-first', 'activity-second']);
});

test('roots, discovery, invitations and personal destinations cannot be collapsed into member workspace navigation', () => {
  const state = fixture();
  const outside = ['together', 'together-find', 'together-calendar', 'together-tasks', 'together-invites', 'together-shares', 'together-share-private', 'group-invite-token', 'home', 'saved', 'trips', 'profile'];
  for (const route of outside) {
    assert.equal(isTogetherWorkspaceSwitch(state, 'member', route, 'group-one'), false, `${route} origin`);
    assert.equal(isTogetherWorkspaceSwitch(state, 'member', 'activity-first', route), false, `${route} destination`);
    assert.equal(getScopedWorkspaceRouteContext(state, 'member', route), null);
  }
});

test('a public introduction, guest or blocked member never gains peer-switch permission', () => {
  const state = fixture();
  assert.equal(isTogetherWorkspaceSwitch(state, 'member', 'group-public-only', 'groupchat-public-only'), false);
  assert.equal(isTogetherWorkspaceSwitch(state, 'member', 'activity-unjoined', 'activitychat-unjoined'), false);
  assert.equal(isTogetherWorkspaceSwitch(state, '', 'group-one', 'groupchat-one'), false);
  assert.equal(isTogetherWorkspaceSwitch(state, 'unknown-user', 'group-one', 'groupchat-one'), false);
  state.groups[0].blockedMemberIds = ['member'];
  assert.equal(isTogetherWorkspaceSwitch(state, 'member', 'group-one', 'groupchat-one'), false);
  assert.equal(isTogetherWorkspaceSwitch(state, 'member', 'activity-first', 'activitysummary-first'), false);
  assert.equal(getScopedWorkspaceRouteContext(state, 'member', 'activitychat-first'), null);
});

test('latest membership and ownership of the activity are checked again after revocation or deletion', () => {
  const state = fixture();
  assert.equal(isTogetherWorkspaceSwitch(state, 'member', 'activity-first', 'activitychat-first'), true);
  state.groups[0].memberIds = ['other'];
  assert.equal(isTogetherWorkspaceSwitch(state, 'member', 'activity-first', 'activitychat-first'), false);
  state.groups[0].memberIds.push('member');
  state.activities[0].groupId = 'public-only';
  assert.equal(isTogetherWorkspaceSwitch(state, 'member', 'activity-first', 'activitychat-first'), false);
  state.activities.splice(0, 1);
  assert.equal(getScopedWorkspaceRouteContext(state, 'member', 'activity-first'), null);
  state.groups.splice(0, 1);
  assert.equal(getScopedWorkspaceRouteContext(state, 'member', 'group-one'), null);
});

test('archived and completed read-only contexts retain navigation without changing attendance, messages or drafts', () => {
  const state = fixture(); state.groups[0].archived = true; state.activities[0].status = 'COMPLETED';
  const before = structuredClone(state);
  assert.equal(isTogetherWorkspaceSwitch(state, 'member', 'group-one', 'groupsummary-one'), true);
  assert.equal(isTogetherWorkspaceSwitch(state, 'member', 'activity-first', 'activitychat-first'), true);
  assert.deepEqual(getScopedWorkspaceRouteContext(state, 'member', 'activitysummary-first'), { scope: 'ACTIVITY', groupId: 'one', activityId: 'first', view: 'SUMMARY' });
  assert.deepEqual(state, before);
});

test('the parser accepts only complete canonical routes and never confuses an invitation token with a group id', () => {
  const state = fixture();
  state.groups.push({ ...state.groups[0], id: 'invite-token' });
  for (const route of ['group-invite-token', 'group-one?tab=chat', 'groupchat-one#private', '/group-one', 'group-one/', 'Group-one', 'group-one extra', 'activity-missing', 'group-missing', 'groupsummary-', null, undefined, {}]) assert.equal(getScopedWorkspaceRouteContext(state, 'member', route), null);
  assert.deepEqual(getScopedWorkspaceRouteContext(state, 'member', 'groupchat-one'), { scope: 'GROUP', groupId: 'one', view: 'CHAT' });
  assert.equal(isTogetherWorkspaceSwitch(state, 'member', 'group-one?tab=chat', 'groupchat-one'), false);
});
