2026-09-20 생성 결과 계약 보완: 새 초안은 `data.compositionVersion: 2`, `data.intent`를 갖는다. 각 방문의 `planningSlot`은 `morning/lunch/afternoon/dinner/stay`, 미정 구간은 DAY의 `planningGaps`에 종류·사유·전후 방문 ID를 둔다. 업체는 실제 catalog ID와 개별 visitId/anchorVisitId로 연결하고 숙소는 stayDayIds/bookingFixed를 보존한다. 식사·숙박을 자동 구성한 결과를 먼저 보여주며 수정에서만 후보를 연다. 정확한 time/move는 검증 자료가 없으면 비운다. 구버전 초안은 입력/선택을 유지하되 재생성 전 저장을 막는다. 최종 서버 계약도 이 필드와 실제 데이터·권한·원본 버전 검증을 반영해야 한다. [신규 구축 안내](AI_NAVER_START_GUIDE_20260920.md).

# 3차 로컬 AI 프런트·연결 계약

2026-09-19. GitHub 업로드·공개 반영 없음. 실제 AI/RAG/API 미연결.

## 구현한 사용자 흐름

### 새 여행 초안

홈의 AI 여행 만들기에서 기존 하단 팝업을 재사용한다. **지역·취향 추천 / 저장 장소로 추천** 중 선택하고, 지역과 1~7일 기간을 정한다. 날짜·도착/출발·이동수단·여행 속도, 필수/제외/고정 장소, 동행·식사·접근성은 펼쳐서 입력한다.

- 지역 모드: 제공된 등록 카탈로그에서 개인 등록 자료를 제외하고, 지역·관심 단어를 기준으로 후보를 고른다. 실제 인기 순위·의미 검색·RAG를 구현했다고 표시하지 않는다.
- 저장 모드: 해당 사용자의 요청 안에서 저장 랜드마크를 사용한다. 다른 사용자나 공용 자료로 전송하지 않는다.
- 1~7일·최대 30곳은 이 추천 흐름의 제한이다. 기존 개인 일정의 수동 30일 편집을 제한하지 않는다.
- 필수·고정 장소를 방문 수 제한 때문에 버리지 않는다. 많은 경우 과밀 안내를 표시한다. 저장 장소 30곳 초과는 명시적으로 막아 숨은 잘림을 방지한다.
- 조건 충돌, 잘못된 날짜·시간, 다른 지역의 필수 장소를 생성 전에 알린다.
- 결과는 기존 큰 사진 카드와 DAY 줄을 재사용한다. 일반 방문은 포함/제외할 수 있고 필수·고정 방문은 유지한다. DAY가 비어도 여행 기간은 줄이지 않는다.
- 음식점·숙소 보완은 선택적으로 켜며 추천/저장/등록 업체 검색을 전환한다. 기준 DAY·랜드마크가 유지되고 **사용자가 선택한 업체만** 결과에 넣는다. 현재 카탈로그의 직선거리 15km 이내 후보이며 실제 이동·가격·예약 가능 여부는 확인하지 않는다.
- 숙소는 숙박 기간을 선택한다. 당일·마지막 DAY는 숙소를 추가하지 않는다. 다른 숙소를 선택하면 이전 미확정 선택을 바꾼다. 실제 예약은 수행하지 않는다.
- 부족한 후보·좌표 없음·여러 지역 간 연결·운영 정보 미확인을 표시한다. 직선거리를 실제 소요 시간으로 표시하지 않는다.
- 응답을 화면에 넣기 전에 구조·허용 장소·필수/고정·제외·DAY 수·날짜·카드 연결을 검사한다. 승인을 해야 비공개 `PLAN`이 생성된다. 제목·사진·글 작성은 필수 단계가 아니다. 저장 실패 시 입력·미리보기를 유지한다.
- 팝업 닫기·취소·재진입 시 상위 `draftRef`에 입력과 결과·포함/제외·업체 선택이 남는다. 브라우저 새로고침 후 미완료 초안 복구는 이 참조가 보장하지 않는다.
- 상세 조건은 개인 일정의 `planningPreferences`에 함께 보관한다. 개인 일정을 여행기로 바꿀 때는 제거하여 동행·식사·접근성·자유 입력이 여행기에 복사되지 않는다. 저장소 검증도 이 필드를 비공개 `PLAN`에만 허용한다.

### 일정 일부 바꾸기

내 여행에서 **DAY 전체 / 이 DAY 오후 / 지정 방문부터 남은 일정**을 선택한다. 덜 걷기 또는 방문 제외 조건으로 변경 전·후를 비교하고, 승인한 변경만 적용한다.

