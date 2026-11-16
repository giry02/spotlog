import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { isTogetherState, createTogetherRepository, togetherStorageKey } from '../src/together/repository.ts';
import { createMeetingDecision, submitDecisionResponse, selectMeetingDecision, compareMeetingDecision, previewMeetingDecisionApplication, applyMeetingDecision, isTogetherDecision, isMeetingDecisionStateFields } from '../src/together/meetingDecision.ts';

const at = new Date('2026-11-11T03:00:00Z');
const scope = { groupId: 'group', activityId: 'activity' };
const p = (id, lat = 35.16, lng = 129.16) => ({ id, kind: 'FOOD', name: id, area: '부산', address: `${id} 주소`, lat, lng, locationVerified: true, image: '', description: '', note: '', duration: '' });
const places = [p('food-a'), p('food-b', 35.17, 129.14), p('origin-a', 35.15, 129.16), p('origin-b', 35.18, 129.12)];
const baseInput = () => ({ title: '회식 장소 정하기', candidates: [{ placeId: 'food-a', referenceCostKrw: 30000 }, { placeId: 'food-b' }], dateOptions: [{ id: 'date-a', date: '2026-11-21', time: '19:00' }, { id: 'date-b', date: '2026-11-22' }], expectedActivityRevision: 4 });
function fixture() {
  const state = createEmptyState('owner', '나'); state.members.push({ id: 'member', name: '멤버' }, { id: 'third', name: '세 번째' });
  state.groups.push({ id: 'group', name: '모임', kind: 'FRIENDS', region: '부산', introduction: '', cover: '', visibility: 'PRIVATE', ownerId: 'owner', memberIds: ['owner', 'member', 'third'], managerIds: [], archived: false, promotionPublished: false, promotionActivityIds: ['activity'], promotionActivitySnapshots: [] });
  state.activities.push({ id: 'activity', groupId: 'group', title: '회식', date: '2026-11-20', endDate: '2026-11-20', startTime: '18:00', meetingPoint: '기존 장소', description: '', status: 'PLANNED', leadId: 'owner', editorIds: [], participants: { owner: 'MAYBE', member: 'JOINED' }, arrivedIds: ['member'], revision: 4 });
  state.activities.push({ ...structuredClone(state.activities[0]), id: 'other-activity' });
  return state;
}
function start(state = fixture(), input = baseInput()) { return { state, id: createMeetingDecision(state, 'owner', scope, input, places, at) }; }
function respond(state, id, actor = 'owner', changes = {}) {
  submitDecisionResponse(state, actor, scope, id, { availablePlaceIds: ['food-a', 'food-b'], preferredPlaceId: 'food-a', availableDateIds: ['date-a', 'date-b'], expectedRevision: state.decisions.find(row => row.id === id).revision, ...changes }, places, at);
}
const selection = { placeId: 'food-a', dateOptionId: 'date-a', acknowledgeMissing: true };

test('starting stores explicit typed candidates and current expected members without changing venue, RSVP or creating votes', () => {
  const state = fixture(), before = structuredClone(state), input = baseInput();
  const id = createMeetingDecision(state, 'owner', scope, input, places, at);
  input.candidates[0].referenceCostKrw = 999;
  assert.deepEqual(state.activities, before.activities); assert.deepEqual(state.polls, []);
  assert.deepEqual(state.decisions[0].expectedMemberIds, ['owner', 'member', 'third']);
  assert.equal(state.decisions[0].candidates[0].referenceCostKrw, 30000);
  assert.equal(selectMeetingDecision(state, 'member', scope, places).decision.id, id);
  assert.equal(isTogetherState(state), true);
});

