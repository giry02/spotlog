# 연결 계약 · v1 제안

## 전체 순서

간단 입력 → **우리 서버** 권한/직접 선택 확인 → **외부 Jev** 문장 판별 → 서버 조건 검증 → **우리 DB + 맥미니 RAG** 허용 후보 검색 → **우리 서버** 일정 편성 → **맥미니 소형 LLM** 근거 있는 짧은 설명 → 서버 최종 검증 → 초안 → 고객 저장.

Jev가 처리하지 못한 문장 부분만 소형 LLM 해석에 추가 전달. 정상 조건을 다시 해석시키지 않음. 입력/근거가 충분한데 소형 모델이 실패한 부분에만 대형 LLM 보완. 자료 부족·지도 오류·장비 장애는 모델 확대 대상 아님. 향후 챗봇도 같은 서버 기능 호출.

## 공개 연결: 화면 → 우리 서버

경로는 제안. 로그인은 서버 세션에서 판단. 요청의 회원명·작성자·소유자 값을 신뢰하지 않음.

| 기능 | 제안 경로 | 규격 / 결과 |
|---|---|---|
| 생성 | `POST /v1/ai/trip-drafts` | GenerateRequest → DraftResponse |
| 부분 수정 | `POST /v1/trips/{tripId}/ai-drafts` | RevisionRequest → DraftResponse |
| 저장/변경 적용 | `POST /v1/ai/trip-drafts/{draftId}/apply` | ApplyRequest → ApplyResponse |

`schemas.json`의 `$defs`에 이름별 형식 정의. 모든 요청에 `requestId`와 `apiVersion`. 생성·수정·적용에 별도 `Idempotency-Key` 헤더 사용. 같은 회원·경로·키·본문은 같은 결과, 같은 키에 다른 본문은 409. 새 요청은 새 키. 취소는 화면의 AbortSignal과 응답 무시부터 적용; 실제 모델 실행이 즉시 중단됐다고 표시하지 않음. 이미 저장이 실행된 요청은 재조회/같은 키 재시도로 확인.

**GenerateRequest**: 원문, region/saved 모드, 언어, 네 가지 UI 값과 출처, 저장 장소 ID만 전달. 전체 Place 카탈로그·회원 프로필·JSON 직렬화 버전은 보내지 않음. 서버가 해당 회원의 저장 목록과 등록 자료를 다시 읽음. 날짜·입출발 시간·식사 설문을 새 필수 폼으로 추가하지 않음.

**RevisionRequest**: tripId, baseRevision, dayId, scope(day/afternoon/remaining), fromVisitId, 제외 방문 ID, 덜 걷기, 수정 문장. 서버가 원본 여행·권한·잠금을 조회. remaining은 지정 방문부터 이후 DAY 포함, afternoon은 검증 시간 또는 planningSlot의 오후/저녁/숙박 범위. 실제 예약은 시간대 범위 안이어도 유지. 고객의 예약 취소는 별도 명시적 편집 절차.

**DraftResponse** 공통: requestId, apiVersion, mock, status, normalization, draft, issues. 준비 상태는 `ready / partial / needs_input / insufficient_data / failed`. ready도 경로 확인 완료와 같지 않음. 경로 상태는 별도 필드. partial은 표시 가능한 일정이 있고 자료 부족 구간을 명시한 경우. needs_input 등은 draft:null. 입력 판별의 local_interpret/clarify 같은 내부 상태를 그대로 고객 메뉴에 노출하지 않음.

**ApplyRequest**: draftRevision과 원본 trip revision. 서버에 보관한 초안을 적용하며 클라이언트가 보낸 Journey를 그대로 저장하지 않음. draft 소유권·사용 가능 상태·현재 자료 버전·원본 revision·삭제 여부 재검사 후 한 트랜잭션으로 비공개 PLAN 저장. 재시도는 같은 tripId/revision. journal 발행 API와 분리.

## 초안 데이터

| 필드 | 역할 |
|---|---|
| draftId / draftRevision | 제안 자체의 ID·버전 |
| baseTripId / baseTripRevision | 새 생성은 null, 수정은 원본 ID·서버 revision |
| catalogVersion / indexVersion | 이번 계산에 사용한 DB·RAG 스냅샷 |
| days[].dayId / day | 안정적인 DAY ID / 표시용 1부터 순서 |
| visits[].visitId / placeId | 이번 방문 / 같은 지점을 가리키는 내부 장소 ID |
| companyId | DB에서 관리할 선택적 운영사·브랜드 ID. 지점 식별용 placeId 대체 불가 |
| slot | morning/lunch/afternoon/dinner/stay. 실제 시각 보장 아님 |
| anchorVisitId / afterVisitId / beforeVisitId | 기준 랜드마크 및 식사·숙박 전후 방문 |
| bookingFixed / stayDayIds | 기존 예약 보호 및 숙박일. 마지막 DAY에 새 숙박 추가 금지 |
| time / travelMinutes | 검증한 경우만 값. 미확인은 null |
| routeStatus | verified/unverified/unavailable. 교통수단별 확인 범위 별도 관리 |
| evidenceIds / sources | 설명에 사용한 승인 문서 ID·버전·확인일 |
| gaps | 요청했으나 자료가 없는 식사·숙박 구간. 같은 DAY의 전후 방문 연결 |

서버는 최소 한 개 랜드마크, 정확한 DAY 수, visit/day ID 중복 없음, 허용 placeId, 제외 준수, 예약 유지, 주변 업체 순서·거리·동선, 출처 최신성 검증. 새 조건 충족 불가 시 무작정 장소를 늘리지 않음. 여러 지역을 한 DAY에 섞지 않음. 저장 장소가 권장량보다 많으면 누락 목록·사유를 반환하고 수정 제안. 검색된 업체는 자동으로 초안에 배치하되 **저장은 고객 확인 후**.

