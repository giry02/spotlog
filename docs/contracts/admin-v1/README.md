# Spotlog 관리자 계약 · v1 검수본

2026-10-05 · 조작 가능한 로컬 관리자와 실제 API 연결 경계

관리자는 장소 원본을 한 번 등록하여 발견·주변 업체·AI 검색 자료의 공통 기준으로 사용한다. 7개 메뉴와 A/B/C 단계의 운영 흐름을 독립 관리자 화면에서 검수하고, 챗봇은 기존 검색·생성·부분 수정·승인 저장을 재사용할 후속 채널로 준비한다. **실제 서비스 서버·PostgreSQL·회원 인증·AI/RAG·지도·파일·번역·알림 연결은 이 프론트 구현에 포함되지 않는다.**

| 산출물 | 내용 |
|---|---|
| [화면·기능·서버 책임과 검수 시나리오](HANDOFF.md) | 전체 메뉴·단계·식별자·필수 검수·미연결 항목 |
| [OpenAPI 3.1](openapi.json) | 실제 API adapter가 호출하는 4개 경로와 요청/응답 |
| [JSON Schema](schemas.json) | 실제 TypeScript DTO＋정수 revision/페이지·요청 키·비공개 원문 차단 조건 |
| [합성 명령·응답](fixtures.json) | 전체 명령 종류, 성공·빈 결과·오류·충돌·중복 재생 형식 |
| [규격 생성기](build_contract.mjs) | 실제 TypeScript DTO와 OpenAPI를 함께 생성 |
| [합성 자료 생성기](build_fixtures.mjs) | 운영자가 작성한 예시만 사용, 고객 자료 읽기 없음 |
| [오프라인 검사](validate.py) | 스키마·참조·4경로·fixtures·잘못된 DTO 거부 검사 |
| [실제 구현/검수 결과](../../execution/ADMIN_FRONTEND_IMPLEMENTATION_20261005.md) | 확인한 동작, 자동 검사와 UI 검수, 남은 연결 |
| [고객·관리자 연결 기준](CONSUMER_LINKS.md) | 지역·스태프·홈 원본·신고·반응·번역·등급과 서버 책임 |
| [이번 보완 결과](../../execution/ADMIN_WORKFLOW_FIXES_20261005.md) | 최초 감사 뒤 수정한 업무 흐름과 최신 검증 |

## 실제 프론트 연결

독립 진입은 `web/admin.html`이다. 관리자 전용 검수 저장소는 `spotlog.admin.review.v1`이며 고객 여행·찜 저장소와 분리한다. 장소 편집은 별도의 `spotlog.admin.place-editor.v2.LOCAL.<operatorId>`에 최초 편집 기준 revision과 미저장 입력을 보관한다. 형식 오류 자료는 덮어쓰지 않고 화면 입력만 유지한다. API 모드는 기기 저장소를 읽거나 쓰지 않는다. 로컬 역할 전환은 검수 도구다. API 모드의 운영자와 권한은 같은 출처의 서버 세션에서 조회한다. 브라우저에서 운영자 역할을 선택했다는 이유로 서버 권한을 부여하지 않는다.

`AdminAdapter`는 동일 인터페이스로 `LOCAL`과 `API`를 제공한다.

| 메서드 | 실제 HTTP binding | 책임 |
|---|---|---|
| `session()` | `GET /api/admin/v1/me` | 서버가 확인한 operatorId·name·role |
| `load()` | `GET /api/admin/v1/snapshot` | 권한에 맞는 공개/운영 가능 메타데이터 검수 view model |
| `query({resource,query,page,pageSize,filters})` | `GET /api/admin/v1/resources/{resource}` | 서버 검색·필터·페이지 처리와 total·revision |
| `execute(command,session)` | `POST /api/admin/v1/commands` | 명령별 검증·권한·동시성·중복 억제와 결과 |

API adapter는 `credentials: same-origin`을 사용하고, 명령 본문에는 클라이언트 `session`·운영자 이름·role을 추가하지 않는다. 서버는 쿠키 세션의 운영자와 권한을 사용한다. 실제 로그인·쿠키 이름·만료·CSRF 처리·인증 인프라는 서버 구현 항목이다. `/snapshot`과 `/commands` 응답의 `AdminState`는 검수 view model 계약이며 운영 DB 전체를 무제한으로 브라우저에 전달하는 정책이 아니다.

검수 화면은 로컬 snapshot으로 목록·상세 동작을 검수한다. 장소 목록은 API 모드에서 `query()`로 검색·필터·페이지를 서버에 전달하며 로딩·빈 결과·실패/재시도를 구분한다. 나머지 운영 목록은 검수 view model을 사용하며 실제 운영 규모 연결 때 resource별 query·페이지 상태·필터 허용 목록·검색 인덱스·응답 범위를 확정해야 한다. `AdminPageResult<T>`의 `items` 형식은 선택한 resource의 DTO다. 기계 규격의 기본 `T=unknown`을 모든 운영 자료를 허용하는 의미로 해석하지 않는다.

