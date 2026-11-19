import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState, setGroupParticipation } from '../src/together/model.ts';
import { createTogetherRepository, isTogetherState, togetherStorageKey } from '../src/together/repository.ts';
import { DISCOVERY_CATALOG_VERSION } from '../src/together/discoveryExamples.ts';
import { applyActivityRepeatPreview, isActivityParticipationFields, previewActivityRepeats, selectActivityParticipation, setActivityWaitlist } from '../src/together/activityParticipation.ts';

const at = new Date('2026-11-19T10:00:00+09:00');
function fixture() {
  const state = createEmptyState('owner', '모임장');
  state.members.push(...['a', 'b', 'c'].map(id => ({ id, name: id })));
  state.groups.push({ id:'g', name:'산책 모임', kind:'HOBBY', region:'부산', introduction:'함께 걸어요.', cover:'',
    ownerId:'owner', memberIds:['owner','a','b','c'], managerIds:[], archived:false, visibility:'PRIVATE', promotionPublished:false });
  state.activities.push({ id:'one', groupId:'g', title:'토요일 산책', date:'2026-11-21', endDate:'2026-11-21', startTime:'10:00', endTime:'11:30',
    meetingPoint:'정문', description:'함께 천천히 걸어요.', kind:'MEETUP', status:'PLANNED', capacity:1, leadId:'owner', editorIds:[],
    participants:{owner:'JOINED'}, arrivedIds:['owner'], revision:1 });
  return state;
}
const select = (state, actor='a') => selectActivityParticipation(state,actor,'g','one',at);
const wait = (state, actor='a', join=true) => setActivityWaitlist(state,actor,'g','one',join,at);

test('explicit waitlist requests are ordered, idempotent and independent of attendance', () => {
  const state=fixture(); const attendance=structuredClone(state.activities[0].participants);
  wait(state,'a');wait(state,'a');wait(state,'b');
  assert.deepEqual(state.activities[0].waitlist,['a','b']);
  assert.deepEqual(state.activities[0].participants,attendance);
  assert.equal(select(state,'b').waitingPosition,2);
  assert.equal(select(state).seatOffered,false);
  assert.equal(isTogetherState(state),true);
});
test('a released seat waits for the first waiting member to explicitly confirm', () => {
  const state=fixture();wait(state,'a');wait(state,'b');
  setGroupParticipation(state,'one','owner','DECLINED');
  assert.equal(select(state).seatOffered,true);
  assert.equal(select(state).canJoin,true);
  assert.equal(select(state,'b').seatOffered,false);
  assert.equal(select(state,'b').canJoin,false);
  assert.equal(select(state,'c').canJoin,false);
  assert.equal(state.activities[0].participants.a,undefined);
  assert.throws(()=>setGroupParticipation(state,'one','c','JOINED'),/먼저 대기/);
  assert.throws(()=>setGroupParticipation(state,'one','b','JOINED'),/먼저 대기/);
  setGroupParticipation(state,'one','a','JOINED');
  assert.deepEqual(state.activities[0].waitlist,['b']);
  assert.equal(select(state,'b').seatOffered,false);
  assert.throws(()=>setGroupParticipation(state,'one','b','JOINED'),/정원/);
});
test('cancelling waiting or choosing MAYBE withdraws only the actor and reveals the next offer', () => {
  const state=fixture();wait(state,'a');wait(state,'b');
  setGroupParticipation(state,'one','owner','DECLINED');
  wait(state,'a',false);
  assert.equal(select(state,'b').seatOffered,true);
  setGroupParticipation(state,'one','b','MAYBE');
  assert.deepEqual(state.activities[0].waitlist,[]);
  assert.equal(state.activities[0].participants.owner,'DECLINED');
  const alreadyMaybe=fixture();alreadyMaybe.activities[0].participants.a='MAYBE';wait(alreadyMaybe,'a');
  setGroupParticipation(alreadyMaybe,'one','a','MAYBE');
  assert.deepEqual(alreadyMaybe.activities[0].waitlist,[]);
});
test('departed and blocked members do not hold seats or waitlist positions', () => {
  const state=fixture();wait(state,'a');wait(state,'b');
  state.groups[0].blockedMemberIds=['owner','a'];
  assert.equal(select(state,'b').seatOffered,true);
  assert.deepEqual(select(state,'b').waitingIds,['b']);
  assert.equal(select(state,'a'),null);
  assert.throws(()=>wait(state,'a'),/참여 중/);
});
test('cancelled, archived, past, foreign and absent-member waitlists cannot be written', () => {
  for (const change of [s=>s.activities[0].status='CANCELLED',s=>s.groups[0].archived=true,s=>s.activities[0].date=s.activities[0].endDate='2026-11-18',
    s=>s.groups[0].temporaryRoom={purpose:'DINNER',expiresAt:at.toISOString()}]) {
    const state=fixture();change(state);const before=structuredClone(state);
    assert.throws(()=>wait(state),/대기를 바꿀/);assert.deepEqual(state,before);
  }
  const state=fixture();
  assert.throws(()=>setActivityWaitlist(state,'a','foreign','one',true,at),/참여 중/);
  state.members=state.members.filter(row=>row.id!=='a');assert.throws(()=>wait(state),/참여 중/);
  const open=fixture();open.activities[0].capacity=5;assert.throws(()=>wait(open),/참가 여부/);
  assert.equal(select(open).canJoin,true);
});
test('repeat preview advances Korean calendar dates across the month and creates empty separate occurrences', () => {
  const state=fixture(), source=state.activities[0];
  source.memberPresentations={owner:{nickname:'산책꾼',introduction:'방 소개'}};
  source.journey={private:true};source.waitlist=['a'];source.placeCandidateIds=['venue'];source.venuePlaceId='venue';
  const before=structuredClone(state);
  const preview=previewActivityRepeats(state,'owner','g','one',{intervalDays:7,count:2},at);
  assert.deepEqual(preview.dates,[{date:'2026-11-28',endDate:'2026-11-28'},{date:'2026-12-05',endDate:'2026-12-05'}]);
  assert.deepEqual(state,before);
  const ids=applyActivityRepeatPreview(state,'owner',preview,at);
  assert.equal(ids.length,2);assert.equal(state.activities.length,3);
  for(const row of state.activities.slice(1)) {
    assert.deepEqual(row.participants,{});assert.deepEqual(row.arrivedIds,[]);assert.deepEqual(row.editorIds,[]);
    assert.equal(row.journey,undefined);assert.equal(row.memberPresentations,undefined);assert.equal(row.waitlist,undefined);
    assert.equal(row.startTime,'10:00');assert.equal(row.endTime,'11:30');assert.equal(row.capacity,1);
    assert.equal(row.venuePlaceId,'venue');assert.notEqual(row.placeCandidateIds,source.placeCandidateIds);
  }
  assert.deepEqual(applyActivityRepeatPreview(state,'owner',preview,at),ids);
  assert.equal(state.activities.length,3);
});
test('repeat creation rechecks source version, exact dates, membership and permission before mutation', () => {
  for (const change of [s=>s.activities[0].title='변경',s=>s.activities[0].revision++,s=>s.groups[0].managerIds=[],s=>s.groups[0].archived=true]) {
    const state=fixture();state.groups[0].managerIds=['a'];
    const preview=previewActivityRepeats(state,'a','g','one',{intervalDays:14,count:2},at);
    change(state);const before=structuredClone(state);
    assert.throws(()=>applyActivityRepeatPreview(state,'a',preview,at));assert.deepEqual(state,before);
  }
  const state=fixture();const preview=previewActivityRepeats(state,'owner','g','one',{intervalDays:7,count:2},at);
  preview.dates[0].date='2026-11-25';assert.throws(()=>applyActivityRepeatPreview(state,'owner',preview,at),/다시 확인/);
  assert.throws(()=>previewActivityRepeats(state,'b','g','one',{intervalDays:7,count:2},at),/담당자/);
  state.groups[0].spaceType='ACTIVITY';assert.equal(select(state,'owner').canRepeat,false);
});
test('legacy activities stay readable while malformed additions and invalid end times are rejected', () => {
  const state=fixture();assert.equal(isTogetherState(state),true);
  delete state.activities[0].endTime;assert.equal(isTogetherState(state),true);
  const row={...fixture().activities[0]};
  assert.equal(isActivityParticipationFields({...row,waitlist:['a','a']}),false);
  assert.equal(isActivityParticipationFields({...row,endTime:'09:59'}),false);
  assert.equal(isActivityParticipationFields({...row,endTime:'11:30',date:'2026-02-30',endDate:'2026-02-30'}),false);
  assert.equal(isActivityParticipationFields({...row,endTime:'09:59',endDate:'2026-11-22'}),true);
  assert.equal(isActivityParticipationFields({...row,repeat:{seriesId:'series',sourceActivityId:'one',index:1,count:2,intervalDays:7}}),true);
  assert.equal(isActivityParticipationFields({...row,repeat:{seriesId:'series',sourceActivityId:'one',index:1,count:2,intervalDays:'7'}}),false);
  const invalid=fixture();invalid.activities[0].endTime='09:00';
  assert.equal(select(invalid),null);
  assert.throws(()=>previewActivityRepeats(invalid,'owner','g','one',{intervalDays:7,count:2},at),/시간과 참가/);
});

