import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCreationJourney, commitCreation, createPlanningPoll, savePlanningFeedback } from '../src/together/creationCommit.ts';
import { buildCreationPlans, interpretCreationPrompt } from '../src/together/creationPlanner.ts';
import { createEmptyState } from '../src/together/model.ts';
import { isTogetherState } from '../src/together/repository.ts';

const place = (id, kind = 'FOOD', extra = {}) => ({ id, kind, name: `${id} 지점`, area: '부산 해운대', address: `부산 해운대구 ${id}길 1`, lat: 35.16, lng: 129.16, image: `${id}.jpg`, description: `${id} 소개`, note: '', duration: '1시간', ...extra });
const catalog = [place('food-a'), place('food-b'), place('cafe', 'CAFE'), place('stay', 'STAY')];
const brief = (extra = {}) => interpretCreationPrompt('부산 가족 식사', { region: '부산', purpose: 'MEETUP', date: '2999-11-07', startTime: '12:00', theme: 'FOOD', transport: 'PUBLIC', ...extra });
const plan = (ids = ['food-a'], extra = {}) => ({ id: 'selected-plan', source: 'CATALOG', title: '부산에서 식사', placeIds: ids, days: [{ day: 1, placeIds: ids }], explanation: ['등록 장소 후보'], unknowns: ['가격과 예약 가능 여부 확인 필요'], ...extra });
const group = (id = 'g', extra = {}) => ({ id, name: '기존 가족 모임', kind: 'FAMILY', region: '부산', introduction: '', cover: '', visibility: 'PRIVATE', ownerId: 'owner', memberIds: ['owner', 'me'], managerIds: [], archived: false, promotionPublished: false, spaceType: 'GROUP', ...extra });
function fixture() {
  const state = createEmptyState('me', '나');
  state.members.push({ id: 'owner', name: '모임장' }, { id: 'outsider', name: '외부인' });
  state.groups.push(group());
  state.activities.push({ id: 'existing', groupId: 'g', title: '기존 약속', date: '2999-11-07', endDate: '', startTime: '14:00', meetingPoint: '멤버 전용 만남 위치', description: '', status: 'PLANNED', leadId: 'owner', editorIds: [], participants: { me: 'MAYBE', owner: 'JOINED' }, arrivedIds: ['owner'], revision: 3 });
  return state;
}
const input = (extra = {}) => ({ requestId: 'create-one', brief: brief(), plan: plan(), ...extra });
const scope = (extra = {}) => ({ id: 'planning-write', groupId: 'g', activityId: 'existing', expectedRevision: 3, ...extra });
function rejectedAtomically(state, callback) { const before = structuredClone(state); assert.throws(callback); assert.deepEqual(state, before); }
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };

test('group interests, district and reviewed joining guidance persist privately while the first activity stays an idea', () => {
  const state = fixture();
  const request = input({ requestId: 'group-with-guidance', brief: brief({ purpose: 'GROUP', region: '부산 수영구' }), plan: null,
    groupDraft: { name: '커피와 책', kind: 'HOBBY', region: '부산 수영구', introduction: '주말에 함께해요.',
      topics: ['CAFE', 'BOOK'], welcome: '처음 참여 환영', joinGuide: '좋아하는 책을 알려 주세요.', firstActivityIdea: '카페에서 읽은 책 이야기' } });
  const count = state.activities.length;
  commitCreation(state, 'me', request, catalog);
  const created = state.groups.find(item => item.id === request.requestId);
  assert.equal(created.region, '부산'); assert.equal(created.discovery.district, '수영구');
  assert.deepEqual(created.discovery.topics, ['CAFE', 'BOOK']);
  assert.equal(created.discovery.joinGuide, request.groupDraft.joinGuide);
  assert.equal(created.discovery.welcome, request.groupDraft.welcome);
  assert.match(created.introduction, /첫 활동 아이디어 · 일정 미정/);
  assert.equal(state.activities.length, count); assert.equal(created.visibility, 'PRIVATE');
  assert.equal(isTogetherState(state), true);
  commitCreation(state, 'me', request, catalog); assert.equal(state.groups.filter(item => item.id === request.requestId).length, 1);
  rejectedAtomically(state, () => commitCreation(state, 'me', { ...request, groupDraft: { ...request.groupDraft, joinGuide: '다른 가입 안내' } }, catalog));
});

