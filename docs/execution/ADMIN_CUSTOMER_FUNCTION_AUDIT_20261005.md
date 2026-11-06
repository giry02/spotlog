# Spotlog 고객 화면 ↔ 관리자 ↔ 서버 계약 대조 결과

**최신 보완 결과:** 이 문서는 최초 구현/감사 시점 기록. 이후 지역·스태프·전체 원본·미디어·운영 추천 초안·신고·고객 연결을 수정한 결과와 잔여 범위는 [업무 흐름 보완 보고](ADMIN_WORKFLOW_FIXES_20261005.md), [65항목 before/after 대조표](admin-feature-audit-20261005/index.html) 기준.

2026-10-05 · 현재 로컬 검수본 기준 · 제품 코드 변경 없음

**7개 메뉴는 구성됐지만 고객 화면 전체를 관리·운영할 수 있는 상태는 아니다.** 기능별 로컬 검수 화면과 관리자 계약을 만들었으나, 기존 고객 자료 전체 수용·같은 데이터 사용·지역/스태프 업무·운영 콘텐츠 제작·일부 관리자 DTO가 빠졌다. 서버 미연결과 프론트/계약 누락을 분리해야 한다. 앞선 자동 검사 통과는 구현된 저장/조치/보호 규칙 검증이며 전체 기능 대응이나 운영 사용성 완성을 입증하지 않는다.

[필터로 보는 전체 대조표](admin-feature-audit-20261005/index.html) · [65항목 기계 자료](admin-feature-audit-20261005/features.json) · [브라우저 점검 결과](admin-feature-audit-20261005/browser-results.json)

## 점검 범위와 판정

- 실제 활성 고객 트리: 홈, 여행기 검색/읽기/편집, 장소 안내/영상/사진, 저장, 내 여행, 주변 업체, 지도, AI 간단 생성/저장 추천/부분 수정, 관광 안내, 프로필/언어/계정, 휴지통과 공유/이동/오류 보존.
- 고객 기능 51개 묶음을 관리자 화면·타입·상태 변경·실제 데이터 소비 경로와 대조. 추가 운영/후속 점검 14개. 행 수는 구현 완료율이 아니다.
- 관리자 7메뉴/하위 탭, API adapter, OpenAPI/DTO와 로컬 명령을 확인. 이 체크아웃에서 실제 서비스 서버/DB/worker를 발견하지 못했다. 다른 개발자의 별도 서버 소스·실서비스는 이번 점검 범위 밖이다.
- 새 브라우저 context의 합성 댓글만 사용하여 6개 대표 점검. 사용자 실제 브라우저·여행·찜·댓글 자료에 접근/변경하지 않았다. 오류 0건. 모든 기능의 실서버 실행 시험을 수행한 것은 아니다.
- 사용되지 않는 SavedPlaces/MyTripsFromSaved/AiTravelSheet/journeyCreation 생성 함수를 현재 고객 기능에 넣지 않았다. 해시로 접근 가능한 photo-stories는 일반 메뉴에 없는 별도 리뷰 화면으로 제외했다.
- ‘연결 대기’는 기존 UI/규칙의 실서비스 데이터 연결 책임, ‘관리자 보완’은 서버만 붙여도 해결되지 않는 관리자 화면/DTO/업무 누락, ‘양쪽 보완’은 고객 접수/adapter와 관리자 양쪽 연결 보완, ‘후속 기능’은 현재 고객 기능으로 취급할 수 없는 계획 항목, ‘운영 전용’은 고객 버튼과 1:1 대응이 필요 없는 운영 기반이다.

## 신고 기능의 실제 범위

**현재 고객 신고 경로:** 공개 여행기 → 장소 카드 → 댓글 → 타인 댓글의 깃발 → 이유 선택 → 신고 표시.

기본 기기에는 타인 장소 댓글이 없으므로 이 버튼을 자연스러운 기본 시연에서 보지 못할 수 있다. 자기 댓글에는 수정·삭제가 보인다. 이유는 스팸·광고, 욕설·괴롭힘, 개인정보 노출, 기타. 댓글에 이유 문자열만 기기 저장하며 신고 ID·신고자·접수시각·처리 상태가 없다. UI도 운영자 전송 미연결을 명시한다. API 전송 0건, 관리자 목록은 별도 합성 신고 3건 그대로 유지되는 것을 브라우저로 확인했다.

고객의 여행기 자체·전체 여행기 댓글·프로필·장소·저작권/번역 이의 접수 진입점은 현재 확인되지 않는다. 관리자에는 JOURNAL/COMMENT/PROFILE/PLACE 대상과 관련 분류가 먼저 준비돼 있다. 따라서 ‘신고 관리 완료’라고 묶어서 볼 수 없다.

근거: [신고 조건/입력](../../web/src/CardSocial.tsx), [기기 댓글 자료](../../web/src/cardSocialState.ts), [관리자 합성 신고](../../web/src/admin/opsSeed.ts), [신고 화면 증거](admin-feature-audit-20261005/browser-report-local-warning.png).

**필요한 연결 단위:** 고객 대상/이유 선택 → 서버 접수·중복/권한 확인 → 신고 ID와 접수 상태 반환 → 같은 대상 ID로 관리자 문맥 조회 → 조치/사유 기록 → 고객 공개 범위/회원 상태 반영. 처리 결과 알림은 실제 알림 채널이 연결된 후 구분한다. 여행기/카드/댓글/사진/회원/장소 대상 종류를 공통 계약에서 확정해야 한다.

## 자료 수용과 고객 노출

TypeScript 모듈을 메모리에서 실행하고 자산 import를 로컬 경로로 반환하여 초기 시드 수를 확인했다. 브라우저 저장소의 현재 사용자 자료 수가 아니라 코드의 초기 자료 기준이다.

| 항목 | 확인한 수/상태 |
|---|---:|
| 고객 공용 placeCatalog | 83곳 |
| 관리자에 옮긴 기존 고객 장소 초안 | 19곳 |
| 관리자 별도 가상 검수 장소 | 6곳 |
| 관리자 초기 원본 마스터에서 누락 | 64곳 |
| 소비자 사진 출처 레코드 | 22건 |
| 관리자 원본 시드 19곳에 보존된 미디어 | 0건 |

누락 64곳은 제주 여행기 추가 장소 7곳, catalogOnlyPlaces 46곳, 공공 관광 장소 11곳이다. 기존 홈 추천 템플릿 7개·공공 자료 여행기 4개도 관리자 운영 콘텐츠와 연결되지 않았다. 시드 변환은 이름/지역/주소/설명/태그/일부 출처/좌표만 옮긴다. 기존 사진·갤러리·영상·모션·사진별 출처/권리·작성자 표시·체류시간 등은 충분히 수용되지 않았다.

