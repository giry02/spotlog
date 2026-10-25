import type { ChatRequest } from './chat-contract';
import { currentTrip } from './trip-engine';

/** Only a bare start command with no substantive condition can skip inference. */
export function missingRegionPreflight(request: ChatRequest): boolean {
  const state = currentTrip(request.session);
  if (
    request.action.type !== 'message' ||
    state.region ||
    state.plan.length ||
    state.collectedIds?.length
  )
    return false;
  const text = request.action.text.trim();
  if (!/(여행|일정|코스)/.test(text) || !/(만들|짜|추천|계획)/.test(text))
    return false;
  return (
    text.replace(
      /(?:여행|일정|코스|만들어|짜|추천해|계획해|주세요|줘|줄래|해줘|좀|부탁해|을|를|요|\s|[.!?])/g,
      '',
    ) === ''
  );
}
