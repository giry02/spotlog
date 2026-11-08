import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState, roomIdForActivity, roomIdForGroup } from '../src/together/model.ts';
import { readChatEntity, shareChatEntity } from '../src/together/chatEntities.ts';
import { createRoomGame, getRoomGames } from '../src/together/roomGames.ts';
import { createRoomChallenge, joinRoomChallenge, certifyRoomChallenge, selectRoomChallenges } from '../src/together/challenges.ts';
import { selectAssistantMessages } from '../src/together/activityAssistant.ts';
import { createChatDigest, projectChatDigest, selectChatDigestMessages } from '../src/together/chatDigest.ts';
import { createTogetherRepository, isTogetherState, togetherStorageKey } from '../src/together/repository.ts';
import { DISCOVERY_CATALOG_VERSION } from '../src/together/discoveryExamples.ts';

const at = new Date('2999-11-07T03:00:00Z');
const groupScope = { groupId:'g' }, activityScope = { groupId:'g',activityId:'a' };
const groupRoom = roomIdForGroup('g'), activityRoom = roomIdForActivity('a');
function fixture() {
  const value = createEmptyState('owner','모임장'); value.discoveryCatalogVersion = DISCOVERY_CATALOG_VERSION;
  value.members.push({id:'me',name:'나'},{id:'other',name:'다른 모임원'},{id:'outsider',name:'외부인'});
  value.groups.push({id:'g',name:'공개 소개가 있는 모임',kind:'HOBBY',region:'부산',introduction:'공개 소개',cover:'',visibility:'PUBLIC',ownerId:'owner',memberIds:['owner','me','other'],managerIds:[],archived:false,promotionPublished:true});
  value.groups.push({...structuredClone(value.groups[0]),id:'foreign',name:'다른 모임',memberIds:['outsider'],ownerId:'outsider'});
  value.activities.push({id:'a',groupId:'g',title:'기간이 있는 약속',date:'2999-11-07',endDate:'2999-11-20',meetingPoint:'비공개 장소',description:'',status:'PLANNED',leadId:'owner',editorIds:[],participants:{me:'MAYBE'},arrivedIds:[],revision:1});
  value.activities.push({...structuredClone(value.activities[0]),id:'another'});
  value.messages.push({id:'human-group',roomId:groupRoom,authorId:'me',body:'사람이 직접 쓴 모임 대화',createdAt:'2026-11-01T03:00:00Z'},
    {id:'human-activity',roomId:activityRoom,authorId:'other',body:'사람이 직접 쓴 약속 대화',createdAt:'2026-11-01T03:00:00Z'});
  return value;
}
const gameInput = id => ({id,type:'WHEEL',title:'함께 고르는 점심',options:['국수','덮밥']});
const challengeInput = id => ({id,template:'WALK',title:'함께 걷기',description:'각자 걸은 이야기',startDate:'2999-11-07',endDate:'2999-11-20',frequency:'WEEKLY',weeklyTarget:3});
function addEntities(value, scope, suffix='') {
  const game = createRoomGame(value,'me',scope,gameInput(`game${suffix}`),at,()=>0);
  const challengeId = createRoomChallenge(value,'me',scope,challengeInput(`challenge${suffix}`),at);
  return [shareChatEntity(value,'me',{type:'GAME',id:game.id},{body:'확정된 놀이 결과'}),
    shareChatEntity(value,'me',{type:'CHALLENGE',id:challengeId},{body:'참가 여부를 직접 고르는 도전'})];
}
function rejectsUnchanged(value, callback) { const before=structuredClone(value);assert.throws(callback);assert.deepEqual(value,before); }
function memoryDisk(state) {
  const key=togetherStorageKey('me'), entries=new Map([[key,JSON.stringify(state)],['spotlog.web.journeys.v4','private-original'],['spotlog.admin.store','admin-original']]);
  let fail=false;
  return {key,entries,getItem:name=>entries.get(name)??null,setItem:(name,raw)=>{if(fail)throw new Error('quota');entries.set(name,raw);},setFail:value=>{fail=value;}};
}

