'use client';
import { useState } from 'react';
import { ArrowUpRight, Link2, Share2 } from 'lucide-react';
import { Button } from './ui/button';
import { SPOTLOG_TARGETS, SPOTLOG_ENTRIES, SPOTLOG_ENTRY_TARGETS, buildSpotlogConnectUrl, executeSpotlogAction, executeSpotlogDraftHandoff, requestSpotlogContext, type SpotlogContext, type SpotlogContextScope, type SpotlogTarget, type SpotlogEntry, type SpotlogOpenAction } from '@/lib/spotlog-app-bridge';
import { buildSpotlogDraftFromTrip } from '@/lib/spotlog-draft-handoff';
import type { TripState } from '@/lib/trip-engine';
import { visitName } from '@/lib/trip-engine';
import { tripDayDate } from './trip-edit-controls';
import './spotlog-app-features.css';

export function SpotlogNavigationCard({state}:{state:TripState}){
  const nav=state.spotlogNavigation;
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  if(!nav)return null;
  return <section className="tr-unit tr-app-navigation"><h3><Link2 size={18}/>{nav.entry?SPOTLOG_ENTRIES[nav.entry]:SPOTLOG_TARGETS[nav.target]}</h3><p className="tr-feature-note">Spotlog의 기존 화면에서 이어서 진행하세요. 계정 변경·게시·신고 접수는 앱에서 확인합니다.</p>
    <Button className="tr-primary" disabled={busy} onClick={async()=>{setBusy(true);try{const result=await executeSpotlogAction({type:'open_spotlog',...nav});setMessage(result.message);}finally{setBusy(false);}}}>Spotlog에서 열기 <ArrowUpRight size={15}/></Button>
    {message&&<p role="status" className="tr-meta">{message}</p>}
  </section>;
}

export function TripAppActions({state}:{state:TripState}){
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const entries:SpotlogEntry[]=['journal-text','journal-photos','journal-draft','journal-preview','journal-visibility','place-comment','place-reaction','journey-comment','journey-cheer','personal-place'];
  async function open(entry:SpotlogEntry){setBusy(true);try{const selected=state.plan.find(v=>v.id===state.editingId)??state.plan.find(v=>v.day===state.activeDay&&v.kind==='place');const action:SpotlogOpenAction={type:'open_spotlog',target:SPOTLOG_ENTRY_TARGETS[entry],entry,day:state.activeDay,...(['place-comment','place-reaction'].includes(entry)&&selected?.entityId?{placeId:selected.entityId}:{})};setMessage((await executeSpotlogAction(action)).message);}catch(error){setMessage(error instanceof Error?error.message:'앱 연결을 확인해 주세요.');}finally{setBusy(false);}}
  async function handoff(){setBusy(true);try{await executeSpotlogDraftHandoff(buildSpotlogDraftFromTrip(state),{type:'open_spotlog',target:'trips',day:state.activeDay});setMessage('확인한 전체 일정을 앱의 새 비공개 DRAFT 사본으로 추가했어요. 원본은 유지되며, 앱에서 완료한 뒤 여행기로 기록할 수 있어요.');}catch(error){setMessage(error instanceof Error?error.message:'새 초안을 가져오지 못했어요.');}finally{setBusy(false);}}
  return <section className="tr-app-connect"><h3>DAY {state.activeDay} · 앱에서 이어서 하기</h3><p className="tr-meta">챗봇 일정과 앱 여행은 서로 다른 기록이에요. 앱에서 연결할 여행과 DAY를 직접 선택해 주세요.</p><div className="tr-edit-tool-row">{entries.map(entry=><button key={entry} disabled={busy} onClick={()=>open(entry)}>{SPOTLOG_ENTRIES[entry]}</button>)}</div>{state.plan.length>0&&<button className="tr-text-link" disabled={busy} onClick={handoff}>현재 전체 일정을 새 비공개 초안으로 가져오기 <ArrowUpRight size={15}/></button>}<p className="tr-meta">새 사본 가져오기는 앱 안의 연결 화면에서만 가능해요. 사진·메모·예약 정보는 전달하지 않으며, 전체 DAY와 미확인 장소를 확인한 뒤 승인합니다.</p>{message&&<p role="status" className="tr-feature-note">{message}</p>}</section>;
}

