import type { TogetherGroup, TogetherState } from './model.ts';
import { isDiscoverableGroup } from './discovery.ts';

export interface RecentGroupEntry { groupId: string; viewedAt: string }
export interface RecentGroupView { group: TogetherGroup; viewedAt: string }
export type RecentGroupsStorage = Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export const RECENT_GROUPS_LIMIT=20;
export const RECENT_GROUPS_PREFIX='spotlog.groups.recent.v1:';
const identity=(value:unknown):value is string=>typeof value==='string'&&Boolean(value.trim())&&value.length<=200&&!/[\u0000-\u001f\u007f]/u.test(value);
export const recentGroupsKey=(accountId:string)=>`${RECENT_GROUPS_PREFIX}${encodeURIComponent(accountId)}`;
function parse(raw:string|null):RecentGroupEntry[]|null {
  if(raw===null)return [];
  try {
    const value:unknown=JSON.parse(raw);
    if(!Array.isArray(value)||value.length>RECENT_GROUPS_LIMIT||!value.every(item=>item&&typeof item==='object'&&!Array.isArray(item)
      && Object.keys(item).every(key=>key==='groupId'||key==='viewedAt')&&identity(item.groupId)&&typeof item.viewedAt==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(item.viewedAt)&&Number.isFinite(Date.parse(item.viewedAt)))||new Set(value.map(item=>item.groupId)).size!==value.length)return null;
    return value.map(item=>({groupId:item.groupId,viewedAt:item.viewedAt}));
  }catch{return null;}
}
/** Account history stores identifiers and timestamps only, never member lists or private text. */
export function readRecentGroups(storage:RecentGroupsStorage,accountId:string):RecentGroupEntry[] {
  if(!identity(accountId))return [];
  try{return parse(storage.getItem(recentGroupsKey(accountId)))||[];}catch{return [];}
}
export function rememberRecentGroup(storage:RecentGroupsStorage,accountId:string,groupId:string,at=new Date()):boolean {
  if(!identity(accountId)||!identity(groupId)||!Number.isFinite(at.getTime()))return false;
  try {
    const previous=parse(storage.getItem(recentGroupsKey(accountId)));
    if(!previous)return false;
    const entries=[{groupId,viewedAt:at.toISOString()},...previous.filter(item=>item.groupId!==groupId&&Date.parse(item.viewedAt)<=at.getTime())]
      .sort((a,b)=>b.viewedAt.localeCompare(a.viewedAt)||a.groupId.localeCompare(b.groupId)).slice(0,RECENT_GROUPS_LIMIT);
    storage.setItem(recentGroupsKey(accountId),JSON.stringify(entries));return true;
  }catch{return false;}
}
export function clearRecentGroups(storage:RecentGroupsStorage,accountId:string,groupId?:string):boolean {
  if(!identity(accountId)||groupId!==undefined&&!identity(groupId))return false;
  try {
    const key=recentGroupsKey(accountId);
    if(groupId===undefined){storage.removeItem(key);return true;}
    const previous=parse(storage.getItem(key));if(!previous)return false;
    const remaining=previous.filter(item=>item.groupId!==groupId);
    if(remaining.length)storage.setItem(key,JSON.stringify(remaining));else storage.removeItem(key);
    return true;
  }catch{return false;}
}
/** Recheck current visibility/membership at render time; stale IDs never revive a private introduction. */
export function selectRecentGroups(state:TogetherState,userId:string,entries:ReadonlyArray<RecentGroupEntry>,at=new Date()):RecentGroupView[] {
  if(!identity(userId)||!Number.isFinite(at.getTime()))return [];
  const seen=new Set<string>();
  return [...entries].sort((a,b)=>b.viewedAt.localeCompare(a.viewedAt)||a.groupId.localeCompare(b.groupId)).flatMap(item=>{
    if(seen.has(item.groupId)||!identity(item.groupId)||!Number.isFinite(Date.parse(item.viewedAt))||Date.parse(item.viewedAt)>at.getTime())return [];
    seen.add(item.groupId);
    const group=state.groups.find(group=>group.id===item.groupId&&group.spaceType!=='ACTIVITY'&&!group.blockedMemberIds?.includes(userId)
      &&(isDiscoverableGroup(group)||group.memberIds.includes(userId)));
    return group?[{group,viewedAt:item.viewedAt}]:[];
  }).slice(0,RECENT_GROUPS_LIMIT);
}