test('restaurant-only creation creates a new private route with fresh visit/block IDs and strips private operational fields', () => {
  const dirty = place('food-a', 'FOOD', { visitId: 'old-visit', anchorVisitId: 'old-anchor', stayDayIds: ['old-day'], note: 'PRIVATE-NOTE', creator: 'private-creator', time: '19:00', move: 'private-route', booking: { code: 'PRIVATE-BOOKING' }, travelProgress: { done: true }, photos: [{ image: 'public.jpg', alt: '등록 사진' }] });
  const source = freeze([dirty]), before = structuredClone(source);
  const journey = buildCreationJourney(brief(), plan(), source, '나');
  const selected = journey.days[0].places[0];
  assert.equal(selected.kind, 'FOOD'); assert.equal(journey.visibility, 'PRIVATE'); assert.equal(journey.planStage, 'READY');
  assert.equal(journey.days.length, 1); assert.equal(selected.id, 'food-a');
  assert.equal(selected.note, ''); assert.equal(selected.bookingFixed, false); assert.equal(selected.time, '12:00');
  assert.notEqual(selected.visitId, 'old-visit'); assert.equal(selected.anchorVisitId, undefined); assert.equal(selected.stayDayIds, undefined);
  assert.equal(selected.move, undefined); assert.equal(selected.creator, undefined); assert.equal(selected.booking, undefined);
  assert.equal(journey.travelProgress, undefined); assert.equal(journey.planningPreferences, undefined);
  assert.equal(journey.days[0].blocks[0].visitId, selected.visitId);
  assert.notEqual(journey.days[0].dayId, 'old-day');
  selected.photos[0].alt = '수정한 복사본'; assert.equal(dirty.photos[0].alt, '등록 사진');
  assert.deepEqual(source, before);
  assert.equal(JSON.stringify(journey).includes('PRIVATE-'), false);
});

test('multi-day creation follows real calendar days across a year boundary and never reuses original day/visit identities', () => {
  const conditions = brief({ purpose: 'TRIP', theme: 'TRAVEL', date: '2026-12-31', endDate: '2027-01-01', dayCount: 2 });
  const selected = plan(['food-a', 'cafe'], { days: [{ day: 1, placeIds: ['food-a'] }, { day: 2, placeIds: ['cafe'] }] });
  const first = buildCreationJourney(conditions, selected, catalog, '나'), second = buildCreationJourney(conditions, selected, catalog, '나');
  assert.deepEqual(first.days.map(day => day.date), ['2026-12-31', '2027-01-01']);
  assert.notEqual(first.id, second.id); assert.notEqual(first.days[0].dayId, second.days[0].dayId);
  assert.notEqual(first.days[0].places[0].visitId, second.days[0].places[0].visitId);
  assert.equal(first.days[1].places[0].time, undefined); assert.equal(first.duration, '2일');
  assert.match(first.dateRange, /2026-12-31 ~ 2027-01-01/);
});

