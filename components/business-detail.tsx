'use client';
import { Clock3, MapPin, Sparkles } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  businessDetails,
  businessReasons,
  type BusinessRef,
} from '@/lib/business-details';
import type { TripState } from '@/lib/trip-engine';
import {
  BusinessContentSection,
  BusinessPhotoSection,
} from './business-content';
import { EntityShareControls } from './trip-share-controls';
import { SocialSummary } from './spotlog-social';

export type OpenBusiness = (ref: BusinessRef, state: TripState) => void;

export function BusinessPreview({
  reference,
  onOpen,
  onSelect,
  selectLabel = '선택',
}: {
  reference: BusinessRef;
  onOpen: () => void;
  onSelect: () => void;
  selectLabel?: string;
}) {
  const d = businessDetails(reference);
  if (!d) return null;
  if (d.registered)
    return (
      <article className="tr-business-card">
        <button
          className="tr-business-preview"
          onClick={onOpen}
          aria-label={`${d.name} 상세보기`}
        >
          <div className="tr-business-image">
            <Image
              src={d.image}
              alt={d.imageAlt}
              width={300}
              height={130}
              loading="lazy"
              unoptimized
            />
            <small>
              {d.imageIsExample ? '유형별 예시 이미지' : 'Spotlog 등록 사진'}
            </small>
          </div>
          <div className="tr-business-copy">
            <div>
              <span>
                {d.kind} · {d.sourceProvider}
              </span>
            </div>
            <strong>{d.name}</strong>
            <p>
              {d.content?.menus
                .slice(0, 2)
                .map((menu) => menu.name)
                .join(' · ') ||
                d.content?.rooms
                  ?.slice(0, 2)
                  .map((room) => room.name)
                  .join(' · ') ||
                d.location}
            </p>
            <div className="tr-business-tags">
              {d.features.slice(0, 2).map((f) => (
                <span key={f}>{f}</span>
              ))}
            </div>
          </div>
        </button>
        <SocialSummary target={{ kind: 'entity', id: d.id }} compact />
        <div className="tr-business-card-footer">
          <span>
            <strong>
              {d.content
                ? d.kind === '숙소'
                  ? '객실·시설 안내'
                  : '대표 메뉴 안내'
                : d.price}
            </strong>
            <small>
              {d.content
                ? '사진과 상세정보를 살펴보세요'
                : '현재 영업 여부는 방문 전 확인'}
            </small>
          </span>
          <button onClick={onSelect} aria-label={`${d.name} ${selectLabel}`}>
            {selectLabel}
          </button>
        </div>
        <button className="tr-business-detail-link" onClick={onOpen}>
          {d.kind === '숙소'
            ? '객실·시설·사진 상세보기'
            : '메뉴·시설·사진 상세보기'}
        </button>
      </article>
    );
  return (
    <article className="tr-business-card">
      <button
        className="tr-business-preview"
        onClick={onOpen}
        aria-label={`${d.name} 상세보기`}
      >
        <div className="tr-business-image">
          <Image
            src={d.image}
            alt={d.imageAlt}
            width={300}
            height={130}
            loading="lazy"
            unoptimized
          />
          <small>AI 유형 예시</small>
        </div>
        <div className="tr-business-copy">
          <div>
            <span>{d.kind} · 가상 업체</span>
            {d.walk !== null && <span>도보 {d.walk}분 예시</span>}
          </div>
          <strong>{d.name}</strong>
          <p>{d.headline}</p>
          <div className="tr-business-tags">
            {d.features.slice(0, 2).map((f) => (
              <span key={f}>{f}</span>
            ))}
          </div>
        </div>
      </button>
      <div className="tr-business-card-footer">
        <span>
          <strong>{d.price}</strong>
          <small>{d.primary}</small>
        </span>
        <button onClick={onSelect} aria-label={`${d.name} ${selectLabel}`}>
          {selectLabel}
        </button>
      </div>
      <button
        className="tr-business-detail-link"
        onClick={onOpen}
        aria-label={`${d.name} ${reference.kind === 'stay' ? '객실과 운영정보' : '메뉴와 운영정보'} 보기`}
      >
        {reference.kind === 'stay'
          ? '객실·시설·체크인 정보 보기'
          : '메뉴·시설·운영정보 보기'}
      </button>
    </article>
  );
}

