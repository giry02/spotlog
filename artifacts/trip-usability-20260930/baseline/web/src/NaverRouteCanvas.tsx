import { useEffect,useRef,useState } from 'react';
import type { Place } from './data';
import { loadNaverMap,watchNaverMapFailure } from './naverMap';
import { useLocale } from './locale';

export function NaverRouteCanvas({places,numbers,selectedVisitId,onSelectVisit,coordinates,clientId}:{places:Place[];numbers?:number[];selectedVisitId?:string;onSelectVisit?:(id:string)=>void;coordinates:Array<[number,number]>;clientId:string}) {
  const {locale}=useLocale(),en=locale==='en';
  const container=useRef<HTMLDivElement>(null);
  const nodes=useRef(new Map<string,HTMLElement>());
  const current=useRef({onSelectVisit,selectedVisitId});current.current={onSelectVisit,selectedVisitId};
  const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading');
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    let disposed=false,cleanup=()=>{};setStatus('loading');nodes.current.clear();
    const unwatch=watchNaverMapFailure(()=>{if(!disposed){cleanup();cleanup=()=>{};setStatus('error');}});
    void loadNaverMap(clientId).then(maps=>{
      if(disposed||!container.current||!places.length)return;
      const target=container.current;
      const points=places.map(p=>new maps.LatLng(p.lat,p.lng));
      const map=new maps.Map(target,{center:points[0],zoom:12,scaleControl:true,logoControl:true,mapDataControl:true});
      const markers:Array<{setMap(map:null):void}>=[];
      let line:{setMap(map:null):void}|null=null,observer:ResizeObserver|null=null,cleaned=false;
      cleanup=()=>{if(cleaned)return;cleaned=true;observer?.disconnect();markers.forEach(m=>m.setMap(null));line?.setMap(null);map.destroy();};
      places.forEach((place,index)=>{
        const number=numbers?.[index]??index+1;
        const node=document.createElement('button');node.type='button';node.className='route-marker';node.textContent=String(number);
        node.setAttribute('aria-label',`${number}. ${place.name}`);node.dataset.selected=String(current.current.selectedVisitId===place.visitId);
        node.setAttribute('aria-pressed',String(current.current.selectedVisitId===place.visitId));
        if(place.visitId){nodes.current.set(place.visitId,node);node.onclick=()=>current.current.onSelectVisit?.(place.visitId!);}
        markers.push(new maps.Marker({map,position:points[index],title:place.name,icon:{content:node,anchor:new maps.Point(15,15)}}));
      });
      line=coordinates.length>1?new maps.Polyline({map,path:coordinates.map(([lng,lat])=>new maps.LatLng(lat,lng)),strokeColor:'#ff4f35',strokeWeight:5,strokeOpacity:0.9}):null;
      if(points.length>1)map.fitBounds(points,{top:34,right:34,bottom:34,left:34,maxZoom:15});
      observer=new ResizeObserver(()=>map.autoResize());observer.observe(target);
      setStatus('ready');
    }).catch(()=>{if(!disposed){cleanup();cleanup=()=>{};setStatus('error');}});
    return()=>{disposed=true;unwatch();cleanup();};
  },[places,numbers,coordinates,clientId,attempt]);
  useEffect(()=>{nodes.current.forEach((node,id)=>{node.dataset.selected=String(id===selectedVisitId);node.setAttribute('aria-pressed',String(id===selectedVisitId));});},[selectedVisitId]);
  return <div className="route-provider"><div className="route-map" ref={container} aria-label={en?'Trip map':'여행 지도'}/>{status!=='ready'&&<div className="route-provider-state" role="status"><p>{status==='loading'?(en?'Loading map…':'지도를 불러오는 중…'):(en?'The map could not be loaded. Your place list is still available.':'지도를 불러오지 못했어요. 장소 목록은 계속 사용할 수 있어요.')}</p>{status==='error'&&<button className="outline" onClick={()=>setAttempt(n=>n+1)}>{en?'Try again':'다시 시도'}</button>}</div>}</div>;
}
