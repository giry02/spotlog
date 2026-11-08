import { useState } from 'react';
import { BarChart3, Bell, CalendarDays, ChevronRight, ClipboardList, Dices, Image, Trophy, Users } from 'lucide-react';
import { memberName, type TogetherState } from './model';
import { selectRoomResources } from './roomResources';
import { isPollClosed } from './polls';
import { koreaDay } from './discovery';
import './room-resources.css';

type Tab = 'ALL' | 'MEDIA' | 'POLLS' | 'NOTICES' | 'MEMBERS';
interface Props { state: TogetherState; userId: string; groupId: string; activityId?: string;
  onActivity: (id: string) => void; onParticipation: (tool: 'poll' | 'games' | 'challenges', id?: string) => void;
  onNotice: (id: string) => void; onTasks: () => void; onMembers: () => void; }
export default function RoomResourcesPanel({state,userId,groupId,activityId,onActivity,onParticipation,onNotice,onTasks,onMembers}:Props) {
  const [tab,setTab]=useState<Tab>('ALL');
  const value=selectRoomResources(state,userId,groupId,activityId);
  if(!value)return <p role="alert">이 대화방의 자료를 볼 수 없어요.</p>;
  const today=koreaDay(new Date());
  const planned=(item:typeof value.activities[number])=>item.status==='PLANNED'&&(!item.date||(item.endDate||item.date)>=today);
  const show=(id:Tab)=>tab==='ALL'||tab===id;
  const tabs:Array<{id:Tab;label:string}>=[{id:'ALL',label:'전체'},{id:'MEDIA',label:'사진·영상'},{id:'POLLS',label:'투표'},{id:'NOTICES',label:'공지'},{id:'MEMBERS',label:'멤버'}];
  return <div className="tg-room-resources"><p className="tg-room-resource-scope">{value.activity?.title||value.group.name} · {value.activity?'이 약속':'모임 전체 대화'}의 자료</p><div className="tg-resource-tabs" role="group" aria-label="모아볼 자료">{tabs.map(item=><button type="button" key={item.id} aria-pressed={tab===item.id} onClick={()=>setTab(item.id)}>{item.label}</button>)}</div>
    {tab==='ALL'&&<><section><h3><CalendarDays size={16}/>{activityId?'연결된 약속·여행':'모임의 약속·여행'}</h3>{value.activities.length?value.activities.slice().sort((a,b)=>Number(planned(b))-Number(planned(a))||(a.date||'9999').localeCompare(b.date||'9999')).map(item=><button className="tg-resource-row" type="button" key={item.id} onClick={()=>onActivity(item.id)}><span><strong>{item.title}</strong><small>{item.status==='CANCELLED'?'취소됨':item.status==='COMPLETED'||!planned(item)?`지난 약속 · ${item.date}`:item.date||'날짜 미정'}{item.startTime?` · ${item.startTime}`:''}</small></span><ChevronRight size={16}/></button>):<p>아직 만든 약속이 없어요.</p>}</section><div className="tg-resource-tools"><button type="button" onClick={onTasks}><ClipboardList size={18}/><span>준비물·할 일<small>{value.tasks.filter(item=>!item.completed).length}개 남음</small></span><ChevronRight size={16}/></button><button type="button" onClick={()=>onParticipation('games')}><Dices size={18}/><span>함께 놀기<small>결과 {value.games.length}개</small></span><ChevronRight size={16}/></button><button type="button" onClick={()=>onParticipation('challenges')}><Trophy size={18}/><span>챌린지<small>{value.challenges.length}개</small></span><ChevronRight size={16}/></button></div></>}
    {show('MEDIA')&&<section><h3><Image size={16}/>사진·영상 <span>{value.media.length}</span></h3>{value.media.length?<div className="tg-resource-media">{value.media.map(item=><figure key={item.id}>{item.kind==='VIDEO'?<video src={item.url} controls preload="metadata"/>:<a href={item.url} target="_blank" rel="noreferrer"><img src={item.url} alt={item.caption||'공유 사진'} loading="lazy"/></a>}<figcaption>{item.caption||memberName(state,item.authorId,groupId)}</figcaption></figure>)}</div>:<p>이 대화방 범위에 등록한 사진·영상이 없어요.</p>}</section>}
    {show('POLLS')&&<section><h3><BarChart3 size={16}/>투표 <span>{value.polls.length}</span></h3>{value.polls.length?value.polls.map(item=><button className="tg-resource-row" type="button" key={item.id} onClick={()=>onParticipation('poll',item.id)}><span><strong>{item.question}</strong><small>{item.confirmedOptionId?'결과 확정':isPollClosed(item)?'마감':'참여 가능'} · 선택지 {item.options.length}개</small></span><ChevronRight size={16}/></button>):<p>이 방에서 만든 투표가 없어요.</p>}</section>}
    {show('NOTICES')&&<section><h3><Bell size={16}/>공지 <span>{value.notices.length}</span></h3>{value.notices.length?value.notices.map(item=><button className="tg-resource-row" type="button" key={item.id} onClick={()=>onNotice(item.id)}><span><strong>{item.title}</strong><small>{item.body}</small></span><ChevronRight size={16}/></button>):<p>이 방의 공지가 없어요.</p>}</section>}
    {show('MEMBERS')&&<section><h3><Users size={16}/>모임 멤버 <span>{value.memberIds.length}</span></h3><div className="tg-resource-members">{value.memberIds.map(id=><span key={id}><span className="tg-avatar">{memberName(state,id,groupId).slice(0,1)}</span><strong>{memberName(state,id,groupId)}</strong><small>{id===value.group.ownerId?'모임장':value.group.managerIds.includes(id)?'운영진':'멤버'}</small></span>)}</div><button className="tg-resource-row" type="button" onClick={onMembers}><span>멤버·내 모임 프로필</span><ChevronRight size={16}/></button></section>}
  </div>;
}
