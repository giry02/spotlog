import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareQuickCreation } from '../src/together/quickCreation.ts';
import { refreshCreationPlan, validateCreationPlan } from '../src/together/creationPlanner.ts';
import { commitCreation } from '../src/together/creationCommit.ts';
import { createEmptyState } from '../src/together/model.ts';
import { completeCreationReview, restoreCreationPreview } from '../src/together/creationPreview.ts';
import { isTogetherState } from '../src/together/repository.ts';

const place = (id, kind = 'FOOD', extra = {}) => ({ id, kind, name: `${id} 지점`, area: '부산 해운대', address: `부산 해운대구 ${id}길 1`, lat: 35.16, lng: 129.16, image: `${id}.jpg`, description: '', note: '', duration: '', ...extra });
const catalog = [place('food'), place('cafe', 'CAFE'), place('park-a', 'LANDMARK', { name: '바다 공원', description: '해안 산책로' }), place('park-b', 'LEISURE'), place('stay', 'STAY')];
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };

test('one minimal meetup request becomes one usable editable draft without inventing a date or attendees', () => {
  const result = prepareQuickCreation({ prompt: '부산에서 저녁 식사' }, catalog);
  assert.equal(result.brief.purpose, 'MEETUP');
  assert.equal(result.brief.region, '부산');
  assert.equal(result.brief.date, '');
  assert.equal(result.brief.startTime, '');
  assert.equal(result.brief.people, undefined);
  assert.deepEqual(result.plan.placeIds, ['food']);
  assert.equal(result.plan.days.length, 1);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(validateCreationPlan(result.brief, result.plan, catalog), []);
});

test('blank input and an unknown region produce a location-undecided draft, never an arbitrary city', () => {
  for (const input of [{}, { prompt: '반가운 사람들끼리 만나요' }, { prompt: '뉴욕에서 만나요' }]) {
    const result = prepareQuickCreation(input, catalog);
    assert.equal(result.brief.region, '');
    assert.equal(result.brief.locationUndecided, true);
    assert.equal(result.brief.date, '');
    assert.deepEqual(result.plan.placeIds, []);
    assert.deepEqual(result.plan.days, [{ day: 1, placeIds: [] }]);
    assert.deepEqual(result.issues, []);
    assert.match(result.plan.unknowns.join(' '), /장소.*정해지지/);
  }
});

test('route purpose overrides incidental travel language; inherited context removes repeated questions', () => {
  const explicit = prepareQuickCreation({ purpose: 'MEETUP', prompt: '부산에서 다음 여행 이야기를 하며 저녁 식사', initial: { region: '부산 해운대', people: 4 } }, catalog);
  assert.equal(explicit.brief.purpose, 'MEETUP');
  assert.equal(explicit.brief.region, '부산 해운대');
  assert.equal(explicit.brief.people, 4);
  assert.equal(explicit.plan.days.length, 1);
  assert.equal(prepareQuickCreation({ prompt: '부산 여행' }, catalog).brief.purpose, 'MEETUP');
  assert.equal(prepareQuickCreation({ purpose: 'TRIP', prompt: '부산', initial: { region: '' } }, catalog).brief.region, '부산');
  for (const prompt of ['회사 회식', '친구와 저녁', '제주 가족여행']) assert.equal(prepareQuickCreation({ prompt }, catalog).plan.title, prompt);
});

test('a first-screen explicit destination overrides automatic home context, while later manually selected values keep precedence', () => {
  const initial = { region: '부산', theme: 'TRAVEL', people: 4 };
  const first = prepareQuickCreation({ purpose: 'TRIP', prompt: '제주로 가족 2박 3일 여행', initial, preferPromptRegion: true }, catalog);
  assert.equal(first.brief.region, '제주');
  assert.equal(first.brief.people, 4);
  assert.equal(first.plan.days.length, 3);
  assert.deepEqual(first.plan.placeIds, []);
  const manual = prepareQuickCreation({ purpose: 'TRIP', prompt: '제주로 가족 2박 3일 여행', initial }, catalog);
  assert.equal(manual.brief.region, '부산');
  assert.equal(prepareQuickCreation({ prompt: '친구와 저녁', initial, preferPromptRegion: true }, catalog).brief.region, '부산');
});