test('withdrawn photos and explicit empty galleries cannot resurrect an old cover in a newly created itinerary', () => {
  const live = { image: 'live.jpg', alt: '현재 사진', caption: '', mediaId: 'live', placeId: 'food-a', availability: 'available' };
  const withdrawn = { image: 'withdrawn.jpg', alt: '철회 사진', caption: '', mediaId: 'withdrawn', placeId: 'food-a', availability: 'withdrawn' };
  const withGallery = place('food-a', 'FOOD', { image: 'withdrawn.jpg', photos: [withdrawn, live] });
  const snapshot = structuredClone(withGallery);
  const journey = buildCreationJourney(brief(), plan(), [withGallery], '나');
  assert.equal(journey.cover, 'live.jpg'); assert.equal(journey.days[0].places[0].image, 'live.jpg');
  assert.deepEqual(journey.days[0].places[0].photos.map(photo => photo.mediaId), ['live']);
  assert.equal(JSON.stringify(journey).includes('withdrawn.jpg'), false); assert.deepEqual(withGallery, snapshot);
  for (const photos of [[], [withdrawn]]) {
    const empty = buildCreationJourney(brief(), plan(), [place('food-a', 'FOOD', { image: 'old-cover.jpg', photos })], '나');
    assert.equal(empty.cover, ''); assert.equal(empty.days[0].places[0].image, '');
    assert.deepEqual(empty.days[0].places[0].photos, []);
  }
});

test('standalone restaurant meeting has an actor-only private backing space, empty RSVP and idempotent explicit commit', () => {
  const state = fixture(), oldGroup = structuredClone(state.groups[0]), oldActivity = structuredClone(state.activities[0]);
  const result = commitCreation(state, 'me', input(), catalog);
  assert.deepEqual(result, { kind: 'ACTIVITY', id: 'create-one' });
  const created = state.activities.find(item => item.id === result.id), backing = state.groups.find(item => item.id === created.groupId);
  assert.equal(backing.spaceType, 'ACTIVITY'); assert.equal(backing.visibility, 'PRIVATE');
  assert.equal(backing.promotionPublished, false); assert.deepEqual(backing.memberIds, ['me']); assert.deepEqual(backing.interestPlaceIds, ['food-a']);
  assert.deepEqual(created.participants, {}); assert.deepEqual(created.arrivedIds, []); assert.equal(created.revision, 1);
  assert.equal(created.kind, 'MEETUP'); assert.match(created.meetingPoint, /food-a 지점/);
  assert.deepEqual(state.groups[0], oldGroup); assert.deepEqual(state.activities[0], oldActivity);
  const after = structuredClone(state); assert.deepEqual(commitCreation(state, 'me', input(), catalog), result); assert.deepEqual(state, after);
  assert.equal(isTogetherState(state), true);
});

test('new group stays private and paused, creates no automatic appointment, invitation, application or RSVP', () => {
  const state = fixture(), oldCounts = { activities: state.activities.length, invites: state.invites.length, applications: state.applications.length };
  const request = input({ requestId: 'new-family', brief: brief({ purpose: 'GROUP', theme: 'FOOD' }), plan: null, groupDraft: { name: '우리 가족', kind: 'FAMILY', region: '부산', introduction: '함께 식사해요.' } });
  assert.deepEqual(commitCreation(state, 'me', request, catalog), { kind: 'GROUP', id: 'new-family' });
  const created = state.groups.find(item => item.id === 'new-family');
  assert.equal(created.visibility, 'PRIVATE'); assert.equal(created.spaceType, 'GROUP'); assert.equal(created.promotionPublished, false);
  assert.deepEqual(created.memberIds, ['me']); assert.deepEqual(created.managerIds, []); assert.equal(created.ownerId, 'me');
  assert.equal(created.discovery.recruitment, 'PAUSED'); assert.deepEqual(created.discovery.topics, ['FOOD']);
  assert.deepEqual({ activities: state.activities.length, invites: state.invites.length, applications: state.applications.length }, oldCounts);
  const beforeReplay = structuredClone(state); commitCreation(state, 'me', request, catalog); assert.deepEqual(state, beforeReplay);
  rejectedAtomically(state, () => commitCreation(state, 'me', { ...request, groupDraft: { ...request.groupDraft, name: '다른 이름' } }, catalog));
  assert.equal(isTogetherState(state), true);
});