test('invalid, personal, unavailable and duplicate candidate/date inputs never leave partial decisions', () => {
  for (const change of [
    { candidates: [{ placeId: 'food-a' }] }, { candidates: [{ placeId: 'food-a' }, { placeId: 'food-a' }] }, { candidates: [{ placeId: 'missing' }, { placeId: 'food-b' }] },
    { candidates: [{ placeId: 'food-a', referenceCostKrw: -1 }, { placeId: 'food-b' }] }, { candidates: [{ placeId: 'food-a', referenceCostKrw: '30000' }, { placeId: 'food-b' }] },
    { dateOptions: [{ id: 'date-a', date: '2026-02-30' }] }, { dateOptions: [{ id: 'date-a', date: '2026-11-10' }] },
    { dateOptions: [{ id: 'date-a', date: '2026-11-21', time: '25:00' }] }, { dateOptions: [{ id: 'date-a', date: '2026-11-21' }, { id: 'date-b', date: '2026-11-21' }] },
    { expectedActivityRevision: 3 }, { privateReason: 'do not persist' },
  ]) {
    const state = fixture(), before = structuredClone(state);
    assert.throws(() => createMeetingDecision(state, 'owner', scope, { ...baseInput(), ...change }, places, at)); assert.deepEqual(state, before);
  }
  const state = fixture(); assert.throws(() => createMeetingDecision(state, 'owner', scope, baseInput(), places.map(row => ({ ...row, personal: true })), at));
});

test('exact activity, active registered membership, management, archive, block, trash and deadline guards apply before all writes', () => {
  for (const modify of [
    s => { s.groups[0].archived = true; }, s => { s.groups[0].blockedMemberIds = ['owner']; }, s => { s.groups[0].memberIds = ['member', 'third']; },
    s => { s.members = s.members.filter(row => row.id !== 'owner'); }, s => { s.activities[0].status = 'CANCELLED'; }, s => { s.activities[0].status = 'COMPLETED'; },
    s => { s.groups[0].temporaryRoom = { purpose: 'BUSINESS', expiresAt: '2026-11-11T02:59:00Z' }; },
  ]) { const state = fixture(); modify(state); const before = structuredClone(state); assert.throws(() => createMeetingDecision(state, 'owner', scope, baseInput(), places, at)); assert.deepEqual(state, before); }
  const state = fixture(); assert.throws(() => createMeetingDecision(state, 'member', scope, baseInput(), places, at));
  assert.throws(() => createMeetingDecision(state, 'owner', { ...scope, activityId: 'missing' }, baseInput(), places, at));
  const active = start(); active.state.groups[0].temporaryRoom = { purpose: 'DINNER', disposition: 'TRASH' };
  assert.throws(() => selectMeetingDecision(active.state, 'owner', scope, places));
  assert.throws(() => compareMeetingDecision(active.state, 'owner', scope, active.id, places, at));
});

test('responses store only explicitly submitted availability and optional reference values, never a private exclusion reason', () => {
  const { state, id } = start(); respond(state, id, 'member', { availablePlaceIds: ['food-b'], preferredPlaceId: 'food-b', availableDateIds: [], budgetMaxKrw: 25000, originPlaceId: 'origin-a' });
  const response = state.decisions[0].responses[0];
  assert.deepEqual(response.availablePlaceIds, ['food-b']); assert.deepEqual(response.availableDateIds, []); assert.equal(response.budgetMaxKrw, 25000);
  const before = structuredClone(state);
  assert.throws(() => respond(state, id, 'member', { exclusionReason: '비공개 건강 사유' }));
  assert.deepEqual(state, before); assert.equal(JSON.stringify(state).includes('비공개 건강 사유'), false);
  const selected = selectMeetingDecision(state, 'member', scope, places, id, at); selected.ownResponse.availablePlaceIds.push('food-a');
  assert.deepEqual(state.decisions[0].responses[0].availablePlaceIds, ['food-b']);
});

test('invalid preference, foreign availability, unknown origins, duplicate IDs, prices and stale response revisions fail atomically', () => {
  for (const change of [{ availablePlaceIds: ['missing'] }, { availablePlaceIds: ['food-a', 'food-a'] }, { preferredPlaceId: 'origin-a' }, { availableDateIds: ['other-date'] }, { originPlaceId: 'private-origin' }, { budgetMaxKrw: -1 }, { budgetMaxKrw: 2.5 }, { expectedRevision: 999 }]) {
    const { state, id } = start(), before = structuredClone(state); assert.throws(() => respond(state, id, 'member', change)); assert.deepEqual(state, before);
  }
  const { state, id } = start(); respond(state, id); const old = state.decisions[0].revision;
  respond(state, id, 'member'); const before = structuredClone(state);
  assert.throws(() => respond(state, id, 'owner', { expectedRevision: old })); assert.deepEqual(state, before);
});

