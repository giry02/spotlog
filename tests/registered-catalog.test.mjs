import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
registerHooks({ resolve(specifier, context, next) {
  if (/\/lib\/[^/]+\.ts$/.test(context.parentURL ?? '') && specifier.startsWith('./') && !/\.[a-z]+$/.test(specifier)) return next(specifier + '.ts', context);
  return next(specifier, context);
} });
const { registeredEntities, getNearbyRegisteredBusinesses, getKnownEntityPrice } = await import('../lib/registered-catalog.ts');
const { restaurants, stays } = await import('../lib/trip-data.ts');
const { getTripMapData } = await import('../lib/trip-map-data.ts');
const { businessDetails } = await import('../lib/business-details.ts');
const { mapLinks, directionsTarget } = await import('../lib/travel-links.ts');
const { ragCatalog, namedKnowledgePlaceIds } = await import('../lib/rag-catalog.ts');
const { authoredDemoDocuments } = await import('../scripts/rag/catalog.mjs');
const visit = (id, entityId, kind, day=1) => ({id,entityId,kind,day,anchorId:'public-busan-haeundae',label:'방문',locked:false});

test('registered facts retain source dates and every copied individual photo matches its licensed checksum', () => {
  assert.equal(new Set(registeredEntities.map(item=>item.id)).size, registeredEntities.length);
  assert.ok(registeredEntities.length >= 80);
  for (const item of registeredEntities) {
    assert.ok(item.address && /^https:\/\//.test(item.source.sourceUrl));
    assert.match(item.source.checkedAt,/^2026-\d\d-\d\d$/);
    assert.ok(item.latitude > 33 && item.latitude < 39);
    assert.ok(item.longitude > 125 && item.longitude < 130);
    assert.equal(item.price,null); assert.equal(item.openingHours,null); assert.equal(item.availability,null);
    for (const photo of item.photos) {
      assert.match(photo.license,/^(공공누리 제1유형|CC BY-SA [34]\.0)$/);
      assert.ok(photo.owner && photo.author && photo.sourceUrl && photo.licenseUrl);
      const bytes=fs.readFileSync(new URL('../public'+photo.image,import.meta.url));
      assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), photo.sha256, photo.id);
    }
  }
});
test('nearby search uses an explicit straight-line 3km boundary and widens to 15km only on request', () => {
  const local = getNearbyRegisteredBusinesses('public-busan-haeundae','카페');
  const extended = getNearbyRegisteredBusinesses('public-busan-haeundae','카페',{expanded:true});
  assert.ok(local.length > 0 && extended.length > local.length);
  assert.ok(local.every(item=>item.radiusKm===3 && item.distanceKind==='straight' && item.distanceKm<=3));
  assert.ok(extended.every(item=>item.radiusKm===15 && item.distanceKm<=15));
  assert.ok(local.every(item=>extended.some(other=>other.entity.id===item.entity.id)));
  assert.deepEqual(getNearbyRegisteredBusinesses('unknown','카페',{expanded:true}),[]);
  assert.ok(getNearbyRegisteredBusinesses('hyeopjae','식당').some(item => item.entity.id === 'catalog-jeju-hyeopjae-sin-guksu'));
});
test('a real record with unknown prices stays unknown and does not acquire a fabricated menu or opening schedule',()=>{
  for(const item of [...restaurants,...stays].filter(item=>item.registered)) {
    assert.equal(getKnownEntityPrice(item),null,item.id);
    const details=businessDetails({kind:stays.includes(item)?'stay':'food',id:item.id});
    assert.equal(details.registered,true); assert.equal(details.price,'가격 미확인');
    assert.deepEqual(details.menu,[]); assert.equal(details.walk,null);
    assert.match(details.hours,/미확인/);
  }
});
test('a hotel without a registered landmark can anchor itself at its verified coordinate',()=>{
  const standalone=stays.filter(item=>item.registered && ['서울','강릉'].includes(item.region));
  assert.ok(standalone.length>=4);
  for(const hotel of standalone) {
    assert.deepEqual(hotel.near,[hotel.id]);
    const map=getTripMapData({plan:[visit('hotel',hotel.id,'stay')],activeDay:1});
    assert.equal(map.points.length,1);assert.equal(map.points[0].placeId,hotel.id);
    assert.equal(map.points[0].latitude,hotel.latitude);assert.equal(map.points[0].longitude,hotel.longitude);
  }
});
test('real meal, cafe, shopping and hotel pins route as their own coordinates; next DAY starts at last hotel',()=>{
  const plan=[visit('morning','public-busan-haeundae','place'),visit('food','catalog-busan-geumsu','food'),visit('cafe','catalog-busan-bibibidang','cafe'),visit('hotel','catalog-busan-westin','stay'),visit('next','public-busan-dongbaek','place',2),visit('shop','public-busan-gukje','shop',2)];
  const before=structuredClone(plan);
  const all=getTripMapData({plan,activeDay:1},{allDays:true});
  assert.equal(all.points.length,6);assert.equal(all.unlocatedCount,0);
  assert.deepEqual(all.points.map(item=>item.visitId),plan.map(item=>item.id));
  const second=getTripMapData({plan,activeDay:2});
  assert.deepEqual(second.points.map(item=>[item.visitId,item.order]),[['hotel',1],['next',2],['shop',3]]);
  assert.notEqual(all.points[0].latitude,all.points[1].latitude);
  assert.deepEqual(plan,before);
  assert.equal(getTripMapData({plan:[visit('wrong','catalog-busan-geumsu','stay')],activeDay:1}).points.length,0);
  assert.ok(mapLinks('catalog-busan-westin').directions.includes('destination='));
  const target=directionsTarget({plan,anchorId:'public-busan-haeundae',directionsVisitId:'food'});
  assert.equal(target.unavailable,false); assert.ok(target.links);
});
test('indexing and request-time validation use identical registered evidence, source identity and check date',async()=>{
  const indexed=await authoredDemoDocuments(fileURLToPath(new URL('../',import.meta.url)));
  const expected=ragCatalog().filter(item=>item.documentId.startsWith('moa-knowledge:registered-'));
  assert.equal(expected.length,registeredEntities.length);
  for(const item of expected) {
    const doc=indexed.find(doc=>doc.documentId===item.documentId);
    assert.ok(doc); assert.equal(doc.text,item.text);assert.equal(doc.sourceUrl,item.sourceUrl);assert.equal(doc.checkedAt,item.checkedAt);
    assert.match(item.text,/현재 영업시간.*제공되지 않습니다/);
  }
  assert.deepEqual(namedKnowledgePlaceIds('부산 동백섬과 해운대해수욕장'),['public-busan-dongbaek','public-busan-haeundae']);
  assert.deepEqual(namedKnowledgePlaceIds('금수복국 해운대본점'),['catalog-busan-geumsu']);
});