export function BusinessDetailBody({
  reference,
  state,
}: {
  reference: BusinessRef;
  state: TripState;
}) {
  const d = businessDetails(reference);
  if (!d) return null;
  if (d.registered)
    return (
      <div className="tr-business-detail">
        <BusinessPhotoSection details={d} />
        <SocialSummary target={{ kind: 'entity', id: d.id }} />
        <section className="tr-detail-intro">
          <span className="tr-detail-category">{d.kind} · Spotlog 등록</span>
          <h3>{d.name}</h3>
          <p>{d.description}</p>
          <div className="tr-business-tags">
            {d.features.map((f) => (
              <span key={f}>{f}</span>
            ))}
          </div>
        </section>
        <BusinessContentSection details={d} />
        <section className="tr-detail-section">
          <h3>방문 정보</h3>
          <dl className="tr-detail-facts">
            <div>
              <dt>주소</dt>
              <dd>{d.location}</dd>
            </div>
            <div>
              <dt>{d.kind === '숙소' ? '체크인·체크아웃' : '운영시간 안내'}</dt>
              <dd>{d.content?.checkIn ?? d.content?.hours ?? d.hours}</dd>
            </div>
            <div>
              <dt>등록 자료</dt>
              <dd>
                {d.sourceProvider} · 확인 {d.sourceVerifiedAt}
              </dd>
            </div>
          </dl>
          <a
            className="tr-text-link"
            href={d.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            등록 정보 원문 보기
          </a>
        </section>
        <section className="tr-detail-check">
          <h3>방문 전에 확인해 주세요</h3>
          <p>{d.check}</p>
          <p>
            {d.content
              ? '공개된 메뉴·객실·시설 안내는 변경될 수 있어요. 당일 영업·좌석·빈방과 예약 가능 여부는 업체에서 확인해 주세요.'
              : '주소·대표 좌표 등 기본 정보가 등록된 후보입니다. 현재 메뉴·가격·좌석·객실·재고·예약 가능 여부를 확인한 결과는 아닙니다.'}
          </p>
        </section>
        <EntityShareControls id={d.id} />
      </div>
    );
  return (
    <div className="tr-business-detail">
      <BusinessPhotoSection details={d} />
      <section className="tr-detail-intro">
        <span className="tr-detail-category">{d.kind} · 가상 업체</span>
        <h3>{d.headline}</h3>
        <p>{d.description}</p>
        <SocialSummary target={{ kind: 'entity', id: d.id }} />
        <div className="tr-business-tags">
          {d.features.map((f) => (
            <span key={f}>{f}</span>
          ))}
        </div>
      </section>
      <section className="tr-detail-reasons">
        <h3>
          <Sparkles size={17} />
          이번 여행과 맞는 이유
        </h3>
        <ul>
          {businessReasons(reference, state).map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </section>
      <BusinessContentSection details={d} />
      <section className="tr-detail-section">
        <h3>방문 정보</h3>
        <dl className="tr-detail-facts">
          <div>
            <dt>
              <MapPin size={16} />
              위치·이동 예시
            </dt>
            <dd>
              {d.location}
              {d.walk !== null && (
                <span>기준 장소에서 도보 {d.walk}분 · 예시</span>
              )}
            </dd>
          </div>
          <div>
            <dt>
              <Clock3 size={16} />
              {d.room ? '체크인·체크아웃 예시' : '운영시간 예시'}
            </dt>
            <dd>{d.hours}</dd>
          </div>
        </dl>
      </section>
      <section className="tr-detail-check">
        <h3>선택 전에 살펴볼 점</h3>
        <p>{d.check}</p>
      </section>
      <p className="tr-detail-caption">
        업체·메뉴·시설·시간·이동 정보는 체험을 위한 가상 설정입니다. 실제
        영업·좌석·객실·예약 가능 여부는 제공하지 않습니다.
      </p>
      <EntityShareControls id={d.id} />
    </div>
  );
}

export function BusinessDetailAction({
  reference,
  state,
  onChoose,
}: {
  reference: BusinessRef;
  state: TripState;
  onChoose: () => void;
}) {
  const d = businessDetails(reference);
  if (!d) return null;
  const already = state.collectedIds?.includes(reference.id);
  return (
    <div className="tr-detail-action">
      <span>
        <strong>
          {d.registered && d.content
            ? d.kind === '숙소'
              ? '객실·시설 안내'
              : '대표 메뉴 안내'
            : d.price}
        </strong>
        <small>
          {d.registered && d.content
            ? '위치·일정에 맞춰 담아보세요'
            : d.priceLabel}
        </small>
      </span>
      <Button onClick={onChoose}>
        {reference.visitId
          ? '이 일정의 다른 후보 찾기'
          : state.editingId
            ? `이 ${d.kind}으로 교체`
            : state.plan.length
              ? `이 ${d.kind} 선택`
              : already
                ? '담은 곳 보기'
                : `이 ${d.kind} 여행에 담기`}
      </Button>
    </div>
  );
}
