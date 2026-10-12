'use client';

import {
  ArrowRight,
  Bookmark,
  ChevronRight,
  MapPin,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  communityResults,
  type TripAction,
  type TripState,
} from '@/lib/trip-engine';
import { findPlace, findFood, findStay, period } from '@/lib/trip-data';
import { type CommunityTrip } from '@/lib/community-trips';

const visitTitle = (id: string | null) =>
  findPlace(id)?.name ??
  findFood(id)?.name ??
  findStay(id)?.name ??
  '장소 확인 필요';

export function CommunityUnit({
  state,
  act,
  onPreview,
}: {
  state: TripState;
  act: (action: TripAction) => void;
  onPreview: (trip: CommunityTrip) => void;
}) {
  const results = communityResults(state);
  return (
    <section className="tr-unit tr-community">
      <div className="tr-unit-heading">
        <span>
          <Users size={15} />
          다른 여행자 코스
        </span>
        <div>
          <h2>다른 사람은 어디를 다녔을까요?</h2>
          <small>{results.length}개</small>
        </div>
      </div>
      <p className="tr-community-intro">
        오전·오후 코스를 둘러보고, 내 여행으로 가져와 원하는 곳만 바꿔보세요.
      </p>
      <div className="tr-pills" aria-label="공개 코스 지역">
        {([null, '제주', '서울'] as const).map((region) => (
          <button
            key={region ?? 'all'}
            aria-pressed={(state.communityRegion ?? null) === region}
            onClick={() => act({ type: 'community-filter', region })}
          >
            {region ?? '전체 지역'}
          </button>
        ))}
      </div>
      <div className="tr-pills" aria-label="공개 코스 취향">
        {(
          [
            { value: 'all', label: '전체 코스' },
            { value: 'sea', label: '바다·풍경' },
            { value: 'green', label: '초록·산책' },
          ] as const
        ).map((theme) => (
          <button
            key={theme.value}
            aria-pressed={(state.communityTheme ?? 'all') === theme.value}
            onClick={() =>
              act({ type: 'community-filter', theme: theme.value })
            }
          >
            {theme.label}
          </button>
        ))}
      </div>
      <p className="tr-meta">
        체험용 공개 코스 · 예시 프로필 · 실제 회원 게시물 연동 전
      </p>
      <div className="tr-community-list">
        {results.map((trip) => {
          const cover = findPlace(trip.coverPlaceId);
          const stops = trip.visits.filter((v) => v.kind === 'place');
          return (
            <article className="tr-community-card" key={trip.id}>
              <button
                className="tr-community-preview"
                onClick={() => onPreview(trip)}
                aria-label={`${trip.title} 코스 자세히 보기`}
              >
                {cover && (
                  <img
                    src={cover.image}
                    alt={`${cover.name} 풍경`}
                    width={320}
                    height={145}
                    loading="lazy"
                  />
                )}
                <span className="tr-community-copy">
                  <span className="tr-community-card-meta">
                    <span>
                      {trip.region} · {period(trip.days)}
                    </span>
                    <span>{stops.length}곳 방문</span>
                  </span>
                  <strong>{trip.title}</strong>
                  <span className="tr-community-author">
                    <Users size={12} />
                    {trip.author}
                  </span>
                  <span className="tr-community-description">
                    {trip.description}
                  </span>
                  <span className="tr-community-route">
                    {stops.slice(0, 4).map((visit, i) => (
                      <span key={`${visit.day}-${visit.entityId}`}>
                        {i > 0 && <ChevronRight size={11} />}
                        {visitTitle(visit.entityId)}
                      </span>
                    ))}
                    {stops.length > 4 && <span>외 {stops.length - 4}곳</span>}
                  </span>
                </span>
              </button>
              <div className="tr-community-actions">
                <button onClick={() => onPreview(trip)}>
                  코스 자세히
                  <ChevronRight size={14} />
                </button>
                <button
                  onClick={() => act({ type: 'copy-community', id: trip.id })}
                >
                  <Bookmark size={14} />내 여행으로 가져오기
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {!results.length && (
        <div className="tr-empty">
          <p>이 조건의 코스 예시가 없어요.</p>
          <Button
            variant="outline"
            onClick={() =>
              act({ type: 'community-filter', region: null, theme: 'all' })
            }
          >
            전체 코스 보기
          </Button>
        </div>
      )}
      {state.plan.length > 0 && (
        <button
          className="tr-text-link"
          onClick={() => act({ type: 'show', stage: 'plan' })}
        >
          내 일정으로 돌아가기
          <ArrowRight size={14} />
        </button>
      )}
    </section>
  );
}

export function CommunityTripBody({ trip }: { trip: CommunityTrip }) {
  const cover = findPlace(trip.coverPlaceId);
  return (
    <div className="tr-community-detail">
      {cover && (
        <figure className="tr-detail-photo">
          <img
            src={cover.image}
            alt={`${cover.name} 풍경`}
            width={600}
            height={300}
          />
        </figure>
      )}
      <div className="tr-community-detail-intro">
        <span className="tr-community-author">
          <Users size={14} />
          {trip.author}
        </span>
        <p>{trip.description}</p>
        <div className="tr-business-tags">
          <span>{trip.region}</span>
          <span>{period(trip.days)}</span>
          <span>오전·오후 코스</span>
        </div>
      </div>
      {Array.from({ length: trip.days }, (_, i) => i + 1).map((day) => (
        <section className="tr-community-day" key={day}>
          <h3>DAY {day}</h3>
          <ol>
            {trip.visits
              .filter((v) => v.day === day)
              .map((visit, i) => {
                const place = findPlace(visit.entityId);
                return (
                  <li key={`${day}-${i}`}>
                    <span className="tr-community-time">{visit.label}</span>
                    <span>
                      {place && (
                        <img src={place.image} alt="" width={42} height={42} />
                      )}
                      <span>
                        <strong>{visitTitle(visit.entityId)}</strong>
                        <small>
                          <MapPin size={11} />
                          {place?.district ?? findPlace(visit.anchorId)?.name}
                          {visit.kind !== 'place' ? ' 주변 · 가상 업체' : ''}
                        </small>
                      </span>
                    </span>
                  </li>
                );
              })}
          </ol>
        </section>
      ))}
      <p className="tr-detail-caption">
        공개 여행기를 둘러보는 체험용 예시입니다. 작성자·후기·코스는 예시이며
        실제 회원 게시물이 아닙니다. 식당·카페·숙소는 가상 업체이고
        이동시간·영업 여부는 조회하지 않았어요.
      </p>
    </div>
  );
}
