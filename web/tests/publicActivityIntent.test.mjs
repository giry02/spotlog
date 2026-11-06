import test from 'node:test';
import assert from 'node:assert/strict';
import { createMembershipReviewState, MEMBERSHIP_REVIEW_ACTIVITY, MEMBERSHIP_REVIEW_SECOND_ACTIVITY, MEMBERSHIP_REVIEW_GROUP } from './membershipReviewFixture.ts';
import { approveGroupApplication, rejectGroupApplication } from '../src/together/model.ts';
import { createTogetherRepository, isTogetherState, togetherStorageKey } from '../src/together/repository.ts';
import { createPublicActivityIntent, isPublicActivityIntent, requestGroupApplication, resolvePublicActivityIntent } from '../src/together/publicActivityIntent.ts';

const at = new Date('2099-10-28T16:00:00Z');
const applicant = 'review-applicant', owner = 'review-owner';
const fixture = () => createMembershipReviewState(at, { multiplePublicActivities: true });
const selectedIntent = state => createPublicActivityIntent(state, MEMBERSHIP_REVIEW_GROUP, MEMBERSHIP_REVIEW_SECOND_ACTIVITY, at);
function storage(initial = {}) {
  const entries = new Map(Object.entries(initial));
  return { get length() { return entries.size; }, key: index => [...entries.keys()][index] ?? null, getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key), clear: () => entries.clear() };
}

test('the second public meetup keeps its exact id and date across request, repository reload and approval without RSVP', () => {
  const state = fixture(), before = structuredClone(state);
  assert.equal(state.activities.length, 2);
  const intent = selectedIntent(state);
  assert.equal(intent.activityId, MEMBERSHIP_REVIEW_SECOND_ACTIVITY);
  assert.notEqual(intent.activityId, MEMBERSHIP_REVIEW_ACTIVITY);
  assert.deepEqual(Object.keys(intent).sort(), ['activityId', 'date', 'groupId']);
  assert.equal(resolvePublicActivityIntent(state, intent, applicant, at).canOpen, false);
  const disk = storage({ [togetherStorageKey('applicant-account')]: JSON.stringify(state), 'spotlog.web.journeys.v4': 'personal-original', 'spotlog.admin.review.v1': 'admin-original' });
  let repo = createTogetherRepository('applicant-account', '수아', [], disk);
  assert.equal(repo.update(draft => requestGroupApplication(draft, MEMBERSHIP_REVIEW_GROUP, applicant, '함께하고 싶어요.', intent, at)), true);
  repo = createTogetherRepository('applicant-account', '수아', [], disk);
  const application = repo.getSnapshot().applications[0];
  assert.deepEqual(application.publicActivityIntent, intent);
  assert.equal(application.status, 'PENDING');
  assert.equal(repo.update(draft => approveGroupApplication(draft, application.id, owner)), true);
  repo = createTogetherRepository('applicant-account', '수아', [], disk);
  const resolved = resolvePublicActivityIntent(repo.getSnapshot(), repo.getSnapshot().applications[0].publicActivityIntent, applicant, at);
  assert.equal(resolved.activity.id, MEMBERSHIP_REVIEW_SECOND_ACTIVITY);
  assert.equal(resolved.canOpen, true);
  assert.deepEqual(repo.getSnapshot().activities, before.activities);
  for (const field of ['messages', 'readCursors', 'tasks', 'sharedJournals', 'invites']) assert.deepEqual(repo.getSnapshot()[field], before[field]);
  assert.equal(disk.getItem('spotlog.web.journeys.v4'), 'personal-original');
  assert.equal(disk.getItem('spotlog.admin.review.v1'), 'admin-original');
});