test('existing persistent group accepts a member-created activity without copying membership into RSVP or modifying another itinerary', () => {
  const state = fixture();
  const fixedJourney = buildCreationJourney(brief(), plan(), catalog, '원 작성자');
  fixedJourney.days[0].places[0].bookingFixed = true; fixedJourney.days[0].places[0].note = 'PRIVATE-ORIGINAL';
  fixedJourney.travelProgress = { dayId: fixedJourney.days[0].dayId, visits: { old: { status: 'done', recordedAt: '2026-11-04T00:00:00Z' } } };
  state.activities[0].journey = fixedJourney;
  const original = structuredClone(state.activities[0]), originalGroup = structuredClone(state.groups[0]);
  commitCreation(state, 'me', input({ groupId: 'g' }), catalog);
  const created = state.activities.find(item => item.id === 'create-one');
  assert.equal(created.groupId, 'g'); assert.equal(state.groups.length, 1); assert.deepEqual(created.participants, {});
  assert.deepEqual(state.activities[0], original); assert.deepEqual(state.groups[0], originalGroup);
  assert.equal(created.journey.days[0].places[0].bookingFixed, false);
  assert.equal(created.journey.days[0].places[0].note, ''); assert.equal(created.journey.travelProgress, undefined);
});

test('current membership, block/archive status and persistent-group boundary are rechecked before creation', () => {
  for (const mutate of [state => state.groups[0].memberIds = ['owner'], state => state.groups[0].blockedMemberIds = ['me'], state => state.groups[0].archived = true, state => state.groups[0].spaceType = 'ACTIVITY']) {
    const state = fixture(); mutate(state); rejectedAtomically(state, () => commitCreation(state, 'me', input({ groupId: 'g' }), catalog));
  }
  const state = fixture(); rejectedAtomically(state, () => commitCreation(state, '', input(), catalog));
  rejectedAtomically(state, () => commitCreation(state, 'unknown', input(), catalog));
  rejectedAtomically(state, () => commitCreation(state, 'outsider', input({ groupId: 'g' }), catalog));
  rejectedAtomically(state, () => commitCreation(state, 'me', input({ groupId: 'missing' }), catalog));
});

test('latest catalog withdrawal/private/fixed or unknown identities reject a stale proposal atomically', () => {
  const state = fixture();
  for (const currentCatalog of [[], [place('food-a', 'FOOD', { publicationStatus: 'WITHDRAWN' })], [place('food-a', 'FOOD', { personal: true })], [place('food-a', 'FOOD', { bookingFixed: true })], [place('food-a', 'FOOD', { locationVerified: false })], [place('food-a'), place('food-a')]]) rejectedAtomically(state, () => commitCreation(state, 'me', input({ groupId: 'g' }), currentCatalog));
  const request = input(); commitCreation(state, 'me', request, catalog);
  rejectedAtomically(state, () => commitCreation(state, 'me', request, []));
});

test('request replay rejects changed purpose and DAY partition even if flattened place identities are unchanged', () => {
  const conditions = brief({ purpose: 'TRIP', date: '2999-11-07', endDate: '2999-11-08', dayCount: 2, theme: 'TRAVEL' });
  const firstPlan = plan(['food-a', 'cafe', 'food-b'], { days: [{ day: 1, placeIds: ['food-a', 'cafe'] }, { day: 2, placeIds: ['food-b'] }] });
  const state = fixture(), request = input({ groupId: 'g', brief: conditions, plan: firstPlan });
  commitCreation(state, 'me', request, catalog);
  const changedPartition = { ...firstPlan, days: [{ day: 1, placeIds: ['food-a'] }, { day: 2, placeIds: ['cafe', 'food-b'] }] };
  rejectedAtomically(state, () => commitCreation(state, 'me', { ...request, plan: changedPartition }, catalog));
  const separate = fixture(), one = input({ groupId: 'g' }); commitCreation(separate, 'me', one, catalog);
  rejectedAtomically(separate, () => commitCreation(separate, 'me', { ...one, brief: { ...one.brief, purpose: 'TRIP' } }, catalog));
});

