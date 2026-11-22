import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPersonalPlan, setPlanStay } from '../src/tripPlan.ts';
import { setPersonalTripDateRange } from '../src/personalTripDates.ts';

const spot = (id, kind = 'LANDMARK') => ({ id, kind, name:id, area:'부산 해운대구', address:'부산', lat:35.16, lng:129.16, image:'', photos:[], note:'', description:'', duration:'' });
const blank = (days = 1) => ({ ...buildPersonalPlan([],days,'새 여행','나'), planStage:'DRAFT' });

test('a saved empty trip gains dated empty DAYs only after choosing a range, preserving its private identity', () => {
  const source = blank(), before = structuredClone(source);
  const result = setPersonalTripDateRange(source,'2028-02-28','2028-03-01');
  assert.equal(result.id,source.id);
  assert.equal(result.days[0].dayId,source.days[0].dayId);
  assert.deepEqual(result.days.map(day=>day.date),['2028-02-28','2028-02-29','2028-03-01']);
  assert.equal(new Set(result.days.map(day=>day.dayId)).size,3);
  assert.equal(result.duration,'2박 3일');
  assert.equal(result.visibility,'PRIVATE'); assert.equal(result.planStage,'DRAFT');
  assert.equal(result.author,'나'); assert.equal(result.isMine,true);
  assert.ok(result.days.every(day=>!day.places.length&&!day.blocks.length));
  assert.equal(result.businessCandidates,undefined);
  assert.deepEqual(source,before);
});

test('only empty trips can shrink to a chosen period, and clearing dates keeps existing DAY identities', () => {
  const source = blank(4);
  const shortened = setPersonalTripDateRange(source,'2026-12-30','2026-12-31');
  assert.deepEqual(shortened.days.map(day=>day.dayId),source.days.slice(0,2).map(day=>day.dayId));
  const cleared = setPersonalTripDateRange(shortened,'');
  assert.equal(cleared.startDate,undefined); assert.equal(cleared.dateRange,'날짜 미정');
  assert.deepEqual(cleared.days.map(day=>day.date),['DAY 1','DAY 2']);
  assert.deepEqual(cleared.days.map(day=>day.dayId),shortened.days.map(day=>day.dayId));
  assert.equal(source.days.length,4);
});

test('a longer range keeps visits, photo cards and locked accommodation; shortening never silently deletes them', () => {
  const base = buildPersonalPlan([spot('해변')],2,'부산 여행','나');
  const source = setPlanStay(base,spot('예약 숙소','STAY'),base.days[0].dayId,1,true);
  const before = structuredClone(source);
  const result = setPersonalTripDateRange(source,'2026-12-01','2026-12-04');
  assert.equal(result.days.length,4);
  for (let index=0;index<source.days.length;index++) {
    assert.equal(result.days[index].dayId,source.days[index].dayId);
    assert.deepEqual(result.days[index].places,source.days[index].places);
    assert.deepEqual(result.days[index].blocks,source.days[index].blocks);
  }
  assert.equal(result.days[0].places.find(place=>place.kind==='STAY').bookingFixed,true);
  assert.throws(()=>setPersonalTripDateRange(source,'2026-12-01','2026-12-01'),/DAY 메뉴/);
  assert.deepEqual(source,before);
});

test('authored DAY text and unfilled planning slots also prevent automatic shrink without any visits', () => {
  const withStory = blank(2); withStory.days[1].story='이 날의 메모';
  const withBlock = blank(2); withBlock.days[1].blocks=[{id:'text',type:'TEXT',body:'기록'}];
  const withGap = blank(2); withGap.days[1].planningGaps=[{id:'gap',kind:'FOOD',slot:'lunch'}];
  for (const source of [withStory,withBlock,withGap]) {
    const before=structuredClone(source);
    assert.throws(()=>setPersonalTripDateRange(source,'2026-12-01','2026-12-01'),/DAY 메뉴/);
    assert.deepEqual(source,before);
  }
});

test('invalid, reversed or overlong ranges and foreign/public/trash trips cannot be changed', () => {
  const source = blank(), before=structuredClone(source);
  for(const [start,end] of [['2027-02-29',''],['2026-12-02','2026-12-01'],['2026-12-01','2026-12-31'],['','2026-12-01']]) assert.throws(()=>setPersonalTripDateRange(source,start,end));
  assert.equal(setPersonalTripDateRange(source,'2026-12-01','2026-12-30').days.length,30);
  for(const patch of [{isMine:false},{purpose:'JOURNAL'},{visibility:'PUBLIC'},{trash:{deletedAt:'2026-11-21'}}]) assert.throws(()=>setPersonalTripDateRange({...source,...patch},'2026-12-01'));
  assert.deepEqual(source,before);
});
