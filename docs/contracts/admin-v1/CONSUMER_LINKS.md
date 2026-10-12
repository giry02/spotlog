# 관리자와 고객 화면 연결 기준

2026-10-05 · 구현된 프론트 계약과 남은 서버 책임

7개 관리자 메뉴 유지. 지역 → 담당 자료 등록/가져오기 → 검수 → 공개 장소 → 운영 추천 여행기 초안 → 미리보기 → 명시적 공개 흐름으로 연결. 실제 서버 개발 때 고객 화면과 관리자 화면이 같은 원본 ID·공개 상태·권리 기준을 사용해야 함.

## 검수 연결과 실제 연결

| 구분 | 현재 구현 | 서버 연결 기준 |
|---|---|---|
| 관리자 | `spotlog.admin.review.v1` 검수 저장소 / `/api/admin/v1` API adapter | 쿠키 세션의 운영자·권한 검사, 서버 검색·페이지, 동시성·중복 방지 |
| 고객 ↔ 관리자 검수 | 개발 서버에서만 `spotlog.review.service.v1`로 공개 투영·신고·명시적으로 남긴 반응 교환 | 운영 DB와 서비스 API 사용. 브라우저 저장소를 실제 회원·권한·집계 원본으로 사용하지 않음 |
| 고객 신고 | `VITE_REPORT_ENDPOINT` 설정 시 해당 같은 출처 서비스로 POST. API 없으면 개발 검수 접수 또는 미연결 | 공개 대상·신고자 인증, 접수·처리 상태, 대상 문맥 재조회 |
| 생산 빌드 / API 모드 | 개발 검수 투영 사용 안 함. 미연결이면 샘플 성공으로 대체 안 함 | 각 고객 서비스 adapter 연결 필요 |

`VITE_REPORT_ENDPOINT`를 지정한 고객 화면은 검수 저장소를 읽거나 쓰지 않음. API 모드 관리자도 로컬 저장소를 사용하지 않음. 고객 개인 일정·예약·찜·작성 중 입력을 읽어서 관리자로 옮기는 경로 없음.

## 공통 원본과 작업 흐름

- 장소 `placeId`, 지역 `regionId`, 미디어 `mediaId` 고정. 기존 고객 원본 83개를 미승인 초안으로 수용하고 미디어 77개·출처 식별 22개 보존. 합성 검수 자료 6개는 별도 표시.
- `AdminRegion`은 부모 지역·수준·사용 상태 관리. 장소 `draft/published.regionId`로 지역별 업무 연결. `filter.regionId`는 하위 지역 포함. `meta.createdById/assignedToId/reviewStatus/sourceBatchId`로 스태프·검수·가져오기 묶음 관리.
- 공개 수정은 초안만 변경. 공개 전 이름·종류·지역·주소·검증 좌표·설명·출처·사용권 확인. 사진·영상은 매체별 사용권 검수. 원본 수용은 승인과 다름.
- 주변 업체는 좌표로 직선 3km/15km 후보 계산. 추천/제외 키는 랜드마크 `placeId`＋업체 `placeId`. 해당 관계만 고객 후보에 반영.
- 폐업·비활성화·사용권 철회는 현재 서버 원본으로 먼저 차단. RAG 제거 지연·이전 색인 복구·기본 샘플 이미지 대체로 재등장하면 안 됨.
- 기존 홈 추천 7개는 `curatedTripId=source-home:<templateId>`, `sourceTemplateId=<기존 templateId>`, `sourceKind=PUBLIC_SAMPLE`, 비공개 수정 초안으로 가져옴. DAY·방문 순서 보존. 미검수 장소·사진은 공개 차단.
- 검수한 홈 수정본을 직접 공개하면 같은 `sourceTemplateId`의 고객 추천 대체. 비공개 초안은 기존 홈을 바꾸지 않음. 공개 여행기 12개 스냅샷과 홈 수정 초안 7개는 별도 대상.
- 새 운영 추천은 적격 공개 장소로 DAY·식사·숙박 순서와 소개·사진 초안 생성. 현재 `generation.method=LOCAL_RULES`; 모델 호출 없음. 실제 AI로 교체할 때 승인 자료만 조회하고 방문 후기처럼 작성하지 않음.

## 신고 접수