test('comparison reports unanswered members separately and does not claim agreement with zero responses', () => {
  const { state, id } = start();
  let compared = compareMeetingDecision(state, 'owner', scope, id, places, at);
  assert.equal(compared.responseCount, 0); assert.equal(compared.rows[0].allAvailable, false); assert.equal(compared.dates[0].allAvailable, false); assert.equal(compared.missingMemberIds.length, 3);
  assert.throws(() => previewMeetingDecisionApplication(state, 'owner', scope, id, selection, places, at));
  respond(state, id); compared = compareMeetingDecision(state, 'owner', scope, id, places, at);
  assert.equal(compared.responseCount, 1); assert.equal(compared.expectedMemberCount, 3); assert.deepEqual(compared.missingMemberIds, ['member', 'third']); assert.equal(compared.rows[0].allAvailable, true);
  assert.throws(() => previewMeetingDecisionApplication(state, 'owner', scope, id, { ...selection, acknowledgeMissing: false }, places, at), /미응답/);
});

test('a submitted unavailable candidate or date can never be forced by the owner or missing-response acknowledgement', () => {
  const { state, id } = start(); respond(state, id); respond(state, id, 'member', { availablePlaceIds: ['food-b'], preferredPlaceId: 'food-b', availableDateIds: ['date-b'] });
  assert.throws(() => previewMeetingDecisionApplication(state, 'owner', scope, id, selection, places, at));
  assert.throws(() => previewMeetingDecisionApplication(state, 'owner', scope, id, { ...selection, placeId: 'food-b' }, places, at));
  const allowed = previewMeetingDecisionApplication(state, 'owner', scope, id, { ...selection, placeId: 'food-b', dateOptionId: 'date-b' }, places, at);
  assert.equal(allowed.after.venueLabel.includes('food-b'), true);
  assert.throws(() => previewMeetingDecisionApplication(state, 'member', scope, id, { ...selection, placeId: 'food-b', dateOptionId: 'date-b' }, places, at));
});

test('budget and straight-line comparisons distinguish unknown cost and location instead of inventing zero cost or road time', () => {
  const { state, id } = start(); respond(state, id, 'owner', { budgetMaxKrw: 20000, originPlaceId: 'origin-a' }); respond(state, id, 'member', { budgetMaxKrw: 50000, originPlaceId: 'origin-b' });
  const result = compareMeetingDecision(state, 'owner', scope, id, places, at), [a, b] = result.rows;
  assert.equal(result.budgetKnownCount, 2); assert.equal(result.budgetMinKrw, 20000); assert.equal(result.budgetMaxKrw, 50000);
  assert.equal(a.overBudgetCount, 1); assert.equal(a.withinBudgetCount, 1); assert.equal(b.referenceCostKrw, undefined); assert.equal(b.unknownBudgetCount, 2);
  assert.equal(a.distance.knownOriginCount, 2); assert.ok(a.distance.maxKm > 0); assert.ok(a.distance.spreadKm >= 0); assert.equal('roadTime' in a.distance, false);
  const unknown = compareMeetingDecision(state, 'owner', scope, id, places.map(row => ({ ...row, locationVerified: false })), at);
  assert.equal(unknown.rows[0].distance.knownOriginCount, 0); assert.equal(unknown.rows[0].distance.maxKm, undefined);
  const preview = previewMeetingDecisionApplication(state, 'owner', scope, id, selection, places, at); assert.ok(preview.notes.some(note => note.includes('참고 예산보다 높')));
});

