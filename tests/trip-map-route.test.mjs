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
const {
  createTripMapRouteClient,
  makeTripMapOrderRoutes,
  fetchTripMapRoutes,
  TRIP_MAP_ROUTE_CACHE_TTL_MS,
  TRIP_MAP_ROUTE_CACHE_LIMIT,
  TRIP_MAP_ROUTE_MAX_RESPONSE_BYTES,
  TRIP_MAP_ROUTE_MAX_POINTS,
} = await import('../lib/trip-map-route.ts');
const { placeMapCoordinates } = await import('../lib/trip-map-data.ts');

function point(placeId, day = 1, order = 1, visitId = `visit-${day}-${order}`) {
  return {
    ...placeMapCoordinates[placeId],
    placeId,
    day,
    order,
    visitId,
    name: placeId,
    label: '방문',
  };
}
const pair = () => [point('hyeopjae'), point('osulloc', 1, 3)];
function requested(url) {
  return new URL(url).pathname
    .split('/driving/')[1]
    .split(';')
    .map((item) => item.split(',').map(Number));
}
function roadPayload(coords) {
  const legs = coords.slice(1).map((to, index) => {
    const from = coords[index], radians = Math.PI / 180;
    const arc = Math.sin((to[1] - from[1]) * radians / 2) ** 2 + Math.cos(from[1] * radians) *
      Math.cos(to[1] * radians) * Math.sin((to[0] - from[0]) * radians / 2) ** 2;
    const straightMeters = 6_371_000 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
    return { distance: Math.max(12_345.6 + index * 100, straightMeters + 10), duration: 65 + index * 10 };
  });
  return {
    code: 'Ok',
    waypoints: coords.map((location) => ({ location, distance: 0 })),
    routes: [
      {
        distance: legs.reduce((n, value) => n + value.distance, 0),
        duration: legs.reduce((n, value) => n + value.duration, 0),
        legs,
        geometry: { type: 'LineString', coordinates: coords },
      },
    ],
  };
}
const success = async (url) => Response.json(roadPayload(requested(url)));

test('ORDER separates DAYs, preserves each input order and never invents travel minutes', () => {
  const input = [
    point('saebyeol', 2, 1),
    point('osulloc', 1, 3),
    point('hyeopjae', 1, 1),
    point('seoulforest', 2, 4),
  ];
  const before = JSON.stringify(input);
  const routes = makeTripMapOrderRoutes(input);
  assert.deepEqual(
    routes.map((route) => route.day),
    [1, 2],
  );
  assert.deepEqual(
    routes[0].points.map((p) => p.placeId),
    ['osulloc', 'hyeopjae'],
  );
  assert.deepEqual(
    routes[1].points.map((p) => p.placeId),
    ['saebyeol', 'seoulforest'],
  );
  for (const route of routes) {
    assert.equal(route.source, 'ORDER');
    assert.equal(route.distanceKind, 'STRAIGHT');
    assert.equal(route.minutes, null);
    assert.ok(
      route.legs.every(
        (leg) => leg.minutes === null && leg.from.day === leg.to.day,
      ),
    );
    assert.ok(route.distanceKm > 0);
    assert.deepEqual(route.coordinates[0], [
      route.points[0].longitude,
      route.points[0].latitude,
    ]);
  }
  assert.equal(JSON.stringify(input), before);
});

test('ROAD calls official driving service with exact input order and verified seconds only', async () => {
  const input = pair().reverse();
  let calls = 0;
  const client = createTripMapRouteClient({
    fetcher: async (url, init) => {
      calls++;
      assert.equal(new URL(url).origin, 'https://router.project-osrm.org');
      assert.equal(new URL(url).searchParams.get('geometries'), 'geojson');
      assert.equal(new URL(url).searchParams.get('overview'), 'full');
      assert.equal(new URL(url).searchParams.get('alternatives'), 'false');
      assert.equal(new URL(url).searchParams.get('steps'), 'false');
      assert.deepEqual(
        requested(url),
        input.map((p) => [p.longitude, p.latitude]),
      );
      assert.equal(init.redirect, 'error');
      assert.ok(init.signal instanceof AbortSignal);
      return success(url);
    },
  });
  const [route] = await client.fetchRoutes(input);
  assert.equal(calls, 1);
  assert.equal(route.source, 'ROAD');
  assert.equal(route.distanceKind, 'ROAD');
  assert.equal(route.mode, 'DRIVE');
  assert.equal(route.distanceKm, 12.345600000000001);
  assert.equal(route.minutes, 2);
  assert.equal(route.legs[0].minutes, 2);
  assert.equal(route.legs[0].from.visitId, input[0].visitId);
  assert.equal(route.legs[0].to.visitId, input[1].visitId);
});

