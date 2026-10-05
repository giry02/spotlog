// Documentation only. Named role rules plus explicitly retained screen exceptions.
export const typographyRules = [
  '같은 역할은 같은 규격을 사용합니다. 기존 컴포넌트와 역할별 값을 먼저 선택하고 새 크기를 임의로 추가하지 않습니다.',
  '일반 보조 정보는 12px입니다. 11px는 저장·작성자 목록의 짧은 메타, 배지, 사진 출처에 한정합니다.',
  '8~10px는 기존 영문 장식 분류의 예외입니다. 새 한글 안내·통계 설명·오류·버튼에 사용하지 않습니다.',
  '화면이 좁거나 숫자가 0이어도 글자를 줄이지 않습니다. 기존 줄바꿈·말줄임과 내용에 따른 높이를 사용합니다.',
  '기존 홈·장소·저장 카드의 역할별 크기와 서체를 보존합니다. 가이드 정리를 이유로 전체 화면을 일괄 변경하지 않습니다.',
  '변경 시 역할·예외를 기록하고 320·390·460px 실제 표시값과 자동 검사를 확인합니다. 한글 폰트와 색상 대비는 별도 검수 항목입니다.',
];
export const typeRoles = [
  ['일반 화면 제목', '28px · 750 · 줄높이 1.25', '여행기·내 여행·저장. 프로필은 28px/700/1.1 별도.'],
  ['홈 소개 / 추천 커버', '29px/1.28 · 추천 커버 24px/1.25', '홈의 큰 소개 문장과 이미지 위 일정 제목.'],
  ['여행기 상세 표지', 'clamp(30px, 8vw, 36px) · 700 · 1.2', '320px→30px, 390px→31.2px, 460px→36px.'],
  ['영상 표지', 'clamp(30px, 8vw, 36px) · 750 · 1.25', '상세와 크기 범위는 같지만 굵기·줄높이를 구분.'],
  ['사진 피드 제목', 'clamp(26px, 7.2vw, 31px) · 750 · 1.2', '사진 쇼츠. 영상 제목과 동일 수치로 바꾸지 않음.'],
  ['섹션 / 본문 소제목 / DAY', '섹션 20px/1.35 · 본문 소제목 22px/1.4 · DAY 25px/1.3', '700. 서로 다른 역할이며 범위 안에서 임의 선택하지 않음.'],
  ['큰 장소 카드 / 저장 카드 제목', '지역 안내 21px · 상세 안 20px · 저장 17px', '표현 위치에 따라 사진·글 밀도도 다름.'],
  ['긴 여행기 / 편집 본문', '16px/400 · 기본 1.7 · 글 블록 1.8 · 편집 1.75', '읽는 글은 기존 카드의 짧은 소개와 구분.'],
  ['새 일반 안내 / 보조 정보', '안내 14px/400/1.5 · 보조 정보 12px/400/1.5', '기존 카드 소개13px는 해당 카드에만 재사용. 새 필수 정보에8~10px 금지.'],
  ['상세 작성자 통계', '숫자 18px/700 · 설명 12px/400 · 줄높이 1.7', 'stat-value / stat-label. 프로필 큰 통계는 기존20px/12px 유지.'],
  ['작성자 관련 여행기', '제목 16px/700 · 메타 11px/400 · 줄높이 1.7', 'related-title / related-meta. 기존 한 줄 말줄임·사진·여백 유지.'],
  ['사진 출처 / 짧은 메타', '출처 11px/400/1.6 · 허용된 메타 11px', '저장 DAY·지역, 작성자 목록의 지역·기간·담김, 기존 배지에 한정.'],
  ['버튼 / 입력', '일반 주요 버튼 14px/700 · 일반 입력 16px/400', '카드 행동은 아래 버튼 역할표의 정확한 값, 검색은14px 예외.'],
];

