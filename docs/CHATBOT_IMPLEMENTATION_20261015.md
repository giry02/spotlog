# Windows 로컬 AI 구현 · 2026-10-15

이 문서는 첫 Ollama 직접 연결 시점의 기록이다. 이후 같은 날 Flowise와 RAG의 실제 연결도 완료했으며, 최신 실행·검증·제한은 [Flowise·RAG 연결 기록](FLOWISE_RAG_LOCAL_20261015.md)을 우선한다. 화면의 휴대폰 테두리·노치·상태바도 제거해 일반 반응형 웹으로 바꿨다.

주 작업은 Moa이며 별도 Spotlog 앱은 계약·schema·한국어 시험 자료의 읽기 전용 참조다. 공개 Sites와 개인 저장 자료는 변경하지 않는다. Windows에서 먼저 모델 왕복을 검증하고 맥미니로 AI 실행부를 이전한다. Vinext/Cloudflare 웹 호스팅 이전과 브라우저 localStorage 이전은 각각 별도 작업이다.

## 실행 경계

- RAM 32GB, RTX 4060 Laptop GPU 8188MiB, NVIDIA driver 595.97 확인.
- 기존 Flowise/Ollama 설정·런타임을 발견하지 못했다. 프로젝트의 Git 제외 `.sites-runtime/ai` 아래에 런타임·모델·Flowise DB를 격리한다. 기존 Node26 설치를 바꾸지 않는다.
- Flowise provider 메모리는 요청별 서버 UUID로 분리한다. 클라이언트 sessionId를 회원 인증으로 신뢰하지 않는다. 최근 12 turn history와 현재 상태를 명시적으로 전달한다. 개발 flow는 영구 메모리를 사용하지 않는다.
- 현재 구현 경로는 `Moa /api/chat → Ollama /api/chat → parseModelReply → applyModelReply → 기존 카드`이며 `mode:ollama`와 turn의 `source:ollama`로 구분한다. 실제 Flowise 호출 성공만 `flowise`다. `.dev.vars`의 `CHAT_PROVIDER=ollama`로 개발 연결을 선택했다. Flowise 3.1.4/Node24.22 설치는 better-sqlite3 빌드의 Windows SDK 부재로 실패했다. 설치 완료나 flow import/export 검증으로 표시하지 않는다.
- Ollama 0.40.4, Qwen3 4B·4B Instruct 2507·8B Q4_K_M을 내려받았다. 실행 구성과 digest는 `local-ai-runtime.json`에 기록했다. 현재 선택은 8B, temperature0/think:false/context12288/predict1200이다. 전체 JSON Schema의 allOf/not를 Ollama grammar에 넘기는 방식은 출력 오류가 발생해 JSON 모드와 동일한 서버 계약 검증으로 전환했다.
- `scripts/start-local-ai.ps1`은 프로젝트 Ollama를 숨김 창·루프백으로 실행하고 버전과 모델 존재를 확인한다. 이미 떠 있는 다른 버전의 런타임을 종료하거나 교체하지 않는다. 모델 재설치 시 manifest digest를 별도로 확인한다.
- 현재 PC 측정에서 8B 프로세스 모델 메모리 약 7.22GB, VRAM 약 6.29GB가 관측됐다. 전용 메모리 전체 사용량과 다른 프로세스 메모리는 별도다. 최초 로딩 포함 요청과 warm 요청 지연을 혼동하지 않는다.
- 후보 계약 보완: 모델에 주는 `candidates.cafes`는 현재 anchor/도보/가격 필터로 계산한다. collect는 그 카페를 UI 탭 전환 없이 담을 수 있지만 다른 anchor 카페는 계속 거절한다. 지역 없는 build는 서버가 거절한다. 일정 계산기는 기존 구현 하나를 유지한다.
- `npm run eval:chat`은 로컬 `/api/chat`으로 실제 HTTP 요청을 보낸다. `MOA_EVAL_URL`로 로컬 주소를 지정한다. 원격 전송·redirect·자동 재시도는 막고 요청당 50초로 제한한다.
- 생성·카페 이어 담기·예약 언급·DAY 2 오후 수정·공개 코스·정보 부족을 순서대로 검사한다. 최대 6회 모델 호출이며 이전 실패 시 종속 호출을 멈춘다. `mode:demo`는 실모델 성공으로 집계하지 않는다. 결과는 사례 ID·HTTP 상태·성공 여부·지연만 출력한다. 모델명은 API에서 검증하지 못하므로 별도로 기록해야 한다.
- 의미 검사는 최소 조건이다. 실제 근처·조용함·동부 등 사실성과 설명 근거는 별도 평가가 필요하다. 기존 모의 fetch 회귀 검사와 실제 모델 측정은 합산하지 않는다.