test('all-day requests never create a road leg between different DAYs', async () => {
  const inputs = [
    point('hyeopjae', 1, 1),
    point('osulloc', 1, 3),
    point('saebyeol', 2, 1),
    point('seoulforest', 2, 3),
  ];
  const sent = [];
  const routes = await createTripMapRouteClient({
    fetcher: async (url) => {
      sent.push(requested(url));
      return success(url);
    },
  }).fetchRoutes(inputs);
  assert.equal(sent.length, 2);
  assert.ok(sent.every((coords) => coords.length === 2));
  assert.equal(routes.length, 2);
  assert.ok(
    routes.every(
      (route) =>
        route.legs.length === 1 &&
        route.legs[0].from.day === route.legs[0].to.day,
    ),
  );
});

test('trip ORDER joins ascending DAYs while preserving each DAY input order and marker metadata', () => {
  const inputs = [
    point('saebyeol', 2, 8),
    point('osulloc', 1, 3),
    point('hyeopjae', 1, 1),
    point('seoulforest', 2, 2),
  ];
  const before = JSON.stringify(inputs);
  const [route] = makeTripMapOrderRoutes(inputs, { scope: 'trip' });
  assert.equal(route.day, 0);
  assert.equal(route.source, 'ORDER');
  assert.equal(route.minutes, null);
  assert.deepEqual(
    route.points.map(({ placeId, day, order, visitId }) => ({
      placeId,
      day,
      order,
      visitId,
    })),
    [inputs[1], inputs[2], inputs[0], inputs[3]].map(
      ({ placeId, day, order, visitId }) => ({ placeId, day, order, visitId }),
    ),
  );
  assert.equal(route.legs.length, 3);
  assert.equal(route.legs[1].from.day, 1);
  assert.equal(route.legs[1].to.day, 2);
  assert.ok(route.legs.every((leg) => leg.minutes === null));
  assert.equal(JSON.stringify(inputs), before);
  assert.deepEqual(makeTripMapOrderRoutes([], { scope: 'trip' }), []);
});

test('trip ROAD connects single-pin DAYs in one request and preserves actual DAY numbers', async () => {
  const inputs = [point('osulloc', 3, 5), point('hyeopjae', 1, 2)];
  const sent = [];
  const client = createTripMapRouteClient({
    fetcher: async (url) => {
      sent.push(requested(url));
      return success(url);
    },
  });
  const dayRoutes = await client.fetchRoutes(inputs, { scope: 'day' });
  assert.equal(sent.length, 0);
  assert.deepEqual(
    dayRoutes.map((route) => route.day),
    [1, 3],
  );
  assert.ok(dayRoutes.every((route) => route.reason === 'insufficient-points'));
  const routes = await client.fetchRoutes(inputs, { scope: 'trip' });
  assert.equal(routes.length, 1);
  const [route] = routes;
  assert.equal(route.day, 0);
  assert.equal(route.source, 'ROAD');
  assert.equal(sent.length, 1);
  assert.deepEqual(
    sent[0],
    [inputs[1], inputs[0]].map((p) => [p.longitude, p.latitude]),
  );
  assert.equal(route.legs.length, 1);
  assert.equal(route.legs[0].from.visitId, inputs[1].visitId);
  assert.equal(route.legs[0].from.day, 1);
  assert.equal(route.legs[0].from.order, 2);
  assert.equal(route.legs[0].to.day, 3);
  assert.equal(route.legs[0].to.order, 5);
  assert.equal(route.minutes, 2);
});

test('trip scope omits fictional lodging and never creates its coordinates or travel minutes', async () => {
  let calls = 0;
  const client = createTripMapRouteClient({
    fetcher: async (url) => {
      calls++;
      return success(url);
    },
  });
  const [route] = await client.fetchRoutes(
    [
      point('osulloc', 2, 2),
      point('hyeopjae', 1, 1),
      { ...point('saebyeol', 1, 3), placeId: 'stay-west', name: '가상 숙소' },
    ],
    { scope: 'trip' },
  );
  assert.equal(calls, 0);
  assert.equal(route.day, 0);
  assert.equal(route.source, 'ORDER');
  assert.equal(route.reason, 'invalid-input');
  assert.equal(route.omittedPointCount, 1);
  assert.deepEqual(
    route.points.map((p) => p.placeId),
    ['hyeopjae', 'osulloc'],
  );
  assert.equal(route.coordinates.length, 2);
  assert.equal(route.legs.length, 1);
  assert.equal(route.minutes, null);
  assert.equal(route.legs[0].minutes, null);
});

