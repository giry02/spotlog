import test from 'node:test';
import assert from 'node:assert/strict';
import { createMembershipReviewState, MEMBERSHIP_REVIEW_GROUP, MEMBERSHIP_REVIEW_SECOND_ACTIVITY } from './membershipReviewFixture.ts';
import { discoveryProfile } from '../src/together/discovery.ts';
import { isTogetherState } from '../src/together/repository.ts';
import { createPublicActivityIntent, joinPublicGroup, publicGroupJoinVersion, requestGroupApplication, resolvePublicActivityIntent } from '../src/together/publicActivityIntent.ts';
import { createEmptyState } from '../src/together/model.ts';
import { commitCreation } from '../src/together/creationCommit.ts';
import { interpretCreationPrompt } from '../src/together/creationPlanner.ts';
import { createDiscoveryCatalog, DISCOVERY_CATALOG_VERSION, hydrateDiscoveryCatalog } from '../src/together/discoveryExamples.ts';

const at = new Date('2099-10-28T16:00:00Z');
const applicant = 'review-applicant';
const fixture = (mode = 'DIRECT') => {
  const state = createMembershipReviewState(at, { multiplePublicActivities: true });
  if (mode !== undefined) state.groups[0].discovery.joinMode = mode;
  return state;
};
const intentFor = state => createPublicActivityIntent(state, MEMBERSHIP_REVIEW_GROUP, MEMBERSHIP_REVIEW_SECOND_ACTIVITY, at);
const versionFor = state => publicGroupJoinVersion(state.groups[0]);

test('explicit direct join grants only group membership and is idempotent without joining either public meetup', () => {
  const state = fixture();
  const other = { ...structuredClone(state.groups[0]), id: 'another-public-club', memberIds: ['review-owner'] };
  state.groups.push(other);
  const before = structuredClone(state), intent = intentFor(state), version = versionFor(state);
  assert.equal(resolvePublicActivityIntent(state, intent, applicant, at).canOpen, false);
  assert.equal(joinPublicGroup(state, MEMBERSHIP_REVIEW_GROUP, applicant, version, intent, at), MEMBERSHIP_REVIEW_GROUP);
  assert.deepEqual(state.groups[0].memberIds, [...before.groups[0].memberIds, applicant]);
  assert.deepEqual(state.groups[1], before.groups[1]);
  assert.equal(resolvePublicActivityIntent(state, intent, applicant, at).canOpen, true);
  for (const field of Object.keys(before).filter(field => field !== 'groups')) assert.deepEqual(state[field], before[field], field);
  const joined = structuredClone(state);
  assert.equal(joinPublicGroup(state, MEMBERSHIP_REVIEW_GROUP, applicant, version, intent, at), MEMBERSHIP_REVIEW_GROUP);
  assert.deepEqual(state, joined);
});

test('blocked, archived, private, unpublished, paused and standalone spaces reject direct joining atomically', () => {
  const changes = [
    state => { state.groups[0].blockedMemberIds = [applicant]; },
    state => { state.groups[0].archived = true; },
    state => { state.groups[0].visibility = 'PRIVATE'; },
    state => { state.groups[0].promotionPublished = false; },
    state => { state.groups[0].discovery.recruitment = 'PAUSED'; },
    state => { state.groups[0].spaceType = 'ACTIVITY'; },
    state => { state.groups.splice(0, 1); },
  ];
  for (const change of changes) {
    const state = fixture(), version = versionFor(state), intent = intentFor(state);
    change(state);
    const before = structuredClone(state);
    assert.throws(() => joinPublicGroup(state, MEMBERSHIP_REVIEW_GROUP, applicant, version, intent, at));
    assert.deepEqual(state, before);
  }
});

test('unknown actors and absent confirmation versions cannot partially join a public group', () => {
  for (const [actor, version] of [['', 'current'], ['unknown-account', 'current'], [applicant, ''], [applicant, undefined], [applicant, null]]) {
    const state = fixture(), before = structuredClone(state);
    assert.throws(() => joinPublicGroup(state, MEMBERSHIP_REVIEW_GROUP, actor, version === 'current' ? versionFor(state) : version, undefined, at));
    assert.deepEqual(state, before);
  }
});