test('selected card resolution returns approved public fields only, even after membership approval', () => {
  const state = fixture(), intent = selectedIntent(state);
  const request = requestGroupApplication(state, MEMBERSHIP_REVIEW_GROUP, applicant, '', intent, at);
  approveGroupApplication(state, request.id, owner);
  const result = resolvePublicActivityIntent(state, intent, applicant, at);
  for (const field of ['meetingPoint', 'participants', 'leadId', 'capacity', 'journey', 'editorIds', 'arrivedIds']) assert.equal(field in result.activity, false);
  assert.ok(!JSON.stringify(result).includes('멤버만 확인할'));
});

test('malformed, unknown, cross-group, private and changed-date card identities never resolve or enter a request', () => {
  const source = fixture(), intent = selectedIntent(source);
  const invalid = [undefined, {}, { ...intent, meetingPoint: 'private' }, { ...intent, activityId: 'https://untrusted' }, { ...intent, date: '2099-02-31' },
    { ...intent, activityId: MEMBERSHIP_REVIEW_GROUP }, { ...intent, groupId: 'another-group' }, { ...intent, date: '2099-11-30' }];
  for (const value of invalid) {
    const state = structuredClone(source), before = structuredClone(state);
    assert.equal(resolvePublicActivityIntent(state, value, applicant, at), null);
    if (value) assert.throws(() => requestGroupApplication(state, MEMBERSHIP_REVIEW_GROUP, applicant, '', value, at));
    assert.deepEqual(state, before);
  }
  source.activities[1].groupId = 'private-group';
  assert.equal(resolvePublicActivityIntent(source, intent, applicant, at), null);
});

test('withdrawal, cancellation, completion, changed publication and expired dates fall back without another meetup being selected', () => {
  const changes = [
    state => { state.activities[1].status = 'CANCELLED'; },
    state => { state.activities[1].status = 'COMPLETED'; },
    state => { state.groups[0].promotionActivityIds = [MEMBERSHIP_REVIEW_ACTIVITY]; },
    state => { state.groups[0].promotionActivitySnapshots = state.groups[0].promotionActivitySnapshots.slice(0, 1); },
    state => { state.groups[0].visibility = 'PRIVATE'; },
    state => { state.groups[0].promotionPublished = false; },
    state => { state.groups[0].discovery.recruitment = 'PAUSED'; },
    state => { state.groups[0].archived = true; },
    state => { state.activities.splice(1, 1); },
    state => { state.groups.splice(0, 1); },
    state => { state.groups[0].promotionActivitySnapshots[1].date = '2099-12-01'; },
  ];
  for (const change of changes) {
    const state = fixture(), intent = selectedIntent(state);
    change(state);
    assert.equal(resolvePublicActivityIntent(state, intent, applicant, at), null);
    const before = structuredClone(state);
    assert.throws(() => requestGroupApplication(state, MEMBERSHIP_REVIEW_GROUP, applicant, '', intent, at));
    assert.deepEqual(state, before);
  }
  const state = fixture();
  assert.equal(resolvePublicActivityIntent(state, selectedIntent(state), applicant, new Date('2100-01-01')), null);
});

test('pending retries keep the original second meetup rather than silently retargeting the request to the first', () => {
  const state = fixture(), intent = selectedIntent(state);
  const request = requestGroupApplication(state, MEMBERSHIP_REVIEW_GROUP, applicant, '처음 인사', intent, at);
  intent.activityId = 'mutated-after-submit';
  const first = createPublicActivityIntent(state, MEMBERSHIP_REVIEW_GROUP, MEMBERSHIP_REVIEW_ACTIVITY, at);
  assert.equal(requestGroupApplication(state, MEMBERSHIP_REVIEW_GROUP, applicant, '새 인사', first, at).id, request.id);
  assert.equal(state.applications.length, 1);
  assert.equal(request.publicActivityIntent.activityId, MEMBERSHIP_REVIEW_SECOND_ACTIVITY);
  assert.equal(request.message, '처음 인사');
});