test('GAME and CHALLENGE cards resolve only their exact group/activity room and deduplicate explicit sharing',()=>{
  const value=fixture(), groupCards=addEntities(value,groupScope,'-group'), activityCards=addEntities(value,activityScope,'-activity');
  for(const [cards,scope,room] of [[groupCards,groupScope,groupRoom],[activityCards,activityScope,activityRoom]]) {
    for(const card of cards) {
      assert.equal(card.roomId,room);const projection=readChatEntity(value,'owner',room,card);
      assert.equal(projection.type,card.entity.type);assert.equal(projection.value.id,card.entity.id);
      const before=structuredClone(value);
      assert.equal(shareChatEntity(value,'owner',card.entity,{body:card.body}),card);assert.deepEqual(value,before);
      for(const wrong of [room===groupRoom?activityRoom:groupRoom,roomIdForActivity('another'),roomIdForGroup('foreign')]) {
        assert.equal(readChatEntity(value,'me',wrong,{...card,roomId:wrong}),null);
        rejectsUnchanged(value,()=>shareChatEntity(value,'me',card.entity,{roomId:wrong}));
      }
      assert.equal(readChatEntity(value,'outsider',room,card),null);
      rejectsUnchanged(value,()=>shareChatEntity(value,'outsider',card.entity));
    }
  }
  assert.equal(isTogetherState(value),true);assert.equal(value.messages.filter(item=>item.entity).length,4);
});

test('reopening persisted game cards or retrying the same creation never redraws, reranks or creates another round',()=>{
  const value=fixture();let draws=0;
  const game=createRoomGame(value,'me',groupScope,gameInput('fixed-result'),at,()=>{draws++;return 1;});
  const card=shareChatEntity(value,'me',{type:'GAME',id:game.id});const before=structuredClone(value);
  for(let index=0;index<4;index++) {
    assert.deepEqual(readChatEntity(value,'me',groupRoom,card).value.result,game.result);
    assert.deepEqual(getRoomGames(value,'owner',groupScope,at)[0].result,game.result);
  }
  const retry=createRoomGame(value,'me',groupScope,gameInput('fixed-result'),at,()=>{throw new Error('must not draw');});
  assert.deepEqual(retry.result,game.result);assert.equal(draws,1);assert.deepEqual(value,before);
  const detached=getRoomGames(value,'me',groupScope,at);detached[0].title='다른 제목';assert.equal(value.games[0].title,game.title);
});

test('public introduction never grants participation access; removed or blocked members immediately lose both card reads and sharing',()=>{
  for(const alter of [value=>value.groups[0].memberIds=value.groups[0].memberIds.filter(id=>id!=='me'),value=>value.groups[0].blockedMemberIds=['me']]) {
    const value=fixture(),cards=addEntities(value,activityScope);alter(value);
    for(const card of cards) {assert.equal(readChatEntity(value,'me',activityRoom,card),null);rejectsUnchanged(value,()=>shareChatEntity(value,'me',card.entity));}
    assert.deepEqual(getRoomGames(value,'me',activityScope,at),[]);assert.throws(()=>selectRoomChallenges(value,'me',activityScope,at));
  }
});

test('archive, cancellation, completion and past dates keep current-member results readable while denying all new card sharing',()=>{
  for(const alter of [value=>value.groups[0].archived=true,value=>value.activities[0].status='CANCELLED',value=>value.activities[0].status='COMPLETED',value=>{value.activities[0].date='2000-01-01';value.activities[0].endDate='2000-01-02';}]) {
    const value=fixture(),cards=addEntities(value,activityScope);alter(value);const before=structuredClone(value);
    for(const card of cards) {const projection=readChatEntity(value,'owner',activityRoom,card);assert.equal(projection.type,card.entity.type);assert.equal(projection.canInteract,false);rejectsUnchanged(value,()=>shareChatEntity(value,'owner',card.entity));}
    assert.equal(getRoomGames(value,'owner',activityScope,at).length,1);assert.equal(selectRoomChallenges(value,'owner',activityScope,at).length,1);assert.deepEqual(value,before);
  }
});

