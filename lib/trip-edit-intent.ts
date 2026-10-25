import type { ChatRequest } from './chat-contract';

/** Whole-DAY copying already preserves visit details; replaying those edits is not part of this request. */
export function isWholeDayCopyOnlyRequest(request: Pick<ChatRequest, 'action'>): boolean {
  if (request.action.type !== 'message') return false;
  const text = request.action.text;
  if (/어떻게|방법|설명|무슨\s*뜻|가능|할\s*수|알려|보여|만들|짜\s*(?:줘|주|줄|고)|생성|구성|계획해|저장|찜|날씨|예보|추천|검색|복사해\s*주지\s*마/.test(text)) return false;
  const wholeDays = [...text.matchAll(/(?:DAY|데이)\s*\d+\s*(?:전체(?:를)?|을|를|도)?\s*(?:(?:마지막(?:에|으로)?|끝(?:에|으로)?|새\s*DAY(?:로)?|새\s*날(?:로)?|뒤(?:에)?|DAY\s*\d+(?:에|로))\s*)*복사(?:해|하(?!지|면))/gi)];
  if (wholeDays.length !== 1 || /(?:DAY|데이)\s*\d+\s*(?:과|와|및|,|·|그리고)\s*(?:(?:DAY|데이)\s*)?\d+(?:을|를|도)?\s*(?:둘\s*다|모두|전부)?\s*복사/i.test(text)) return false;
  const commands = text.replace(/안\s*(?:바꿔(?:줘)?|수정해(?:줘)?|변경해(?:줘)?|추가해(?:줘)?|삭제해(?:줘)?|복사해(?:줘)?|배치해(?:줘)?|넣어(?:줘)?|적용해(?:줘)?|반영해(?:줘)?)/g, ' ');
  return !/바꿔|바꾸(?!지|면)|수정해|수정하(?!지|면)|변경해|추가해|추가하(?!지|면)|삭제해|삭제하(?!지|면)|지워|지우(?!지|면)|설정해|적용해|배치해|(?:방문|식당|카페|상점|숙소|호텔|장소)(?:도|을|를|\s*하나(?:도|를)?)\s*(?:따로|별도로)?\s*복사/.test(commands);
}