고객 adapter의 현재 본문 형식. 전달 위치는 `VITE_REPORT_ENDPOINT`로 설정하며 서버 경로 확정 전.

```json
{
  "requestId": "신규 요청 UUID",
  "targetType": "COMMENT",
  "targetId": "댓글 ID",
  "journalId": "여행기 ID",
  "cardId": "해당 장소 카드 ID",
  "reasonCode": "INFORMATION",
  "reasonDetail": "상세 사유"
}
```

- `targetType`: `JOURNAL | COMMENT | PROFILE | PLACE | PHOTO`.
- `journalId/cardId/placeId/mediaId`: 해당하는 문맥만 포함. 전체 댓글에는 `cardId` 없음. 사진에는 `mediaId`, 독립 장소 사진에는 `placeId` 전달.
- `reasonCode`: `SPAM | ABUSE | PRIVACY | COPYRIGHT | INFORMATION | OTHER`. 상세 사유 최대 1,000자.
- 요청에 회원 역할·운영자·여행기 본문·개인 일정·AI 입력·사진 데이터 없음. 신고자 ID는 서버 세션으로 결정. 공개 대상 존재·권한·문맥을 서버에서 재검사.
- 응답 `{report: OpsReport, duplicate: boolean}`. 실제 `reporterId/receivedAt`, 같은 대상·타입·여행기/카드 문맥 필수. 실제 응답에 `LOCAL_REVIEW/localReview` 검수 표시 없음.
- 서버에서 요청 ID 중복과 동일 신고자의 같은 대상 중복 접수를 구분. 현재 제출마다 새 UUID이므로 네트워크 재시도 때 같은 요청 ID 유지 기능은 서버 연결 시 추가 필요.
- 관리자는 정확한 사진/출처·여행기/카드/답글·회원 문맥을 조회해 사유와 조치 기록. `ops.report.resolve`와 고객 접수 상태를 같은 신고 ID로 연결.

## 공개 여행기·반응·번역·등급

| 항목 | 계약 |
|---|---|
| 공개 읽기 자료 | 여행기/카드/DAY/방문/장소/미디어 ID와 텍스트·사진·장소 블록·출처 보존. 비공개 일정·메모·예약·입력 조건 제외 |
| 숨김·삭제·복원 | 사용자 현재 공개 범위 우선. 새 신고·반응 수신으로 관리자 숨김 해제 금지. 휴지통 복원은 비공개이며 기본 관리자 원문 응답 비움 |
| 응원·좋아요 | 여행기 `LOVE/BEST/HELPFUL`, 카드 좋아요/공개 회원 목록을 읽기 집계로 제공. 관리자 숫자 입력 없음. `null/미제공`을 0으로 바꾸지 않음 |
| 댓글 | 전체 댓글과 장소 카드 분리. `journalId+cardId`, 답글 `parentId`. 최상위 최신순·답글 시간순, 수정으로 위치 안 바뀜 |
| 번역 | 현재 원문·버전·언어·용어 버전 일치 및 승인 상태 필수. 본문/장소 소개 연결. 제목·DAY·캡션·각 댓글은 각 원문 ID의 실제 번역 연결 필요 |
| 등급 | `GRADE` 참조에 `min/label/shortLabel/icon` 단계 배열, 활성 정책 하나. 고객·관리자 같은 규칙. 담김·조회는 서버 집계, 관리자 숫자 편집 없음 |
| 복사·새 여행기 | 원본 공개 작성자 메타를 개인 복사본/새 여행기에 승계하지 않음. 본인 공개 여행기는 현재 작성자 ID로 귀속 |

## 남은 서버 작업

인증·PostgreSQL 원본·공개 트랜잭션·공간 검색·집계·신고 API·고객 moderation 조회·실제 미디어 업로드/권리 철회·번역 호출·알림·정리 worker·맥미니/RAG/모델 연결. 문의·팔로우·받은 알림함·챗봇은 고객 후속 기능이며 관리자 메뉴가 있다는 이유로 고객 기능 완료로 처리하지 않음.

관리자 4개 HTTP adapter 경로는 프론트 계약이며 고객 API 전체나 서버 완성 증거가 아님. 기능별 결과·잔여는 [65개 양방향 대조표](../../execution/admin-feature-audit-20261005/index.html) 기준.
