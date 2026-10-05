import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = 'C:/Users/Giry/Documents/Spotlog';
const htmlPath = path.join(root, 'deliverables/spotlog-schedule-20260918.html');
const archive = path.join(root, 'artifacts/schedule-yearend-20260918');
const before = fs.readFileSync(path.join(archive, 'spotlog-schedule-before-yearend.html'), 'utf8');
const original = new Function(before.slice(before.indexOf('const phases='), before.indexOf('const esc=')) + ';return {phases,weeks};')();
const phases = [
  ...original.phases.slice(0, 4).map(p => ({ ...p, duration: `${p.weeks}주` })),
  { name:'AI·RAG', weeks:4, duration:'4주', period:'2026.12.02~12.29', features:'AI 서버·검색·업체 연결·기본 추천·결과 저장', start:12, end:15, style:'ai' },
  { name:'테스트·여행 데이터 수집', duration:'1개월', period:'2027.01.01~01.31', features:'서버·AI·앱 통합 테스트·여행 데이터 확보·오류 보완', start:16, end:20, style:'app' }
];
const weeks = [
  ...original.weeks.slice(0, 8),
  [9,'11.11~11.17','11.17','랜드마크·업체 데이터','고유 ID·내부 순위·주소·좌표·업체 등록·AI 검증용 기초 자료'],
  ...original.weeks.slice(9, 11),
  [12,'12.02~12.08','12.08','AI 서버와 검색 기반','모델 API 연결·요청과 응답·내부 자료 검색 기반'],
  [13,'12.09~12.15','12.15','RAG 검색과 업체 ID 연결','지역·종류별 검색·내부 순위·주소·좌표를 같은 업체 ID로 연결'],
  [14,'12.16~12.22','12.22','기본 당일 여행 추천','취향·저장 장소 기반 추천·주변 업체 후보·추천 근거'],
  [15,'12.23~12.29','12.29','추천 저장과 AI 개발 완료','결과 승인·여행 저장·자료 부족·추천 실패 처리'],
  [16,'01.01~01.05','01.05','통합 테스트와 수집 대상 정리','실제 서버·AI·앱 연결·대상 지역과 장소 목록·누락 자료 확인'],
  [17,'01.06~01.12','01.12','핵심 기능 테스트와 장소 수집','로그인·저장·사진·댓글·여행/DAY·랜드마크·주변 업체 자료'],
  [18,'01.13~01.19','01.19','추천 검증과 여행 자료 보완','Android/iOS·추천 결과·업체 ID·좌표·사진·출처 확인'],
  [19,'01.20~01.26','01.26','실사용 테스트와 데이터 정리','실제 여행 동선·기기별 오류·중복/누락 정리·스토어 제출 준비'],
  [20,'01.27~01.31','02.02','최종 테스트와 오픈 준비','주요 오류 재확인·여행 데이터 최종 반영·배포본·스토어 제출']
];
const details = [
  {title:'1차 프론트 · 발견에서 여행 담기까지',subtitle:'2026.09.15~09.29 · 2주 · 전체 1~2주차',start:1,end:2,goal:'발견한 장소를 저장하고 원하는 여행의 DAY에 담습니다.',note:'09.15는 착수일을 포함합니다. 선행 구현한 기능도 주차별로 나누어 제시합니다.'},
  {title:'2차 프론트 · 개인 동선과 여행기',subtitle:'2026.09.30~10.13 · 2주 · 전체 3~4주차',start:3,end:4,goal:'저장한 랜드마크로 동선을 만들고 주변 업체를 채웁니다.',note:'내 여행은 개인 일정, 여행기는 별도 작성 콘텐츠입니다. 휴지통의 구체 보관 정책은 별도 확정합니다.'},
  {title:'3차 프론트 · AI 추천과 계정 화면',subtitle:'2026.10.14~10.27 · 2주 · 전체 5~6주차',start:5,end:6,goal:'추천 조건 입력부터 후보 선택·승인·저장까지 화면을 연결합니다.',note:'예시 응답을 사용하는 프론트 범위입니다. 실제 서버·AI·앱 연결 검증은 1월에 진행합니다.'},
  {title:'백엔드 · 서비스 데이터와 업체 연결',subtitle:'2026.10.28~12.01 · 5주 · 전체 7~11주차',start:7,end:11,note:'AI 개발에 필요한 기초 자료는 이 단계에서 확보합니다. 업체 ID로 내부 순위·주소·좌표를 연결합니다.'},
  {title:'AI·RAG · 연내 개발 완료',subtitle:'2026.12.02~12.29 · 4주 · 전체 12~15주차',start:12,end:15,note:'초기 범위는 기본 당일 추천과 승인 후 여행 저장입니다. 12.30~12.31은 연말 정리·인수인계 기간입니다.'},
  {title:'테스트·여행 데이터 수집',subtitle:'2027.01.01~01.31 · 1개월 · 보고 16~20주차',start:16,end:20,note:'01.31까지 작업 후 02.02(화) 최종 보고합니다. 서비스 공개는 테스트 결과와 스토어 승인에 맞춰 진행합니다.'}
];
assert.deepEqual(phases.slice(0,3).map(({duration,...p})=>p), original.phases.slice(0,3));
assert.deepEqual(weeks.slice(0,6), original.weeks.slice(0,6));
for (const w of weeks) {
  const year = w[0] < 16 ? 2026 : 2027;
  assert.equal(new Date(`${year}-${w[2].replace('.', '-')}T12:00:00Z`).getUTCDay(),2, `Report ${w[0]} must be Tuesday`);
}
let html = before;
function replaceOnce(from,to) {
  assert.equal(html.split(from).length,2,`Expected exactly one match: ${from.slice(0,90)}`);
  html = html.replace(from,to);
}
html = html.slice(0,html.indexOf('const phases=')) + `const phases=${JSON.stringify(phases,null,1)};\nconst weeks=${JSON.stringify(weeks)};\n` + html.slice(html.indexOf('const esc='));
html = html.slice(0,html.indexOf('const details=')) + `const details=${JSON.stringify(details,null,1)};\n` + html.slice(html.indexOf('const overview='));
replaceOnce('Spotlog 전체 6단계 개발 일정과 화요일 보고 기준 20주 세부 일정. 2026년 9월 15일~2027년 2월 2일.','Spotlog 전체 6단계 일정. 프론트 일정 고정, 백엔드 5주, AI·RAG 4주로 2026년 개발 완료. 2027년 1월 테스트·여행 데이터 수집, 2월 2일 최종 보고.');
replaceOnce('<td>${p.weeks}주</td><td>${p.period}</td>','<td>${p.duration}</td><td>${p.period}</td>');
replaceOnce('프론트 6주 → 백엔드 5주 → AI·RAG 5주 → 앱 연결·출시 4주. 프론트·백엔드·AI/RAG 각 담당 1명 기준입니다.','프론트 6주 · 백엔드 5주 · AI·RAG 4주 · 1월 테스트·여행 데이터 수집. 각 개발 담당 1명 기준입니다.');
replaceOnce('aria-label="20주 단계별 배치"','aria-label="화요일 보고 20회 기준 단계별 배치"');
replaceOnce('<td class="bar ${p.style||\'\'}" colspan="${p.weeks}">${p.weeks}주</td>${\'<td></td>\'.repeat(20-p.end)}<td>${p.weeks}주</td>','<td class="bar ${p.style||\'\'}" colspan="${p.end-p.start+1}">${p.duration}</td>${\'<td></td>\'.repeat(20-p.end)}<td>${p.duration}</td>');
replaceOnce('<p>AI·RAG 완료<strong>2027.01.05</strong></p><p>첫 오픈 목표<strong class="accent">2027.02.02</strong></p>','<p>AI·RAG 완료<strong>2026.12.29</strong></p><p>테스트·수집 완료<strong class="accent">2027.01.31</strong></p>');
replaceOnce('숫자는 전체 주차입니다. 월 구분은 해당 주의 화요일 보고일 기준이며, 공휴일 보충으로 종료일을 늘리지 않은 기준안입니다.','숫자·월 구분은 화요일 보고 기준입니다. 12.30~12.31은 인수인계, 1월은 테스트·수집, 02.02는 최종 보고입니다.');
replaceOnce('2026.09.15 — 2027.02.02','2026.09.15 — 2027.01.31');
replaceOnce('<strong class="twenty">20주</strong><small>전체 개발 기간</small>','<strong class="twenty">2026.12.29</strong><small>AI·RAG 개발 완료</small>');
replaceOnce('<strong>6단계</strong><small>프론트부터 앱 출시까지</small>','<strong>2027년 1월</strong><small>테스트·여행 데이터 수집</small>');
replaceOnce("subtitle:'선택한 20주 기준안 · 첫 오픈 목표 2027.02.02'","subtitle:'프론트 일정 고정 · 백엔드 5주 · AI·RAG 4주 · 1월 테스트·여행 데이터 수집'");
replaceOnce("title:'20주 전체 로드맵',subtitle:'프론트 완료 → 백엔드 완료 → AI·RAG 완료 → 앱 연결·출시'","title:'전체 로드맵과 완료 시점',subtitle:'연내 AI 개발 완료 · 1월 통합 테스트·여행 데이터 수집 · 매주 화요일 보고'");
replaceOnce('<th scope="col">주요 기능</th></tr></thead><tbody>${weeks.filter','<th scope="col">주요 항목</th></tr></thead><tbody>${weeks.filter');
replaceOnce('.roadmap tbody td{height:44px', '.roadmap tbody td{height:40px');
replaceOnce('@media(prefers-reduced-motion:reduce)', '#slide-3 .slide-head,#slide-7 .slide-head,#slide-9 .slide-head{margin-bottom:15px}\n@media(prefers-reduced-motion:reduce)');
fs.writeFileSync(htmlPath,html,'utf8');

