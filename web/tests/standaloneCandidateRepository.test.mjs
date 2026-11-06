import test from 'node:test';
import assert from 'node:assert/strict';
import { appendPlanPlace, buildPersonalPlan, setPlanStay, transferVisit } from '../src/tripPlan.ts';
import { addTripCandidate, confirmTripCandidates, selectTripCandidate } from '../src/tripCandidates.ts';
import { createLocalRepository, MIGRATION_BACKUP_KEY, REPOSITORY_KEY } from '../src/localRepository.ts';

const journeyKey = 'spotlog.web.journeys.v4';
const place = (id, kind = 'FOOD') => ({ id, kind, name: id, area: '부산 수영', address: '합성 저장 검수 주소', lat: 35.15, lng: 129.11, image: '', description: '등록 소개', note: '', duration: '' });
const storage = (entries = {}) => {
  const records = new Map(Object.entries(entries));
  return { getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, value) };
};
function shortlist(kind = 'FOOD') {
  let trip = buildPersonalPlan([], 3, '식당과 카페 여행', '나');
  trip = appendPlanPlace(trip, trip.days[0].dayId, place('base', kind), kind === 'FOOD' ? 'lunch' : kind === 'CAFE' ? 'afternoon' : undefined);
  const context = { dayId: trip.days[0].dayId, anchorVisitId: trip.days[0].places[0].visitId, slot: 'afternoon' };
  for (const id of ['coffee-one', 'coffee-two']) trip = addTripCandidate(trip, place(id, 'CAFE'), context);
  return selectTripCandidate(trip, trip.businessCandidates[0].id, 'coffee-two');
}

test('standalone food/cafe/shop candidates survive the actual repository, reload and backup restoration', () => {
  for (const kind of ['LANDMARK', 'FOOD', 'CAFE', 'SHOP']) {
    const trip = shortlist(kind), source = storage(), repository = createLocalRepository(source);
    assert.equal(repository.setItem(journeyKey, JSON.stringify([trip])), true, `${kind} shortlist save`);
    const reloaded = createLocalRepository(source);
    const read = JSON.parse(reloaded.getItem(journeyKey))[0];
    assert.deepEqual(read.businessCandidates, JSON.parse(JSON.stringify(trip.businessCandidates)));
    assert.equal(read.days[0].places.length, 1);
    const restored = createLocalRepository(storage());
    assert.equal(restored.restoreBackup(reloaded.exportBackup()), true, `${kind} shortlist restore`);
    const confirmed = confirmTripCandidates(JSON.parse(restored.getItem(journeyKey))[0]);
    assert.deepEqual(confirmed.days[0].places.map(item => item.id), ['base', 'coffee-two']);
    assert.equal(confirmed.days[0].places[1].anchorVisitId, confirmed.days[0].places[0].visitId);
  }
});

test('candidate DAY moves and different overnight assignments remain valid without changing locked stays', () => {
  let trip = shortlist();
  const anchorId = trip.days[0].places[0].visitId;
  trip = transferVisit(trip, trip.days[0].dayId, anchorId, trip.days[1].dayId, false);
  trip = setPlanStay(trip, place('booked', 'STAY'), trip.days[0].dayId, 1, true);
  const locked = JSON.parse(JSON.stringify(trip.days[0].places[0]));
  trip = addTripCandidate(trip, place('hotel', 'STAY'), { dayId: trip.days[0].dayId, anchorVisitId: anchorId, nights: 2 });
  const repository = createLocalRepository(storage());
  assert.equal(repository.setItem(journeyKey, JSON.stringify([trip])), true);
  const read = JSON.parse(repository.getItem(journeyKey))[0];
  assert.equal(read.businessCandidates.find(group => group.kind === 'CAFE').dayId, read.days[1].dayId);
  assert.deepEqual(read.businessCandidates.filter(group => group.kind === 'STAY').map(group => group.dayId), read.days.slice(0, 2).map(day => day.dayId));
  assert.deepEqual(read.days[0].places[0], locked);
});

test('nested children, accommodation anchors and wrong non-stay DAY cannot overwrite or restore existing records', () => {
  const valid = shortlist(), source = storage(), repository = createLocalRepository(source);
  assert.equal(repository.setItem(journeyKey, JSON.stringify([valid])), true);
  const original = source.getItem(REPOSITORY_KEY);
  const invalid = [];
  for (const kind of ['FOOD', 'CAFE', 'SHOP']) {
    const nested = structuredClone(valid);
    Object.assign(nested.days[0].places[0], { kind, anchorVisitId: 'other-parent' });
    invalid.push(nested);
  }
  const accommodation = structuredClone(valid); accommodation.days[0].places[0].kind = 'STAY'; invalid.push(accommodation);
  const wrongDay = structuredClone(valid); wrongDay.businessCandidates[0].dayId = wrongDay.days[1].dayId; invalid.push(wrongDay);
  const stale = structuredClone(valid); stale.businessCandidates[0].anchorVisitId = 'missing-visit'; invalid.push(stale);
  invalid.push({ ...valid, visibility: 'PUBLIC' }, { ...valid, purpose: 'JOURNAL' }, { ...valid, isMine: false });
  for (const trip of invalid) {
    assert.equal(repository.setItem(journeyKey, JSON.stringify([trip])), false);
    assert.equal(source.getItem(REPOSITORY_KEY), original);
    const backup = JSON.parse(repository.exportBackup()); backup.records[journeyKey] = JSON.stringify([trip]);
    assert.equal(repository.restoreBackup(JSON.stringify(backup)), false);
    assert.equal(source.getItem(REPOSITORY_KEY), original);
  }
});

test('legacy valid standalone shortlist migrates with its raw source retained instead of blocking the repository', () => {
  const raw = JSON.stringify([shortlist('CAFE')]), source = storage({ [journeyKey]: raw });
  const repository = createLocalRepository(source);
  assert.equal(repository.getIssue(), null);
  assert.equal(repository.getItem(journeyKey), raw);
  assert.equal(source.getItem(journeyKey), raw);
  assert.equal(JSON.parse(source.getItem(MIGRATION_BACKUP_KEY)).records[journeyKey], raw);
  assert.equal(repository.setItem('spotlog.web.saved.v3', '["unrelated-saved-place"]'), true);
});