test('stale public policy or a newly required approval is rechecked before any membership mutation', () => {
  for (const change of [
    state => { state.groups[0].discovery.joinMode = 'APPROVAL'; },
    state => { state.groups[0].discovery.joinGuide = '가입 안내가 변경되었어요.'; },
    state => { state.groups[0].introduction = '모임 활동 범위를 변경했어요.'; },
    state => { state.groups[0].discovery.district = '광진구'; },
  ]) {
    const state = fixture(), version = versionFor(state);
    change(state);
    const before = structuredClone(state);
    assert.throws(() => joinPublicGroup(state, MEMBERSHIP_REVIEW_GROUP, applicant, version, undefined, at));
    assert.deepEqual(state, before);
  }
  const state = fixture('APPROVAL'), before = structuredClone(state);
  assert.throws(() => joinPublicGroup(state, MEMBERSHIP_REVIEW_GROUP, applicant, versionFor(state), undefined, at));
  assert.deepEqual(state, before);
});

test('malformed, cross-group, withdrawn and expired selected public cards cannot grant membership', () => {
  const source = fixture(), selected = intentFor(source);
  for (const intent of [{}, { ...selected, groupId: 'another-public-club' }, { ...selected, date: '2099-02-31' }, { ...selected, meetingPoint: 'not-public' }, { ...selected, activityId: 'missing-activity' }]) {
    const state = fixture(), before = structuredClone(state);
    assert.throws(() => joinPublicGroup(state, MEMBERSHIP_REVIEW_GROUP, applicant, versionFor(state), intent, at));
    assert.deepEqual(state, before);
  }
  for (const change of [
    state => { state.activities[1].status = 'CANCELLED'; },
    state => { state.groups[0].promotionActivityIds = []; },
    state => { state.groups[0].promotionActivitySnapshots = []; },
  ]) {
    const state = fixture(), intent = intentFor(state);
    change(state);
    const before = structuredClone(state);
    assert.throws(() => joinPublicGroup(state, MEMBERSHIP_REVIEW_GROUP, applicant, versionFor(state), intent, at));
    assert.deepEqual(state, before);
  }
  const state = fixture(), before = structuredClone(state);
  assert.throws(() => joinPublicGroup(state, MEMBERSHIP_REVIEW_GROUP, applicant, versionFor(state), intentFor(state), new Date('2100-01-01T00:00:00Z')));
  assert.deepEqual(state, before);
});

test('legacy groups retain approval and repeated requests never grant membership or overwrite pending context', () => {
  const state = fixture();
  delete state.groups[0].discovery.joinMode;
  assert.equal(discoveryProfile(state.groups[0]).joinMode, 'APPROVAL');
  const before = structuredClone(state), intent = intentFor(state);
  const request = requestGroupApplication(state, MEMBERSHIP_REVIEW_GROUP, applicant, '처음 인사해요.', intent, at, versionFor(state));
  const pending = structuredClone(state);
  assert.equal(requestGroupApplication(state, MEMBERSHIP_REVIEW_GROUP, applicant, '덮어쓰면 안 되는 인사', undefined, at, versionFor(state)).id, request.id);
  assert.deepEqual(state, pending);
  assert.equal(request.status, 'PENDING');
  assert.equal(state.groups[0].memberIds.includes(applicant), false);
  for (const field of Object.keys(before).filter(field => field !== 'applications')) assert.deepEqual(state[field], before[field], field);
  const beforeDirect = structuredClone(state);
  assert.throws(() => joinPublicGroup(state, MEMBERSHIP_REVIEW_GROUP, applicant, versionFor(state), intent, at));
  assert.deepEqual(state, beforeDirect);
});

test('the approval action cannot create requests for direct groups, including stale confirmation after a policy change', () => {
  const state = fixture('APPROVAL'), oldVersion = versionFor(state);
  state.groups[0].discovery.joinMode = 'DIRECT';
  const before = structuredClone(state);
  assert.throws(() => requestGroupApplication(state, MEMBERSHIP_REVIEW_GROUP, applicant, '가입하고 싶어요.', intentFor(state), at, oldVersion));
  assert.deepEqual(state, before);
  assert.throws(() => requestGroupApplication(state, MEMBERSHIP_REVIEW_GROUP, applicant, '', undefined, at, versionFor(state)));
  assert.deepEqual(state, before);
});

