import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { PLATFORM_REVIEW_PROTOCOL, PLATFORM_REVIEW_ROLES, readPlatformReviewRoleMessage } from './platform-review-protocol.ts';

const origin='http://127.0.0.1:5210';
test('fixture role messages require the exact same-origin parent and an allowlisted role-only envelope',()=>{
  const parent={},other={};
  const event=(role,extras={})=>({source:parent,origin,data:{protocol:PLATFORM_REVIEW_PROTOCOL,type:'SET_ROLE',role},...extras});
  for(const role of PLATFORM_REVIEW_ROLES)assert.equal(readPlatformReviewRoleMessage(event(role),origin,parent),role);
  assert.equal(readPlatformReviewRoleMessage(event('owner',{source:other}),origin,parent),null);
  assert.equal(readPlatformReviewRoleMessage(event('owner',{origin:'https://example.invalid'}),origin,parent),null);
  assert.equal(readPlatformReviewRoleMessage(event('owner'),origin,null),null);
  for(const data of [null,[],{protocol:PLATFORM_REVIEW_PROTOCOL,type:'RESET',role:'owner'},{protocol:PLATFORM_REVIEW_PROTOCOL,type:'SET_ROLE',role:'constructor'},{protocol:PLATFORM_REVIEW_PROTOCOL,type:'SET_ROLE',role:'owner',storage:'reset'},{protocol:PLATFORM_REVIEW_PROTOCOL,type:'SET_ROLE',role:'owner',route:'group-private'}])assert.equal(readPlatformReviewRoleMessage(event('owner',{data}),origin,parent),null);
});

function wrapper() {
  const html=readFileSync(new URL('./group-benchmark-review.html',import.meta.url),'utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
  let current=new URL(`${origin}/tests/group-benchmark-review.html?screen=public&role=applicant&width=360`),frameLoads=0;
  const sent=[],events=new Map(),controls={};
  for(const id of ['role','width'])controls[id]={value:'',listeners:new Map(),addEventListener(name,handler){this.listeners.set(name,handler);}};
  const frameWindow={postMessage:(data,targetOrigin)=>sent.push({data:JSON.parse(JSON.stringify(data)),targetOrigin})};
  controls.review={style:{},contentWindow:frameWindow,set src(value){frameLoads++;this.initialSource=value;}};
  const location={get href(){return current.href;},set href(_value){throw new Error('A role change must not reload the wrapper.');},get search(){return current.search;},origin};
  const history={replaceState:(_state,_unused,target)=>{current=new URL(String(target),current);}};
  const unavailableStorage={getItem(){throw new Error('Real storage must not be read.');},setItem(){throw new Error('Real storage must not be written.');},clear(){throw new Error('Real storage must not be reset.');}};
  vm.runInNewContext(script,{URL,URLSearchParams,location,history,document:{getElementById:id=>controls[id],querySelectorAll:()=>[]},window:{addEventListener:(name,handler)=>events.set(name,handler),localStorage:unavailableStorage},localStorage:unavailableStorage});
  return {controls,sent,events,frameWindow,get loads(){return frameLoads;},get url(){return current;}};
}

test('wrapper changes applicant to owner by message without iframe reload or storage access',()=>{
  const page=wrapper();assert.equal(page.loads,1);assert.equal(page.controls.role.value,'applicant');
  const original=page.controls.review.initialSource;page.controls.role.value='owner';page.controls.role.listeners.get('change')();
  assert.equal(page.loads,1);assert.equal(page.controls.review.initialSource,original);
  assert.deepEqual(page.sent,[{data:{protocol:PLATFORM_REVIEW_PROTOCOL,type:'SET_ROLE',role:'owner'},targetOrigin:origin}]);
  assert.equal(page.url.searchParams.get('role'),'owner');assert.equal(page.url.searchParams.get('screen'),'public');assert.equal(page.url.searchParams.get('width'),'360');
});

test('wrapper role acknowledgement ignores other origins, frames and extra commands',()=>{
  const page=wrapper(),receive=page.events.get('message'),ack={protocol:PLATFORM_REVIEW_PROTOCOL,type:'ROLE_CHANGED',role:'owner'};
  receive({source:{},origin,data:ack});assert.equal(page.controls.role.value,'applicant');
  receive({source:page.frameWindow,origin:'https://example.invalid',data:ack});assert.equal(page.controls.role.value,'applicant');
  receive({source:page.frameWindow,origin,data:{...ack,reset:true}});assert.equal(page.controls.role.value,'applicant');
  receive({source:page.frameWindow,origin,data:ack});assert.equal(page.controls.role.value,'owner');assert.equal(page.loads,1);
});
