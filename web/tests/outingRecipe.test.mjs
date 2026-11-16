import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createEmptyState } from '../src/together/model.ts';
import { createOutingFromRecipe, OUTING_RECIPE_TITLE_LIMIT, prepareOutingRecipe } from '../src/together/outingRecipe.ts';
import { isTogetherState } from '../src/together/repository.ts';

const at = new Date('2099-04-10T00:00:00Z');
const place = (id,kind='FOOD') => ({ id,kind,name:`장소 ${id}`,area:'부산 해운대',address:`부산 ${id}`,lat:35,lng:129,image:'',description:'현재 공개 안내',duration:'1시간',note:'카탈로그 메모' });
function fixture() {
  const places=[place('a'),place('b','CAFE')], state=createEmptyState('owner','나');
  state.groups.push({id:'group',name:'가족',kind:'FAMILY',region:'부산',introduction:'',cover:'',visibility:'PRIVATE',ownerId:'owner',memberIds:['owner'],managerIds:[],archived:false,promotionPublished:false});
  const source={id:'source',title:'식사와 카페',region:'부산',duration:'2일',dateRange:'2020',status:'PUBLISHED',visibility:'PUBLIC',cover:'private-cover',summary:'private-summary',story:'private-story',tags:['old'],saves:99,author:'원저자',isMine:false,purpose:'JOURNAL',startDate:'2020-01-01',
    days:[{dayId:'old-day1',day:1,date:'2020-01-01',title:'old',story:'private-day',places:[{...places[0],visitId:'old-visit',note:'개인 메모',image:'private-photo',bookingFixed:true}],blocks:[{id:'secret',type:'TEXT',body:'개인 기록'}]},
      {dayId:'old-day2',day:2,date:'2020-01-02',title:'old2',story:'private-day2',places:[places[1]],blocks:[]}]};
  const reviewed=prepareOutingRecipe(source,places), input={requestId:'review-create',title:'우리끼리 해보기',date:'2099-04-12',consent:true};
  return {places,state,source,reviewed,input};
}
test('recipe creates a private one-off with new DAY/visit IDs and only current catalogue places',()=>{
  const {places,state,source,reviewed,input}=fixture(), before=structuredClone(source);
  const result=createOutingFromRecipe(state,'owner',reviewed,source,input,places,at), activity=state.activities[0], journey=activity.journey;
  assert.equal(result.activityId,activity.id);assert.equal(state.groups[1].temporaryRoom.purpose,'GATHERING');assert.equal(state.groups[1].visibility,'PRIVATE');
  assert.deepEqual(activity.participants,{});assert.equal(activity.meetingPoint,'');assert.deepEqual(activity.placeCandidateIds,['a','b']);assert.equal(activity.kind,'TRIP');
  assert.equal(journey.days[0].date,'2099-04-12');assert.equal(journey.days[1].date,'2099-04-13');assert.notEqual(journey.days[0].dayId,'old-day1');assert.notEqual(journey.days[0].places[0].visitId,'old-visit');
  assert.equal(journey.days[0].places[0].note,'');assert.equal(journey.days[0].places[0].bookingFixed,false);assert.equal(journey.cover,'');assert.equal(journey.story,'');
  assert.ok(!JSON.stringify(journey).includes('private'));assert.deepEqual(source,before);assert.ok(isTogetherState(state));
});
test('same reviewed request is idempotent and never adds RSVP, invites or duplicate activities',()=>{
  const f=fixture();const first=createOutingFromRecipe(f.state,'owner',f.reviewed,f.source,f.input,f.places,at);const after=structuredClone(f.state);
  assert.deepEqual(createOutingFromRecipe(f.state,'owner',f.reviewed,f.source,f.input,f.places,at),first);assert.deepEqual(f.state,after);assert.equal(f.state.invites.length,0);
  assert.throws(()=>createOutingFromRecipe(f.state,'owner',f.reviewed,f.source,{...f.input,title:'다른 제목'},f.places,at));
});
test('existing persistent group receives a separate activity without changing its originals',()=>{
  const f=fixture(), previous=structuredClone(f.state.groups[0]);
  const result=createOutingFromRecipe(f.state,'owner',f.reviewed,f.source,{...f.input,groupId:'group',date:''},f.places,at);
  assert.equal(result.groupId,'group');assert.equal(f.state.groups.length,1);assert.deepEqual(f.state.groups[0],previous);assert.equal(f.state.activities[0].journey.days[0].date,'');
});
test('source permission, trash, unreviewed candidates and vanished catalogue visits fail before mutation',()=>{
  for(const change of [source=>{source.visibility='PRIVATE';},source=>{source.trash={};},source=>{source.planStage='DRAFT';},source=>{source.businessCandidates=[{}];},source=>{source.days[0].places[0].personal=true;}]){
    const f=fixture();change(f.source);const before=structuredClone(f.state);assert.throws(()=>createOutingFromRecipe(f.state,'owner',f.reviewed,f.source,f.input,f.places,at));assert.deepEqual(f.state,before);
  }
  const f=fixture();assert.throws(()=>prepareOutingRecipe(f.source,f.places.slice(1)));
});
test('private owned completed plans can be copied only through explicit consent',()=>{
  const f=fixture();f.source.isMine=true;f.source.visibility='PRIVATE';f.source.purpose='PLAN';f.source.status='PLANNING';f.source.planStage='READY';const reviewed=prepareOutingRecipe(f.source,f.places);
  assert.throws(()=>createOutingFromRecipe(f.state,'owner',reviewed,f.source,{...f.input,consent:false},f.places,at));
  createOutingFromRecipe(f.state,'owner',reviewed,f.source,f.input,f.places,at);assert.equal(f.source.visibility,'PRIVATE');
});
test('review fingerprints bind changed public access, order and current place facts',()=>{
  for(const change of [f=>{f.source.days.reverse();},f=>{f.source.title='changed';},f=>{f.places[0].address='changed';},f=>{f.places[0].photos=[{image:'public-photo.jpg',alt:'공개 장소',caption:''}];}]){
    const f=fixture();change(f);assert.throws(()=>createOutingFromRecipe(f.state,'owner',f.reviewed,f.source,f.input,f.places,at));assert.equal(f.state.activities.length,0);
  }
});
test('destination membership, blocked/archive and single-activity spaces are rechecked',()=>{
  for(const change of [g=>{g.memberIds=[];},g=>{g.blockedMemberIds=['owner'];},g=>{g.archived=true;},g=>{g.spaceType='ACTIVITY';}]){
    const f=fixture();change(f.state.groups[0]);assert.throws(()=>createOutingFromRecipe(f.state,'owner',f.reviewed,f.source,{...f.input,groupId:'group'},f.places,at));assert.equal(f.state.activities.length,0);
  }
});
test('creation rejects invalid/past dates and unknown actor without losing existing data',()=>{
  for(const date of ['2099-02-30','2020-01-01','bad']){const f=fixture();assert.throws(()=>createOutingFromRecipe(f.state,'owner',f.reviewed,f.source,{...f.input,date},f.places,at));assert.equal(f.state.activities.length,0);}
  const f=fixture();assert.throws(()=>createOutingFromRecipe(f.state,'other',f.reviewed,f.source,f.input,f.places,at));
});

