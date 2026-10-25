import { placeMapCoordinates, type TripMapPoint } from './trip-map-data';

export const TRIP_MAP_ROUTE_TIMEOUT_MS = 8_000;
export const TRIP_MAP_ROUTE_CACHE_TTL_MS = 10 * 60 * 1_000;
export const TRIP_MAP_ROUTE_CACHE_LIMIT = 30;
export const TRIP_MAP_ROUTE_MAX_POINTS = 60;
export const TRIP_MAP_ROUTE_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_GEOMETRY_POINTS = 100_000;
const MAX_SNAP_METERS = 2_500;
const GEOMETRY_WAYPOINT_METERS = 60;
const OSRM_ROUTE_URL = 'https://router.project-osrm.org/route/v1/driving/';

export type TripMapRouteCoordinate = readonly [
  longitude: number,
  latitude: number,
];
export type TripMapRoutePoint = Readonly<TripMapPoint>;
export type TripMapRouteScope = 'trip' | 'day';
export type TripMapRouteReason =
  | 'unavailable'
  | 'timeout'
  | 'invalid-input'
  | 'insufficient-points'
  | 'cancelled';
export type TripMapRouteLeg = Readonly<{
  from: TripMapRoutePoint;
  to: TripMapRoutePoint;
  distanceKm: number;
  /** OSRM driving seconds rounded up to minutes. Never an estimated walk time. */
  minutes: number | null;
}>;
export type TripMapRouteDay = Readonly<{
  /** 0 identifies the whole trip; individual points retain their actual DAY. */
  day: number;
  source: 'ROAD' | 'ORDER';
  mode: 'DRIVE';
  distanceKind: 'ROAD' | 'STRAIGHT';
  points: readonly TripMapRoutePoint[];
  /** GeoJSON / Leaflet GeoJSON order, never [latitude, longitude]. */
  coordinates: readonly TripMapRouteCoordinate[];
  legs: readonly TripMapRouteLeg[];
  distanceKm: number;
  minutes: number | null;
  reason: TripMapRouteReason | null;
  omittedPointCount: number;
  notice: string;
}>;
type DayGroup = {
  day: number;
  points: TripMapRoutePoint[];
  omitted: number;
  unsafe: boolean;
};
type RoadLeg = Readonly<{ distanceMeters: number; durationSeconds: number }>;
type RoadData = Readonly<{
  coordinates: readonly TripMapRouteCoordinate[];
  legs: readonly RoadLeg[];
}>;
type RoadOutcome = { data: RoadData | null; reason: TripMapRouteReason };
type ScopeOptions = { scope?: TripMapRouteScope };
type RequestOptions = ScopeOptions & { signal?: AbortSignal };
type ClientOptions = {
  fetcher?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
};

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function nonnegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
function coordinate(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((v) => typeof v === 'number' && Number.isFinite(v)) &&
    Math.abs(value[0]) <= 180 &&
    Math.abs(value[1]) <= 90
  );
}
function position(point: TripMapRoutePoint): TripMapRouteCoordinate {
  return Object.freeze([
    point.longitude,
    point.latitude,
  ]) as TripMapRouteCoordinate;
}
function distanceKm(
  from: TripMapRouteCoordinate,
  to: TripMapRouteCoordinate,
): number {
  const radians = (value: number) => (value * Math.PI) / 180;
  const a =
    Math.sin(radians(to[1] - from[1]) / 2) ** 2 +
    Math.cos(radians(from[1])) *
      Math.cos(radians(to[1])) *
      Math.sin(radians(to[0] - from[0]) / 2) ** 2;
  const bounded = Math.min(1, Math.max(0, a));
  return 6371 * 2 * Math.atan2(Math.sqrt(bounded), Math.sqrt(1 - bounded));
}
function pointValid(value: unknown): value is TripMapPoint {
  if (!record(value)) return false;
  const canonical =
    typeof value.placeId === 'string' &&
    Object.hasOwn(placeMapCoordinates, value.placeId)
      ? placeMapCoordinates[value.placeId]
      : null;
  return (
    typeof value.visitId === 'string' &&
    /^[A-Za-z0-9_-]{1,160}$/.test(value.visitId) &&
    Boolean(canonical) &&
    value.latitude === canonical?.latitude &&
    value.longitude === canonical?.longitude &&
    Number.isInteger(value.order) &&
    (value.order as number) >= 1 &&
    (value.order as number) <= TRIP_MAP_ROUTE_MAX_POINTS &&
    coordinate([value.longitude, value.latitude]) &&
    typeof value.name === 'string' &&
    value.name.length <= 200 &&
    typeof value.label === 'string' &&
    value.label.length <= 200
  );
}
function groupsFor(
  input: readonly TripMapPoint[],
  scope: TripMapRouteScope = 'day',
): DayGroup[] {
  if (!Array.isArray(input)) return [];
  const groups = new Map<number, DayGroup>();
  const ids = new Set<string>();
  const limited = input.length > TRIP_MAP_ROUTE_MAX_POINTS;
  let invalidDay = false;
  for (const value of input.slice(0, TRIP_MAP_ROUTE_MAX_POINTS)) {
    if (
      !record(value) ||
      !Number.isInteger(value.day) ||
      (value.day as number) < 1 ||
      (value.day as number) > 365
    ) {
      invalidDay = true;
      continue;
    }
    const day = value.day as number;
    const group = groups.get(day) ?? {
      day,
      points: [],
      omitted: 0,
      unsafe: limited,
    };
    groups.set(day, group);
    if (!pointValid(value) || ids.has(value.visitId)) {
      group.omitted++;
      group.unsafe = true;
      continue;
    }
    ids.add(value.visitId);
    // Snapshot the caller's metadata before any asynchronous request can run.
    group.points.push(Object.freeze({ ...value }));
  }
  if (invalidDay) for (const group of groups.values()) group.unsafe = true;
  const ordered = [...groups.values()].sort((a, b) => a.day - b.day);
  if (scope !== 'trip' || ordered.length === 0) return ordered;
  return [
    {
      day: 0,
      points: ordered.flatMap((group) => group.points),
      omitted: ordered.reduce((sum, group) => sum + group.omitted, 0),
      unsafe: ordered.some((group) => group.unsafe),
    },
  ];
}
function orderRoute(
  group: DayGroup,
  reason: TripMapRouteReason,
): TripMapRouteDay {
  const points = Object.freeze([...group.points]);
  const coordinates = Object.freeze(points.map(position));
  const legs = Object.freeze(
    points.slice(1).map((to, index) =>
      Object.freeze({
        from: points[index],
        to,
        distanceKm: distanceKm(coordinates[index], coordinates[index + 1]),
        minutes: null,
      }),
    ),
  );
  return Object.freeze({
    day: group.day,
    source: 'ORDER',
    mode: 'DRIVE',
    distanceKind: 'STRAIGHT',
    points,
    coordinates,
    legs,
    distanceKm: legs.reduce((sum, leg) => sum + leg.distanceKm, 0),
    minutes: null,
    reason,
    omittedPointCount: group.omitted,
    notice:
      reason === 'insufficient-points'
        ? '좌표가 확인된 장소가 2곳 미만이라 도로 경로를 조회하지 않았어요. 이동시간은 표시하지 않아요.'
        : '도로 경로를 확인하지 못해 위치가 확인된 장소의 방문 순서와 직선거리만 표시해요. 이동시간은 계산하지 않았어요.',
  });
}
function roadRoute(group: DayGroup, data: RoadData): TripMapRouteDay {
  const points = Object.freeze([...group.points]);
  const legs = Object.freeze(
    data.legs.map((leg, index) =>
      Object.freeze({
        from: points[index],
        to: points[index + 1],
        distanceKm: leg.distanceMeters / 1000,
        minutes: Math.ceil(leg.durationSeconds / 60),
      }),
    ),
  );
  return Object.freeze({
    day: group.day,
    source: 'ROAD',
    mode: 'DRIVE',
    distanceKind: 'ROAD',
    points,
    coordinates: data.coordinates,
    legs,
    distanceKm:
      data.legs.reduce((sum, leg) => sum + leg.distanceMeters, 0) / 1000,
    minutes: Math.ceil(
      data.legs.reduce((sum, leg) => sum + leg.durationSeconds, 0) / 60,
    ),
    reason: null,
    omittedPointCount: group.omitted,
    notice:
      'OSRM 도로 경로의 차량 이동 참고 거리·시간이에요. 실시간 교통은 반영하지 않으며 위치가 확인된 장소만 연결해요.',
  });
}

