import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { groupDashboardRecordDestination, selectGroupHomeDashboard } from '../src/together/groupHomeDashboardModel.ts';

const at = new Date('2026-11-10T09:00:00+09:00');
const place = (id, extra = {}) => ({ id, kind: 'CAFE', name: `${id} 지점`, area: '부산', address: `${id} 주소`, image: `/${id}.jpg`, description: '', note: '개인 장소 비밀', duration: '', lat: 35, lng: 129, ...extra });
const places = [place('cafe-b'), place('cafe-a'), place('personal', { personal: true }), place('unshared')];
function fixture() {
  const state = createEmptyState('me', '나');
  state.members.push({ id: 'owner', name: '모임장' }, { id: 'blocked', name: '제한 멤버' }, { id: 'foreign', name: '다른 모임원' });
  const group = { id: 'g', name: '동네 모임', kind: 'HOBBY', region: '부산', introduction: '긴 소개 비밀', cover: '/group.jpg', ownerId: 'owner', memberIds: ['owner', 'me', 'blocked'], blockedMemberIds: ['blocked'], managerIds: [], archived: false, visibility: 'PUBLIC', promotionPublished: true, interestPlaceIds: ['cafe-a', 'cafe-b', 'personal', 'withdrawn'] };
  state.groups.push(group, { ...structuredClone(group), id: 'other', ownerId: 'foreign', memberIds: ['foreign'], blockedMemberIds: [], interestPlaceIds: ['unshared'] });
  const activity = (id, date, extra = {}) => ({ id, groupId: 'g', kind: 'MEETUP', title: id, date, endDate: date, startTime: '19:00', meetingPoint: '이 모임 전용 집합 장소', description: '', status: 'PLANNED', leadId: 'owner', editorIds: [], participants: { me: 'MAYBE', owner: 'JOINED', blocked: 'JOINED', foreign: 'JOINED' }, arrivedIds: [], revision: 1, ...extra });
  state.activities.push(activity('past', '2026-11-09'), activity('next', '2026-11-11'), activity('later', '2026-11-12'), activity('cancelled', '2026-11-10', { status: 'CANCELLED' }), activity('undated', ''), activity('foreign-activity', '2026-11-10', { groupId: 'other' }));
  const post = (id, activityId, groupId = 'g') => ({ id, groupId, ...(activityId ? { activityId } : {}), authorId: 'owner', title: id, body: `${id} 본문`, category: 'REVIEW', createdAt: '2026-11-10T00:00:00Z', likes: [], comments: [] });
  state.posts.push(post('group-post'), post('activity-post', 'next'), post('orphan', 'foreign-activity'), post('foreign-post', undefined, 'other'));
  state.posts[1].attachments = [{ id: 'photo', url: '/post-photo.jpg', caption: '약속 후기 사진' }];
  state.media.push({ id: 'group-photo', groupId: 'g', authorId: 'me', url: '/group-photo.jpg', kind: 'PHOTO', caption: '모임 사진', createdAt: '2026-11-09T00:00:00Z' }, { id: 'activity-photo', groupId: 'g', activityId: 'next', authorId: 'me', url: '/activity-photo.jpg', kind: 'PHOTO', caption: '약속 사진', createdAt: '2026-11-10T01:00:00Z' }, { id: 'wrong-photo', groupId: 'g', activityId: 'foreign-activity', authorId: 'foreign', url: '/secret-photo.jpg', kind: 'PHOTO', caption: '다른 모임 사진 비밀', createdAt: '2026-11-10T02:00:00Z' });
  state.notices.push({ id: 'group-notice', groupId: 'g', title: '모임 공지', body: '공지 내용', createdAt: '2026-11-09T00:00:00Z' }, { id: 'activity-notice', groupId: 'g', activityId: 'next', title: '약속 공지 비밀', body: '', createdAt: '2026-11-10T00:00:00Z' });
  return state;
}
const select = state => selectGroupHomeDashboard(state, 'me', 'g', places, at);

test('dashboard requires current membership even for public groups; archived groups retain a read-only projection', () => {
  const state = fixture();
  for (const id of ['', 'foreign', 'blocked', 'ghost']) assert.equal(selectGroupHomeDashboard(state, id, 'g', places, at), null);
  state.groups[0].memberIds.push('ghost'); assert.equal(selectGroupHomeDashboard(state, 'ghost', 'g', places, at), null);
  state.groups[0].archived = true; const value = select(state); assert.equal(value.canWrite, false); assert.equal(value.canManage, false); assert.equal(value.memberCount, 2);
  state.groups[0].spaceType = 'ACTIVITY'; assert.equal(select(state), null);
});