이는 로컬 관리자 분리가 잘못이라는 의미가 아니다. 검수 데이터는 계속 분리하되 **기존 공용 자료 전체를 출처가 보존된 미승인 초안으로 검수할 수 있어야 한다.** 개인 등록 업체·고객 메모·개인 여행을 공용 자료로 자동 편입하거나 공개/AI 사용권을 일괄 승인하지 않는다.

관리자의 공개/추천/제외는 현재 관리자 전용 저장소와 자체 미리보기만 변경한다. 고객 장소 피드·홈 추천·주변 업체·AI 생성은 기존 자료를 사용하므로 그대로다. 실서비스 연결 시 공개 공용 마스터와 채널별 읽기 API를 공유해야 한다.

근거: [고객 마스터 합성](../../web/src/data.ts), [관리자 시드 변환](../../web/src/admin/seed.ts), [관리자 저장소/API](../../web/src/admin/repository.ts).

## 서버 연결만으로 해결되지 않는 핵심 누락

| 항목 | 지금의 상태 | 필요한 보완 |
|---|---|---|
| 지역 관리 | 텍스트 기준 name/value/enabled, 장소 area 자유 입력 | 지역 ID/상하위 지역, 지역별 장소·업체·검수 상태/담당자 목록, 고객 지역 선택과 연결 |
| 스태프 업무 | 운영자 계정/역할/이력만 있고 등록/검수 작업함 없음 | 등록자·담당자·검수 상태·내 작업/지역 작업 필터. 담당자가 직접 검수/공개하는 기준 유지 |
| 운영 콘텐츠 생성 | 제목·소개·placeIds 순서를 수동 선택 | 지역/기간/취향에서 DAY·식사/숙박·글/사진 초안 생성, 수정·검수·명시적 공개 |
| 여행기 문맥 | 단일 원문/영문·카드 이름/텍스트. 카드 탭은 댓글만 변경 | 실제 DAY/본문 블록/사진/캡션/표지, 대상 사진/카드를 포함한 신고 문맥 |
| 응원/좋아요 | 고객에 있으나 관리자 DTO에 수치·종류/목록 없음 | 여행기 응원 3종·카드 좋아요와 사용자 목록/집계 계약 및 표시 |
| 회원 등급 | 기준 텍스트만 편집, 회원에는 여행기/팔로워 수만 있음 | 현재 담김 기준 등급·담김·조회·공개 응원 집계 표시와 서버 기준 연결 |
| 추천 여행기 표지 | 작성자의 표지가 아니라 연결 장소의 AdminMedia 후보 | 여행기 자체 coverMediaId/사진 참조와 공용 장소 미디어를 구분 |
| 번역 | 단일 여행기 번역/장소 영어 중심 | 고객이 읽는 DAY/블록/사진 설명/댓글의 sourceId·원문 버전·승인 번역 연결 |
| AI 연결 | 고객/관리자 각각 로컬 샘플. 화면 adapter와 AI-v1 서버 DTO 다름 | 실제 HTTP adapter/변환기·같은 후보/예약/버전 검증, 실제 모델/검색 평가 |
| 신고 대상 이동 | 프로필 신고에서 회원 메뉴만 열림 | 전달한 대상 회원 ID를 상세 선택에 반영 |
| 연결 카드 | DB/RAG/소형/임베딩/대형/Flowise 6개를 항상 UNCONNECTED로 추가 | 실제 서버 상태 응답. 상세는 설정에서, 현황은 관련 업무 장애 요약으로 표시 |

근거: [운영 DTO](../../web/src/admin/opsTypes.ts), [공개 여행기/회원/운영 일정 화면](../../web/src/admin/OperationsPages.tsx), [연결 카드/대상 이동](../../web/src/admin/AdminApp.tsx), [추천 표지 후보](../../web/src/admin/opsDomain.ts), [AI 계약의 변환 작업](../contracts/ai-v1/CONTRACT.md).

## 관리자에만 있는 항목을 어떻게 다룰지

| 분류 | 항목 | 판정 |
|---|---|---|
| 필요한 운영 전용 | 좌표/권리 검수, 초안/공개, CSV, 운영자 권한, 변경 이력, 색인/정책/작업, 파일 정리 | 고객 화면에 같은 버튼이 없어도 필요. 다만 실제 서비스 실행과 검수 동작은 구분 |
| 고객과 같이 보완 | 신고 범위, 계정/탈퇴 상태, 회원 정지 반영, 승인 번역/알림 이벤트 | 공통 ID·상태·권한·수신/노출 결과로 맞춰야 함 |
| 후속 고객 기능 | 문의, 팔로우, 받은 알림함, 챗봇 | 현재 활성 고객 기능으로 집계하지 않음. 준비 상태로 분리 |
| 양쪽 현재 기능 아님 | 평점·가격·실시간 인기 업체 순위 | 기존 Place에 대응 자료 없음. 별도 요구/데이터 수급 검증 필요 |
| 이번 범위 밖 | 업체 사장님 포털, 예약 판매/결제, 객실 재고 | 현재 관리자 완료 항목으로 추가하지 않음 |
| 의도된 열람 제외 | 개인 일정/메모/예약 본문, 고객 AI 요청/대화 원문 | 누락으로 판단하지 않음. 필요 운영 요약·오류·버전만 연결 |

## 더 나은 방향 — 기존 7메뉴 유지

메뉴를 더 늘리는 대신 **등록·검수·축적·활용**이 각 메뉴의 기본 화면에서 연결되도록 구성한다.

1. **운영 현황:** 새 스팟 등록 / 자료 가져오기 / 검수 이어하기 / 추천 여행 초안 만들기를 첫 행동으로 배치. 그 아래 내 담당/지역별 처리 대기·누락 자료. 서버 지표는 실제 집계가 있을 때 표시하고 연결 전체 목록은 설정으로 이동.
2. **장소·업체:** 지역 선택 → 랜드마크/음식점/카페/숙소/쇼핑 탭 → 담당자/검수 상태 필터. 선택 지역을 새 등록·CSV·주변 업체·미리보기에 유지. 랜드마크 상세에서 좌표 후보·추천/제외를 바로 조정.
3. **자료 가져오기:** 가져온 묶음의 출처/등록자/지역/처리 수·오류를 보여주고 검수할 행으로 이동. 별도 승인자를 필수로 만드는 과정은 추가하지 않음.
4. **노출·추천:** 지역·기간·요청 한 문장 → 검수된 장소/업체로 운영 추천 여행/소개 여행기 초안 → 사진/DAY/식사/숙박 위치 확인 → 필요한 부분 수정 → 고객 미리보기 → 명시적 공개. 실제 개인 체험담과 운영 자료 기반 소개를 구분.
5. **커뮤니티·회원:** 고객 화면과 같은 공개 여행기/사진/카드/댓글/회원 ID로 문맥을 보고 조치. 기존 고객 기능, 새 접수 기능, 후속 채널을 표시상 분리.
6. **AI·설정:** 일반 콘텐츠 업무에 필요한 승인 자료/시험은 쉽게 접근. 모델/색인/비용/전체 연결 상세는 운영 설정/AI 안에서 확인. AI 시험과 콘텐츠 초안 생성은 서로 다른 동작으로 표시.

