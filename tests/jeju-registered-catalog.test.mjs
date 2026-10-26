import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

registerHooks({ resolve(specifier, context, next) {
  if (/\/lib\/[^/]+\.ts$/.test(context.parentURL ?? '') && specifier.startsWith('./') && !/\.[a-z]+$/.test(specifier)) return next(specifier + '.ts', context);
  return next(specifier, context);
} });
const { default: supplement } = await import('../lib/jeju-registered-businesses.ts');
const { default: displayContent } = await import('../lib/jeju-business-content.ts');
const { default: photoSupplement } = await import('../lib/jeju-business-photos.ts');
const { default: appSnapshot } = await import('../lib/registered-spotlog-snapshot.ts');
const { registeredEntities, getRegisteredEntity, getNearbyRegisteredBusinesses, getLegacyAnchorCoordinate, getKnownEntityPrice } = await import('../lib/registered-catalog.ts');
const { findFood, findStay, restaurants, stays } = await import('../lib/trip-data.ts');
const { placeMapCoordinates, getTripMapData } = await import('../lib/trip-map-data.ts');
const { makeTripMapOrderRoutes } = await import('../lib/trip-map-route.ts');
const { businessDetails } = await import('../lib/business-details.ts');
const { getBusinessContent } = await import('../lib/business-content.ts');
const { ragCatalog } = await import('../lib/rag-catalog.ts');
const { authoredDemoDocuments } = await import('../scripts/rag/catalog.mjs');
const { findCommunityTrip } = await import('../lib/community-trips.ts');
const { createTripSession, currentTrip, appendTrip, foodResults, stayResults } = await import('../lib/trip-engine.ts');
const { validateJejuRegisteredCatalog, generatedJejuRegisteredCatalog } = await import('../scripts/sync-jeju-registered-catalog.mjs');

const facts = [
  ['catalog-jeju-hyeopjae-sin-guksu', 'FOOD', '협재신국수', 33.3950215, 126.2489409, 'hyeopjae'],
  ['catalog-jeju-myeongri-main', 'FOOD', '명리동식당 본점', 33.3166193, 126.2705014, 'osulloc'],
  ['catalog-jeju-bongseong', 'FOOD', '봉성식당', 33.364338, 126.3552026, 'saebyeol'],
  ['catalog-jeju-paratodos', 'CAFE', '파라토도스', 33.3892927, 126.2323744, 'geumneung'],
  ['catalog-jeju-coffee-sketch', 'CAFE', '커피스케치', 33.23336889999999, 126.3133602, 'songaksan'],
  ['catalog-jeju-landing-shinhwa', 'STAY', '랜딩관 제주신화월드 호텔앤리조트', 33.30666014133809, 126.3188970217041, 'osulloc'],
];
const ids = new Set(facts.map(([id]) => id));
const replacements = new Map([
  ['hj-rice', facts[0][0]], ['of-rice', facts[1][0]], ['sb-rice', facts[2][0]],
  ['geumneung-cafe', facts[3][0]], ['songaksan-cafe', facts[4][0]], ['stay-tea', facts[5][0]],
]);

test('six real Jeju records use independent checked business coordinates and retain unknown live facts', () => {
  assert.equal(supplement.entries.length, 6);
  for (const [id, kind, name, latitude, longitude, anchor] of facts) {
    const entity = getRegisteredEntity(id);
    assert.ok(entity, id);
    assert.equal(entity.kind, kind); assert.equal(entity.name, name); assert.equal(entity.region, '제주');
    assert.equal(entity.latitude, latitude); assert.equal(entity.longitude, longitude);
    assert.equal(entity.source.checkedAt, '2026-10-22');
    assert.equal(entity.source.sourceUrl, `https://www.visitjeju.net/kr/detail/view?contentsid=${entity.source.providerRecordId}`);
    assert.notDeepEqual([latitude, longitude], [placeMapCoordinates[anchor].latitude, placeMapCoordinates[anchor].longitude]);
    assert.equal(placeMapCoordinates[id].latitude, latitude); assert.equal(placeMapCoordinates[id].longitude, longitude);
    assert.deepEqual(entity.photos, photoSupplement.entries.find(item => item.id === id)?.photos ?? []);
    assert.equal(entity.price, null); assert.equal(entity.openingHours, null); assert.equal(entity.availability, null);
    const candidate = kind === 'STAY' ? findStay(id) : findFood(id);
    assert.equal(candidate.registered, true); assert.equal(getKnownEntityPrice(candidate), null);
    const detail = businessDetails({ kind: kind === 'STAY' ? 'stay' : 'food', id });
    const content = getBusinessContent(id);
    assert.equal(detail.registered, true); assert.equal(detail.price, '가격 미확인'); assert.deepEqual(detail.menu, []);
    assert.deepEqual(detail.content, content);
    assert.equal(detail.hours, content.checkIn ?? content.hours);
  }
});