test('the explicit before/after confirmation changes only venue and selected dates, retaining RSVP and unrelated records', () => {
  const { state, id } = start(); respond(state, id); const before = structuredClone(state);
  const preview = previewMeetingDecisionApplication(state, 'owner', scope, id, selection, places, at);
  assert.equal(preview.before.venueLabel, '기존 장소'); assert.ok(preview.after.dateLabel.includes('2026-11-21'));
  assert.deepEqual(state, before, 'preview is read-only');
  applyMeetingDecision(state, 'owner', preview, places, at);
  assert.equal(state.activities[0].venuePlaceId, 'food-a'); assert.equal(state.activities[0].date, '2026-11-21'); assert.equal(state.activities[0].startTime, '19:00');
  assert.equal(state.activities[0].revision, 5); assert.deepEqual(state.activities[0].participants, before.activities[0].participants); assert.deepEqual(state.activities[0].arrivedIds, before.activities[0].arrivedIds);
  assert.deepEqual(state.activities[1], before.activities[1]); assert.deepEqual(state.polls, []); assert.deepEqual(state.groups[0].promotionActivityIds, []);
  assert.equal(state.decisions[0].status, 'APPLIED'); assert.deepEqual(state.decisions[0].applied.acknowledgedMissingMemberIds, ['member', 'third']); assert.equal(isTogetherState(state), true);
  const applied = structuredClone(state); assert.throws(() => applyMeetingDecision(state, 'owner', preview, places, at)); assert.deepEqual(state, applied);
});

test('an old comparison cannot apply after changed response, appointment, candidate source, origin coordinates or authority', () => {
  for (const mutate of [
    s => respond(s, s.decisions[0].id, 'member'), s => { s.activities[0].revision++; }, s => { s.activities[0].participants.third = 'JOINED'; },
    s => { s.groups[0].blockedMemberIds = ['owner']; }, s => { s.groups[0].ownerId = 'member'; s.activities[0].leadId = 'member'; },
  ]) {
    const { state, id } = start(); respond(state, id); const preview = previewMeetingDecisionApplication(state, 'owner', scope, id, selection, places, at); mutate(state); const before = structuredClone(state);
    assert.throws(() => applyMeetingDecision(state, 'owner', preview, places, at)); assert.deepEqual(state, before);
  }
  for (const changed of [places.filter(row => row.id !== 'food-b'), places.map(row => row.id === 'food-a' ? { ...row, name: '바뀐 업체' } : row), places.map(row => row.id === 'origin-a' ? { ...row, lat: row.lat + 1 } : row)]) {
    const { state, id } = start(); respond(state, id, 'owner', { originPlaceId: 'origin-a' }); const preview = previewMeetingDecisionApplication(state, 'owner', scope, id, selection, places, at), before = structuredClone(state);
    assert.throws(() => applyMeetingDecision(state, 'owner', preview, changed, at)); assert.deepEqual(state, before);
  }
});

test('current invited members can join the existing comparison and roster changes invalidate an old confirmation without clearing active responses', () => {
  for (const modify of [s => { s.groups[0].memberIds = ['owner', 'member']; }, s => { s.members.push({ id: 'new', name: '새 멤버' }); s.groups[0].memberIds.push('new'); }]) {
    const { state, id } = start(); respond(state, id); const preview = previewMeetingDecisionApplication(state, 'owner', scope, id, selection, places, at); modify(state);
    assert.equal(compareMeetingDecision(state, 'owner', scope, id, places, at).membershipChanged, true);
    assert.equal(selectMeetingDecision(state, 'owner', scope, places, id, at).canRespond, true);
    const changed = structuredClone(state); assert.throws(() => applyMeetingDecision(state, 'owner', preview, places, at)); assert.deepEqual(state, changed);
    respond(state, id, state.groups[0].memberIds.includes('new') ? 'new' : 'member', state.groups[0].memberIds.includes('new') ? { expectedRevision: 0 } : {});
    assert.equal(state.decisions.length, 1); assert.equal(state.decisions[0].status, 'OPEN'); assert.ok(state.decisions[0].responses.some(row => row.userId === 'owner'));
    assert.deepEqual(state.decisions[0].expectedMemberIds, state.groups[0].memberIds);
    assert.equal(compareMeetingDecision(state, 'owner', scope, id, places, at).membershipChanged, false);
    const updated = previewMeetingDecisionApplication(state, 'owner', scope, id, selection, places, at); applyMeetingDecision(state, 'owner', updated, places, at); assert.equal(isTogetherState(state), true);
  }
});