이 방향은 검수 결과에 따른 제안이며 이번 점검에서 제품 화면을 재구성한 것은 아니다. 기존 7메뉴와 담당자 직접 공개 기준은 유지한다.

## 서버 개발자와 맞출 우선 계약

현재 관리자 adapter의 4개 경로와 생성 OpenAPI는 일치한다. 장소 9＋AI 15＋운영 18, 총 42명령은 /commands의 구분 명령 형식이다. **관리자 코드끼리 형식이 맞는다는 뜻이며 고객 기능·별도 서버 구현까지 완성됐다는 의미가 아니다.** 장소 외 운영 목록은 snapshot 배열 기반으로, 서버 검색/페이지 UI 연결도 남아 있다.

- 공용 원본: regionId/placeId/mediaId, 출처/권리·공개 revision·운영 상태·채널별 미디어. 삭제/철회 후보 차단과 기존 여행 스냅샷 보호.
- 고객 공개 콘텐츠: journalId/dayId/cardId/commentId, 글/사진/PLACE 블록/사진 참조·작성자 공개 범위·응원/좋아요.
- 신고/문의: 대상 타입·ID, 접수 ID·상태·신고자/시각·조치/사유·결과 전달. 현재 기기 신고 문자열을 접수 완료로 취급하지 않음.
- 회원: 실제 account/member ID와 로컬 작성자 전환, 공개 프로필·등급 집계·정지 만료·탈퇴/삭제 요청 상태.
- 개인 여행: 소유자 API·trip/day/visit revision, DAY 담기·예약 고정·부분 수정·완료/건너뛰기. 기본 관리자에는 본문 대신 처리 요약.
- AI: 간단 생성/저장 추천/부분 수정/안내의 공통 후보와 검증, 현재 화면 변환기, 실제 요청/색인/정책 버전·시간/비용 요약.
- 운영 저작: 고객 개인 여행과 분리한 운영 초안·DAY/블록/사진·미리보기·명시적 공개 계약.
- 발송/작업: 알림 목표/중복/수신 거부·요청 접수와 완료, 수급/파일/색인 worker 및 실제 상태.

## 전체 대조표

### C01 · 홈 / 추천 일정 상세·내 여행으로 담기

- 고객: 로컬 템플릿 7개와 DAY 상세 있음
- 관리자: 노출 채널·수동 운영 일정 있음
- 보완/연결: 기간·DAY·표지 구조와 기존 홈 템플릿을 관리자 운영 콘텐츠로 연결해야 함
- 분류: 관리자 보완
- 소스: [web/src/App.tsx:586](../../web/src/App.tsx), [web/src/admin/OperationsPages.tsx:73](../../web/src/admin/OperationsPages.tsx)

### C02 · 홈 / 여행자 여행기 추천·읽기

- 고객: 공개 여행기 목록·읽기 있음
- 관리자: 홈 여행기 노출 설정 있음
- 보완/연결: 현재 고객 여행기와 관리자 합성 목록이 분리됨. 작성자 표지·사진 기준도 맞춰야 함
- 분류: 관리자 보완
- 소스: [web/src/App.tsx:1176](../../web/src/App.tsx), [web/src/admin/opsDomain.ts:30](../../web/src/admin/opsDomain.ts)

### C03 · 장소 / 지역 안내·검색·지역별 개수

- 고객: 고객 공용 장소와 문자열 지역 분류 사용
- 관리자: 지역 기준 텍스트·장소 검색 있음
- 보완/연결: 공용 마스터 83곳 중 초기 원본 시드 19곳만 수용. 지역 ID·상하위 지역·지역 필터 연결 없음
- 분류: 관리자 보완
- 소스: [web/src/data.ts:303](../../web/src/data.ts), [web/src/admin/seed.ts:21](../../web/src/admin/seed.ts)

### C04 · 장소 / 사진 피드·지역 선택·사진 넘김

- 고객: 사진 갤러리·스와이프·지역 선택 있음
- 관리자: PHOTO 등록·노출·관리자 자체 미리보기 있음
- 보완/연결: 기존 사진·갤러리·사진 출처 22건 수용과 고객 피드 반영 필요
- 분류: 관리자 보완
- 소스: [web/src/PhotoLandmarkFeed.tsx:1](../../web/src/PhotoLandmarkFeed.tsx), [web/src/admin/seed.ts:24](../../web/src/admin/seed.ts)

### C05 · 장소 / 영상·음소거·사진 모션

- 고객: 영상 피드·사진 모션·음소거 있음
- 관리자: VIDEO/MOTION 유형·노출 설정 있음
- 보완/연결: 기존 영상/모션 자료가 원본 시드에서 빠짐. 실제 자동 모션 제작 작업은 없음
- 분류: 관리자 보완
- 소스: [web/src/App.tsx:1411](../../web/src/App.tsx), [web/src/admin/PlacesPage.tsx:67](../../web/src/admin/PlacesPage.tsx)

### C06 · 장소 / 장소 저장·해제·공유·네이버 길찾기

- 고객: 기기 저장 및 외부 공유/길찾기 동작
- 관리자: 공용 장소 관리·서비스 저장 집계 자리 있음
- 보완/연결: 고객 저장/공유 이벤트와 실제 서비스 집계 연결 대기. 외부 링크와 지도 SDK를 구분해야 함
- 분류: 연결 대기
- 소스: [web/src/App.tsx:1016](../../web/src/App.tsx), [web/src/admin/AdminApp.tsx:96](../../web/src/admin/AdminApp.tsx)

### C07 · 장소 / 장소 상세·주소·체류·출처