test('colliding activity/backing-space/group IDs reject without leaving a partial empty group', () => {
  for (const setup of [state => state.groups.push(group('space-create-one')), state => state.groups.push(group('create-one')), state => state.activities.push({ ...state.activities[0], id: 'space-create-one' })]) {
    const state = fixture(); setup(state); rejectedAtomically(state, () => commitCreation(state, 'me', input(), catalog));
  }
  const state = fixture(); rejectedAtomically(state, () => commitCreation(state, 'me', input({ requestId: 'bad/request' }), catalog));
});

test('date poll uses exact scope and current revision, deduplicates retries and never changes dates or RSVP', () => {
  const state = fixture(), beforeActivity = structuredClone(state.activities[0]);
  const request = { ...scope(), question: '가능한 날', options: ['2999-11-07 12:00 (한국 시각)', '2999-11-08 12:00 (한국 시각)'] };
  assert.equal(createPlanningPoll(state, 'me', request), 'planning-write');
  assert.equal(createPlanningPoll(state, 'me', request), 'planning-write');
  assert.equal(createPlanningPoll(state, 'me', { ...request, id: 'another-id' }), 'planning-write');
  assert.equal(state.polls.length, 1); assert.deepEqual(state.polls[0].options.map(item => item.voterIds), [[], []]);
  assert.deepEqual(state.messages.filter(item => item.entity).map(item => ({ roomId: item.roomId, entity: item.entity })), [{ roomId: 'activity:existing', entity: { type: 'POLL', id: 'planning-write' } }]);
  assert.deepEqual(state.activities[0], beforeActivity);
  rejectedAtomically(state, () => createPlanningPoll(state, 'me', { ...request, expectedRevision: 2 }));
  rejectedAtomically(state, () => createPlanningPoll(state, 'me', { ...request, question: '내용 변경' }));
  for (const options of [['하나'], ['같음', ' 같음 '], Array.from({ length: 9 }, (_, index) => `후보 ${index}`), ['첫 후보', '']]) rejectedAtomically(state, () => createPlanningPoll(state, 'me', { ...request, id: 'bad-options', options }));
});

test('explicit place-undecided activities preserve empty DAYs, no invented route and one current-group chat link', () => {
  const state = fixture(), original = structuredClone(state.activities[0]);
  const requestBrief = brief({ purpose: 'TRIP', dayCount: 2, date: '', startTime: '', endDate: '', locationUndecided: true, topics: ['BOOK', 'GAME'] });
  const selected = buildCreationPlans(requestBrief, [])[0]; assert.ok(selected);
  const request = input({ requestId: 'venue-later', brief: requestBrief, plan: selected, groupId: 'g' });
  const result = commitCreation(state, 'me', request, []), activity = state.activities.find(item => item.id === result.id);
  assert.equal(activity.meetingPoint, ''); assert.equal(activity.journey.cover, ''); assert.equal(activity.journey.days.length, 2);
  assert.deepEqual(activity.journey.days.map(day => day.places), [[], []]); assert.deepEqual(activity.journey.days.map(day => day.blocks), [[], []]);
  assert.equal(activity.date, ''); assert.equal(activity.endDate, ''); assert.match(activity.description, /장소는 나중에 정하는 일정/);
  assert.match(activity.description, /함께할 활동: 독서 · 보드게임/); assert.deepEqual(activity.journey.tags, ['독서', '보드게임']);
  assert.deepEqual(activity.participants, {}); assert.deepEqual(state.activities[0], original);
  assert.deepEqual(state.messages.filter(item => item.entity).map(item => ({ roomId: item.roomId, entity: item.entity })), [{ roomId: 'group:g', entity: { type: 'ACTIVITY', id: 'venue-later' } }]);
  const beforeRetry = structuredClone(state); commitCreation(state, 'me', request, []); assert.deepEqual(state, beforeRetry);
  rejectedAtomically(state, () => commitCreation(state, 'me', { ...request, requestId: 'unconfirmed-empty', brief: { ...requestBrief, locationUndecided: false } }, []));
  assert.equal(isTogetherState(state), true);
});

