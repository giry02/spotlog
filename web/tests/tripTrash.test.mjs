import test from 'node:test';
import assert from 'node:assert/strict';
import { activeJourneys, isJourneyInTrash, isJourneyTrash, isTrashExpired, listTrashedJourneys, moveJourneyToTrash, permanentlyDeleteJourney, restoreJourneyFromTrash, trashExpiry, TripTrashError } from '../src/tripTrash.ts';

const owner = 'local-profile';
const deletedAt = new Date('2026-09-19T09:30:00.000Z');
const beforeExpiry = new Date('2027-03-19T09:29:59.999Z');
const sample = (id = 'trip', purpose = 'PLAN') => ({
  id, purpose, isMine: true, title: '제주 여행', region: '제주', dateRange: '미정', duration: '1박 2일',
  status: 'PLANNING', visibility: 'PRIVATE', cover: '/shared-photo.jpg', summary: '여행 설명', story: '작성한 글', tags: ['바다'], saves: 3, author: '나',
  days: [{ dayId: 'stable-day', day: 1, date: '', title: '첫날', story: '기록', places: [{ id: 'place', visitId: 'visit', anchorVisitId: 'landmark', image: '/shared-photo.jpg', photos: [{ id: 'photo', image: '/photo.jpg', caption: '기억', sourceId: 'source' }], bookingFixed: true, note: '메모' }], blocks: [{ id: 'stable-card', type: 'PLACE', placeId: 'place', visitId: 'visit' }] }],
});
const expectCode = (fn, code) => assert.throws(fn, error => error instanceof TripTrashError && error.code === code);

test('retention is six calendar months, with KST month-end clamping rather than 180 days', () => {
  assert.equal(trashExpiry('2026-08-31T14:05:12.987Z'), '2027-02-28T14:05:12.987Z');
  assert.equal(trashExpiry('2027-08-31T14:05:12.987Z'), '2028-02-29T14:05:12.987Z');
  assert.equal(trashExpiry('2028-02-29T01:00:00.000Z'), '2028-08-29T01:00:00.000Z');
  assert.equal(trashExpiry('2026-09-30T15:00:00.000Z'), '2027-03-31T15:00:00.000Z');
  assert.equal(trashExpiry('2026-09-19T18:30:00+09:00'), '2027-03-19T09:30:00.000Z');
  expectCode(() => trashExpiry('not-a-date'), 'INVALID');
});

test('trash retains the complete original record and stable references without mutating the input', () => {
  const trip = sample(), untouched = sample('other');
  const before = structuredClone(trip);
  const moved = moveJourneyToTrash([trip, untouched], trip.id, owner, deletedAt);
  assert.deepEqual(trip, before);
  assert.equal(moved[1], untouched);
  assert.equal(moved[0].days, trip.days);
  assert.equal(moved[0].cover, trip.cover);
  assert.equal(moved[0].trash.deletedAt, deletedAt.toISOString());
  assert.equal(moved[0].trash.expiresAt, '2027-03-19T09:30:00.000Z');
  assert.equal(moved[0].trash.ownerId, owner);
  assert.equal(isJourneyTrash(moved[0].trash), true);
});

test('an itinerary and a journal copied from it are independently deleted and restored', () => {
  const trip = sample(), journal = { ...sample('journal', 'JOURNAL'), sourceTripId: trip.id };
  const moved = moveJourneyToTrash([trip, journal], trip.id, owner, deletedAt);
  assert.deepEqual(activeJourneys(moved), [journal]);
  const restored = restoreJourneyFromTrash(moved, trip.id, owner, deletedAt.toISOString(), beforeExpiry);
  assert.deepEqual(restored[0], trip);
  assert.equal(restored[1], journal);
  assert.equal(restored.length, 2);
});

test('published journal and its resumed editor draft restore privately with original IDs', () => {
  const journal = { ...sample('journal', 'JOURNAL'), status: 'PUBLISHED', visibility: 'PUBLIC' };
  journal.editorDraft = { updatedAt: deletedAt.toISOString(), value: { ...journal, story: '아직 저장하지 않은 편집' } };
  const moved = moveJourneyToTrash([journal], journal.id, owner, deletedAt);
  assert.equal(moved[0].visibility, 'PRIVATE');
  assert.equal(moved[0].status, 'PLANNING');
  assert.equal(moved[0].trash.previousVisibility, 'PUBLIC');
  assert.equal(journal.editorDraft.value.visibility, 'PUBLIC');
  const restored = restoreJourneyFromTrash(moved, journal.id, owner, deletedAt.toISOString(), beforeExpiry)[0];
  assert.equal(restored.id, journal.id);
  assert.equal(restored.visibility, 'PRIVATE');
  assert.equal(restored.status, 'PLANNING');
  assert.equal(restored.trash, undefined);
  assert.equal(restored.editorDraft.value.visibility, 'PRIVATE');
  assert.equal(restored.editorDraft.value.status, 'PLANNING');
  assert.equal(restored.editorDraft.value.story, '아직 저장하지 않은 편집');
});