- 고객: 추천 체류·방문 참고·출처 표시 있음
- 관리자: 주소·출처·안내 일부 입력 가능
- 보완/연결: 공용 기본 체류시간·후킹 문구·작성자/안내 표시용 필드와 변환 규격 보완 필요. 개인 메모는 공용화 대상 아님
- 분류: 관리자 보완
- 소스: [web/src/SavedLandmarkDetailSheet.tsx:8](../../web/src/SavedLandmarkDetailSheet.tsx), [web/src/admin/types.ts:1](../../web/src/admin/types.ts)

### C08 · 저장 / 저장 장소 지역 분류·접기·상세

- 고객: 활성 Saved/SavedPlaceCard에 있음
- 관리자: 공용 원본 관리 있음
- 보완/연결: 개인 저장 목록을 관리자에서 편집할 필요는 없음. 서버 저장 관계·집계·오류 요약 연결 대기
- 분류: 연결 대기
- 소스: [web/src/App.tsx:1522](../../web/src/App.tsx), [web/src/admin/AdminApp.tsx:96](../../web/src/admin/AdminApp.tsx)

### C09 · 저장 / 기존 여행 특정 DAY에 담기·빼기

- 고객: AddToTripSheet 연결됨
- 관리자: 개인 본문 기본 조회 제외
- 보완/연결: 사용자 소유 여행 API·DAY/visit 식별자·실패 요약 연결 필요. 관리자 대리 편집은 요구 아님
- 분류: 연결 대기
- 소스: [web/src/App.tsx:1165](../../web/src/App.tsx), [web/src/admin/types.ts:1](../../web/src/admin/types.ts)

### C10 · 저장 / 수동 DAY 배치·순서 조정

- 고객: SavedTripControls 연결됨
- 관리자: 개인 일정 기본 조회 제외
- 보완/연결: 서버 저장·동시 수정·사용량 연결 대기. 개인 동선을 운영자가 대신 변경하지 않음
- 분류: 연결 대기
- 소스: [web/src/App.tsx:1558](../../web/src/App.tsx), [web/src/admin/types.ts:1](../../web/src/admin/types.ts)

### C11 · 저장 / 자동 일정 생성·지역/기간 선택

- 고객: 활성 SavedTripControls 생성 있음
- 관리자: SAVED 합성 AI 시험 있음
- 보완/연결: 수동 배치와 저장 자동 생성, AI 저장 추천을 구분해 실제 생성 채널·서버 이벤트 연결 필요
- 분류: 연결 대기
- 소스: [web/src/SavedTripControls.tsx:1](../../web/src/SavedTripControls.tsx), [web/src/admin/AIPage.tsx:10](../../web/src/admin/AIPage.tsx)

### C12 · 내 여행 / 새 여행 이름·기간·날짜·지역

- 고객: CreatePlanSheet 연결됨
- 관리자: 운영 일정은 별도 편집기
- 보완/연결: 개인 여행 생성과 운영용 공개 일정은 별개. 사용자 생성 API·집계·실패 연결 필요
- 분류: 연결 대기
- 소스: [web/src/App.tsx:1164](../../web/src/App.tsx), [web/src/admin/opsTypes.ts:9](../../web/src/admin/opsTypes.ts)

### C13 · 내 여행 / 내 일정/여행기 목록·복사·공유

- 고객: Trips 및 개인/공개 상세 있음
- 관리자: 집계·휴지통 검수본 있음
- 보완/연결: 고객 기기 여행과 관리자 자료가 분리됨. 서버 목록/소유권/공개 링크 연결 대기
- 분류: 연결 대기
- 소스: [web/src/App.tsx:1472](../../web/src/App.tsx), [web/src/admin/repository.ts:46](../../web/src/admin/repository.ts)

### C14 · 내 여행 / 이름·출발일·DAY 추가/복사/삭제

- 고객: PersonalTrip에서 로컬 변경
- 관리자: 기본 관리자 개인 본문 조회 제외
- 보완/연결: 소유자 데이터 계약·revision·오류 연결 대기. 별도 관리자 개인 여행 편집 기능은 불필요
- 분류: 연결 대기
- 소스: [web/src/PersonalTrip.tsx:26](../../web/src/PersonalTrip.tsx), [web/src/admin/types.ts:1](../../web/src/admin/types.ts)

### C15 · 내 여행 / 방문 순서·DAY 이동/복사·업체 연결 해제

- 고객: PersonalTrip에서 로컬 변경
- 관리자: 공용 장소·주변 업체 관계만 관리
- 보완/연결: 공용 장소 폐업/철회와 기존 방문 스냅샷 보호, 변경 경고의 서버 기준 연결 필요
- 분류: 연결 대기
- 소스: [web/src/PersonalTrip.tsx:26](../../web/src/PersonalTrip.tsx), [web/src/admin/selectors.ts:13](../../web/src/admin/selectors.ts)

### C16 · 내 여행 / 방문 완료·건너뛰기·다음 방문 재개

- 고객: 개인 방문 ID별 로컬 상태 있음
- 관리자: 전용 조회/집계 없음
- 보완/연결: 사용자 동기화·집계/오류 요약 필요. 개인 방문 기록 본문 관리자 노출은 요구 아님
- 분류: 연결 대기
- 소스: [web/src/tripProgress.ts:1](../../web/src/tripProgress.ts), [web/src/admin/types.ts:1](../../web/src/admin/types.ts)

### C17 · 주변 업체 / 음식점·카페·숙소 3/15km 후보

- 고객: 고객 별도 placeCatalog에서 계산
- 관리자: 랜드마크별 추천/제외·순서 있음
- 보완/연결: 관리자 override가 고객 후보에 반영되지 않음. 공용 후보 응답과 추천 표시 연결 필요
- 분류: 연결 대기
- 소스: [web/src/NearbyBusinessSheet.tsx:45](../../web/src/NearbyBusinessSheet.tsx), [web/src/admin/selectors.ts:27](../../web/src/admin/selectors.ts)

### C18 · 주변 업체 / 업체 직접 등록·개인 일정/저장에 담기

- 고객: 개인 장소 등록 있음
- 관리자: 공용 등록과 별개
- 보완/연결: 개인 업체는 자동 공용 편입하면 안 됨. 공용 등록 요청을 받을지는 추가 정책 범위
- 분류: 연결 대기
- 소스: [web/src/NearbyBusinessSheet.tsx:45](../../web/src/NearbyBusinessSheet.tsx), [web/src/admin/domain.ts:1](../../web/src/admin/domain.ts)

### C19 · 주변 업체 / 네이버 업체 확인·외부 검색

- 고객: 검색 endpoint 연결부/미설정 시 네이버 지도 이동
- 관리자: 연결·한도 자리 있음
- 보완/연결: 외부 결과 조회와 공용 DB 적재는 다른 작업. 서버 프록시·출처/허용 범위 연결 필요
- 분류: 연결 대기
- 소스: [web/src/ExternalPlaceSearch.tsx:10](../../web/src/ExternalPlaceSearch.tsx), [web/src/admin/OperationsPages.tsx:153](../../web/src/admin/OperationsPages.tsx)