test('departed or blocked responses no longer count and saving preserves every active member response', () => {
  const { state, id } = start(); respond(state, id); respond(state, id, 'member', { availablePlaceIds: [], preferredPlaceId: undefined }); respond(state, id, 'third');
  state.groups[0].blockedMemberIds = ['member'];
  const compared = compareMeetingDecision(state, 'owner', scope, id, places, at); assert.equal(compared.responseCount, 2); assert.equal(compared.expectedMemberCount, 2); assert.equal(compared.rows[0].allAvailable, true);
  const ownerResponse = structuredClone(state.decisions[0].responses[0]); respond(state, id, 'third');
  assert.deepEqual(state.decisions[0].responses.find(row => row.userId === 'owner'), ownerResponse); assert.ok(!state.decisions[0].responses.some(row => row.userId === 'member')); assert.equal(state.decisions.length, 1);
});

test('a transferred owner can retain the same comparison after its original creator leaves', () => {
  const { state, id } = start(); respond(state, id); state.groups[0].ownerId = 'member'; state.activities[0].leadId = 'member'; state.groups[0].memberIds = ['member', 'third'];
  respond(state, id, 'member'); assert.equal(state.decisions[0].creatorId, 'owner'); assert.deepEqual(state.decisions[0].expectedMemberIds, ['member', 'third']); assert.equal(isTogetherState(state), true);
  const reviewed = previewMeetingDecisionApplication(state, 'member', scope, id, selection, places, at); applyMeetingDecision(state, 'member', reviewed, places, at); assert.equal(isTogetherState(state), true);
});

test('an explicitly entered zero budget or free reference price is known and distinct from missing information', () => {
  const { state, id } = start(fixture(), { ...baseInput(), candidates: [{ placeId: 'food-a', referenceCostKrw: 0 }, { placeId: 'food-b' }] });
  respond(state, id, 'owner', { budgetMaxKrw: 0 }); const result = compareMeetingDecision(state, 'owner', scope, id, places, at);
  assert.equal(result.budgetKnownCount, 1); assert.equal(result.budgetMinKrw, 0); assert.equal(result.rows[0].referenceCostKrw, 0); assert.equal(result.rows[0].withinBudgetCount, 1); assert.equal(result.rows[0].unknownBudgetCount, 0); assert.equal(result.rows[1].unknownBudgetCount, 1);
});

test('restart must review the exact current decision revision and cannot erase earlier responses on failure', () => {
  const { state, id } = start(); respond(state, id); const before = structuredClone(state);
  assert.throws(() => createMeetingDecision(state, 'owner', scope, baseInput(), places, at));
  assert.throws(() => createMeetingDecision(state, 'owner', scope, { ...baseInput(), replaceDecisionId: id, expectedDecisionRevision: 1 }, places, at));
  assert.deepEqual(state, before);
});

test('a decision without date candidates preserves dates, route bookings and all personal route text', () => {
  const state = fixture();
  state.activities[0].journey = { id: 'route', purpose: 'PLAN', planStage: 'READY', title: '동선', region: '부산', dateRange: '', duration: '1일', status: 'PLANNING', visibility: 'PRIVATE', cover: '', summary: '', story: '', tags: [], saves: 0, author: '나', isMine: false,
    days: [{ dayId: 'day', day: 1, date: '2026-11-20', title: '첫날', story: '기존 이야기', places: [{ ...places[0], visitId: 'visit', note: '기존 메모', bookingFixed: true }], blocks: [{ id: 'block', type: 'PLACE', visitId: 'visit', placeId: 'food-a' }] }] };
  const { id } = start(state, { ...baseInput(), dateOptions: [] }); respond(state, id, 'owner', { availableDateIds: [] });
  const journey = structuredClone(state.activities[0].journey), preview = previewMeetingDecisionApplication(state, 'owner', scope, id, { placeId: 'food-a', acknowledgeMissing: true }, places, at);
  applyMeetingDecision(state, 'owner', preview, places, at);
  assert.deepEqual(state.activities[0].journey, journey); assert.equal(state.activities[0].date, '2026-11-20'); assert.equal(state.activities[0].startTime, '18:00');
});

