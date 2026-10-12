import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPersonalPlan, copyPlanDay, insertNearby, makeJournalFromPlan, setPlanDates, setPlanStay } from '../src/tripPlan.ts';
import { setVisitProgress } from '../src/tripProgress.ts';
import { createLocalRepository } from '../src/localRepository.ts';

const place = (id, kind = 'LANDMARK') => ({ id, kind, name: id, area: '부산 해운대', address: '부산 검수 주소', lat: 35.16, lng: 129.16,
  image: `/${id}.jpg`, photos: [{ image: `/${id}.jpg`, alt: id, caption: `${id} 사진`, mediaId: `media-${id}`, placeId: id, sourceId: `source-${id}` }],
  description: '확인된 장소 소개', duration: '1시간', note: '' });
const base = () => setPlanDates(buildPersonalPlan([place('beach'), place('forest')], 2, '부산 가족여행', '나'), '2026-10-12');
const mark = (trip, dayIndex, visitIndex, status = 'done') => setVisitProgress(trip, trip.days[dayIndex].dayId, trip.days[dayIndex].places[visitIndex].visitId, status, new Date('2026-10-12T07:30:00.000Z'));
const visits = trip => trip.days.flatMap(day => day.places);
class Storage { data = new Map(); getItem(key) { return this.data.get(key) ?? null; } setItem(key, value) { this.data.set(key, value); } }

test('completed visits become the default private journal without shifting original DAY dates or changing the plan', () => {
  const trip = mark(base(), 1, 0), before = structuredClone(trip), journal = makeJournalFromPlan(trip, '새 작성자');
  assert.deepEqual(journal.days.map(day => day.places.map(place => place.id)), [[], ['forest']]);
  assert.deepEqual(journal.days.map(day => [day.day, day.date, day.title]), trip.days.map(day => [day.day, day.date, day.title]));
  assert.equal(journal.duration, '1박 2일'); assert.equal(journal.dateRange, trip.dateRange); assert.equal(journal.title, trip.title);
  assert.equal(journal.cover, '/forest.jpg'); assert.equal(journal.visibility, 'PRIVATE'); assert.equal(journal.status, 'PLANNING');
  assert.equal(journal.purpose, 'JOURNAL'); assert.equal(journal.author, '새 작성자'); assert.equal(journal.sourceTripId, trip.id);
  assert.notEqual(journal.id, trip.id); assert.deepEqual(trip, before);
});

test('the explicit planned-visit option keeps completed and pending visits, with skipped visits still excluded', () => {
  let trip = base(); trip = copyPlanDay(trip, trip.days[0].dayId);
  trip = mark(mark(trip, 0, 0), 2, 0, 'skipped');
  assert.deepEqual(visits(makeJournalFromPlan(trip, '나')).map(place => place.id), ['beach']);
  assert.deepEqual(visits(makeJournalFromPlan(trip, '나', { includePlanned: true })).map(place => place.id), ['beach', 'forest']);
});

test('without a completed visit the existing planned-route draft remains available, while skipped visits are omitted', () => {
  const trip = base(), journal = makeJournalFromPlan(trip, '나');
  assert.deepEqual(visits(journal).map(place => place.id), ['beach', 'forest']);
  const skipped = mark(trip, 0, 0, 'skipped');
  assert.deepEqual(visits(makeJournalFromPlan(skipped, '나')).map(place => place.id), ['forest']);
});

test('an empty or entirely skipped itinerary cannot silently create an empty journal', () => {
  const empty = buildPersonalPlan([], 2, '', '나');
  assert.throws(() => makeJournalFromPlan(empty, '나'), /담을 장소가 없어요/);
  const skipped = mark(mark(base(), 0, 0, 'skipped'), 1, 0, 'skipped');
  assert.throws(() => makeJournalFromPlan(skipped, '나'), /담을 장소가 없어요/);
  assert.throws(() => makeJournalFromPlan(skipped, '나', { includePlanned: true }), /담을 장소가 없어요/);
});

test('a completed business whose landmark was not visited has no dangling anchor or orphan place cards', () => {
  let trip = base(); const day = trip.days[0];
  trip = insertNearby(trip, day.dayId, day.places[0].visitId, place('lunch', 'FOOD'), 'lunch');
  trip = mark(trip, 0, 1);
  const journal = makeJournalFromPlan(trip, '나');
  assert.deepEqual(visits(journal).map(place => place.id), ['lunch']);
  assert.equal(journal.days[0].places[0].anchorVisitId, undefined);
  assert.equal(journal.days[0].blocks.length, 1); assert.equal(journal.days[1].blocks.length, 0);
  assert.equal(journal.days[0].blocks[0].visitId, journal.days[0].places[0].visitId);
  assert.equal(journal.days[0].blocks[0].placeId, 'lunch');
});

