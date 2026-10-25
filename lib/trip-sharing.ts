import { findFood, findPlace, findStay, period } from './trip-data';
import { getRegisteredEntity } from './registered-catalog';
import { mapLinks } from './travel-links';
import { visitName, type TripState } from './trip-engine';

export type TripShareScope = { kind: 'trip' } | { kind: 'day'; day: number };
const clean = (text: string) => text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim();

export function shareDayDate(startDate: string | null | undefined, day: number) {
  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return '';
  const date = new Date(`${startDate}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== startDate) return '';
  date.setUTCDate(date.getUTCDate() + day - 1);
  return date.toISOString().slice(0, 10);
}

/** Addresses are returned only when present in the approved catalog. A nearby
 * anchor's address must never become a fictional business's address. */
export function entityShareInfo(id: string) {
  const registered = getRegisteredEntity(id);
  if (registered) return {
    id, name: registered.name, address: registered.address,
    region: registered.region, sample: false, links: mapLinks(id),
    sourceUrl: registered.source.sourceUrl,
  };
  const place = findPlace(id);
  if (place) return {
    id, name: place.name, address: place.address ?? '', region: place.region,
    sample: false, links: mapLinks(id), sourceUrl: place.sourceUrl ?? '',
  };
  const business = findFood(id) ?? findStay(id);
  if (!business) return null;
  return { id, name: business.name, address: '', region: 'region' in business ? business.region ?? '' : '', sample: true, links: null, sourceUrl: '' };
}

export function entityShareText(id: string) {
  const item = entityShareInfo(id);
  if (!item) throw new Error('공유할 장소가 현재 목록에 없어요.');
  return [clean(item.name), item.sample ? '가상 체험 업체 · 실제 위치 미확인' : item.address ? `주소: ${clean(item.address)}` : `${item.region} · 상세 주소 미확인`,
    ...(item.links ? [`지도 검색: ${item.links.naver}`, `길찾기: ${item.links.directions}`] : []),
    ...(item.sourceUrl ? [`등록·공식 안내: ${item.sourceUrl}`] : []),
    '현재 영업·가격·이용 가능 여부는 방문 전에 확인해 주세요.',
  ].join('\n');
}

/** Generates a text preview, never a public URL or a remote sharing request.
 * Personal notes are opt-in; account/session IDs and reservation details are
 * not part of this DTO. All planned visits remain in their current order. */
export function tripShareText(state: TripState, scope: TripShareScope = { kind: 'trip' }, options: { includeNotes?: boolean } = {}) {
  if (scope.kind === 'day' && (!Number.isInteger(scope.day) || scope.day < 1 || scope.day > state.days))
    throw new Error('이 여행에 있는 DAY를 골라 주세요.');
  const days = scope.kind === 'day' ? [scope.day] : Array.from({ length: state.days }, (_, i) => i + 1);
  const title = clean(state.title || `${state.region ?? ''} ${period(state.days)} 여행`);
  const blocks = days.map(day => {
    const visits = state.plan.filter(v => v.day === day);
    const heading = `DAY ${day}${shareDayDate(state.startDate, day) ? ` · ${shareDayDate(state.startDate, day)}` : ''}`;
    const rows = visits.map((visit, index) => {
      const item = visit.entityId ? entityShareInfo(visit.entityId) : null;
      const name = clean(visitName(visit));
      const lines = [`${index + 1}. ${visit.time ? `${visit.time} ` : ''}${visit.label} · ${name}${item?.sample ? ' (가상 체험 업체)' : ''}`];
      if (visit.durationMinutes) lines.push(`예상 체류 ${visit.durationMinutes}분`);
      if (item?.address) lines.push(`주소: ${clean(item.address)}`);
      if (item?.links) lines.push(`지도: ${item.links.naver}`);
      else if (visit.kind !== 'place') lines.push('실제 위치 미확인');
      if (options.includeNotes && visit.note) lines.push(`개인 메모: ${clean(visit.note)}`);
      return lines.join('\n');
    });
    return [heading, rows.length ? rows.join('\n\n') : '아직 배치한 방문이 없어요.'].join('\n');
  });
  return [title, scope.kind === 'day' ? `선택한 DAY ${scope.day} 경로` : `여행 전체 · ${period(state.days)}`, ...blocks,
    '사용자가 정한 방문 순서의 여행 초안입니다. 실제 이동시간·영업·예약 가능 여부를 확인한 경로가 아닙니다.',
  ].join('\n\n');
}
