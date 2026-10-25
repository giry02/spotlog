import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({resolve(specifier,context,next){if(context.parentURL?.includes('/lib/')&&specifier.startsWith('./')&&!/\.[a-z]+$/.test(specifier))return next(specifier+'.ts',context);return next(specifier,context);}});
const {createTripSession,currentTrip}=await import('../lib/trip-engine.ts');
const {tripShareText,entityShareText,entityShareInfo,shareDayDate}=await import('../lib/trip-sharing.ts');
const {registeredBusinesses}=await import('../lib/registered-catalog.ts');
const fixture=()=>({...currentTrip(createTripSession()),region:'부산',days:2,title:'내 여행',startDate:'2026-12-31',plan:[
  {id:'a',day:1,kind:'place',label:'오전',entityId:'hyeopjae',anchorId:'hyeopjae',time:'10:30',durationMinutes:90,note:'개인 주차 메모'},
  {id:'b',day:1,kind:'food',label:'점심',entityId:'hj-rice',anchorId:'hyeopjae'},
  {id:'c',day:2,kind:'place',label:'오전',entityId:'osulloc',anchorId:'osulloc'},
]});
test('DAY share keeps only chosen DAY, local calendar rollover and itinerary order',()=>{
  const state=fixture(),before=JSON.stringify(state),text=tripShareText(state,{kind:'day',day:1});
  assert.ok(text.includes('DAY 1 · 2026-12-31'));assert.ok(text.indexOf('협재해변')<text.indexOf('바다 앞 한상'));
  assert.ok(!text.includes('오설록'));assert.ok(!text.includes('DAY 2'));assert.equal(JSON.stringify(state),before);
  assert.ok(tripShareText(state,{kind:'day',day:2}).includes('2027-01-01'));
});
test('personal notes are opt in and unrelated account or reservation fields never enter text',()=>{
  const state={...fixture(),accountId:'PRIVATE-ACCOUNT',reservationToken:'PRIVATE-RESERVATION'};
  assert.ok(!tripShareText(state).includes('개인 주차 메모'));assert.ok(tripShareText(state,undefined,{includeNotes:true}).includes('개인 주차 메모'));
  for(const secret of ['PRIVATE-ACCOUNT','PRIVATE-RESERVATION'])assert.ok(!tripShareText(state,undefined,{includeNotes:true}).includes(secret));
});
test('fictional business sharing never borrows anchor address or maps',()=>{
  const info=entityShareInfo('hj-rice');assert.equal(info.sample,true);assert.equal(info.address,'');assert.equal(info.links,null);
  const text=entityShareText('hj-rice');assert.match(text,/가상 체험/);assert.ok(!text.includes('https://'));assert.ok(!text.includes('0원'));
});
test('approved business shares its own address and map identity, with no price invention',()=>{
  const business=registeredBusinesses.find(p=>p.kind==='FOOD');const info=entityShareInfo(business.id),text=entityShareText(business.id);
  assert.equal(info.address,business.address);assert.equal(info.sample,false);assert.ok(text.includes(business.name));assert.ok(text.includes(business.address));
  assert.ok(text.includes('https://map.naver.com/'));assert.ok(!text.includes('0원'));
});
test('unknown entity and out of range DAY never fall back to another destination or whole trip',()=>{
  assert.equal(entityShareInfo('unverified-user-place'),null);assert.throws(()=>entityShareText('unverified-user-place'));
  for(const day of [0,3,1.5])assert.throws(()=>tripShareText(fixture(),{kind:'day',day}));
  assert.equal(shareDayDate('2026-02-30',1),'');
});
