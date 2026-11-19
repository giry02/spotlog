# 장소·모임·여행 AI 연결

웹은 같은 출처의 `/api/planning-ai`에 요청한다. Node 게이트웨이는 요청한 조건과 서버가 보유한 공개 장소를 확인한 뒤 `/v1/chat/completions`를 구현하는 모델 서버를 호출한다. 장소 검색은 후보 순위를, 모임 초안은 소개·가입 안내·첫 활동을, 여행 초안은 DAY별 방문 순서를 받는다. 모델 서버와 게이트웨이는 루프백 주소에 연다.

## 로컬에서 실행

Node 22.13 이상과 llama.cpp의 `llama-server`, GGUF 모델 파일을 준비한다. 아래는 Windows PowerShell 예시다. 이 PC에서는 llama.cpp b12484와 Qwen3-1.7B Q8_0을 사용한다. 서버 키 파일은 사용자 전용 런타임 폴더에 만든다. [llama.cpp 서버 문서](https://github.com/ggml-org/llama.cpp/tree/master/tools/server) · [Qwen 모델](https://huggingface.co/Qwen/Qwen3-1.7B-GGUF)

```powershell
# Spotlog 저장소 루트에서 한 번 실행한다.
$spotlogAi = Join-Path $env:LOCALAPPDATA 'SpotlogAI'
New-Item -ItemType Directory -Path $spotlogAi -Force | Out-Null
if (-not (Test-Path -LiteralPath (Join-Path $spotlogAi 'llama-api.key'))) {
  node -e "require('node:fs').writeFileSync(process.argv[1],require('node:crypto').randomBytes(32).toString('base64url')+String.fromCharCode(10),{mode:0o600,flag:'wx'})" (Join-Path $spotlogAi 'llama-api.key')
}
npm run web:ai:catalog -- (Join-Path $spotlogAi 'planning-public-catalog.json')
```

서로 다른 터미널에서 다음 세 프로세스를 실행한다. 각 터미널에서 `$spotlogAi`를 위와 같은 경로로 설정한다. CPU나 다른 GPU로 실행할 때는 GPU 옵션을 해당 장치에 맞춘다.

```powershell
# 1. 모델 서버
& (Join-Path $spotlogAi 'llama-b12484/llama-server.exe') -m (Join-Path $spotlogAi 'Qwen3-1.7B-Q8_0.gguf') --alias spotlog-local --host 127.0.0.1 --port 11435 --device Vulkan0 -ngl 99 -c 12288 -np 1 --reasoning off --no-ui --api-key-file (Join-Path $spotlogAi 'llama-api.key')

# 2. 게이트웨이
$env:SPOTLOG_PLANNING_AI_CATALOG = Join-Path $spotlogAi 'planning-public-catalog.json'
$env:SPOTLOG_PLANNING_AI_MODEL_KEY = (Get-Content (Join-Path $spotlogAi 'llama-api.key') -Raw).Trim()
npm run web:ai:server

# 3. 웹 앱
$env:VITE_PLANNING_AI_ENDPOINT = '/api/planning-ai'
$env:SPOTLOG_PLANNING_AI_DEV_TARGET = 'http://127.0.0.1:8788'
npm exec --workspace @spotlog/web -- vite --host 127.0.0.1 --port 5212 --strictPort
```

웹에서 `#places-ai`, `#together-plan-group`, `#together-plan-trip`을 연다. 모델이 응답하지 않으면 등록 장소 검색과 기본 초안을 선택할 수 있다. 공개 장소 원본을 바꾸면 카탈로그를 다시 내보내고 게이트웨이를 재시작한다.

## 공개 사이트에서 연결

GitHub Pages는 정적 파일을 호스팅한다. 공개 AI 서비스는 웹과 같은 HTTPS 출처에서 정적 웹 파일과 API를 함께 제공한다. 예를 들어 맥미니나 별도 서버의 역방향 프록시가 `/spotlog/`에는 빌드 결과를, `/api/planning-ai`에는 로컬 게이트웨이를 연결한다. 웹은 `VITE_PLANNING_AI_ENDPOINT=/api/planning-ai`로 빌드하고 게이트웨이의 `SPOTLOG_PLANNING_AI_ORIGIN`에 그 HTTPS 출처를 지정한다. 모델 URL, 모델 이름, 키는 각각 `SPOTLOG_PLANNING_AI_MODEL_URL`, `SPOTLOG_PLANNING_AI_MODEL`, `SPOTLOG_PLANNING_AI_MODEL_KEY`에 둔다. 공개 프록시에서 요청 빈도와 본문 크기를 제한하고, 모델 포트는 로컬에서만 연다.

정적 배포처럼 `VITE_PLANNING_AI_ENDPOINT`가 비어 있는 빌드는 앱에 등록된 데이터와 입력 조건으로 동작한다.

## JSON 요청과 응답

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

게이트웨이는 모델 응답을 최대 40초 기다린다. 클라이언트는 45초가 지나거나 사용자가 화면을 닫으면 대기를 중단한다. 응답의 요청 ID, 기능, 후보와 현재 공개 자료를 확인한 뒤 보여준다. 장소 이름이나 주소는 앱의 등록 자료에서 보여주고, 여행 순서는 사용자가 검토·수정한 뒤 저장한다. 모임 가입 방식과 공개 범위, 일정 저장과 참여 상태는 기존 화면에서 사용자가 정한다.
