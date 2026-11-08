import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { selectRoomResources } from '../src/together/roomResources.ts';
const group=(id,extra={})=>({id,name:id,kind:'FAMILY',region:'부산',introduction:'',cover:'',visibility:'PUBLIC',promotionPublished:true,ownerId:'owner',memberIds:['owner','me'],managerIds:[],archived:false,...extra});
function fixture(){const state=createEmptyState('me','나');state.members.push({id:'owner',name:'모임장'},{id:'outsider',name:'외부인'});state.groups.push(group('g'),group('foreign',{memberIds:['outsider']}));state.activities.push({id:'a',groupId:'g',title:'약속A',date:'2999-11-08',endDate:'',meetingPoint:'',description:'',status:'PLANNED',leadId:'owner',editorIds:[],participants:{},arrivedIds:[],revision:1},{id:'b',groupId:'g',title:'약속B',date:'2999-11-09',endDate:'',meetingPoint:'',description:'',status:'PLANNED',leadId:'owner',editorIds:[],participants:{},arrivedIds:[],revision:1});for(const field of ['media','notices','polls','tasks','games','challenges'])state[field]=[{id:`${field}-group`,groupId:'g',privateText:'모임 자료'},{id:`${field}-a`,groupId:'g',activityId:'a',privateText:'약속A 전용'},{id:`${field}-b`,groupId:'g',activityId:'b',privateText:'약속B 전용'},{id:`${field}-foreign`,groupId:'foreign',privateText:'다른 모임 비공개'}];return state;}
test('group resources exclude all child-room and foreign records while exact activity resources exclude group and sibling records',()=>{
 const state=fixture(),before=structuredClone(state),root=selectRoomResources(state,'me','g'),child=selectRoomResources(state,'me','g','a');
 assert.equal(root.roomId,'group:g');assert.equal(child.roomId,'activity:a');
 for(const field of ['media','notices','polls','tasks','games','challenges']){assert.deepEqual(root[field].map(item=>item.id),[`${field}-group`]);assert.deepEqual(child[field].map(item=>item.id),[`${field}-a`]);}
 assert.deepEqual(root.activities.map(item=>item.id),['a','b']);assert.deepEqual(child.activities.map(item=>item.id),['a']);assert.equal(JSON.stringify(root).includes('다른 모임 비공개'),false);assert.equal(JSON.stringify(child).includes('약속B 전용'),false);assert.deepEqual(state,before);
});
test('current membership, blocking and exact activity ownership are rechecked before any private room data is returned',()=>{
 for(const actor of ['', 'outsider','not-registered'])assert.equal(selectRoomResources(fixture(),actor,'g'),null);
 assert.equal(selectRoomResources(fixture(),'me','g','missing'),null);assert.equal(selectRoomResources(fixture(),'me','foreign','a'),null);
 const state=fixture();state.groups[0].blockedMemberIds=['me'];assert.equal(selectRoomResources(state,'me','g'),null);state.groups[0].blockedMemberIds=[];state.groups[0].memberIds=['owner'];assert.equal(selectRoomResources(state,'me','g','a'),null);
 state.groups[0].memberIds.push('ghost');assert.equal(selectRoomResources(state,'ghost','g'),null);
});
test('archived, completed and cancelled scopes remain readable for current members without mutating stored records',()=>{
 for(const change of [state=>state.groups[0].archived=true,state=>state.activities[0].status='COMPLETED',state=>state.activities[0].status='CANCELLED']){const state=fixture();change(state);const before=structuredClone(state);assert.equal(selectRoomResources(state,'me','g','a').media[0].id,'media-a');assert.deepEqual(state,before);}
});
test('standalone appointment backing spaces have only their exact activity room and never expose a manufactured group resource view',()=>{
 const state=fixture();state.groups[0].spaceType='ACTIVITY';state.activities=state.activities.filter(item=>item.id==='a');assert.equal(selectRoomResources(state,'me','g'),null);assert.equal(selectRoomResources(state,'me','g','a').roomId,'activity:a');
});
