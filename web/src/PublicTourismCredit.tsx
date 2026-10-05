import { useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import type { Journey } from './data';
import { usePublicReview } from './publicReview';
import type { PublicPlaceProjection, ReviewServiceState } from './reviewServiceBridge';
import type { PublicSourceCredit } from './publicServiceTypes';
import { BottomSheet, useBottomSheetDetail } from './BottomSheet';
import { getPhotoSource, photoSources, type PhotoSource } from './photoSources';
import { photoCaptionWithoutDuplicateCredit } from './photoCaption';
import { TranslationText } from './TranslationText';
import { sourceVersion } from './travelGuide';
import './public-tourism.css';

type DisplayPhotoSource = Omit<PhotoSource, 'license'> & { license: string };
function reviewPhotoSources(state: ReviewServiceState): DisplayPhotoSource[] {
  const entries: {image:string;credit?:PublicSourceCredit}[] = state.publishedPlaces.flatMap(p => (p as PublicPlaceProjection).publicMediaCredits?.map(c => ({image:c.image,credit:c})) ?? []);
  [...state.publicJournals, ...state.operatingJournals].forEach(j => { if(j.cover)entries.push({image:j.cover.image,credit:j.cover.sourceCredit}); j.days?.forEach(day => { day.places.forEach(p => { entries.push({image:p.image,credit:p.sourceCredit}); p.photos?.forEach(photo => entries.push({image:photo.image,credit:photo.sourceCredit})); }); day.blocks.forEach(b => { if(b.image)entries.push({image:b.image,credit:b.sourceCredit}); b.images?.forEach(photo => entries.push({image:photo.image,credit:photo.sourceCredit})); }); }); });
  return [...new Map(entries.filter(e => e.credit && e.image && !state.withdrawnImages.includes(e.image)).map(({image,credit:c}) => [image,{id:`review:${image}`,placeId:'',title:'공개 자료 사진',image,sourceUrl:c!.sourceUrl,imageSourceUrl:c!.sourceUrl,owner:c!.provider,author:c!.author??'개별 촬영자 미표기',license:c!.license??'원문 이용 조건 확인',licenseUrl:c!.licenseUrl??c!.sourceUrl,verifiedAt:c!.checkedAt??'확인일 미제공',changes:c!.changes}])).values()];
}
function SourceDetails({ sources, note }: { sources: DisplayPhotoSource[]; note?: string }) {
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

function SourceDisclosure({ sources, note, className, children }: { sources: DisplayPhotoSource[]; note?: string; className: string; children: ReactNode }) {
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
  const {state}=usePublicReview();
  const reviewed=reviewPhotoSources(state).find(s=>s.image===image);
  const source = reviewed ?? (sourceId ? photoSources.find((entry) => entry.id === sourceId && entry.image === image) ?? getPhotoSource(image) : getPhotoSource(image));
  if (!source) return null;
  const owner = source.author === source.owner || source.author === '개별 촬영자 미표기' ? source.owner : `${source.owner} · ${source.author}`;
  // Plain credit is used inside an existing journey/place button: never nest a button there.
  if (plain) return <span className="public-photo-credit">사진: {owner} · {source.license}</span>;
  return <span className="public-photo-credit"><SourceDisclosure sources={[source]} className="public-photo-credit-button">사진 출처<ChevronRight size={12} aria-hidden="true" /></SourceDisclosure></span>;
}

/** Existing story-image-block layout, with legacy duplicate text removed only for display. */
export function StoryPhoto({ image, caption, captionSourceId }: { image: string; caption?: string; captionSourceId?: string }) {
  const description = photoCaptionWithoutDuplicateCredit(caption, getPhotoSource(image));
  return <figure className="story-image-block"><img src={image} alt={description || '여행 사진'} />{description && <TranslationText as="figcaption" sourceId={captionSourceId ?? `photo:${image}:caption`} sourceVersion={sourceVersion(description)} text={description} kind="caption" />}<PhotoCredit image={image} /></figure>;
}

export function PublicSourceNotes({ journey }: { journey: Journey }) {
  const {state}=usePublicReview();
  const images = new Set([journey.cover, ...journey.days.flatMap((day) => [...day.places.flatMap((place) => [place.image, ...(place.photos ?? []).filter((photo) => photo.availability !== 'withdrawn').map((photo) => photo.image)]), ...day.blocks.flatMap((block) => [block.image,...(block.images??[]).map(photo=>photo.image)]).filter((image): image is string => Boolean(image))])]);
  const sources = [...new Map([...photoSources,...reviewPhotoSources(state)].filter((source) => images.has(source.image)).map(source=>[source.image,source])).values()];
  if (!sources.length) return null;
  return <section className="day-route-section public-source-notes" aria-label="사진과 자료 출처">
    <SourceDisclosure sources={sources} className="public-source-disclosure" note="사진별 저작자와 이용 조건을 아래에서 확인할 수 있어요. 자료 사진은 촬영 시점의 모습이며, 여행 작성자가 직접 촬영하거나 방문했다는 의미는 아닙니다."><span>사진 출처</span><span>{sources.length}개 자료<ChevronRight size={16} aria-hidden="true" /></span></SourceDisclosure>
  </section>;
}