test('a pending request is fulfilled only by a new explicit direct join after changing policy', () => {
  const state = fixture('APPROVAL'), intent = intentFor(state);
  const request = requestGroupApplication(state, MEMBERSHIP_REVIEW_GROUP, applicant, '보존할 가입 인사', intent, at, versionFor(state));
  const originalRequest = structuredClone(request), oldVersion = versionFor(state);
  state.groups[0].discovery.joinMode = 'DIRECT';
  const beforeJoin = structuredClone(state);
  assert.equal(state.groups[0].memberIds.includes(applicant), false);
  assert.equal(state.applications[0].status, 'PENDING');
  assert.throws(() => joinPublicGroup(state, MEMBERSHIP_REVIEW_GROUP, applicant, oldVersion, intent, at));
  assert.deepEqual(state, beforeJoin);
  const joinedAt = new Date('2099-10-28T17:00:00Z');
  joinPublicGroup(state, MEMBERSHIP_REVIEW_GROUP, applicant, versionFor(state), intent, joinedAt);
  assert.equal(state.applications.length, 1);
  assert.deepEqual(state.applications[0], { ...originalRequest, status: 'APPROVED', decidedAt: joinedAt.toISOString(), decidedBy: applicant, joinMode: 'DIRECT' });
  assert.deepEqual(state.activities, beforeJoin.activities);
  assert.deepEqual(state.messages, beforeJoin.messages);
  const joined = structuredClone(state);
  joinPublicGroup(state, MEMBERSHIP_REVIEW_GROUP, applicant, versionFor(state), intent, joinedAt);
  assert.deepEqual(state, joined);
});

test('another member joining does not invalidate the displayed public policy confirmation', () => {
  const state = fixture(), version = versionFor(state);
  state.members.push({ id: 'new-neighbor', name: '새 이웃' });
  joinPublicGroup(state, MEMBERSHIP_REVIEW_GROUP, 'new-neighbor', version, undefined, at);
  assert.equal(versionFor(state), version);
  joinPublicGroup(state, MEMBERSHIP_REVIEW_GROUP, applicant, version, undefined, at);
  assert.equal(state.groups[0].memberIds.includes(applicant), true);
  assert.deepEqual(state.activities.map(item => item.participants[applicant]), [undefined, undefined]);
});

test('schema version one accepts optional legacy and valid join modes while rejecting malformed profile and application modes', () => {
  const state = fixture();
  delete state.groups[0].discovery.joinMode;
  state.applications.push({ id: 'legacy-request', groupId: MEMBERSHIP_REVIEW_GROUP, userId: applicant, status: 'PENDING' });
  assert.equal(isTogetherState(state), true);
  for (const mode of ['DIRECT', 'APPROVAL']) {
    state.groups[0].discovery.joinMode = mode;
    state.applications[0].joinMode = mode;
    assert.equal(isTogetherState(state), true);
  }
  for (const value of [null, '', 'AUTOMATIC', 1, true, {}, ['DIRECT'], ['APPROVAL']]) {
    const malformedProfile = structuredClone(state);
    malformedProfile.groups[0].discovery.joinMode = value;
    assert.equal(isTogetherState(malformedProfile), false, `profile mode ${JSON.stringify(value)}`);
    const malformedApplication = structuredClone(state);
    malformedApplication.applications[0].joinMode = value;
    assert.equal(isTogetherState(malformedApplication), false, `application mode ${JSON.stringify(value)}`);
  }
});

