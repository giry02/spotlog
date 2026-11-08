import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { challengeCanClose, challengeIsFinished, challengeProgress, challengeTemplates, challengeToday, CHALLENGE_PHOTO_MAX_BYTES, closeRoomChallenge, createRoomChallenge, certifyRoomChallenge, getChallengeContext, isChallengePhoto, isTogetherChallenge, joinRoomChallenge, leaveRoomChallenge, selectRoomChallenges } from '../src/together/challenges.ts';

const at = new Date('2026-11-08T03:00:00Z');
const group = { id:'g',name:'우리 모임',kind:'FAMILY',region:'부산',introduction:'',cover:'',visibility:'PRIVATE',ownerId:'owner',memberIds:['owner','me','friend'],managerIds:['manager'],archived:false,promotionPublished:false };
const scope = { groupId:'g' };
const activity = { id:'a',groupId:'g',title:'오늘 모임',date:'2026-11-08',endDate:'2026-11-08',meetingPoint:'',description:'',status:'PLANNED',leadId:'owner',editorIds:[],participants:{},arrivedIds:[],revision:1 };
const input = (extra={}) => ({ id:'challenge-one',template:'WALK',title:'같이 산책',description:'오늘 걸은 이야기',startDate:'2026-11-08',endDate:'2026-11-22',frequency:'WEEKLY',weeklyTarget:3,...extra });
function state() { const value=createEmptyState('owner','모임장'); value.members.push({id:'me',name:'나'},{id:'friend',name:'친구'},{id:'manager',name:'운영진'});value.groups.push(structuredClone(group));value.activities.push(structuredClone(activity));return value; }
function created(extra={},writeScope=scope) { const value=state();const id=createRoomChallenge(value,'owner',writeScope,input(extra),at);return {value,id,challenge:value.challenges[0]}; }