test('declined reapplication explicitly replaces or clears the old destination, with no extra application or approval', () => {
  const state = fixture();
  const request = requestGroupApplication(state, MEMBERSHIP_REVIEW_GROUP, applicant, '', selectedIntent(state), at);
  rejectGroupApplication(state, request.id, owner);
  requestGroupApplication(state, MEMBERSHIP_REVIEW_GROUP, applicant, '다시 인사해요.', undefined, at);
  assert.equal(state.applications.length, 1);
  assert.equal(request.publicActivityIntent, undefined);
  assert.equal(request.status, 'PENDING');
  assert.equal(request.decidedBy, undefined);
  assert.ok(!state.groups[0].memberIds.includes(applicant));
});

test('approval never grants another account access, and revoked or blocked membership cannot open the stored destination', () => {
  const state = fixture(), intent = selectedIntent(state);
  const request = requestGroupApplication(state, MEMBERSHIP_REVIEW_GROUP, applicant, '', intent, at);
  assert.throws(() => approveGroupApplication(state, request.id, 'review-member'));
  approveGroupApplication(state, request.id, owner);
  assert.equal(resolvePublicActivityIntent(state, intent, 'another-account', at).canOpen, false);
  state.groups[0].memberIds = state.groups[0].memberIds.filter(id => id !== applicant);
  assert.equal(resolvePublicActivityIntent(state, intent, applicant, at).canOpen, false);
  state.groups[0].blockedMemberIds = [applicant];
  assert.equal(resolvePublicActivityIntent(state, intent, applicant, at), null);
  assert.throws(() => requestGroupApplication(state, MEMBERSHIP_REVIEW_GROUP, applicant, '', intent, at));
});

test('version1 legacy requests remain readable and optional card envelopes reject extra fields and mismatched groups', () => {
  const state = fixture();
  state.applications.push({ id: 'legacy-request', groupId: MEMBERSHIP_REVIEW_GROUP, userId: applicant, status: 'PENDING' });
  assert.equal(isTogetherState(state), true);
  const intent = selectedIntent(state);
  for (const value of [{ ...intent, meetingPoint: 'must-not-persist' }, { ...intent, groupId: 'wrong-group' }, { ...intent, date: '2099-13-01' }, null]) {
    state.applications[0].publicActivityIntent = value;
    assert.equal(isTogetherState(state), false);
  }
  state.applications[0].publicActivityIntent = intent;
  assert.equal(isPublicActivityIntent(intent), true);
  assert.equal(isTogetherState(state), true);
});

test('new account repositories cannot inherit another account pending selection and failed storage preserves the previous request', () => {
  const key = togetherStorageKey('account-one');
  const disk = storage({ [key]: JSON.stringify(fixture()) });
  const one = createTogetherRepository('account-one', '수아', [], disk);
  const second = selectedIntent(one.getSnapshot());
  assert.equal(one.update(draft => requestGroupApplication(draft, MEMBERSHIP_REVIEW_GROUP, applicant, '', second, at)), true);
  const pendingBytes = disk.getItem(key);
  const two = createTogetherRepository('account-two', '다른 회원', [], disk);
  assert.equal(two.getSnapshot().applications.length, 0);
  const before = one.getSnapshot();
  disk.setItem = () => { throw new Error('quota'); };
  assert.equal(one.update(draft => approveGroupApplication(draft, draft.applications[0].id, owner)), false);
  assert.deepEqual(one.getSnapshot(), before);
  assert.equal(disk.getItem(key), pendingBytes);
  assert.equal(one.getSnapshot().applications[0].status, 'PENDING');
});

test('guests, unknown actors and overlong greetings cannot create partial requests', () => {
  for (const [actor, message] of [['', ''], ['unknown-account', ''], [owner, ''], [applicant, 'a'.repeat(501)]]) {
    const state = fixture(), before = structuredClone(state);
    assert.throws(() => requestGroupApplication(state, MEMBERSHIP_REVIEW_GROUP, actor, message, selectedIntent(state), at));
    assert.deepEqual(state, before);
  }
});
