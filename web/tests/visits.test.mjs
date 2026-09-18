import assert from 'node:assert/strict';
import test from 'node:test';
import { addVisit, normalizeVisits, removeVisit } from '../src/visits.ts';

const makePlace = (id = 'seoul-forest') => ({
  id, kind: 'LANDMARK', name: '서울숲', area: '서울 성동', address: '서울 성동구 뚝섬로',
  lat: 37.5445, lng: 127.0374, image: '/seoul-forest.jpg', description: '산책하기 좋은 곳',
  note: '해 질 무렵 방문', duration: '1시간',
});
const makeDay = (day) => ({
  day, date: `DAY ${day}`, title: `${day}일차`, story: '이날의 이야기', places: [makePlace()],
  blocks: [
    { id: `text-${day}`, type: 'TEXT', body: '여행자의 원래 메모' },
    { id: `image-${day}`, type: 'IMAGE', image: '/my-photo.jpg', caption: '직접 찍은 사진' },
    { id: `place-${day}`, type: 'PLACE', placeId: 'seoul-forest' },
  ],
});
const makeJourney = (id = 'my-trip') => ({
  id, title: '서울 산책', region: '서울', dateRange: '날짜 미정', duration: '1박 2일', status: 'PLANNING',
  visibility: 'PRIVATE', cover: '/cover.jpg', summary: '내 여행', story: '여행 이야기', tags: [], saves: 0,
  author: '작성자', isMine: true, days: [makeDay(1), makeDay(2)],
});

test('normalization gives each trip and DAY a unique visit identity without changing source', () => {
  const original = makeJourney();
  const first = normalizeVisits(original);
  const second = normalizeVisits(makeJourney('another-trip'));
  const ids = [...first.days, ...second.days].flatMap((day) => day.places.map((place) => place.visitId));
  assert.equal(new Set(ids).size, 4);
  assert.ok(ids.every(Boolean));
  assert.equal(original.days[0].places[0].visitId, undefined);
  for (const day of first.days) assert.equal(day.blocks.find((block) => block.type === 'PLACE').visitId, day.places[0].visitId);
  assert.deepEqual(normalizeVisits(first), first);
});

test('normalization preserves photo/text blocks and links repeated legacy places separately', () => {
  const original = makeJourney();
  original.days[0].places.push(makePlace());
  original.days[0].blocks.push({ id: 'second-place', type: 'PLACE', placeId: 'seoul-forest' });
  const normalized = normalizeVisits(original);
  const day = normalized.days[0];
  const links = day.blocks.filter((block) => block.type === 'PLACE');
  assert.notEqual(links[0].visitId, links[1].visitId);
  assert.equal(links[0].visitId, day.places[0].visitId);
  assert.equal(links[1].visitId, day.places[1].visitId);
  assert.deepEqual(day.blocks.filter((block) => block.type !== 'PLACE'), original.days[0].blocks.filter((block) => block.type !== 'PLACE'));
});

test('adding to DAY 2 leaves DAY 1 and another trip unchanged', () => {
  const current = normalizeVisits(makeJourney());
  const other = normalizeVisits(makeJourney('other-trip'));
  const otherSnapshot = structuredClone(other);
  const updated = addVisit(current, 2, makePlace('new-landmark'));
  assert.equal(updated.days[0], current.days[0]);
  assert.equal(updated.days[1].places.at(-1).id, 'new-landmark');
  assert.equal(updated.days[1].places.at(-1).move, '이동시간 확인 필요');
  assert.equal(updated.days[1].places.at(-1).visitId, updated.days[1].blocks.at(-1).visitId);
  assert.deepEqual(other, otherSnapshot);
  assert.equal(current.days[1].places.length, 1);
});

test('duplicate add is a no-op until repeat visit is explicitly requested', () => {
  const current = normalizeVisits(makeJourney());
  assert.equal(addVisit(current, 2, makePlace()), current);
  const repeated = addVisit(current, 2, makePlace(), true);
  assert.equal(repeated.days[1].places.length, 2);
  assert.notEqual(repeated.days[1].places[0].visitId, repeated.days[1].places[1].visitId);
  assert.equal(repeated.days[1].blocks.filter((block) => block.type === 'PLACE').length, 2);
});

test('remove targets only selected visit and retains other occurrences, photos, text, and DAYs', () => {
  const original = normalizeVisits(makeJourney());
  const repeated = addVisit(original, 2, makePlace(), true);
  const target = repeated.days[1].places[1].visitId;
  const removed = removeVisit(repeated, 2, target);
  assert.equal(removed.days[0], repeated.days[0]);
  assert.deepEqual(removed.days[1].places, original.days[1].places);
  assert.deepEqual(removed.days[1].blocks, original.days[1].blocks);
  assert.equal(repeated.days[1].places.length, 2);
  assert.deepEqual(removeVisit(repeated, 1, target), repeated);
});

test('public source journeys and missing DAYs cannot be changed by add/remove', () => {
  const source = { ...normalizeVisits(makeJourney()), isMine: false };
  assert.equal(addVisit(source, 2, makePlace('another')), source);
  assert.equal(removeVisit(source, 2, source.days[1].places[0].visitId), source);
  const current = normalizeVisits(makeJourney());
  assert.equal(addVisit(current, 3, makePlace('another')), current);
  assert.equal(removeVisit(current, 2, ''), current);
});

test('a mixed migrated DAY cannot assign one visit ID to two occurrences', () => {
  const source = makeJourney();
  source.days[0].places[0].visitId = 'my-trip:day-1:visit-1';
  source.days[0].places.push(makePlace('another-landmark'));
  source.days[0].blocks.push({ id: 'second-place', type: 'PLACE', placeId: 'another-landmark' });
  const normalized = normalizeVisits(source);
  const ids = normalized.days[0].places.map((place) => place.visitId);
  assert.equal(new Set(ids).size, ids.length);
});