/** Defaults to separate DAYs. Trip scope joins DAYs in ascending order, preserving each DAY's input order. */
export function makeTripMapOrderRoutes(
  points: readonly TripMapPoint[],
  options: ScopeOptions = {},
): readonly TripMapRouteDay[] {
  return Object.freeze(
    groupsFor(points, options.scope).map((group) =>
      orderRoute(
        group,
        group.unsafe
          ? 'invalid-input'
          : group.points.length < 2
            ? 'insufficient-points'
            : 'unavailable',
      ),
    ),
  );
}

function validateRoad(
  value: unknown,
  requested: readonly TripMapRouteCoordinate[],
): RoadData {
  const invalid = () => {
    throw new Error('Invalid OSRM route');
  };
  if (
    !record(value) ||
    value.code !== 'Ok' ||
    !Array.isArray(value.routes) ||
    value.routes.length !== 1 ||
    !Array.isArray(value.waypoints) ||
    value.waypoints.length !== requested.length
  )
    invalid();
  const payload = value as Record<string, unknown>;
  const route = (payload.routes as unknown[])[0];
  if (
    !record(route) ||
    !nonnegative(route.distance) ||
    !nonnegative(route.duration) ||
    !record(route.geometry) ||
    route.geometry.type !== 'LineString' ||
    !Array.isArray(route.geometry.coordinates) ||
    route.geometry.coordinates.length < 2 ||
    route.geometry.coordinates.length > MAX_GEOMETRY_POINTS ||
    !route.geometry.coordinates.every(coordinate) ||
    !Array.isArray(route.legs) ||
    route.legs.length !== requested.length - 1
  )
    invalid();
  const road = route as Record<string, unknown>;
  const geometry = (road.geometry as { coordinates: [number, number][] })
    .coordinates;
  const waypoints = (payload.waypoints as unknown[]).map((value, index) => {
    if (
      !record(value) ||
      !coordinate(value.location) ||
      !nonnegative(value.distance) ||
      value.distance > MAX_SNAP_METERS
    )
      invalid();
    const waypoint = value as { location: [number, number]; distance: number };
    const actualSnap = distanceKm(requested[index], waypoint.location) * 1000;
    if (
      actualSnap > MAX_SNAP_METERS ||
      Math.abs(actualSnap - waypoint.distance) > Math.max(10, actualSnap * 0.1)
    )
      invalid();
    return waypoint.location;
  });
  if (
    distanceKm(geometry[0], waypoints[0]) * 1000 > GEOMETRY_WAYPOINT_METERS ||
    distanceKm(geometry[geometry.length - 1], waypoints[waypoints.length - 1]) *
      1000 >
      GEOMETRY_WAYPOINT_METERS
  )
    invalid();
  let cursor = 0;
  for (const waypoint of waypoints) {
    while (
      cursor < geometry.length &&
      distanceKm(geometry[cursor], waypoint) * 1000 > GEOMETRY_WAYPOINT_METERS
    )
      cursor++;
    if (cursor >= geometry.length) invalid();
  }
  const legs = (road.legs as unknown[]).map((value, index) => {
    if (
      !record(value) ||
      !nonnegative(value.distance) ||
      !nonnegative(value.duration)
    )
      invalid();
    const leg = value as { distance: number; duration: number };
    const straightMeters = distanceKm(waypoints[index], waypoints[index + 1]) * 1000;
    // A road cannot be shorter than the straight line between its snapped
    // endpoints. Allow five meters for provider coordinate/metric rounding.
    if (leg.distance + 5 < straightMeters || (leg.distance > 1 && leg.duration === 0)) invalid();
    return Object.freeze({
      distanceMeters: leg.distance,
      durationSeconds: leg.duration,
    });
  });
  const meters = legs.reduce((sum, leg) => sum + leg.distanceMeters, 0);
  const seconds = legs.reduce((sum, leg) => sum + leg.durationSeconds, 0);
  const tolerance = Math.max(1, legs.length * 0.2);
  if (
    !Number.isFinite(meters) ||
    !Number.isFinite(seconds) ||
    Math.abs(meters - (road.distance as number)) > tolerance ||
    Math.abs(seconds - (road.duration as number)) > tolerance
  )
    invalid();
  return Object.freeze({
    coordinates: Object.freeze(
      geometry.map(
        (point) => Object.freeze([...point]) as TripMapRouteCoordinate,
      ),
    ),
    legs: Object.freeze(legs),
  });
}

