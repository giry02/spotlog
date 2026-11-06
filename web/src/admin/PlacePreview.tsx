import { useState } from 'react';
import { Bookmark, MapPin, Volume2, VolumeX, ChevronLeft, ChevronRight } from 'lucide-react';
import type { PlaceContent } from './types';
import { kindLabel, Badge } from './components';
import { safeSourceUrl, safeAssetUrl } from './selectors';

export function safeMediaUrl(value: string): string {
  return value === '/admin-review.svg' ? import.meta.env.BASE_URL + 'admin-review.svg' : safeAssetUrl(value);
}
export default function PlacePreview({ content, choices=[] }: { content: PlaceContent; choices?: PlaceContent[] }) {
  const [area, setArea] = useState(content.area), [selection,setSelection] = useState(content.name), [showRegions,setShowRegions] = useState(false);
  const all = [content,...choices.filter(candidate => candidate !== content && candidate.name !== content.name)], regions = [...new Set(all.map(candidate => candidate.area))];
  const candidates = all.filter(candidate => candidate.area === area), active = candidates.find(candidate => candidate.name === selection) ?? candidates[0] ?? content;
  return <div><div className="admin-actions"><button onClick={() => setShowRegions(!showRegions)}><MapPin size={16}/>{area || '지역 미입력'} · 지역 변경 미리보기</button></div>{showRegions && <div className="admin-form-grid"><label className="admin-field">미리보기 지역<select value={area} onChange={event => setArea(event.target.value)}>{regions.map(region => <option key={region} value={region}>{region || '지역 미입력'}</option>)}</select></label><label className="admin-field">미리보기 장소<select value={active.name} onChange={event => setSelection(event.target.value)}>{candidates.map(candidate => <option value={candidate.name} key={candidate.name}>{candidate.name}</option>)}</select></label></div>}<PreviewCard key={active.name+active.area} content={active}/></div>;
}
function PreviewCard({ content }: { content: PlaceContent }) {
  const [index, setIndex] = useState(0), [saved, setSaved] = useState(false), [muted, setMuted] = useState(true), [source, setSource] = useState(false), [mode, setMode] = useState('PHOTO');
  const media = content.media.filter(m => !m.withdrawn && m.rights.display && m.rights.store && safeMediaUrl(m.url) && (mode === 'VIDEO' ? m.type === 'VIDEO' || m.type === 'MOTION' && m.rights.modify : m.type === 'PHOTO' || m.type === 'MOTION')).slice(0, 5);
  const photo = media[Math.min(index, Math.max(0, media.length - 1))];
  return <div className="admin-customer-preview"><header><strong>spotlog</strong><Badge tone="warning">격리 미리보기</Badge></header><div className="admin-actions"><button onClick={() => setMode('PHOTO')} aria-pressed={mode === 'PHOTO'}>사진</button><button onClick={() => setMode('VIDEO')} aria-pressed={mode === 'VIDEO'}>영상</button><button onClick={() => setMode('GUIDE')} aria-pressed={mode === 'GUIDE'}>지역 안내</button></div>
    {mode === 'VIDEO' ? <div className="admin-preview-media">{photo?.type === 'VIDEO' ? <video src={safeMediaUrl(photo.url)} controls muted={muted} playsInline /> : <p>{photo?.type === 'MOTION' ? '사진 모션 자료 · 실제 영상 아님' : '등록된 실제 영상이 없어요.'}</p>}</div> : mode === 'PHOTO' ? <div className="admin-preview-media" onTouchStart={e => { e.currentTarget.dataset.startX = String(e.touches[0].clientX); }} onTouchEnd={e => { const delta = e.changedTouches[0].clientX - Number(e.currentTarget.dataset.startX); if (Math.abs(delta) > 35) setIndex(current => (current + (delta < 0 ? 1 : media.length - 1)) % Math.max(1, media.length)); }}>
      {photo && photo.type !== 'VIDEO' ? <img src={safeMediaUrl(photo.url)} alt={photo.alt} /> : <p>표시 가능한 사진이 없어요.</p>}{media.length > 1 && <div className="admin-photo-controls"><button aria-label="이전 사진" onClick={() => setIndex((index + media.length - 1) % media.length)}><ChevronLeft size={18}/></button><span>사진 {index + 1}/{media.length}</span><button aria-label="다음 사진" onClick={() => setIndex((index + 1) % media.length)}><ChevronRight size={18}/></button></div>}</div> : <div className="admin-preview-guide"><strong>방문 안내</strong><p>{content.guide.hours || '운영 시간 미확인'}</p><p>{content.guide.access || '접근성 정보 미확인'}</p><p>{content.guide.facilities}</p></div>}
    <div className="admin-preview-body"><Badge>{kindLabel[content.kind]}</Badge><h3>{content.name || '장소 이름'}</h3><p>{content.description || '장소 소개를 입력해 주세요.'}</p><small><MapPin size={14}/> {content.area || '지역 미입력'}</small><div className="admin-actions"><button aria-pressed={saved} onClick={() => setSaved(!saved)}><Bookmark size={16}/>{saved ? '미리보기 저장됨' : '저장 미리보기'}</button>{mode === 'VIDEO' && <button onClick={() => setMuted(!muted)}>{muted ? <VolumeX size={16}/> : <Volume2 size={16}/>} {muted ? '소리 켜기' : '소리 끄기'}</button>}<button onClick={() => setSource(!source)}>사진 출처</button></div>{source && <div className="admin-notice"><strong>{photo?.provider || '사진 출처 미확인'}</strong><p>{photo?.author} · {photo?.license}</p><p>{photo?.caption}</p></div>}<p className="admin-muted">등록된 지역: {content.area || '미정'} · 고객 저장 자료에 반영되지 않아요.</p></div>
  </div>;
}