test('polls reject past/cancelled/completed/archive/blocked spaces and cross-group activity targets', () => {
  for (const mutate of [state => state.activities[0].date = '2000-01-01', state => state.activities[0].status = 'COMPLETED', state => state.activities[0].status = 'CANCELLED', state => state.groups[0].archived = true, state => state.groups[0].blockedMemberIds = ['me']]) {
    const state = fixture(); mutate(state); rejectedAtomically(state, () => createPlanningPoll(state, 'me', { ...scope(), question: '날짜', options: ['첫 후보', '둘째 후보'] }));
  }
  const state = fixture(); rejectedAtomically(state, () => createPlanningPoll(state, 'outsider', { ...scope(), question: '날짜', options: ['첫 후보', '둘째 후보'] }));
  rejectedAtomically(state, () => createPlanningPoll(state, 'me', { ...scope({ activityId: 'unknown' }), question: '날짜', options: ['첫 후보', '둘째 후보'] }));
});

test('feedback explicitly saves only typed text, permits a past completed activity and deduplicates repeated confirmation', () => {
  const state = fixture(); state.activities[0].date = '2000-01-01'; state.activities[0].status = 'COMPLETED';
  state.messages.push({ id: 'private-message', roomId: 'activity:existing', authorId: 'owner', body: 'PRIVATE-CHAT', createdAt: '2026-11-04T00:00:00Z' });
  const request = { ...scope(), body: '이번엔 걷기가 길었어요. 다음에는 카페에서 쉬고 싶어요.' }, oldActivity = structuredClone(state.activities[0]);
  assert.equal(savePlanningFeedback(state, 'me', request), 'planning-write');
  assert.equal(savePlanningFeedback(state, 'me', { ...request, id: 'repeat' }), 'planning-write');
  assert.equal(state.posts.length, 1); assert.equal(state.posts[0].category, 'REVIEW'); assert.equal(state.posts[0].authorId, 'me');
  assert.equal(state.posts[0].activityId, 'existing'); assert.equal(state.posts[0].body, request.body); assert.deepEqual(state.posts[0].comments, []);
  assert.equal(JSON.stringify(state.posts).includes('PRIVATE-CHAT'), false); assert.deepEqual(state.activities[0], oldActivity);
  rejectedAtomically(state, () => savePlanningFeedback(state, 'me', { ...request, body: '다른 후기' }));
  rejectedAtomically(state, () => savePlanningFeedback(state, 'me', { ...request, expectedRevision: 2 }));
});

test('feedback is blocked after revocation/cancellation/archive and cannot impersonate another member or exceed scope', () => {
  for (const mutate of [state => state.activities[0].status = 'CANCELLED', state => state.groups[0].archived = true, state => state.groups[0].blockedMemberIds = ['me'], state => state.groups[0].memberIds = ['owner']]) {
    const state = fixture(); mutate(state); rejectedAtomically(state, () => savePlanningFeedback(state, 'me', { ...scope(), body: '후기' }));
  }
  const state = fixture();
  rejectedAtomically(state, () => savePlanningFeedback(state, 'outsider', { ...scope(), body: '후기' }));
  rejectedAtomically(state, () => savePlanningFeedback(state, 'me', { ...scope({ activityId: 'foreign' }), body: '후기' }));
  rejectedAtomically(state, () => savePlanningFeedback(state, 'me', { ...scope(), body: ' ' }));
  rejectedAtomically(state, () => savePlanningFeedback(state, 'me', { ...scope(), body: '가'.repeat(1601) }));
});