test('new group creation defaults to direct joining but remains private and paused until separately published', () => {
  for (const mode of [undefined, 'DIRECT', 'APPROVAL']) {
    const state = fixture(), before = structuredClone(state);
    const request = { requestId: `new-club-${mode ?? 'default'}`, plan: null,
      brief: interpretCreationPrompt('부산에서 책을 읽는 모임을 만들고 싶어.', { purpose: 'GROUP', region: '부산' }),
      groupDraft: { name: '한 장씩 읽어요', kind: 'HOBBY', region: '부산 수영구', introduction: '서로의 책을 이야기해요.',
        topics: ['BOOK', 'CAFE'], welcome: '처음 오셔도 괜찮아요.', joinGuide: '서로 배려해 주세요.', ...(mode ? { joinMode: mode } : {}) } };
    assert.deepEqual(commitCreation(state, applicant, request, []), { kind: 'GROUP', id: request.requestId });
    const created = state.groups.find(item => item.id === request.requestId);
    assert.equal(created.discovery.joinMode, mode ?? 'DIRECT');
    assert.equal(created.visibility, 'PRIVATE');
    assert.equal(created.promotionPublished, false);
    assert.equal(created.discovery.recruitment, 'PAUSED');
    assert.equal(created.sourceKind, 'LOCAL');
    assert.deepEqual(created.memberIds, [applicant]);
    assert.deepEqual(state.groups.slice(0, -1), before.groups);
    for (const field of Object.keys(before).filter(field => field !== 'groups')) assert.deepEqual(state[field], before[field], field);
    assert.equal(isTogetherState(state), true);
    const committed = structuredClone(state);
    commitCreation(state, applicant, request, []);
    assert.deepEqual(state, committed);
    assert.throws(() => commitCreation(state, applicant, { ...request, groupDraft: { ...request.groupDraft, joinMode: (mode ?? 'DIRECT') === 'DIRECT' ? 'APPROVAL' : 'DIRECT' } }, []));
    assert.deepEqual(state, committed);
  }
});

test('new group creation rejects malformed joining policy without adding partial groups', () => {
  for (const mode of ['', 'AUTOMATIC', 0, true, {}, ['DIRECT']]) {
    const state = fixture(), before = structuredClone(state);
    const request = { requestId: 'invalid-policy-club', plan: null,
      brief: interpretCreationPrompt('부산 독서 모임', { purpose: 'GROUP', region: '부산' }),
      groupDraft: { name: '우리 독서 모임', kind: 'HOBBY', region: '부산', introduction: '함께 읽어요.', joinMode: mode } };
    assert.throws(() => commitCreation(state, applicant, request, []));
    assert.deepEqual(state, before);
  }
});

const oldVersionThreeCatalog = () => {
  const state = createEmptyState(applicant, '수아'), catalog = createDiscoveryCatalog([], at);
  state.groups.push(...catalog.groups);
  state.members.push(...catalog.members.filter(item => !state.members.some(member => member.id === item.id)));
  state.activities.push(...catalog.activities);
  state.discoveryCatalogVersion = 3;
  for (const group of state.groups) delete group.discovery.joinMode;
  return state;
};

test('fresh discovery catalog explicitly contains both joining policies without granting applicant membership or RSVP', () => {
  const catalog = createDiscoveryCatalog([], at);
  assert.equal(catalog.groups.length > 0, true);
  assert.equal(catalog.groups.some(group => group.discovery.joinMode === 'DIRECT'), true);
  assert.equal(catalog.groups.some(group => group.discovery.joinMode === 'APPROVAL'), true);
  for (const group of catalog.groups) {
    assert.ok(['DIRECT', 'APPROVAL'].includes(group.discovery.joinMode), group.id);
    assert.deepEqual(group.memberIds, [group.ownerId]);
    assert.equal(group.memberIds.includes(applicant), false);
  }
  for (const activity of catalog.activities) assert.deepEqual(activity.participants, {});
});

