import { useEffect,useRef,useState } from 'react';
import { ArrowLeft,ExternalLink,Search } from 'lucide-react';
import { useLocale } from './locale';
import { Button } from './ui';
import { searchExternalPlaces,type ExternalPlaceResult } from './placeSearchService';
import { ServiceError } from './serviceRequest';
import { openExternal } from './nativeBridge';
import './frontend-completion.css';

export function ExternalPlaceSearch({region,initialQuery,onBack,search=searchExternalPlaces,endpoint=import.meta.env.VITE_PLACE_SEARCH_ENDPOINT??''}:{region:string;initialQuery:string;onBack:()=>void;search?:typeof searchExternalPlaces;endpoint?:string}) {
  const {locale}=useLocale(),en=locale==='en';
  const [query,setQuery]=useState(initialQuery),[results,setResults]=useState<ExternalPlaceResult[]>([]),[state,setState]=useState<'idle'|'loading'|'ready'|'error'>('idle'),[error,setError]=useState('');
  const pending=useRef<AbortController|null>(null),sequence=useRef(0);
  useEffect(()=>()=>{sequence.current++;pending.current?.abort();},[]);
  const cancel=()=>{sequence.current++;pending.current?.abort();pending.current=null;setState('idle');};
  const submit=async()=>{
    if(!query.trim()||state==='loading')return;
    const controller=new AbortController(),version=++sequence.current;pending.current?.abort();pending.current=controller;setState('loading');setError('');setResults([]);
    try{const r=await search(endpoint,`${region} ${query.trim()}`,controller.signal);if(version!==sequence.current||controller.signal.aborted)return;setResults(r.items);setState('ready');}
    catch(e){if(version!==sequence.current||controller.signal.aborted)return;setState('error');setError(e instanceof ServiceError&&e.status===429?(en?'Too many searches. Try again shortly.':'검색 요청이 많아요. 잠시 후 다시 시도해 주세요.'):(en?'Could not load results. Your search is kept.':'검색 결과를 불러오지 못했어요. 검색어는 유지했어요.'));}
    finally{if(version===sequence.current)pending.current=null;}
  };
  return <div className="plan-form external-place-search"><button className="plan-back" onClick={onBack}><ArrowLeft size={16}/>{en?'Back to nearby places':'주변 업체로 돌아가기'}</button>
    <form onSubmit={e=>{e.preventDefault();if(endpoint)void submit();else openExternal(`https://map.naver.com/p/search/${encodeURIComponent(`${region} ${query.trim()}`)}`);}}>
      <label className="nearby-search"><Search size={17}/><input aria-label={en?'Search NAVER places':'네이버 업체 검색'} value={query} maxLength={80} onChange={e=>{cancel();setResults([]);setQuery(e.target.value);}} placeholder={en?'Place name':'업체명'}/></label>
      <Button size="compact" variant="secondary" type="submit" disabled={!query.trim()} loading={state==='loading'}><ExternalLink size={14}/>{endpoint?(en?'Search':'검색'):(en?'Search on NAVER Map':'네이버 지도에서 찾기')}</Button>
    </form>
    {!endpoint&&<p className="plan-help">{en?'Open NAVER Map to check the place. Return here to continue your itinerary.':'네이버 지도를 열어 업체를 확인해요. 돌아오면 보던 일정을 계속 만들 수 있어요.'}</p>}
    {state==='loading'&&<Button size="compact" variant="ghost" onClick={cancel}>{en?'Cancel search':'검색 취소'}</Button>}
    {state==='error'&&<div role="alert"><p className="ui-error">{error}</p><Button size="compact" variant="secondary" onClick={()=>void submit()}>{en?'Try again':'다시 시도'}</Button></div>}
    {state==='ready'&&<><p className="plan-help">NAVER · {en?'External search results':'외부 검색 결과'}</p>{results.length?results.map((item,i)=><article className="external-place-result" key={`${i}:${item.url}`}><strong>{item.name}</strong><small>{item.category}</small><p>{item.address}</p><button className="outline" onClick={()=>openExternal(item.url)}><ExternalLink size={14}/>{en?'View source':'원문 보기'}</button></article>):<div className="empty"><Search size={22}/><strong>{en?'No matching places':'검색 결과가 없어요'}</strong><p>{en?'Try another name or a more specific area.':'다른 업체명이나 더 구체적인 지역으로 찾아보세요.'}</p></div>}</>}
  </div>;
}