정확한 좌표·순위·주소·운영 정보는 DB 조회. LLM은 숫자·장소를 만들지 않음. RAG가 placeId를 반환해도 DB에서 삭제/권한/자료 버전을 다시 확인. 외부 네이버 검색 자료는 허용 범위가 확인된 별도 흐름이며 자동 RAG 적재 제외.

## 내부 연결: 우리 서버 ↔ 맥미니

브라우저는 맥미니·Flowise·Ollama에 직접 연결하지 않음. 서버 간 인증·허용 네트워크·요청 크기/시간 제한 적용. Flowise 편집 화면 로그인만으로 개별 플로우 API가 보호된다고 가정하지 않음.

| 내부 경로 제안 | 입력 | 출력 |
|---|---|---|
| `/internal/ai/interpret` | InterpretRequest: 원문, 통과 조건, 미해결 원문, 허용 수정 필드 | InterpretResponse: 해당 필드 patch·근거 원문·미해결 부분. 서버 재검증 |
| `/internal/rag/search` | RagRequest: 서버가 허용한 placeId, 질의, 요구 색인 버전, topK | RagResponse: placeId·chunkId·문서 버전·원문·사용 가능 확인일 |
| `/internal/ai/explain` | ExplainRequest: 서버 검증 일정, 허용 evidence, 필요한 원문 | ExplainResponse: visitId별 짧은 설명·evidenceIds만. 일정/좌표 수정 불가 |

내부 요청의 허용 ID는 서버가 생성. 모델이 주장하는 approved 값으로 승인하지 않음. RAG의 임베딩 모델/차원/문서 버전 변경 시 새 색인 구성 후 전환. 다른 임베딩 공간을 섞지 않음. 삭제·권리 철회는 검색 차단부터 반영, 청크 삭제 재시도. 업데이트/삭제 수급 상세는 기존 맥미니 협업 문서 사용.

## 실패와 화면 동작

| 상황 | HTTP / issue code 제안 | 처리 |
|---|---|---|
| 문장에 지역 없음 | 200 needs_input / MISSING_REGION | 기존 지역 선택만 안내, 원문 유지 |
| 직접 선택·문장 충돌 | 200 needs_input / CONFLICT_* | 충돌 값만 확인. 새 긴 설문 없음 |
| 후보 없음 | 200 insufficient_data / NO_CANDIDATES | 근거 없는 일정 생성 금지, 지역/조건 수정 |
| 음식·숙박 일부 없음 | 200 partial / MISSING_BUSINESS | 완성된 방문 유지, 미정 구간 표시, 상세에서 추가 |
| 요청 형식 오류 | 400 | 해당 입력 안내 |
| 세션/권한 | 401/403 | 재로그인/접근 제한. 타인 자료 응답 금지 |
| 원본/초안/자료 버전 변경 | 409 / STALE_REVISION | 최신 상태로 다시 확인, 덮어쓰기 금지 |
| 호출량 초과 | 429 | 서버 안내 시간 후 재시도 |
| Jev/Mac 장애 | 503 / DEPENDENCY_UNAVAILABLE | 입력 유지, 제한된 재시도. 자동 대형 호출 금지 |
| 제한 시간 초과 | 504 / TIMEOUT | 입력 유지. 총 마감시간과 단계 시간 별도 설정 |
| 허용되지 않은 ID·설명 | 502 / INVALID_MODEL_OUTPUT | 잘못된 초안 표시/저장 차단 |

예상 못한 예외는 500. 사용자용 메시지와 내부 로그 원인 분리. 장애 응답에도 requestId 포함. 식사·알레르기 등 원문을 분석 로그에 통째로 기록하지 않음.

## 기존 프론트와 연결할 때 할 일

현 `AiPlannerAdapter`는 브라우저 샘플용 규격. 서버 API와 동일하지 않음.

1. UI의 네 가지 값에 `origin: default_ui / explicit_ui / text` 출처 기록 추가. 현재 코드에는 없음. 새 컨트롤 추가 불필요.
2. 서버 placeId를 기존 Place.id로, visits/day를 기존 places/blocks로 변환. 서버 검증된 표시용 장소 자료도 조회. 알려지지 않은 ID를 임의 객체로 만들지 않음.
3. 현재 `sourceVersion = JSON.stringify(...)`는 화면 동시성 확인용. 서버 revision과 별도 필드로 관리.
4. 현재 `validatePlannerResult`는 로컬 정규식으로 intent 재계산, 입력 조건 완전 동일 비교, time/move 값 금지 등을 수행. 서버 의미 해석 결과와 충돌하므로 **운영용 검증기로 교체 필요**. 응답 형식/허용 ID/버전/권한/범위 검증은 유지.
5. ready/partial은 미리보기, needs_input은 기존 입력으로, 장애는 입력 보존. 현재 오류 코드와의 매핑 추가. 실제 시간 verified 여부를 표시와 함께 연결.
6. 기존 입력 복구·늦게 도착한 응답 무시·중복 저장 방지 유지. `frontend-fixtures.mjs`는 현재 샘플과의 호환 확인용이며 실제 서버 어댑터 구현은 아님.

외부 형식 확인: [Jev HTTP·Choice 규격](https://docs.typesafe.ai/api). 본문 계약의 경로·서버 상태·저장 규칙은 Spotlog 자체 제안.