export const buttonRoles = [
  ['핵심 행동 / 상세 하단', '최소 52px · R15 · 14px/700', '새 여행기 만들기, 저장 후 미리보기, 상세 복사.'],
  ['홈 추천 커버', '최소 43px · R12 · 12px/800', '사진 위 흰색 일정 상세 보기.'],
  ['홈 여행자 가로 카드', '최소 37px · R10 · 10px/700', '작은 카드 안 행동. 일반 주 버튼과 구분.'],
  ['여행기 목록 카드', '최소 46px · R12 · 13px/800', '여행기 목록의 일정 읽기.'],
  ['지역 안내 장소 카드', '최소 46px · R12 · 12px/800', '이 장소 저장 / 공유.'],
  ['상세 안 장소 카드', '최소 44px · R11 · 13px/700', '길찾기 / 공유. 지역 안내 버튼과 역할 구분.'],
  ['저장 카드 DAY 담기', '안쪽 8px 10px · R8 · 11px/700', '높이 약 34.69px. 고정 44px나 52px로 늘리지 않음.'],
  ['저장 AI 생성', '최소 45px · R12 · 12px/800', '피치 그라데이션. 저장 장소 없으면 비활성.'],
  ['저장 AI 기간 / 지역', '기간 최소 31px/R9 · 지역 34px/R10', '11px. 기간과 DAY 담기 의미를 혼동하지 않음.'],
  ['검색 지역 / 여행 기간', '지역 34px/캡슐 · 기간 36px/R11', '12px. 저장의 작은 지역 칩과 별도.'],
  ['장소 보기 / 지역 탐색', '보기 44px/R9/11px · 지역 44px/R12', '현재 phase-one 국소 규칙까지 적용한 값.'],
  ['상단 검색 / DAY 뒤로', '검색 42px 원형 · DAY 44px 원형', '검색 위치와 스크롤 중 빠져나가는 위치 구별.'],
  ['영상·사진 동작', '46px 원형 · 라벨 11px', '이미지 위 반투명 버튼. 일반 흰색 화면과 구분.'],
  ['편집 상단 저장 / 도구', '저장 40px/R10/12px · 블록 도구 32px', '장문의 편집 화면에서 역할·밀도를 유지.'],
  ['현재 하단 팝업 행동', '실측 약 47.8px · R12 · 14px', '최소 높이+안쪽 여백의 결과. 모든 .primary가 52px인 것은 아님.'],
];

export const cardRoles = [
  ['홈 추천 일정', '커버 306px · R24 · 글 영역 18px', '제목 24px · 소개 12px. 사진·그라데이션·가로 롤링.'],
  ['홈 여행자 일정', '최소 180px · 사진 폭112px · R20 · 안쪽10px', '제목 17px · 소개 11px. 작은 가로 사진 카드.'],
  ['여행기 목록', '사진 높이190px · R21 · 본문16px', '제목 20px · 소개 13px. 작성자·기간·장소 수.'],
  ['지역 안내 장소', '사진 높이205px · R21 · 본문16px', '제목 21px · 소개 13px. 발견 후 저장/공유.'],
  ['저장 목록 장소', '최소 176px · 사진 폭112px · R18 · 본문14px', '제목 17px · 소개 12px · 메타11px. 북마크+DAY 상태.'],
  ['내 여행', '커버 높이238px · R22 · 표지 오버레이', '제목 21px · 소개 12px. 상태·기간·공유.'],
  ['여행기 본문 장소', '사진 높이205px · R20 · 본문16px', '제목 20px · 소개14px · 메모13px. 길찾기/공유.'],
  ['편집 글·사진 블록', 'R17 · 안쪽13px · 도구32px', '본문16px/1.75. 순서·삭제·사진·장소 연결 유지.'],
  ['프로필 / 통계 / 설정', 'R20 · 프로필16px · 통계18px 8px', '이름18px, 숫자20px, 라벨12px. 설정 행 최소64px.'],
];