const rows=phases.map(p=>`| **${p.name}** | ${p.features} | **${p.duration}** | ${p.period} |`).join('\n');
const weekRows=weeks.map(w=>`| ${w[0]}주차 | ${w[0]<16?'2026':'2027'}.${w[1]} | ${w[2]} | ${w[3]} — ${w[4]} |`).join('\n');
const baseline=`# Spotlog 기준 일정 — 연내 AI 개발 완료안

최초 저장: 2026-09-15 · 최신 변경: 2026-09-18

사용자 요청에 따라 **프론트 날짜는 고정, 백엔드 5주, AI·RAG 4주**, 다음 한 달은 테스트·여행 데이터 수집으로 변경했다. 기존 ‘AI·RAG 5주’ 조건은 최신 요청으로 대체한다. [전체 단계·세부 HTML 일정표](../../deliverables/spotlog-schedule-20260918.html).

**조회 규칙:** 사용자가 “일정”, “일정 보여줘”라고 하면 아래 6행 표를 그대로 보여준다. 별도 변경 요청 전에는 날짜·기간·기능을 바꾸지 않는다. 기획·설계·고객 확인·수정 과정을 별도 일정 항목으로 나누지 않는다.

**프론트 6주 → 백엔드 5주 → AI·RAG 4주 → 2027년 1월 테스트·여행 데이터 수집. AI 개발 완료 목표 2026-12-29.**

| 단계 | 주요 기능 | 기간 | 일정 |
|---|---|---:|---|
${rows}

12/30~12/31은 연말 정리·인수인계 기간이다. 1월 작업 종료일은 01/31이며, 화요일 보고 원칙에 맞춰 최종 결과는 02/02에 보고한다. 02/02를 자동 공개 확정일로 간주하지 않는다. 서비스 오픈은 1월 테스트 결과와 Android/iOS 스토어 승인에 맞춰 진행한다.

## 화요일 기준 세부 일정

1~15주차는 개발 기간, 16~20주차는 1월 작업에 대한 보고 단위다. 1월은 달력상 한 달이며 5주 전체 개발 기간으로 늘린 것이 아니다.

| 보고 주차 | 진행 기간 | 화요일 보고 | 주요 기능·항목 |
|---|---|---|---|
${weekRows}

## 범위와 협업 기준

프론트·백엔드·AI/RAG는 각 담당 1명이며, 개발은 프론트 완료 → 백엔드 완료 → AI/RAG 완료 순서다. 1월 통합 테스트와 오류 보완에는 각 담당이 함께 참여한다. 자료 제공·확인은 고객 협조가 필요하며 데이터 수집 전담 인원이 추가된 것으로 계산하지 않는다.

백엔드는 기존 5주와 기능 범위를 유지한다. AI/RAG는 관리형 서버·외부 모델 API, 제공된 내부 순위와 초기 장소/업체 약 100건을 활용하는 초기 범위 기준 4주다. 기본 당일 추천·업체 연결·추천 근거·승인 후 여행 저장·자료 부족 및 실패 처리를 포함한다. 자체 모델 학습, 복잡한 다일 최적화·부분 재생성·관광 대화·영어 확장은 후속 범위다. 프론트의 AI 화면은 예시 응답이며 실제 연결과 기기 검증은 1월에 진행한다.

AI를 데이터 없이 개발하지 않도록 11월 백엔드 단계에서 검증용 기초 자료·업체 ID·순위·주소·좌표를 준비한다. **1월 수집은 여행 데이터의 확대·보완·품질 확인**이다. 랜드마크·주변 업체·사진·소개·실제 동선을 확보하고, 중복·누락·좌표·사진 일치·출처를 확인한다. 내부 자료와 외부 검색 결과를 구분하는 기존 [데이터 수급 계획](../DATA_SUPPLY_AND_NAVER_PLAN.md)을 따른다.

기존 ‘앱 연결·출시’의 서버/AI 연결, Android/iOS 검증, 배포본과 스토어 제출 준비는 1월 단계에 포함한다. 기능 전체 재개발이나 앱 구조 변경을 추가한 일정은 아니다. 공개일은 최종 테스트 결과와 스토어 승인 후 결정한다.

기간은 달력 기준이며 공휴일을 보충해 종료일을 연장한 일정은 아니다. [기존 20주안 휴일 비교](HOLIDAY_REVIEW_20_WEEK.md)의 94일·02/12 계산은 이전 일정에 대한 기록으로, 이번 변경안의 가용일 계산으로 재사용하지 않는다.

## 이전 일정 보관

[변경 전 기준표](../../artifacts/schedule-yearend-20260918/FIRST_RELEASE_20_WEEK_BASELINE-before-yearend.md)와 [변경 전 HTML](../../artifacts/schedule-yearend-20260918/spotlog-schedule-before-yearend.html)을 보존한다. 과거의 AI·RAG 5주·앱 연결 4주·02/02 첫 오픈 목표보다 이 변경안을 우선한다. 파일명은 기존 문서 링크 보존을 위해 유지한다.

이번 작업은 일정 문서와 로컬 HTML 수정이다. 제품 코드 수정·Git 커밋·푸시·공개 배포는 포함하지 않는다.
`;
fs.writeFileSync(path.join(root,'docs/execution/FIRST_RELEASE_20_WEEK_BASELINE.md'),baseline,'utf8');

