# 고객 프론트 공개 배포 · 2026-10-06

사용자 요청: ‘아우 배포해’. GitHub 백업과 공개 사이트를 구분한 뒤 최신 고객 프론트의 GitHub Pages 배포를 명시적으로 승인.

- 고객 소스 기준: `bebcf2969385719f6ce97ddced1cb5e403cdf1f5`, `codex/customer-frontend-20261006`.
- 기존 공개 기준: `922d17e87dfbb5c7cd714ea91b3125c3927615ad`, `codex/mobile-foundation`.
- 두 브랜치의 이력이 분기되어 있으므로 공개 브랜치 위에서 고객 소스 스냅샷을 새 커밋으로 반영. 강제 push나 기존 주차별 브랜치 변경 없음.
- 공개 주소: https://giry02.github.io/spotlog/
- 기존 `.github/workflows/deploy-pages.yml`로 `web/dist`만 배포.
- 관리자 진입점·소스·스타일·검수 화면은 배포에 포함하지 않음. 원래 로컬 관리자 작업본 유지.
- 최신 고객 기능: 장소 카드 좋아요·댓글·답글, 전체 화면 영어 보기, 네이버 길찾기, 저장 장소 여행 생성과 개인 일정 수정, 여행기 작성, 사진·지역 안내 및 공용 공개 자료/신고 연결부.
- 서버·AI·회원·신고 접수 연결 완료로 취급하지 않음. 반응·댓글은 기존 기기 저장 방식. 실제 신고 API 미설정 운영 빌드는 연결 전 상태 유지.

배포 전 독립 고객 빌드 확인. 배포 후 실제 공개 페이지의 모바일 화면, 장소 카드 반응·댓글·답글·재접속 보존, 이미지와 스크립트 오류를 격리 브라우저에서 확인. 배포 결과·실제 커밋·검수 기록은 로컬 현재 인수인계에 기록.

## 완료 결과

- 공개 커밋: `f6bd6c083f850442feb167e2bff7dfe884bf69c6`.
- 배포 작업: https://github.com/giry02/spotlog/actions/runs/37390221641 — `completed / success`.
- 공개 HTML의 새 JavaScript `index-Dg8p5KZX.js`, CSS `index-DA_WMW9e.css`가 독립 로컬 빌드와 일치.
- `web/`, `shared/`, `.github/` 파일은 고객 백업 `bebcf29`와 동일. 관리자 소스 및 빌드 결과 없음.
- 격리 Edge:320/390/460px×홈·여행기·장소 사진·내 여행·저장15화면. 가로 넘침·완료 이미지 깨짐·JS예외·에셋HTTP오류 없음.
- 공개 여행기 장소 카드 좋아요→댓글 작성→답글 작성→새로고침 후 유지 확인. 테스트 내용은 격리 브라우저 저장소에만 저장.
- 증거: `artifacts/customer-pages-20261006/live/results.json`, `journal-place-social.png`, `place-comment-reply.png` 및15경로 화면.
- 원래 로컬 관리자 작업본과 기존 고객 백업 브랜치 유지. 실제 서버·AI·회원·신고 연결 상태를 변경하지 않음.