test('Jeju display snapshots retain menu, room and source provenance independently of the basic catalog', async () => {
  const json = JSON.parse(await readFile(new URL('../lib/jeju-business-content.json', import.meta.url), 'utf8'));
  assert.deepEqual(displayContent, json);
  assert.equal(json.checkedAt, '2026-10-26');
  assert.deepEqual(new Set(json.entries.map(entry => entry.id)), ids);
  assert.equal(json.entries.flatMap(entry => entry.menus).length, 20);
  assert.equal(json.entries.flatMap(entry => entry.rooms ?? []).length, 5);
  for (const entry of json.entries) {
    assert.ok(entry.priceNote.length > 0, entry.id);
    assert.ok(entry.sources.length > 0, entry.id);
    assert.ok(entry.facilities.length > 0, entry.id);
    for (const source of entry.sources) {
      assert.equal(new URL(source.url).protocol, 'https:');
      assert.ok(source.title.length > 0); assert.ok(source.scope.length > 0);
    }
    for (const menu of entry.menus) {
      assert.ok(menu.name.length > 0); assert.ok(menu.note.length > 0);
      assert.ok(menu.price === null || Number.isFinite(menu.price) && menu.price > 0);
    }
    assert.equal(getBusinessContent(entry.id).checkedAt, json.checkedAt);
  }
  assert.equal(getBusinessContent('unknown-business-id'), null);
});

test('business details attach menu and room templates while distinguishing licensed photos from illustrations', () => {
  for (const [id, kind] of facts) {
    const detail = businessDetails({ kind: kind === 'STAY' ? 'stay' : 'food', id });
    const content = displayContent.entries.find(entry => entry.id === id);
    assert.deepEqual(detail.content.menus, content.menus);
    assert.deepEqual(detail.content.rooms, content.rooms);
    assert.deepEqual(detail.content.facilities, content.facilities);
    assert.deepEqual(detail.content.sources, content.sources);
    const names = kind === 'STAY' ? content.rooms : content.menus;
    for (const item of names.slice(0, kind === 'STAY' ? 2 : 3)) assert.ok(detail.primary.includes(item.name));
    assert.equal(detail.imageIsExample, detail.photos.length === 0);
    if (detail.imageIsExample) {
      assert.match(detail.imageAlt, /예시 이미지.*실제 업체.*아님/);
    } else {
      assert.equal(detail.image, detail.photos[0].image);
      assert.ok(detail.photos[0].license); assert.ok(detail.photos[0].sourceUrl);
    }
  }
  const hotel = businessDetails({ kind: 'stay', id: facts[5][0] });
  assert.match(hotel.hours, /체크인 15:00.*체크아웃 11:00/);
  assert.ok(hotel.content.facilities.includes('랜딩관 자체 수영장 없음'));
});

test('published display prices do not become verified budget prices or live availability', () => {
  assert.equal(displayContent.entries.flatMap(entry => entry.menus).filter(menu => menu.price !== null).length, 16);
  for (const [id, kind] of facts) {
    const candidate = kind === 'STAY' ? findStay(id) : findFood(id);
    const entity = getRegisteredEntity(id);
    assert.equal(getKnownEntityPrice(candidate), null, id);
    assert.equal(candidate.priceVerified, false, id);
    assert.equal(candidate.priceStatus, 'unknown', id);
    assert.equal(entity.price, null); assert.equal(entity.openingHours, null); assert.equal(entity.availability, null);
    const raw = supplement.entries.find(entry => entry.id === id);
    assert.deepEqual(raw.photos, []); assert.equal(raw.price, null); assert.equal(raw.openingHours, null); assert.equal(raw.availability, null);
  }
});

