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

const { createCommunityTripPreview } =
  await import('../lib/community-trip-preview.ts');
const { findCommunityTrip } = await import('../lib/community-trips.ts');
const { getTripMapData } = await import('../lib/trip-map-data.ts');
const { makeTripMapOrderRoutes } = await import('../lib/trip-map-route.ts');

test('preview keeps stable source visit IDs even when a place occurs repeatedly', () => {
  const original = findCommunityTrip('community-jeju-west-sea');
  const trip = Object.freeze({
    ...original,
    visits: Object.freeze([
      ...original.visits.map((visit) => Object.freeze({ ...visit })),
      Object.freeze({ ...original.visits[0], day: 2 }),
    ]),
  });
  const before = JSON.stringify(trip);
  const preview = createCommunityTripPreview(trip);
  const again = createCommunityTripPreview(trip);

  assert.equal(preview.plan.length, trip.visits.length);
  assert.equal(
    new Set(preview.plan.map((visit) => visit.id)).size,
    trip.visits.length,
  );
  assert.deepEqual(
    preview.plan.map((visit) => visit.id),
    again.plan.map((visit) => visit.id),
  );
  assert.ok(
    preview.plan.every((visit) => /^[A-Za-z0-9_-]{1,160}$/.test(visit.id)),
  );
  assert.equal(preview.communitySourceId, trip.id);
  assert.deepEqual(preview.savedIds, []);
  assert.deepEqual(preview.collectedIds, []);
  assert.equal(preview.savedPlanId, null);
  preview.plan[0].label = 'local preview only';
  assert.notEqual(preview.plan[0].label, again.plan[0].label);
  assert.equal(JSON.stringify(trip), before);
});

test('whole public course connects both days and maps pins back to the exact source rows', () => {
  const trip = findCommunityTrip('community-jeju-west-sea');
  const preview = createCommunityTripPreview(trip);
  const data = getTripMapData(preview, { allDays: true });
  assert.equal(data.totalCount, 9);
  assert.equal(data.unlocatedCount, 5);
  assert.deepEqual(
    data.points.map(({ day, order, placeId }) => [day, order, placeId]),
    [
      [1, 1, 'hyeopjae'],
      [1, 3, 'geumneung'],
      [2, 2, 'osulloc'],
      [2, 4, 'songaksan'],
    ],
  );
  for (const point of data.points) {
    const row = preview.plan.find((visit) => visit.id === point.visitId);
    assert.ok(row);
    assert.equal(row.day, point.day);
    assert.equal(row.entityId, point.placeId);
    assert.equal(row.kind, 'place');
  }
  const route = makeTripMapOrderRoutes(data.points, { scope: 'trip' });
  assert.equal(route.length, 1);
  assert.equal(route[0].legs.length, 3);
  assert.equal(route[0].legs[1].from.day, 1);
  assert.equal(route[0].legs[1].to.day, 2);
  assert.ok(route[0].legs.every((leg) => leg.minutes === null));
});

test('DAY filters retain the same source IDs and never turn fictional businesses into pins', () => {
  const preview = createCommunityTripPreview(
    findCommunityTrip('community-jeju-west-sea'),
  );
  const whole = getTripMapData(preview, { allDays: true });
  const secondDay = getTripMapData({ ...preview, activeDay: 2 });
  assert.deepEqual(
    secondDay.points.map(({ visitId }) => visitId),
    whole.points.filter(({ day }) => day === 2).map(({ visitId }) => visitId),
  );
  assert.ok(
    whole.points.every((point) =>
      preview.plan.some(
        (visit) => visit.id === point.visitId && visit.kind === 'place',
      ),
    ),
  );
  assert.equal(preview.activeDay, 1);
  assert.equal(preview.plan.length, 9);
});