test('day and trip scopes share coordinate cache while snapshotting current DAY, order and labels', async () => {
  let calls = 0;
  const fetcher = async (url) => {
    calls++;
    return success(url);
  };
  const oldPoints = [point('hyeopjae', 7, 4), point('osulloc', 7, 9)];
  const [oldRoute] = await fetchTripMapRoutes(oldPoints, { fetcher });
  const tripPoints = [
    { ...point('osulloc', 5, 8), name: '현재 둘째 장소', label: '새 일정' },
    { ...point('hyeopjae', 2, 3), name: '현재 첫 장소', label: '새 일정' },
  ];
  const pending = fetchTripMapRoutes(tripPoints, { fetcher, scope: 'trip' });
  tripPoints[1].name = '요청 후 변경한 이름';
  tripPoints[1].day = 99;
  const [tripRoute] = await pending;
  assert.equal(calls, 1);
  assert.equal(oldRoute.day, 7);
  assert.equal(oldRoute.points[0].day, 7);
  assert.equal(tripRoute.day, 0);
  assert.equal(tripRoute.source, 'ROAD');
  assert.deepEqual(
    tripRoute.points.map((p) => p.day),
    [2, 5],
  );
  assert.deepEqual(
    tripRoute.points.map((p) => p.order),
    [3, 8],
  );
  assert.deepEqual(
    tripRoute.points.map((p) => p.visitId),
    ['visit-2-3', 'visit-5-8'],
  );
  assert.equal(tripRoute.legs[0].from.name, '현재 첫 장소');
  assert.equal(tripRoute.legs[0].to.label, '새 일정');
  assert.ok(Object.isFrozen(tripRoute.points[0]));
  const [dayAgain] = await fetchTripMapRoutes(
    [point('hyeopjae', 4, 1), point('osulloc', 4, 6)],
    { fetcher, scope: 'day' },
  );
  assert.equal(calls, 1);
  assert.equal(dayAgain.day, 4);
  assert.equal(dayAgain.legs[0].from.order, 1);
});

test('missing, invalid and fictional business coordinates never reach OSRM or create fake pins', async () => {
  let calls = 0;
  const client = createTripMapRouteClient({
    fetcher: async (url) => {
      calls++;
      return success(url);
    },
  });
  for (const invalid of [
    { ...point('osulloc', 1, 2), latitude: undefined },
    { ...point('osulloc', 1, 2), latitude: null },
    { ...point('osulloc', 1, 2), longitude: Number.NaN },
    { ...point('osulloc', 1, 2), latitude: Number.POSITIVE_INFINITY },
    { ...point('osulloc', 1, 2), latitude: 91 },
    { ...point('osulloc', 1, 2), longitude: -181 },
    { ...point('osulloc', 1, 2), placeId: 'hj-rice', name: '가상 식당' },
    { ...point('osulloc', 1, 2), day: 0 },
    { ...point('osulloc', 1, 2), day: 1.5 },
  ]) {
    const routes = await client.fetchRoutes([
      point('hyeopjae'),
      invalid,
      point('saebyeol', 1, 3),
    ]);
    assert.equal(routes[0].source, 'ORDER');
    assert.equal(routes[0].minutes, null);
    assert.ok(
      routes[0].points.every(
        (p) =>
          p.name !== '가상 식당' &&
          Number.isFinite(p.latitude) &&
          Number.isFinite(p.longitude),
      ),
    );
  }
  assert.equal(calls, 0);
});

test('zero or one mapped point does not request a road or imply a travel time', async () => {
  const client = createTripMapRouteClient({
    fetcher: async () => {
      throw new Error('must not fetch');
    },
  });
  assert.deepEqual(await client.fetchRoutes([]), []);
  const [single] = await client.fetchRoutes([point('hyeopjae')]);
  assert.equal(single.source, 'ORDER');
  assert.equal(single.reason, 'insufficient-points');
  assert.equal(single.minutes, null);
  assert.equal(single.distanceKm, 0);
  assert.equal(single.legs.length, 0);
});

