import { ChevronDown, MapPin } from 'lucide-react';
import Image from 'next/image';
import { businessDetails } from '@/lib/business-details';
import { findPlace, getRegisteredEntity } from '@/lib/trip-data';
import type { Visit } from '@/lib/trip-engine';
import { SocialSummary } from './spotlog-social';
import {
  BusinessContentSection,
  BusinessPhotoSection,
} from './business-content';

/** Read-only course details, shared by the demo and the live chatbot renderer. */
export function CommunityVisitAccordion({
  visit,
  courseId,
  visitIndex,
}: {
  visit: Visit;
  courseId?: string;
  visitIndex?: number;
}) {
  const place = findPlace(visit.entityId);
  const registered = getRegisteredEntity(visit.entityId);
  const business =
    !place && visit.entityId
      ? businessDetails({
          kind: visit.kind === 'stay' ? 'stay' : 'food',
          id: visit.entityId,
        })
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
          {image && (
            <Image src={image} alt="" width={42} height={42} unoptimized />
          )}
          <span className="tr-course-visit-name">
            <strong>{name}</strong>
            {location && (
              <small>
                <MapPin size={11} />
                {location}
                {business && !business.registered ? ' · 가상 업체' : ''}
              </small>
            )}
            <span className="tr-course-visit-toggle">
              <span className="tr-course-visit-show">상세정보 보기</span>
              <span className="tr-course-visit-hide">상세정보 접기</span>
            </span>
          </span>
        </span>
        <ChevronDown
          className="tr-course-visit-chevron"
          size={17}
          aria-hidden="true"
        />
      </summary>
      <div className="tr-course-visit-body">
        <span className="tr-course-visit-kind">
          {business
            ? `${business.kind} · ${business.registered ? 'Spotlog 등록 정보' : '가상 업체 · 체험용 정보'}`
            : registered
              ? '장소 · Spotlog 등록 정보'
              : '여행 장소'}
        </span>
        <p className="tr-course-visit-description">
          {business?.description ??
            place?.description ??
            '등록된 상세정보가 없습니다.'}
        </p>
        {courseId && visitIndex !== undefined && (
          <SocialSummary
            target={{ kind: 'course-place', id: courseId, visitIndex }}
          />
        )}
        {!!(business?.features ?? place?.tags)?.length && (
          <div className="tr-business-tags">
            {(business?.features ?? place?.tags)?.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        )}
        {business && (
          <>
            <BusinessPhotoSection details={business} compact />
            <BusinessContentSection details={business} compact />
          </>
        )}
        <dl className="tr-course-visit-facts">
          {location && (
            <div>
              <dt>{registered ? '주소' : place ? '위치' : '위치 예시'}</dt>
              <dd>{location}</dd>
            </div>
          )}
          {business && (
            <div>
              <dt>{visit.kind === 'stay' ? '체크인·아웃' : '운영시간'}</dt>
              <dd>
                {business.content?.checkIn ??
                  business.content?.hours ??
                  business.hours}
              </dd>
            </div>
          )}
          {business && business.walk !== null && (
            <div>
              <dt>이동 예시</dt>
              <dd>기준 장소에서 도보 {business.walk}분 · 체험용 설정</dd>
            </div>
          )}
          {place && (
            <div>
              <dt>체류시간 예시</dt>
              <dd>약 {place.durationMinutes}분 · 일정 편집 기준</dd>
            </div>
          )}
        </dl>
        {(business?.check ?? place?.visitNote ?? place?.planningNote) && (
          <p className="tr-course-visit-note">
            {business?.check ?? place?.visitNote ?? place?.planningNote}
          </p>
        )}
        {business?.registered && (
          <p className="tr-course-visit-note">
            공개 안내는 변경될 수 있어요. 당일 영업·좌석·빈방은 업체에서 확인해
            주세요.
          </p>
        )}
        {sourceUrl && (
          <div className="tr-course-visit-source">
            <a href={sourceUrl} target="_blank" rel="noreferrer">
              {sourceProvider ?? '장소 안내'} 원문 보기
            </a>
            {checkedAt && <span>자료 확인 {checkedAt}</span>}
          </div>
        )}
      </div>
    </details>
  );
}
