'use client';
import { useRef, useState } from 'react';
import { Check, Copy, MapPin, Share2, Type } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { entityShareInfo, entityShareText, tripShareText, type TripShareScope } from '@/lib/trip-sharing';
import type { TripState } from '@/lib/trip-engine';
import './trip-share-controls.css';

function useShare() {
  const [message, setMessage] = useState('');
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setMessage('텍스트를 복사했어요. 원하는 곳에 붙여 넣으세요.'); }
    catch { setMessage('복사 권한을 확인하거나 미리보기의 텍스트를 직접 선택해 주세요.'); }
  }
  async function share(title: string, text: string) {
    if (!navigator.share) { await copy(text); return; }
    try { await navigator.share({ title, text }); setMessage('기기의 공유 동작을 마쳤어요.'); }
    catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) setMessage('공유하지 못했어요. 텍스트를 복사해 이용할 수 있어요.'); }
  }
  return { message, setMessage, copy, share };
}

export function TripShareControls({ state, day }: { state: TripState; day?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false), [container, setContainer] = useState<HTMLElement | null>(null);
  const [kind, setKind] = useState<'trip' | 'day'>('trip'), [selectedDay, setSelectedDay] = useState(day ?? state.activeDay);
  const [includeNotes, setIncludeNotes] = useState(false);
  const sharing = useShare();
  const scope: TripShareScope = kind === 'trip' ? { kind: 'trip' } : { kind: 'day', day: Math.min(selectedDay, state.days) };
  const text = tripShareText(state, scope, { includeNotes });
  return <div ref={ref} className="tr-share-controls">
    <button className="tr-text-link" disabled={!state.plan.length} onClick={() => { setContainer(ref.current?.closest<HTMLElement>('[data-spotlog-device]') ?? null); setSelectedDay(day ?? state.activeDay); setIncludeNotes(false); sharing.setMessage(''); setOpen(true); }}><Share2 size={15}/>여행·DAY 경로 공유</button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent presentation="bottom-sheet" className="tr-sheet tr-share-sheet" portalContainer={container ?? undefined}>
      <div className="tr-sheet-handle" aria-hidden="true"/><DialogHeader><DialogTitle>여행 경로 공유</DialogTitle><DialogDescription>보낼 범위와 내용을 확인하세요. 공개 게시나 공유 링크를 생성하지 않습니다.</DialogDescription></DialogHeader>
      <div className="sheet-body tr-share-form">
        <div className="tr-pills" aria-label="공유할 범위"><button aria-pressed={kind==='trip'} onClick={()=>setKind('trip')}>전체 여행</button><button aria-pressed={kind==='day'} onClick={()=>setKind('day')}>DAY 하나</button></div>
        {kind==='day'&&<label>공유할 DAY<select value={selectedDay} onChange={e=>setSelectedDay(Number(e.target.value))}>{Array.from({length:state.days},(_,i)=><option key={i+1} value={i+1}>DAY {i+1}</option>)}</select></label>}
        {state.plan.some(v=>v.note)&&<label className="tr-edit-check"><input type="checkbox" checked={includeNotes} onChange={e=>setIncludeNotes(e.target.checked)}/>개인 메모도 포함</label>}
        <label>공유할 텍스트<textarea readOnly rows={9} value={text}/></label>
        <p className="tr-meta">기본 내용에는 개인 메모·계정 정보·예약 세부사항을 넣지 않아요. 실제 주소가 있는 장소만 주소와 지도 링크를 넣습니다.</p>
        <div className="tr-share-buttons"><Button variant="outline" onClick={()=>sharing.copy(text)}><Copy size={16}/>텍스트 복사</Button><Button onClick={()=>sharing.share(state.title||'여행 경로',text)}><Share2 size={16}/>기기로 공유</Button></div>
        {sharing.message&&<p role="status" className="tr-share-feedback"><Check size={16}/>{sharing.message}</p>}
      </div>
    </DialogContent></Dialog>
  </div>;
}

export function EntityShareControls({ id }: { id: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false), [largeAddress, setLargeAddress] = useState(false), [container, setContainer] = useState<HTMLElement | null>(null);
  const sharing = useShare(), item = entityShareInfo(id);
  if (!item) return null;
  function show(address: boolean) { setContainer(ref.current?.closest<HTMLElement>('[data-spotlog-device]') ?? null); setLargeAddress(address); sharing.setMessage(''); setOpen(true); }
  const text = largeAddress ? `${item.name}\n${item.address}` : entityShareText(id);
  return <div ref={ref} className="tr-entity-share">
    <div className="tr-edit-tool-row"><button onClick={()=>show(false)}><Share2 size={16}/>장소 정보 공유</button>{item.address&&<button onClick={()=>show(true)}><Type size={16}/>주소 크게 보기</button>}</div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent presentation="bottom-sheet" className="tr-sheet tr-share-sheet" portalContainer={container ?? undefined}>
      <div className="tr-sheet-handle" aria-hidden="true"/><DialogHeader><DialogTitle>{largeAddress?'주소 크게 보기':'장소 정보 공유'}</DialogTitle><DialogDescription>{largeAddress?'확인된 등록 주소입니다. 건물 입구와 현재 운영 여부는 별도로 확인하세요.':'확인한 뒤 텍스트를 복사하거나 기기로 공유하세요.'}</DialogDescription></DialogHeader>
      <div className="sheet-body tr-share-form">{largeAddress?<div className="tr-large-address"><MapPin size={24}/><h3>{item.name}</h3><p>{item.address}</p></div>:<label>공유할 텍스트<textarea readOnly rows={7} value={text}/></label>}
        <div className="tr-share-buttons"><Button variant="outline" onClick={()=>sharing.copy(text)}><Copy size={16}/>{largeAddress?'주소 복사':'텍스트 복사'}</Button><Button onClick={()=>sharing.share(item.name,text)}><Share2 size={16}/>기기로 공유</Button></div>
        {sharing.message&&<p role="status" className="tr-share-feedback"><Check size={16}/>{sharing.message}</p>}
      </div>
    </DialogContent></Dialog>
  </div>;
}