test('valid-range forged landmark coordinates are omitted instead of trusted or routed', async () => {
  let calls = 0;
  const forged = {
    ...point('hyeopjae'),
    longitude: placeMapCoordinates.hyeopjae.longitude + 0.0001,
  };
  const [route] = await createTripMapRouteClient({
    fetcher: async (url) => {
      calls++;
      return success(url);
    },
  }).fetchRoutes([forged, point('osulloc', 1, 2), point('saebyeol', 1, 3)]);
  assert.equal(calls, 0);
  assert.equal(route.source, 'ORDER');
  assert.equal(route.reason, 'invalid-input');
  assert.equal(route.omittedPointCount, 1);
  assert.ok(!route.points.some((p) => p.placeId === 'hyeopjae'));
  assert.ok(
    !route.coordinates.some(([longitude]) => longitude === forged.longitude),
  );
});

test('input limit and duplicate visit IDs cannot trigger an unsafe partial road request', async () => {
  let calls = 0;
  const client = createTripMapRouteClient({
    fetcher: async (url) => {
      calls++;
      return success(url);
    },
  });
  const [tooMany] = await client.fetchRoutes(
    Array.from({ length: TRIP_MAP_ROUTE_MAX_POINTS + 1 }, (_v, i) =>
      point(
        i % 2 ? 'osulloc' : 'hyeopjae',
        1,
        Math.min(60, i + 1),
        `visit-${i}`,
      ),
    ),
  );
  assert.equal(tooMany.source, 'ORDER');
  assert.equal(tooMany.points.length, TRIP_MAP_ROUTE_MAX_POINTS);
  const [duplicate] = await client.fetchRoutes([
    point('hyeopjae'),
    { ...point('osulloc', 1, 2), visitId: 'visit-1-1' },
  ]);
  assert.equal(duplicate.source, 'ORDER');
  assert.equal(duplicate.points.length, 1);
  assert.equal(calls, 0);
});

test('invalid OSRM code, geometry, metrics, totals, waypoint count and leg count fall back', async () => {
  const changes = [
    (p) => {
      p.code = 'NoRoute';
    },
    (p) => {
      p.routes[0].geometry.type = 'Polygon';
    },
    (p) => {
      p.routes[0].geometry.coordinates = [
        [181, 33],
        [126, 33],
      ];
    },
    (p) => {
      p.routes[0].geometry.coordinates = [
        [126, 33, 0],
        [126, 33],
      ];
    },
    (p) => {
      p.routes[0].distance = -1;
    },
    (p) => {
      p.routes[0].duration = '65';
    },
    (p) => {
      p.routes[0].legs[0].distance = -1;
    },
    (p) => {
      p.routes[0].legs[0].duration = null;
    },
    (p) => {
      p.routes[0].distance += 100;
    },
    (p) => {
      p.routes[0].legs = [];
    },
    (p) => {
      p.waypoints.pop();
    },
    (p) => {
      p.waypoints[0].distance = -1;
    },
  ];
  for (const change of changes) {
    const client = createTripMapRouteClient({
      fetcher: async (url) => {
        const payload = roadPayload(requested(url));
        change(payload);
        return Response.json(payload);
      },
    });
    const [route] = await client.fetchRoutes(pair());
    assert.equal(route.source, 'ORDER');
    assert.equal(route.minutes, null);
  }
});

test('another order, detached route endpoints and geometry missing a stop are rejected', async () => {
  const points = [
    point('hyeopjae'),
    point('osulloc', 1, 2),
    point('saebyeol', 1, 3),
  ];
  for (const change of [
    (p) => {
      p.waypoints.reverse();
    },
    (p) => {
      p.routes[0].geometry.coordinates.reverse();
    },
    (p) => {
      p.routes[0].geometry.coordinates = [
        p.waypoints[0].location,
        p.waypoints[2].location,
      ];
    },
    (p) => {
      p.waypoints[0].location = [127, 37];
      p.waypoints[0].distance = 0;
    },
  ]) {
    const client = createTripMapRouteClient({
      fetcher: async (url) => {
        const payload = roadPayload(requested(url));
        change(payload);
        return Response.json(payload);
      },
    });
    const [route] = await client.fetchRoutes(points);
    assert.equal(route.source, 'ORDER');
    assert.equal(route.minutes, null);
  }
});

