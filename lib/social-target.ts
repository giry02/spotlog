import { findCommunityTrip } from './community-trips';
import { findFood, findPlace, findStay } from './trip-data';

export type SocialTarget =
  | { kind: 'entity'; id: string }
  | { kind: 'course'; id: string }
  | { kind: 'course-place'; id: string; visitIndex: number };

export type ResolvedSocialTarget = {
  key: string;
  title: string;
  subtitle: string;
  entityId?: string;
  courseId?: string;
  commentLimit: 180 | 1000;
  reactionMode: 'like' | 'cheer';
};

function record(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

const entity = (id: string) => findPlace(id) ?? findFood(id) ?? findStay(id);

/** Public catalog IDs only. A course block and its global place have distinct threads. */
export function resolveSocialTarget(value: unknown): ResolvedSocialTarget | null {
  if (!record(value) || typeof value.id !== 'string' || value.id.length > 160) return null;
  if (Object.getOwnPropertySymbols(value).length) return null;
  const keys = Object.getOwnPropertyNames(value);
  if (value.kind === 'entity') {
    if (keys.length !== 2 || !keys.every(key => key === 'kind' || key === 'id')) return null;
    const place = entity(value.id);
    return place ? {
      key: JSON.stringify(['entity', value.id]), title: place.name,
      subtitle: [place.region, 'district' in place ? place.district : place.address].filter(Boolean).join(' · '),
      entityId: value.id, commentLimit: 1000, reactionMode: 'like',
    } : null;
  }
  const course = findCommunityTrip(value.id);
  if (!course) return null;
  if (value.kind === 'course') {
    if (keys.length !== 2 || !keys.every(key => key === 'kind' || key === 'id')) return null;
    return {
      key: JSON.stringify(['course', value.id]), title: course.title,
      subtitle: `${course.region} · 코스 전체`, courseId: course.id,
      commentLimit: 180, reactionMode: 'cheer',
    };
  }
  if (value.kind !== 'course-place' || keys.length !== 3 || !keys.every(key => key === 'kind' || key === 'id' || key === 'visitIndex') ||
    !Number.isInteger(value.visitIndex) || (value.visitIndex as number) < 0 || (value.visitIndex as number) >= course.visits.length) return null;
  const visit = course.visits[value.visitIndex as number];
  const place = entity(visit.entityId);
  if (!place) return null;
  return {
    key: JSON.stringify(['course-place', value.id, value.visitIndex]), title: place.name,
    subtitle: `${course.title} · DAY ${visit.day} · ${visit.label}`,
    entityId: visit.entityId, courseId: course.id, commentLimit: 1000, reactionMode: 'like',
  };
}

export function normalizeSocialTarget(value: unknown): SocialTarget | null {
  if (!resolveSocialTarget(value)) return null;
  const target = value as SocialTarget;
  return target.kind === 'course-place'
    ? { kind: target.kind, id: target.id, visitIndex: target.visitIndex }
    : { kind: target.kind, id: target.id };
}