### C20 · 주변 업체 / 맛집/카페 한 곳 교체·시간/DAY 보존

- 고객: 동일 방문 슬롯 로컬 교체 있음
- 관리자: 추천/제외 관리 있음
- 보완/연결: 공용 후보 최신 상태와 고객 교체 API 연결 대기. 제외가 기존 기록을 삭제하지 않아야 함
- 분류: 연결 대기
- 소스: [web/src/PersonalTrip.tsx:26](../../web/src/PersonalTrip.tsx), [web/src/admin/selectors.ts:27](../../web/src/admin/selectors.ts)

### C21 · 주변 업체 / 숙박일 추가·예약 고정·여러 날 연결

- 고객: 고객 일정 보호 설정 있음
- 관리자: 업체 숙박 안내 있음
- 보완/연결: 사용자 예약 고정은 실제 객실 예약/결제 아님. 보호 조건 DTO와 생성/수정 검증 연결 필요
- 분류: 연결 대기
- 소스: [web/src/NearbyBusinessSheet.tsx:29](../../web/src/NearbyBusinessSheet.tsx), [web/src/admin/aiTypes.ts:1](../../web/src/admin/aiTypes.ts)

### C22 · 지도 / 방문 마커·도로 경로/추정·길찾기

- 고객: 지도/OSM·OSRM 및 외부 링크 코드 있음, 네이버 SDK 연결부 있음
- 관리자: 지도·경로 상태 카드 있음
- 보완/연결: 외부 길찾기 동작·지도 표시·경로 계산의 상태를 각각 실제 응답으로 관측해야 함
- 분류: 연결 대기
- 소스: [web/src/RouteMap.tsx:14](../../web/src/RouteMap.tsx), [web/src/admin/AdminApp.tsx:97](../../web/src/admin/AdminApp.tsx)

### C23 · 지도 / 경로 경고→시간/DAY/업체 수정

- 고객: 고객 계산·대상 방문 수정 있음
- 관리자: 일반 연결/AI 요청 요약만 있음
- 보완/연결: 경로 오류 유형·확인 전 시간과 실제 시간의 구분·요약 관측 연결 필요
- 분류: 연결 대기
- 소스: [web/src/routeWarnings.ts:1](../../web/src/routeWarnings.ts), [web/src/admin/aiTypes.ts:115](../../web/src/admin/aiTypes.ts)

### C24 · AI / 간단 문장·4개 선택·저장 장소 모드

- 고객: AiPlannerSheet와 조건 기반 샘플 생성
- 관리자: SIMPLE/SAVED 시험·정책 있음
- 보완/연결: 실제 LLM/RAG 미연결. AI-v1 서버 DTO와 현 화면 adapter의 변환도 구현 전
- 분류: 양쪽 보완
- 소스: [web/src/AiPlannerSheet.tsx:50](../../web/src/AiPlannerSheet.tsx), [web/src/aiPlanner.ts:246](../../web/src/aiPlanner.ts)

### C25 · AI / DAY·식사/숙박 시간대·빈자리 초안

- 고객: 조건 기반 일정 조합 샘플 있음
- 관리자: 합성 품질 시험 있음
- 보완/연결: 같은 DB/RAG/일정 구성 파이프라인 공유 전. 실제 문장 의미 해석 품질 시험 아님
- 분류: 양쪽 보완
- 소스: [web/src/aiPlanner.ts:125](../../web/src/aiPlanner.ts), [web/src/admin/aiDomain.ts:1](../../web/src/admin/aiDomain.ts)

### C26 · AI / 결과 편집·업체 추가/교체·승인 저장

- 고객: 고객 로컬 초안 편집·명시적 저장 있음
- 관리자: 합성 시험 결과만 있음
- 보완/연결: 실제 draftId·승인 저장·현재 여행 revision을 연결해야 함. 시험은 고객 저장하지 않음
- 분류: 양쪽 보완
- 소스: [web/src/App.tsx:1166](../../web/src/App.tsx), [web/src/admin/aiTypes.ts:112](../../web/src/admin/aiTypes.ts)

### C27 · AI / 입력/결과 복원·취소·재시도

- 고객: 고객 로컬 초안 보관 있음
- 관리자: 요청 요약 자리 있음
- 보완/연결: 실제 요청 취소/지연/복원 상태·요약 연동 대기. 고객 요청 원문 자동 수집 제외 유지
- 분류: 연결 대기
- 소스: [web/src/aiPlannerDraft.ts:1](../../web/src/aiPlannerDraft.ts), [web/src/admin/aiTypes.ts:115](../../web/src/admin/aiTypes.ts)

### C28 · AI / 부분 수정·방문 수 줄이기·예약 보호

- 고객: 로컬 제거 제안·범위 확인 있음
- 관리자: REVISION 합성 시험 있음
- 보완/연결: 실제 LLM 수정 adapter·최신 버전/고정 예약 보호·변경 적용 연결 필요
- 분류: 양쪽 보완
- 소스: [web/src/AiPlanRevisionSheet.tsx:52](../../web/src/AiPlanRevisionSheet.tsx), [web/src/admin/AIPage.tsx:10](../../web/src/admin/AIPage.tsx)

### C29 · 관광 안내 / DAY·현재/다음 장소 질문·주소 복사

- 고객: 로컬 규칙 안내 있음
- 관리자: GUIDE 시험·검색 자료 있음
- 보완/연결: 공용 승인 안내·실제 검색/모델·실패 요약 연결 전. 없는 운영 정보를 생성하면 안 됨
- 분류: 양쪽 보완
- 소스: [web/src/TravelGuideSheet.tsx:31](../../web/src/TravelGuideSheet.tsx), [web/src/admin/AIPage.tsx:10](../../web/src/admin/AIPage.tsx)

### C30 · 여행기 / 지역/종류/기간/작성자 검색

- 고객: Community 검색·필터 있음
- 관리자: 공개 여행기 목록·검색 있음
- 보완/연결: 현재 고객 저장소와 관리자 합성 콘텐츠 분리. 서버 검색·페이지/공개 범위 연결 필요
- 분류: 연결 대기
- 소스: [web/src/App.tsx:1273](../../web/src/App.tsx), [web/src/admin/OperationsPages.tsx:86](../../web/src/admin/OperationsPages.tsx)

### C31 · 여행기 / DAY·글/사진/장소 카드·동선 읽기

