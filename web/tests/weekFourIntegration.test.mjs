import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { createLocalRepository, REPOSITORY_KEY } from '../src/localRepository.ts';
import { moveJourneyToTrash, restoreJourneyFromTrash, permanentlyDeleteJourney, activeJourneys, mergeActiveJourneyChanges } from '../src/tripTrash.ts';
import { normalizePlan, setPlanDates } from '../src/tripPlan.ts';
import { journalDraftValue, finishJournalDraft } from '../src/journalDraft.ts';

const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
  if (context.parentURL?.endsWith('/savedTripBuilder.ts') && ['./aiTravelDraft', './journeyCreation'].includes(specifier)) return nextResolve(`${specifier}.ts`, context);
  if (context.parentURL?.endsWith('/tripPlacement.ts') && ['./journeyCreation', './visits'].includes(specifier)) return nextResolve(`${specifier}.ts`, context);
  return nextResolve(specifier, context);
} });
const { buildSavedTrip, newSavedTripDraft } = await import('../src/savedTripBuilder.ts');
const { applyTripPlacement } = await import('../src/tripPlacement.ts');
hooks.deregister();

class Storage {
  data = new Map(); fail = false;
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { if (this.fail && key === REPOSITORY_KEY) throw new DOMException('Full', 'QuotaExceededError'); this.data.set(key, value); }
}
const key = 'spotlog.web.journeys.v4';
const owner = 'local-profile';
const now = new Date('2026-09-19T05:30:00.000Z');
const later = new Date('2026-10-01T05:30:00.000Z');
const place = (id = 'beach') => ({ id, kind: 'LANDMARK', name: '해변', area: '제주 한림', address: '제주시 한림읍', lat: 33.39, lng: 126.24, image: '/shared.jpg', photos: [{ image: '/shared.jpg', alt: '해변', caption: '사진', sourceId: 'source-1' }], description: '바다', duration: '1시간', note: '' });
const plan = () => normalizePlan(buildSavedTrip({ ...newSavedTripDraft(), mode: 'manual', dayCount: 3, startDate: '2026-12-31', assignments: [{ placeId: 'beach', day: 2 }] }, [place()]));

test('repository persists six-month trash and restores a public journal/editor draft privately after reload', () => {
  const storage = new Storage(), repository = createLocalRepository(storage);
  const journal = { ...plan(), purpose: 'JOURNAL', visibility: 'PUBLIC', status: 'PUBLISHED', story: '나의 기록' };
  journal.editorDraft = { updatedAt: now.toISOString(), selectedDay: 2, scrollTop: 310, value: { ...journal, title: '편집 중인 제목' } };
  const moved = moveJourneyToTrash([journal], journal.id, owner, now).map(normalizePlan);
  assert.equal(repository.setItem(key, JSON.stringify(moved)), true);
  const persisted = JSON.parse(createLocalRepository(storage).getItem(key));
  assert.deepEqual(persisted, JSON.parse(JSON.stringify(moved)));
  const restored = restoreJourneyFromTrash(persisted, journal.id, owner, moved[0].trash.deletedAt, later);
  assert.equal(repository.setItem(key, JSON.stringify(restored)), true);
  const resumed = finishJournalDraft(journalDraftValue(JSON.parse(createLocalRepository(storage).getItem(key))[0]));
  assert.equal(resumed.visibility, 'PRIVATE');
  assert.equal(resumed.status, 'PLANNING');
  assert.equal(resumed.title, '편집 중인 제목');
  assert.equal(resumed.id, journal.id);
  assert.deepEqual(resumed.days, JSON.parse(JSON.stringify(journal.days)));
  assert.equal(resumed.trash, undefined);
});

test('repository rejects malformed or non-six-month trash without overwriting the last good envelope', () => {
  const storage = new Storage(), repository = createLocalRepository(storage), trip = plan();
  assert.equal(repository.setItem(key, JSON.stringify([trip])), true);
  const moved = moveJourneyToTrash([trip], trip.id, owner, now)[0];
  const envelope = storage.getItem(REPOSITORY_KEY);
  const invalid = [
    { ...moved, visibility: 'PUBLIC' },
    { ...moved, isMine: false },
    { ...moved, trash: { ...moved.trash, ownerId: '  ' } },
    { ...moved, trash: { ...moved.trash, expiresAt: '2030-01-01T00:00:00.000Z' } },
    { ...moved, trash: { ...moved.trash, deletedAt: 'invalid' } },
  ];
  for (const record of invalid) {
    assert.equal(repository.setItem(key, JSON.stringify([record])), false);
    assert.equal(storage.getItem(REPOSITORY_KEY), envelope);
  }
});

