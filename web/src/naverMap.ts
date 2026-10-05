/** Browser-safe Maps client ID only. REST/API HUB secrets never belong here. */
export interface NaverPoint {}
interface NaverMap { destroy():void; fitBounds(points:NaverPoint[], options:Record<string,number>):void; setCenter(point:NaverPoint):void; autoResize():void }
interface NaverMarker { setMap(map:NaverMap|null):void }
export interface NaverMaps {
  Map:new(element:HTMLElement,options:Record<string,unknown>)=>NaverMap;
  LatLng:new(lat:number,lng:number)=>NaverPoint;
  Point:new(x:number,y:number)=>NaverPoint;
  Marker:new(options:Record<string,unknown>)=>NaverMarker;
  Polyline:new(options:Record<string,unknown>)=>{setMap(map:NaverMap|null):void};
}
declare global { interface Window { naver?:{maps:NaverMaps}; navermap_authFailure?:()=>void } }
let pending:Promise<NaverMaps>|null=null;
let authFailed=false;
const failureListeners=new Set<()=>void>();
export function watchNaverMapFailure(listener:()=>void):()=>void {
  failureListeners.add(listener);
  return ()=>{failureListeners.delete(listener);};
}
export function loadNaverMap(clientId:string):Promise<NaverMaps> {
  if(!clientId.trim())return Promise.reject(new Error('missing-client-id'));
  if(pending)return pending;
  if(window.naver?.maps&&!authFailed)return Promise.resolve(window.naver.maps);
  pending=new Promise<NaverMaps>((resolve,reject)=>{
    const script=document.createElement('script');
    let settled=false;
    const finish=(error?:Error)=>{
      if(settled)return;settled=true;clearTimeout(timer);
      script.onload=null;script.onerror=null;
      if(error){script.remove();pending=null;reject(error);}else {authFailed=false;resolve(window.naver!.maps);}
    };
    const timer=setTimeout(()=>finish(new Error('map-timeout')),10000);
    // Authentication can fail after the script's load event or map construction.
    window.navermap_authFailure=()=>{
      authFailed=true;pending=null;
      failureListeners.forEach(listener=>listener());
      finish(new Error('map-authorization'));
    };
    script.async=true;
    script.src=`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}`;
    script.onerror=()=>finish(new Error('map-network'));
    script.onload=()=>finish(window.naver?.maps?undefined:new Error('map-unavailable'));
    document.head.append(script);
  });
  return pending;
}
