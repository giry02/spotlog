import test from 'node:test';
import assert from 'node:assert/strict';
import { createMembershipReviewState, MEMBERSHIP_REVIEW_ACCOUNT, MEMBERSHIP_REVIEW_ACTIVITY, MEMBERSHIP_REVIEW_GROUP, MEMBERSHIP_REVIEW_KEY, membershipReviewPhase, membershipReviewStorage } from './membershipReviewFixture.ts';
import { approveGroupApplication, isMember, setGroupParticipation } from '../src/together/model.ts';
import { createTogetherRepository, isTogetherState } from '../src/together/repository.ts';
import { publicActivities } from '../src/together/discovery.ts';

const now=new Date('2026-10-28T16:00:00Z');
function storage(){const entries=new Map();return {get length(){return entries.size;},key:index=>[...entries.keys()][index]??null,getItem:key=>entries.get(key)??null,setItem:(key,value)=>entries.set(key,value),removeItem:key=>entries.delete(key),clear:()=>entries.clear()};}

test('shared review starts with an unjoined applicant and one ordinary tomorrow meetup in Korean time',()=>{
  const state=createMembershipReviewState(now),activity=state.activities[0];
  assert.equal(isTogetherState(state),true);assert.equal(state.groups.length,1);
  assert.equal(membershipReviewPhase(state),'신청 전');assert.equal(isMember(state,'review-applicant',MEMBERSHIP_REVIEW_GROUP),false);
  assert.deepEqual(state.groups[0].memberIds,['review-owner','review-member']);
  assert.equal(activity.date,'2026-10-30');assert.equal(activity.startTime,'19:30');assert.equal(activity.kind,'MEETUP');assert.equal(activity.capacity,6);assert.equal(activity.journey,undefined);
  assert.equal(state.applications.length,0);assert.equal(state.sharedJournals.length,0);
});

test('public review copy contains the chosen meetup but never private meeting details or participant data',()=>{
  const state=createMembershipReviewState(now),publicRows=publicActivities(state,state.groups[0]);
  assert.equal(publicRows.length,1);assert.equal(publicRows[0].startTime,'19:30');
  for(const name of ['participants','meetingPoint','journey','capacity','leadId','editorIds'])assert.equal(name in publicRows[0],false);
  assert.ok(!JSON.stringify(publicRows).includes('내부 집합 장소 확인'));
});

test('applicant → owner approval → member uses one fixture without implicitly attending a meetup',()=>{
  const state=createMembershipReviewState(now);
  state.applications.push({id:'application-review',groupId:MEMBERSHIP_REVIEW_GROUP,userId:'review-applicant',status:'PENDING',message:'동네에서 책 이야기를 나누고 싶어요.',createdAt:now.toISOString()});
  assert.equal(membershipReviewPhase(state),'승인 대기');
  assert.throws(()=>approveGroupApplication(state,'application-review','review-applicant'));
  approveGroupApplication(state,'application-review','review-owner');
  assert.equal(membershipReviewPhase(state),'가입 완료');assert.equal(state.groups[0].memberIds.filter(id=>id==='review-applicant').length,1);
  assert.equal(state.activities[0].participants['review-applicant'],undefined);
  setGroupParticipation(state,MEMBERSHIP_REVIEW_ACTIVITY,'review-applicant','JOINED');
  assert.equal(state.activities[0].participants['review-applicant'],'JOINED');
  setGroupParticipation(state,MEMBERSHIP_REVIEW_ACTIVITY,'review-applicant','DECLINED');
  assert.equal(isMember(state,'review-applicant',MEMBERSHIP_REVIEW_GROUP),true);
  assert.equal(state.activities[0].participants['review-applicant'],'DECLINED');
});

test('review storage enforces its single session key and cannot alter foreign customer/admin bytes',()=>{
  const disk=storage();disk.setItem('spotlog.web.journeys.v4','private-trips');disk.setItem('spotlog.admin.review.v1','admin-bytes');
  const scoped=membershipReviewStorage(disk);scoped.setItem(MEMBERSHIP_REVIEW_KEY,JSON.stringify(createMembershipReviewState(now)));
  const repo=createTogetherRepository(MEMBERSHIP_REVIEW_ACCOUNT,'검수',[],scoped);
  assert.equal(repo.getSnapshot().groups.length,1);
  assert.equal(repo.update(state=>{state.applications.push({id:'review-request',groupId:MEMBERSHIP_REVIEW_GROUP,userId:'review-applicant',status:'PENDING'});}),true);
  assert.equal(membershipReviewPhase(repo.getSnapshot()),'승인 대기');
  for(const key of ['spotlog.web.journeys.v4','spotlog.admin.review.v1','spotlog.together.local.v1:review-owner']){
    assert.throws(()=>scoped.getItem(key));assert.throws(()=>scoped.setItem(key,'changed'));assert.throws(()=>scoped.removeItem(key));
  }
  assert.throws(()=>scoped.clear());assert.equal(disk.getItem('spotlog.web.journeys.v4'),'private-trips');assert.equal(disk.getItem('spotlog.admin.review.v1'),'admin-bytes');
});
