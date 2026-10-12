import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyContent } from '../src/admin/content.ts';
import { previewImport, updateImportRegion } from '../src/admin/csv.ts';
import { makeRegionSeed } from '../src/admin/regions.ts';
import { executeAdminCommand } from '../src/admin/domain.ts';
import { nearbyPlaces } from '../src/admin/selectors.ts';
import { makeAiSeed } from '../src/admin/aiSeed.ts';
import { makeOpsSeed } from '../src/admin/opsSeed.ts';

test('CSV preview accepts spaced headers and matches trimmed existing place identities', () => {
  const existing = { ...emptyContent(), name: ' 기존 업체 ', address: ' 기존 주소 ' };
  const rows = previewImport(' name , kind , area , address \n기존 업체,FOOD,부산,기존 주소\n새 업체,CAFE,부산,새 주소', [existing]);
  assert.equal(rows[0].duplicate,true);
  assert.equal(rows[1].issues.length,0);
  assert.throws(() => previewImport('name,kind,area,address,name\nA,FOOD,부산,주소,B',[]), /중복/);
  assert.throws(() => previewImport('name,kind,area,address\n',[]), /행이 없/);
});

test('CSV region correction rechecks unavailable regions without clearing unrelated issues', () => {
  const regions = makeRegionSeed(); regions.find(region => region.regionId === 'kr-busan').enabled = false;
  const rows = previewImport('name,kind,area,address,regionId\n새 업체,FOOD,부산,새 주소,unknown\n종류 오류,UNKNOWN,부산,다른 주소,kr-busan',[],'',regions);
  assert.match(rows[0].issues.join(' '),/등록 지역/);
  assert.match(rows[1].issues.join(' '),/사용 중지/);
  const corrected = updateImportRegion(rows[0],'kr-busan-haeundae',regions);
  assert.equal(corrected.issues.length,0);
  assert.equal(corrected.content.location.verified,false);
  assert.equal(corrected.content.rights.display,false);
  const kindUnresolved = updateImportRegion(rows[1],'kr-busan-haeundae',regions);
  assert.deepEqual(kindUnresolved.issues,['종류 확인 필요']);
  assert.equal(rows[0].content.regionId,'unknown');
});

const actor = {operatorId:'operator-admin',name:'검수 관리자',role:'ADMIN'};
const now = '2026-10-09T00:00:00.000Z';
function place(placeId,kind,lat = 35.161) {
  const draft = emptyContent(kind);
  Object.assign(draft,{name:placeId,area:'부산',address:placeId+' 검수 주소',description:'검수용 장소',provider:'검수',sourceUrl:'https://example.org/source',checkedAt:'2026-10-09'});
  draft.location = {lat,lng:129.16,verified:true,reference:'검수 좌표',sourceUrl:draft.sourceUrl,checkedAt:draft.checkedAt};
  draft.rights = {display:true,store:true,modify:false,ai:false};
  return {placeId,revision:1,state:'PUBLISHED',draft,published:structuredClone(draft),revoked:false,updatedAt:now};
}
function seed() {
  return {schemaVersion:1,revision:1,places:[place('anchor','LANDMARK',35.16),place('food-a','FOOD'),place('food-b','FOOD',35.162),place('food-c','FOOD',35.163),place('cafe','CAFE')],nearbyOverrides:[],ai:makeAiSeed(),ops:makeOpsSeed(),audit:[],processedCommands:[]};
}
const run = (state,businessPlaceId,mode='FEATURED',order) => executeAdminCommand(state,{kind:'place.nearby',payload:{anchorPlaceId:'anchor',businessPlaceId,mode,...(order === undefined ? {} : {order})},expectedRevision:state.revision,idempotencyKey:crypto.randomUUID()},actor,now).state;
const foodOrder = state => nearbyPlaces(state,'anchor','FOOD',3).filter(candidate => candidate.override?.mode === 'FEATURED').map(candidate => candidate.record.placeId);

test('nearby recommendations move in both directions without rank ties or affecting other business kinds', () => {
  let state = seed();
  for (const id of ['food-a','food-b','food-c','cafe']) state = run(state,id);
  assert.deepEqual(foodOrder(state),['food-a','food-b','food-c']);
  assert.deepEqual(state.nearbyOverrides.filter(value => value.businessPlaceId.startsWith('food')).map(value => value.order),[0,1,2]);
  state = run(state,'food-c','FEATURED',0);
  assert.deepEqual(foodOrder(state),['food-c','food-a','food-b']);
  state = run(state,'food-a','FEATURED',2);
  assert.deepEqual(foodOrder(state),['food-c','food-b','food-a']);
  state = run(state,'food-b','DEFAULT');
  state = run(state,'food-b');
  assert.deepEqual(foodOrder(state),['food-c','food-a','food-b']);
  assert.equal(state.nearbyOverrides.find(value => value.businessPlaceId === 'cafe').order,0);
  assert.deepEqual(nearbyPlaces(state,'anchor','FOOD',3).map(candidate => candidate.override.order),[0,1,2]);
});

test('legacy sparse recommendation orders are normalized and closed businesses stay ineligible', () => {
  let state = seed();
  state.nearbyOverrides = ['food-a','food-b','food-c'].map((businessPlaceId,index) => ({anchorPlaceId:'anchor',businessPlaceId,mode:'FEATURED',order:index === 0 ? -2 : 11}));
  state = run(state,'food-c','FEATURED',1);
  assert.deepEqual(foodOrder(state),['food-a','food-c','food-b']);
  state.places.find(value => value.placeId === 'food-c').published.operation = 'CLOSED';
  assert.throws(() => run(state,'food-c','FEATURED',0),/공개·영업·좌표·거리/);
  assert.deepEqual(foodOrder(state),['food-a','food-b']);
});
