'use client';

import { useRef, useState } from 'react';
import { ExternalLink, Info } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { photoSourceFacts, photoSourceForImage, photoSourceLink, type PhotoSource } from '@/lib/photo-source';
import './photo-source-modal.css';

export function PhotoSourceButton({ photo, name }: { photo: PhotoSource; name?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const sourceUrl = photoSourceLink(photo.sourceUrl), licenseUrl = photoSourceLink(photo.licenseUrl);
  return <div ref={ref} className="tr-photo-source">
    <button type="button" className="tr-photo-source-trigger" onClick={() => {
      setContainer(ref.current?.closest<HTMLElement>('[data-spotlog-device]') ?? null);
      setOpen(true);
    }}><Info size={15}/>사진 출처·이용 조건</button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent presentation="bottom-sheet" className="tr-sheet tr-photo-source-sheet" portalContainer={container ?? undefined}>
        <div className="tr-sheet-handle" aria-hidden="true"/>
        <DialogHeader><DialogTitle>사진 출처·이용 조건</DialogTitle><DialogDescription>{name || photo.title}의 선택한 사진에 등록된 자료예요. 원문의 이용 조건을 함께 확인하세요.</DialogDescription></DialogHeader>
        <div className="sheet-body tr-photo-source-body" data-photo-source-id={photo.id}>
          <dl className="tr-photo-source-facts">{photoSourceFacts(photo).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          <div className="tr-photo-source-links">
            {sourceUrl && <a href={sourceUrl} target="_blank" rel="noopener noreferrer">사진 원문<ExternalLink size={14}/></a>}
            {licenseUrl && <a href={licenseUrl} target="_blank" rel="noopener noreferrer">이용 조건 원문<ExternalLink size={14}/></a>}
          </div>
          <p className="tr-meta">확인일은 권리 자료를 확인한 날이며 촬영일과 다를 수 있어요. 기록이 없는 조건이나 수정 이력은 추정하지 않습니다.</p>
        </div>
      </DialogContent>
    </Dialog>
  </div>;
}

/** Legacy representative photos use the same sheet without changing the displayed image. */
export function EntityPhotoSourceButton({ entityId, image, name }: { entityId: string; image: string; name?: string }) {
  const photo = photoSourceForImage(entityId, image);
  return photo ? <PhotoSourceButton photo={photo} name={name}/> : null;
}