- 고객: 실제 StoryBlock·갤러리·DAY 있음
- 관리자: 단일 원문/영문·카드 이름 요약만 있음
- 보완/연결: 실제 DAY/표지/사진/본문 블록 누락. 카드 선택 시 해당 본문/사진 문맥도 표시해야 함
- 분류: 관리자 보완
- 소스: [web/src/App.tsx:1602](../../web/src/App.tsx), [web/src/admin/opsTypes.ts:10](../../web/src/admin/opsTypes.ts)

### C32 · 여행기 / 공개 여행기를 내 일정으로 복사

- 고객: 로컬 복사 있음
- 관리자: 생성/저장 집계 자리 있음
- 보완/연결: 실제 담김/조회 이벤트 집계와 콘텐츠 ID 연결 전. 운영자가 수치를 입력하는 기능은 불필요
- 분류: 연결 대기
- 소스: [web/src/App.tsx:1143](../../web/src/App.tsx), [web/src/admin/AdminApp.tsx:96](../../web/src/admin/AdminApp.tsx)

### C33 · 커뮤니티 / 여행기 전체 댓글·응원 3종

- 고객: 기기 댓글·LOVE/BEST/HELPFUL 있음
- 관리자: 전체 댓글 조치 있음, 응원 DTO 없음
- 보완/연결: 응원 종류·집계 계약이 빠져 서버를 붙여도 표시 불가. 고객 전체 댓글 신고도 현재 없음
- 분류: 관리자 보완
- 소스: [web/src/App.tsx:1570](../../web/src/App.tsx), [web/src/admin/OperationsPages.tsx:111](../../web/src/admin/OperationsPages.tsx)

### C34 · 커뮤니티 / 장소 카드 좋아요·사용자 목록

- 고객: CardSocial 로컬 좋아요 목록 있음
- 관리자: 좋아요 목록·수치 DTO 없음
- 보완/연결: journal/card 반응 ID·집계·목록/비공개 범위 계약과 관리자 표시 보완 필요
- 분류: 관리자 보완
- 소스: [web/src/CardSocial.tsx:21](../../web/src/CardSocial.tsx), [web/src/admin/opsTypes.ts:52](../../web/src/admin/opsTypes.ts)

### C35 · 커뮤니티 / 장소 댓글·답글·수정/삭제·초안

- 고객: 기기 thread·최신 댓글/시간순 답글 있음
- 관리자: 카드별 댓글 조치 있음
- 보완/연결: 소비자 blockId와 공용 cardId 매핑·작성자 ID·실제 thread 연결 대기
- 분류: 연결 대기
- 소스: [web/src/CardSocial.tsx:37](../../web/src/CardSocial.tsx), [web/src/admin/OperationsPages.tsx:101](../../web/src/admin/OperationsPages.tsx)

### C36 · 커뮤니티 / 타인 장소 카드 댓글 신고

- 고객: 조건부 깃발·이유 선택·기기 신고 표시
- 관리자: 별도 합성 신고 3건 있음
- 보완/연결: 실제 접수 없음. 신고 ID·신고자·시각·상태·전송·관리자 처리 결과 계약 필요
- 분류: 양쪽 보완
- 소스: [web/src/CardSocial.tsx:45](../../web/src/CardSocial.tsx), [web/src/admin/opsSeed.ts:17](../../web/src/admin/opsSeed.ts)

### C37 · 커뮤니티 / 여행기/프로필/장소/전체 댓글 신고

- 고객: 현재 고객 접수 UI 없음
- 관리자: JOURNAL/COMMENT/PROFILE/PLACE 대상/합성 신고 있음
- 보완/연결: 관리자에 먼저 준비됨. 고객 신고 범위·대상 UI·접수/결과를 맞춰야 함
- 분류: 양쪽 보완
- 소스: [web/src/App.tsx:1602](../../web/src/App.tsx), [web/src/admin/opsTypes.ts:20](../../web/src/admin/opsTypes.ts)

### C38 · 여행기 작성 / 내 일정에서 별도 여행기 시작

- 고객: 개인 PLAN→독립 JOURNAL 편집기 있음
- 관리자: 공개 콘텐츠 조치만 있음
- 보완/연결: 운영자 자동 소개 여행기 제작과 다른 기능. 개인 동선/메모를 대신 공개하지 않음
- 분류: 연결 대기
- 소스: [web/src/PersonalTrip.tsx:26](../../web/src/PersonalTrip.tsx), [web/src/admin/opsTypes.ts:10](../../web/src/admin/opsTypes.ts)

### C39 · 여행기 작성 / 표지·제목·소개·본문·DAY 편집

- 고객: 고객 JourneyEditor 있음
- 관리자: 운영자 새 여행기 저작 화면 없음
- 보완/연결: 공개본 사진/블록 문맥 조회와 운영용 초안 제작 구조 보완 필요
- 분류: 관리자 보완
- 소스: [web/src/App.tsx:1648](../../web/src/App.tsx), [web/src/admin/opsTypes.ts:10](../../web/src/admin/opsTypes.ts)

### C40 · 여행기 작성 / 글·사진·장소 삽입·순서·DAY 이동/복사

- 고객: 고객 실제 편집기 있음
- 관리자: CuratedTrip은 제목/소개/placeIds뿐
- 보완/연결: 기존 홈 추천 및 운영 여행기 생성에 필요한 DAY/기간/블록/미디어 변환 필요
- 분류: 관리자 보완
- 소스: [web/src/App.tsx:1648](../../web/src/App.tsx), [web/src/admin/OperationsPages.tsx:73](../../web/src/admin/OperationsPages.tsx)

### C41 · 여행기 작성 / 여행기 사진 갤러리·캡션

- 고객: 고객 IMAGE 블록·여러 사진 있음
- 관리자: 장소 미디어 관리만 있음
- 보완/연결: 작성자 여행기 원본 사진·출처·참조를 별도 수용해야 함. 장소 사진으로 대체하면 안 됨
- 분류: 관리자 보완
- 소스: [web/src/JournalPhotos.tsx:1](../../web/src/JournalPhotos.tsx), [web/src/admin/opsDomain.ts:30](../../web/src/admin/opsDomain.ts)

### C42 · 여행기 작성 / 초안 자동 저장·복구·되돌리기/다시 실행

- 고객: 고객 journalDraft 로컬 동작
- 관리자: 장소/일부 운영 폼 초안만 있음
- 보완/연결: 고객 서버 초안 연결 대기. 운영 여행기 제작 초안/버전은 별도 구현 필요
- 분류: 관리자 보완
- 소스: [web/src/journalDraft.ts:1](../../web/src/journalDraft.ts), [web/src/admin/OperationsPages.tsx:73](../../web/src/admin/OperationsPages.tsx)

