import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { clearRecentGroups, readRecentGroups, recentGroupsKey, rememberRecentGroup, selectRecentGroups } from '../src/together/recentGroups.ts';
const at=new Date('2026-11-08T03:00:00Z');
function disk(){const data=new Map([['spotlog.web.journeys.v4','private-old'],['spotlog.admin.store','admin-old']]);let fail=false;return {data,getItem:key=>data.get(key)??null,setItem:(key,value)=>{if(fail)throw new Error('quota');data.set(key,value);},removeItem:key=>{if(fail)throw new Error('quota');data.delete(key);},fail:value=>{fail=value;}};}
const group=(id,extra={})=>({id,name:id,kind:'HOBBY',region:'부산',introduction:'공개 소개',cover:'',visibility:'PUBLIC',promotionPublished:true,ownerId:'owner',memberIds:['owner'],managerIds:[],archived:false,...extra});
test('recent groups store only exact IDs/times in one account key, cap at twenty and revisit without duplicates',()=>{
 const storage=disk();for(let index=0;index<25;index++)assert.equal(rememberRecentGroup(storage,'me',`g-${index}`,new Date(at.getTime()+index*1000)),true);
 const entries=readRecentGroups(storage,'me');assert.equal(entries.length,20);assert.equal(entries[0].groupId,'g-24');assert.equal(entries.at(-1).groupId,'g-5');assert.ok(entries.every(item=>Object.keys(item).join(',')==='groupId,viewedAt'));
 rememberRecentGroup(storage,'me','g-10',new Date(at.getTime()+26000));assert.equal(readRecentGroups(storage,'me')[0].groupId,'g-10');assert.equal(readRecentGroups(storage,'me').length,20);
 assert.deepEqual(readRecentGroups(storage,'other'),[]);assert.equal(rememberRecentGroup(storage,'','guest-visit',at),false);
 assert.equal(storage.getItem('spotlog.web.journeys.v4'),'private-old');assert.equal(storage.getItem('spotlog.admin.store'),'admin-old');assert.notEqual(recentGroupsKey('a/b'),recentGroupsKey('a%2Fb'));
});
test('rendering history revalidates withdrawn/blocked/removed/one-off groups and never mutates current data or joins anyone',()=>{
 const state=createEmptyState('me','나');state.groups=[group('public'),group('private-member',{visibility:'PRIVATE',promotionPublished:false,memberIds:['owner','me']}),group('private-outsider',{visibility:'PRIVATE',promotionPublished:false}),group('withdrawn',{promotionPublished:false}),group('blocked',{blockedMemberIds:['me']}),group('archived',{archived:true}),group('one-off',{spaceType:'ACTIVITY',visibility:'PRIVATE',memberIds:['me']})];
 const entries=[...state.groups.map(group=>({groupId:group.id,viewedAt:at.toISOString()})),{groupId:'removed',viewedAt:at.toISOString()},{groupId:'future',viewedAt:'2999-01-01T00:00:00Z'}];const before=structuredClone(state);
 assert.deepEqual(selectRecentGroups(state,'me',entries,at).map(item=>item.group.id),['private-member','public']);assert.deepEqual(state,before);
 state.groups[0].visibility='PRIVATE';state.groups[1].memberIds=['owner'];assert.deepEqual(selectRecentGroups(state,'me',entries,at),[]);assert.deepEqual(selectRecentGroups(state,'',entries,at),[]);
});
test('malformed history and failed writes preserve original bytes until an explicit clear request',()=>{
 const storage=disk(),key=recentGroupsKey('me');storage.setItem(key,'broken-json');assert.deepEqual(readRecentGroups(storage,'me'),[]);assert.equal(rememberRecentGroup(storage,'me','g',at),false);assert.equal(storage.getItem(key),'broken-json');
 assert.equal(clearRecentGroups(storage,'me'),true);rememberRecentGroup(storage,'me','g',at);const raw=storage.getItem(key);storage.fail(true);assert.equal(rememberRecentGroup(storage,'me','other',at),false);assert.equal(clearRecentGroups(storage,'me'),false);assert.equal(storage.getItem(key),raw);
});
test('individual and whole-history clear operations affect only the intended account',()=>{
 const storage=disk();rememberRecentGroup(storage,'me','one',at);rememberRecentGroup(storage,'me','two',at);rememberRecentGroup(storage,'other','their-group',at);
 assert.equal(clearRecentGroups(storage,'me','one'),true);assert.deepEqual(readRecentGroups(storage,'me').map(item=>item.groupId),['two']);assert.equal(clearRecentGroups(storage,'me'),true);assert.deepEqual(readRecentGroups(storage,'me'),[]);assert.equal(readRecentGroups(storage,'other')[0].groupId,'their-group');
});
