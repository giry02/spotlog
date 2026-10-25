# Spotlog 앱 화면 연결 인계 — 2026-10-19

이번 기능은 로컬 챗봇(`http://localhost:3001/`)과 기존 Spotlog 모바일웹(`http://localhost:5210/spotlog/`)의 연결이다. 실제 회원 서버·게시 서버·물리 React Native 호스트는 연결하지 않았다. 원격 배포 및 Git 커밋·푸시는 하지 않는다.

## 모델 행동과 앱 확인 화면

모델은 `open_spotlog`로 아래 **화면 진입만 제안**한다. `entry`는 반드시 정해진 `target`과 일치해야 한다. `day`는 1–30, `journeyId`와 `placeId`는 제한된 식별자 형식이다. `placeId`는 `place-comment`와 `place-reaction`에서만 허용한다.

| target | entry | 이어지는 기존 앱 기능 |
| --- | --- | --- |
| journal | journal-text | 내 여행기와 DAY 선택 → 글 카드 직접 추가 |
| journal | journal-photos | 내 여행기와 DAY 선택 → 사진 카드 및 기기 사진 직접 선택 |
| journal | journal-draft | 저장된 편집 초안 복구, 이번 편집의 되돌리기·다시 실행 |
| journal | journal-preview | 기존 여행기 미리보기 |
| journal | journal-visibility | 기존 미리보기의 공개 범위·저장·로그인 확인 |
| community | place-comment | 공개 여행기·DAY·실제 PLACE 카드 선택 → 해당 댓글 시트 |
| community | place-reaction | 공개 여행기·DAY·실제 PLACE 카드 선택 → 기존 장소 좋아요 바텀 시트. 직접 누르기 전 반응 변경 없음 |
| community | journey-comment | 공개 여행기 선택 → 기존 여행기 전체 댓글·응원 바텀 시트 |
| community | journey-cheer | 공개 여행기 선택 → 기존 여행기 응원·전체 댓글 바텀 시트 |
| profile | profile-summary | 기존 계정 프로필 → 로그인 상태 확인 후 기기 검수 프로필·창작 등급 영역 펼치기 |
| profile | profile-activity | 기존 계정 프로필 → 로그인 상태 확인 후 기기 검수 활동 통계 영역 펼치기 |
| trips | personal-place | 내 비공개 일정·DAY·장소 종류 선택 → 이름·주소 직접 등록 |
| account | account-email | 이메일 로그인 폼 |
| account | account-reset | 비밀번호 찾기 폼 |
| account | account-logout | 로그인 상태에 따른 기존 계정 확인 화면 |
| account | account-delete | 실제 회원은 탈퇴 확인, 비회원은 로그인, 검수 계정 제한 유지 |

앱에 없는 챗봇 여행 ID를 앱 원본 ID로 해석하지 않는다. 앱에서 사용자가 실제 여행과 DAY를 선택한다. 완료한 개인 PLAN은 명시적인 ‘별도 여행기 초안을 만들고 열기’ 확인 후 별도 JOURNAL로 복사한다. 원본 PLAN은 유지한다. **DRAFT PLAN의 여행기 작성 진입은 기존 앱 정책대로 차단**하며, 앱에서 먼저 일정을 완료해야 한다.

사진은 선택 후 기기 편집 초안에만 저장한다. 공개·댓글 전송·이메일 발송·로그아웃·탈퇴를 브리지 수신만으로 실행하지 않는다. 실제 서버 미연결 시 성공했다고 응답하지 않는다.

2026-10-19 남은 우선순위 확장: F019·F021·F023은 위 5개 목적 진입을 사용한다. 공개 여행은 `PUBLIC`·`PUBLISHED`·`purpose !== PLAN`·휴지통 아님을 확인하고, 장소 반응은 DAY 내 실제 PLACE 블록과 방문 식별자를 함께 확인한다. 같은 장소가 두 번 등장해도 카드 ID를 합치지 않는다. 앱이 사용자가 고른 여행/장소를 최종 결정하며, 모델이 제안한 챗봇 ID를 앱 원본으로 사용하지 않는다. 게스트의 직접 반응은 기존 로그인 gate를 거친다. 전체 댓글 입력은 바텀 시트에서 로그인 화면으로 이동할 때 본문에 유지하며, 로그인 성공만으로 댓글을 등록하지 않는다. 프로필·등급·누적 담김·받은 응원은 기존 기기 검수 자료임을 유지하고 실제 회원 통계로 내보내지 않는다.

## 챗봇 전체 일정 → 새 개인 DRAFT 사본