### C43 · 여행기 작성 / 미리보기·나만 보기/여행 중/전체 공개

- 고객: 고객 로컬 상태 변경 있음
- 관리자: 별도 합성 공개 콘텐츠 조치 있음
- 보완/연결: 실제 게시 API·작성자 공개 범위·다른 고객 노출·서버 조치 반영 연결 필요
- 분류: 연결 대기
- 소스: [web/src/App.tsx:1648](../../web/src/App.tsx), [web/src/admin/opsDomain.ts:107](../../web/src/admin/opsDomain.ts)

### C44 · 번역 / 전체 화면 한국어/English·실패/재시도

- 고객: 화면 공통 언어·일치 문장 샘플 번역 있음
- 관리자: 장소/여행기 번역 검수·용어 있음
- 보완/연결: 승인 번역의 sourceId·원문 버전·사진 설명/댓글까지 고객 읽기 화면 연결 필요
- 분류: 관리자 보완
- 소스: [web/src/TranslationText.tsx:53](../../web/src/TranslationText.tsx), [web/src/admin/OperationsPages.tsx:118](../../web/src/admin/OperationsPages.tsx)

### C45 · 회원 / 활동 이름·프로필 이미지 업로드

- 고객: 고객 로컬 프로필·이미지 있음
- 관리자: 공개 회원·경고/정지 검수본 있음
- 보완/연결: 실제 회원 ID·프로필 이미지 참조와 소비자 local-self 정체성 연결 필요
- 분류: 연결 대기
- 소스: [web/src/App.tsx:1835](../../web/src/App.tsx), [web/src/admin/opsTypes.ts:25](../../web/src/admin/opsTypes.ts)

### C46 · 회원 / 작성자·관련 여행기·등급·담김/응원/점수

- 고객: 고정 담김 기준 계산·표시 있음
- 관리자: 등급 기준 텍스트/여행기 수/팔로워 수만 있음
- 보완/연결: 등급·담김·조회/응원 집계 DTO/UI 부족. 설정만 저장하면 고객 기준이 바뀌지 않음
- 분류: 관리자 보완
- 소스: [web/src/App.tsx:1844](../../web/src/App.tsx), [web/src/admin/OperationsPages.tsx:136](../../web/src/admin/OperationsPages.tsx)

### C47 · 알림 / 조회수 목표 알림·기준·앱 테스트 푸시

- 고객: 고객 설정·네이티브 시험 알림 있음
- 관리자: 템플릿·실패/중복/수신 거부 검수 있음
- 보완/연결: 조회수 목표 이벤트·실제 발송·수신 결과/중복 억제 연결 전. 받은 알림함과 다른 기능
- 분류: 연결 대기
- 소스: [web/src/App.tsx:1875](../../web/src/App.tsx), [web/src/admin/opsTypes.ts:40](../../web/src/admin/opsTypes.ts)

### C48 · 설정 / 언어·활동 이름·이용 안내

- 고객: 고객 설정/안내 있음
- 관리자: 용어·안내 텍스트 기준 있음
- 보완/연결: 서버 승인 설정·안내/버전의 소비자 적용 연결 전. 기존 전체 언어 선택 유지
- 분류: 연결 대기
- 소스: [web/src/ProfilePreferencesSheet.tsx:8](../../web/src/ProfilePreferencesSheet.tsx), [web/src/admin/OperationsPages.tsx:158](../../web/src/admin/OperationsPages.tsx)

### C49 · 회원 / 이메일 계정·가입/로그인/재설정/로그아웃/탈퇴

- 고객: 조건부 AccountAdapter·계정 UI 있음
- 관리자: 회원/삭제 요청 검수본 있음
- 보완/연결: 로그인 사용자와 로컬 여행/댓글 작성자 미연결. 고객 탈퇴 응답과 관리자 요청 상태 통일 필요
- 분류: 양쪽 보완
- 소스: [web/src/accountService.ts:19](../../web/src/accountService.ts), [web/src/admin/OperationsPages.tsx:139](../../web/src/admin/OperationsPages.tsx)

### C50 · 휴지통 / 6개월·비공개 복원·영구 삭제

- 고객: 고객 로컬 휴지통 있음
- 관리자: 휴지통/파일 정리 검수본 있음
- 보완/연결: 공용 파일 참조·서버 만료/복원 상태 연결 전. KST 달력 6개월/독립 복원 유지
- 분류: 연결 대기
- 소스: [web/src/TripTrashSheet.tsx:1](../../web/src/TripTrashSheet.tsx), [web/src/admin/opsTypes.ts:46](../../web/src/admin/opsTypes.ts)

### C51 · 기반 / 공유·뒤로/앞으로·저장 실패 보존

- 고객: 고객 기반 동작 있음
- 관리자: 전용 메뉴가 필요한 기능은 아님
- 보완/연결: 공개 링크·인증/권한·API 오류 관측 연결 필요. 단순 버튼별 관리자 메뉴 추가는 불필요
- 분류: 연결 대기
- 소스: [web/src/nativeBridge.ts:75](../../web/src/nativeBridge.ts), [web/src/admin/repository.ts:64](../../web/src/admin/repository.ts)

### A01 · 공용 자료 / 기존 장소·미디어를 빠짐없이 마스터 초안으로 수용

- 고객: 공용 placeCatalog 83곳, 사진 출처 22건
- 관리자: 원본 19곳+가상 6곳. 원본 19곳의 미디어 0
- 보완/연결: 초기 원본 마스터 64곳 누락. 공개/권리 일괄 승인 없이 출처·미디어를 보존해 검수 초안으로 수용
- 분류: 관리자 보완
- 소스: [web/src/admin/seed.ts:21](../../web/src/admin/seed.ts)

### A02 · 공용 자료 / 지역→지역별 랜드마크/업체 관리

- 고객: 고객 문자열 지역 분류 있음
- 관리자: REGION은 name/value/enabled, 장소 area 자유 입력
- 보완/연결: 지역 ID·상하위 관계·등록 수·종류별/검수상태별 목록과 동일 지역 선택 연결 필요
- 분류: 관리자 보완
- 소스: [web/src/admin/opsTypes.ts:34](../../web/src/admin/opsTypes.ts)

### A03 · 업무 흐름 / 스태프별 등록·검수·누적 현황

- 고객: 고객 대응 버튼 불필요
- 관리자: 운영자/변경 이력 있으나 장소 담당·작업함 없음
- 보완/연결: 등록자/담당자·검수 상태·내 작업 필터 필요. 담당자가 직접 검수/공개하는 원래 기준 유지
- 분류: 관리자 보완
- 소스: [web/src/admin/types.ts:1](../../web/src/admin/types.ts)