test('trip defaults to two days while an explicit duration or date range controls the draft', () => {
  assert.equal(prepareQuickCreation({ purpose: 'TRIP', prompt: '부산 여행' }, catalog).plan.days.length, 2);
  for (const days of [1, 3, 7]) {
    const result = prepareQuickCreation({ purpose: 'TRIP', prompt: `부산 ${days}일 여행` }, catalog);
    assert.equal(result.brief.dayCount, days);
    assert.equal(result.plan.days.length, days);
  }
  const dated = prepareQuickCreation({ purpose: 'TRIP', prompt: '부산 2026-12-31 ~ 2027-01-02 여행' }, catalog);
  assert.equal(dated.brief.dayCount, 3);
  assert.equal(dated.plan.days.length, 3);
  assert.equal(prepareQuickCreation({ purpose: 'TRIP', initial: { dayCount: 4 } }, catalog).plan.days.length, 4);
});

test('explicit same-day and one-day travel examples make one DAY while conflicting longer durations remain visible', () => {
  for (const prompt of ['친구들과 당일 바다 여행', '부산으로 하루 여행', '부산에서 하루종일 여행', '부산 당일치기 여행']) {
    const result = prepareQuickCreation({ purpose: 'TRIP', prompt }, catalog);
    assert.equal(result.brief.dayCount, 1);
    assert.equal(result.plan.days.length, 1);
    assert.deepEqual(result.issues, []);
  }
  const duration = prepareQuickCreation({ purpose: 'TRIP', prompt: '부산 당일 여행, 2박 3일' }, catalog);
  assert.equal(duration.brief.dayCount, 3);
  assert.ok(duration.issues.some(issue => issue.includes('당일·하루')));
  const chosen = prepareQuickCreation({ purpose: 'TRIP', prompt: '부산 하루 여행', initial: { dayCount: 4 } }, catalog);
  assert.equal(chosen.brief.dayCount, 4);
  assert.ok(chosen.issues.some(issue => issue.includes('당일·하루')));
  const range = prepareQuickCreation({ purpose: 'TRIP', prompt: '부산 당일 여행 2026-12-31 ~ 2027-01-02' }, catalog);
  assert.equal(range.brief.dayCount, 3);
  assert.ok(range.issues.some(issue => issue.includes('당일·하루')));
});

test('unasked meals, cafes and stays are absent from a trip; explicit requested kinds remain public candidates', () => {
  const simple = prepareQuickCreation({ purpose: 'TRIP', prompt: '부산 여행' }, catalog);
  assert.ok(simple.plan.placeIds.length);
  assert.equal(simple.plan.placeIds.some(id => ['food', 'cafe', 'stay'].includes(id)), false);
  const complete = prepareQuickCreation({ purpose: 'TRIP', prompt: '부산 1박 2일 여행. 식사와 커피, 호텔 숙소도 찾아줘' }, catalog);
  for (const id of ['food', 'cafe', 'stay']) assert.equal(complete.plan.placeIds.includes(id), true);
  assert.equal(complete.plan.source, 'CATALOG');
  assert.match(complete.plan.unknowns.join(' '), /예약.*확인/);
});

test('a group name alone produces a private-start group draft with no automatic appointment or social category', () => {
  const result = prepareQuickCreation({ purpose: 'GROUP', prompt: '토요일 책친구' }, catalog);
  assert.equal(result.groupDraft.name, '토요일 책친구');
  assert.equal(result.plan, null);
  assert.equal(result.groupDraft.region, '');
  assert.deepEqual(result.groupDraft.topics, ['SOCIAL']);
  // A literal friend word is inferred; a neutral name must not receive a social tag.
  const neutral = prepareQuickCreation({ purpose: 'GROUP', name: '열린 서재', initial: { region: '부산' } }, catalog);
  assert.equal(neutral.groupDraft.name, '열린 서재');
  assert.deepEqual(neutral.groupDraft.topics, []);
  const state = createEmptyState('me', '나');
  assert.equal(state.groups.length, 0);
  assert.equal(state.activities.length, 0);
  commitCreation(state, 'me', { requestId: 'quick-group', ...neutral }, catalog);
  assert.equal(state.groups.length, 1);
  assert.equal(state.groups[0].visibility, 'PRIVATE');
  assert.equal(state.groups[0].promotionPublished, false);
  assert.equal(state.groups[0].discovery.recruitment, 'PAUSED');
  assert.deepEqual(state.groups[0].memberIds, ['me']);
  assert.equal(state.activities.length, 0);
  assert.equal(state.invites.length, 0);
  assert.equal(state.applications.length, 0);
});

