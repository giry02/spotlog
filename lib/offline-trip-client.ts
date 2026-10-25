import { appendTrip, type TripAction, type TripSession } from './trip-engine';
import { parseTripAction, parseTripSession } from './chat-contract';

/** Explicit offline buttons must not depend on an API or a model. The same
 * closed action/session validators protect local writes and later server use. */
export function applyOfflineTripClientAction(session: TripSession, action: TripAction): TripSession | undefined {
  if (!['offline-save','offline-open','offline-remove','offline-library'].includes(action.type)) return;
  const parsed = parseTripAction(action);
  const next = parseTripSession(appendTrip(parseTripSession(session), parsed));
  const turn = next.turns.at(-1)!;
  return { ...next, turns: [...next.turns.slice(0,-1), { ...turn, source: 'local-action' }] };
}