test('zero-valued server metrics remain valid for consecutive visits at the same point', async () => {
  const points = [point('hyeopjae'), point('hyeopjae', 1, 2)];
  const [route] = await createTripMapRouteClient({
    fetcher: async (url) => {
      const p = roadPayload(requested(url));
      p.routes[0].distance = 0;
      p.routes[0].duration = 0;
      p.routes[0].legs[0] = { distance: 0, duration: 0 };
      return Response.json(p);
    },
  }).fetchRoutes(points);
  assert.equal(route.source, 'ROAD');
  assert.equal(route.minutes, 0);
  assert.equal(route.distanceKm, 0);
});

test('separated landmarks cannot become a zero-distance, shorter-than-straight or zero-time ROAD result', async () => {
  for (const change of [
    leg => { leg.distance = 0; leg.duration = 0; },
    leg => { leg.distance = 100; },
    leg => { leg.duration = 0; },
  ]) {
    const client = createTripMapRouteClient({ fetcher: async url => {
      const payload = roadPayload(requested(url));
      change(payload.routes[0].legs[0]);
      payload.routes[0].distance = payload.routes[0].legs.reduce((sum, leg) => sum + leg.distance, 0);
      payload.routes[0].duration = payload.routes[0].legs.reduce((sum, leg) => sum + leg.duration, 0);
      return Response.json(payload);
    } });
    const [route] = await client.fetchRoutes(pair(), { scope: 'trip' });
    assert.equal(route.source, 'ORDER');
    assert.equal(route.distanceKind, 'STRAIGHT');
    assert.equal(route.minutes, null);
    assert.ok(route.legs.every(leg => leg.minutes === null));
  }
});

test('HTTP, JSON and bounded streamed response failures all return ORDER', async () => {
  for (const fetcher of [
    async () => new Response('unavailable', { status: 503 }),
    async () => new Response('not json'),
    async () => new Response(null),
    async () =>
      new Response('{}', {
        headers: {
          'content-length': String(TRIP_MAP_ROUTE_MAX_RESPONSE_BYTES + 1),
        },
      }),
    async () => new Response('x'.repeat(TRIP_MAP_ROUTE_MAX_RESPONSE_BYTES + 1)),
    async () => {
      throw new Error('offline');
    },
  ]) {
    const [route] = await createTripMapRouteClient({ fetcher }).fetchRoutes(
      pair(),
    );
    assert.equal(route.source, 'ORDER');
    assert.equal(route.minutes, null);
  }
});

test('timeout bounds even an uncooperative transport and later retry can succeed', async () => {
  let calls = 0;
  let firstSignal;
  const client = createTripMapRouteClient({
    timeoutMs: 15,
    fetcher: async (url, init) => {
      calls++;
      if (calls === 1) {
        firstSignal = init.signal;
        return new Promise(() => {});
      }
      return success(url);
    },
  });
  const [first] = await client.fetchRoutes(pair());
  assert.equal(first.source, 'ORDER');
  assert.equal(first.reason, 'timeout');
  assert.equal(firstSignal.aborted, true);
  const [second] = await client.fetchRoutes(pair());
  assert.equal(second.source, 'ROAD');
  assert.equal(calls, 2);
});

test('failure is not cached as a successful geometry', async () => {
  let calls = 0;
  const client = createTripMapRouteClient({
    fetcher: async (url) => {
      calls++;
      return calls === 1 ? new Response('{}', { status: 500 }) : success(url);
    },
  });
  assert.equal((await client.fetchRoutes(pair()))[0].source, 'ORDER');
  assert.equal((await client.fetchRoutes(pair()))[0].source, 'ROAD');
  assert.equal(calls, 2);
});

test('successful cache expires after ten minutes and uses coordinate order, not old turn metadata', async () => {
  let time = 1000;
  let calls = 0;
  const client = createTripMapRouteClient({
    now: () => time,
    fetcher: async (url) => {
      calls++;
      return success(url);
    },
  });
  const firstPoints = pair();
  await client.fetchRoutes(firstPoints);
  const renamed = firstPoints.map((p, index) => ({
    ...p,
    visitId: `new-visit-${index}`,
    day: 2,
    name: `새 이름 ${index}`,
  }));
  const [fromCache] = await client.fetchRoutes(renamed);
  assert.equal(calls, 1);
  assert.equal(fromCache.day, 2);
  assert.equal(fromCache.legs[0].from.visitId, 'new-visit-0');
  assert.equal(fromCache.points[0].name, '새 이름 0');
  await client.fetchRoutes([...firstPoints].reverse());
  assert.equal(calls, 2);
  const changed = [firstPoints[0], point('saebyeol', 1, 3)];
  await client.fetchRoutes(changed);
  assert.equal(calls, 3);
  time += TRIP_MAP_ROUTE_CACHE_TTL_MS;
  await client.fetchRoutes(firstPoints);
  assert.equal(calls, 4);
});