## 서비스 계약 연결 경계

Spotlog `docs/contracts/ai-v1` README·CONTRACT·schemas·CLASSIFICATION·cases·fixtures를 참조했다. 100개 한국어 예상 정답은 모델 실행 결과가 아니다.

| 단계 | ai-v1 목표 | 현재 Moa / 후속 작업 |
|---|---|---|
| interpret | 원문·선택값 출처 → 조건·미해결·근거 | 원문+snapshot → 카드 actions. origin과 원문 구간 DTO 추가 필요 |
| search | 서버 허용 placeId·자료 버전 → 문서/조각/근거 | authored-demo catalog 사용. 실제 RAG와 승인 원본 재조회 미구현 |
| plan | 서버 계산·예약 유지 | trip-engine과 applyModelReply 재사용. 별도 일정 계산기 없음 |
| explain | 검증 일정+근거 → 설명·근거 ID | 일반 message만 반환. 실제 RAG 설명으로 표시하지 않음 |
| save | 인증·소유권·DB revision·idempotency | 클라이언트 snapshot과 기기 저장. 회원 DB 저장 미구현 |

ai-v1의 1~7일·기본 숙박 정책을 Moa의 1~3일·숙소 선택사항에 자동 적용하지 않는다. 실제 서버 ID와 데모 ID도 혼합하지 않는다. 기존 카드/계산 기능을 서비스 adapter 경계에서 교체해야 하며 ai-v1 endpoint 존재를 가정하지 않는다.

## 검증 명령

최종 코드의 자동 회귀 186개, TypeScript, 배포 빌드가 통과했다. 실제 로컬 Qwen3 8B 연속 smoke 6건도 마지막 1회 실행에서 모두 통과했다. 각 지연은 생성9278ms/이어 담기8288ms/예약 언급7220ms/부분 수정7352ms/공개 코스7481ms/정보 부족2263ms였다. 앞선 반복에서는 예약·부분 수정 누락이 발생했으므로 이 6건 통과를 자유 문장 전반의 안정성이나 100개 해석 정확도로 일반화하지 않는다. 실제 예약 식별·DB 확인은 없고 booked 언급의 데모 상태 처리만 검증했다.

모델 digest·공유 프롬프트 hash·측정 결과는 [평가 기록](evaluations/2026-10-15-local.json)에 보관한다. 브라우저에서 실제 모델의 2일 일정 카드와 로컬 AI 응답 표시를 확인했다. 명시적 DAY 오전/오후 '만' 수정은 대상 밖 방문 변경과 전체 build를 원자적으로 거절하는 서버 검증을 추가했다. 더 다양한 한국어 표현과 현재 카탈로그 밖 요청은 추가 평가가 필요하다.

현재 확인용 웹 주소는 `http://localhost:3001`, Ollama는 `http://127.0.0.1:11434`다. 로컬 설정은 Git 제외 `.dev.vars`에 있으며 공개 배포에는 반영하지 않았다. 실제 RAG·회원 DB·Flowise·운영 인증/요청 제한은 미완료다.

런타임 재구성은 [공식 Windows 안내](https://docs.ollama.com/windows)를 따라 `local-ai-runtime.json`의 공식 archive를 `.sites-runtime/ai/ollama-0.40.4`에 풀고, `OLLAMA_MODELS`를 프로젝트 models 폴더로 지정해 `ollama serve`와 동일 태그 pull을 수행한다. 이후 digest를 대조하고 `scripts/start-local-ai.ps1`로 재기동한다. 맥미니에는 macOS용 런타임을 새로 설치하며 Windows 실행 파일이나 node_modules를 복사하지 않는다.

```powershell
npm test
npx tsc --noEmit
npm run build
# 실행 중인 개발 서버에서 별도 수행
$env:MOA_EVAL_URL = 'http://localhost:3001/api/chat'
npm run eval:chat
```

운영 공개 전 회원 인증·서버 세션·DB revision/idempotency·요청 및 비용 제한이 필요하다. 개발 루프백 연결을 공개 Sites에 배포한 것으로 해석하지 않는다. 이전 시 런타임 버전·flow export·프롬프트·schema·모델 digest와 설정·평가 결과를 보존하고 인증값은 대상에서 별도 설정한다. 승인 원문/RAG DB는 아직 없으므로 이전 완료로 표시하지 않는다.
