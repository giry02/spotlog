import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { isTogetherState } from '../src/together/repository.ts';
import { placeProposalBody, placeProposalDestinations, placeProposalPreview, placeProposalVersion, proposeSavedPlace, readChatPlaceProposal } from '../src/together/placeProposal.ts';

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
 assert.deepEqual(state.messages[0].placeProposal,{ name:place.name,publicPlaceId:place.id });
 for(const secret of ['개인 비밀','private-visit','private-anchor','private-tag','09:00','bookingFixed']) assert.equal(state.messages[0].body.includes(secret),false);
 assert.deepEqual(Object.keys(placeProposalPreview(place)),['id','name','kind','area','address','description']);
 assert.deepEqual(state.activities,[{...activities[0],placeCandidateIds:['branch-a'],revision:5}]); assert.deepEqual(place,source);
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
 assert.deepEqual(state.messages[0].placeProposal,{ name:personal.name });
});
test('duplicate request is idempotent and cannot be repurposed for another room or content',()=>{
 const state=fixture(); propose(state); propose(state);
 assert.equal(state.messages.length,1); assert.deepEqual(state.groups[0].interestPlaceIds,['branch-a']);
 assert.throws(()=>propose(state,{groupId:'g',activityId:'a'}),/다른 제안/);
 assert.throws(()=>propose(state,{groupId:'g'},{...place,name:'다른 이름'}),/다른 제안/);
 const identicalBranch={...place,id:'other-branch'};
 assert.throws(()=>proposeSavedPlace(state,'me',{groupId:'g'},identicalBranch,placeProposalVersion(identicalBranch),'operation-a',[identicalBranch.id],at),/다른 제안/);
 assert.equal(proposeSavedPlace(state,'me',{groupId:'g'},place,placeProposalVersion(place),'operation-a',[],at),'group:g');
 assert.equal(state.messages.length,1); assert.deepEqual(state.groups[0].interestPlaceIds,['branch-a']);
});
test('explicit appointment proposal holds the exact public candidate only once and preserves sibling appointments, venue, route and RSVP',()=>{
 const state=fixture(); state.activities.push({...structuredClone(state.activities[0]),id:'sibling'});
 const original=structuredClone(state.activities), source=structuredClone(place);
 propose(state,{groupId:'g',activityId:'a'}); propose(state,{groupId:'g',activityId:'a'});
 assert.equal(state.messages.length,1); assert.equal(state.messages[0].roomId,'activity:a');
 assert.deepEqual(state.activities[0],{...original[0],placeCandidateIds:['branch-a'],revision:5}); assert.deepEqual(state.activities[1],original[1]);
 assert.deepEqual(place,source); assert.equal(state.groups[0].interestPlaceIds,undefined);
 const personal={...place,id:'personal-place',personal:true}; propose(state,{groupId:'g',activityId:'a'},personal,'personal-request');
 assert.deepEqual(state.activities[0],{...original[0],placeCandidateIds:['branch-a'],revision:5});
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


test('typed proposals round-trip through storage and look up the original public branch in both rooms',()=>{
 const state=fixture(), updated={...place,area:'변경한 지역',address:'공개 주소 변경'}, different={...place,id:'another-id'};
 propose(state); propose(state,{groupId:'g',activityId:'a'},place,'activity-proposal');
 const stored=JSON.parse(JSON.stringify(state));
 assert.equal(isTogetherState(stored),true);
 const [group,activity]=stored.messages;
 for (const message of [group,activity]) {
  const result=readChatPlaceProposal(stored,'me',message.roomId,message,[different,updated]);
  assert.equal(result.place,updated);
  assert.equal(result.name,place.name);
  assert.equal(result.area,place.area);
  assert.equal(result.body,placeProposalBody(place).split('\n').slice(1).join('\n'));
 }
 assert.equal(readChatPlaceProposal(stored,'me','activity:a',group,[place]),null);
 assert.equal(readChatPlaceProposal(stored,'me','group:g',activity,[place]),null);
 stored.messages[0].placeProposal={name:place.name,privatePlaceId:'private-data'};
 assert.equal(isTogetherState(stored),false);
});

test('place detail requires a visible original in the canonical room and respects membership changes',()=>{
 const state=fixture();
 propose(state);
 const [message]=state.messages;
 const read=(viewer='me',room='group:g',source=message)=>readChatPlaceProposal(state,viewer,room,source,[place]);
 assert.equal(read()?.place,place);
 assert.equal(read('other'),null);
 assert.equal(read('me','group:foreign'),null);
 assert.equal(read('me','group:g',{...message,id:'message-user-text'}),null);
 assert.equal(read('me','group:g',{...message,id:'place-proposal:missing'}),null);
 state.groups[0].blockedMemberIds=['me'];
 assert.equal(read(),null);
 delete state.groups[0].blockedMemberIds;
 state.groups[0].spaceType='ACTIVITY';
 assert.equal(read(),null);
 delete state.groups[0].spaceType;
 state.members.splice(0,1);
 assert.equal(read(),null);
 state.members.unshift({id:'me',name:'나'});
 state.messages.push({...message,roomId:'group:foreign'});
 assert.equal(read(),null);
 state.messages.pop();
 state.messages[0]={...message,deleted:true};
 assert.equal(read(),null);
});

test('legacy proposals resolve an exact unique match and preserve the safe snapshot for ambiguous or removed places',()=>{
 const state=fixture();
 propose(state);
 const [message]=state.messages;
 delete message.placeProposal;
 const read=places=>readChatPlaceProposal(state,'me','group:g',message,places);
 assert.equal(isTogetherState(state),true);
 assert.equal(read([place,{...place},{...place,id:'different-address',address:'다른 주소'}]).place.id,place.id);
 assert.equal(read([{...place,id:'wrong-branch',address:'다른 주소'}]).place,undefined);
 assert.equal(read([place,{...place,id:'different-id'}]).place,undefined);
 assert.equal(read([{...place,personal:true}]).place,undefined);
 const snapshot=read([]);
 assert.equal(snapshot.name,place.name);
 assert.equal(snapshot.area,place.area);
 assert.ok(snapshot.body.includes(place.address));
 assert.equal(snapshot.body.includes('장소 제안'),false);
 assert.equal(snapshot.body.includes('개인 비밀 메모'),false);
 assert.equal(propose(state),'group:g'); assert.equal(state.messages.length,1);
});

test('personal proposals retain reviewed text only, and an unavailable public ID never redirects to a lookalike',()=>{
 const state=fixture(), personal={...place,id:'private-location',personal:true};
 propose(state,{groupId:'g'},personal,'private-request');
 propose(state,{groupId:'g'},place,'public-request');
 const [personalMessage,publicMessage]=state.messages;
 const read=(message,places)=>readChatPlaceProposal(state,'me','group:g',message,places);
 assert.equal(read(personalMessage,[personal,place]).place,undefined);
 assert.equal(read(personalMessage,[personal,place]).area,personal.area);
 assert.equal(read(publicMessage,[{...place,id:'same-facts'},{...place,personal:true}]).place,undefined);
 assert.equal(read(personalMessage,[personal]).body.includes('개인 비밀 메모'),false);
 assert.equal(JSON.stringify(personalMessage).includes(personal.id),false);
});


test('proposal card uses only the shared kind and area line, and omits an absent area',()=>{
 const state=fixture(), personal={...place,id:'private-location',personal:true,area:''};
 propose(state,{groupId:'g'},personal);
 const [message]=state.messages;
 const read=()=>readChatPlaceProposal(state,'me','group:g',message,[]);
 assert.equal(read().area,'');
 assert.ok(read().body.includes(personal.address));
 message.body=`장소 제안 · ${personal.name}\n주소 · ${personal.address}\n${personal.description}`;
 assert.equal(read().area,'');
 message.body=`장소 제안 · ${personal.name}\n음식점 · 부산 수영 · 광안\n${personal.address}`;
 assert.equal(read().area,'부산 수영 · 광안');
});