test('repeat and waitlist persist atomically without replacing previous bytes after a failed save', () => {
  const state=fixture();state.discoveryCatalogVersion=DISCOVERY_CATALOG_VERSION;
  const key=togetherStorageKey('owner'),entries=new Map([[key,JSON.stringify(state)],['spotlog.web.journeys.v4','private-source']]);
  let failed=false;
  const disk={getItem:name=>entries.get(name)??null,setItem:(name,value)=>{if(failed)throw new Error('quota');entries.set(name,value);}};
  const repo=createTogetherRepository('owner','모임장',[],disk);
  assert.equal(repo.getError(),null);
  assert.equal(repo.update(draft=>wait(draft,'a')),true);
  const preview=previewActivityRepeats(repo.getSnapshot(),'owner','g','one',{intervalDays:7,count:2},at);
  const previous=repo.getSnapshot(),raw=disk.getItem(key);failed=true;
  assert.equal(repo.update(draft=>applyActivityRepeatPreview(draft,'owner',preview,at)),false);
  assert.equal(repo.getSnapshot(),previous);assert.equal(disk.getItem(key),raw);
  failed=false;assert.equal(repo.update(draft=>applyActivityRepeatPreview(draft,'owner',preview,at)),true);
  const reopened=createTogetherRepository('owner','모임장',[],disk).getSnapshot();
  assert.equal(isTogetherState(reopened),true);assert.deepEqual(reopened.activities[0].waitlist,['a']);
  assert.equal(reopened.activities.filter(row=>row.repeat?.seriesId===preview.seriesId).length,2);
  assert.equal(reopened.activities[1].endTime,'11:30');assert.equal(disk.getItem('spotlog.web.journeys.v4'),'private-source');
});
