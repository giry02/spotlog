import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { createChatAiSummaryRequest } from '../src/together/chatAiSummary.ts';
import { createSummaryTaskAction } from '../src/together/chatSummaryActions.ts';
import { applyActivityAssistantAction } from '../src/together/activityAssistant.ts';

function fixture() {
  const state = createEmptyState('me', '나');
  state.members.push({ id:'other', name:'다른 멤버' });
  state.groups.push({ id:'hobby', name:'사진 모임', kind:'HOBBY', region:'부산', introduction:'', cover:'', visibility:'PRIVATE', ownerId:'me', memberIds:['me','other'], managerIds:[], archived:false, promotionPublished:false });
  state.activities.push({ id:'meeting', groupId:'hobby', title:'다음 모임', date:'', endDate:'', meetingPoint:'', description:'', status:'PLANNED', leadId:'me', editorIds:[], participants:{}, arrivedIds:[], revision:1 });
  state.messages.push({ id:'water', roomId:'activity:meeting', authorId:'other', body:'각자 물을 챙겨 주세요.', createdAt:'2026-11-19T01:00:00Z' });
  const context = { state, userId:'me', groupId:'hobby', roomId:'activity:meeting' };
  const request = createChatAiSummaryRequest(context,{scope:'all'},'KEY_POINTS',Date.parse('2026-11-19T02:00:00Z'),'summary-request');
  const snapshot = { request, output:{ title:'준비', sections:[{kind:'PREPARATION',heading:'준비할 일',items:[{text:'각자 물을 챙기기', sourceIds:['water']}]}] } };
  return { context, snapshot };
}

test('summary remains read only until an explicit task action is applied in its original room', () => {
  const {context,snapshot}=fixture(), before=structuredClone(context.state);
  const action=createSummaryTaskAction(context,snapshot,0,0,'물 챙기기',false);
  assert.deepEqual(context.state,before);
  assert.equal(action.activityId,'meeting');
  assert.equal(action.assignee,'UNASSIGNED');
  const id=applyActivityAssistantAction(context.state,'me',action,[]);
  assert.equal(context.state.tasks.length,1);
  assert.equal(context.state.tasks[0].id,id);
  assert.equal(context.state.tasks[0].assigneeId,undefined);
  assert.deepEqual(context.state.tasks[0].sourceMessageIds,['water']);
});

test('only the actor can volunteer and duplicate confirmation does not create duplicate tasks', () => {
  const {context,snapshot}=fixture();
  const action=createSummaryTaskAction(context,snapshot,0,0,'물 챙기기',true);
  applyActivityAssistantAction(context.state,'me',action,[]);
  applyActivityAssistantAction(context.state,'me',action,[]);
  assert.equal(context.state.tasks.length,1);
  assert.equal(context.state.tasks[0].assigneeId,'me');
});

test('changed originals or revoked access cannot turn an old summary into preparation', () => {
  const {context,snapshot}=fixture();
  context.state.messages[0].body='준비 내용 변경';
  assert.throws(()=>createSummaryTaskAction(context,snapshot,0,0,'물',false),/원문/);
  const next=fixture();
  next.context.state.groups[0].blockedMemberIds=['me'];
  assert.throws(()=>createSummaryTaskAction(next.context,next.snapshot,0,0,'물',false),/원문/);
});

test('task commit rejects stale revision and edited evidence after confirmation opens', () => {
  const {context,snapshot}=fixture();
  const action=createSummaryTaskAction(context,snapshot,0,0,'물',false);
  context.state.activities[0].revision+=1;
  assert.throws(()=>applyActivityAssistantAction(context.state,'me',action,[]),/약속이 바뀌/);
  assert.equal(context.state.tasks.length,0);
  const next=fixture(), action2=createSummaryTaskAction(next.context,next.snapshot,0,0,'물',false);
  next.context.state.messages[0].body='수정됨';
  assert.throws(()=>applyActivityAssistantAction(next.context.state,'me',action2,[]),/원문/);
});

test('time-place sections and invalid item indexes or blank titles cannot create tasks', () => {
  const {context,snapshot}=fixture();
  assert.throws(()=>createSummaryTaskAction(context,snapshot,2,0,'물',false),/원문/);
  assert.throws(()=>createSummaryTaskAction(context,snapshot,0,0,' ',false),/1~200/);
  snapshot.output.sections[0].kind='TIME_PLACE';
  assert.throws(()=>createSummaryTaskAction(context,snapshot,0,0,'물',false),/원문/);
});
