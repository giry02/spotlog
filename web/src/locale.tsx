import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Locale = 'ko' | 'en';
// English reading is temporarily disabled for the customer release.
export const ENGLISH_READING_ENABLED: boolean = false;
export const uiMessages = {
  ko: {
    home: '홈', community: '여행기', discover: '장소', trips: '내 여행', saved: '저장', profile: '프로필',
    language: '언어', close: '닫기', back: '뒤로', cancel: '취소', save: '저장', retry: '다시 시도',
    loading: '불러오는 중', guide: '여행 중 안내', guideSample: '내 일정과 등록된 소개로 보는 안내',
    currentPlace: '현재 장소', day: '여행일', today: '오늘 일정', nextPlace: '다음 장소', highlights: '볼거리',
    hours: '운영 정보', accessibility: '접근성', question: '이 장소에 대해 물어보세요', ask: '질문하기',
    answer: '안내', sources: '안내 근거', unknownDate: '자료 확인일 미등록', sample: '등록 자료 기반 미리보기',
    guideEmpty: '이 DAY에 담긴 장소가 없어요.', noPlace: '장소를 먼저 담아주세요.',
    sourceText: '등록된 소개', address: '주소', koreanAddress: '한글 이름·주소', copyAddress: '이름·주소 복사',
    copied: '복사했어요.', copyFailed: '복사하지 못했어요. 아래 내용을 길게 눌러 복사해 주세요.',
    showAddress: '한글 주소 크게 보기', original: '원문', translate: '영어로 보기', hideTranslation: '번역 접기',
    translationSample: '번역 예시', translationReviewed: '검수 완료', translationStale: '원문 변경 · 다시 번역 필요',
    translationUnavailable: '이 내용의 영어 번역은 아직 준비되지 않았어요. 원문을 표시합니다.',
    translationError: '번역을 불러오지 못했어요. 원문은 그대로 유지됩니다.', translating: '번역 확인 중',
    glossaryChanged: '번역 기준이 변경되어 다시 확인이 필요해요.',
    guideFailure: '안내를 불러오지 못했어요. 다시 시도해 주세요.',
    account: '계정과 앱 이용', localAccount: '이 기기의 프로필', accountPending: '계정 연결 준비 중',
    accountExplanation: '프로필과 여행은 현재 이 브라우저에 저장됩니다. 계정 로그인과 기기 간 동기화는 서버 연결 후 이용할 수 있어요.',
    appHelp: '앱 이용 안내', appExplanation: '홈 · 여행기 · 장소 · 내 여행 · 저장 화면을 같은 순서로 이용할 수 있어요. 앱 설치와 알림 권한은 실제 앱 연결 후 제공됩니다.',
    syncUnavailable: '다른 기기로 자동 동기화되지 않아요.',
    personalPlan: '나를 위한 동선', private: '비공개', tripMenu: '여행 메뉴', list: '목록', map: '지도',
    nearby: '주변 업체', addLandmark: '저장한 랜드마크 담기', createTrip: '여행 만들기', trash: '휴지통',
    editTrip: '여행 정보 수정', copyTrip: '여행 복사', writeJournal: '여행기로 기록', reviseTrip: '일정 조정',
  },
  en: {
    home: 'Home', community: 'Journals', discover: 'Places', trips: 'My trips', saved: 'Saved', profile: 'Profile',
    language: 'Language', close: 'Close', back: 'Back', cancel: 'Cancel', save: 'Save', retry: 'Try again',
    loading: 'Loading', guide: 'Travel guide', guideSample: 'Guide from your itinerary and saved descriptions',
    currentPlace: 'Current stop', day: 'Travel day', today: 'Today’s plan', nextPlace: 'Next stop', highlights: 'Highlights',
    hours: 'Opening information', accessibility: 'Accessibility', question: 'Ask about this place', ask: 'Ask',
    answer: 'Guide', sources: 'Sources', unknownDate: 'Last verification date unavailable', sample: 'Preview from saved information',
    guideEmpty: 'There are no places in this day yet.', noPlace: 'Add a place first.',
    sourceText: 'Saved description', address: 'Address', koreanAddress: 'Korean name and address', copyAddress: 'Copy name and address',
    copied: 'Copied.', copyFailed: 'Could not copy. Press and hold the text below to copy it.',
    showAddress: 'Show Korean address', original: 'Original', translate: 'View in English', hideTranslation: 'Hide translation',
    translationSample: 'Sample translation', translationReviewed: 'Reviewed', translationStale: 'Original changed · translate again',
    translationUnavailable: 'An English translation is not available for this text yet. The original is shown.',
    translationError: 'Could not load the translation. Your original text is unchanged.', translating: 'Checking translation',
    glossaryChanged: 'Translation terminology has changed. Please check again.',
    guideFailure: 'Could not load the guide. Please try again.',
    account: 'Account and app', localAccount: 'Profile on this device', accountPending: 'Account connection coming later',
    accountExplanation: 'Your profile and trips are currently saved in this browser. Sign-in and cross-device sync require a server connection.',
    appHelp: 'Using the app', appExplanation: 'Use Home, Journals, Places, My trips and Saved in the same order. App installation and notification permissions will be available with the app connection.',
    syncUnavailable: 'Your data does not sync automatically to other devices.',
    personalPlan: 'Your own itinerary', private: 'Private', tripMenu: 'Trip menu', list: 'List', map: 'Map',
    nearby: 'Nearby places', addLandmark: 'Add saved landmarks', createTrip: 'Create a trip', trash: 'Trash',
    editTrip: 'Edit trip details', copyTrip: 'Copy trip', writeJournal: 'Write a journal', reviseTrip: 'Adjust itinerary',
  },
} as const;
export type MessageKey = keyof typeof uiMessages.ko;
export const message = (locale: Locale, key: MessageKey): string => uiMessages[locale][key];
type LocaleContextValue = { locale: Locale; setLocale: (locale: Locale) => void; t: (key: MessageKey) => string };
const LocaleContext = createContext<LocaleContextValue>({ locale: 'ko', setLocale: () => {}, t: key => message('ko', key) });
const LANGUAGE_KEY = 'spotlog.ui.language.v1';

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [preferredLocale, updateLocale] = useState<Locale>(() => {
    try { return localStorage.getItem(LANGUAGE_KEY) === 'en' ? 'en' : 'ko'; } catch { return 'ko'; }
  });
  const locale = ENGLISH_READING_ENABLED ? preferredLocale : 'ko';
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  const setLocale = (value: Locale) => {
    if (!ENGLISH_READING_ENABLED) return;
    updateLocale(value);
    try { localStorage.setItem(LANGUAGE_KEY, value); } catch { /* Language still works for this session. */ }
  };
  return <LocaleContext.Provider value={{ locale, setLocale, t: key => message(locale, key) }}>{children}</LocaleContext.Provider>;
}