type ScreenGroup = { id: string; title: string; description: string; source: string; rules: string[]; shots: { file: string; title: string; note: string }[] };
export const screenGroups: ScreenGroup[] = [
  {
    id: 'sg-home', title: '홈', description: '편집된 추천 일정과 여행자의 이야기를 발견하는 시작 화면.',
    source: 'App.tsx Home · styles.css .home-* / .promoted-* / .rolling-*',
    shots: [{file:'discovery-home',title:'메인·추천 롤링',note:'소개 → 추천 일정 → 여행자 일정. 작은 점·다음 카드 노출로 가로 탐색을 안내.'},{file:'discovery-home-lower',title:'여행자 일정·검색 유도',note:'홈 아래의 가로 카드와 여행기 찾기. 위 추천 커버와 다른 카드 유형.'}],
    rules: ['홈 소개는 29px, 섹션 제목은 20px. 긴 소개는 줄 수에 맞게 자연스럽게 늘어남.', '추천 일정은 높이306px·R24 이미지 커버, 여행자 일정은 사진 폭112px의 가로 카드. 두 형태를 유지.', '검색 유도 카드는 기존 아래 위치와 롤링 점 위아래 간격을 유지. 새 기능을 상단에 계속 쌓지 않음.'],
  },
  {
    id:'sg-community',title:'여행기·검색',description:'지역·여행 기간을 선택하고, 먼저 읽은 뒤 내 여행에 담는 목록.',
    source:'App.tsx Community · styles.css .community-* / .destination-* / .duration-*',
    shots:[{file:'discovery-community',title:'검색·필터',note:'어두운 소개 카드, 검색, 지역·기간 선택.'},{file:'discovery-community-card',title:'여행기 목록',note:'사진 → 작성자·기간 → 제목·설명 → 읽기 버튼.'},{file:'discovery-community-empty',title:'검색 결과 없음',note:'안내 문구와 조건 초기화 행동. 빈 영역을 가짜 콘텐츠로 채우지 않음.'}],
    rules:['검색51px·R14·14px, 지역 칩34px·캡슐, 기간 칩36px·R11. 선택 표현을 구분.', '여행기 카드 사진190px·R21·본문16px, 제목20px·설명13px·행동46px.', '결과가 없을 때 최소280px 안내 영역과 42px 재탐색 버튼을 유지.'],
  },
  {
    id:'sg-guide',title:'장소·지역 안내',description:'지역을 옆으로 고르고, 큰 사진과 안내를 읽으며 장소를 저장하는 화면.',
    source:'App.tsx Discover · LandmarkGuideCard.tsx · styles.css .landmark-guide-* · phase-one.css .phase-region-*',
    shots:[{file:'discovery-places-guide',title:'장소 탐색 상단',note:'장소 보기 전환과 검색·지역 탐색.'},{file:'discovery-places-card',title:'지역·큰 장소 카드',note:'지역 칩 가로 이동, 큰 사진·안내·저장/공유.'},{file:'discovery-places-empty',title:'장소 검색 빈 상태',note:'검색 조건에 맞는 장소가 없는 상태.'}],
    rules:['일반 내용 좌우18px. 현재 보기 전환44px·R9·11px. 지역 버튼은44px·R12.', '장소 카드 사진205px·제목21px·설명13px·46px 행동. 저장 목록의 작은 카드로 바꾸지 않음.', '지역은 가로 스크롤, 장소는 세로 목록. 자동 불러오기와 선택 표시를 유지.'],
  },
  {
    id:'sg-feeds',title:'장소·영상과 사진',description:'영상과 사진은 전체 화면형 발견 흐름. 이미지·영상 위에 장소와 저장 행동을 겹침.',
    source:'App.tsx Discover · PhotoLandmarkFeed.tsx · styles.css discovery rules · photo-landmark-feed.css',
    shots:[{file:'discovery-places-video',title:'영상 피드',note:'세로로 다음 장소. 영상 위 제목·지역·행동.'},{file:'discovery-places-photo',title:'사진 피드',note:'세로는 다음 랜드마크, 가로는 같은 장소의 사진.'},{file:'discovery-photo-sheet',title:'사진 이야기 하단 팝업',note:'피드를 떠나지 않고 긴 설명을 읽는 현재 팝업.'}],
    rules:['전체 화면 사진/영상에 일반 흰색 카드의 여백·테두리를 씌우지 않음.', '영상 제목30~36px/1.25, 사진 제목26~31px/1.2. 설명과 버튼이 사진을 과도하게 덮지 않음.', '우측 동작46px 원형·라벨11px, 사진 점의 시각 크기와 누르는 영역44px를 구분.', '사진 이야기 본문16px/1.8. 현재 로컬 사진 기능은 공개 영상 화면 교체 승인과 별개.'],
  },
  {
    id:'sg-saved',title:'저장',description:'현재 복원된 저장 목록. 전체 가이드 중 하나의 화면 유형이며 다른 화면의 디자인을 대신하지 않음.',
    source:'App.tsx Saved / SavedPlaceCard · styles.css .saved-* / .ai-trip-* / .add-to-trip',
    shots:[{file:'saved-list',title:'저장 장소·DAY 담김',note:'기존 AI 카드·지역별 목록·작은 가로 장소 카드.'},{file:'saved-empty',title:'저장 장소 없음',note:'샘플 링크 제거. 저장 장소 없으면 AI 생성 비활성.'}],
    rules:['GitHub81a1085의 저장 디자인을 유지하고 사용자 요청에 따라 샘플 링크·샘플 생성만 제거한 상태.', 'AI 카드 안쪽16px·R20·제목17px·설명11px. 기간 선택31px·생성45px.', '카드 사진 폭112px·최소176px·R18. 제목17px, 설명12px, 메타·DAY11px.', '담기 버튼은 안쪽8px10px·R8. 코랄 북마크와 녹색 DAY 상태를 따로 표현.'],
  },
  {
    id:'sg-trips',title:'내 여행·새 여행',description:'여행을 모아 보고 생성하는 화면. 수정은 생성한 여행 안에서 이어짐.',
    source:'App.tsx Trips / CreateJourneySheet · BottomSheet.tsx · styles.css .trips-* / .journey-card · phase-one.css',
    shots:[{file:'journey-trips',title:'내 여행 목록',note:'안내 카드·여행 표지·상태·공유.'},{file:'journey-trips-empty',title:'내 여행 빈 목록',note:'만들기 행동으로 연결되는 안내.'},{file:'journey-create-sheet',title:'새 여행 하단 팝업',note:'지역·여행 이름을 짧게 입력. 큰 별도 페이지를 덧붙이지 않음.'}],
    rules:['소개 카드 최소174px·R24·안쪽23px. 여행 사진 카드는 높이238px·R22.', '목록 제목28px, 여행 표지 제목21px/1.3, 설명12px/1.5.', '새 여행 팝업의 현재 라벨12px·입력16px/50px/R12. 범용 부품 라벨14px를 덮어쓰지 않음.'],
  },
  {
    id:'sg-detail',title:'여행기 상세·DAY·지도',description:'공개 여행기와 내 여행 상세의 읽기 구조는 공유하고, 하단 행동은 소유 여부에 따라 구분.',
    source:'App.tsx JourneyDetail / RouteMap · styles.css .journal-* / .day-* / .guide-place-* / .detail-footer',
    shots:[{file:'journey-public-detail',title:'공개 여행기',note:'표지·작성자·글. 하단은 내 여행으로 담는 행동.'},{file:'journey-own-detail',title:'내 여행 상세',note:'같은 읽기 구조. 내 여행의 수정·관리 행동.'},{file:'journey-detail-day',title:'스크롤·DAY 전환',note:'같은 줄 안에 뒤로가기. 상단에 별도 고정 제목줄을 더하지 않음.'},{file:'journey-detail-map',title:'일일 지도·이동',note:'현재 조회/대체 표시를 포함한 화면. 실제 도로 경로 검증 완료 예시가 아님.'}],
    rules:['표지 높이390px, 제목clamp(30px,8vw,36px). 본문16px/1.7~1.8.', 'DAY줄 위 고정·안쪽13px18px·간격8px. 날짜 폭106px·R13, 뒤로44px 원형.', '본문 장소 카드는R20·사진205px·제목20px·설명14px·메모13px·행동44px.', '하단 행동은52px·14px·R15, 좌우18px. 지도 출처·주의 상태와 끝부분 여백을 보존.'],
  },
  {
    id:'sg-social',title:'여행기 반응·작성자',description:'여행기 아래에서 반응을 남기고, 작성자의 다른 여행기로 이어지는 기존 영역.',
    source:'App.tsx JourneyDetail · styles.css .creator-* / .journey-social / .comment-*',
    shots:[{file:'journey-social',title:'반응·댓글',note:'여행기 하단의 기존 반응과 댓글 작성 영역.'},{file:'journey-creator',title:'작성자·다른 여행',note:'아이콘·등급·작성자 소개와 다른 여행기 연결.'}],
    rules:['기존 하단 패널R22·안쪽19px16px16px·제목20px. 프로필 아이콘의 사용 위치별 크기를 유지.', '현재 여행기 단위 댓글과 향후 장소별 스레드는 구분. 없는 기능을 기존 기준에 섞지 않음.', '캡처는 로컬 검수 데이터. 실제 다중 사용자 집계·운영 완료처럼 설명하지 않음.'],
  },
  {
    id:'sg-editor',title:'여행기 편집·장소 삽입',description:'날짜·글·사진·장소를 편집하는 작업 화면. 읽기 화면보다 도구가 많아도 기존 밀도와 본문 크기를 유지.',
    source:'App.tsx JourneyEditor / PlacePicker · styles.css .editor-* / .block-* / .place-picker',
    shots:[{file:'journey-editor',title:'기본 정보·DAY 편집',note:'상단 저장, 표지, 제목, 날짜, 고정 DAY줄.'},{file:'journey-editor-blocks',title:'글·사진 블록',note:'본문16px. 블록 순서·삭제 도구와 고정 하단 저장.'},{file:'journey-place-sheet',title:'장소 삽입 팝업',note:'기본 직접 등록 탭. 목록에서 선택 탭도 제공.'}],
    rules:['상단바62px·제목16px·저장40px/R10/12px, 하단 저장52px. 사용 위치를 구분.', '제목 입력25px·밑줄형, 일반 입력50px·16px·R12. 글이 길다고 입력 글씨를 줄이지 않음.', '글·사진 블록R17·안쪽13px, 도구32px. 장소 미리보기 사진92px.', '장소 팝업은 현재 BottomSheet 안에 배치. 외부R24·최대88dvh·본문좌우20px, 내부 모서리와 패딩은0. 과거 단독 팝업 규칙을 적용하지 않음.'],
  },
  {
    id:'sg-profile',title:'프로필·설정',description:'사용자 카드·활동 수치·등급·알림을 보는 기존 설정 구조. 프로필은 하단 기본 메뉴 밖에 위치.',
    source:'App.tsx Profile · styles.css .profile-* / .creator-* / .notification-* / .settings-*',
    shots:[{file:'journey-profile',title:'프로필 상단',note:'사용자 카드·활동 수치·설정 진입.'},{file:'journey-profile-options',title:'활동·알림 옵션',note:'사용자 활동 및 수신 관련 옵션.'},{file:'journey-settings',title:'환경·서비스 설정',note:'아이콘+제목+현재 값이 반복되는 행.'}],
    rules:['프로필 제목28px/700/1.1. 일반 화면28px/750/1.25와 다르므로 일괄 덮어쓰지 않음.', '프로필카드R20·안쪽16px·이름18px, 수치카드숫자20px·라벨12px.', '설정행 최소64px·주제14px/600. 설정 값과 보조 안내는 위계를 유지.', '아이콘 변경은 OS 파일 선택기를 열며 별도 프로필 편집 팝업은 현재 없음.'],
  },
  {
    id:'sg-utility',title:'데이터 안내·백업 팝업',description:'저장 실패 시 현재 기록을 보호하고 백업·복원을 안내하는 기존 보조 화면.',
    source:'App.tsx storageIssue / storagePanel · BottomSheet.tsx · ui.tsx FileUpload · theme.css / phase-one.css',
    shots:[{file:'utility-backup',title:'백업·복원과 오류 안내',note:'분리된 검수 데이터로 오류 상태 재현. 사용자 저장소는 변경하지 않음.'}],
    rules:['현재 저장 오류 경고의 백업·복구 버튼에서 진입. 정상 저장 화면에 새 진입 버튼을 만들지 않음.', '기존 BottomSheet의 제목·설명·닫기·본문 구조를 재사용. 내보내기와 복원 설명·행동을 구분.', '실제 파일 업로드와 복원은 수행하지 않고 현재 입력·오류 표현만 확인. OS 확인창은 앱 내부 화면과 별도.'],
  },
  {
    id:'sg-experiments',title:'분리된 실험 화면',description:'기존 로컬 실험의 존재를 기록하되, 승인된 공통 디자인이나 공개 메뉴로 취급하지 않음.',
    source:'App.tsx PhotoStoryPreview · PhotoPlaceCard.tsx · photo-places.css · #photo-stories',
    shots:[{file:'discovery-photo-stories',title:'이전 사진 이야기 실험',note:'별도 로컬 경로의 시안. 현재 사진 쇼츠와 구분.'}],
    rules:['실험용 구성이나 철회된 보관함/저장 화면을 새로운 기본 디자인의 근거로 삼지 않음.', '사진 쇼츠 화면은 위 장소·영상과 사진 항목의 현재 구현을 참조. 배포는 별도 승인 필요.'],
  },
];