test('recipe form/domain share the one-off 80-character title limit for both destinations', () => {
  assert.equal(OUTING_RECIPE_TITLE_LIMIT, 80);
  for (const groupId of [undefined, 'group']) {
    const f = fixture(), tooLong = { ...f.input, title: '가'.repeat(81), groupId }, before = structuredClone(f.state);
    assert.throws(() => createOutingFromRecipe(f.state, 'owner', f.reviewed, f.source, tooLong, f.places, at), /80자/);
    assert.deepEqual(f.state, before);
    const result = createOutingFromRecipe(f.state, 'owner', f.reviewed, f.source, { ...tooLong, title: '가'.repeat(80) }, f.places, at);
    assert.equal(f.state.activities.find(row => row.id === result.activityId).title.length, 80);
  }
});

test('an own unfinished journal cannot start a recipe, while completed private journals and READY plans remain eligible', () => {
  for (const status of ['DRAFT', 'PLANNING']) {
    const f = fixture(); f.source.isMine = true; f.source.visibility = 'PRIVATE'; f.source.status = status;
    const before = structuredClone(f.state);
    assert.throws(() => prepareOutingRecipe(f.source, f.places));
    assert.throws(() => createOutingFromRecipe(f.state, 'owner', f.reviewed, f.source, f.input, f.places, at));
    assert.deepEqual(f.state, before);
  }
  const f = fixture(); f.source.isMine = true; f.source.visibility = 'PRIVATE';
  assert.doesNotThrow(() => prepareOutingRecipe(f.source, f.places));
  f.source.purpose = 'PLAN'; f.source.status = 'PLANNING'; f.source.planStage = 'READY';
  assert.doesNotThrow(() => prepareOutingRecipe(f.source, f.places));
});