test('independent JSON and generated TypeScript stay identical without changing the app snapshot', async () => {
  const json = JSON.parse(await readFile(new URL('../lib/jeju-registered-businesses.json', import.meta.url), 'utf8'));
  assert.deepEqual(supplement, json);
  assert.equal(await readFile(new URL('../lib/jeju-registered-businesses.ts', import.meta.url), 'utf8'), generatedJejuRegisteredCatalog(json));
  assert.equal(registeredEntities.length, appSnapshot.entries.length + json.entries.length);
  const originalIds = new Set(appSnapshot.entries.map(item => item.id));
  assert.equal(registeredEntities.filter(item => originalIds.has(item.id)).length, appSnapshot.entries.length);
  assert.equal([...ids].filter(id => originalIds.has(id)).length, 0);
  for (const mutate of [
    value => { value.entries[0].latitude = '33.3'; },
    value => { value.entries[0].latitude = 37.5; },
    value => { value.entries[0].source.checkedAt = '2026-10-21'; },
    value => { value.entries[0].source.sourceUrl = 'https://example.com/'; },
    value => { value.entries[0].price = 0; },
    value => { value.entries[0].openingHours = '09:00-18:00'; },
    value => { value.entries[0].photos = [{ image: 'unlicensed.jpg' }]; },
    value => { value.entries[0].id = value.entries[1].id; },
    value => { value.entries[0].apiKey = 'unexpected'; },
  ]) {
    const invalid = structuredClone(json); mutate(invalid);
    assert.throws(() => validateJejuRegisteredCatalog(invalid));
  }
});

test('Jeju tourism anchors find actual businesses within explicit 3km or requested 15km radii', () => {
  for (const anchor of ['hyeopjae', 'geumneung', 'osulloc', 'songaksan', 'saebyeol']) {
    assert.deepEqual(getLegacyAnchorCoordinate(anchor), { latitude: placeMapCoordinates[anchor].latitude, longitude: placeMapCoordinates[anchor].longitude });
  }
  for (const [id, kind, , , , anchor] of facts) {
    const expanded = getNearbyRegisteredBusinesses(anchor, kind, { expanded: true });
    assert.ok(expanded.some(item => item.entity.id === id), id);
    assert.ok(expanded.every(item => item.radiusKm === 15 && item.distanceKm <= 15 && item.distanceKind === 'straight'));
    const actual = kind === 'STAY' ? findStay(id) : findFood(id);
    assert.equal(kind === 'STAY' ? actual.near[0] : actual.placeId, anchor);
  }
  assert.ok(getNearbyRegisteredBusinesses('hyeopjae', 'FOOD').some(item => item.entity.id === facts[0][0]));
  assert.ok(getNearbyRegisteredBusinesses('osulloc', 'FOOD').some(item => item.entity.id === facts[1][0]));
  assert.ok(getNearbyRegisteredBusinesses('saebyeol', 'FOOD').some(item => item.entity.id === facts[2][0]));
  assert.ok(getNearbyRegisteredBusinesses('geumneung', 'CAFE').some(item => item.entity.id === facts[3][0]));
  assert.ok(!getNearbyRegisteredBusinesses('songaksan', 'CAFE').some(item => item.entity.id === facts[4][0]), '3km search must not silently widen for the actual Sagye cafe');
  assert.ok(getNearbyRegisteredBusinesses('osulloc', 'STAY').some(item => item.entity.id === facts[5][0]));
  const s = { ...currentTrip(appendTrip(createTripSession(), { type: 'region', region: '제주' })), anchorId: 'hyeopjae' };
  assert.ok(foodResults(s).some(item => item.id === facts[0][0]));
  assert.equal(foodResults({ ...s, foodBudget: 10000 }).length, 0, 'unknown real prices cannot satisfy an explicit budget');
  assert.ok(stayResults({ ...s, anchorId: 'osulloc' }).some(item => item.id === facts[5][0]));
});