- 덜 걷기는 현재 샘플에서 해당 범위의 고정되지 않은 독립 방문을 하루 최대 2곳으로 줄이는 제안이다. 실제 도보 경로 최적화가 아니다.
- 오후는 방문 시간이 12:00 이후로 명시된 방문만 포함한다. 시간이 없으면 오후라고 추정하지 않는다.
- 같은 장소의 반복 방문은 `visitId`, 날짜는 `dayId`로 구분한다.
- 숙소·고정 방문·연결된 예약 업체와 그 기준 랜드마크는 유지한다. 범위 밖 업체가 연결된 랜드마크도 지운 뒤 고아 연결을 만들지 않는다.
- 범위 밖 DAY와 남은 PLACE 카드 ID, 글·사진을 보존한다. 카드 반응 저장소는 건드리지 않는다.
- 현재 전체 여행 버전과 응답의 원본 버전을 승인 직전에 다시 비교한다. 클라이언트가 보관한 원래 요청의 범위와 필수·고정 방문을 기준으로 응답을 검증하여 응답이 임의로 범위·잠금을 넓힐 수 없게 한다. 오래된 응답·중복 승인·삭제된 여행·타인 여행·여행기는 적용할 수 없다.
- 변경안이 없으면 적용 버튼을 비활성화한다. 실제 변경을 수행한 척하지 않는다.

## 컴포넌트 연결

- `AiPlannerSheet`: `places`, `savedPlaces`, `author`, `draftRef`, `initialPrompt?`, `onClose`, `onCreate`, `adapter?`.
- `AiPlanRevisionSheet`: `journey`(최신 상태), `initialDay?`, `onClose`, `onApply(next, sourceVersion)`, `adapter?`.
- 부모의 `onApply`도 저장 시점의 최신 상태를 기준으로 `journeyVersion(current) === sourceVersion`을 확인한다. 저장 성공 여부를 반환하고, 실패 시 모달을 닫지 않는다.
- 현재 `BottomSheet`·`Field`·`LandmarkGuideCard`·개인 일정 삽입/숙박 함수를 재사용한다. 새로운 일반 버튼은 36px/12px 역할, 입력은 16px/400을 유지한다.
- 한/영 주요 조건·행동·오류 리소스는 `plannerEnglish`/`plannerText`로 분리했다. 언어 전환이 장소명·주소·ID·사용자 원문을 번역하거나 바꾸지 않는다.

## 공통 계약

`aiPlanner.ts`는 아래 타입을 내보낸다.

| 계약 | 주요 필드 |
|---|---|
| `AiContext` | requestId, sourceVersion, language, selectedPlaceIds, dayIds, lockedVisitIds |
| `AiSource` | id, label, url?, checkedAt(nullable), sourceVersion |
| `AiEnvelope<T>` | requestId, sourceVersion, mock, data, sources, warnings, unplaced(placeId/reason) |
| `AiPlannerAdapter.generate` | PlannerRequest + AbortSignal → PlannerResult |
| `AiPlannerAdapter.revise` | RevisionRequest + AbortSignal → RevisionResult |
| `GuideAdapter.answer` | AiGuideRequest(여행/DAY/장소/visitId/질문) + AbortSignal → 텍스트 envelope |
| `TranslationAdapter.translate` | AiTranslationRequest(sourceId/text/glossaryVersion) + AbortSignal → 텍스트·sample/reviewed/unavailable envelope |

샘플 어댑터를 서버 어댑터로 바꿔도 UI의 입력/출력 규격을 유지한다. 현재 버전 비교는 로컬 스냅샷을 직렬화한 값이며 서버 연결 시 서버가 검증하는 revision/ETag로 대체한다. 원본 여행·개인 입력을 분석 로그에 기록하는 용도가 아니다.

요청마다 ID·취소 신호를 전달하고, 취소 후 응답·요청 순서가 뒤집힌 응답·다른 원본 버전 응답은 무시한다. 샘플 어댑터는 `401 / 403 / 429 / 500 / timeout / empty` 오류를 주입할 수 있다. 이는 자동 테스트용 옵션이며 사용자 메뉴에 개발용 오류 선택기를 노출하지 않는다. 서버 권한 검사를 대체하지 않는다.

## 검사와 남은 실제 연결

새 AI 도메인 테스트 21개 통과. 개인 일정/저장소 기존 검사 포함 관련 50개 통과. 웹 TypeScript 검사 통과. 최종 통합 화면·320/390/460px 검수 결과는 상위 3차 리포트에 기록한다.

다음은 실제 백엔드/AI 단계에서 구현·검증해야 한다.

- 계정별 접근 제어·서버 revision·중복 요청 키·취소/타임아웃·호출량 제한.
- 사용권과 공개 권한이 확인된 카탈로그/RAG 검색. 네이버 결과를 공용 카탈로그나 AI 입력으로 자동 재사용하지 않음.
- 예약·영업·교통편과 실제 경로 제약 계산. 현재 도착/출발·교통·동행·식사·접근성은 조건으로 보관하며 충족을 보증하지 않음.
- 운영 정보별 출처 URL·검수일·유효 기간. 현재 없는 확인일은 생성 시각으로 꾸미지 않음.
- 실기기 Android/iOS의 키보드·뒤로가기·앱 재시작과 실제 API 지연/오프라인 검수.
