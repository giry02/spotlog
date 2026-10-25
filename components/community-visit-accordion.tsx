import { ChevronDown, MapPin } from 'lucide-react';
import Image from 'next/image';
import { businessDetails } from '@/lib/business-details';
import { findPlace, getRegisteredEntity, money } from '@/lib/trip-data';
import type { Visit } from '@/lib/trip-engine';
import { SocialSummary } from './spotlog-social';

/** Read-only course details, shared by the demo and the live chatbot renderer. */
export function CommunityVisitAccordion({ visit,courseId,visitIndex }: { visit: Visit;courseId?:string;visitIndex?:number }) {
  const place = findPlace(visit.entityId);
  const registered = getRegisteredEntity(visit.entityId);
  const business = !place && visit.entityId
    ? businessDetails({ kind: visit.kind === 'stay' ? 'stay' : 'food', id: visit.entityId })
    : undefined;
  const name = place?.name ?? business?.name ?? '장소 확인 필요';
  const location = registered?.address ?? place?.district ?? business?.location;
  const image = place?.image ?? business?.image;
  const sourceUrl = business?.sourceUrl ?? place?.sourceUrl;
  const sourceProvider = business?.sourceProvider ?? place?.sourceProvider;
  const checkedAt = business?.sourceVerifiedAt ?? place?.sourceVerifiedAt;

  return (
    <details className="tr-course-visit">
      <summary>
        <span className="tr-community-time">{visit.label}</span>
        <span className="tr-course-visit-identity">
          {image && <Image src={image} alt="" width={42} height={42} unoptimized />}
          <span className="tr-course-visit-name">
            <strong>{name}</strong>
            {location && <small><MapPin size={11} />{location}{business && !business.registered ? ' · 가상 업체' : ''}</small>}
            <span className="tr-course-visit-toggle">
              <span className="tr-course-visit-show">상세정보 보기</span>
              <span className="tr-course-visit-hide">상세정보 접기</span>
            </span>
          </span>
        </span>
        <ChevronDown className="tr-course-visit-chevron" size={17} aria-hidden="true" />
      </summary>
      <div className="tr-course-visit-body">
        <span className="tr-course-visit-kind">
          {business ? `${business.kind} · ${business.registered ? 'Spotlog 등록 정보' : '가상 업체 · 체험용 정보'}` : registered ? '장소 · Spotlog 등록 정보' : '여행 장소'}
        </span>
        <p className="tr-course-visit-description">{business?.description ?? place?.description ?? '등록된 상세정보가 없습니다.'}</p>
        {courseId && visitIndex !== undefined && <SocialSummary target={{kind:'course-place',id:courseId,visitIndex}} />}
        {!!(business?.features ?? place?.tags)?.length && <div className="tr-business-tags">
          {(business?.features ?? place?.tags)?.map(tag => <span key={tag}>{tag}</span>)}
        </div>}
        {business && (
          <>
            {(!business.registered || business.photos.length > 0) ? <figure className="tr-course-visit-photo">
              <Image src={business.image} alt={business.imageAlt} width={480} height={240} loading="lazy" unoptimized />
              <figcaption>{business.registered ? <>
                등록 사진 · {business.photos[0].author || business.photos[0].owner} · {business.photos[0].owner} · <a href={business.photos[0].sourceUrl} target="_blank" rel="noreferrer">사진 출처</a> · <a href={business.photos[0].licenseUrl} target="_blank" rel="noreferrer">{business.photos[0].license}</a>
              </> : 'AI 생성 유형별 예시 사진 · 실제 업체 사진이 아닙니다'}</figcaption>
            </figure> : <p className="tr-course-visit-note">등록된 업체 사진이 없습니다.</p>}
            <section className="tr-course-visit-section">
              <h4>{visit.kind === 'stay' ? '객실과 가격' : business.kind === '상점' ? '상품과 가격' : '메뉴와 가격'}</h4>
              {business.menu.length > 0 ? <div className="tr-course-visit-menu">
                {business.menu.map(item => <div key={item.name}>
                  <span>{item.name}<span className="tr-course-visit-menu-note">{item.note}</span></span>
                  <b>{money(item.price)}</b>
                </div>)}
              </div> : <p>{business.room ?? business.primary}</p>}
              {business.menu.length === 0 && <p className="tr-course-visit-price">{business.price}<span>{business.priceLabel}</span></p>}
              {!business.registered && <p className="tr-course-visit-note">메뉴·객실 구성과 가격은 체험용 예시입니다.</p>}
            </section>
          </>
        )}
        <dl className="tr-course-visit-facts">
          {location && <div><dt>{registered ? '주소' : place ? '위치' : '위치 예시'}</dt><dd>{location}</dd></div>}
          {business && <div><dt>{visit.kind === 'stay' ? '체크인·아웃' : '운영시간'}</dt><dd>{business.hours}</dd></div>}
          {business && business.walk !== null && <div><dt>이동 예시</dt><dd>기준 장소에서 도보 {business.walk}분 · 체험용 설정</dd></div>}
          {place && <div><dt>체류시간 예시</dt><dd>약 {place.durationMinutes}분 · 일정 편집 기준</dd></div>}
        </dl>
        {(business?.check ?? place?.visitNote ?? place?.planningNote) && <p className="tr-course-visit-note">{business?.check ?? place?.visitNote ?? place?.planningNote}</p>}
        {business?.registered && <p className="tr-course-visit-note">현재 가격·영업·예약 가능 여부는 미확인입니다.</p>}
        {sourceUrl && <div className="tr-course-visit-source">
          <a href={sourceUrl} target="_blank" rel="noreferrer">{sourceProvider ?? '장소 안내'} 원문 보기</a>
          {checkedAt && <span>자료 확인 {checkedAt}</span>}
        </div>}
      </div>
    </details>
  );
}
