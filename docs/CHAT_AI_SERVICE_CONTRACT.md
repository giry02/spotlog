# 대화 AI 서비스 연결 계약

2026-11-09: 실제 AI 서버와 제공자는 아직 선택되지 않았다. 현재 제품에는 HTTP 연결 구조와 실행 UI만 준비되어 있다. 설정이 없으면 AI 요약을 실행하지 않으며, 원문 모아보기는 계속 사용할 수 있다. 테스트의 주입 응답은 계약 검증용이며 실제 모델 실행의 증거가 아니다.

## 설정과 요청 시점

웹 서비스 주소는 `VITE_CHAT_AI_ENDPOINT=/api/ai`처럼 설정한다. 이 값에는 서버 URL만 둔다. 모델 API 키, 제공자 자격 증명, 시스템 프롬프트는 서버에 둔다. `VITE_` 변수는 공개 번들에 포함되므로 비밀값을 넣지 않는다. 설정 변경 후 개발 서버를 다시 시작하거나 웹을 다시 빌드한다.

상대 서비스 경로와 HTTPS URL을 허용한다. 개발용 `localhost`, `127.0.0.1`, `::1`에는 HTTP를 허용한다. URL 안의 사용자 이름·암호는 거부한다. 브라우저는 `credentials: same-origin`, `cache: no-store`로 JSON을 한 번 POST한다. 자동 재시도, 예시 응답 대체, 원문 로그, 브라우저 저장을 하지 않는다. 사용자가 **AI 요약 만들기**를 누를 때만 요청하며 탭을 열거나 범위를 바꾸는 행위는 전송하지 않는다.

## 공용 요청 및 응답

구현: `web/src/together/chatAiSummary.ts`의 `postScopedAiJson<T>`.

```ts
interface AiRequestScope {
  userId: string;
  groupId: string;
  roomId: string; // group:<groupId> 또는 activity:<activityId>
}

interface ScopedAiRequest {
  schemaVersion: 1;
  requestId: string;
  feature: 'CHAT_SUMMARY' | 'REVIEW_DRAFT';
  scope: AiRequestScope;
  payload: unknown;
}

interface ScopedAiResponse {
  schemaVersion: 1;
  requestId: string; // 요청 값과 동일
  scope: AiRequestScope; // 요청의 세 필드와 모두 동일
  output: unknown;
}
```

요청의 `userId`는 인증 증거가 아니다. 실제 서버는 인증된 세션으로 사용자를 판별하고 현재 모임원·차단 여부·대화방의 소속 모임을 확인해야 한다. 프런트의 자체 권한 검사만으로 서버 권한을 대신할 수 없다. 동일 출처 서비스는 기존 보안 세션을 사용하도록 연결하고, 다른 출처가 필요하면 해당 서버의 인증 및 CORS 정책을 별도로 설계한다. 모델 제공자 주소에 브라우저가 직접 비밀키를 넣어 호출하는 방식은 이 계약에 포함하지 않는다.

응답의 요청 ID 또는 계정·모임·대화방 중 하나라도 다르면 응답 전체를 거부한다. HTTP 401/403은 권한 오류, 429는 요청 제한, 나머지 실패는 생성 실패로 표시한다. 서버의 내부 오류 본문이나 제공자 오류는 제품에 그대로 노출하지 않는다. 최대 대기 시간은 45초이며 사용자가 취소하거나 화면을 나가면 요청을 취소한다. 취소를 무시하는 전송 구현이 늦게 응답해도 적용하지 않는다.

## CHAT_SUMMARY

`payload`에는 현재 필터로 선택한 사람이 작성한 원문만 복사한다.

```json
{
  "purpose": "PREPARATION",
  "filters": { "scope": "all" },
  "cutoff": "2026-11-09T03:00:00.000Z",
  "sources": [
    {
      "id": "message-one",
      "roomId": "activity:trip-one",
      "authorId": "member-one",
      "body": "물을 챙겨 주세요.",
      "createdAt": "2026-11-09T02:00:00.000Z"
    }
  ]
}
```

