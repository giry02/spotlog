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

test('room participant preview uses only actual JOINED current members and distinguishes the full member list',()=>{
 const state=fixture();state.groups[0].memberIds.push('blocked','ghost','declined','pending');state.groups[0].blockedMemberIds=['blocked'];
 state.members.push({id:'blocked',name:'차단'},{id:'declined',name:'불참'},{id:'pending',name:'미정'});
 state.activities[0].participants={owner:'JOINED',me:'JOINED',blocked:'JOINED',ghost:'JOINED',outsider:'JOINED',declined:'DECLINED',pending:'UNDECIDED'};
 const before=structuredClone(state),child=selectRoomResources(state,'me','g','a'),root=selectRoomResources(state,'me','g');
 assert.deepEqual(child.participantIds,['owner','me']);assert.deepEqual(child.memberIds,['owner','me','declined','pending']);assert.deepEqual(root.participantIds,[]);
 assert.deepEqual(state,before);
});

test('media overview includes safe same-room post photos with exact source IDs and never child/sibling/private-room photos',()=>{
 const state=fixture();
 state.media=[{id:'m1',groupId:'g',activityId:'a',kind:'PHOTO',url:'/media/a.jpg',caption:'앨범',createdAt:'2026-11-10T04:00:00Z'},
 {id:'m-root',groupId:'g',kind:'PHOTO',url:'/media/root.jpg',caption:'전체방',createdAt:'2026-11-10T04:00:00Z'}];
 const post=(id,activityId,attachments)=>({id,groupId:'g',activityId,authorId:'me',title:id,body:'',category:'FREE',attachments,likes:[],comments:[],createdAt:'2026-11-10T03:00:00Z'});
 state.posts=[post('p1','a',[{id:'ph1',url:'/media/post.jpg',caption:'글 사진'},{id:'dup',url:'/media/a.jpg',caption:'중복'},{id:'bad',url:'javascript:alert(1)',caption:'잘못된 주소'}]),post('sibling','b',[{id:'ph2',url:'/media/b.jpg',caption:'다른약속'}]),post('root',undefined,[{id:'ph3',url:'/media/root-post.jpg',caption:'전체방'}])];
 const before=structuredClone(state),child=selectRoomResources(state,'me','g','a'),root=selectRoomResources(state,'me','g');
 assert.deepEqual(child.posts.map(item=>item.id),['p1']);assert.deepEqual(child.photos.map(item=>[item.source,item.recordId,item.url]),[['MEDIA','m1','/media/a.jpg'],['POST','p1','/media/post.jpg']]);
 assert.deepEqual(root.photos.map(item=>item.url),['/media/root.jpg','/media/root-post.jpg']);assert.deepEqual(state,before);
 state.groups[0].blockedMemberIds=['me'];assert.equal(selectRoomResources(state,'me','g','a'),null);
});
