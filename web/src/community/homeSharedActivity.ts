import type { Place } from '../data';
import type { TogetherState } from '../together/model';
import { selectPersonalRoutes } from '../together/personalRoutes.ts';

/** A current member's own next route, never a public recommendation or inferred attendance. */
export function selectHomeSharedActivity(state: TogetherState, actorId: string, places: ReadonlyArray<Place>, now = new Date()) {
  if (!actorId) return null;
  const choices = [...state.activities].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999')
    || (a.startTime || '99:99').localeCompare(b.startTime || '99:99') || a.id.localeCompare(b.id)).flatMap(activity => {
    try {
      const selected = selectPersonalRoutes(state, actorId, { groupId: activity.groupId, activityId: activity.id }, [...places], now);
      if (!selected.canWithdraw || !selected.route.stops.length || selected.route.issues.length) return [];
      return [{ activityId: activity.id, title: activity.title, date: activity.date,
        stopCount: selected.route.stops.length, ownStopCount: selected.own?.stops.length || 0,
        needsReview: Boolean(selected.own && selected.own.status !== 'CURRENT') }];
    } catch { return []; }
  });
  return choices[0] || null;
}