test('one request cannot be reused for another source, re-reviewed address/photo changes or another destination', () => {
  for (const modify of [
    f => { f.source.id = 'different-private-source'; }, f => { f.places[0].address = '변경된 현재 주소'; },
    f => { f.places[0].photos = [{ image: '/new-current-photo.jpg', alt: '새 사진', caption: '' }]; },
    f => { f.input.groupId = 'group'; }, f => { f.input.date = '2099-04-13'; },
  ]) {
    const f = fixture(); createOutingFromRecipe(f.state, 'owner', f.reviewed, f.source, f.input, f.places, at);
    const saved = structuredClone(f.state); modify(f);
    const reviewed = prepareOutingRecipe(f.source, f.places);
    assert.throws(() => createOutingFromRecipe(f.state, 'owner', reviewed, f.source, f.input, f.places, at), /같은 요청/);
    assert.deepEqual(f.state, saved, 're-reviewing a changed source never returns or overwrites the previous room');
  }
});

test('opaque request IDs match reference SHA-256 for Unicode/multiblock payloads and never contain private source text', () => {
  const f = fixture(); f.source.isMine = true; f.source.visibility = 'PRIVATE';
  f.source.id = '개인-원본-식별자-🔒'; f.source.title = '공유하지 않을 제목 🔒'.repeat(8);
  const reviewed = prepareOutingRecipe(f.source, f.places), input = { ...f.input, title: '다른 공개 사본 이름', groupId: 'group', requestId: 'opaque-request_123' };
  const digest = value => createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
  const result = createOutingFromRecipe(f.state, 'owner', reviewed, f.source, input, f.places, at);
  assert.equal(result.activityId, `recipe-${digest(['owner', input.requestId])}-${digest([reviewed.version, input.title, input.date, 'group'])}`);
  assert.match(result.activityId, /^[A-Za-z0-9_-]{1,180}$/);
  assert.equal(JSON.stringify(f.state.activities).includes(f.source.title), false);
  assert.equal(JSON.stringify(f.state.activities).includes(f.source.id), false);
  assert.equal(JSON.stringify(f.state.activities).includes(reviewed.version), false);
  assert.equal(isTogetherState(f.state), true);
});

test('retry also compares the actual complete copied facts rather than trusting a matching opaque ID', () => {
  for (const mutate of [
    activity => { activity.journey.days[0].places[0].address = '사본에서 바뀐 주소'; },
    activity => { activity.journey.days[0].places[0].photos = [{ image: '/changed-copy.jpg', alt: '', caption: '' }]; },
    activity => { activity.journey.days[0].places[0].bookingFixed = true; },
    activity => { activity.journey.days[0].date = '2099-04-30'; },
    activity => { activity.journey.days[0].blocks[0].visitId = 'unrelated-visit'; },
    activity => { activity.revision++; },
  ]) {
    const f = fixture(); createOutingFromRecipe(f.state, 'owner', f.reviewed, f.source, f.input, f.places, at);
    mutate(f.state.activities[0]); const before = structuredClone(f.state);
    assert.throws(() => createOutingFromRecipe(f.state, 'owner', f.reviewed, f.source, f.input, f.places, at));
    assert.deepEqual(f.state, before);
  }
});

test('matching keys never bypass freshly revoked account or destination authority', () => {
  for (const mutate of [
    f => { f.state.groups[0].memberIds = []; }, f => { f.state.groups[0].blockedMemberIds = ['owner']; },
    f => { f.state.groups[0].archived = true; }, f => { f.state.members = []; },
  ]) {
    const f = fixture(); f.input.groupId = 'group'; createOutingFromRecipe(f.state, 'owner', f.reviewed, f.source, f.input, f.places, at);
    mutate(f); const before = structuredClone(f.state);
    assert.throws(() => createOutingFromRecipe(f.state, 'owner', f.reviewed, f.source, f.input, f.places, at));
    assert.deepEqual(f.state, before);
  }
});

test('legacy ID collisions and overflowing date ranges never mutate or duplicate records', () => {
  const f = fixture(); createOutingFromRecipe(f.state, 'owner', f.reviewed, f.source, f.input, f.places, at);
  f.state.activities[0].id = `recipe-${f.input.requestId}`;
  const before = structuredClone(f.state);
  assert.throws(() => createOutingFromRecipe(f.state, 'owner', f.reviewed, f.source, f.input, f.places, at)); assert.deepEqual(f.state, before);
  const other = fixture(); assert.throws(() => createOutingFromRecipe(other.state, 'owner', other.reviewed, other.source, { ...other.input, date: '9999-12-31' }, other.places, at));
  assert.equal(other.state.activities.length, 0); assert.equal(other.state.groups.length, 1);
});