test('date application keeps route order and duration, but a booking-fixed visit blocks shifting its dates', () => {
  for (const fixed of [false, true]) {
    const state = fixture(); state.activities[0].endDate = '2026-11-21'; state.activities[0].journey = { id: 'route', purpose: 'PLAN', planStage: 'READY', title: '여행', region: '부산', dateRange: '', duration: '1박 2일', status: 'PLANNING', visibility: 'PRIVATE', cover: '', summary: '', story: '', tags: [], saves: 0, author: '나', isMine: false,
      days: [0, 1].map(index => ({ dayId: `day-${index}`, day: index + 1, date: `2026-11-${20 + index}`, title: 'DAY', story: '', places: [{ ...places[index], visitId: `visit-${index}`, bookingFixed: fixed }], blocks: [] })) };
    const { id } = start(state); respond(state, id); const before = structuredClone(state.activities[0]);
    if (fixed) { assert.throws(() => previewMeetingDecisionApplication(state, 'owner', scope, id, selection, places, at), /예약/); assert.deepEqual(state.activities[0], before); }
    else { const preview = previewMeetingDecisionApplication(state, 'owner', scope, id, selection, places, at); applyMeetingDecision(state, 'owner', preview, places, at); assert.equal(state.activities[0].endDate, '2026-11-22'); assert.deepEqual(state.activities[0].journey.days.map(day => day.places), before.journey.days.map(day => day.places)); assert.deepEqual(state.activities[0].journey.days.map(day => day.date), ['2026-11-21', '2026-11-22']); }
  }
});

test('foreign decision IDs, missing acknowledgement, forged preview labels and another account cannot apply', () => {
  const { state, id } = start(); respond(state, id); const preview = previewMeetingDecisionApplication(state, 'owner', scope, id, selection, places, at), before = structuredClone(state);
  assert.throws(() => previewMeetingDecisionApplication(state, 'owner', { ...scope, activityId: 'other-activity' }, id, selection, places, at));
  assert.throws(() => applyMeetingDecision(state, 'member', preview, places, at));
  assert.throws(() => applyMeetingDecision(state, 'owner', { ...preview, after: { ...preview.after, venueLabel: '조작된 주소' } }, places, at));
  assert.throws(() => applyMeetingDecision(state, 'owner', { ...preview, selection: { ...selection, acknowledgeMissing: false } }, places, at));
  assert.deepEqual(state, before);
});

test('schema-v1 accepts missing optional decisions and rejects duplicate, foreign and private-reason payloads', () => {
  const old = fixture(); assert.equal(isTogetherState(old), true); assert.equal(isMeetingDecisionStateFields(old), true);
  const { state, id } = start(); respond(state, id); assert.equal(isTogetherDecision(state.decisions[0]), true); assert.equal(isTogetherState(state), true);
  for (const mutate of [s => { s.decisions[0].responses[0].privateReason = 'secret'; }, s => { s.decisions[0].responses[0].availablePlaceIds = ['foreign']; }, s => { s.decisions[0].candidates[0].referenceCostKrw = -1; }, s => { s.decisions.push({ ...s.decisions[0], id: 'duplicate-open' }); }, s => { s.decisions[0].activityId = 'foreign'; }, s => { s.decisions[0].expectedMemberIds.push('owner'); }]) {
    const candidate = structuredClone(state); mutate(candidate); assert.equal(isTogetherState(candidate), false);
  }
});

test('repository persistence failure and stale-tab writes cannot partially apply a reviewed decision', () => {
  const { state, id } = start(); respond(state, id); const values = new Map([[togetherStorageKey('owner'), JSON.stringify(state)]]); let fail = false;
  const disk = { getItem: key => values.get(key) ?? null, setItem: (key, value) => { if (fail) throw new Error('quota'); values.set(key, value); } };
  const repository = createTogetherRepository('owner', '나', places, disk), current = repository.getSnapshot();
  const preview = previewMeetingDecisionApplication(current, 'owner', scope, id, selection, places, at), bytes = disk.getItem(togetherStorageKey('owner'));
  fail = true; assert.equal(repository.update(draft => applyMeetingDecision(draft, 'owner', preview, places, at)), false); assert.equal(repository.getSnapshot(), current); assert.equal(disk.getItem(togetherStorageKey('owner')), bytes);
  fail = false; const foreign = structuredClone(current); foreign.activities[0].revision++; values.set(togetherStorageKey('owner'), JSON.stringify(foreign));
  assert.equal(repository.update(draft => applyMeetingDecision(draft, 'owner', preview, places, at)), false); assert.equal(repository.getSnapshot().decisions.find(row => row.id === id).status, 'OPEN');
});