export function SpotlogAppFeaturePanel({state}:{state?:TripState}={}){
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[context,setContext]=useState<SpotlogContext|null>(null);
  async function open(target:SpotlogTarget){setBusy(true);try{setMessage((await executeSpotlogAction({type:'open_spotlog',target})).message);}finally{setBusy(false);}}
  async function purposeEntry(entry:SpotlogEntry){setBusy(true);try{setMessage((await executeSpotlogAction({type:'open_spotlog',target:SPOTLOG_ENTRY_TARGETS[entry],entry})).message);}finally{setBusy(false);}}
  async function read(scope:SpotlogContextScope){setBusy(true);setMessage('앱에서 공유할 기록을 선택하고 확인해 주세요.');try{const result=await requestSpotlogContext(scope);setContext(result);setMessage('선택해 승인한 앱 기록을 읽었어요. 원본 일정과 계정은 변경하지 않았어요.');}catch(error){setMessage(error instanceof Error?error.message:'앱 연결을 확인해 주세요.');}finally{setBusy(false);}}
  return <div className="tr-app-feature-panel">
    <p className="tr-feature-note">사진·영상·여행기·댓글은 익숙한 Spotlog 화면에서 이어서 사용하세요. 실제 로그인·게시·신고 서버는 연결 준비가 필요합니다.</p>
    <div className="tr-app-feature-grid">{Object.entries(SPOTLOG_TARGETS).map(([target,label])=><button key={target} disabled={busy} onClick={()=>open(target as SpotlogTarget)}><span>{label}</span><ArrowUpRight size={15}/></button>)}</div>
    {state&&<TripAppActions state={state}/>}
    <section className="tr-app-connect"><h3>공개 여행에 반응하기</h3><div className="tr-edit-tool-row">{(['place-reaction','place-comment','journey-comment','journey-cheer'] as SpotlogEntry[]).map(entry=><button key={entry} disabled={busy} onClick={()=>purposeEntry(entry)}>{SPOTLOG_ENTRIES[entry]}</button>)}</div><p className="tr-meta">앱의 공개 여행기와 실제 장소 카드를 선택한 뒤 직접 반응해 주세요. 좋아요·응원·댓글은 자동으로 남기지 않아요.</p></section>
    <section className="tr-app-connect"><h3>프로필과 기기 활동</h3><div className="tr-edit-tool-row">{(['profile-summary','profile-activity'] as SpotlogEntry[]).map(entry=><button key={entry} disabled={busy} onClick={()=>purposeEntry(entry)}>{SPOTLOG_ENTRIES[entry]}</button>)}</div><p className="tr-meta">로그인 상태를 앱에서 확인해요. 기기 검수 프로필·등급·통계는 실제 회원의 서버 활동과 구분됩니다.</p></section>
    <section className="tr-app-connect"><h3>계정에서 직접 확인</h3><div className="tr-edit-tool-row">{(['account-email','account-reset','account-logout','account-delete'] as SpotlogEntry[]).map(entry=><button key={entry} disabled={busy} onClick={()=>purposeEntry(entry)}>{SPOTLOG_ENTRIES[entry]}</button>)}</div><p className="tr-meta">화면만 열며 이메일 발송·로그아웃·탈퇴를 자동 실행하지 않아요. 실제 회원 서버 연결이 필요합니다.</p></section>
    <section className="tr-app-connect"><h3><Link2 size={17}/>앱에 저장한 기록 연결</h3>
      <p className="tr-meta">앱 안에서 챗봇을 함께 열면 선택한 여행·DAY·찜만 확인 후 공유할 수 있어요. 회원 로그인이나 서버 동기화와는 별개입니다.</p>
      <a className="tr-text-link" href={buildSpotlogConnectUrl()} target="_blank" rel="noreferrer">앱 안에서 연결해서 열기 <ArrowUpRight size={15}/></a>
      <div className="tr-edit-tool-row"><button disabled={busy} onClick={()=>read('selected-trip')}>선택한 여행 읽기</button><button disabled={busy} onClick={()=>read('selected-day')}>선택한 DAY 읽기</button><button disabled={busy} onClick={()=>read('saved-places')}>앱 찜 읽기</button></div>
      {context&&<div className="tr-app-context"><strong>{context.journey?.title??'앱에 찜한 장소'}</strong><p className="tr-meta">{context.account==='verified-member'?'회원 확인된 앱에서 공유':context.account==='local-review'?'로컬 검수 계정의 기기 기록':'비회원의 기기 기록'}</p>{context.journey?.days.map(day=><div key={day.day}><b>DAY {day.day}</b><ul>{day.places.map((p,i)=><li key={`${p.id}-${i}`}>{p.name} · {p.area}</li>)}</ul></div>)}{context.places&&<ul>{context.places.map(p=><li key={p.id}>{p.name} · {p.area}</li>)}</ul>}<small>읽은 기록의 확인 화면입니다. 앱 원본을 챗봇 저장소로 자동 덮어쓰지 않습니다.</small></div>}
    </section>
    {message&&<p role="status" className="tr-feature-note">{message}</p>}
  </div>;
}

export function TripTextShare({state}:{state:TripState}){
  const [message,setMessage]=useState('');
  const title=state.title||`${state.region??''} ${state.days}일 여행`;
  async function share(){
    const text=[title,...Array.from({length:state.days},(_,i)=>{const day=i+1;return `DAY ${day} ${tripDayDate(state.startDate,day)}\n${state.plan.filter(v=>v.day===day).map(v=>`${v.time?`${v.time} `:''}${visitName(v)}`).join(' → ')}`;})].join('\n\n');
    try{if(navigator.share){await navigator.share({title,text});setMessage('여행 내용을 공유했어요.');}else{await navigator.clipboard.writeText(text);setMessage('여행 경로를 복사했어요.');}}catch(error){if(!(error instanceof DOMException&&error.name==='AbortError'))setMessage('공유하지 못했어요. 기기의 공유·복사 권한을 확인해 주세요.');}
  }
  return <div><button className="tr-text-link" onClick={share}><Share2 size={15}/>여행 경로 공유·복사</button>{message&&<p role="status" className="tr-meta">{message}</p>}</div>;
}