test('separate completed visits to the same business retain both occurrences and independently copied identities', () => {
  let trip = base(); const day = trip.days[0], anchor = day.places[0].visitId;
  trip = insertNearby(insertNearby(trip, day.dayId, anchor, place('restaurant', 'FOOD'), 'lunch'), day.dayId, anchor, place('restaurant', 'FOOD'), 'dinner');
  trip = mark(mark(mark(trip, 0, 0), 0, 1), 0, 2);
  const journal = makeJournalFromPlan(trip, '나'), selected = journal.days[0].places;
  assert.deepEqual(selected.map(place => place.id), ['beach', 'restaurant', 'restaurant']);
  assert.equal(new Set(selected.map(place => place.visitId)).size, 3);
  assert.equal(new Set(journal.days[0].blocks.map(block => block.id)).size, 3);
  assert.equal(selected[1].anchorVisitId, selected[0].visitId); assert.equal(selected[2].anchorVisitId, selected[0].visitId);
  for (const result of selected) assert(!visits(trip).some(original => original.visitId === result.visitId));
});

test('private text, reservation state and planned times never become journal content; photo attribution stays intact', () => {
  let trip = base(); trip = setPlanStay(trip, place('hotel', 'STAY'), trip.days[0].dayId, 1, true); trip = mark(trip, 0, 1);
  trip.story = '내 여행 개인 글'; trip.summary = '개인 일정 요약';
  trip.days[0].story = '개인 DAY 설명'; trip.days[0].places[1].note = '예약 번호 PRIVATE-123';
  trip.days[0].places[1].time = '22:30'; trip.days[0].places[1].move = '예상 이동'; trip.days[0].places[1].planningSlot = 'stay';
  trip.days[0].blocks[1] = { ...trip.days[0].blocks[1], body: 'PRIVATE card body', caption: '개인 캡션', image: '/private.png' };
  trip.days[0].blocks.push({ id: 'private-text', type: 'TEXT', body: '개인 일정 글' });
  trip.editorDraft = { updatedAt: '2026-10-12T07:00:00Z', value: structuredClone(trip) };
  const before = structuredClone(trip), journal = makeJournalFromPlan(trip, '나'), selected = journal.days[0].places[0];
  assert.equal(journal.story, ''); assert.equal(journal.summary, ''); assert.equal(journal.days[0].story, '');
  for (const field of ['time', 'move', 'bookingFixed', 'stayDayIds', 'planningSlot']) assert.equal(selected[field], undefined);
  for (const field of ['body', 'caption', 'image']) assert.equal(journal.days[0].blocks[0][field], undefined);
  assert.equal(selected.note, ''); assert.equal(journal.travelProgress, undefined); assert.equal(journal.editorDraft, undefined);
  assert.deepEqual(selected.photos, trip.days[0].places[1].photos);
  assert.equal(selected.photos[0].placeId, selected.id); assert.equal(selected.photos[0].sourceId, 'source-hotel');
  assert(!JSON.stringify(journal).includes('PRIVATE-123')); assert(!JSON.stringify(journal).includes('PRIVATE card body'));
  assert(!JSON.stringify(journal).includes('2026-10-12T07:30:00.000Z'));
  selected.photos[0].caption = '여행기 사진 수정'; assert.deepEqual(trip, before);
});

test('visited journal can be persisted independently and changing or deleting it does not modify its source trip', () => {
  const trip = mark(base(), 1, 0), journal = makeJournalFromPlan(trip, '나'), store = new Storage(), repository = createLocalRepository(store);
  assert.equal(repository.setItem('spotlog.web.journeys.v4', JSON.stringify([trip, journal])), true);
  const [storedTrip, storedJournal] = JSON.parse(createLocalRepository(store).getItem('spotlog.web.journeys.v4'));
  const persistedTrip = JSON.parse(JSON.stringify(trip));
  assert.deepEqual(storedTrip, persistedTrip); assert.equal(storedJournal.days[0].places.length, 0);
  storedJournal.days[1].places[0].name = '독립 수정'; assert.deepEqual(storedTrip, persistedTrip);
  assert.equal(repository.setItem('spotlog.web.journeys.v4', JSON.stringify([storedTrip])), true);
  assert.deepEqual(JSON.parse(createLocalRepository(store).getItem('spotlog.web.journeys.v4')), [persistedTrip]);
});

test('only completed personal plans can create journals and unfinished candidate review remains protected', () => {
  const trip = base();
  assert.throws(() => makeJournalFromPlan({ ...trip, isMine: false }, '나'), /내 여행/);
  assert.throws(() => makeJournalFromPlan({ ...trip, purpose: 'JOURNAL' }, '나'), /내 여행/);
  assert.throws(() => makeJournalFromPlan({ ...trip, planStage: 'DRAFT' }, '나'), /후보/);
});
