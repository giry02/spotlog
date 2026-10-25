import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({resolve(specifier, context, next) {
  if (/\/lib\/[^/]+\.ts$/.test(context.parentURL ?? '') && specifier.startsWith('./') && !/\.[a-z]+$/.test(specifier)) return next(specifier+'.ts',context);
  return next(specifier,context);
}});
const { initialTrip } = await import('../lib/trip-engine.ts');
const {budgetSummary,itineraryChecks,comparisonRows,visibleChatCandidates,chatEntityDetail,chatHelpGroups}=await import('../lib/trip-chat-features.ts');
const visit=(id,entityId,kind='place',day=1,extra={})=>({id,entityId,kind,day,anchorId:'public-busan-haeundae',label:'방문',locked:false,...extra});
const state=(plan, extra={})=>({...initialTrip(),region:'부산',days:2,anchorId:'public-busan-haeundae',plan,...extra});
test('unknown real prices cannot enter totals, become free, or produce a budget pass',()=>{
  const s=state([visit('meal','catalog-busan-geumsu','food'),visit('coffee','catalog-busan-bibibidang','cafe'),visit('hotel','catalog-busan-westin','stay'),visit('shop','public-busan-gukje','shop')]);
  const before=structuredClone(s), budget=budgetSummary(s),checks=itineraryChecks(s);
  assert.deepEqual(budget.lines,[]);assert.equal(budget.total,0);assert.equal(budget.canConfirmBudget,false);
  assert.equal(budget.unpricedCount,4);assert.equal(budget.hasUnpricedItems,true);assert.doesNotMatch(budget.totalLabel,/0원/);
  for(const row of s.plan){assert.ok(budget.excluded.some(x=>x.visitId===row.id&&/미확인/.test(x.reason)));assert.ok(checks.some(c=>c.id===`price-unknown-${row.id}`&&c.day===row.day));}
  assert.ok(!checks.some(c=>c.id==='supported-pass'));assert.deepEqual(s,before);
});
test('mixed sample/unknown prices show only the sample subtotal with the missing costs explicitly retained',()=>{
  const budget=budgetSummary(state([visit('sample','sf-rice','food'),visit('unknown','catalog-seoul-cite','cafe'),visit('skipped','catalog-seoul-kihoo','food',1,{status:'skipped'})],{region:'서울',budgetPeople:3}));
  assert.equal(budget.lines.length,1);assert.equal(budget.total,33000);assert.equal(budget.canConfirmBudget,false);
  assert.match(budget.totalLabel,/33,000원.*미확인/);assert.equal(budget.unpricedCount,1);
  assert.ok(budget.excluded.some(row=>row.visitId==='skipped'&&/건너뛴/.test(row.reason)));
});
test('registered SHOP comparisons keep identity, verified address and straight distance without invented walk minutes',()=>{
  const s=state([],{stage:'compare',comparisonIds:['public-busan-gukje','public-busan-jagalchi']});
  const rows=comparisonRows(s);
  assert.equal(rows.length,2);assert.ok(rows.every(row=>row.kind==='shop'&&row.location.includes('부산')&&row.price==='가격 미확인'));
  assert.ok(rows.every(row=>/직선.*km.*이동시간 미조회/.test(row.walk)&&!/도보\s*0|분 예시/.test(row.walk)));
  assert.ok(visibleChatCandidates(s).every(row=>row.kind==='shop'));
  const d=chatEntityDetail({...s,detailId:'public-busan-gukje'});assert.equal(d.kind,'상점');assert.equal(d.registered,true);assert.ok(d.photos.length);
});
test('only explicit start plus positive duration creates overlap checks, preserving exact visit and DAY targets',()=>{
  const s=state([visit('a','public-busan-haeundae','place',1,{time:'10:00',durationMinutes:90}),visit('b','catalog-busan-geumsu','food',1,{time:'11:00',durationMinutes:30}),visit('c','catalog-busan-bibibidang','cafe',1,{time:'11:30',durationMinutes:60}),visit('untimed','public-busan-dongbaek','place',1,{time:'10:30'}),visit('zero','public-busan-songdo','place',1,{time:'10:30',durationMinutes:0})]);
  const before=structuredClone(s), overlaps=itineraryChecks(s).filter(c=>c.id.startsWith('time-overlap-'));
  assert.equal(overlaps.length,1);assert.equal(overlaps[0].visitId,'b');assert.equal(overlaps[0].day,1);assert.equal(overlaps[0].focus,'time');
  assert.deepEqual(overlaps[0].relatedVisitIds,['a','b']);assert.match(overlaps[0].description,/이동시간을 더하지 않고/);assert.deepEqual(s,before);
});
test('midnight overlap is checked across DAY boundaries, while equal endpoints, skipped and invalid times do not invent conflicts',()=>{
  const plan=[visit('late','public-busan-haeundae','place',1,{time:'23:30',durationMinutes:120}),visit('next','public-busan-dongbaek','place',2,{time:'00:30',durationMinutes:30}),visit('after','catalog-busan-bibibidang','cafe',2,{time:'01:30',durationMinutes:60}),visit('skip','catalog-busan-geumsu','food',2,{time:'00:20',durationMinutes:30,status:'skipped'}),visit('invalid','public-busan-songdo','place',2,{time:'25:00',durationMinutes:60})];
  const overlaps=itineraryChecks(state(plan)).filter(c=>c.focus==='time');
  assert.equal(overlaps.length,1);assert.equal(overlaps[0].visitId,'next');assert.equal(overlaps[0].day,2);
});
test('location warnings never borrow anchors for sample or unknown booked stays, and verified real businesses are mapped',()=>{
  const checks=itineraryChecks(state([visit('real','catalog-busan-geumsu','food'),visit('sample','hj-rice','food'),visit('booking',null,'stay',1,{locked:true})]));
  assert.ok(!checks.some(c=>c.id==='location-unknown-real'));
  assert.ok(checks.some(c=>c.id==='location-unknown-sample'&&c.focus==='location'&&c.visitId==='sample'));
  assert.ok(checks.some(c=>c.id==='location-unknown-booking'&&c.day===1));
});
test('help exposes new metadata, seven-day planning, candidate confirmation, nights, trash and native app entries',()=>{
  const examples=chatHelpGroups.flatMap(group=>group.examples).join('\n');
  for(const pattern of [/7일/,/시작일/,/체류시간/,/메모/,/후보.*확정|선택한 후보를 일정에 확정/,/2박/,/복사/,/휴지통/,/복원/,/Spotlog.*화면/])assert.match(examples,pattern);
});