새 사본 전달은 LLM 행동 스키마에 포함하지 않는다. 사용자가 `TripAppActions`의 ‘현재 전체 일정을 새 비공개 초안으로 가져오기’를 누르는 별도 브라우저 기능이다.

1. 앱 안의 연결 화면에서 실제 챗봇을 연다. 독립 챗봇에서는 로컬 연결 URL을 안내한다.
2. 클라이언트는 모든 DAY와 방문 순서를 내보낸다. 빈 DAY도 보존한다. 제목·지역·장소 ID/이름/종류/지역/공개 주소만 허용한다.
3. 앱 승인 시트가 전체 DAY와 장소별 확인 상태를 보여준다. 앱 공개 카탈로그와 **ID·이름·종류 모두 일치**해야 등록 자료로 확인한다.
4. 일치하지 않는 장소는 좌표·등록 정보 미확인 개인 입력으로 표시한다. 별도 체크박스 승인 전에는 가져오기를 막는다. 조용히 제외하거나 공식 장소로 확정하지 않는다.
5. 승인 후 새 PLAN/private/DRAFT ID 및 DAY·방문·블록 ID를 만든다. 기존 여행 ID를 받거나 덮어쓰지 않는다. 취소 시 생성하지 않는다.

사진·메모·방문 시각·예약 상세·예약 고정·진행 완료 상태는 기본 전달에서 제외한다. 잠긴 숙소는 예약명을 감추고 ‘예약 숙소 (정보 미전달)’로 표시한다. 원본 방문 ID와 앱 사용자 인증 정보를 공유하지 않는다. 기본 한도는 UTF-8 256KiB, 1–30 DAY, DAY당 최대 30곳, 전체 900곳이며 일부만 잘라 생성하지 않는다.

## 연결 보안 및 보존

`spotlog-chatbot-v1` 채널의 버전·고정 로컬 origin·실제 parent/iframe source·nonce·요청 ID를 확인한다. `postMessage`의 wildcard origin과 전체 localStorage 읽기/쓰기 프록시는 없다. nonce는 10분 만료, 요청 재전송은 거부한다. 앱 URL의 `localhost`와 `127.0.0.1`은 저장소가 다르므로 자동 이관하지 않는다.

기존 `selected-trip` / `selected-day` / `saved-places` 읽기는 별도 사용자 선택·승인 후 최소 읽기 맥락만 전송한다. `guest-device`·`local-review`·`verified-member` 출처를 구분하며, 비회원 기기 자료를 회원 DB 동기화로 취급하지 않는다.

## 구현 위치

- 챗봇: `lib/spotlog-app-bridge.ts`, `lib/spotlog-action.ts`, `lib/spotlog-draft-handoff.ts`, `components/spotlog-app-features.tsx`.
- 앱: `web/src/chatbotHostBridge.ts`, `ChatbotHostController.tsx`, `chatbot-host.css`, `App.tsx`; 기존 `CardSocial`과 `AccountSheet`/context/provider에 선택적 진입 값만 추가.
- 계약: `SpotlogOpenAction`을 엔진·파서에서 공유한다. 모델은 `entry`/`placeId`를 제안하고, 실제 앱 확인 UI가 목적지와 권한을 결정한다.
- 네이티브: 클라이언트의 `ReactNativeWebView.postMessage` 전송 계약만 존재한다. 실제 기기 호스트 구현·인증·응답은 별도 작업이다.

## 검수 증거

격리 Playwright 컨텍스트에서 실제 앱 production 빌드 + 실제 localhost:3001 iframe을 사용했다. 사용자 브라우저 프로필이나 기존 localhost 저장소는 접근하지 않는다. 목적 진입 QA는 LLM 호출을 만들지 않으며, 실제 LLM 의미 해석 QA는 별도 엔진 검수에서 수행한다.

- `tests/spotlog-app-bridge.test.mjs`: 목적별 계약, 임의 필드 거절, 최소 맥락, nonce/source 검증, DRAFT 개인정보 제거.
- 앱 `web/tests/chatbotHostBridge.test.mjs`: 계약·재전송·선택 투영·원본 보존·미확인 개인 사본 생성.
- `work/handoff/chatbot-medium-iframe-20261019.mjs`: 실제 iframe UI에서 글/사진/undo-redo/초안 복구/미리보기/공개 범위/장소 댓글/계정/사본 승인/개인 장소/DRAFT gate/별도 JOURNAL 확인. 결과와 화면은 같은 이름의 로컬 디렉터리에 저장한다.
- `work/handoff/priority-real-llm-20261019/prompt-sync-verification.json`: 실행 Flowise 2개 그래프 프롬프트 동기화 후 키·정책·Flow ID·모델 불변 확인. 비밀 백업 파일은 공유하지 않는다.