지원 resource는 `places`, `regions`, `audit`, `ops.exposures`, `ops.curatedTrips`, `ops.journals`, `ops.comments`, `ops.reports`, `ops.members`, `ops.inquiries`, `ops.operators`, `ops.references`, `ops.templates`, `ops.notifications`, `ops.connections`, `ops.supplyJobs`, `ops.trash`, `ops.mediaCleanup`, `ai.indices`, `ai.jobs`, `ai.policies`, `ai.fixtures`, `ai.results`, `ai.requests`, `ai.feedback`다. 실제 서버는 resource별 권한을 검사한다.

쿼리는 `query`, `page`(기본 1), `pageSize`(기본 20, 최대 100)를 사용한다. 필터 객체 `{kind:"FOOD",state:"PUBLISHED"}`는 `filter.kind=FOOD&filter.state=PUBLISHED`로 전달한다. OpenAPI의 `filter.*` 항목은 접두어 규칙을 설명하며 문자 그대로 별표가 들어간 파라미터를 보내지 않는다. 로컬 검수 검색은 레코드 안의 문자열을 비교하며 실제 서버 검색에는 허용 필드와 개인정보 경계를 별도로 적용한다.

2026-10-05 보완: 지역 계층·담당 스태프·검수 상태 필터, 전체 원본 수용, 운영 DAY/여행기 초안, 고객 신고/공개 반응/번역/등급 연결 추가. 개발 검수는 공개 자료만 공통 검수 투영으로 교환하고 개인 자료는 분리. 실제 DB·고객 API·AI 연결 책임은 [고객·관리자 연결 기준](CONSUMER_LINKS.md) 참고.

## 명령과 동시성

2026-10-09 인기 자료·메인 게시: `ops.popularity`는 선택적 읽기 전용 집계 `{basis:"SAVES",source:"SERVER"|"SAMPLE",observedAt,items:[{targetType:"PLACE"|"JOURNAL",targetId,saveCount}]}`다. `saveCount`는 0 이상 안전한 정수이며 클라이언트 명령으로 수정하지 않는다. API 모드는 `source:"SERVER"`만 사용하고 집계가 없으면 연결 대기·빈 결과를 표시한다. 로컬은 별도 검수 샘플 저장 수와 고객 공개 샘플의 담김 수를 명확히 표시하며 기기의 개인 찜·일정 자료로 실제 인기를 추정하지 않는다.

인기 장소는 `HOME_PLACE`, 인기 공개 여행기는 `HOME_JOURNAL` 노출로 기존 `ops.exposure.save` 명령을 사용한다. 대상 공개 상태·영업·좌표·표시 및 보관 권리와 철회 여부를 다시 검사하며 기간·순서·제목·소개·대표 사진을 재사용한다. `HOME_PLACE`에는 사용할 수 있는 실제 사진 미디어가 필수다. 고객 공용 자료에서 제외하는 가상 검수 장소·여행기(`SYNTHETIC`)는 홈 게시를 막는다. 기존 기간이 있는 항목은 바로 덮어쓰지 않고 노출 편집으로 이동한다. 이미 활성 게시된 대상은 중복 게시하지 않는다. 실제 사용자 집계 생성, 집계 시각·중복 저장 제외, 서버 명령 권한·동시성 검사와 운영 규모의 페이지 목록은 서버 연결 책임이다.

`AdminCommand`는 장소·AI·서비스 운영의 `kind` 구분 union에 아래 두 값을 더한다. 별도 가상의 CRUD 경로를 문서화하지 않고 현재 실행하는 명령을 전달한다.

```json
{
  "kind": "ops.content.moderate",
  "targetType": "COMMENT",
  "targetId": "review-comment-2",
  "action": "HIDE",
  "reason": "운영자 합성 검수 사유",
  "entityRevision": 1,
  "expectedRevision": 1,
  "idempotencyKey": "fixture-moderation-request"
}
```

- `expectedRevision`은 전체 관리자 상태의 revision이다. 변경 중 다른 창/운영자가 저장했으면 409를 반환하고 초안을 보존한다.
- `entityRevision`은 해당 Ops 대상의 revision이다. 공개 콘텐츠·신고·회원·문의·템플릿 등 기존 대상 변경 시 별도로 검사한다. 새로 만드는 일부 대상은 생략 가능하다.
- `sourceRevision`은 번역 원문 버전이다. 현재 원문과 다른 번역을 검수 완료로 적용하지 않는다.
- `idempotencyKey`는 새 조작마다 새 키다. 같은 키·같은 명령은 재생하고 중복 조치를 추가하지 않는다. 같은 키·다른 명령은 409다. 서버는 운영자/범위까지 포함해 중복 억제 기록을 관리한다.
- 성공 응답은 `{state,message,replayed?}`다. API 접수나 로컬 검수 성공을 실제 파일 처리·알림 수신·모델 실행 완료로 표시하지 않는다.
- 오류 응답은 `{error:{code,message}}`다. 인증 401, 권한 403, 충돌 409, 입력/상태 오류 422와 실제 한도/서버/연결/timeout을 구분한다.