test('next meeting prioritizes valid dated activities, excludes old/cancelled/foreign entries and counts only current unblocked participants', () => {
  const state = fixture(), before = structuredClone(state), value = select(state);
  assert.equal(value.nextActivity.id, 'next'); assert.equal(value.nextActivity.participantCount, 1); assert.equal(value.nextActivity.ownParticipation, 'MAYBE');
  assert.deepEqual(value.upcoming.map(item => item.id), ['later', 'undated']); assert.equal(value.upcomingCount, 3); assert.deepEqual(state, before);
  state.activities[0].endDate = '2026-11-11'; assert.equal(select(state).nextActivity.id, 'past');
});

test('places keep explicit group holding order and exclude personal, withdrawn and other-group-only sources', () => {
  const state = fixture(), value = select(state);
  assert.deepEqual(value.places.map(item => item.id), ['cafe-a', 'cafe-b']); assert.equal(value.placeCount, 2);
  const output = JSON.stringify(value); for (const secret of ['개인 장소 비밀', '긴 소개 비밀', '다른 모임 사진 비밀', 'secret-photo', 'foreign-post', 'orphan']) assert.equal(output.includes(secret), false);
  assert.deepEqual(value.members.map(item => item.id), ['owner', 'me']); assert.equal(value.notice.id, 'group-notice');
});

test('recent post labels and mosaic retain exact activity identities without including malformed sibling references', () => {
  const value = select(fixture());
  assert.equal(value.recentPosts.find(item => item.id === 'activity-post').activityTitle, 'next');
  assert.deepEqual(value.photos.map(item => [item.recordId, item.source]), [['activity-photo', 'MEDIA'], ['activity-post', 'POST'], ['group-photo', 'MEDIA']]);
  assert.equal(value.postCount, 2); assert.equal(value.mediaCount, 2);
});

test('record clicks resolve group board/album and exact appointment record modes; revocation or cross-group reassignment rejects stale links', () => {
  const state = fixture();
  assert.deepEqual(groupDashboardRecordDestination(state, 'me', 'g', 'POST', 'group-post'), { route: 'group-g', activityId: undefined, view: 'board', recordView: 'posts', elementId: 'tg-post-group-post' });
  assert.deepEqual(groupDashboardRecordDestination(state, 'me', 'g', 'POST', 'activity-post'), { route: 'activity-next', activityId: 'next', view: 'record', recordView: 'posts', elementId: 'tg-post-activity-post' });
  assert.equal(groupDashboardRecordDestination(state, 'me', 'g', 'MEDIA', 'activity-photo').recordView, 'media');
  assert.equal(groupDashboardRecordDestination(state, 'me', 'g', 'MEDIA', 'group-photo').view, 'album');
  assert.equal(groupDashboardRecordDestination(state, 'me', 'g', 'POST', 'orphan'), null);
  state.activities.find(item => item.id === 'next').groupId = 'other'; assert.equal(groupDashboardRecordDestination(state, 'me', 'g', 'POST', 'activity-post'), null);
  state.groups[0].blockedMemberIds.push('me'); assert.equal(groupDashboardRecordDestination(state, 'me', 'g', 'POST', 'group-post'), null);
});

function journalFixture() {
  const state = fixture();
  const shared = (id, activityId) => ({ id, groupId: 'g', ...(activityId ? { activityId } : {}), authorId: 'owner', sourceJourneyId: 'private-original',
    journey: { id: 'private-original', title: '함께 공유한 여행기', region: '부산', dateRange: '', duration: '당일', purpose: 'JOURNAL', status: 'PUBLISHED', visibility: 'PRIVATE', isMine: false,
      cover: '', summary: '', story: '이 모임에 공유한 기록', tags: [], saves: 0, author: '모임장', days: [] } });
  state.sharedJournals.push(shared('group-journal'), shared('activity-journal', 'next'));
  return state;
}