목적은 `KEY_POINTS`(핵심 내용), `PREPARATION`(준비물), `OPEN_QUESTIONS`(확인할 일), `PERSON`(특정인 발언)이다. `PERSON`은 `filters.authorId`가 있어야 한다. 범위는 기존 `unread`, `today`, `recent7`, `date`, `all`을 사용하며 날짜는 한국 시각 기준이다. 날짜 선택에는 `from`, `to`, 안 읽은 범위에는 `unreadAfter`를 포함한다. 생성 기준 시각 뒤의 발언은 현재 결과에 넣지 않고 새 발언 수를 표시해 사용자가 다시 실행하게 한다.

다른 방 발언, 삭제된 발언, 중복 ID, 본문 없는 스티커, 투표·준비·게임·챌린지 같은 엔티티 참조 카드는 제외한다. 모임 소개, 프로필, 예약·방문 정보, 개인 일정·메모·사진, 다른 기록을 추가하지 않는다. 원문 300개 또는 본문 합계 60,000자를 넘으면 범위를 좁히도록 안내하며 몰래 잘라 전송하지 않는다.

응답 `output`은 다음 형식이다.

```json
{
  "title": "여행 준비",
  "sections": [
    {
      "heading": "준비물",
      "items": [
        {
          "text": "물을 챙기자는 발언이 있어요.",
          "sourceIds": ["message-one"]
        }
      ]
    }
  ]
}
```

모든 항목은 선택한 원문 ID를 하나 이상 인용해야 한다. 알 수 없는 ID나 근거가 없는 항목이 있으면 응답 전체를 거부한다. 제목은 120자, 섹션 제목은 80자, 항목 본문은 2,000자 이내이며 최대 8개 섹션·40개 항목·전체 생성 텍스트 20,000자를 허용한다. 출력은 일반 텍스트로만 렌더링한다.

서버는 원문을 지시문이 아닌 분석 자료로 취급하고 원문 밖의 사실을 만들지 않아야 한다. 제안·질문·미정 상태를 확정된 결정·담당자·예약으로 바꾸지 않는다. 모델 출력은 일정·참석·투표·예약·읽음 위치를 바꾸는 명령으로 실행하지 않는다.

프런트는 결과 수신 전과 표시 시점에 현재 계정·모임·방·필터·목적을 재검사한다. 원문의 본문·작성자·시각·소속 방이 바뀌거나 삭제·차단·탈퇴가 확인되면 이전 AI 문장 전체를 숨긴다. 근거 버튼도 같은 검사를 통과한 원문으로만 이동한다. 결과는 화면 메모리에만 유지한다.

## REVIEW_DRAFT

같은 공용 봉투에 `feature: REVIEW_DRAFT`와 명시적으로 선택한 후기 작성 사실을 `payload`로 담을 수 있다. `ReviewPostComposer.onGenerateDraft(facts, signal)`에서 `postScopedAiJson`을 사용하고 `output: { title: string, body: string }`을 기능별로 검증한다. 요청 범위와 현재 쓰기 권한·원본 사실이 유지되는지 적용 전에 확인해야 한다.

후기 사실은 `selectReviewDraftFacts`가 고른 현재 모임·약속 정보와 본인의 기존 후기만 사용한다. 다른 사람의 대화·사진·참석 여부·개인 메모·예약을 덧붙이지 않는다. 생성된 후기는 검토용 초안으로 표시하고 사용자가 편집기에 적용한 뒤 명시적으로 등록한다. AI 응답이 곧 게시·공개 또는 실제 참석의 증거가 되지 않는다.

## 검증

`web/tests/chatAiSummary.test.mjs`는 주입한 fetch로 요청 최소화, 정확한 범위, 인용 검증, HTTP/JSON 오류, 취소 및 늦은 응답, 조건 변경·수정·삭제·권한 해제를 검증한다. 실제 외부 서버에 개인 대화를 전송하지 않는다. 제공자와 서버가 정해지면 인증·권한·보관 정책·실제 모델의 인용 품질을 서버 환경에서 별도로 검증해야 한다.

개발 서버의 `/tests/chat-ai-review.html`은 같은 화면에서 정상·잘못된 인용·권한 오류·연결 오류·늦은 응답을 검수하는 격리 페이지다. 가상의 원문과 주입된 고정 HTTP 응답만 쓰며 실제 저장소·네트워크·모델은 사용하지 않는다. 제품 진입점이 아니며 화면과 결과에 모의 응답임을 표시한다.
