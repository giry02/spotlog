# 장소·모임·여행 AI 연결

`VITE_PLANNING_AI_ENDPOINT=/api/planning-ai`로 웹과 동일한 출처의 API 경로를 지정한다. 연결 주소가 비어 있으면 장소 검색과 초안 만들기는 앱에 등록된 데이터와 입력 조건으로 계속 작동한다. 웹 번들은 주소만 사용한다. 모델 설정과 인증 정보는 API 서버에 둔다. 현재 이 계약을 처리할 모델 서버는 연결되지 않았다.

사용자가 AI 실행 버튼을 누를 때 아래 내용을 JSON으로 POST한다. 공통 필드는 `schemaVersion: 1`, `requestId`, `feature`다. 각 요청에는 화면에서 입력한 문장(`prompt`, 최대 600자)과 지역(`region`)이 들어간다.

| `feature` | 추가 요청 필드 | 성공 응답의 `result` |
| --- | --- | --- |
| `PLACE_SEARCH` | 지역 범위에서 검색한 공개 장소 `eligiblePlaceIds` | 관련도순 `{ placeIds: string[] }`, 최대 12곳 |
| `GROUP_DRAFT` | 확인한 관심사 `topics` | `{ name, introduction, welcome?, joinGuide?, firstActivityIdea? }` 문안 |
| `TRIP_DRAFT` | `dayCount`(1~7일), 공개 장소 `eligiblePlaceIds`, `conditions` | `{ title, days: [{ day, placeIds }] }`, 모든 DAY를 순서대로 반환 |

여행 조건에는 목적, 관심사, 인원, 이동수단, 희망 예산, 걷기 제한, 추가 조건이 포함된다. 장소 후보는 요청당 60곳 이하다. 여행 결과는 하루 최대 10곳, 전체 최대 35곳이며 같은 장소 ID를 한 번만 사용한다. 서버는 후보 ID를 서버의 현재 공개 카탈로그에서 확인하고, 부가 장소 정보가 필요하면 해당 카탈로그로 조회한다.

응답은 아래처럼 요청의 `schemaVersion`, `requestId`, `feature`를 되돌려준다. 조건에 맞는 결과가 없는 경우 `status`에 `INSUFFICIENT_DATA`를 사용한다.

```json
{
  "schemaVersion": 1,
  "requestId": "요청의 ID",
  "feature": "PLACE_SEARCH",
  "source": "LLM",
  "status": "READY",
  "result": { "placeIds": ["요청에 포함된 공개 장소 ID"] }
}
```

클라이언트는 12초가 지나거나 사용자가 화면을 닫으면 대기를 중단한다. 응답의 요청 ID, 기능, 후보와 현재 공개 자료를 확인한 뒤 보여준다. 장소 이름이나 주소는 앱의 등록 자료에서 보여주고, 여행 순서는 사용자가 검토·수정한 뒤 저장한다. 모임 가입 방식과 공개 범위, 일정 저장과 참여 상태는 기존 화면에서 사용자가 정한다.
