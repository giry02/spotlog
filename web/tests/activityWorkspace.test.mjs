import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { selectActivityWorkspace } from '../src/together/activityWorkspace.ts';

const at = new Date('2026-11-16T09:00:00+09:00');
function fixture() {
  const state = createEmptyState('me','나');
  state.members.push({id:'other',name:'멤버'});
  state.groups.push({id:'g',name:'모임',ownerId:'me',memberIds:['me','other'],managerIds:[],kind:'FAMILY',region:'부산',introduction:'',cover:'',visibility:'PRIVATE',archived:false,promotionPublished:false});
  state.activities.push({id:'a',groupId:'g',title:'약속',date:'2026-11-16',endDate:'2026-11-18',meetingPoint:'입구',description:'',status:'PLANNED',leadId:'me',editorIds:[],participants:{me:'JOINED'},arrivedIds:[],revision:1});
  return state;
}
const select = state => selectActivityWorkspace(state,'me','g','a',at);

test('presentation separates undated, upcoming, multi-day today and past without changing status or responses',()=>{
  const state=fixture(); const expected=[['','', 'UNSCHEDULED'],['2026-11-17','2026-11-18','UPCOMING'],['2026-11-15','2026-11-16','TODAY'],['2026-11-14','2026-11-15','PAST']];
  for(const [date,endDate,phase] of expected){Object.assign(state.activities[0],{date,endDate});const before=structuredClone(state);assert.equal(select(state).phase,phase);assert.deepEqual(state,before);}
});
test('the Korea midnight boundary changes the visible job without automatically completing the activity',()=>{
  const state=fixture();state.activities[0].endDate='2026-11-16';
  assert.equal(selectActivityWorkspace(state,'me','g','a',new Date('2026-11-16T14:59:59Z')).phase,'TODAY');
  assert.equal(selectActivityWorkspace(state,'me','g','a',new Date('2026-11-16T15:00:00Z')).phase,'PAST');
  assert.equal(state.activities[0].status,'PLANNED');
});
test('explicit cancellation and archive are not presented as completed experiences',()=>{
  const state=fixture(); state.activities[0].status='CANCELLED';assert.equal(select(state).phase,'CANCELLED');assert.equal(select(state).writable,false);
  state.activities[0].status='PLANNED';state.groups[0].archived=true;assert.equal(select(state).phase,'ARCHIVED');assert.equal(select(state).writable,false);
});
test('memberships and exact group/activity identity protect the projection',()=>{
  for(const change of [s=>s.groups[0].memberIds=['other'],s=>s.groups[0].blockedMemberIds=['me'],s=>s.members=s.members.filter(x=>x.id!=='me'),s=>s.activities[0].groupId='foreign']){const state=fixture();change(state);assert.equal(select(state),null);}
  assert.equal(selectActivityWorkspace(fixture(),'other','foreign','a',at),null);
});
test('record thumbnails and preparation counts stay in the same room and preserve the actual owner',()=>{
  const state=fixture();
  state.posts.push({id:'p',groupId:'g',activityId:'a',authorId:'other',category:'REVIEW',title:'후기',body:'',createdAt:'2026-11-16',likes:[],comments:[],attachments:[{id:'p1',url:'/shared.jpg',caption:''}]});
  state.media.push({id:'m',groupId:'g',activityId:'a',authorId:'me',url:'/shared.jpg',caption:'사진',kind:'PHOTO',createdAt:'2026-11-15'},{id:'bad',groupId:'foreign',activityId:'a',authorId:'other',url:'/secret.jpg',caption:'비밀',kind:'PHOTO',createdAt:'2026-11-17'});
  state.tasks.push({id:'my',groupId:'g',activityId:'a',title:'내 준비',assigneeId:'me',completed:false},{id:'shared',groupId:'g',activityId:'a',title:'공동',completed:false},{id:'other',groupId:'g',activityId:'a',title:'다른 사람',assigneeId:'other',completed:false},{id:'wrong',groupId:'foreign',activityId:'a',title:'비밀',assigneeId:'me',completed:false});
  const before=structuredClone(state), value=select(state);
  assert.equal(value.photoCount,1);assert.equal(value.photos[0].source,'POST');assert.equal(value.photos[0].recordId,'p');assert.equal(value.postCount,1);assert.equal(value.mediaCount,1);
  assert.deepEqual(value.ownPending.map(x=>x.id),['my']);assert.deepEqual(value.sharedPending.map(x=>x.id),['shared']);assert.equal(value.pendingCount,3);assert.deepEqual(state,before);
});
test('invalid dates do not manufacture a today state and reversed end dates use the actual start',()=>{
  const state=fixture();state.activities[0].date='2026-02-30';assert.equal(select(state).phase,'UNSCHEDULED');state.activities[0].date='2026-11-17';state.activities[0].endDate='2026-11-15';assert.equal(select(state).phase,'UPCOMING');
});