function replaceParagraph(file,prefix,replacement) {
  const target=path.join(root,file);
  const text=fs.readFileSync(target,'utf8');
  const lines=text.split(/\r?\n/);
  const i=lines.findIndex(l=>l.startsWith(prefix));
  assert.notEqual(i,-1,`Missing paragraph in ${file}`);
  lines[i]=replacement;
  fs.writeFileSync(target,lines.join('\n'),'utf8');
}
replaceParagraph('AGENTS.md','Schedule recall:', 'Schedule recall: when the user asks for this project’s schedule, read `docs/execution/FIRST_RELEASE_20_WEEK_BASELINE.md` and show its six-row table unchanged. Latest user revision (2026-09-18): frontend phases 1/2/3 remain fixed at 2026-09-15~09-29, 09-30~10-13, 10-14~10-27; backend 5 weeks (10-28~12-01); AI/RAG 4 weeks (12-02~12-29); testing and travel-data collection for January 2027 (01-01~01-31). December 30~31 is year-end handoff; February 2 is the final Tuesday report, not a fixed launch date. January includes server/AI/app integration tests and store submission preparation. The latest request supersedes the older AI/RAG 5-week requirement. Do not substitute holiday-adjusted or older schedules without a user request. Keep the table feature-focused without separate design, implementation, or customer-review process items.');
replaceParagraph('docs/execution/HANDOFF.md','**일정 조회 규칙:**','**일정 조회 규칙:** 사용자가 “일정”이라고 하면 [최신 기준 일정](FIRST_RELEASE_20_WEEK_BASELINE.md)의 6행 표를 그대로 보여준다. 프론트 1·2·3차 날짜 고정, 백엔드 5주(10/28~12/01), AI/RAG 4주(12/02~12/29), 2027년 1월 한 달 테스트·여행 데이터 수집이다. 02/02는 최종 화요일 보고이며 공개일 확정은 아니다.');
replaceParagraph('docs/execution/HANDOFF.md','**최신 일정 보관·휴일 검토:**','**최신 일정 변경·휴일 검토:** 2026-09-18 사용자 요청으로 연내 AI 완료와 1월 테스트·여행 데이터 수집 기준으로 변경했다. [최신 일정과 세부 보고](FIRST_RELEASE_20_WEEK_BASELINE.md)를 우선한다. 12/30~12/31은 인수인계이며, 기존 앱 연결·기기 검증·스토어 제출 준비는 1월에 포함한다. 이전 20주안과 [휴일 비교](HOLIDAY_REVIEW_20_WEEK.md)는 과거 기록으로 보존하며 94일·02/12 계산을 새 일정에 재사용하지 않는다. 이번 변경은 로컬 일정 문서이며 제품 수정·커밋·푸시·배포를 포함하지 않는다.');
replaceParagraph('docs/execution/README.md','**사용자 선택 기준:**','**사용자 선택 기준:** 사용자가 “일정”이라고 하면 [최신 기준 일정의 6행 표](FIRST_RELEASE_20_WEEK_BASELINE.md)를 보여준다. 2026-09-18 변경 기준은 프론트 일정 고정, 백엔드 5주, AI/RAG 4주로 12/29 개발 완료, 2027년 1월 한 달 테스트·여행 데이터 수집이다.');
replaceParagraph('docs/execution/README.md','[현재 20주 보관안]','[최신 기준 일정](FIRST_RELEASE_20_WEEK_BASELINE.md)은 12/30~12/31 인수인계 후 01/01~01/31 테스트·여행 데이터 수집, 02/02 화요일 최종 보고로 이어진다. 서버/AI/앱 연결 검증과 스토어 제출 준비를 1월에 포함하며 실제 공개일은 테스트와 승인 결과에 따른다. [휴일 비교](HOLIDAY_REVIEW_20_WEEK.md)와 [24주 일정](FIRST_RELEASE_24_WEEK_PLAN.md)은 이전 산정이다.');
replaceParagraph('docs/execution/README.md','아래 최초 차수별 날짜','아래 최초 차수별 날짜와 기존 Excel, [이전 화요일 보고안](TUESDAY_CLIENT_REVIEW_SCHEDULE.md), [이전 병행 일정](COLLABORATIVE_DELIVERY_PLAN.md), [43주 순차안](SEQUENTIAL_DELIVERY_PLAN.md)은 이전 산정이다. 기존 기능 지침은 보존하고 날짜는 위 최신 기준 일정에서 확인한다.');
const handoffPath=path.join(root,'docs/handoff/CURRENT_HANDOFF.md');
const handoff=fs.readFileSync(handoffPath,'utf8');
const note='**2026-09-18 최신 — 연내 AI 완료 일정 변경:** 최신 사용자 정정에 따라 프론트 6주 날짜 고정, 백엔드 5주(10/28~12/01), AI/RAG 4주(12/02~12/29), 2027년 1월 한 달 테스트·여행 데이터 수집으로 변경했다. 기존 AI/RAG 5주 조건을 대체한다. 12/30~12/31 인수인계, 01/31 작업 종료, 02/02 화요일 최종 보고이며 공개일 확정이 아니다. 앱 연결·기기 검증·스토어 제출 준비는 1월에 포함한다. [최신 6단계·20회 보고 일정](../execution/FIRST_RELEASE_20_WEEK_BASELINE.md) 및 [HTML 일정표](../../deliverables/spotlog-schedule-20260918.html)에 반영했다. 이전 HTML·기준표는 `artifacts/schedule-yearend-20260918/`에 보존했다. 제품 기능 변경·커밋·푸시·배포 없음. 아래 20주/5주 유지/02/02 오픈 기록은 과거 이력이다.';
if (!handoff.includes(note)) fs.writeFileSync(handoffPath,handoff.replace(/\r?\n/,`\n\n${note}\n`),'utf8');
fs.writeFileSync(path.join(archive,'schedule-data.json'),JSON.stringify({phases,weeks},null,2),'utf8');
console.log(JSON.stringify({slides:9,phases:phases.length,reports:weeks.length,frontendUnchanged:true,allReportsTuesday:true,output:htmlPath},null,2));
