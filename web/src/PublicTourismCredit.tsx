import { useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import type { Journey } from './data';
import { BottomSheet, useBottomSheetDetail } from './PublicSourceSheet';
import { getPublicTourismSource, publicTourismSources, type PublicTourismSource } from './publicTourismContent';
import { photoCaptionWithoutDuplicateCredit } from './photoCaption';
import './public-tourism.css';

function SourceDetails({ sources, note }: { sources: PublicTourismSource[]; note?: string }) {
  return <div className="public-source-details">
    {note && <p className="phase-hint">{note}</p>}
    {sources.map((source) => <section className="public-source-item" key={source.id}>
      <h3>{source.title}</h3>
      <dl>
        <div><dt>제공</dt><dd>{source.owner}</dd></div>
        <div><dt>저작자</dt><dd>{source.author}</dd></div>
        <div><dt>이용 조건</dt><dd><a href={source.licenseUrl} target="_blank" rel="noreferrer">{source.license}</a></dd></div>
        <div><dt>제작일</dt><dd>{source.publishedAt ?? '원문 개별 표기 없음'}</dd></div>
        <div><dt>확인일</dt><dd>{source.verifiedAt}</dd></div>
      </dl>
      <div className="public-source-links"><a href={source.sourceUrl} target="_blank" rel="noreferrer">공식 자료 보기</a><a href={source.imageSourceUrl} target="_blank" rel="noreferrer">사진 원본 보기</a></div>
    </section>)}
  </div>;
}

function SourceDisclosure({ sources, note, className, children }: { sources: PublicTourismSource[]; note?: string; className: string; children: ReactNode }) {
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
export function PhotoCredit({ image, plain = false }: { image: string; plain?: boolean }) {
  const source = getPublicTourismSource(image);
  if (!source) return null;
  const owner = source.author === source.owner || source.author === '개별 촬영자 미표기' ? source.owner : `${source.owner} · ${source.author}`;
  // Plain credit is used inside an existing journey/place button: never nest a button there.
  if (plain) return <span className="public-photo-credit">사진: {owner} · {source.license}</span>;
  return <span className="public-photo-credit"><SourceDisclosure sources={[source]} className="public-photo-credit-button">사진 출처<ChevronRight size={12} aria-hidden="true" /></SourceDisclosure></span>;
}

/** Existing story-image-block layout, with legacy duplicate text removed only for display. */
export function StoryPhoto({ image, caption }: { image: string; caption?: string }) {
  const description = photoCaptionWithoutDuplicateCredit(caption, getPublicTourismSource(image));
  return <figure className="story-image-block"><img src={image} alt={description || '여행 사진'} />{description && <figcaption>{description}</figcaption>}<PhotoCredit image={image} /></figure>;
}

export function PublicSourceNotes({ journey }: { journey: Journey }) {
  const images = new Set([journey.cover, ...journey.days.flatMap((day) => [...day.places.map((place) => place.image), ...day.blocks.map((block) => block.image).filter((image): image is string => Boolean(image))])]);
  const sources = publicTourismSources.filter((source) => images.has(source.image));
  if (!sources.length) return null;
  return <section className="day-route-section public-source-notes" aria-label="사진과 자료 출처">
    <SourceDisclosure sources={sources} className="public-source-disclosure" note="공공누리 제1유형 자료를 출처와 함께 이용했습니다. 관광 안내를 바탕으로 새로 구성한 일정이며 실제 방문 후기가 아닙니다. 운영시간·교통편은 방문 전 공식 안내에서 확인해 주세요."><span>사진 출처</span><span>{sources.length}개 자료<ChevronRight size={16} aria-hidden="true" /></span></SourceDisclosure>
  </section>;
}
