'use client';
import { useState } from 'react';
import type { RegisteredPhoto } from '@/lib/registered-catalog';
import { PhotoSourceButton } from './photo-source-modal';

export function RegisteredPhotoGallery({photos,name}:{photos:readonly RegisteredPhoto[];name:string}){
  const [active,setActive]=useState(0);
  const [failedPhotoId,setFailedPhotoId]=useState<string|null>(null);
  const photo=photos[Math.min(active,Math.max(0,photos.length-1))];
  if(!photo)return <p className="tr-meta">등록된 실제 사진이 없어요. 다른 장소의 사진으로 대신하지 않습니다.</p>;
  return <div className="tr-registered-gallery"><figure className="tr-detail-photo">
    {failedPhotoId!==photo.id?<img src={photo.image} alt={photo.title||name} width={600} height={320} loading="lazy" onError={()=>setFailedPhotoId(photo.id)}/>:<div className="tr-empty"><span>사진을 불러오지 못했어요.</span><button onClick={()=>setFailedPhotoId(null)}>다시 보기</button></div>}
    <figcaption>{photo.title} · {photo.author||photo.owner}</figcaption>
  </figure>
  {photos.length>1&&<div className="tr-photo-dots" role="group" aria-label={`${name} 사진 선택`}>{photos.map((p,i)=><button key={p.id} aria-label={`${i+1}번째 사진`} aria-pressed={active===i} onClick={()=>{setActive(i);setFailedPhotoId(null);}}>{i+1}</button>)}</div>}
  <PhotoSourceButton key={photo.id} photo={photo} name={name}/>
  </div>;
}