test('v3 unedited generated examples receive explicit catalog policy once while pending requests and unrelated content remain intact', () => {
  const state = oldVersionThreeCatalog();
  state.applications.push({ id: 'old-pending', groupId: 'public-busan-food', userId: applicant, status: 'PENDING', message: '예전 가입 인사를 보존해요.' });
  state.messages.push({ id: 'existing-message', roomId: 'group:public-busan-food', authorId: 'example-walker', body: '보존할 대화', createdAt: at.toISOString() });
  state.readCursors['group:public-busan-food'] = 'existing-message';
  const before = structuredClone(state), expected = createDiscoveryCatalog([], at);
  const hydrated = hydrateDiscoveryCatalog(state, [], at);
  assert.equal(DISCOVERY_CATALOG_VERSION, 4);
  assert.equal(hydrated.discoveryCatalogVersion, DISCOVERY_CATALOG_VERSION);
  assert.deepEqual(state, before, 'hydration must not mutate its input');
  assert.equal(hydrated.groups.length, before.groups.length);
  for (const group of hydrated.groups) {
    const expectedMode = expected.groups.find(item => item.id === group.id).discovery.joinMode;
    assert.equal(group.discovery.joinMode, expectedMode, group.id);
    const original = before.groups.find(item => item.id === group.id);
    assert.deepEqual(group, { ...original, discovery: { ...original.discovery, joinMode: expectedMode } });
  }
  for (const field of Object.keys(before).filter(field => !['groups', 'discoveryCatalogVersion'].includes(field))) assert.deepEqual(hydrated[field], before[field], field);
  assert.equal(hydrated.applications[0].status, 'PENDING');
  assert.equal(hydrated.groups.find(group => group.id === 'public-busan-food').memberIds.includes(applicant), false);
  assert.equal(hydrateDiscoveryCatalog(hydrated, [], new Date('2100-01-01T00:00:00Z')), hydrated, 'completed migration must be a no-op');
  assert.equal(isTogetherState(hydrated), true);
});

test('v3 local, server and origin-unknown operating records keep legacy approval even when IDs match the catalog', () => {
  for (const sourceKind of ['LOCAL', 'SERVER', undefined]) {
    const state = oldVersionThreeCatalog();
    const group = state.groups.find(item => item.id === 'discovery-busan-books');
    if (sourceKind === undefined) delete group.sourceKind;
    else group.sourceKind = sourceKind;
    const original = structuredClone(group);
    const hydrated = hydrateDiscoveryCatalog(state, [], at);
    const retained = hydrated.groups.find(item => item.id === group.id);
    assert.deepEqual(retained, original);
    assert.equal(retained.discovery.joinMode, undefined);
    assert.equal(discoveryProfile(retained).joinMode, 'APPROVAL');
    assert.equal(hydrated.discoveryCatalogVersion, DISCOVERY_CATALOG_VERSION);
  }
});

test('edited example names, introductions and joining guidance are not mistaken for untouched generated policies', () => {
  for (const change of [
    group => { group.name = '운영자가 바꾼 독서 모임'; },
    group => { group.introduction = '운영자가 직접 작성한 소개예요.'; },
    group => { group.discovery.joinGuide = '운영진이 새로 안내한 가입 조건이에요.'; },
  ]) {
    const state = oldVersionThreeCatalog(), group = state.groups.find(item => item.id === 'discovery-busan-books');
    change(group);
    const original = structuredClone(group);
    const hydrated = hydrateDiscoveryCatalog(state, [], at);
    const retained = hydrated.groups.find(item => item.id === group.id);
    assert.deepEqual(retained, original);
    assert.equal(discoveryProfile(retained).joinMode, 'APPROVAL');
  }
});

test('migration preserves explicit operator policy and does not restore deleted examples or rerun after version four', () => {
  const state = oldVersionThreeCatalog();
  const directCatalogGroup = state.groups.find(item => item.id === 'discovery-busan-books');
  const approvalCatalogGroup = state.groups.find(item => item.id === 'public-busan-guide');
  directCatalogGroup.discovery.joinMode = 'APPROVAL';
  approvalCatalogGroup.discovery.joinMode = 'DIRECT';
  state.groups = state.groups.filter(item => item.id !== 'discovery-busan-boardgame');
  const hydrated = hydrateDiscoveryCatalog(state, [], at);
  assert.equal(hydrated.groups.find(item => item.id === directCatalogGroup.id).discovery.joinMode, 'APPROVAL');
  assert.equal(hydrated.groups.find(item => item.id === approvalCatalogGroup.id).discovery.joinMode, 'DIRECT');
  assert.equal(hydrated.groups.some(item => item.id === 'discovery-busan-boardgame'), false);
  delete hydrated.groups.find(item => item.id === 'discovery-busan-music').discovery.joinMode;
  const final = structuredClone(hydrated);
  assert.equal(hydrateDiscoveryCatalog(hydrated, [], at), hydrated);
  assert.deepEqual(hydrated, final);
});
