/* Real local-admin screenshots in an isolated browser context. No user profile is read. */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const out = __dirname;
const assets = path.join(out, 'assets');
fs.mkdirSync(assets, { recursive: true });
const pages = [];
const W = 1440, H = 1000;
let page;
const button = name => page.getByRole('button', { name }).filter({ visible: true }).first();
const heading = name => page.getByRole('heading', { name, exact: true }).filter({ visible: true }).first();
const field = name => page.getByLabel(name, { exact: true }).filter({ visible: true }).first();
const text = value => page.getByText(value, { exact: true }).filter({ visible: true }).first();
const panel = name => page.locator('.admin-panel:visible').filter({ has: heading(name) }).first();
const menu = async name => { await page.getByRole('navigation', { name: '관리자 메뉴' }).getByRole('button', { name, exact: true }).click(); await page.locator('#admin-main').evaluate(e => e.scrollTop = 0); await page.waitForTimeout(180); };
const tab = async name => { await page.getByRole('tab', { name, exact: true }).filter({ visible: true }).click(); await page.locator('#admin-main').evaluate(e => e.scrollTop = 0); await page.waitForTimeout(180); };
const select = async (name, option) => { await page.getByRole('combobox', { name, exact: true }).filter({ visible: true }).click(); await page.getByRole('option', { name: option, exact: true }).click(); };
const resetTop = async () => page.locator('#admin-main').evaluate(e => e.scrollTop = 0);
const scroll = async n => { await page.locator('#admin-main').evaluate((e,n) => e.scrollTop=n, n); await page.waitForTimeout(150); };
function c(label, locator, what, how, result, note) { return { label, locator, what, how, result, ...(note ? { note } : {}) }; }
async function capture(info, controls) {
  await page.waitForTimeout(180);
  const boxes = await Promise.all(controls.map(item=>item.locator.boundingBox()));
  const minY = Math.min(...boxes.map(box=>box?.y??Infinity));
  const maxY = Math.max(...boxes.map(box=>(box?.y??0)+Math.min(box?.height??0,20)));
  if (maxY > H-20 && maxY-minY < H-120) {
    await page.locator('#admin-main').evaluate((e,delta)=>e.scrollTop+=delta,maxY-(H-35));
    await page.waitForTimeout(100);
  }
  const callouts = [];
  for (const [i,item] of controls.entries()) {
    const box = await item.locator.boundingBox();
    if (!box || box.y < 71 || box.y+Math.min(box.height,20)>H || box.x < 0 || box.x > W) throw new Error(info.id+' offscreen callout '+item.label+' '+JSON.stringify(box));
    const { locator, ...copy } = item;
    callouts.push({ n: i+1, ...copy, x: +(Math.max(9,box.x+8)/W*100).toFixed(2), y: +((box.y+Math.min(14,box.height/2))/H*100).toFixed(2) });
  }
  const image = 'assets/technical-'+info.id+'.png';
  await page.screenshot({ path:path.join(out,image), animations:'disabled' });
  pages.push({ ...info, image, width:W,height:H,callouts });
  fs.writeFileSync(path.join(out,'technical-pages.json'),JSON.stringify(pages,null,2)+'\n','utf8');
  console.log('captured',info.id,controls.length);
}
async function main() {
  const browser = await chromium.launch({channel:'msedge',headless:true});
  const context = await browser.newContext({viewport:{width:W,height:H},deviceScaleFactor:1,locale:'ko-KR',timezoneId:'Asia/Seoul'});
  page = await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5210/admin.html');
  await page.getByRole('heading',{name:'운영 현황',exact:true}).waitFor();
  await menu('AI·검색 운영');
  await capture({id:'ai-documents',menu:'ai',title:'검색 자료 — AI가 사용할 장소 설명 확인',path:'AI·검색 운영 → 검색 자료',purpose:'공개한 장소 설명 중 AI 검색에 사용할 수 있는 자료를 확인하는 화면',steps:['장소·지역·태그로 자료 검색','반영 필요 표시가 있으면 재색인 대기에 추가','내용이 틀리면 장소에서 수정 → AI 자료에서 설명·출처 수정 후 공개'],notes:['RAG는 승인된 설명을 찾아 AI에 전달하는 검색 자료. 주소·좌표·영업 상태의 원본은 장소 DB가 기준.','공개·좌표 확인·영업 상태·AI 사용 허용·출처 확인을 통과한 자료만 사용.','화면의 검수용 장소는 사용법을 보여주는 가상 자료. 실제 여행 추천 자료와 구분.']},[
    c('검색할 장소·지역·태그',field('장소·지역·태그 검색'),'필요한 장소 설명 찾기','장소명·지역·태그·장소 ID 입력','조건에 맞는 승인 자료만 표시'),
    c('반영 상태',field('반영 상태'),'검색에 아직 반영되지 않은 자료 찾기','색인 반영 필요 선택','반영할 설명만 목록에 남음'),
    c('승인 설명과 출처',page.locator('.admin-list-row:visible').first(),'AI가 읽을 공개 설명 확인','소개·태그·원문 버전·출처 확인','현재 공개한 설명과 사용 근거 확인'),
    c('장소에서 수정',button('장소에서 수정'),'내용·출처 수정 위치','누른 뒤 장소 상세의 AI 자료 탭 사용','장소 편집으로 이동'),
    c('재색인 대기',button('재색인 대기'),'변경된 설명을 검색 자료에 반영하도록 작업 등록','대상 장소의 재색인 대기 누름','색인 작업 목록에 문서 갱신 작업 추가','대기 등록은 실제 임베딩 실행 완료와 다름.'),
    c('색인 작업 보기',button('색인 작업 보기'),'검색 자료 반영 작업으로 이동','반영해야 할 자료를 확인한 뒤 누름','색인 작업 탭으로 이동')
  ]);
  await tab('색인 작업');
  await button('전체 재구성 대기').click();
  await button('실행 시작').click();
  await button('실행 완료 단계').click();
  await button('자료·사용권 검증').click();
  await scroll(160);
  await capture({id:'ai-indices',menu:'ai',title:'색인 작업 — 새 검색 자료 준비·검증·적용',path:'AI·검색 운영 → 색인 작업',purpose:'설명 자료를 검색 가능한 목록으로 만들고, 검증한 버전만 적용하는 화면',steps:['임베딩 연결 이름 확인 후 전체 재구성 대기','작업 상태 확인 → 실행 시작 → 실행 완료 단계 → 자료·사용권 검증','검증 완료 버전을 최고관리자가 적용','문제 발생 시 실패 작업 재시도 또는 이전 정상 버전 복구'],notes:['색인 = AI가 설명을 쉽게 찾도록 준비한 검색 자료 묶음. 임베딩 = 설명을 의미 검색용 숫자로 바꾸는 AI.','새 자료 준비 중에도 현재 적용 버전은 유지. 검증 완료는 적용 완료와 다름.','이 화면은 로컬 작업 단계 검수 기록. 맥미니·임베딩 AI에 실제 요청한 결과가 아님.','운영자는 자료 준비·검증 가능. 적용·이전 버전 복구는 최고관리자만 가능.']},[
    c('임베딩 연결 이름',field('임베딩 연결 이름'),'사용할 의미 검색 AI 연결 구분','서버에 등록한 연결 이름 입력','해당 이름으로 새 후보 자료 준비','API 키·비밀번호 입력란이 아님.'),
    c('전체 재구성 대기',button('전체 재구성 대기'),'공개 승인 자료 전체를 새로 준비','연결 이름 확인 후 누름','대기 작업 추가'),
    c('작업 상태',field('색인 작업 상태'),'대기·실행·실패 작업 찾기','원하는 상태 선택','해당 상태 작업만 표시'),
    c('작업별 진행 상태',page.locator('.admin-panel:visible').filter({has:heading('작업 목록')}).locator('.admin-list-row').first(),'실행 단계와 오류 확인','작업 ID·시도 횟수·상태 확인','다음 단계 또는 재시도 대상 판단','대기: 실행 시작. 실패: 현재 자료로 재시도. 검증 대기: 자료·사용권 검증.'),
    c('검증한 버전 적용',button('적용'),'준비한 자료를 현재 검색 버전으로 전환','검증 완료·오류 없음 확인 후 적용','현재 적용 버전 교체','최고관리자 전용. 검증 뒤 원본이 바뀌면 재준비 필요.'),
    c('현재 적용·이전 정상 버전',heading('색인 버전'),'사용 중인 자료와 복구 후보 확인','버전 상태·자료 수 확인','현재 검색 대상과 이전 정상 자료 구분','이전 정상 버전에 이전 버전 복구 버튼 표시. 복구해도 철회·폐업 자료는 제외.')
  ]);
  await button('적용').click();
  await tab('품질 시험');
  await field('지역').fill('부산');
  await button('시험 조건 저장').click();
  await scroll(160);
  await capture({id:'ai-tests',menu:'ai',title:'품질 시험 — 추천이 맞는지 확인할 문장 준비',path:'AI·검색 운영 → 품질 시험',purpose:'운영자가 만든 예시 문장으로 조건 해석·추천·수정 규칙을 확인하는 화면',steps:['기존 시험을 선택하거나 새 시험 클릭','시험 문장·기능·지역·기간·식사·숙박 조건 입력','정답으로 나와야 할 장소가 있으면 장소 ID 입력','시험 조건 저장 후 아래 실행·버전 비교에서 시험 실행'],notes:['시험 문장은 운영자가 작성한 예시. 고객 입력문·대화 내용은 자동 수집하지 않음.','시험 실행은 고객의 내 여행에 저장하지 않음.','현재 로컬 실행은 조건·자료 검수. 실제 AI 모델의 응답 품질·속도를 측정한 결과가 아님.','고객 챗봇은 후속 단계. 대화 시험과 실제 고객 챗봇 개통은 별개.']},[
    c('기존 시험 선택',button('간단 생성 · 식사 순서'),'확인할 시험 선택','목록에서 시험 클릭','오른쪽에 시험 조건 표시'),
    c('새 시험',button('새 시험'),'새로운 검수 사례 만들기','새 시험 클릭','빈 조건 편집 표시'),
    c('시험 이름·문장',field('시험 문장'),'어떤 요청을 확인할지 작성','실제 개인정보 없이 여행 요청 예시 입력','이 문장을 기준으로 시험 준비'),
    c('시험 기능·지역·기간',field('시험 기능'),'간단 생성·저장 장소 추천·부분 수정·안내 선택','기능과 지역·기간 선택','선택한 기능 조건으로 검수'),
    c('오류 시나리오',field('오류 시나리오'),'오류 시에도 안전하게 처리하는지 확인','정상·근거 부족·연결 장애 등 선택','해당 오류를 가정한 규칙 확인'),
    c('기대 장소 ID',field('기대 장소 ID · 쉼표로 구분'),'결과에 포함되어야 할 장소 지정','공용 장소 ID를 쉼표로 구분해 입력','장소 누락 여부 비교'),
    c('시험 조건 저장',button('시험 조건 저장'),'입력한 시험 문장을 저장','조건 입력을 마치고 클릭','시험 실행 가능한 저장본 생성','수정 중인 조건은 먼저 저장해야 실행 가능.')
  ]);
  await button('시험 실행').click();
  await scroll(710);
  await capture({id:'ai-test-results',menu:'ai',title:'품질 시험 결과 — 통과 항목·오답 기록',path:'AI·검색 운영 → 품질 시험 → 아래 실행·버전 비교',purpose:'준비한 시험을 실행하고 검수 결과와 개선할 점을 기록하는 화면',steps:['정책 버전과 색인 버전 선택 → 시험 실행','시험 결과에서 근거·식사 순서·예약 보호 등 확인','이전 결과가 있으면 선택해 버전별 비교','오류 유형과 평가 내용 입력 → 평가 등록'],notes:['조건 통과는 로컬 검수 규칙 통과. 실제 외부·소형 모델 응답 성공을 뜻하지 않음.','근거 부족·연결 장애를 외부 대형 모델로 우회하지 않음.','시험 결과와 평가 기록은 고객 여행을 자동으로 수정하지 않음.']},[
    c('실행할 정책 버전',field('정책 버전'),'어떤 실행 규칙을 시험할지 선택','시험할 버전 선택','해당 정책을 기준으로 시험'),
    c('검색 자료 버전',field('색인 버전'),'어떤 자료 묶음을 사용할지 선택','현재 적용 또는 검증한 버전 선택','선택 자료로 결과 검수'),
    c('시험 실행',button('시험 실행'),'저장된 조건 검수 실행','조건 저장 후 클릭','시험 결과·요청 요약 생성'),
    c('이전 결과 비교',field('비교할 이전 결과'),'버전 변경 전후 차이 확인','같은 시험의 이전 결과 선택','두 결과를 나란히 비교'),
    c('통과·확인 필요 항목',page.locator('.admin-panel:visible').filter({has:page.getByRole('heading',{name:/시험 결과/})}).first(),'근거·순서·고정 예약 등 항목별 확인','각 항목의 통과 여부와 설명 읽기','개선해야 할 항목 찾기')
  ]);
  await heading('오답·평가 기록').scrollIntoViewIfNeeded();
  await capture({id:'ai-result-feedback',menu:'ai',title:'오답·평가 기록 — 틀린 결과를 개선 과제로 남기기',path:'AI·검색 운영 → 품질 시험 → 아래 오답·평가 기록',purpose:'추천 결과의 장소·방문 순서·부분 수정 오류를 운영 평가로 남기는 화면',steps:['시험 결과의 방문 순서와 공용 근거 확인','오류 유형 선택 → 어떤 결과가 틀렸는지 평가 내용 작성','평가 등록 → 보완 후 처리 완료로 관리'],notes:['공용 근거 버튼은 결과에 쓰인 장소 자료로 이동. 없는 업체를 만들어 넣는 기능이 아님.','오답 등록은 운영 평가 기록. 실제 모델 학습을 자동 실행하지 않음.','고객 요청문·대화 원문을 평가집에 붙여 넣지 않고 운영자가 재작성한 예시 사용.']},[
    c('평가 기록 영역',heading('오답·평가 기록'),'개선할 점을 모으는 곳','시험 결과를 확인한 뒤 아래로 이동','오류별 운영 평가 준비'),
    c('오류 유형',field('오류 유형'),'장소 누락·방문 순서·근거 오류 구분','결과에 맞는 유형 선택','개선할 문제의 종류 기록'),
    c('평가 내용',field('평가 내용'),'어떤 결과가 어떻게 틀렸는지 작성','짧고 구체적으로 보완할 내용 입력','개선 담당자가 이해할 근거 기록'),
    c('평가 등록',button('평가 등록'),'현재 결과에 평가 저장','유형·내용 확인 후 클릭','해당 시험의 평가 목록에 추가','등록된 미처리 평가에는 처리 완료 버튼 표시.'),
    c('챗봇은 후속 연결',heading('후속 챗봇 연결'),'실제 고객 챗봇과 대화 시험 구분','현재 상태와 대화 시험 선택 확인','간단 생성과 같은 계약을 쓸 후속 범위 확인')
  ]);
  await tab('요청 현황');
  await page.locator('.admin-panel:visible').filter({has:heading('요청 처리 요약')}).locator('button.admin-list-row').first().click();
  await scroll(120);
  await capture({id:'ai-requests',menu:'ai',title:'요청 현황 — 실패 단계·속도·비용 요약',path:'AI·검색 운영 → 요청 현황',purpose:'AI 요청이 어디에서 실패했는지 요약 기록으로 확인하는 화면',steps:['요청 ID·채널·상태로 목록 좁히기','요청을 눌러 실패 단계·정책·자료 버전 확인','공용 근거로 장소 자료 확인 또는 오류 시험집 확인'],notes:['고객 요청문·개인 일정·대화 원문은 기본 목록에 제공하지 않음.','시험 기록과 실제 서비스 요청을 구분. 실측 없는 응답 시간·비용은 실측 없음 표시.']},[
    c('요청 ID 검색',field('요청 ID 검색'),'문제가 생긴 특정 실행 찾기','요청 ID 입력','일치하는 요청 표시'),
    c('기능별 보기',field('채널'),'간단 생성·부분 수정 등 기능 구분','확인할 채널 선택','해당 기능 요청만 표시'),
    c('성공·실패·대기',field('상태'),'문제 요청 우선 찾기','실패 선택','실패 요청으로 목록 축소'),
    c('요청 선택',page.locator('.admin-panel:visible').filter({has:heading('요청 처리 요약')}).locator('button.admin-list-row').first(),'실행 요약 상세 열기','목록의 요청 클릭','아래 선택한 요청 요약 표시'),
    c('실패·보완 판단',heading('선택한 요청 요약'),'실패 원인과 사용 버전 확인','오류·실패 단계·정책·자료·외부 보완 사유 읽기','자료 보완 또는 AI 규칙 수정 판단'),
    c('오류 시험집 확인',button('오류 시험집 확인'),'비슷한 오류를 시험으로 재현','버전과 오류 확인 후 클릭','품질 시험으로 이동')
  ]);
  await tab('실행 정책');
  await capture({id:'ai-policies',menu:'ai',title:'실행 정책 — 어떤 AI를 어디에 사용할지 설정',path:'AI·검색 운영 → 실행 정책',purpose:'AI 모델 연결 이름·사용 기능·지역·외부 보완 한도를 관리하는 화면',steps:['정책 버전 선택','소형·임베딩·Flowise·외부 대형 연결 이름 입력','사용 지역·기능과 외부 보완 허용 여부 확인','아래 시간·비용 한도 설정 후 새 정책 초안 저장'],notes:['정책 = 어떤 모델을 어떤 조건에서 사용할지 정한 실행 규칙. 연결 이름 = 서버에 준비한 모델 설정의 이름.','연결 이름을 입력해도 모델 설치·연결이 완료되는 것은 아님. 실제 상태는 운영 설정·이력 → 연결·수급에서 확인.','API 키·DB 비밀번호는 서버에서 관리. 화면에 입력하지 않음.','정책 수정은 최고관리자만 가능. 운영자는 조회·시험 가능.']},[
    c('정책 버전 목록',page.locator('.admin-panel:visible').filter({has:heading('정책 버전')}).locator('button').first(),'현재 정책과 수정 초안 구분','확인할 버전 클릭','오른쪽에 해당 설정 표시'),
    c('정책 이름',field('정책 이름'),'실행 규칙의 목적 구분','식별하기 쉬운 이름 입력','정책 목록에 이름 표시'),
    c('소형 로컬 모델',field('소형 로컬 모델 연결 이름'),'기본 해석·설명용 모델 지정','서버의 모델 연결 이름 입력','기본 처리 모델 설정'),
    c('임베딩 모델',field('임베딩 모델 연결 이름'),'의미 검색용 AI 지정','서버의 임베딩 연결 이름 입력','검색 자료 준비에 사용할 모델 설정'),
    c('Flowise·외부 대형',field('Flowise 연결 이름'),'내부 실행 도구와 예외 보완 모델 지정','준비한 연결 이름 입력','각 역할에 맞는 연결 설정'),
    c('사용 지역·기능',field('사용 지역 · 쉼표 구분'),'어디서 어떤 기능을 실행할지 선택','지역 입력 후 간단 생성·추천·수정·안내 체크','선택 범위에만 정책 적용'),
    c('외부 보완 허용',field('근거가 충분한 소형 모델 실패에 외부 보완 허용'),'소형 모델 실패 시 외부 보완 여부','필요한 경우 체크 후 아래 한도 설정','조건이 맞는 모델 실패에만 보완 가능','자료 부족·지도·DB·맥미니 장애는 외부 보완 대상 아님.')
  ]);
  await scroll(360);
  await capture({id:'ai-policy-actions',menu:'ai',title:'정책 한도·적용 — 초안부터 검증 후 사용',path:'AI·검색 운영 → 실행 정책 → 아래 한도·저장',purpose:'외부 비용과 시간을 제한하고 확인한 정책만 활성화하는 화면',steps:['외부 보완 횟수·시간·비용 한도 입력','새 정책 초안 저장 → 목록에서 생성된 초안 선택','규칙 검증 → 검수 정책 적용','이전 정상 정책을 선택하면 이전 정책 복구 가능'],notes:['시간은 ms 단위. 30,000ms = 30초. 비용 상한은 요청 한 건의 외부 비용 한도.','외부 보완은 요청 전체 최대 1회. 한도가 없으면 외부 호출 정책 활성화 불가.','저장만으로 현재 정책이 바뀌지 않음. 검증·적용해야 전환.','실제 AI 연결·응답 시험 결과와 화면의 규칙 검증을 구분.','새 정책과 같은 임베딩 연결 이름의 후보 색인을 먼저 검증·적용. 정책 복구도 현재 적용 색인과 같은 임베딩 연결 이름이 필요.']},[
    c('외부 보완 횟수',field('요청 전체 외부 보완 한도 · 최대 1회'),'한 요청에서 사용할 외부 AI 횟수 제한','0 또는 1 입력','반복 외부 호출 방지'),
    c('시간 제한',field('시간 제한 · ms'),'외부 처리 대기 시간 제한','ms 단위 입력','시간 초과로 지연되는 요청 제한'),
    c('외부 비용 상한',field('요청 외부 비용 상한 · 원'),'요청 한 건의 외부 비용 제한','원 단위 상한 입력','지정 비용을 넘는 외부 보완 차단'),
    c('새 정책 초안 저장',button('새 정책 초안 저장'),'현재 정책을 유지하면서 수정본 저장','값 확인 후 클릭','새 초안 버전 생성','생성된 초안 선택 후 규칙 검증. 검증 완료 후 검수 정책 적용 버튼 표시.'),
    c('기본 실행 원칙',heading('실행 원칙'),'모델별 역할과 외부 보완 금지 조건 확인','소형·RAG·Flowise·외부 보완 역할 읽기','잘못된 우회 설정 방지')
  ]);
  await button('새 정책 초안 저장').click();
  await page.getByRole('button',{name:/v2 · 소형 LLM 우선/}).filter({visible:true}).click();
  await button('규칙 검증').click();
  await scroll(360);
  await capture({id:'ai-policy-activation',menu:'ai',title:'검수 정책 적용 — 확인한 새 버전으로 전환',path:'AI·검색 운영 → 실행 정책 → 새 초안 선택 → 규칙 검증',purpose:'저장한 새 정책을 검증하고 현재 적용 정책으로 전환하는 화면',steps:['목록에서 새 초안 선택','규칙 검증을 눌러 필수 연결 이름·한도 확인','규칙 검수 완료 상태와 입력값 확인 → 검수 정책 적용','문제가 생기면 이전 정상 정책을 선택 → 이전 정책 복구'],notes:['규칙 검증은 필수값·허용 범위 검사. 모델에 실제 요청해 품질을 측정한 시험과 별개.','현재 화면의 새 초안은 사용 설명을 위한 격리된 로컬 검수 사례. 실제 고객 정책을 바꾸지 않음.','정책 적용·복구는 최고관리자만 가능. 수정 중인 값은 먼저 저장해야 함.','새 정책과 같은 임베딩 연결 이름의 후보 색인을 먼저 검증·적용. 정책 복구도 현재 적용 색인과 같은 임베딩 연결 이름이 필요.']},[
    c('보완 횟수 재확인',field('요청 전체 외부 보완 한도 · 최대 1회'),'새 정책의 요청당 외부 호출 제한 확인','0 또는 1인지 확인','반복 외부 호출 방지'),
    c('시간·비용 한도 확인',field('시간 제한 · ms'),'실행 전에 중단 기준 확인','시간 제한·비용 상한 확인','지연·비용 무제한 정책 적용 방지'),
    c('수정은 새 초안 저장',button('새 정책 초안 저장'),'확인한 정책을 다시 바꿀 때 새 버전 생성','수정한 값은 새 정책 초안 저장','현재 정책을 유지하고 별도 초안 생성'),
    c('규칙 검증',button('규칙 검증'),'필수 연결 이름·지역·한도 검사','저장한 조건을 확인한 뒤 누름','규칙 검수 완료 또는 오류 표시'),
    c('검수 정책 적용',button('검수 정책 적용'),'검증한 새 정책 활성화','규칙 검수 완료 확인 후 클릭','현재 적용 버전 전환과 이력 기록','버전 목록에서 이전 정상 정책 선택 시 이전 정책 복구 가능.')
  ]);
  await menu('운영 설정·이력');
  await button('랜드마크').click();
  await capture({id:'settings-references',menu:'settings',title:'분류·운영 기준 — 태그·영문 용어·서비스 안내',path:'운영 설정·이력 → 분류·운영 기준',purpose:'공통 분류·태그·용어·등급·서비스 안내 기준을 관리하는 화면',steps:['기준 종류에서 관리할 항목 선택','기존 항목 선택 또는 새 항목','이름·기준값·사용 여부 입력 → 기준 저장'],notes:['지역은 이곳의 중복 목록이 아닌 장소·업체 → 지역 설정에서 관리.','분류 기준의 이름만 수정해도 기존 자료의 장소 ID·좌표가 자동 변경되지 않음.','사용 기준과 초안을 구분. 변경은 버전과 이력으로 기록.']},[
    c('기준 종류',field('기준 종류'),'분류·태그·영문 용어·등급·서비스 안내 선택','원하는 종류 선택','해당 기준 목록 표시'),
    c('기존 기준 선택',button('랜드마크'),'저장된 기준 열기','목록 항목 클릭','오른쪽 편집 영역에 표시'),
    c('새 항목',button('새 항목'),'공통 기준 추가','종류 선택 후 새 항목 클릭','빈 편집 영역 표시'),
    c('이름·기준값',field('기준값·설명'),'이름과 실제 기준값 관리','이름·기준값·설명 입력','저장할 기준 내용 준비'),
    c('사용 여부',field('사용 여부'),'초안 보관과 사용 구분','초안 또는 사용 선택','사용할 기준인지 구분'),
    c('기준 저장',button('기준 저장'),'공통 기준 변경 저장','입력 내용 확인 후 클릭','새 버전과 변경 이력 생성')
  ]);
  await select('기준 종류','등급 기준');
  await button('등급 기준 검수 초안').click();
  await capture({id:'settings-grades',menu:'settings',title:'등급 기준 — 담김 횟수에 맞춰 등급 설정',path:'운영 설정·이력 → 분류·운영 기준 → 등급 기준',purpose:'공개 여행 담김 횟수에 적용할 회원 등급 단계 관리',steps:['등급 기준 선택','각 단계의 최소 담김 횟수·등급명·짧은 이름·아이콘 입력','필요하면 단계 추가·제외·순서 변경','먼저 초안 저장 → 확인을 마치고 사용 전환'],notes:['담김 횟수는 실제 서버 집계값. 운영자가 인기 숫자 자체를 임의 입력하는 기능이 아님.','첫 단계는 0부터, 이후 최소 횟수는 오름차순. 같은 횟수·이름 중복은 확인 필요.','사용 중인 등급 기준은 하나. 현재 사용 기준을 중지한 뒤 다른 기준 적용.']},[
    c('기준 종류 — 등급 기준',field('기준 종류'),'회원 등급 관리로 전환','등급 기준 선택','단계별 편집 화면 표시'),
    c('등급 기준 목록',button('등급 기준 검수 초안'),'검수할 등급표 선택','기존 등급 기준 클릭','오른쪽에 단계 표시'),
    c('최소 담김 횟수',field('1단계 담김 횟수'),'해당 등급이 시작하는 횟수','단계별 최소 횟수 입력','서버 집계 횟수에 맞춰 등급 판단'),
    c('등급명·짧은 이름',field('1단계 등급명'),'프로필·댓글에 보여줄 이름','정식 이름과 짧은 이름 입력','공개 프로필·댓글 표시 기준 준비'),
    c('등급 아이콘',field('1단계 아이콘'),'등급과 함께 보이는 그림 선택','새싹·메달·별 등 아이콘 선택','등급별 시각 구분'),
    c('단계 이동·제외',button('1단계 아래로 이동'),'등급 단계를 정리','↑·↓로 순서 변경, ×로 해당 단계 제외','편집 중인 단계 배열 변경','하단 등급 단계 추가 버튼으로 최대 10단계 구성.')
  ]);
  await tab('운영자·권한');
  await text('운영자 추가').click();
  await capture({id:'settings-operators',menu:'settings',title:'운영자·권한 — 담당자 계정과 역할 관리',path:'운영 설정·이력 → 운영자·권한',purpose:'관리자를 추가하고 역할·접속 세션을 관리하는 화면',steps:['운영자 추가 펼치기 → ID·이름·역할 입력 → 등록','기존 운영자의 역할 변경 필요 여부 확인','접속을 중단해야 하면 대상 세션 종료'],notes:['운영자: 자료 등록·공개·신고·회원 조치·시험. 최고관리자: 운영자·연결·비용·정책·색인 적용·복구·정리까지 관리.','마지막 활성 최고관리자는 운영자로 낮출 수 없음.','상단 역할 전환은 로컬 검수용. 실제 서비스 권한은 서버가 검사.','현재 세션 종료는 로컬 처리 기록. 실제 서버 인증 세션 종료 연결은 별도 필요.']},[
    c('운영자 추가',text('운영자 추가'),'새 담당자 등록 양식 열기','펼친 후 계정 정보 입력','신규 운영자 등록 준비'),
    c('운영자 ID·이름',field('운영자 ID'),'고유 계정과 표시 이름 설정','중복되지 않는 ID와 이름 입력','운영자 식별 정보 준비'),
    c('역할 선택',field('역할'),'일반 운영자와 최고관리자 구분','필요한 권한 수준 선택','선택 역할로 계정 생성'),
    c('운영자 등록',button('운영자 등록'),'입력한 담당자 추가','입력 확인 후 클릭','운영자 목록에 추가'),
    c('기존 계정 역할 변경',button('최고관리자로 변경'),'기존 담당자의 권한 변경','권한 변경이 필요할 때만 클릭','계정 역할 변경과 이력 생성','마지막 최고관리자는 유지.'),
    c('세션 종료',button('세션 종료'),'특정 접속 상태 종료','대상 계정과 세션 ID 확인 후 클릭','선택 세션 종료 상태 기록','다른 운영자의 접속을 끊는 동작이므로 대상 확인 필요.')
  ]);
  await tab('알림');
  await capture({id:'settings-notifications',menu:'settings',title:'알림 — 안내문 양식과 실패 기록 확인',path:'운영 설정·이력 → 알림',purpose:'발송할 안내문 양식을 관리하고 실패·수신 거부·중복 상태를 확인하는 화면',steps:['편집할 템플릿 선택','제목·본문·사용 여부 확인 → 템플릿 저장','아래 실패 항목의 상태 확인 → 재시도 조건 검수'],notes:['템플릿 = 반복해서 사용할 안내문 양식. 저장 버튼은 발송 버튼이 아님.','현재 재시도 조건 검수는 발송 가능 조건 확인 기록. 실제 알림 전송 성공으로 표시하지 않음.','수신 거부·중복 요청은 재시도 불가.']},[
    c('편집할 안내문 양식',field('편집할 템플릿'),'어떤 알림을 수정할지 선택','템플릿 선택','저장된 안내문 표시'),
    c('제목·본문',field('본문'),'발송할 안내 내용 작성','제목과 본문 편집','새 템플릿 내용 준비'),
    c('템플릿 사용',field('템플릿 사용'),'안내 양식 사용·중지','사용 또는 중지 선택','발송 가능 양식 구분'),
    c('템플릿 저장',button('템플릿 저장'),'안내문 변경 저장','내용 확인 후 클릭','템플릿 버전 갱신','저장 즉시 이메일·알림이 발송되지 않음.'),
    c('실패·수신 거부·중복',heading('발송 실패·수신 거부·중복'),'발송 불가 이유 확인','상태·시도 횟수·오류 확인','재시도 가능한 실패와 금지 항목 구분'),
    c('재시도 조건 검수',button('재시도 조건 검수'),'실패한 알림의 재시도 가능성 확인','수신 거부·중복 여부 확인 후 클릭','재시도 조건 검수 완료로 기록','실제 발송 완료와 다름.')
  ]);
  await tab('연결·수급');
  await capture({id:'settings-connections',menu:'settings',title:'연결·수급 — 지도·DB·AI 연결 상태 확인',path:'운영 설정·이력 → 연결·수급',purpose:'서버가 제공한 연결 상태와 확인한 사용 한도를 보는 화면',steps:['필요한 서비스의 설정 여부·연결 상태·확인 시각 확인','계약·설정에서 확인한 한도가 있으면 숫자 입력','한도 검수 저장 → 기록 확인','아래 데이터 수급 작업에서 가져오기 실패 확인'],notes:['미연결 = 아직 실제 서비스가 연결되지 않은 상태. 화면에 표시된다고 현재 기능이 실제로 연결된 것은 아님.','설정 있음과 연결됨은 다른 의미. 응답 상태·확인 시각까지 확인.','한도 검수 저장은 확인한 한도를 기록하는 동작. 외부 서비스 요금제·API 한도를 변경하지 않음.','API 키·비밀번호·모델 주소 입력을 이 화면에서 대신하지 않음. 실제 연결 설정은 서버 담당자와 진행.']},[
    c('설정 여부·연결 상태',page.locator('.admin-panel:visible').filter({has:heading('연결과 확인한 사용 한도')}).locator('.admin-card').first(),'지도 SDK 등 서비스 연결 확인','설정 있음/없음과 연결 상태 비교','미연결·지연·실패 구분'),
    c('확인 시각·설명',page.getByText(/확인 시각 미제공/).filter({visible:true}).first(),'언제 어떤 상태를 확인했는지 확인','확인 시각과 설명 읽기','오래된 상태인지 판단'),
    c('확인한 사용 한도',field('지도 SDK 확인 한도'),'확인한 서비스 사용 한도 기록','실제 계약·설정에서 확인한 숫자 입력','한도 기록 준비'),
    c('한도 검수 저장',button('한도 검수 저장'),'입력한 한도를 내부 기록으로 저장','최고관리자가 확인 후 저장','확인한 한도 표시와 이력 생성','실제 제공자의 한도 변경이나 연결 시험이 아님.'),
    c('다른 연결도 같은 방식',page.locator('.admin-panel:visible').filter({has:heading('연결과 확인한 사용 한도')}).locator('.admin-card').nth(1),'주소 조회·경로·파일·회원·AI 각각 확인','해당 서비스까지 아래로 내려 상태 확인','문제가 있는 연결을 개별 파악')
  ]);
  await heading('데이터 수급 작업').scrollIntoViewIfNeeded();
  await capture({id:'settings-supply',menu:'settings',title:'데이터 수급 작업 — 가져온 자료의 실패 확인',path:'운영 설정·이력 → 연결·수급 → 아래 데이터 수급 작업',purpose:'외부 자료 가져오기가 실패한 이유를 확인하고 재시도 대상 정리',steps:['작업 출처와 오류 확인','누락된 확인일·출처·사용 조건 등을 보완','실패한 작업의 재시도 검수 클릭'],notes:['재시도 검수는 다시 가져올 조건을 확인한 기록. 실제 외부 데이터 수집 완료가 아님.','자료를 가져와도 자동 공개하지 않고 초안 검수 후 공개.','개인 자료·비공개 여행을 공용 자료로 자동 편입하지 않음.']},[
    c('임베딩 AI 연결',page.locator('.admin-card:visible').filter({hasText:'임베딩 AI'}).first(),'의미 검색용 AI 연결 확인','연결 이름과 상태 비교','검색 자료를 준비할 AI가 연결됐는지 확인'),
    c('Flowise 연결',page.locator('.admin-card:visible').filter({hasText:'Flowise'}).first(),'내부 AI 실행 도구 상태 확인','설정·응답 상태·확인 시각 읽기','실행 도구 연결 여부 확인'),
    c('후속 기능 연결',text('후속 문의 범위 · 팔로우와 받은 알림함'),'현재 기능과 후속 기능 구분','필요하면 펼쳐 상태 보기','후속 범위 상태 확인'),
    c('수급 작업 오류',heading('데이터 수급 작업'),'가져오기 실패 원인 확인','출처·오류·상태 확인','보완할 자료 항목 파악'),
    c('재시도 검수',button('재시도 검수'),'실패 작업을 다시 준비할 대상 지정','오류 보완을 확인한 뒤 클릭','재시도 검수 대상으로 기록')
  ]);
  await tab('휴지통·파일 정리');
  await capture({id:'settings-cleanup',menu:'settings',title:'휴지통 — 6개월 보관·비공개 복원',path:'운영 설정·이력 → 휴지통·파일 정리',purpose:'삭제 기록의 보관 기간과 복원 가능 여부를 확인하는 화면',steps:['복원할 개인 일정 또는 여행기와 소유자 확인','삭제·만료일 확인','복원 사유 입력 → 해당 항목의 비공개 복원 클릭'],notes:['한국 시각 기준 달력 6개월 보관. 180일 고정 계산이 아님.','복원은 비공개. 여행기와 개인 일정은 각각 복원하며 자동 공개하지 않음.','만료된 항목은 복원 불가. 최고관리자만 복원·정리 검수 가능.','현재 로컬 상태 변경은 검수 기록. 실제 서버 복원·파일 정리 연결은 별도.']},[
    c('복원·정리 사유',field('복원·정리 검수 사유'),'누가 왜 복원하는지 근거 남기기','대상을 확인한 뒤 사유 입력','조치 이력에 사유 기록'),
    c('개인 일정과 여행기 구분',page.locator('.admin-panel:visible').filter({has:heading('사용자 휴지통·만료')}).locator('.admin-card').first(),'복원할 기록의 종류 확인','개인 일정/여행기와 소유자 ID 확인','다른 기록을 잘못 복원하는 일 방지'),
    c('삭제·만료일',page.getByText(/소유자 review-member-1 · 삭제/).filter({visible:true}).first(),'복원 가능 기간 확인','삭제일·만료일 읽기','달력 6개월 기준 복원 가능 여부 판단'),
    c('비공개 복원',button('비공개 복원'),'선택 기록 복원','사유 입력 후 대상의 버튼 클릭','비공개 복원 상태로 기록','사유 없음·기간 만료·이미 복원된 항목은 비활성.'),
    c('만료 항목',page.locator('.admin-card:visible').filter({hasText:'review-trash-expired'}).first(),'복원 불가 대상 확인','보관 만료 상태 확인','만료 자료 복원 차단')
  ]);
  await heading('파일 참조 확인·정리 작업').scrollIntoViewIfNeeded();
  await capture({id:'settings-file-cleanup',menu:'settings',title:'파일 정리 — 다른 여행에서 쓰는 사진 보호',path:'운영 설정·이력 → 휴지통·파일 정리 → 아래 파일 정리',purpose:'사용 중인 사진은 유지하고 참조 없는 파일만 정리 후보로 검수',steps:['먼저 위의 복원·정리 검수 사유 입력','파일 ID와 다른 기록의 참조 개수 확인','참조 없는 파일만 정리 대상 검수'],notes:['참조 = 같은 파일을 사용하는 여행·여행기 등 다른 기록의 연결.','참조가 남아 있는 사진은 정리 불가. 휴지통의 개인 일정과 여행기가 같은 파일을 함께 쓸 수 있음.','정리 대상 검수는 실제 파일 영구 삭제와 다름. 현재 파일 서버 미연결.']},[
    c('파일 참조 확인·정리 작업',heading('파일 참조 확인·정리 작업'),'사진을 안전하게 정리할 후보 확인','파일별 목록 확인','사용 중인 자료와 미사용 자료 구분'),
    c('공유 참조가 있는 파일',page.locator('.admin-card:visible').filter({hasText:'review-shared-media'}).first(),'다른 기록이 쓰는 사진 확인','참조 종류·대상 ID 확인','해당 사진 유지'),
    c('참조 없는 파일',page.locator('.admin-card:visible').filter({hasText:'review-orphan-media'}).first(),'정리 가능한 후보 확인','참조 0개와 검수 대기 상태 확인','검수할 정리 대상 구분'),
    c('정리 대상 검수',page.locator('.admin-card:visible').filter({hasText:'review-orphan-media'}).getByRole('button',{name:'정리 대상 검수'}),'참조 없는 파일을 정리 후보로 표시','위 사유 입력 후 검수 클릭','정리 대상 검수 완료 기록','최고관리자 전용. 참조가 있거나 사유가 없으면 비활성.')
  ]);
  await tab('변경·조치 이력');
  await capture({id:'settings-audit',menu:'settings',title:'변경·조치 이력 — 누가 무엇을 바꿨는지 확인',path:'운영 설정·이력 → 변경·조치 이력',purpose:'자료 공개·설정·신고 조치·AI 작업 등 변경 기록을 한곳에서 찾는 화면',steps:['운영자·대상·동작·사유로 검색','시각·담당자와 변경 전후 상태 확인','관련 메뉴에서 현재 상태 확인'],notes:['기록 조회 화면. 이력 행을 편집하거나 삭제하는 기능은 없음.','이력을 봤다고 현재 자료가 자동 복구되는 것은 아님. 복구는 해당 기능의 복구 버튼 사용.','개인 일정·메모·고객 요청 원문은 기본 이력 목록에 노출하지 않음.']},[
    c('이력 검색',page.getByPlaceholder('운영자·대상·동작·사유 검색'),'필요한 변경 기록 찾기','담당자 이름·대상 ID·동작·사유 입력','조건에 맞는 기록만 표시'),
    c('시각·운영자',page.getByRole('columnheader',{name:'시각·운영자'}),'언제 누가 바꿨는지 확인','기록의 한국 시각과 이름 확인','변경 담당자 확인'),
    c('동작·대상',page.getByRole('columnheader',{name:'동작·대상'}),'어떤 자료에서 어떤 작업을 했는지 확인','동작 이름과 대상 ID 읽기','변경 대상 확인'),
    c('변경 전 → 후',page.getByRole('columnheader',{name:'변경 전 → 후'}),'상태가 어떻게 바뀌었는지 확인','이전 상태와 결과 상태 비교','공개·중지·적용 등 변경 내용 파악'),
    c('사유',page.getByRole('columnheader',{name:'사유'}),'조치 근거 확인','등록한 사유 읽기','변경 의도와 처리 기준 확인')
  ]);
  if(errors.length) throw new Error(errors.join('\n'));
  await browser.close();
  console.log('complete',pages.length,'screens; no page errors');
}
main().catch(e=>{console.error(e);process.exit(1);});
