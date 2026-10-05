import { useUiCopy } from './frontendCopy';
import { TranslationText } from './TranslationText';
import { sourceVersion } from './travelGuide';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {ImagePlus,ArrowUp,ArrowDown,X} from 'lucide-react';
import type {StoryBlock} from './data';
import {StoryPhoto} from './PublicTourismCredit';
export const blockImages=(block:StoryBlock)=>block.images??(block.image?[{id:`${block.id}:photo`,image:block.image,caption:block.caption??''}]:[]);
export function JournalPhotos({block}:{block:StoryBlock}){
  const copy=useUiCopy();
  const photos=blockImages(block),rail=useRef<HTMLDivElement>(null),drag=useRef<{x:number;scroll:number}|null>(null),[index,setIndex]=useState(0);
  if(!photos.length)return null;
  return <div className="journal-gallery"><div className="journal-photo-rail" ref={rail} tabIndex={photos.length>1?0:undefined} aria-label={`여행 사진 ${photos.length}장. 좌우로 넘기기`} onKeyDown={event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();rail.current?.scrollBy({left:rail.current.clientWidth*(event.key==='ArrowLeft'?-1:1),behavior:'smooth'});}}} onScroll={event=>setIndex(Math.min(photos.length-1,Math.round(event.currentTarget.scrollLeft/event.currentTarget.clientWidth)))}
    onPointerDown={event=>{if(event.pointerType!=='mouse'||event.button!==0||(event.target as HTMLElement).closest('button,a'))return;drag.current={x:event.clientX,scroll:event.currentTarget.scrollLeft};event.currentTarget.style.scrollSnapType='none';event.currentTarget.setPointerCapture(event.pointerId);}}
    onPointerMove={event=>{if(drag.current){event.preventDefault();event.currentTarget.scrollLeft=drag.current.scroll+drag.current.x-event.clientX;}}}
    onPointerUp={event=>{if(!drag.current)return;drag.current=null;const el=event.currentTarget;el.style.scrollSnapType='x mandatory';el.scrollTo({left:Math.round(el.scrollLeft/el.clientWidth)*el.clientWidth,behavior:'smooth'});}}
    onPointerCancel={event=>{drag.current=null;event.currentTarget.style.scrollSnapType='x mandatory';}} onDragStart={event=>event.preventDefault()}>{photos.map(photo=><div className="journal-photo-slide" key={photo.id}><StoryPhoto image={photo.image} caption={photo.caption}/>{photo.caption && <TranslationText sourceId={`${block.id}:${photo.id}`} sourceVersion={sourceVersion(photo.caption)} text={photo.caption} kind="caption" showOriginal={false}/>}</div>)}</div>{photos.length>1&&<p className="journal-photo-position" aria-live="polite">{index+1} / {photos.length}{' '}{copy("· 옆으로 사진 넘기기")}</p>}</div>;
}
export function JournalImageEditor({block,toolbar,onUpdate,onCover,resize}:{block:StoryBlock;toolbar:ReactNode;onUpdate:(patch:Partial<StoryBlock>)=>void;onCover:(image:string)=>void;resize:(file:File)=>Promise<string>}){
  const copy=useUiCopy();
  const photos=blockImages(block),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return ()=>{mounted.current=false;};},[]);
  const save=(next:typeof photos)=>{if(mounted.current)onUpdate({images:next,image:next[0]?.image??'',caption:next[0]?.caption??''});};
  const move=(index:number,direction:number)=>{const next=[...photos],target=index+direction;if(target<0||target>=next.length)return;[next[index],next[target]]=[next[target],next[index]];save(next);};
  return <article className="editor-image-block"><div className="block-toolbar"><span><ImagePlus size={13}/>{copy("사진")}{' '}{photos.length}/8</span>{toolbar}</div>
    {photos.map((photo,index)=><div className="journal-edit-photo" key={photo.id}><img src={photo.image} alt={`여행 사진 ${index+1}`}/><input disabled={busy} aria-label={`사진 ${index+1} 설명`} value={photo.caption} onChange={event=>save(photos.map(item=>item.id===photo.id?{...item,caption:event.target.value}:item))}/><div className="journal-photo-actions"><button disabled={busy||index===0} aria-label={`사진 ${index+1} 앞으로`} onClick={()=>move(index,-1)}><ArrowUp size={16}/></button><button disabled={busy||index===photos.length-1} aria-label={`사진 ${index+1} 뒤로`} onClick={()=>move(index,1)}><ArrowDown size={16}/></button><button disabled={busy} onClick={()=>onCover(photo.image)}>{copy("여행기 표지로")}</button><button disabled={busy} aria-label={`사진 ${index+1} 삭제`} onClick={()=>save(photos.filter(item=>item.id!==photo.id))}><X size={16}/></button></div></div>)}
    {photos.length<8&&<label className="image-upload"><ImagePlus size={25}/><strong>{busy?copy("사진을 준비하고 있어요"):copy("여행 사진 추가")}</strong><small>{copy("여러 장 선택 · 카드마다 최대 8장")}</small><input type="file" accept="image/*" multiple disabled={busy} onChange={async event=>{const files=Array.from(event.target.files??[]);event.target.value='';if(!files.length)return;if(photos.length+files.length>8){setError(copy("한 카드에는 사진을 8장까지 넣을 수 있어요."));return;}setBusy(true);setError('');try{const next=[...photos];for(const file of files){if(!file.type.startsWith('image/')||file.size>20*1024*1024)throw new Error('20MB 이하의 사진 파일을 선택해 주세요.');next.push({id:crypto.randomUUID(),image:await resize(file),caption:''});}save(next);}catch(error){setError(error instanceof Error?error.message:copy("사진을 불러오지 못했어요. 다시 선택해 주세요."));}finally{setBusy(false);}}}/></label>}
    {error&&<p className="ui-error" role="alert">{error}</p>}
  </article>;
}
