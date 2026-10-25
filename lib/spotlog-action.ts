import { validateSpotlogOpenAction, type SpotlogOpenAction } from './spotlog-app-bridge';
export { validateSpotlogOpenAction };
/** Deterministic navigation intent only. Auth, posting, reporting and uploads stay in their existing confirmation flows. */
export function parseSpotlogActionRequest(input: string): SpotlogOpenAction | null {
  const text = input.normalize('NFKC').trim();
  if (!text || text.length > 8000 || /(?:하지\s*마|안\s*할래|취소|필요\s*없)/.test(text)) return null;
  const day = Number(text.match(/DAY\s*(\d{1,2})|(?<!\d)(\d{1,2})일차/i)?.slice(1).find(Boolean));
  const withDay = (value: SpotlogOpenAction) => Number.isInteger(day) && day >= 1 && day <= 30 ? { ...value, day } : value;
  if (/신고|저작권\s*(?:문제|침해)/.test(text)) return { type: 'open_spotlog', target: 'report' };
  if (/약관|개인정보|위치\s*(?:권한|동의)|동의\s*내역/.test(text)) return { type: 'open_spotlog', target: 'privacy' };
  if (/비밀번호.*(?:재설정|찾|잊)|암호.*(?:재설정|찾)/.test(text)) return { type: 'open_spotlog', target: 'account', entry: 'account-reset' };
  if (/로그아웃/.test(text)) return { type: 'open_spotlog', target: 'account', entry: 'account-logout' };
  if (/탈퇴|계정\s*삭제/.test(text)) return { type: 'open_spotlog', target: 'account', entry: 'account-delete' };
  if (/이메일.*로그인/.test(text)) return { type: 'open_spotlog', target: 'account', entry: 'account-email' };
  if (/로그인|회원\s*가입|계정\s*(?:관리|설정)/.test(text)) return { type: 'open_spotlog', target: 'account' };
  if (/알림\s*(?:설정|끄|켜|권한|받)|푸시\s*(?:설정|알림)/.test(text)) return { type: 'open_spotlog', target: 'notifications' };
  if (/(?:공유|복사)한\s*(?:여행|일정|여행기).*원본|원본\s*(?:여행|일정|여행기|보기|열)/.test(text)) return { type: 'open_spotlog', target: 'share_source' };
  if (/내\s*활동|활동\s*(?:통계|내역|미리보기)|받은\s*응원|누적\s*담김/.test(text)) return { type: 'open_spotlog', target: 'profile', entry: 'profile-activity' };
  if (/프로필|크리에이터|창작\s*(?:점수|등급)/.test(text)) return { type: 'open_spotlog', target: 'profile', entry: 'profile-summary' };
  if (/장소.*직접.*등록|개인\s*장소|이름.*주소.*등록/.test(text)) return withDay({ type: 'open_spotlog', target: 'trips', entry: 'personal-place' });
  if (/여행기.*공개\s*(?:범위|설정)|공개\s*범위/.test(text)) return withDay({ type: 'open_spotlog', target: 'journal', entry: 'journal-visibility' });
  if (/여행기.*미리\s*보기|미리\s*보기.*여행기/.test(text)) return withDay({ type: 'open_spotlog', target: 'journal', entry: 'journal-preview' });
  if (/초안.*(?:이어|복구)|(?:이어|복구).*초안|여행기.*이어/.test(text)) return withDay({ type: 'open_spotlog', target: 'journal', entry: 'journal-draft' });
  if (/사진.*(?:올리|업로드|첨부|넣|추가)/.test(text)) return withDay({ type: 'open_spotlog', target: 'journal', entry: 'journal-photos' });
  if (/(?:여행기|여행\s*기록).*(?:작성|쓰기|편집|올리|공개|발행)|글.*(?:쓰|작성)/.test(text)) return withDay({ type: 'open_spotlog', target: 'journal', entry: 'journal-text' });
  if (/댓글|답글|스레드/.test(text)) return /(?:여행기|여행)\s*(?:전체|에|의|댓글)|전체\s*댓글/.test(text) && !/장소|카드/.test(text) ? { type: 'open_spotlog', target: 'community', entry: 'journey-comment' } : withDay({ type: 'open_spotlog', target: 'community', entry: 'place-comment' });
  if (/좋아요/.test(text) && /장소|카드/.test(text)) return withDay({ type: 'open_spotlog', target: 'community', entry: 'place-reaction' });
  if (/응원|좋아요/.test(text)) return { type: 'open_spotlog', target: 'community', entry: 'journey-cheer' };
  if (/(?:영상|동영상).*(?:장소|찾|보|둘러)/.test(text)) return { type: 'open_spotlog', target: 'videos' };
  if (/사진.*(?:장소|찾|둘러)|사진\s*(?:피드|보기)/.test(text)) return { type: 'open_spotlog', target: 'photos' };
  return null;
}