test('published journal destinations use the exact shared ID and group or appointment record scope, without requiring a public personal original', () => {
  const state = journalFixture(), before = structuredClone(state);
  assert.deepEqual(groupDashboardRecordDestination(state, 'me', 'g', 'JOURNAL', 'group-journal'), {
    route: 'group-g', activityId: undefined, view: 'board', recordView: 'posts', elementId: 'tg-journal-group-journal',
  });
  assert.deepEqual(groupDashboardRecordDestination(state, 'me', 'g', 'JOURNAL', 'activity-journal'), {
    route: 'activity-next', activityId: 'next', view: 'record', recordView: 'posts', elementId: 'tg-journal-activity-journal',
  });
  assert.equal(groupDashboardRecordDestination(state, 'me', 'g', 'JOURNAL', 'private-original'), null);
  assert.deepEqual(state, before);
  state.groups[0].archived = true;
  assert.equal(groupDashboardRecordDestination(state, 'me', 'g', 'JOURNAL', 'group-journal').route, 'group-g');
  state.groups[0].spaceType = 'ACTIVITY';
  assert.equal(groupDashboardRecordDestination(state, 'me', 'g', 'JOURNAL', 'group-journal'), null);
  assert.equal(groupDashboardRecordDestination(state, 'me', 'g', 'JOURNAL', 'activity-journal').route, 'activity-next');
});

test('a journal destination rejects unfinished, trashed and PLAN snapshots without modifying the shared record', () => {
  for (const change of [
    { status: 'PLANNING' }, { status: 'TRAVELING' }, { purpose: 'PLAN' }, { purpose: undefined },
    { trash: { deletedAt: '2026-11-10T00:00:00Z', expiresAt: '2026-12-10T00:00:00Z', ownerId: 'owner', previousStatus: 'PUBLISHED', previousVisibility: 'PRIVATE' } },
  ]) {
    const state = journalFixture();
    Object.assign(state.sharedJournals[0].journey, change);
    const before = structuredClone(state);
    assert.equal(groupDashboardRecordDestination(state, 'me', 'g', 'JOURNAL', 'group-journal'), null, JSON.stringify(change));
    assert.deepEqual(state, before);
  }
});

test('journal clicks reject revoked shares, stale appointment ownership and unavailable membership instead of falling back to a namesake record', () => {
  const revoked = journalFixture();
  revoked.posts.push({ ...structuredClone(revoked.posts[0]), id: 'group-journal' });
  revoked.sharedJournals = revoked.sharedJournals.filter(item => item.id !== 'group-journal');
  assert.equal(groupDashboardRecordDestination(revoked, 'me', 'g', 'JOURNAL', 'group-journal'), null);
  assert.equal(groupDashboardRecordDestination(revoked, 'me', 'g', 'POST', 'group-journal').elementId, 'tg-post-group-journal');
  const moved = journalFixture();
  moved.activities.find(item => item.id === 'next').groupId = 'other';
  assert.equal(groupDashboardRecordDestination(moved, 'me', 'g', 'JOURNAL', 'activity-journal'), null);
  assert.equal(groupDashboardRecordDestination(moved, 'me', 'other', 'JOURNAL', 'activity-journal'), null);
  for (const revoke of [
    state => state.groups[0].blockedMemberIds.push('me'),
    state => { state.groups[0].memberIds = state.groups[0].memberIds.filter(id => id !== 'me'); },
    state => { state.members = state.members.filter(member => member.id !== 'me'); },
  ]) {
    const state = journalFixture(); revoke(state);
    for (const id of ['group-journal', 'activity-journal']) assert.equal(groupDashboardRecordDestination(state, 'me', 'g', 'JOURNAL', id), null);
  }
  for (const viewer of ['', 'foreign', 'blocked', 'ghost']) assert.equal(groupDashboardRecordDestination(journalFixture(), viewer, 'g', 'JOURNAL', 'group-journal'), null);
});

test('empty legacy groups have honest empty sections and room tools never borrow appointment polls or other groups', () => {
  const state = fixture(); state.activities = []; state.posts = []; state.media = []; state.notices = []; state.groups[0].interestPlaceIds = [];
  const poll = { id: 'p', groupId: 'g', question: '투표', options: [], closed: false };
  state.polls.push(poll, { ...poll, id: 'activity-poll', activityId: 'foreign-activity' }, { ...poll, id: 'foreign-poll', groupId: 'other' }, { ...poll, id: 'closed', closed: true });
  const value = select(state); assert.equal(value.nextActivity, undefined); assert.equal(value.notice, undefined); assert.equal(value.photoCount, 0); assert.equal(value.journalCount, 0); assert.equal(value.tools.openPolls, 1);
});