async function readJson(response: Response): Promise<unknown> {
  const declared = response.headers.get('content-length');
  if (
    declared &&
    (!/^\d+$/.test(declared) ||
      Number(declared) > TRIP_MAP_ROUTE_MAX_RESPONSE_BYTES)
  )
    throw new Error('OSRM response size');
  if (!response.body) throw new Error('Empty OSRM response');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > TRIP_MAP_ROUTE_MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error('OSRM response size');
      }
      text += decoder.decode(next.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally {
    reader.releaseLock();
  }
}

/** Isolated clients support testing with a fake fetch/clock; the UI uses the shared default below. */
export function createTripMapRouteClient(options: ClientOptions = {}) {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? (() => Date.now());
  const timeoutMs =
    options.timeoutMs === undefined || !Number.isFinite(options.timeoutMs)
      ? TRIP_MAP_ROUTE_TIMEOUT_MS
      : Math.min(TRIP_MAP_ROUTE_TIMEOUT_MS, Math.max(1, options.timeoutMs));
  const cache = new Map<string, { savedAt: number; data: RoadData }>();
  const pending = new Map<string, Promise<RoadOutcome>>();
  function getRoad(
    coordinates: readonly TripMapRouteCoordinate[],
  ): Promise<RoadOutcome> {
    const key = JSON.stringify(coordinates);
    const hit = cache.get(key);
    if (
      hit &&
      now() - hit.savedAt < TRIP_MAP_ROUTE_CACHE_TTL_MS &&
      now() >= hit.savedAt
    ) {
      cache.delete(key);
      cache.set(key, hit);
      return Promise.resolve({ data: hit.data, reason: 'unavailable' });
    }
    if (hit) cache.delete(key);
    const existing = pending.get(key);
    if (existing) return existing;
    const controller = new AbortController();
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout>;
    const request = (async () => {
      const url = `${OSRM_ROUTE_URL}${coordinates.map((point) => point.join(',')).join(';')}?alternatives=false&steps=false&overview=full&geometries=geojson&skip_waypoints=false&generate_hints=false`;
      const response = await fetcher(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
        redirect: 'error',
      });
      if (!response.ok) throw new Error('OSRM unavailable');
      return validateRoad(await readJson(response), coordinates);
    })();
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
        reject(new Error('OSRM timeout'));
      }, timeoutMs);
    });
    const job = Promise.race([request, timeout])
      .then((data): RoadOutcome => {
        cache.set(key, { savedAt: now(), data });
        while (cache.size > TRIP_MAP_ROUTE_CACHE_LIMIT)
          cache.delete(cache.keys().next().value!);
        return { data, reason: 'unavailable' };
      })
      .catch(
        (): RoadOutcome => ({
          data: null,
          reason: timedOut ? 'timeout' : 'unavailable',
        }),
      )
      .finally(() => {
        clearTimeout(timer);
        if (pending.get(key) === job) pending.delete(key);
      });
    pending.set(key, job);
    return job;
  }
  function routeDay(
    group: DayGroup,
    signal?: AbortSignal,
  ): Promise<TripMapRouteDay> {
    if (signal?.aborted) return Promise.resolve(orderRoute(group, 'cancelled'));
    if (group.unsafe || group.points.length < 2)
      return Promise.resolve(
        orderRoute(
          group,
          group.unsafe ? 'invalid-input' : 'insufficient-points',
        ),
      );
    const result = getRoad(group.points.map(position)).then((outcome) =>
      outcome.data
        ? roadRoute(group, outcome.data)
        : orderRoute(group, outcome.reason),
    );
    if (!signal) return result;
    return new Promise((resolve) => {
      const abort = () => resolve(orderRoute(group, 'cancelled'));
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
      void result
        .then(resolve)
        .finally(() => signal.removeEventListener('abort', abort));
    });
  }
  return {
    async fetchRoutes(
      points: readonly TripMapPoint[],
      request: RequestOptions = {},
    ): Promise<readonly TripMapRouteDay[]> {
      return Object.freeze(
        await Promise.all(
          groupsFor(points, request.scope).map((group) =>
            routeDay(group, request.signal),
          ),
        ),
      );
    },
  };
}

const defaultClient = createTripMapRouteClient();
const customClients = new WeakMap<
  typeof fetch,
  ReturnType<typeof createTripMapRouteClient>
>();

/** Successful geometry is shared for 10 minutes by exact coordinate order, never by a prior turn's IDs. */
export function fetchTripMapRoutes(
  points: readonly TripMapPoint[],
  options: RequestOptions & { fetcher?: typeof fetch } = {},
): Promise<readonly TripMapRouteDay[]> {
  if (!options.fetcher) return defaultClient.fetchRoutes(points, options);
  let client = customClients.get(options.fetcher);
  if (!client) {
    client = createTripMapRouteClient({ fetcher: options.fetcher });
    customClients.set(options.fetcher, client);
  }
  return client.fetchRoutes(points, options);
}