test('templates create one exact-room challenge without joining, sending messages, changing trips or RSVP',()=>{
 assert.deepEqual(challengeTemplates.map(item=>item.id),['WALK','READING','FOOD','TRAVEL_PHOTO','CUSTOM']);
 const value=state();const before=structuredClone(value);const id=createRoomChallenge(value,'me',scope,input(),at);
 assert.equal(id,'challenge-one');assert.equal(isTogetherChallenge(value.challenges[0]),true);assert.deepEqual(value.challenges[0].participantIds,[]);
 const {challenges,...rest}=value;assert.deepEqual(rest,before);assert.equal(challenges[0].createdBy,'me');
 assert.deepEqual(selectRoomChallenges(value,'friend',scope,at).map(item=>item.id),[id]);
 assert.deepEqual(selectRoomChallenges(value,'friend',{groupId:'g',activityId:'a'},at),[]);
});
test('create retries reuse an exact stable request and reject same-id foreign scope, author or content without mutation',()=>{
 const {value,id}=created();const before=structuredClone(value);
 assert.equal(createRoomChallenge(value,'owner',scope,input(),at),id);assert.deepEqual(value,before);
 for(const action of [()=>createRoomChallenge(value,'me',scope,input(),at),()=>createRoomChallenge(value,'owner',scope,input({title:'다른 도전'}),at),()=>createRoomChallenge(value,'owner',{groupId:'g',activityId:'a'},input({endDate:'2026-11-08'}),at)]) {assert.throws(action);assert.deepEqual(value,before);}
});
test('voluntary join/leave is idempotent and preserves certifications; rejoining cannot certify twice today',()=>{
 const {value,id,challenge}=created();
 assert.throws(()=>certifyRoomChallenge(value,'me',scope,id,{text:'걸었어요'},at),/참가/);
 joinRoomChallenge(value,'me',scope,id,at);const revision=challenge.revision;joinRoomChallenge(value,'me',scope,id,at);assert.equal(challenge.revision,revision);
 certifyRoomChallenge(value,'me',scope,id,{text:'걸었어요'},at);leaveRoomChallenge(value,'me',scope,id,at);assert.equal(challenge.certifications.length,1);assert.deepEqual(challenge.participantIds,[]);
 joinRoomChallenge(value,'me',scope,id,at);assert.throws(()=>certifyRoomChallenge(value,'me',scope,id,{text:'한 번 더'},at),/이미/);assert.equal(challenge.certifications.length,1);
 assert.equal(isTogetherChallenge(challenge),true);
});
test('daily certification follows Korea midnight and weekly target resets Monday without inventing scores',()=>{
 const {value,id,challenge}=created();joinRoomChallenge(value,'me',scope,id,at);
 const sunday=new Date('2026-11-08T14:59:59Z'), monday=new Date('2026-11-08T15:00:00Z');
 assert.equal(challengeToday(sunday),'2026-11-08');assert.equal(challengeToday(monday),'2026-11-09');
 certifyRoomChallenge(value,'me',scope,id,{text:'일요일 산책'},sunday);const first=challengeProgress(challenge,'me',sunday);
 assert.equal(first.weekStart,'2026-11-02');assert.equal(first.weeklyCount,1);assert.equal(first.achieved,false);
 certifyRoomChallenge(value,'me',scope,id,{text:'월요일 산책'},monday);const next=challengeProgress(challenge,'me',monday);
 assert.equal(next.weekStart,'2026-11-09');assert.equal(next.weeklyCount,1);assert.equal(next.totalCount,2);assert.equal(challengeProgress(challenge,'friend',monday).totalCount,0);
 assert.equal('rank' in next,false);assert.equal('score' in next,false);
});
test('all mutations revalidate current membership, blocked/archive state, exact activity scope and deadline before write',()=>{
 const cases=[value=>value.groups[0].memberIds=value.groups[0].memberIds.filter(id=>id!=='me'),value=>value.groups[0].blockedMemberIds=['me'],value=>value.groups[0].archived=true];
 for(const alter of cases){const {value,id}=created();alter(value);const before=structuredClone(value);
  for(const action of [()=>joinRoomChallenge(value,'me',scope,id,at),()=>leaveRoomChallenge(value,'me',scope,id,at),()=>certifyRoomChallenge(value,'me',scope,id,{text:'기록'},at),()=>closeRoomChallenge(value,'me',scope,id,at)]) {assert.throws(action);assert.deepEqual(value,before);}}
 for(const status of ['CANCELLED','COMPLETED']){const local={groupId:'g',activityId:'a'};const {value,id}=created({endDate:'2026-11-08'},local);value.activities[0].status=status;const before=structuredClone(value);assert.throws(()=>joinRoomChallenge(value,'me',local,id,at));assert.deepEqual(value,before);}
 const {value,id}=created();assert.throws(()=>joinRoomChallenge(value,'me',{groupId:'g',activityId:'a'},id,at));
 const local={groupId:'g',activityId:'a'};const item=created({endDate:'2026-11-08'},local);assert.throws(()=>joinRoomChallenge(item.value,'me',local,item.id,new Date('2026-11-09T00:00:00Z')));
 item.value.activities[0].groupId='other';assert.throws(()=>selectRoomChallenges(item.value,'me',local,at));
});
test('challenge creation validates exact dates, bounded period, weekly target and parent appointment dates atomically',()=>{
 for(const extra of [{startDate:'2026-02-30'},{startDate:'2026-11-07'},{endDate:'2026-11-07'},{endDate:'2028-01-01'},{weeklyTarget:0},{weeklyTarget:8},{weeklyTarget:1.5},{frequency:'DAILY'},{title:' '},{template:'UNKNOWN'}]) {const value=state(),before=structuredClone(value);assert.throws(()=>createRoomChallenge(value,'me',scope,input(extra),at));assert.deepEqual(value,before);}
 assert.throws(()=>createRoomChallenge(state(),'me',{groupId:'g',activityId:'a'},input(),at),/기간/);
 const value=state();value.groups[0].spaceType='ACTIVITY';assert.throws(()=>getChallengeContext(value,'me',scope,at));
});
test('only current creator/manager may close and closed or expired records stay readable without new participation/certification',()=>{
 const {value,id,challenge}=created();joinRoomChallenge(value,'me',scope,id,at);certifyRoomChallenge(value,'me',scope,id,{text:'남긴 인증'},at);
 assert.equal(challengeCanClose(value,'friend',challenge),false);assert.throws(()=>closeRoomChallenge(value,'friend',scope,id,at));
 closeRoomChallenge(value,'owner',scope,id,at);const revision=challenge.revision;closeRoomChallenge(value,'owner',scope,id,at);assert.equal(challenge.revision,revision);
 assert.equal(challengeIsFinished(challenge,at),true);assert.throws(()=>joinRoomChallenge(value,'friend',scope,id,at));assert.throws(()=>certifyRoomChallenge(value,'me',scope,id,{text:'추가'},at));
 assert.equal(selectRoomChallenges(value,'me',scope,at)[0].certifications[0].text,'남긴 인증');assert.equal(isTogetherChallenge(challenge),true);
 const expired=created({endDate:'2026-11-08'});assert.equal(challengeIsFinished(expired.challenge,new Date('2026-11-09T00:00:00Z')),true);
 closeRoomChallenge(expired.value,'owner',scope,expired.id,new Date('2026-11-09T00:00:00Z'));assert.equal(expired.challenge.closed,true);
});
test('certification cannot be backdated, precede challenge start or exceed the deadline and never clears existing originals on failure',()=>{
 const {value,id}=created({startDate:'2026-11-09'});joinRoomChallenge(value,'me',scope,id,at);const before=structuredClone(value);
 assert.throws(()=>certifyRoomChallenge(value,'me',scope,id,{text:'미리 인증'},at));assert.deepEqual(value,before);
 assert.throws(()=>certifyRoomChallenge(value,'me',scope,id,{text:'늦은 인증'},new Date('2026-11-23T00:00:00Z')));assert.deepEqual(value,before);
});
test('optional local photo accepts only bounded raster data, keeps a snapshot and never writes an album item',()=>{
 const photo={name:'사진.png',mime:'image/png',size:3,dataUrl:'data:image/png;base64,YWJj'};
 assert.equal(isChallengePhoto(photo),true);
 for(const value of [{...photo,mime:'image/svg+xml',dataUrl:'data:image/svg+xml;base64,YWJj'},{...photo,dataUrl:'https://example.com/image.png'},{...photo,size:4},{...photo,size:CHALLENGE_PHOTO_MAX_BYTES+1},{...photo,dataUrl:'data:image/png;base64,!!!!'},{...photo,secret:'private'}]) assert.equal(isChallengePhoto(value),false);
 const {value,id,challenge}=created();joinRoomChallenge(value,'me',scope,id,at);const originalMedia=structuredClone(value.media);
 certifyRoomChallenge(value,'me',scope,id,{text:'직접 다녀왔어요',photo},at);photo.name='바뀐 이름';assert.equal(challenge.certifications[0].photo.name,'사진.png');assert.deepEqual(value.media,originalMedia);
 assert.equal(isTogetherChallenge(challenge),true);
});
test('persisted challenge validator rejects unknown private fields, duplicate dates/IDs, malformed photos and invalid records',()=>{
 const {value,id,challenge}=created();joinRoomChallenge(value,'me',scope,id,at);certifyRoomChallenge(value,'me',scope,id,{text:'오늘 기록'},at);
 for(const mutate of [copy=>copy.secret='private',copy=>copy.certifications.push({...copy.certifications[0],id:'different'}),copy=>copy.participantIds.push('me'),copy=>copy.certifications[0].date='2026-02-30',copy=>copy.certifications[0].createdAt='invalid',copy=>copy.certifications[0].photo={url:'https://example.com/private'},copy=>copy.weeklyTarget=10,copy=>copy.closed=true,copy=>copy.closedAt=at.toISOString()]) {const copy=structuredClone(challenge);mutate(copy);assert.equal(isTogetherChallenge(copy),false);}
 assert.equal(isTogetherChallenge(null),false);assert.equal(isTogetherChallenge({}),false);assert.equal(isTogetherChallenge(challenge),true);
});
test('photo validation accepts the exact five-megabyte boundary without recursion and rejects the next byte',()=>{
 const photo={name:'경계.png',mime:'image/png',size:CHALLENGE_PHOTO_MAX_BYTES,dataUrl:`data:image/png;base64,${Buffer.alloc(CHALLENGE_PHOTO_MAX_BYTES).toString('base64')}`};
 assert.equal(isChallengePhoto(photo),true);assert.equal(isChallengePhoto({...photo,size:CHALLENGE_PHOTO_MAX_BYTES+1}),false);
});