test('public catalog constraints remain active during draft creation and after manual edits', () => {
  const hostileCatalog = [place('public'), place('private', 'FOOD', { visibility: 'PRIVATE' }), place('personal', 'FOOD', { personal: true }),
    place('withdrawn', 'FOOD', { publicationStatus: 'WITHDRAWN' }), place('fixed', 'FOOD', { bookingFixed: true }),
    place('outside', 'FOOD', { area: '서울 마포', address: '서울 마포구 1' }), place('duplicate'), place('duplicate', 'CAFE')];
  const result = prepareQuickCreation({ prompt: '부산에서 식사' }, hostileCatalog);
  assert.deepEqual(result.plan.placeIds, ['public']);
  for (const id of ['private', 'personal', 'withdrawn', 'fixed', 'outside', 'duplicate', 'invented']) {
    const tampered = { ...result.plan, placeIds: [id], days: [{ day: 1, placeIds: [id] }] };
    assert.ok(validateCreationPlan(result.brief, tampered, hostileCatalog).length);
  }
  const afterWithdrawal = hostileCatalog.map(row => row.id === 'public' ? { ...row, publicationStatus: 'WITHDRAWN' } : row);
  assert.ok(validateCreationPlan(result.brief, result.plan, afterWithdrawal).length);
});

test('a supported activity without relevant data stays undecided instead of substituting an unrelated restaurant', () => {
  const result = prepareQuickCreation({ purpose: 'MEETUP', prompt: '부산에서 테니스 모임' }, [place('food')]);
  assert.deepEqual(result.plan.placeIds, []);
  assert.equal(result.brief.locationUndecided, true);
  assert.deepEqual(validateCreationPlan(result.brief, result.plan, [place('food')]), []);
});

test('inline manual place changes use the existing refresh and latest-catalog validation contract', () => {
  const result = prepareQuickCreation({ prompt: '부산 식사', name: '친구와 저녁' }, catalog);
  const editedBrief = { ...result.brief, topics: ['CAFE'], theme: 'CAFE' };
  const edited = refreshCreationPlan(editedBrief, { ...result.plan, placeIds: ['cafe'], days: [{ day: 1, placeIds: ['cafe'] }] }, catalog);
  assert.equal(edited.title, '친구와 저녁');
  assert.deepEqual(validateCreationPlan(editedBrief, edited, catalog), []);
  assert.equal(edited.unknowns.some(line => line.includes('카페가 없어요')), false);
  assert.deepEqual(result.plan.placeIds, ['food']);
});

test('preparing a draft is pure and invalid explicit conditions remain visible for correction', () => {
  const input = freeze({ purpose: 'TRIP', prompt: '부산 식사', initial: { region: '부산', dayCount: 99, people: 0, date: '2026-02-30', topics: ['FOOD'] } });
  const frozenCatalog = freeze(structuredClone(catalog));
  const before = JSON.stringify({ input, catalog: frozenCatalog });
  const result = prepareQuickCreation(input, frozenCatalog);
  assert.ok(result.issues.some(issue => issue.includes('일수')));
  assert.ok(result.issues.some(issue => issue.includes('인원')));
  assert.ok(result.issues.some(issue => issue.includes('날짜')));
  assert.equal(JSON.stringify({ input, catalog: frozenCatalog }), before);
  result.brief.topics.push('CAFE');
  assert.deepEqual(input.initial.topics, ['FOOD']);
});