test('success cache keeps at most thirty recent coordinate sequences', async () => {
  let calls = 0;
  const client = createTripMapRouteClient({
    fetcher: async (url) => {
      calls++;
      return success(url);
    },
  });
  const ids = Object.keys(placeMapCoordinates);
  const inputs = [];
  for (const from of ids) {
    for (const to of ids) {
      if (from !== to && inputs.length <= TRIP_MAP_ROUTE_CACHE_LIMIT)
        inputs.push([point(from), point(to, 1, 2)]);
    }
  }
  assert.equal(inputs.length, TRIP_MAP_ROUTE_CACHE_LIMIT + 1);
  for (const points of inputs.slice(0, TRIP_MAP_ROUTE_CACHE_LIMIT))
    await client.fetchRoutes(points);
  assert.equal(calls, 30);
  await client.fetchRoutes(inputs[0]);
  await client.fetchRoutes(inputs.at(-1));
  assert.equal(calls, 31);
  await client.fetchRoutes(inputs[0]);
  assert.equal(calls, 31);
  await client.fetchRoutes(inputs[1]);
  assert.equal(calls, 32);
});

test('in-flight request is shared but each caller receives its own current points', async () => {
  let calls = 0;
  let finish;
  const client = createTripMapRouteClient({
    fetcher: async (url) => {
      calls++;
      return new Promise((resolve) => {
        finish = () => resolve(Response.json(roadPayload(requested(url))));
      });
    },
  });
  const pendingA = client.fetchRoutes(pair());
  const pendingB = client.fetchRoutes(
    pair().map((p, index) => ({ ...p, visitId: `other-${index}` })),
  );
  assert.equal(calls, 1);
  finish();
  const [a, b] = await Promise.all([pendingA, pendingB]);
  assert.equal(a[0].source, 'ROAD');
  assert.equal(b[0].source, 'ROAD');
  assert.equal(a[0].legs[0].from.visitId, 'visit-1-1');
  assert.equal(b[0].legs[0].from.visitId, 'other-0');
});

test('cancelling one subscriber does not abort another subscriber sharing the route', async () => {
  let finish;
  let sharedSignal;
  const client = createTripMapRouteClient({
    fetcher: async (url, init) => {
      sharedSignal = init.signal;
      return new Promise((resolve) => {
        finish = () => resolve(Response.json(roadPayload(requested(url))));
      });
    },
  });
  const controller = new AbortController();
  const cancelled = client.fetchRoutes(pair(), { signal: controller.signal });
  const waiting = client.fetchRoutes(pair());
  controller.abort();
  assert.equal((await cancelled)[0].reason, 'cancelled');
  assert.equal(sharedSignal.aborted, false);
  finish();
  assert.equal((await waiting)[0].source, 'ROAD');
});

test('result, cached geometry and point snapshots are immutable without freezing caller input', async () => {
  const input = pair();
  const originalLatitude = input[0].latitude;
  const client = createTripMapRouteClient({ fetcher: success });
  const pending = client.fetchRoutes(input);
  input[0].latitude += 0.5;
  const result = await pending;
  assert.equal(result[0].points[0].latitude, originalLatitude);
  assert.equal(Object.isFrozen(input[0]), false);
  assert.ok(
    Object.isFrozen(result) &&
      Object.isFrozen(result[0]) &&
      Object.isFrozen(result[0].points) &&
      Object.isFrozen(result[0].points[0]),
  );
  assert.throws(() => {
    result[0].coordinates[0][0] = 0;
  }, TypeError);
  assert.throws(() => {
    result[0].legs[0].minutes = 999;
  }, TypeError);
});

test('public helper shares its fake transport cache without any real network request', async () => {
  let calls = 0;
  const fetcher = async (url) => {
    calls++;
    return success(url);
  };
  const first = await fetchTripMapRoutes(pair(), { fetcher });
  const second = await fetchTripMapRoutes(pair(), { fetcher });
  assert.equal(first[0].source, 'ROAD');
  assert.equal(second[0].source, 'ROAD');
  assert.equal(calls, 1);
});