export const useLocale = () => useContext(LocaleContext);

const tripMessages = {
  title: ['저장한 장소로 여행 만들기', 'Make a trip from saved places'],
  intro: ['날짜별로 직접 담거나, 기간만 정해 바로 만들어보세요.', 'Choose stops for each day, or pick a trip length to create it now.'],
  modes: ['여행 만드는 방법', 'How to create your trip'], manual: ['날짜별로 담기', 'Choose by day'], auto: ['바로 만들기', 'Create now'],
  count: ['{count}곳', '{count} places'], selectedCount: ['{count}곳 담음', '{count} added'], create: ['일정 만들기', 'Create trip'],
  currentDay: ['DAY {day} 선택 · 카드에서 바로 담으세요.', 'DAY {day} selected · add stops from the cards.'], collapse: ['접기', 'Hide'],
  unplaced: ['기간이 줄어든 {count}곳의 DAY를 다시 골라주세요.', 'Choose a new day for {count} places after shortening the trip.'],
  unsaved: ['저장 해제한 장소', 'Unsaved place'], addToDay: ['DAY {day}에 담기', 'Add to DAY {day}'], remove: ['이번 여행에서 제외', 'Remove from this trip'],
  order: ['DAY {day}에 담은 {count}곳 · 순서 조정', 'DAY {day} · {count} places · change order'], up: ['위로', 'Move up'], down: ['아래로', 'Move down'],
  periodTitle: ['여행 기간 선택', 'Choose trip length'], period: ['여행 기간', 'Trip length'],
  manualHint: ['기간을 정한 뒤 날짜별로 장소를 담으세요.', 'Choose a trip length, then add stops to each day.'],
  autoHint: ['{region} · 저장 장소 {count}곳', '{region} · {count} saved places'],
  autoRegion: ['이번 여행 지역', 'Region for this trip'],
  autoRegionHint: ['여러 지역을 저장했어요. 이번 여행에 쓸 지역을 골라주세요.', 'Your saved places span several regions. Choose one for this trip.'],
  autoRegionRequired: ['여행 지역을 먼저 골라주세요', 'Choose a trip region first'],
  autoOtherRegions: ['다른 지역 {count}곳은 저장 목록에 그대로 남아요.', '{count} places in other regions stay in your saved list.'],
  autoRegionNote: ['여러 지역을 함께 여행하려면 날짜별로 담기를 이용하세요.', 'Use Choose by day to plan a trip across regions.'],
  more: ['더 많은 일정', 'More days'], longer: ['더 긴 여행 기간', 'Longer trips'], optional: ['출발일 · 여행 이름 (선택)', 'Start date · trip name (optional)'],
  startDate: ['출발일 (선택)', 'Start date (optional)'], tripName: ['여행 이름 (선택)', 'Trip name (optional)'],
  tripPlaceholder: ['{period} 여행', '{period} trip'], startDateValue: ['출발일 {date}', 'Start date: {date}'],
  unplacedHint: ['기간이 줄어든 장소 {count}곳은 담기 화면에서 DAY를 다시 지정할 수 있어요.', 'You can assign a new day to {count} places on the next screen.'],
  autoNote: ['지역과 거리를 참고해 나눕니다. 만든 뒤 DAY별로 확인하고 수정할 수 있어요.', 'Stops are grouped using area and distance. Review and change each day after creating the trip.'],
  invalidDate: ['출발 날짜를 확인해 주세요.', 'Check the start date.'], addPlaces: ['장소 담기', 'Choose places'],
  saveFailed: ['여행을 저장하지 못했어요. 담은 내용은 유지됩니다. 다시 시도해 주세요.', 'Could not save the trip. Your choices are kept. Please try again.'],
  createTitle: ['저장한 곳으로 여행 만들기', 'Create from saved places'], createHint: ['가고 싶은 곳을 고르면 DAY별 동선이 만들어져요.', 'Choose your places to create a day-by-day itinerary.'],
  emptyHint: ['빈 여행을 먼저 만들고, 저장한 장소에서 하나씩 담아도 좋아요.', 'You can create an empty trip first, then add saved places later.'],
  orderHint: ['선택 순서로 날짜에 나눠 담아요. 내 여행에서 자유롭게 옮길 수 있어요.', 'Places are split across days in selection order. You can move them later in My trips.'],
  createMyTrip: ['내 여행 만들기', 'Create my trip'], dayTrip: ['당일', 'Day trip'], domestic: ['국내', 'Korea'],
} as const;
export type TripMessageKey = keyof typeof tripMessages;
export function tripMessage(locale: Locale, key: TripMessageKey, values: Record<string, string | number> = {}): string {
  const text = tripMessages[key][locale === 'en' ? 1 : 0];
  return text.replace(/\{(\w+)\}/g, (match, name: string) => values[name] === undefined ? match : String(values[name]));
}
export function localizedTripError(locale: Locale, error: unknown): string {
  const text = error instanceof Error ? error.message : '';
  if (locale === 'ko') return text || tripMessage(locale, 'saveFailed');
  const translations: Record<string, string> = {
    '출발 날짜를 확인해 주세요.': 'Check the start date.', '여행 기간을 확인해 주세요.': 'Check the trip length.',
    '가고 싶은 장소를 한 곳 이상 담아 주세요.': 'Add at least one place to visit.',
    '같은 장소가 중복되어 있어요. 담은 장소를 확인해 주세요.': 'A place is included more than once. Check your selected places.',
    '저장 목록에서 빠진 장소가 있어요. 담은 장소를 다시 확인해 주세요.': 'A selected place is no longer saved. Check your selected places.',
    '바로 만들기는 여행할 지역을 하나 골라주세요. 여러 지역은 날짜별로 직접 담을 수 있어요.': 'Choose one region for Create now. Use Choose by day for a trip across regions.',
    '여행 제목과 날짜를 확인해 주세요.': 'Check the trip name and dates.',
    '아직 DAY를 정하지 않은 장소를 배치해 주세요.': 'Assign all selected places to a day.',
  };
  return translations[text] ?? tripMessage(locale, 'saveFailed');
}

export function LanguageControls() {
  const { locale, setLocale, t } = useLocale();
  if (!ENGLISH_READING_ENABLED) return null;
  return <div className="guide-language" role="group" aria-label={t('language')}>
    <button type="button" lang="ko" aria-pressed={locale === 'ko'} onClick={() => setLocale('ko')}>한국어</button>
    <button type="button" lang="en" aria-pressed={locale === 'en'} onClick={() => setLocale('en')}>English</button>
  </div>;
}