test('traveling status survives restoration while visibility is always private', () => {
  const trip = { ...sample(), status: 'TRAVELING', visibility: 'PUBLIC' };
  const restored = restoreJourneyFromTrash(moveJourneyToTrash([trip], trip.id, owner, deletedAt), trip.id, owner, undefined, beforeExpiry)[0];
  assert.equal(restored.status, 'TRAVELING');
  assert.equal(restored.visibility, 'PRIVATE');
});

test('expiry is exclusive, including a restore click at the exact expiry instant', () => {
  const moved = moveJourneyToTrash([sample()], 'trip', owner, deletedAt);
  assert.equal(isTrashExpired(moved[0], beforeExpiry), false);
  const expiry = new Date(moved[0].trash.expiresAt);
  assert.equal(isTrashExpired(moved[0], expiry), true);
  expectCode(() => restoreJourneyFromTrash(moved, 'trip', owner, undefined, expiry), 'EXPIRED');
  assert.equal(listTrashedJourneys(moved, owner, expiry).length, 0);
  assert.equal(activeJourneys(moved).length, 0);
  assert.equal(moved.length, 1, 'expiry does not physically purge media or records on startup');
});

test('trash list is owner-scoped and most recently deleted first', () => {
  const earlier = moveJourneyToTrash([sample('earlier')], 'earlier', owner, deletedAt)[0];
  const later = moveJourneyToTrash([sample('later')], 'later', owner, new Date('2026-09-20T00:00:00Z'))[0];
  const foreign = moveJourneyToTrash([sample('foreign')], 'foreign', 'another-profile', deletedAt)[0];
  const records = [earlier, later, foreign, sample('active')];
  assert.deepEqual(listTrashedJourneys(records, owner, new Date('2026-10-01T00:00:00Z')).map(item => item.id), ['later', 'earlier']);
  assert.deepEqual(records.map(item => item.id), ['earlier', 'later', 'foreign', 'active']);
  expectCode(() => restoreJourneyFromTrash(records, 'foreign', owner, undefined, beforeExpiry), 'NOT_OWNER');
  expectCode(() => permanentlyDeleteJourney(records, 'foreign', owner), 'NOT_OWNER');
});

test('non-owned records cannot be deleted, restored or permanently removed', () => {
  const trip = { ...sample(), isMine: false };
  expectCode(() => moveJourneyToTrash([trip], trip.id, owner, deletedAt), 'NOT_OWNER');
  expectCode(() => moveJourneyToTrash([sample()], 'trip', '', deletedAt), 'NOT_OWNER');
  const deleted = moveJourneyToTrash([sample()], 'trip', owner, deletedAt)[0];
  const noLongerOwned = { ...deleted, isMine: false };
  expectCode(() => restoreJourneyFromTrash([noLongerOwned], 'trip', owner, undefined, beforeExpiry), 'NOT_OWNER');
  expectCode(() => permanentlyDeleteJourney([noLongerOwned], 'trip', owner), 'NOT_OWNER');
});

test('duplicate and stale requests cannot create duplicates or restore a newly deleted snapshot', () => {
  const first = moveJourneyToTrash([sample()], 'trip', owner, deletedAt);
  expectCode(() => moveJourneyToTrash(first, 'trip', owner, deletedAt), 'ALREADY_DELETED');
  const restored = restoreJourneyFromTrash(first, 'trip', owner, undefined, beforeExpiry);
  expectCode(() => restoreJourneyFromTrash(restored, 'trip', owner, undefined, beforeExpiry), 'NOT_DELETED');
  const second = moveJourneyToTrash(restored, 'trip', owner, new Date('2027-03-19T09:30:00Z'));
  expectCode(() => restoreJourneyFromTrash(second, 'trip', owner, first[0].trash.deletedAt, beforeExpiry), 'STALE');
  expectCode(() => permanentlyDeleteJourney(second, 'trip', owner, first[0].trash.deletedAt), 'STALE');
});

test('permanent deletion only removes the selected tombstone and preserves shared image references', () => {
  const original = sample(), other = sample('other');
  const moved = moveJourneyToTrash([original, other], 'trip', owner, deletedAt);
  const next = permanentlyDeleteJourney(moved, 'trip', owner, deletedAt.toISOString());
  assert.equal(next.length, 1);
  assert.equal(next[0], other);
  assert.equal(next[0].cover, original.cover);
  assert.equal(moved.length, 2);
  expectCode(() => permanentlyDeleteJourney(next, 'trip', owner), 'NOT_FOUND');
  expectCode(() => permanentlyDeleteJourney(next, 'other', owner), 'NOT_DELETED');
});

test('invalid tombstones never reappear in normal listings or become restorable', () => {
  const bad = { ...sample(), trash: { deletedAt: 'bad', expiresAt: 'bad', ownerId: owner } };
  assert.equal(isJourneyInTrash(bad), true);
  assert.equal(activeJourneys([bad]).length, 0);
  assert.equal(listTrashedJourneys([bad], owner, beforeExpiry).length, 0);
  expectCode(() => restoreJourneyFromTrash([bad], 'trip', owner, undefined, beforeExpiry), 'INVALID');
  expectCode(() => permanentlyDeleteJourney([bad], 'trip', owner), 'INVALID');
  const moved = moveJourneyToTrash([sample()], 'trip', owner, deletedAt)[0];
  assert.equal(isJourneyTrash({ ...moved.trash, expiresAt: '2099-12-31T00:00:00Z' }), false);
});
