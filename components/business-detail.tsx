'use client';
import { Clock3, MapPin, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  businessDetails,
  businessReasons,
  type BusinessRef,
} from '@/lib/business-details';
import { money } from '@/lib/trip-data';
import type { TripState } from '@/lib/trip-engine';

export type OpenBusiness = (ref: BusinessRef, state: TripState) => void;

export function BusinessPreview({
  reference,
  onOpen,
  onSelect,
}: {
  reference: BusinessRef;
  onOpen: () => void;
  onSelect: () => void;
}) {
  const d = businessDetails(reference);
  if (!d) return null;
  return (
    <article className="tr-business-card">
      <button
        className="tr-business-preview"
        onClick={onOpen}
        aria-label={`${d.name} 상세보기`}
      >
        <div className="tr-business-image">
          <img
            src={d.image}
            alt={d.imageAlt}
            width={300}
            height={130}
            loading="lazy"
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
        <button onClick={onSelect} aria-label={`${d.name} 선택`}>
          선택
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
  return (
    <div className="tr-business-detail">
      <figure className="tr-detail-photo">
        <img src={d.image} alt={d.imageAlt} width={600} height={300} />
        <figcaption>
          AI 생성 유형별 예시 사진 · 실제 업체 사진이 아닙니다
        </figcaption>
      </figure>
      <section className="tr-detail-intro">
        <span className="tr-detail-category">{d.kind} · 가상 업체</span>
        <h3>{d.headline}</h3>
        <p>{d.description}</p>
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
      <section className="tr-detail-section">
        <h3>{reference.kind === 'stay' ? '객실과 가격' : '메뉴와 가격'}</h3>
        {d.room ? (
          <div className="tr-detail-room">
            <p>{d.room}</p>
            <strong>{d.price}</strong>
            <span>{d.priceLabel}</span>
          </div>
        ) : (
          <ul className="tr-detail-menu">
            {d.menu.map((m) => (
              <li key={m.name}>
                <span>
                  <strong>{m.name}</strong>
                  <small>{m.note}</small>
                </span>
                <b>{money(m.price)}</b>
              </li>
            ))}
          </ul>
        )}
        <p className="tr-detail-caption">
          {d.room
            ? '객실 구성과 요금은 체험용 예시입니다.'
            : '메뉴 구성과 가격은 체험용 예시입니다.'}
        </p>
      </section>
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
  const already =
    reference.kind === 'stay'
      ? state.stayId === reference.id
      : state.foodId === reference.id || state.cafeId === reference.id;
  return (
    <div className="tr-detail-action">
      <span>
        <strong>{d.price}</strong>
        <small>{d.priceLabel}</small>
      </span>
      <Button onClick={onChoose}>
        {reference.visitId
          ? '이 일정의 다른 후보 찾기'
          : already
            ? '선택한 곳으로 돌아가기'
            : state.editingId
              ? `이 ${d.kind}으로 교체`
              : `이 ${d.kind} 선택`}
      </Button>
    </div>
  );
}