test('the same six Jeju sources feed RAG indexing and request-time evidence validation', async () => {
  const indexed = await authoredDemoDocuments(fileURLToPath(new URL('../', import.meta.url)));
  const current = ragCatalog();
  for (const [id] of facts) {
    const source = current.find(item => item.documentId === `moa-knowledge:registered-${id}`);
    const doc = indexed.find(item => item.documentId === source?.documentId);
    assert.ok(source); assert.ok(doc);
    assert.equal(source.placeId, id); assert.equal(doc.placeId, id);
    assert.equal(doc.text, source.text); assert.equal(doc.sourceUrl, source.sourceUrl); assert.equal(doc.checkedAt, '2026-10-22');
    assert.match(source.text, /현재 영업시간.*제공되지 않습니다/);
  }
});

test('all eleven visits have distinct actual entity coordinates and DAY2 starts at the previous real hotel', () => {
  const original = findCommunityTrip('community-jeju-west-sea');
  const before = JSON.stringify(original);
  const visits = original.visits.map((visit, i) => ({ ...visit, id: `jeju-real-${i + 1}`, locked: false, entityId: replacements.get(visit.entityId === 'stay-coast' ? 'stay-tea' : visit.entityId) ?? visit.entityId }));
  visits.push({ id: 'jeju-real-10', day: 2, kind: 'place', entityId: 'saebyeol', anchorId: 'saebyeol', label: '추가 방문', locked: false });
  visits.push({ id: 'jeju-real-11', day: 2, kind: 'food', entityId: facts[2][0], anchorId: 'saebyeol', label: '추가 식사', locked: false });
  const frozenBefore = JSON.stringify(visits);
  const all = getTripMapData({ plan: visits, activeDay: 1 }, { allDays: true });
  assert.equal(all.totalCount, 11); assert.equal(all.points.length, 11); assert.equal(all.unlocatedCount, 0);
  assert.deepEqual(all.points.map(point => point.visitId), visits.map(visit => visit.id));
  assert.equal(new Set(all.points.map(point => `${point.latitude},${point.longitude}`)).size, 11);
  const route = makeTripMapOrderRoutes(all.points, { scope: 'trip' });
  assert.equal(route.length, 1); assert.equal(route[0].omittedPointCount, 0);
  assert.equal(route[0].legs.length, 10);
  assert.deepEqual(route[0].legs.map(leg => [leg.from.visitId, leg.to.visitId]), visits.slice(1).map((visit, i) => [visits[i].id, visit.id]));
  const day2 = getTripMapData({ plan: visits, activeDay: 2 });
  assert.equal(day2.unlocatedCount, 0); assert.equal(day2.points[0].placeId, facts[5][0]);
  assert.deepEqual(day2.points.slice(1).map(point => point.visitId), visits.filter(visit => visit.day === 2).map(visit => visit.id));
  assert.equal(JSON.stringify(visits), frozenBefore); assert.equal(JSON.stringify(original), before);
});

test('all legacy fictional businesses keep their identities and remain unlocated until explicitly replaced', () => {
  const fictional = [...restaurants, ...stays].filter(item => !item.registered);
  assert.ok(fictional.length > 6);
  for (const item of fictional) {
    assert.equal(getRegisteredEntity(item.id), undefined, item.id);
    assert.equal(placeMapCoordinates[item.id], undefined, item.id);
  }
  for (const oldId of replacements.keys()) {
    const item = findFood(oldId) ?? findStay(oldId);
    assert.ok(item, oldId); assert.notEqual(item.name, getRegisteredEntity(replacements.get(oldId)).name);
  }
  const source = findCommunityTrip('community-jeju-west-sea');
  assert.equal(source.visits.length, 9); assert.ok(source.visits.some(visit => visit.entityId === 'hj-rice'));
  assert.ok(source.visits.some(visit => visit.entityId === 'stay-coast'));
});