test('standalone appointment resources can open their exact post/photo while the virtual group root remains unavailable', () => {
  const state = fixture(); state.groups[0].spaceType = 'ACTIVITY';
  assert.equal(select(state), null);
  assert.equal(groupDashboardRecordDestination(state, 'me', 'g', 'POST', 'activity-post').route, 'activity-next');
  assert.equal(groupDashboardRecordDestination(state, 'me', 'g', 'MEDIA', 'activity-photo').recordView, 'media');
  assert.equal(groupDashboardRecordDestination(state, 'me', 'g', 'POST', 'group-post'), null);
  assert.equal(groupDashboardRecordDestination(state, 'foreign', 'g', 'POST', 'activity-post'), null);
  state.groups[0].memberIds = ['owner'];
  assert.equal(groupDashboardRecordDestination(state, 'me', 'g', 'MEDIA', 'activity-photo'), null);
});

test('home lifecycle uses this group only and keeps a new place collection distinct from past shared records', () => {
  const state = fixture();
  state.activities = state.activities.filter(item => item.groupId !== 'g' || item.status === 'CANCELLED');
  state.posts = state.posts.filter(item => item.groupId !== 'g');
  state.media = state.media.filter(item => item.groupId !== 'g');
  const initial = select(state);
  assert.equal(initial.lifecycle, 'START');
  assert.equal(initial.hasRecords, false);
  assert.equal(initial.pastActivityCount, 0);
  assert.equal(initial.placeCount, 2);
  state.posts.push({ id: 'first-story', groupId: 'g', authorId: 'me', title: '첫 인사', body: '', category: 'FREE', createdAt: at.toISOString(), likes: [], comments: [] });
  assert.equal(select(state).lifecycle, 'RECORDS');
  state.activities.push({ id: 'new-undated', groupId: 'g', kind: 'MEETUP', title: '날짜를 정할 만남', date: '', endDate: '', meetingPoint: '', description: '', status: 'PLANNED', leadId: 'owner', editorIds: [], participants: {}, arrivedIds: [], revision: 1 });
  assert.equal(select(state).lifecycle, 'UPCOMING');
  state.groups[0].archived = true;
  assert.equal(select(state).lifecycle, 'ARCHIVED');
  assert.equal(select(state).canWrite, false);
});

test('a completed or past meeting remains a record even when its photos and posts are empty', () => {
  const state = fixture(); state.posts = []; state.media = [];
  state.activities = state.activities.filter(item => item.id === 'past' || item.id === 'cancelled');
  assert.equal(select(state).lifecycle, 'RECORDS');
  assert.equal(select(state).pastActivityCount, 1);
  state.activities[0].date = ''; state.activities[0].endDate = '';
  assert.equal(select(state).lifecycle, 'UPCOMING');
  state.activities[0].status = 'COMPLETED';
  assert.equal(select(state).lifecycle, 'RECORDS');
  assert.equal(select(state).pastActivityCount, 1);
});

test('experience counts reuse current-group taste eligibility without counting future, withdrawn or foreign assessments', () => {
  const state = fixture();
  const feedback = (id, extra = {}) => ({ id, groupId: 'g', placeId: 'cafe-a', authorId: 'owner', rating: 4, note: '직접 남긴 평가', recommended: true, purposes: [], photos: [], revision: 1, createdAt: at.toISOString(), updatedAt: at.toISOString(), ...extra });
  state.placeFeedback = [feedback('group-review'), feedback('past-review', { activityId: 'past', placeId: 'cafe-b' }), feedback('future-review', { activityId: 'next' }), feedback('withdrawn-review', { withdrawnAt: at.toISOString(), authorId: 'me' }), feedback('blocked-review', { authorId: 'blocked' }), feedback('foreign-review', { groupId: 'other', authorId: 'foreign' }), feedback('private-review', { placeId: 'personal' })];
  const before = structuredClone(state), value = select(state);
  assert.deepEqual(value.taste, { placeCount: 2, recordCount: 2 });
  assert.deepEqual(state, before);
  state.placeFeedback = state.placeFeedback.filter(item => item.id !== 'group-review' && item.id !== 'past-review');
  assert.deepEqual(select(state).taste, { placeCount: 0, recordCount: 0 });
});
