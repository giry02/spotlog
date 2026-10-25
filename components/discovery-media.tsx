'use client';
import { useState } from 'react';
import { Image, Play, Pause, ArrowUpRight, MapPin } from 'lucide-react';
import type { TripAction, TripState } from '@/lib/trip-engine';
import { REGIONS } from '@/lib/trip-data';
import { discoveryMediaResults,MEDIA_KIND_LABELS,mediaCatalogSummary } from '@/lib/discovery-media';
import type { RegisteredKind } from '@/lib/registered-catalog';
import { RegisteredPhotoGallery } from './registered-photo-gallery';
import { buildSpotlogAppUrl } from '@/lib/spotlog-app-bridge';
import './discovery-media.css';

export function DiscoveryMediaUnit({state,act,onEntityDetail}:{state:TripState;act:(action:TripAction)=>void;onEntityDetail:(id:string,state:TripState)=>void}){
  const [playing,setPlaying]=useState(false);
  const [visibleCount,setVisibleCount]=useState(6);
  const motion=state.mediaMode==='motion';
  const results=discoveryMediaResults(state);
  const summary=mediaCatalogSummary();
  const blockedRegion=(region:string)=>Boolean((state.plan.length||(state.collectedIds?.length??0))&&state.region&&state.region!==region);
  const filter=(value:{mode?:'photos'|'motion';region?:typeof state.mediaRegion;kind?:RegisteredKind|'all'})=>act({type:'media',mode:value.mode??state.mediaMode??'photos',...(value.region!==undefined?{region:value.region}:{}),...(value.kind!==undefined?{kind:value.kind}:{})});
  return <section className="tr-unit tr-discovery-media">
    <div className="tr-unit-heading"><span>{motion?<Play size={16}/>:<Image size={16}/>}사진으로 장소 발견</span><div><h2>{motion?'사진에 움직임을 더해 보기':'실제 등록 사진 둘러보기'}</h2><small>{results.length}곳</small></div></div>
    <p className="tr-meta">등록 사진 {summary.photos}장 · 장소별 사진 출처를 확인할 수 있어요. 현재 모습·영업 여부를 보장하지 않습니다.</p>
    <div className="tr-pills" aria-label="사진 보기 방식"><button aria-pressed={!motion} onClick={()=>filter({mode:'photos'})}>사진 피드</button><button aria-pressed={motion} onClick={()=>filter({mode:'motion'})}>포토모션</button></div>
    <div className="tr-pills" aria-label="사진 지역">{([null,...REGIONS] as const).map(region=><button key={region??'all'} aria-pressed={(state.mediaRegion??null)===region} onClick={()=>filter({region})}>{region??'전체 지역'}</button>)}</div>
    <div className="tr-pills" aria-label="사진 장소 종류">{(Object.entries(MEDIA_KIND_LABELS) as [RegisteredKind|'all',string][]).map(([kind,label])=><button key={kind} aria-pressed={(state.mediaKind??'all')===kind} onClick={()=>filter({kind})}>{label}</button>)}</div>
    {motion&&<div className="tr-photo-motion-controls"><p>실제 촬영 영상이 아니라 등록 사진의 포토모션입니다. 화면에서 사진을 확대하는 움직임만 더하며 원본 파일을 변경하지 않습니다. 움직임 줄이기 설정을 따르고 영상 파일을 생성하지 않아요.</p><button onClick={()=>setPlaying(value=>!value)}>{playing?<Pause size={15}/>:<Play size={15}/>}포토모션 {playing?'일시정지':'재생'}</button></div>}
    <div className="tr-photo-feed">{results.slice(0,visibleCount).map(entity=><article key={entity.id} className={motion&&playing?'tr-photo-feed-item is-motion-playing':'tr-photo-feed-item'}><div className="tr-photo-feed-title"><span>{MEDIA_KIND_LABELS[entity.kind]} · {entity.region}</span><h3>{entity.name}</h3><p><MapPin size={13}/>{entity.address}</p></div><RegisteredPhotoGallery key={entity.id} name={entity.name} photos={entity.photos}/><p className="tr-photo-feed-description">{entity.description}</p><div className="tr-photo-feed-actions"><button onClick={()=>onEntityDetail(entity.id,state)}>상세·방문 정보</button><button disabled={blockedRegion(entity.region)} onClick={()=>act({type:'collect-entity',id:entity.id})}>{blockedRegion(entity.region)?'현재 여행과 다른 지역':state.collectedIds?.includes(entity.id)?'담았어요':'내 여행에 담기'}</button></div>{blockedRegion(entity.region)&&<p className="tr-meta">현재 {state.region} 여행은 유지돼요. 다른 지역 장소를 담으려면 새 여행을 시작해 주세요.</p>}</article>)}</div>
    {visibleCount<results.length&&<button className="tr-text-link" onClick={()=>setVisibleCount(count=>count+6)}>다음 사진 장소 더 보기 ({results.length-visibleCount}곳)</button>}
    {!results.length&&<p className="tr-empty-copy">이 지역·종류에 출처가 확인된 등록 사진이 없어요. 다른 지역 사진으로 대신하지 않습니다.</p>}
    <a className="tr-text-link" href={buildSpotlogAppUrl({type:'open_spotlog',target:'videos'})} target="_blank" rel="noreferrer">Spotlog 앱 영상 화면 열기 <ArrowUpRight size={15}/></a>
    <p className="tr-meta">여기에는 실제 영상 자료가 없습니다. 앱 영상 화면은 별도로 열리며 사진을 실제 영상이라고 표시하지 않아요.</p>
  </section>;
}