장소 공개는 초안을 현재 공개본으로 복사하고, 다음 수정은 초안만 바꾼다. 공개·비활성화·철회가 후보/검색 자료에 미치는 영향은 최신 원본 상태로 다시 검사한다. 공개본 수정과 기존 여행기의 작성 기록은 별도 자료다. 장소 삭제는 공개 이력과 다른 참조가 없는 초안에만 허용한다.

사진의 ‘공개 전 초안에서 제외’는 편집 초안 설정이다. 사유를 입력해 `place.media.revoke`를 실행하면 해당 공개 미디어를 즉시 차단한다. 기기에 보관한 장소 입력의 기준 revision이 최신 장소와 다르면 저장·공개를 막고 입력을 유지한다. 운영자는 명시적인 ‘기존 입력을 버리고 최신 초안 사용’으로 전환할 수 있다.

운영자 `OPERATOR`는 자료 공개·노출·신고·회원 조치·문의·번역·AI 시험을 처리한다. 최고관리자 `ADMIN`은 운영자 권한/세션·연결 한도·정리, AI 정책 저장/시험/적용/복구/중지와 색인 적용/복구도 처리한다. 실제 서버는 모든 명령에서 이 기준을 검사해야 한다.

## 자료와 AI 운영의 경계

관리자 기본 view model에 고객 개인 여행·메모·예약 원문·고객 AI 요청문·대화 원문·연결 비밀번호/API 키를 반환하지 않는다. 공개 범위를 변경한 여행기 원문도 기본 응답에서 제외한다. 신고 문맥과 운영자가 작성한 문의 처리 기록은 권한에 맞게 제공한다. 감사 이력의 사유에도 불필요한 고객 원문을 복사하지 않는다.

`AiRequestSummary`는 ID·채널·단계·모델/정책/색인·오류·공용 근거·시간/비용 요약이다. `AiTestFixture`의 prompt와 `AiTestResult`의 합성 메시지는 운영자가 만든 `OPERATOR_SYNTHETIC` 시험 자료이며 고객 대화 수집 기능이 아니다.

색인/작업/시험 DTO의 `localSimulation`은 boolean이며 시험의 `externalCalls`는 0 또는 1이다. 로컬 검수 실행은 `localSimulation: true`, `externalCalls: 0`을 사용한다. API 결과는 실제 실행 여부와 외부 호출 수를 서버가 반환한다. 운영자 시험은 모든 모드에서 `saved: false`로 고객 여행 저장과 분리한다. 실제 worker·모델의 응답 검증·품질 실측은 서버 연결 때 확인해야 한다. 로컬 정책 테스트는 입력 조건 검수이며 모델 성능 증명이 아니다. 챗봇 고객 채널 활성화는 연결 전 차단하고 합성 시험만 제공한다.

원본 DB는 PostgreSQL로 통일한다. 장소 사실과 운영·사용 가능 상태는 원본을 먼저 조회하고 RAG는 승인된 설명 검색을 담당한다. 외부 대형은 근거가 충분한 소형 모델 실패 부분만 요청 전체 최대 1회로 보완한다. 시간/비용 한도가 없으면 활성화하지 않는다. 삭제·폐업·권리 철회 자료는 색인 제거 실패나 복구로 다시 허용하지 않는다.

## 재생성과 검사

저장소 루트에서 실행한다. 규격 생성은 설치된 프로젝트 TypeScript를 사용한다. Python 검사는 `jsonschema`가 필요하며 제품 의존성에는 추가하지 않는다.

```sh
node docs/contracts/admin-v1/build_contract.mjs
node docs/contracts/admin-v1/build_fixtures.mjs
python docs/contracts/admin-v1/validate.py
node --test web/tests/adminContract.test.mjs
```

검사는 TypeScript와 생성 규격의 일치, 4개 실제 adapter 경로, JSON Schema 로컬 참조, 전체 명령/응답 형식, 원문·역할·비밀 필드 주입 등의 거부를 확인한다. 기존 [AI-v1 묶음](../ai-v1/README.md)의 100개 예상 정답·합성 요청/응답도 형식 검사한다. 이 명령은 운영 서버나 모델을 호출하지 않는다.

실제 구현 대화창으로 전달하기 전 사용자의 관리자 화면 검수 결과를 반영한다. 서버 연결·AI 품질 실측·실제 알림/파일 처리·고객 챗봇은 해당 단계의 구현과 검수가 남아 있다.
