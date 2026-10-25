import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, next) {
    if (
      /\/lib\/[^/]+\.ts$/.test(context.parentURL ?? '') &&
      specifier.startsWith('./') &&
      !/\.[a-z]+$/.test(specifier)
    )
      return next(specifier + '.ts', context);
    return next(specifier, context);
  },
});

const { getTripMapData, placeMapCoordinates } =
  await import('../lib/trip-map-data.ts');
const { places } = await import('../lib/trip-data.ts');

const visit = (id, entityId, day = 1, kind = 'place') => ({
  id,
  entityId,
  day,
  kind,
  anchorId: 'hyeopjae',
  label: '오전 방문',
  locked: false,
});

test('every canonical destination has a checked primary location source in its actual region', () => {
  assert.ok(places.length >= 29);
  assert.ok(Object.keys(placeMapCoordinates).length >= places.length);
  for (const place of places) {
    const coordinate = placeMapCoordinates[place.id];
    assert.ok(coordinate, place.id);
    assert.ok(
      Number.isFinite(coordinate.latitude) &&
        Number.isFinite(coordinate.longitude),
      place.id,
    );
    const ranges = { 제주: [[33.1, 33.6], [126.1, 127]], 서울: [[37.4, 37.7], [126.8, 127.2]], 부산: [[35, 35.4], [128.9, 129.4]], 경주: [[35.7, 36], [129, 129.4]], 강릉: [[37.6, 38], [128.7, 129.2]] };
    const [latitudeRange, longitudeRange] = ranges[place.region];
    assert.ok(
      coordinate.latitude > latitudeRange[0] &&
        coordinate.latitude < latitudeRange[1],
      place.id,
    );
    assert.ok(
      coordinate.longitude > longitudeRange[0] &&
        coordinate.longitude < longitudeRange[1],
      place.id,
    );
    assert.ok(
      [
        'www.visitjeju.net',
        'english.visitkorea.or.kr',
        'map.sd.go.kr',
        'visitbusan.net',
        'www.visitbusan.net',
        'www.busan.go.kr',
        'gyeongju.go.kr',
      ].includes(new URL(coordinate.sourceUrl).hostname),
    );
    assert.match(coordinate.checkedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(coordinate.sourceTitle && coordinate.pointNote);
  }
  // Guard against the known identical/wrong point published by VisitJeju.
  assert.notEqual(
    placeMapCoordinates.dolculturepark.latitude,
    placeMapCoordinates.saryeoni.latitude,
  );
  assert.ok(placeMapCoordinates.dolculturepark.latitude > 33.44);
  assert.ok(placeMapCoordinates.manjanggul.latitude < 33.54);
});

test('pins follow actual visits and day selection without borrowing fictional business anchors', () => {
  const state = {
    activeDay: 1,
    plan: [
      visit('west', 'hyeopjae'),
      visit('sample-food', 'hj-rice', 1, 'food'),
      visit('sample-cafe', 'hj-cafe', 1, 'cafe'),
      visit('sample-stay', 'stay-coast', 1, 'stay'),
      visit('booked-unknown', null, 1, 'stay'),
      visit('east', 'seongsan', 2),
    ],
  };
  const snapshot = structuredClone(state);
  const dayOne = getTripMapData(state);
  assert.deepEqual(
    dayOne.points.map((point) => [
      point.visitId,
      point.placeId,
      point.day,
      point.order,
    ]),
    [['west', 'hyeopjae', 1, 1]],
  );
  assert.equal(dayOne.totalCount, 5);
  assert.equal(dayOne.unlocatedCount, 4);
  assert.equal(
    getTripMapData({ ...state, activeDay: 2 }).points[0].visitId,
    'east',
  );
  const all = getTripMapData(state, { allDays: true });
  assert.deepEqual(
    all.points.map((point) => point.visitId),
    ['west', 'east'],
  );
  assert.equal(all.totalCount, 6);
  assert.equal(all.unlocatedCount, 4);
  assert.deepEqual(state, snapshot);
});

test('repeat visits retain visit identity and pin order independently per day', () => {
  const state = {
    activeDay: 2,
    plan: [
      visit('first', 'osulloc'),
      visit('second', 'hyeopjae'),
      visit('return', 'osulloc', 2),
    ],
  };
  const result = getTripMapData(state, { allDays: true });
  assert.deepEqual(
    result.points.map(({ visitId, order }) => [visitId, order]),
    [
      ['first', 1],
      ['second', 2],
      ['return', 1],
    ],
  );
  assert.equal(result.points[0].latitude, result.points[2].latitude);
  const moved = getTripMapData(
    { ...state, plan: [state.plan[1], state.plan[0], state.plan[2]] },
    { allDays: true },
  );
  assert.deepEqual(
    moved.points.map(({ visitId, order }) => [visitId, order]),
    [
      ['second', 1],
      ['first', 2],
      ['return', 1],
    ],
  );
});

test('pin numbers match itinerary rows even when food and stays are not mapped', () => {
  const result = getTripMapData({
    activeDay: 1,
    plan: [visit('first', 'osulloc'), visit('lunch', 'hj-rice', 1, 'food'), visit('second', 'hyeopjae'), visit('stay', 'stay-coast', 1, 'stay')],
  });
  assert.deepEqual(result.points.map(({ visitId, order }) => [visitId, order]), [['first', 1], ['second', 3]]);
  assert.equal(result.unlocatedCount, 2);
});

test('next day departs from the previous stay without inventing its location or mutating it', () => {
  const state = { activeDay: 2, plan: [visit('night', 'stay-coast', 1, 'stay'), visit('morning', 'osulloc', 2), visit('lunch', 'hj-rice', 2, 'food'), visit('afternoon', 'hyeopjae', 2)] };
  const snapshot = structuredClone(state);
  const result = getTripMapData(state);
  assert.deepEqual(result.points.map(point => [point.visitId, point.order]), [['morning', 2], ['afternoon', 4]]);
  assert.equal(result.totalCount, 4);
  assert.equal(result.unlocatedCount, 2);
  assert.deepEqual(state, snapshot);
});

test('whole-trip pins retain DAY detail numbers and count overnight departures only once', () => {
  const state = { activeDay: 1, plan: [visit('day2-am', 'osulloc', 2), visit('day2-lunch', 'hj-rice', 2, 'food'), visit('day2-pm', 'songaksan', 2), visit('day1-am', 'hyeopjae', 1), visit('day1-stay', 'stay-coast', 1, 'stay')] };
  const snapshot = structuredClone(state);
  const all = getTripMapData(state, { allDays: true });
  assert.deepEqual(all.points.map(point => [point.visitId, point.day, point.order]), [['day1-am', 1, 1], ['day2-am', 2, 2], ['day2-pm', 2, 4]]);
  assert.equal(all.totalCount, state.plan.length);
  assert.equal(all.unlocatedCount, 2);
  for (const day of [1, 2]) assert.deepEqual(all.points.filter(point => point.day === day).map(point => [point.visitId, point.order]), getTripMapData({ ...state, activeDay: day }).points.map(point => [point.visitId, point.order]));
  assert.deepEqual(state, snapshot);
});

test('unknown entities and invalid visit days never become fabricated pins', () => {
  const state = {
    activeDay: 1,
    plan: [
      visit('unknown', 'unknown-place'),
      visit('prototype', 'toString'),
      visit('none', null),
      visit('invalid-day', 'osulloc', -1),
      // Even a real landmark ID cannot turn a fictional business into a place.
      visit('misclassified', 'hyeopjae', 1, 'stay'),
    ],
  };
  const result = getTripMapData(state, { allDays: true });
  assert.deepEqual(result.points, []);
  assert.equal(result.unlocatedCount, state.plan.length);
  assert.equal(result.bounds, null);
});

test('map bounds include only selected mapped visits and handle empty or single-stop plans', () => {
  assert.deepEqual(getTripMapData({ plan: [], activeDay: 1 }), {
    points: [],
    totalCount: 0,
    unlocatedCount: 0,
    bounds: null,
  });
  const first = visit('jeju', 'hyeopjae');
  const second = visit('seoul', 'seoulforest', 2);
  const one = getTripMapData({ plan: [first, second], activeDay: 1 });
  assert.deepEqual(one.bounds, [
    [one.points[0].latitude, one.points[0].longitude],
    [one.points[0].latitude, one.points[0].longitude],
  ]);
  const all = getTripMapData(
    { plan: [first, second], activeDay: 1 },
    { allDays: true },
  );
  assert.ok(all.bounds[0][0] < all.bounds[1][0]);
  for (const point of all.points) {
    assert.ok(
      point.latitude >= all.bounds[0][0] && point.latitude <= all.bounds[1][0],
    );
    assert.ok(
      point.longitude >= all.bounds[0][1] &&
        point.longitude <= all.bounds[1][1],
    );
  }
});