### A04 · 콘텐츠 제작 / 지역·기간으로 운영 추천 여행/여행기 초안 생성

- 고객: 고객 AI 개인 여행·별도 여행기 편집은 있음
- 관리자: 수동 장소 순서 편집만 있음
- 보완/연결: DAY/식사/숙소/사진/소개 초안→수정·검수→명시적 공개 필요. 여행자가 실제 다녀온 기록과 운영 소개 구분
- 분류: 관리자 보완
- 소스: [web/src/admin/OperationsPages.tsx:73](../../web/src/admin/OperationsPages.tsx)

### A05 · 운영 현황 / 첫 화면 연결 요약/전체 상세

- 고객: 각 외부 연결 기능의 상태 구분 필요
- 관리자: 연결 카드 15개. DB/RAG/소형/임베딩/대형/Flowise 6개 UNCONNECTED 고정
- 보완/연결: 6개는 API 응답과 별개로 항상 미연결 추가. 실제 상태로 교체하고 상세는 설정, 첫 화면은 처리 업무 우선 배치 제안
- 분류: 관리자 보완
- 소스: [web/src/admin/AdminApp.tsx:97](../../web/src/admin/AdminApp.tsx)

### A06 · 데이터 수급 / CSV 가져오기·행별 중복·초안

- 고객: 고객 대응 버튼 불필요
- 관리자: 200행 미리보기·초안 생성 있음
- 보완/연결: 기본 로컬 동작 있음. 수급 배치 ID/출처·처리상태·실패행/재시도·외부 수집 worker는 연결 전
- 분류: 운영 전용
- 소스: [web/src/admin/csv.ts:16](../../web/src/admin/csv.ts)

### A07 · 운영 기반 / 좌표·사용권·공개본/수정 초안·감사 이력

- 고객: 고객은 승인 자료만 읽음
- 관리자: 로컬 도메인·상태 검증 있음
- 보완/연결: 고객 메뉴와 1:1 버튼 대응 불필요. 실제 DB/API/파일/고객 노출 연결 필요
- 분류: 운영 전용
- 소스: [web/src/admin/domain.ts:1](../../web/src/admin/domain.ts)

### A08 · 운영 기반 / RAG 색인·정책·합성 품질 시험

- 고객: 고객은 간단 생성/저장 추천/수정/안내 사용
- 관리자: 검수용 작업/정책·결정형 시험 있음
- 보완/연결: 관리자 전용 운영 기능. 실제 모델 성능/검색/색인 worker 연결과 평가 필요; 자동 여행기 제작 기능은 아님
- 분류: 운영 전용
- 소스: [web/src/admin/AIPage.tsx:16](../../web/src/admin/AIPage.tsx)

### A09 · 운영 기반 / 운영자 권한·세션·알림/파일 작업·이력

- 고객: 일반 고객 대응 버튼 불필요
- 관리자: 로컬 역할·기록·작업 검수 있음
- 보완/연결: 필요한 운영 기반. 서버 권한/작업/실행 기록 연결 대기, 고객 기능 누락으로 판단하지 않음
- 분류: 운영 전용
- 소스: [web/src/admin/OperationsPages.tsx:153](../../web/src/admin/OperationsPages.tsx)

### A10 · 후속 채널 / 문의 접수·답변 조회

- 고객: 현재 고객 문의 UI 없음
- 관리자: 합성 문의·담당자·내부 답변 기록 있음
- 보완/연결: 고객 접수/답변 확인과 전달 채널이 구현되지 않음. 후속 기능으로 구분해야 함
- 분류: 후속 기능
- 소스: [web/src/admin/OperationsPages.tsx:147](../../web/src/admin/OperationsPages.tsx)

### A11 · 후속 채널 / 팔로우·받은 알림함

- 고객: 팔로우 버튼은 이벤트 없음, 받은 알림함 UI 없음
- 관리자: 후속 준비 연결 항목·팔로워 수 자리 있음
- 보완/연결: 활성 고객 기능으로 계산하면 안 됨. 현재 조회수 목표 푸시와도 구분
- 분류: 후속 기능
- 소스: [web/src/App.tsx:1459](../../web/src/App.tsx)

### A12 · 후속 채널 / 고객 챗봇 추천/여행 생성

- 고객: 현재 고객 챗봇 UI 없음
- 관리자: CHATBOT 합성 시험·정책 준비
- 보완/연결: 후속 채널. 실제 대화 세션·추천 카드·공통 생성/수정·고객 승인 저장 연결 전
- 분류: 후속 기능
- 소스: [web/src/admin/AIPage.tsx:10](../../web/src/admin/AIPage.tsx)

### A13 · 미구현 요구 / 평점·가격·실시간 인기 업체/객실 재고

- 고객: 현재 공용 Place에 평점/가격/재고 필드 없음
- 관리자: 관리자에도 실제 수급/운영 기능 없음
- 보완/연결: 양쪽의 현재 기능 누락으로 오인 금지. 평점/인기 추가는 별도 정책·데이터 계약, 결제/객실 재고는 이번 범위 밖
- 분류: 후속 기능
- 소스: [web/src/data.ts:43](../../web/src/data.ts)

### A14 · 관리자 이동 / 프로필 신고→대상 회원 이동

- 고객: 고객 신고 접수는 아직 없음
- 관리자: 회원 메뉴만 이동, 대상 ID 선택 무시
- 보완/연결: navigate가 장소에만 entityId 적용. 회원 대상 맥락 이동 결함 보완 필요
- 분류: 관리자 보완
- 소스: [web/src/admin/AdminApp.tsx:53](../../web/src/admin/AdminApp.tsx)


## 검수 한계와 변경 범위

브라우저 6점검은 홈/여행기 목록/대표 제주 여행기/프로필의 접수 진입점, 타인 댓글 신고, 팔로우, 연결 카드와 관리자 독립 저장을 대표 검증했다. 소스 대조를 보완하는 증거이며 모든 화면/서비스/실기기 검증 결과는 아니다. 실제 LLM/RAG 정확도·서버 정지·알림 발송·수급·실운영 자료는 미검증.

이번 작업은 대조표·근거·검수 스크립트/결과와 현재 인수인계 기록만 추가했다. 고객/관리자 제품 코드, DTO/OpenAPI, 데이터 저장 형식, 사용자 기록, 공개 사이트, Git 업로드·주차별 공개 범위·실제 소스 구현 대화에는 변경/전달하지 않았다.
