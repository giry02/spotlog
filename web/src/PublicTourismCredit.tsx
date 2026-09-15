import { useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import type { Journey } from './data';
import { BottomSheet, useBottomSheetDetail } from './BottomSheet';
import { getPhotoSource, photoSources, type PhotoSource } from './photoSources';
import { photoCaptionWithoutDuplicateCredit } from './photoCaption';
import './public-tourism.css';

function SourceDetails({ sources, note }: { sources: PhotoSource[]; note?: string }) {
  return <div className="public-source-details">
    {note && <p className="phase-hint">{note}</p>}
    {sources.map((source) => <section className="public-source-item" key={source.id}>
      <h3>{source.title}</h3>
      <dl>
        {source.originalTitle && <div><dt>원제</dt><dd>{source.originalTitle}</dd></div>}
        <div><dt>제공</dt><dd>{source.owner}</dd></div>
        <div><dt>저작자</dt><dd>{source.author}</dd></div>
        <div><dt>이용 조건</dt><dd><a href={source.licenseUrl} target="_blank" rel="noreferrer">{source.license}</a></dd></div>
        <div><dt>제작일</dt><dd>{source.publishedAt ?? '원문 개별 표기 없음'}</dd></div>
        <div><dt>확인일</dt><dd>{source.verifiedAt}</dd></div>
        {source.changes && <div><dt>변경 사항</dt><dd>{source.changes}</dd></div>}
        {source.reuseNote && <div><dt>재사용</dt><dd>{source.reuseNote}</dd></div>}
      </dl>
      <div className="public-source-links"><a href={source.sourceUrl} target="_blank" rel="noreferrer">{source.license === '공공누리 제1유형' ? '공식 자료 보기' : '출처 페이지 보기'}</a><a href={source.imageSourceUrl} target="_blank" rel="noreferrer">사진 원본 보기</a></div>
    </section>)}
  </div>;
}

function SourceDisclosure({ sources, note, className, children }: { sources: PhotoSource[]; note?: string; className: string; children: ReactNode }) {
  const showSheetDetail = useBottomSheetDetail();
  const [open, setOpen] = useState(false);
  const details = <SourceDetails sources={sources} note={note} />;
  return <>
    <button type="button" className={className} aria-haspopup="dialog" onClick={(event) => {
      event.stopPropagation();
      if (showSheetDetail) showSheetDetail({ title: '사진 출처', children: details });
      else setOpen(true);
    }}>{children}</button>
    {open && <BottomSheet title="사진 출처" onClose={() => setOpen(false)}>{details}</BottomSheet>}
  </>;
}

/** Attribution follows the image, including saved places and copied journeys. */
export function PhotoCredit({ image, sourceId, plain = false }: { image: string; sourceId?: string; plain?: boolean }) {
  const source = sourceId ? photoSources.find((entry) => entry.id === sourceId && entry.image === image) ?? getPhotoSource(image) : getPhotoSource(image);
  if (!source) return null;
  const owner = source.author === source.owner || source.author === '개별 촬영자 미표기' ? source.owner : `${source.owner} · ${source.author}`;
  // Plain credit is used inside an existing journey/place button: never nest a button there.
  if (plain) return <span className="public-photo-credit">사진: {owner} · {source.license}</span>;
  return <span className="public-photo-credit"><SourceDisclosure sources={[source]} className="public-photo-credit-button">사진 출처<ChevronRight size={12} aria-hidden="true" /></SourceDisclosure></span>;
}

/** Existing story-image-block layout, with legacy duplicate text removed only for display. */
export function StoryPhoto({ image, caption }: { image: string; caption?: string }) {
  const description = photoCaptionWithoutDuplicateCredit(caption, getPhotoSource(image));
  return <figure className="story-image-block"><img src={image} alt={description || '여행 사진'} />{description && <figcaption>{description}</figcaption>}<PhotoCredit image={image} /></figure>;
}

export function PublicSourceNotes({ journey }: { journey: Journey }) {
  const images = new Set([journey.cover, ...journey.days.flatMap((day) => [...day.places.flatMap((place) => [place.image, ...(place.photos ?? []).filter((photo) => photo.availability !== 'withdrawn').map((photo) => photo.image)]), ...day.blocks.map((block) => block.image).filter((image): image is string => Boolean(image))])]);
  const sources = photoSources.filter((source) => images.has(source.image));
  if (!sources.length) return null;
  return <section className="day-route-section public-source-notes" aria-label="사진과 자료 출처">
    <SourceDisclosure sources={sources} className="public-source-disclosure" note="사진별 저작자와 이용 조건을 아래에서 확인할 수 있어요. 자료 사진은 촬영 시점의 모습이며, 여행 작성자가 직접 촬영하거나 방문했다는 의미는 아닙니다."><span>사진 출처</span><span>{sources.length}개 자료<ChevronRight size={16} aria-hidden="true" /></span></SourceDisclosure>
  </section>;
}