test('both original-message collectors exclude new card bodies and revalidate a stale human snapshot after conversion to an entity',()=>{
  const value=fixture();const groupCards=addEntities(value,groupScope,'-group');addEntities(value,activityScope,'-activity');
  const cutoff=Date.now()+1000;
  for(const [scope,room,human] of [[groupScope,groupRoom,'human-group'],[activityScope,activityRoom,'human-activity']]) {
    const context={state:value,userId:'me',groupId:'g',roomId:room};
    assert.deepEqual(selectAssistantMessages(value,'me',scope).map(item=>item.id),[human]);
    assert.deepEqual(selectChatDigestMessages(context,{scope:'all'},cutoff).map(item=>item.id),[human]);
    const snapshot=createChatDigest(context,{scope:'all'},cutoff);value.messages.find(item=>item.id===human).entity={...groupCards[0].entity};
    assert.deepEqual(projectChatDigest(context,snapshot,cutoff).sources,[]);
    assert.deepEqual(selectAssistantMessages(value,'me',scope),[]);
  }
});

test('schema-v1 storage without new arrays stays readable and persists games, challenges and exact-room cards atomically',()=>{
  const legacy=fixture();assert.equal('games' in legacy,false);assert.equal('challenges' in legacy,false);assert.equal(isTogetherState(legacy),true);
  const disk=memoryDisk(legacy);const repository=createTogetherRepository('me','나',[],disk);
  assert.equal(repository.getError(),null);assert.deepEqual(repository.getSnapshot(),legacy);
  assert.equal(repository.update(draft=>{addEntities(draft,activityScope);joinRoomChallenge(draft,'me',activityScope,'challenge',at);certifyRoomChallenge(draft,'me',activityScope,'challenge',{text:'정확한 방의 인증'},at);}),true);
  const saved=JSON.parse(disk.getItem(disk.key));assert.equal(isTogetherState(saved),true);assert.equal(saved.games.length,1);assert.equal(saved.challenges.length,1);assert.equal(saved.challenges[0].certifications[0].text,'정확한 방의 인증');
  assert.equal(saved.messages.filter(item=>item.entity).length,2);assert.ok(saved.messages.filter(item=>item.entity).every(item=>item.roomId===activityRoom));
  const reopened=createTogetherRepository('me','나',[],disk);assert.deepEqual(reopened.getSnapshot(),saved);
  assert.equal(disk.getItem('spotlog.web.journeys.v4'),'private-original');assert.equal(disk.getItem('spotlog.admin.store'),'admin-original');
});

test('storage or recipe failure cannot commit only a game, challenge or chat card, notify listeners, or erase existing bytes',()=>{
  const disk=memoryDisk(fixture()),repository=createTogetherRepository('me','나',[],disk);let notifications=0;repository.subscribe(()=>notifications++);
  const previous=repository.getSnapshot(),raw=disk.getItem(disk.key);disk.setFail(true);
  assert.equal(repository.update(draft=>addEntities(draft,groupScope)),false);
  assert.equal(repository.getSnapshot(),previous);assert.equal(disk.getItem(disk.key),raw);assert.equal(notifications,0);assert.ok(repository.getError());
  disk.setFail(false);assert.equal(repository.update(draft=>{addEntities(draft,groupScope);throw new Error('후속 생성 실패');}),false);
  assert.equal(repository.getSnapshot(),previous);assert.equal(disk.getItem(disk.key),raw);assert.equal(notifications,0);
  assert.equal(repository.update(draft=>{addEntities(draft,groupScope);draft.challenges[0].weeklyTarget=99;}),false);
  assert.equal(repository.getSnapshot(),previous);assert.equal(disk.getItem(disk.key),raw);assert.equal(notifications,0);
  assert.equal(disk.getItem('spotlog.web.journeys.v4'),'private-original');assert.equal(disk.getItem('spotlog.admin.store'),'admin-original');
});
