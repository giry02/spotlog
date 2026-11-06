import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { isTogetherState } from '../src/together/repository.ts';
import { placeProposalBody, placeProposalDestinations, placeProposalPreview, placeProposalVersion, proposeSavedPlace } from '../src/together/placeProposal.ts';

const at = new Date('2026-11-06T12:00:00+09:00');
const place = { id:'branch-a', kind:'FOOD', name:'같은 상호 A지점', area:'부산 수영', address:'부산 수영구 가게 주소', description:'함께 먹을 음식점', image:'/photo.jpg', lat:35, lng:129, note:'개인 비밀 메모', duration:'60분', bookingFixed:true, time:'09:00', visitId:'private-visit', anchorVisitId:'private-anchor', tags:['private-tag'] };
function fixture() {
 const state=createEmptyState('me','나'); state.members.push({id:'other',name:'다른 사람'});
 state.groups.push({id:'g',name:'우리 모임',kind:'FRIENDS',region:'부산',introduction:'',cover:'',visibility:'PRIVATE',ownerId:'me',memberIds:['me'],managerIds:[],archived:false,promotionPublished:false});
 state.groups.push({...structuredClone(state.groups[0]),id:'foreign',ownerId:'other',memberIds:['other']});
 state.activities.push({id:'a',groupId:'g',title:'식사 약속',date:'2026-11-07',endDate:'2026-11-07',meetingPoint:'기존 장소',description:'',status:'PLANNED',leadId:'me',editorIds:[],participants:{me:'MAYBE'},arrivedIds:[],revision:4});
 return state;
}
const propose=(state,target={groupId:'g'},p=place,id='operation-a')=>proposeSavedPlace(state,'me',target,p,placeProposalVersion(p),id,[place.id],at);
test('explicit sharing copies only venue facts, targets one room and preserves attendance/venue/trip originals',()=>{
 const state=fixture(), activities=structuredClone(state.activities), source=structuredClone(place);
 assert.equal(propose(state,{groupId:'g',activityId:'a'}),'activity:a');
 assert.equal(state.messages.length,1); assert.equal(state.messages[0].roomId,'activity:a');
 assert.equal(state.messages[0].body,placeProposalBody(place));
 for(const secret of ['개인 비밀','private-visit','private-anchor','private-tag','09:00','bookingFixed']) assert.equal(state.messages[0].body.includes(secret),false);
 assert.deepEqual(Object.keys(placeProposalPreview(place)),['id','name','kind','area','address','description']);
 assert.deepEqual(state.activities,activities); assert.deepEqual(place,source);
 assert.equal(state.groups.find(g=>g.id==='g').interestPlaceIds,undefined);
 assert.equal(state.groups.find(g=>g.id==='foreign').interestPlaceIds,undefined);
 assert.equal(isTogetherState(state),true);
});
test('same-name branches stay exact and a personal venue is shared only as selected text, without becoming a common catalog candidate',()=>{
 const state=fixture(); const personal={...place,id:'personal-b',name:place.name,address:'다른 지점 주소',personal:true};
 propose(state,{groupId:'g'},personal);
 assert.ok(state.messages[0].body.includes('다른 지점 주소'));
 assert.equal(state.groups[0].interestPlaceIds,undefined);
 assert.deepEqual(state.messages[0].entity,undefined);
});
test('duplicate request is idempotent and cannot be repurposed for another room or content',()=>{
 const state=fixture(); propose(state); propose(state);
 assert.equal(state.messages.length,1); assert.deepEqual(state.groups[0].interestPlaceIds,['branch-a']);
 assert.throws(()=>propose(state,{groupId:'g',activityId:'a'}),/다른 제안/);
 assert.throws(()=>propose(state,{groupId:'g'},{...place,name:'다른 이름'}),/다른 제안/);
});
test('current membership, block, archive and activity ownership/status/date are checked again before mutation',()=>{
 for(const change of [s=>s.groups[0].memberIds=[],s=>s.groups[0].blockedMemberIds=['me'],s=>s.groups[0].archived=true,s=>s.activities[0].groupId='foreign',s=>s.activities[0].status='CANCELLED',s=>s.activities[0].endDate='2026-11-05']){
  const state=fixture(); change(state); const before=structuredClone(state);
  assert.throws(()=>propose(state,{groupId:'g',activityId:'a'}),/제안할 수 없어요/); assert.deepEqual(state,before);
 }
 const state=fixture(); assert.deepEqual(placeProposalDestinations(state,'',at),[]);
 assert.deepEqual(placeProposalDestinations(state,'me',at).map(x=>[x.groupId,x.activityId]),[['g',undefined],['g','a']]);
 assert.throws(()=>propose(state,{groupId:'foreign'}),/제안할 수 없어요/);
});
test('changed preview or malformed retry ID fails before a write',()=>{
 const state=fixture(), before=structuredClone(state);
 assert.throws(()=>proposeSavedPlace(state,'me',{groupId:'g'},{...place,address:'주소 변경'},placeProposalVersion(place),'op',[place.id],at),/정보가 바뀌/);
 assert.throws(()=>propose(state,{groupId:'g'},place,'invalid:id'),/요청/); assert.deepEqual(state,before);
});
