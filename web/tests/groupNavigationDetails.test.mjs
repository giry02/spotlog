import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState, memberName, roomIdForGroup, roomIdForActivity } from '../src/together/model.ts';
import { buildMyGroupDirectory } from '../src/together/myGroupDirectory.ts';

const group = id => ({ id, name:id, kind:'FRIENDS',region:'부산',introduction:'',cover:'',visibility:'PRIVATE',ownerId:'me',memberIds:['me','friend'],managerIds:[],archived:false,promotionPublished:false });
test('group names resolve only the explicitly selected group and preserve the account name elsewhere', () => {
  const state=createEmptyState('me','내 계정 이름'); state.groups=[group('a'),group('b')];
  state.groups[0].memberProfiles={me:{nickname:'산책친구',introduction:'',answers:[],availableTimes:[],rulesAccepted:true}};
  assert.equal(memberName(state,'me','a'),'산책친구');
  assert.equal(memberName(state,'me','b'),'내 계정 이름');
  assert.equal(memberName(state,'me'),'내 계정 이름');
});
test('joined-group preview uses the latest nondeleted group-room message, without exposing an unrelated event or advancing read state', () => {
  const at=new Date('2026-11-08T12:00:00+09:00'),state=createEmptyState('me','나'); state.groups=[group('a'),group('b')];
  state.groups[1].memberIds=['friend'];
  state.activities=[{id:'event',groupId:'a',title:'이번 약속',date:'2026-11-09',endDate:'',meetingPoint:'',description:'',status:'PLANNED',leadId:'me',editorIds:[],participants:{},arrivedIds:[],revision:1}];
  const message=(id,roomId,body,createdAt,extra={})=>({id,roomId,body,createdAt,authorId:'friend',...extra});
  state.messages=[message('early',roomIdForGroup('a'),'어제 이야기','2026-11-07T01:00:00Z'),
    message('latest',roomIdForGroup('a'),'오늘 이야기','2026-11-08T01:00:00Z',{authorId:'me'}),
    message('deleted',roomIdForGroup('a'),'삭제한 내용','2026-11-08T02:00:00Z',{deleted:true}),
    message('future',roomIdForGroup('a'),'미래 시각','2026-11-09T01:00:00Z'),
    message('event',roomIdForActivity('event'),'약속 대화의 원문','2026-11-08T02:00:00Z'),
    message('other',roomIdForGroup('b'),'가입하지 않은 모임','2026-11-08T02:00:00Z')];
  const before=structuredClone(state),directory=buildMyGroupDirectory(state,'me',{},at);
  assert.equal(directory.groups.length,1);
  assert.equal(directory.groups[0].lastMessage.body,'오늘 이야기');
  assert.equal(directory.groups[0].nextActivity.id,'event');
  assert.deepEqual(state,before);
});
