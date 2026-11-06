# 공개 관리자 화면 미리보기 · 2026-10-18

## 최신 관리자 정합본 · 로컬 보관 · 2026-10-18

사용자 요청: 빠진 관리자 기능 전부 반영해 최신 로컬과 동일하게 맞춘 뒤 테스트하고, 일단 로컬에 보관. 이번 작업에서 commit·push·공개 배포 없음. 아래 공개 배포 기록은 기존 `96bcf65` 상태이며 이번 정합본이 아님.

- 원본 `C:/Users/Giry/Documents/Spotlog`과 별도 후보 `C:/Users/Giry/.codex/worktrees/account-methods-release-20261014/Spotlog`의 관리자 소스40개 내용 동일. 로컬 후보 브랜치 `codex/admin-local-alignment-20261018`.
- 감사에서 빠졌던11파일·관리자 계약 설명·관련 회귀8파일 반영. 업무 시작/미완료 이어하기, 장소 안 지역 설정, 빠른 필터와 단계별 입력 이동, 추가 관리 접기, 지역별/이전 초안 복구, 추천 여행 공개→HOME_TRIP 게시 자동 선택, 저장 중 추가 입력/충돌 보호 포함.
- 미리보기 미저장 입력도 해당 탭의 `spotlog.admin.preview.drafts.v1` envelope에서 새로고침 후 복구. 예시 상태 키는 `spotlog.admin.preview.v1`. 기존 운영자·고객·검수 연결 저장소를 읽거나 변경하지 않음. 저장소 차단/용량 부족은 메모리 입력 유지·저장 실패 반환, 손상 원문 덮어쓰기 금지.
- CSS 순서로 저장/공개·지역 이동 버튼이36px로 줄어들던 문제 수정. 양쪽 소스에 같은 제한된 선택자 적용, 주 행동44px 유지.
- 자동552검사·원본 웹 타입·후보 production 빌드 통과. 일반 로컬/로컬 미리보기/production 후보3대상 통합98＋미디어/탭격리8＋고객14 =120검수 통과.
- 기존 로컬 업무18개와 DEV23＋production23 저장/충돌 회귀 통과. 기존/신규 지역·추천 여행의 지연 저장 중 추가 입력 보존,409 충돌·401/403/503 접근 차단, production `mode=local` 우회 금지 확인.
- PC1440/모바일390의7개 메뉴·입력16px/행동14px/주 행동44px·사진 정상. 새로고침·이전 초안의 명시적 복구·메인 게시 대상/표지 자동선택 확인. 기존 고객 자료 읽기/변경·예시 API 호출·연결 이벤트0, JS오류/넘침0.
- 고객·네이티브·오프라인·Vite·배포 workflow 소스는 이번 후보에서 변경하지 않음. 기존 매뉴얼53화면 포함. 실제 서버/AI 연결 완료를 뜻하지 않음.
- 확인: http://127.0.0.1:5210/admin.html / 격리 미리보기 http://127.0.0.1:5210/admin-preview.html . production 빌드는 후보 `web/dist`에 보관.
- 증거는 원본 `artifacts/admin-local-alignment-20261018/`: `source-parity.json`, `unit-tests.log`, `build.log`, `final/`, `regression/`, `local-workflow/`. 소스82파일 보관본 `admin-source-local.zip`과 복원 manifest·tracked patch도 보관.
- 공개 브랜치는 계속 `96bcf6568dbfa6c79f4f874b2747d3fbf7d273bf`. 현재 GitHub 화면에는 이번 정합 수정 미반영.



사용자 확인 주소: https://giry02.github.io/spotlog/admin.html

## 문제와 수정

앞선 수정은 없는 관리자 API의 HTML 응답을 JSON 오류로 표시하던 처리만 고침. 실제 공개 주소는 계속 서버 인증 연결을 기다렸고 관리자 본문을 확인할 수 없었음. 오류 안내 검사는 관리자 화면 이용 가능 여부를 검증한 것이 아님.

기존 관리자 주소에 **관리자 미리보기 열기**와 사용 설명서 링크 추가. 별도 `admin-preview.html`에서 예시 자료로 7개 메뉴와 등록·수정·공개 흐름 확인. 실제 서비스 관리자 진입과 인증 처리는 유지.

- 공개 관리자: https://giry02.github.io/spotlog/admin.html
- 조작 가능한 미리보기: https://giry02.github.io/spotlog/admin-preview.html
- 번호형 사용 설명서: https://giry02.github.io/spotlog/manual/admin/

## 데이터와 동작 범위

미리보기는 `createPreviewAdminAdapter`만 명시적으로 전달하는 별도 진입점. `admin.html?mode=local`은 production 인증을 우회하지 않음.