test('storage failure leaves move, restore and permanent-delete operations unapplied and retryable', () => {
  for (const operation of ['move', 'restore', 'delete']) {
    const storage = new Storage(), repository = createLocalRepository(storage), trip = plan();
    const initial = operation === 'move' ? [trip] : moveJourneyToTrash([trip], trip.id, owner, now);
    assert.equal(repository.setItem(key, JSON.stringify(initial)), true);
    const next = operation === 'move' ? moveJourneyToTrash(initial, trip.id, owner, now)
      : operation === 'restore' ? restoreJourneyFromTrash(initial, trip.id, owner, undefined, later)
      : permanentlyDeleteJourney(initial, trip.id, owner);
    const envelope = storage.getItem(REPOSITORY_KEY);
    storage.fail = true;
    assert.equal(repository.setItem(key, JSON.stringify(next)), false);
    assert.equal(storage.getItem(REPOSITORY_KEY), envelope);
    assert.deepEqual(JSON.parse(createLocalRepository(storage).getItem(key)), JSON.parse(JSON.stringify(initial)));
    storage.fail = false;
    assert.equal(repository.setItem(key, JSON.stringify(next)), true);
    assert.deepEqual(JSON.parse(createLocalRepository(storage).getItem(key)), JSON.parse(JSON.stringify(next)));
  }
});

test('placing a saved location into an active trip retains deleted records and their recoverable content', () => {
  const first = plan(), second = { ...plan(), title: '휴지통 일정' };
  const all = moveJourneyToTrash([first, second], second.id, owner, now);
  const result = applyTripPlacement(activeJourneys(all), { journeyId: first.id, title: '', region: '', dayCount: 1, startDate: '', targetDay: 1, places: [place('tea')] }, '나');
  assert.equal(result.ok, true);
  const merged = mergeActiveJourneyChanges(all, result.journeys);
  assert.equal(merged.length, 2);
  assert.equal(merged.find(item => item.id === second.id), all[1]);
  assert.equal(restoreJourneyFromTrash(merged, second.id, owner, undefined, later).find(item => item.id === second.id).title, '휴지통 일정');
  assert.throws(() => mergeActiveJourneyChanges(all, [second]), error => error.code === 'STALE');
});

test('saved manual/automatic creation stays a personal plan with exact dates, empty DAYs and no journal prose', () => {
  for (const mode of ['manual', 'auto']) {
    const original = { ...newSavedTripDraft(), mode, dayCount: 3, startDate: '2026-12-31', assignments: [{ placeId: 'beach', day: 2 }], automaticIds: ['beach'] };
    const result = normalizePlan(buildSavedTrip(original, [place()]));
    assert.equal(result.purpose, 'PLAN');
    assert.equal(result.startDate, '2026-12-31');
    assert.equal(result.visibility, 'PRIVATE');
    assert.equal(result.recommendationKind, undefined);
    assert.deepEqual(result.days.map(day => day.date), ['2026-12-31', '2027-01-01', '2027-01-02']);
    assert.equal(result.days.filter(day => !day.places.length).length, 2);
    assert.equal(result.story, '');
    assert.ok(result.days.every(day => day.story === '' && day.blocks.every(block => block.type === 'PLACE')));
    if (mode === 'manual') assert.deepEqual(result.days.map(day => day.places.length), [0, 1, 0]);
    const changed = setPlanDates(result, '2027-01-30');
    assert.deepEqual(changed.days.map(day => day.date), ['2027-01-30', '2027-01-31', '2027-02-01']);
    assert.deepEqual(changed.days.map(day => day.dayId), result.days.map(day => day.dayId));
  }
});

test('saved places reused in a new personal plan do not carry old itinerary anchor, lodging or reservation IDs', () => {
  const source = { ...place(), visitId: 'previous-visit', anchorVisitId: 'previous-anchor', stayDayIds: ['previous-day'], bookingFixed: true };
  for (const mode of ['manual', 'auto']) {
    const result = buildSavedTrip({ ...newSavedTripDraft(), mode, assignments: [{ placeId: source.id, day: 1 }], automaticIds: [source.id] }, [source]);
    const next = result.days.flatMap(day => day.places)[0];
    assert.notEqual(next.visitId, source.visitId);
    assert.equal(next.anchorVisitId, undefined);
    assert.equal(next.stayDayIds, undefined);
    assert.equal(next.bookingFixed, undefined);
    assert.deepEqual(next.photos, source.photos);
    assert.equal(source.anchorVisitId, 'previous-anchor');
  }
});