test('one explicit review saves missing-region, missing-date drafts privately without RSVP, invitation or invented location', async () => {
  for (const purpose of ['GROUP', 'MEETUP', 'TRIP']) {
    const state = createEmptyState('me', '나');
    const result = prepareQuickCreation({ purpose, name: purpose === 'GROUP' ? '새로운 우리' : '우리 일정' }, catalog);
    const before = structuredClone(state);
    const restored = restoreCreationPreview(result, catalog);
    assert.equal(restored.ready, true);
    assert.equal(restored.checked, false);
    assert.equal(restored.dateUnconfirmed, false);
    assert.deepEqual(state, before);
    let calls = 0;
    const review = await completeCreationReview({ ...result, previewOnly: false, checked: true, dateUnconfirmed: true }, catalog, {
      onReview: (brief, plan, groupDraft) => {
        calls++;
        commitCreation(state, 'me', { requestId: `minimal-${purpose}`, brief, plan, groupDraft }, catalog);
        return true;
      },
    });
    assert.equal(review, 'SAVED');
    assert.equal(calls, 1);
    assert.equal(state.groups.length, 1);
    assert.equal(state.groups[0].region, '');
    assert.equal(state.groups[0].visibility, 'PRIVATE');
    assert.equal(state.groups[0].promotionPublished, false);
    assert.deepEqual(state.groups[0].memberIds, ['me']);
    assert.equal(state.invites.length, 0);
    assert.equal(state.applications.length, 0);
    assert.equal(state.activities.length, purpose === 'GROUP' ? 0 : 1);
    if (purpose !== 'GROUP') {
      const activity = state.activities[0];
      assert.equal(activity.date, '');
      assert.equal(activity.endDate, '');
      assert.equal(activity.meetingPoint, '');
      assert.deepEqual(activity.participants, {});
      assert.deepEqual(activity.arrivedIds, []);
      assert.equal(activity.journey.days.length, purpose === 'TRIP' ? 2 : 1);
      assert.ok(activity.journey.days.every(day => day.date === '' && day.places.length === 0));
    }
    assert.equal(isTogetherState(state), true);
  }
});

test('minimal flow still requires final intent and date-undecided review; guest review only hands off an unapproved draft', async () => {
  const result = prepareQuickCreation({}, catalog);
  let writes = 0;
  const onReview = () => { writes++; return true; };
  await assert.rejects(completeCreationReview({ ...result, previewOnly: false, checked: false, dateUnconfirmed: true }, catalog, { onReview }));
  await assert.rejects(completeCreationReview({ ...result, previewOnly: false, checked: true, dateUnconfirmed: false }, catalog, { onReview }));
  assert.equal(writes, 0);
  let handoff;
  assert.equal(await completeCreationReview({ ...result, previewOnly: true, checked: true, dateUnconfirmed: true }, catalog, { onReview, onLoginRequired: draft => { handoff = draft; } }), 'LOGIN_REQUIRED');
  assert.equal(writes, 0);
  assert.equal(restoreCreationPreview(handoff, catalog).checked, false);
});

test('a final save rechecks withdrawn or cross-region places instead of trusting the quick draft', async () => {
  const result = prepareQuickCreation({ prompt: '부산에서 식사' }, catalog);
  let writes = 0;
  const onReview = () => { writes++; return true; };
  const review = { ...result, previewOnly: false, checked: true, dateUnconfirmed: true };
  await assert.rejects(completeCreationReview(review, catalog.map(row => row.id === 'food' ? { ...row, publicationStatus: 'WITHDRAWN' } : row), { onReview }));
  await assert.rejects(completeCreationReview({ ...review, brief: { ...result.brief, region: '서울' } }, catalog, { onReview }));
  assert.equal(writes, 0);
  const timeOnly = prepareQuickCreation({ prompt: '부산 식사', initial: { startTime: '18:00' } }, catalog);
  assert.equal(timeOnly.brief.startTime, '18:00');
  assert.ok(timeOnly.issues.some(issue => issue.includes('날짜')));
});