예시 자료에 기존 관리자 DTO·명령 검증 적용. 동시 수정 버전·중복 요청·작업자 권한·공개 조건·개인자료 제외 규칙 유지. 역할 선택은 예시 역할 확인용이며 실제 서비스 권한이 아님.

저장한 예시 변경은 해당 탭의 sessionStorage `spotlog.admin.preview.v1`만 사용. 저장 전 편집 입력은 해당 페이지 메모리에 분리. 기존 고객·관리자·검수 연결·편집 임시저장 키를 읽거나 바꾸지 않음. 고객 화면 연결 이벤트와 관리자 API 요청도 발생시키지 않음. 저장소 사용 불가 시 열린 화면 메모리에서만 유지.

잘못된 예시 저장 자료는 덮어쓰지 않고 오류 표시. 예시의 파일 경로는 GitHub Pages 프로젝트 경로 `/spotlog/` 적용. 실제 장소 사진·출처·권리 정보는 유지.

실제 회원·AI·RAG·메일·알림·지도 서버 연결을 완료한 작업이 아님. 화면에서 AI 시험과 작업 결과는 기존 예시 동작으로 구분.

## 공개 범위

현재 공개 브랜치를 기준으로 미리보기 진입점, 어댑터, 저장 범위 분리, 링크와 스타일, 회귀 검사만 반영. 별도 로컬 관리자 개편·오프라인 여행 기능·사용자 자료는 포함하지 않음. 고객 소스 수정 없음. 다중 진입점 추가에 따른 Vite 공유 청크 재구성으로 고객 bundle 파일명은 변경될 수 있음.

## 검증

- 전체 자동 검사 536개 통과. 신규 미리보기 검사 11개 포함.
- 독립 릴리스 production 웹 빌드 및 타입 검사 통과. 원본 작업본 웹 타입 검사 통과.
- 사용 설명서 53개 화면·이미지 빌드에 포함.
- production 정적 배포본 브라우저 71개 통과: 관리자 49개, 미디어·탭 격리 8개, 고객 회귀 14개.
- PC 1440px·모바일 390px의 7개 메뉴, 장소 등록·저장·새로고침, 국가 등록, AI 예시 시험, 노출 초안 보호 확인.
- 기존 관리자 404/401/403 인증 차단 유지. 예시 화면에서 기존 localStorage 읽기·변경, 고객 연결 이벤트, 관리자 API 호출 모두 0회.
- 장소·커뮤니티 표시 사진 정상. 가로 넘침·JS 오류 없음. 고객 홈·내 여행·5종 로그인/가입·약관 확인.
- 증거: 원본 작업본의 `artifacts/admin-preview-20261018/static/{results,media-results,customer-results}.json`. 실제 공개 검수는 배포 후 별도 기록.

## 연결 전

실제 운영 데이터·권한·인증·파일·AI 실행은 기존 `/api/admin/v1` 서버 계약으로 별도 연결. 공개 미리보기의 예시 변경을 실제 고객 데이터로 전달하지 않음.

## 공개 반영 결과

커밋 `96bcf6568dbfa6c79f4f874b2747d3fbf7d273bf`를 기존 `codex/mobile-foundation`과 `codex/admin-public-preview-20261018`에 push. [Pages39088216493](https://github.com/giry02/spotlog/actions/runs/39088216493) 완료·성공. 공개 HTML과 실제 실행 파일이 릴리스 빌드와 일치.

- 공개 브라우저 78개 통과: 관리자49·사진/탭격리8·고객14·실제 진입7.
- 사용자 제시 admin.html의 실제404 연결 대기에서 미리보기 버튼 클릭 → admin-preview.html 본문 진입 확인. PC/모바일7개 메뉴·장소 등록/저장/새로고침·지역·AI예시·노출초안 보호 정상.
- 기존 자료 읽기/변경·고객연결 이벤트·미리보기 API호출0. 깨진 표시 사진·JS예외·가로넘침0. 실제 서비스 관리자 인증 차단 유지.
- 앱·관리자·미리보기·설명서·placeholder HTTP200, 설명서53화면 유지. 고객 source 변경 없음.
- 실행 파일: `adminPreview-B2fvwJ5n.js`, `admin-B_qqV94P.js`, 공유UI `admin-BypOLYrK.js`, 고객 `customer-q6QkWfPW.js`.
- 근거: `artifacts/admin-preview-20261018/live/{results,media-results,customer-results,entry-results,root-public-smoke}.json`, PC/모바일 스크린샷, pages-run.json, release.json. 원본 로컬의 다른 변경과 사용자 저장자료 보존.

