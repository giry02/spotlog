import {
  Coffee,
  BedDouble,
  Utensils,
  Check,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import Image from 'next/image';
import type { businessDetails } from '@/lib/business-details';
import { money } from '@/lib/trip-data';
import { RegisteredPhotoGallery } from './registered-photo-gallery';
import './business-content.css';

type Details = NonNullable<ReturnType<typeof businessDetails>>;

/** The same readable business information appears in a course and its detail sheet. */
export function BusinessPhotoSection({
  details,
  compact = false,
}: {
  details: Details;
  compact?: boolean;
}) {
  return (
    <div className={`tr-business-media${compact ? ' is-compact' : ''}`}>
      {details.registered && details.photos.length > 0 ? (
        <RegisteredPhotoGallery photos={details.photos} name={details.name} />
      ) : (
        <figure>
          <Image
            src={details.image}
            alt={details.imageAlt}
            width={600}
            height={320}
            loading="lazy"
            unoptimized
          />
          <figcaption>
            {details.registered
              ? '유형별 예시 이미지 · 실제 업체 사진 아님'
              : 'AI 생성 유형별 예시 사진 · 실제 업체 사진이 아닙니다'}
          </figcaption>
        </figure>
      )}
    </div>
  );
}

export function BusinessContentSection({
  details,
  compact = false,
}: {
  details: Details;
  compact?: boolean;
}) {
  const content = details.content;
  const isStay = details.kind === '숙소';
  const menus = content?.menus ?? details.menu;
  const rooms =
    content?.rooms ?? (details.room ? [{ name: details.room, note: '' }] : []);
  const facilities = content?.facilities ?? [];
  const Icon = isStay ? BedDouble : details.kind === '카페' ? Coffee : Utensils;
  const heading = isStay
    ? '객실 안내'
    : details.kind === '상점'
      ? '상품 안내'
      : content
        ? '대표 메뉴'
        : '메뉴와 가격';
  const Heading = compact ? 'h4' : 'h3';
  const hasUnknownPrice =
    content && (isStay || menus.some((menu) => menu.price === null));
  const hasPublishedPrice =
    content && menus.some((menu) => menu.price !== null);

  return (
    <section className={`tr-business-content${compact ? ' is-compact' : ''}`}>
      <div className="tr-business-content-heading">
        <Heading>
          <Icon size={17} aria-hidden="true" />
          {heading}
        </Heading>
        {content && (
          <span>
            {hasPublishedPrice ? '게시 가격 · 변동 가능' : '공개 안내 기준'}
          </span>
        )}
      </div>
      {menus.length > 0 ? (
        <ul className="tr-business-content-menu">
          {menus.map((menu) => (
            <li key={menu.name}>
              <span>
                <strong>{menu.name}</strong>
                {menu.note && <small>{menu.note}</small>}
              </span>
              {menu.price !== null && <b>{money(menu.price)}</b>}
            </li>
          ))}
        </ul>
      ) : rooms.length > 0 ? (
        <div className="tr-business-content-rooms">
          {rooms.map((room) => (
            <article key={room.name}>
              <strong>{room.name}</strong>
              {room.note && <p>{room.note}</p>}
            </article>
          ))}
          {!content && (
            <p className="tr-business-content-room-price">
              <strong>{details.price}</strong>
              <span>{details.priceLabel}</span>
            </p>
          )}
        </div>
      ) : (
        <p className="tr-business-content-note">{details.primary}</p>
      )}
      {content?.priceNote ? (
        <p className="tr-business-content-note">{content.priceNote}</p>
      ) : (
        hasUnknownPrice && (
          <p className="tr-business-content-note">
            {isStay
              ? '객실 요금은 날짜·유형에 따라 달라집니다. 예약 전 업체에서 확인해 주세요.'
              : '가격은 방문 전 업체에서 확인해 주세요.'}
          </p>
        )
      )}
      {!details.registered && (
        <p className="tr-business-content-note">
          {isStay ? '객실 구성과 요금' : '메뉴 구성과 가격'}은 체험용
          예시입니다.
        </p>
      )}
      {facilities.length > 0 && (
        <div className="tr-business-content-facilities">
          <Heading>시설·이용 안내</Heading>
          <ul>
            {facilities.map((facility) => (
              <li key={facility}>
                <Check size={14} aria-hidden="true" />
                {facility}
              </li>
            ))}
          </ul>
        </div>
      )}
      {content && content.sources.length > 0 && (
        <details className="tr-business-content-sources">
          <summary>
            정보 출처와 확인일
            <ChevronDown size={15} aria-hidden="true" />
          </summary>
          {content.checkedAt && (
            <p className="tr-business-content-source-date">
              자료 확인 {content.checkedAt}
            </p>
          )}
          <div>
            {content.sources.map((source) => (
              <div
                className="tr-business-content-source"
                key={`${source.url}-${source.scope}`}
              >
                <a href={source.url} target="_blank" rel="noopener noreferrer">
                  {source.title}
                  <ExternalLink size={12} aria-hidden="true" />
                </a>
                <p>{source.scope}</p>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
