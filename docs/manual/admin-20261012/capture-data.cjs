/* Capture real DOM screens in an isolated browser profile. No operator profile is reused. */
const { chromium, expect } = require('C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const fs = require('node:fs'), path = require('node:path');
const out = __dirname, assets = path.join(out, 'assets'), base = 'http://127.0.0.1:5210';
fs.mkdirSync(assets, { recursive: true });
const entries = [], errors = [];
const active = page => page.locator('.admin-page-body:not([hidden])');
const places = page => active(page).locator('.admin-places-page');
const detail = page => places(page).locator('.admin-split.has-detail > .admin-panel').nth(1);
const exact = (scope, role, name) => scope.getByRole(role, {name, exact:true});
const call = (label, locator, what, how, result, note, position = 'left') => ({label, locator, what, how, result, note, position});
async function menu(page, name) {
  await exact(page.getByRole('navigation'), 'button', name).click();
  await expect(page.getByRole('heading', {name,exact:true,level:1})).toBeVisible();
  await page.locator('.admin-main').evaluate(element => { element.scrollTop = 0; });
}
async function choose(page, scope, name, value) {
  await exact(scope, 'combobox', name).click();
  await page.locator(`[role="option"][data-value="${value}"]`).click();
}
async function detailTop(page) {
  await detail(page).evaluate(element => {
    const main = document.querySelector('.admin-main');
    main.scrollTop += element.getBoundingClientRect().top - 90;
  });
}
async function align(page, locator, y=220) {
  await locator.evaluate((element,targetY)=>{document.querySelector('.admin-main').scrollTop+=element.getBoundingClientRect().top-targetY;},y);
}
async function clipFor(page, type) {
  if (type === 'detail') {
    const r = await detail(page).boundingBox();
    return { x:Math.floor(r.x-2), y:80, width:Math.min(1440-Math.floor(r.x-2),Math.ceil(r.width+4)), height:920 };
  }
  if (type === 'content') return {x:250,y:80,width:1160,height:920};
  return {x:0,y:0,width:1440,height:1000};
}
async function capture(page, metadata, calls, type='content') {
  const clip = await clipFor(page,type), image = `assets/data-${metadata.id}.png`;
  await page.evaluate(() => document.fonts.ready);
  for(const image of await page.locator('img:visible').all()) await image.evaluate(el => el.complete ? Promise.resolve() : new Promise(resolve => { el.addEventListener('load',resolve,{once:true});el.addEventListener('error',resolve,{once:true}); }));
  const callouts=[];
  for(let index=0;index<calls.length;index++) {
    const {locator,position,...data}=calls[index];
    const r = await locator.boundingBox();
    if(!r) throw new Error(metadata.id+' missing '+data.label);
    const x = position === 'right' ? r.x+r.width-7 : position === 'center' ? r.x+r.width/2 : r.x+7;
    const y = r.y+r.height/2;
    if(x<clip.x||x>clip.x+clip.width||y<clip.y||y>clip.y+clip.height) throw new Error(metadata.id+' outside '+data.label+' '+JSON.stringify({r,clip}));
    callouts.push({n:index+1,...data,x:Number(((x-clip.x)/clip.width*100).toFixed(3)),y:Number(((y-clip.y)/clip.height*100).toFixed(3))});
  }
  await page.screenshot({path:path.join(out,image),clip});
  entries.push({...metadata,image,width:clip.width,height:clip.height,callouts});
  fs.writeFileSync(path.join(out,'data-pages.json'),JSON.stringify(entries,null,2));
  console.log('CAPTURE',metadata.id,callouts.length);
}
async function openPlace(page,id) {
  await menu(page,'장소·업체');
  await exact(active(page),'tab','장소 목록').click();
  const close=exact(places(page),'button','상세 닫기'); if(await close.isVisible()) await close.click();
  const filter=places(page).locator('.admin-place-filter-panel'); if(await filter.getAttribute('open')===null) await filter.locator(':scope > summary').click();
  await places(page).getByRole('group',{name:'자료 작업 목록',exact:true}).getByRole('button',{name:'전체',exact:true}).click();
  await exact(places(page),'searchbox','장소 검색').fill(id);
  await expect(places(page).locator('.admin-place-row').first()).toBeVisible();
  await places(page).locator('.admin-place-row').first().click();
  await exact(detail(page),'tab','기본 정보').click();
  await detailTop(page);
}
async function tab(page,name) {
  if(['안내·번역','AI 자료','이력'].includes(name)) {
    const more=detail(page).locator('.admin-place-detail-tabs details');
    if(await more.getAttribute('open')===null) await more.locator(':scope > summary').click();
  }
  await exact(detail(page),'tab',name).click();
  await detailTop(page);
}
const field=(page,name)=>detail(page).getByLabel(name,{exact:true});

async function main(){
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'ko-KR'}),page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  try {
    await page.goto(base+'/admin.html');
    await expect(exact(page,'heading','어떤 작업을 할까요?')).toBeVisible();
    const nav=page.getByRole('navigation');
    const menuDescriptions=[
      ['운영 현황','오늘 할 일을 시작하는 첫 화면','지역·담당 범위를 고른 뒤 등록·검수·추천 여행 중 선택','선택한 업무 화면으로 이동'],
      ['장소·업체','랜드마크·음식점·카페·숙소·쇼핑 장소 원본 관리','지역을 고르고 장소를 선택하거나 새로 등록','같은 장소의 위치·사진·주변 업체·안내·AI 설명을 한곳에서 관리'],
      ['노출·추천','추천 여행 제작과 메인 게시 관리','공개 장소로 여행을 만들거나 인기 콘텐츠를 골라 게시 설정','공개 콘텐츠를 고객 홈에 배치'],
      ['여행기·커뮤니티','공개 여행기·댓글·신고 관리','신고 대상과 문맥을 확인한 뒤 사유를 적고 조치','대상 콘텐츠의 상태와 조치 이력 변경'],
      ['회원·문의','회원 상태·계정 요청·문의 관리','회원 또는 문의를 찾아 담당자·처리 상태 확인','공개 활동과 문의 처리 관리. 개인 일정 본문을 대신 편집하지 않음'],
      ['AI·검색 운영','검색 자료 반영과 AI 추천 품질 관리','색인 작업·품질 시험·요청 현황·실행 정책 중 선택','자료 검색 반영과 실패 원인 확인'],
      ['운영 설정·이력','운영자·분류·연결·알림·정리·변경 기록 관리','해당 설정 탭 선택. 권한이 필요한 작업은 최고관리자 계정 사용','운영 기준과 변경 이력 관리'],
    ];
    await capture(page,{id:'navigation',menu:'overview',title:'관리자 메뉴 찾기',path:'관리자 진입 → 왼쪽 메뉴',purpose:'어느 메뉴에서 무엇을 관리하는지 먼저 확인',steps:['장소를 등록할 때는 ② 장소·업체','공개한 내용을 메인에 올릴 때는 ③ 노출·추천','신고·회원·AI·운영 설정은 각각 해당 메뉴에서 처리'],notes:['화면은 현재 로컬 관리자에서 촬영. 실서비스 관리자 인증·저장소와 연결 상태는 별도','상단 작업자·역할 선택은 로컬 검수용. 실제 서비스의 서버 권한을 바꾸는 기능이 아님']},[
      ...menuDescriptions.map(([label,what,how,result])=>call(label,exact(nav,'button',label),what,how,result,undefined,'right')),
      call('새로 조회',exact(page,'button','새로 조회'),'현재 저장된 관리자 자료를 다시 읽기','다른 작업 후 최신 저장 자료가 필요할 때 클릭','저장된 목록과 상태를 다시 표시','현재 화면의 미저장 입력은 확인한 뒤 저장. 서비스 연결 여부를 생성하는 버튼이 아님','left'),
    ],'full');
    await choose(page,active(page),'운영 현황 작업 지역','kr-busan');
    await capture(page,{id:'overview-work',menu:'overview',title:'운영 현황에서 작업 시작',path:'운영 현황',purpose:'지역을 먼저 고르고 등록 → 검수 → 추천 여행 업무 시작',steps:['① 작업 지역을 부산 등 실제 관리할 지역으로 선택','② 담당 범위를 선택','③~⑤ 하고 싶은 작업을 클릭. 여러 장소를 한꺼번에 가져오려면 ⑥ 사용','아직 끝내지 않은 자료는 ⑧에서 이어서 편집'],notes:['작업 지역을 고르면 장소 등록·CSV 가져오기·추천 여행 만들기에 같은 지역이 전달됨','검수하기는 공개 전 초안 목록으로 이동. 자동 승인이나 자동 공개가 아님']},[
      call('작업 지역',exact(active(page),'combobox','운영 현황 작업 지역'),'이번에 작업할 지역','부산·강원 등 선택','다음 등록·가져오기·추천 여행에 지역 맥락 유지'),
      call('담당 범위',exact(active(page),'combobox','운영 현황 담당 범위'),'내 담당 자료 또는 전체 자료','담당 범위를 선택','이어볼 자료와 초안 수를 해당 범위로 표시'),
      call('장소 등록',active(page).getByRole('button',{name:/^장소 등록/}),'새 장소를 하나 등록','종류와 이름·주소·소개를 입력','선택 지역의 미공개 장소 초안 생성'),
      call('검수하기',active(page).getByRole('button',{name:/^검수하기/}),'공개 전 초안 확인','목록에서 초안을 선택하고 빠진 항목 확인','위치·출처·사용 범위 확인 후 직접 공개 가능'),
      call('추천 여행 만들기',active(page).getByRole('button',{name:/^추천 여행 만들기/}),'등록한 공개 장소로 추천 여행 구성','지역·여행 기간·조건을 입력','운영 추천 여행 초안 생성'),
      call('자료 가져오기',exact(active(page),'button','자료 가져오기'),'CSV로 여러 장소 등록','양식에 맞는 자료를 준비하고 미리보기','오류 없는 행만 확인 필요 초안으로 등록'),
      call('지역 설정',exact(active(page),'button','지역 설정'),'등록 지역 추가·수정','장소에 사용할 지역이 없을 때 이동','장소 등록과 추천 여행에서 공통 사용'),
      call('이어서 확인할 자료',active(page).locator('.admin-work-list > button').first(),'최근 진행 중인 장소 작업','자료 카드를 클릭','해당 장소 상세 편집 화면으로 이동','표시된 항목은 현재 로컬 자료의 예시'),
      call('초안 전체 보기',exact(active(page),'button','초안 전체 보기'),'초안 목록으로 이동','남은 초안을 전체 확인할 때 클릭','선택 지역·담당 범위의 검수 대상 표시'),
    ]);
    await menu(page,'장소·업체');
    await exact(active(page),'tab','장소 목록').click();
    await capture(page,{id:'place-list',menu:'places',title:'지역별 장소·업체 목록',path:'장소·업체 → 장소 목록',purpose:'지역·종류·검수 상태로 자료를 찾고 같은 장소의 상세 관리로 이동',steps:['① 지역을 선택','③ 이름·주소로 찾거나 ④ 종류를 선택','⑤ 전체·내 담당·확인 필요·공개 중 선택','⑥ 장소 카드에서 상세 열기. 신규 등록은 ⑧'],notes:['지역은 장소 원본 자료의 공통 분류. 랜드마크마다 업체를 새로 반복 등록할 필요 없음','상세 검색에서 공개 상태·담당 직원·검수 상태를 추가로 조합 가능','장소 종류는 랜드마크·음식점·카페·숙소·쇼핑. 같은 상호도 주소·장소 ID로 지점 구분']},[
      call('지역',exact(places(page),'combobox','지역'),'등록 지역별 자료 보기','시도 또는 하위 지역 선택','해당 지역과 하위 지역의 자료로 목록 좁힘'),
      call('지역 관리',exact(places(page),'button','지역 관리'),'지역 기준 관리','지역 추가·수정이 필요할 때 클릭','같은 장소·업체 메뉴의 지역 설정으로 이동'),
      call('장소 검색',exact(places(page),'searchbox','장소 검색'),'이름·주소·장소 ID 검색','검색어 입력','맞는 장소 카드만 표시'),
      call('장소 종류 선택',places(page).getByRole('group',{name:'장소 종류 선택',exact:true}),'업종별 목록 보기','랜드마크·음식점·카페·숙소·쇼핑 버튼 선택','선택 종류의 자료만 표시'),
      call('전체 / 내 담당 / 확인 필요 / 공개',places(page).getByRole('group',{name:'자료 작업 목록',exact:true}),'업무 상태별 빠른 목록','원하는 목록 버튼 선택','담당 자료·재확인 대상·공개 자료를 빨리 찾기'),
      call('장소 카드',places(page).locator('.admin-place-row').first(),'같은 장소의 상세 관리 시작','이름·주소·상태를 확인하고 클릭','기본 정보·위치·사진·주변 업체·추가 관리 표시'),
      call('CSV 가져오기',exact(places(page),'button','CSV 가져오기'),'여러 장소 일괄 등록','양식과 미리보기로 행 검수','기존 공개본을 덮지 않고 새 초안 생성'),
      call('장소 등록',exact(places(page),'button','장소 등록'),'새 장소 등록','클릭 후 기본 정보부터 작성','미완성 상태에서도 초안 저장 가능'),
    ]);
    await exact(places(page),'button','장소 등록').click();
    await expect(exact(places(page),'heading','새 장소 초안')).toBeVisible();
    await field(page,'장소명').fill('부산 해변 카페 · 입력 예시');
    await choose(page,detail(page),'장소 종류','CAFE');
    await field(page,'주소').fill('부산 해운대구 · 실제 지점 주소 입력');
    await field(page,'장소 소개').fill('바다 전망과 좌석 분위기, 쉬어가기 좋은 이유를 확인한 정보로 소개');
    await detailTop(page);
    await page.locator('.admin-main').evaluate(el=>{el.scrollTop+=180;});
    await capture(page,{id:'place-basic',menu:'places',title:'장소 등록 · 기본 정보',path:'장소·업체 → 장소 등록 → 기본 정보',purpose:'기본 정보부터 적고 초안 저장. 공개는 위치·출처 검수 이후',steps:['① 장소명과 ② 종류 입력','③ 등록 지역과 ④ 실제 지점 주소 확인','⑤ 영업 상태 선택, ⑥ 장소 소개 작성','⑦ 초안 저장으로 보관','위치·사진·출처 확인 후 ⑧ 검수하고 공개'],notes:['입력 예시는 사용법 설명용 가상 카페. 실제 업체 자료로 공개하거나 방문 안내에 사용하지 않음','초안 저장은 고객에게 공개하는 버튼이 아님','공개 자료를 고치면 수정 초안이 생기고 마지막 공개본은 다시 공개하기 전까지 유지','종류별 메뉴·숙박·시설 정보는 안내·번역, 회사·브랜드·태그·권장 체류 시간은 추가 정보에 입력']},[
      call('장소명',field(page,'장소명'),'실제 지점의 이름','상호·지점을 구분해 입력','목록·고객 카드의 장소명 기준'),
      call('장소 종류',exact(detail(page),'combobox','장소 종류'),'랜드마크·음식점·카페·숙소·쇼핑 분류','실제 업종 선택','해당 종류의 안내 항목과 추천 사용 기준 적용'),
      call('등록 지역',exact(detail(page),'combobox','등록 지역'),'장소의 공통 지역 분류','지점이 속한 지역 선택','지역별 조회와 추천 여행에 사용'),
      call('주소',field(page,'주소'),'개별 지점 주소','이름만 같아도 주소가 다른 지점은 구분','중복 후보 비교와 지도 확인에 사용'),
      call('영업 상태',exact(detail(page),'combobox','영업 상태'),'영업 중·임시휴업·폐업·확인 필요','확인한 현재 상태 선택','공개 여부와 별개로 추천 활용 가능성 판단'),
      call('장소 소개',field(page,'장소 소개'),'장소 특징 요약','확인한 분위기·방문 이유를 짧게 작성','장소 설명으로 사용'),
      call('초안 저장',exact(detail(page),'button','초안 저장'),'미완성 내용을 보관','입력을 마친 뒤 클릭','현재 장소의 미공개 수정 초안 저장'),
      call('검수하고 공개',exact(detail(page),'button','검수하고 공개'),'검수한 자료를 고객 서비스에서 사용','공개 전 확인 항목을 모두 해결한 뒤 클릭','공개본에 반영. 메인 게시 위치·순서는 노출·추천에서 별도 설정','빠진 항목·권리 철회·동시 수정 충돌이 있으면 활성화되지 않음'),
    ],'detail');
    await exact(detail(page),'button','초안 저장').click();
    await expect(page.getByRole('status')).toBeVisible();
    await detail(page).locator('.admin-place-publish-checks > summary').click();
    await detailTop(page);
    await capture(page,{id:'place-checklist',menu:'places',title:'공개 전 확인 항목 해결',path:'장소 상세 → 공개 전 확인',purpose:'무엇이 빠졌는지 보고 해당 입력 위치로 바로 이동',steps:['① 공개 전 확인을 펼치기','②~⑤ 기본 정보·위치·사진·출처로 이동','⑥ 누락 항목의 확인하기를 눌러 보완','입력 내용을 초안 저장한 뒤 검수하고 공개'],notes:['확인 완료는 현재 입력이 검증 조건을 만족한다는 뜻. 운영자가 사실·좌표·사용권을 직접 확인해야 함','사진이 없더라도 기본 장소 공개와 발견 사진·영상 채널의 미디어 요건은 다를 수 있음','검수 상태를 검수 완료로 바꾸는 것만으로 고객에게 공개되지 않음']},[
      call('공개 전 확인',detail(page).locator('.admin-place-publish-checks > summary'),'공개를 막는 누락 항목 수','펼쳐서 확인','등록 단계별 상태와 문제 목록 표시'),
      call('1 기본 정보',exact(detail(page),'button','1 기본 정보'),'이름·주소·종류·소개 점검','이 버튼을 눌러 기본 정보로 이동','빠진 기본 정보 보완'),
      call('2 위치 확인',exact(detail(page),'button','2 위치 확인'),'주소·좌표·근거 확인','위치 탭으로 이동','검증한 도착 지점 좌표를 입력'),
      call('3 사진·영상',exact(detail(page),'button','3 사진·영상'),'미디어와 사진별 사용 조건 확인','사진·영상 탭으로 이동','사진별 출처와 권리 보완'),
      call('4 출처·사용 범위',exact(detail(page),'button','4 출처·사용 범위'),'장소 설명 자료의 출처와 허용 범위 확인','기본 정보의 출처 영역을 바로 열기','자료 제공자·URL·확인일·허용 범위 보완'),
      call('확인하기 →',detail(page).locator('.admin-place-publish-checks li button').first(),'특정 누락 항목으로 바로 가기','누락된 내용을 읽고 클릭','그 항목이 있는 탭이나 입력 영역 열기'),
    ],'detail');
    await exact(detail(page),'button','4 출처·사용 범위').click();
    await detail(page).locator('.admin-place-publish-checks > summary').click();
    await align(page,field(page,'자료 제공자'));
    await capture(page,{id:'place-source',menu:'places',title:'자료 출처 · 사용 범위',path:'장소 상세 → 기본 정보 → 출처·사용 범위',purpose:'누가 제공한 어떤 원문인지 기록하고 허용된 용도만 선택',steps:['①~③ 원문 제공자·URL·확인일 입력','④~⑦ 실제 이용 허락 범위에 맞게 체크','설명·권리 검수가 끝나면 초안 저장 후 공개'],notes:['체크박스가 이용 허락을 만들어 주는 것은 아님. 원문 조건이나 제공자의 허락을 확인한 뒤 선택','장소 자료의 사용 범위와 사진별 사용 범위는 별도','변형·AI 활용을 허락받지 않았다면 체크하지 않기']},[
      call('자료 제공자',field(page,'자료 제공자'),'장소 소개 자료를 제공한 곳','공식 업체·관광 기관 등 입력','자료의 제공 경로 기록'),
      call('자료 출처 URL',field(page,'자료 출처 URL'),'소개 자료 원문 링크','확인 가능한 공식 원문 URL 입력','자료 검수와 재확인 근거'),
      call('자료 확인일',field(page,'자료 확인일'),'자료를 확인한 날짜','실제 확인 날짜 선택','정보 최신성 판단에 사용'),
      call('화면 표시 허용',field(page,'화면 표시 허용'),'고객 화면 표시 이용 범위','표시 허락 확인 후 체크','공개 검수 조건에 반영'),
      call('자료 보관 허용',field(page,'자료 보관 허용'),'서비스에 자료 보관 이용 범위','자료 보관 허락 확인 후 체크','원본 저장 가능 범위 기록'),
      call('변형 허용',field(page,'변형 허용'),'편집·가공 이용 범위','허용된 경우에만 체크','자료 변형 가능 범위 기록'),
      call('AI 활용 허용',field(page,'AI 활용 허용'),'자료의 AI 활용 이용 범위','검색·모델 입력 사용 허락 확인 후 체크','AI 활용 가능 여부 기록'),
    ],'detail');
    await tab(page,'위치');
    await capture(page,{id:'place-location',menu:'places',title:'위치 확인 · 좌표 등록',path:'장소 상세 → 위치',purpose:'실제 지점의 도착 위치를 확인한 뒤 좌표와 근거 등록',steps:['⑦ 네이버 지도에서 상호·주소 비교','①② 실제 입구나 대표 지점의 WGS84 좌표 입력','③④⑤ 근거·원문·확인일 기록','다시 비교한 뒤 ⑥ 직접 확인 체크','초안 저장 후 공개 전 확인 항목 점검'],notes:['주소 조회 API가 아직 연결되지 않은 로컬 화면. 좌표를 자동 확정해 주지 않음','위도·경도를 바꾸면 직접 확인 상태가 해제됨. 다시 확인 필요','3km/15km 주변 후보는 직선 거리. 이동 시간이나 실제 도로 경로와 다름']},[
      call('위도 · WGS84',field(page,'위도 · WGS84'),'북위·남위 좌표','확인한 실제 도착점의 위도 입력','주변 거리 조회·지도 표시 기준'),
      call('경도 · WGS84',field(page,'경도 · WGS84'),'동경·서경 좌표','같은 지점의 경도 입력','위도와 함께 위치 확정'),
      call('좌표 확인 근거',field(page,'좌표 확인 근거'),'왜 이 좌표가 맞는지 기록','공식 지도·입구 등 근거 입력','운영자가 재확인할 단서 보관'),
      call('좌표 출처 URL',field(page,'좌표 출처 URL'),'위치 확인 원문','좌표를 확인한 URL 입력','위치 자료 추적'),
      call('좌표 확인일',field(page,'좌표 확인일'),'위치를 확인한 날짜','실제 확인 날짜 선택','좌표 검수 시점 기록'),
      call('주소·좌표·근거를 직접 확인했어요',field(page,'주소·좌표·근거를 직접 확인했어요'),'운영자의 위치 검수 확인','이름·주소·좌표를 비교한 뒤 체크','공개 전 좌표 검수 조건 반영'),
      call('네이버 지도에서 이름·주소 확인',exact(detail(page),'link','네이버 지도에서 이름·주소 확인'),'지도에서 별도 확인','새 탭에서 검색 결과 확인','지점 위치 검수. 이 링크만 눌러도 검수가 끝나는 것은 아님'),
    ],'detail');

    await openPlace(page,'catalog-busan-momos-yeongdo');
    await tab(page,'사진·영상');
    const mediaCard=detail(page).locator('.admin-card').first();
    await capture(page,{id:'place-media-file',menu:'places',title:'사진·영상 등록 · 파일 정보',path:'장소 상세 → 사진·영상',purpose:'사진을 넣고 사진 설명과 출처를 각각 연결',steps:['① URL 등록 또는 ② 사진 파일 선택','③ 미디어 종류를 실제 사진·영상·사진 모션에 맞게 선택','④ 파일 URL, ⑤ 사진 설명, ⑥ 대체텍스트 입력','⑦⑧ 순서를 조정. 아래 출처·사용 조건을 이어서 확인'],notes:['실제 부산 카탈로그 자료 화면으로 촬영. 모든 자료를 추가 검수 없이 공개하라는 뜻은 아님','로컬 파일 선택은 기기 내 확인용. 실제 파일 저장소 업로드 API는 연결 필요','로컬 파일 선택은 PNG/JPG/WebP/GIF 2MB 이하, 장소별 미디어 최대 30개','미공개 사진은 삭제 가능. 공개 사진은 사유를 적어 즉시 철회 가능']},[
      call('미디어 URL 등록',exact(detail(page),'button','미디어 URL 등록'),'미디어 입력 칸 추가','저장된 원본 파일 URL을 가진 경우 클릭','새 사진·영상 입력 칸 생성'),
      call('사진 파일 선택',exact(detail(page),'button','사진 파일 선택'),'기기 사진을 로컬 확인용으로 추가','지원 형식·용량의 파일 선택','사진 미리보기와 입력 칸 생성','실서비스 업로드 완료를 뜻하지 않음'),
      call('미디어 종류',exact(mediaCard,'combobox','미디어 종류'),'사진·실제 영상·사진 모션 구분','파일의 실제 종류 선택','고객 표시 방식 기준'),
      call('파일 URL',mediaCard.getByLabel('파일 URL',{exact:true}),'사진·영상 파일 주소','원본 파일 URL 입력','미리보기에 원본 연결'),
      call('사진 설명',mediaCard.getByLabel('사진 설명',{exact:true}),'사진에 대한 설명','보이는 장면이나 촬영 맥락 작성','사진 설명으로 사용. 출처 칸을 대신하지 않음'),
      call('대체텍스트',mediaCard.getByLabel('대체텍스트',{exact:true}),'사진을 볼 수 없는 경우의 설명','사진 내용을 간단히 작성','접근성·이미지 실패 시 설명'),
      call('미디어 위로 이동',exact(mediaCard,'button','미디어 위로 이동'),'사진 표시 순서 앞쪽으로 이동','두 번째 이후 사진에서 클릭','사진과 해당 사진의 출처가 함께 이동'),
      call('미디어 아래로 이동',exact(mediaCard,'button','미디어 아래로 이동'),'사진 표시 순서 뒤쪽으로 이동','다음 사진이 있는 경우 클릭','사진별 메타데이터 연결을 유지하며 이동'),
    ],'detail');
    await align(page,mediaCard.getByLabel('제공자',{exact:true}),150);
    await capture(page,{id:'place-media-rights',menu:'places',title:'사진별 출처 · 사용권 · 대표 사진',path:'장소 상세 → 사진·영상 → 출처·사용 조건',purpose:'사진 한 장마다 원문과 허용 범위를 기록하고 대표 사진 지정',steps:['①② 제공자와 저작자 입력','③ 원문 사진 URL, ④⑤ 사용 조건·조건 URL 기록','⑥ 실제 확인일 입력','⑦ 사용 범위를 사진별로 체크','⑧ 대표 사진 선택 후 초안 저장'],notes:['사진 설명과 원문 URL은 별도 정보','대표는 장소에서 하나만 지정','공개 전 초안에서 제외는 다음 공개 초안에서 빼는 것. 이미 공개된 사진의 즉시 철회와 다름','공개 미디어 즉시 철회는 사용권 철회 등 사유가 필요한 별도 조치']},[
      call('제공자',mediaCard.getByLabel('제공자',{exact:true}),'사진 파일 제공자','파일을 제공한 기관·사용자 등 입력','사진별 출처 기록'),
      call('저작자',mediaCard.getByLabel('저작자',{exact:true}),'사진 저작권자','확인한 촬영자·권리자 입력','사진 저작자 표시 근거'),
      call('원문 URL',mediaCard.getByLabel('원문 URL',{exact:true}),'사진이 나온 원문 페이지','사진 출처 URL 입력','사진별 근거 연결'),
      call('사용 조건',mediaCard.getByLabel('사용 조건',{exact:true}),'사용권 이름·조건','CC 조건 또는 별도 이용 허락 내용 입력','허용 범위 검수 기준'),
      call('조건 URL',mediaCard.getByLabel('조건 URL',{exact:true}),'사용 조건을 확인할 수 있는 페이지','라이선스·이용 조건 링크 입력','권리 검수 근거'),
      call('확인일',mediaCard.getByLabel('확인일',{exact:true}),'사진·권리를 확인한 날짜','실제 확인일 선택','사진 자료 검수 시점'),
      call('사용 범위',mediaCard.locator('.admin-checks'),'표시·보관·변형·AI 허용과 초안 제외','각 허용 범위를 실제 조건대로 체크','사진의 허용된 용도만 기록',undefined,'right'),
      call('대표',mediaCard.getByLabel('대표',{exact:true}),'대표 사진 한 장 선택','고객 카드에 쓸 사진을 체크','다른 사진의 대표 표시 해제','표시 허용·출처 검수 등 조건을 함께 확인'),
    ],'detail');

    await openPlace(page,'review-landmark'); await tab(page,'주변 업체');
    const row=detail(page).locator('.admin-list-row').first();
    await capture(page,{id:'place-nearby',menu:'places',title:'랜드마크 주변 음식점 · 카페 · 숙소',path:'장소 상세 → 주변 업체',purpose:'좌표로 찾은 후보 중 추천을 선정하거나 해당 랜드마크에서만 제외',steps:['①②③ 업종 선택','④ 직선 3km 기준으로 후보 확인. 필요한 경우 15km 확장','⑤ 거리·주소를 비교','⑥ 추천 선정 또는 ⑦ 해당 랜드마크에서 제외','후보가 없으면 ⑧ 주변 업체 등록'],notes:['이 화면의 바다 전망대·바다 식당은 주변 연결 사용법을 보여주는 가상 예시','공개·영업·좌표 검수를 마친 랜드마크에서 후보 조회 가능','후보 업체도 공개·영업·좌표·이용 조건을 통과해야 함','업체는 한 번 등록하면 좌표로 여러 랜드마크의 후보가 됨. 제외는 현재 랜드마크 관계에만 적용','추천 선정 업체가 여러 개면 위·아래 이동으로 운영자 추천 순서 조정']},[
      call('음식점',exact(detail(page),'button','음식점'),'주변 음식점 후보','클릭','음식점 목록 표시'),
      call('카페',exact(detail(page),'button','카페'),'주변 카페 후보','클릭','카페 목록 표시'),
      call('숙소',exact(detail(page),'button','숙소'),'주변 숙소 후보','클릭','숙소 목록 표시. 실제 객실 예약·재고가 아님'),
      call('주변 업체 거리',exact(detail(page),'combobox','주변 업체 거리'),'검색 직선 범위','3km 또는 15km 확장 선택','선택 범위 내 후보 표시'),
      call('거리순 후보',row.locator('strong'),'후보 이름·주소·거리','지점과 거리를 직접 확인','추천 또는 제외 판단'),
      call('추천 선정',exact(row,'button','추천 선정'),'현재 랜드마크의 운영자 추천','이 업체를 추천하려면 클릭','운영자 추천으로 구분. 다시 클릭하면 추천 해제'),
      call('제외',exact(row,'button','제외'),'현재 랜드마크에서 후보 제외','관계상 부적절한 업체면 클릭','현재 랜드마크에서만 제외. 업체 전체 비활성화와 다름'),
      call('이 주변 음식점 등록',exact(detail(page),'button','이 주변 음식점 등록'),'후보가 없는 주변 업체 신규 등록','실제 지점을 등록할 때 클릭','랜드마크 지역·업종을 이어받은 초안 생성'),
    ],'detail');
    await tab(page,'안내·번역');
    await capture(page,{id:'place-guide',menu:'places',title:'방문 안내 · 영어 설명',path:'장소 상세 → 추가 관리 → 안내·번역',purpose:'운영 시간·방문 팁·시설·접근성 및 번역 상태 관리',steps:['①~④ 확인된 방문 정보 입력','⑤⑥ 안내 근거와 확인 날짜 기록','⑦ 영어 설명을 적고 번역 검수 상태 선택','초안 저장 → 고객 화면 미리보기 → 검수하고 공개'],notes:['음식점에서는 메뉴·식사 정보, 숙소에서는 숙박 정보가 추가 표시','영어 설명을 수정하면 번역 초안 상태가 됨. 검수 완료로 바꾸기 전 원문과 비교','고객 화면의 영어 기능 노출 여부와 관리자 번역 보관은 별도','영업 시간·시설·접근성은 모르면 사실처럼 입력하지 않기']},[
      call('운영 시간 · 확인한 정보만',field(page,'운영 시간 · 확인한 정보만'),'확인한 현재 운영 시간','출처를 확인한 내용만 입력','방문 안내로 사용'),
      call('방문 팁',field(page,'방문 팁'),'좋은 시간대·방문 방법','실제 확인한 팁 입력','관광 안내 설명에 사용'),
      call('시설',field(page,'시설'),'확인한 이용 시설','주차·화장실 등 확인 자료 입력','시설 안내'),
      call('접근성',field(page,'접근성'),'걷기·계단·접근 조건','확인한 접근 정보 입력','이동·접근 요구 판단 근거'),
      call('안내 출처',field(page,'안내 출처'),'방문 안내 원문','공식 안내 URL 입력','안내 정보 검수 근거'),
      call('안내 확인일',field(page,'안내 확인일'),'안내를 확인한 날짜','확인일 선택','운영 정보 재검수 판단'),
      call('영어 설명 · 원문은 유지',field(page,'영어 설명 · 원문은 유지'),'원문을 유지한 별도 영어 안내','번역을 입력하고 아래 검수 상태 선택','한국어 원문을 덮지 않고 영어 안내 관리'),
    ],'detail');
    await tab(page,'AI 자료');
    await page.locator('.admin-main').evaluate(el=>{el.scrollTop+=110;});
    await capture(page,{id:'place-ai',menu:'places',title:'장소별 AI 검색 설명',path:'장소 상세 → 추가 관리 → AI 자료',purpose:'RAG 검색에 사용할 승인 설명과 근거를 장소에 연결',steps:['① 설명에 확인한 특징·분위기·방문 팁 작성','② 의미 검색을 돕는 태그 입력','③④⑤ 근거와 확인일 기록','⑥ 이용 허락과 내용을 확인한 뒤 체크','초안 저장·공개 후 ⑦ 색인 상태 확인'],notes:['주소·좌표·영업 상태는 장소 원본 DB 기준. 이 설명만 고쳐 사실 필드를 대신하지 않음','출처·허용 범위가 없는 설명을 모델 입력에 사용하지 않기','설명을 입력하고 체크했다고 실제 맥미니·임베딩·RAG 연결이 완료되는 것은 아님','고객 개인 일정·메모·대화 원문을 여기에 붙여 넣지 않기']},[
      call('AI 검색용 설명',field(page,'AI 검색용 설명'),'검색용 장소 특징·분위기 설명','근거가 있는 내용만 작성','승인·공개 후 검색 자료로 관리'),
      call('검색 태그',field(page,'검색 태그'),'검색용 의미 태그','쉼표로 구분해 입력','검색 자료의 조건·분위기 보완'),
      call('제공자',field(page,'제공자'),'AI 설명 제공자','출처 제공자 입력','설명 추적'),
      call('설명 출처',field(page,'설명 출처'),'검색 설명 원문','확인 가능한 URL 입력','공용 검색 근거 기록'),
      call('확인일',field(page,'확인일'),'설명 확인 날짜','실제 확인일 선택','자료 검수 시점'),
      call('이 설명의 검색·LLM 입력 활용을 검수했어요',field(page,'이 설명의 검색·LLM 입력 활용을 검수했어요'),'AI 활용 범위 검수','설명과 사용권 확인 후 체크','검색·모델 입력 활용 가능 여부 기록'),
      call('색인 작업·품질 시험 보기',exact(detail(page),'button','색인 작업·품질 시험 보기'),'자료 반영·검색 품질 확인','설명 관리 후 이 버튼 클릭','AI·검색 운영으로 이동'),
    ],'detail');
    await tab(page,'기본 정보');
    await detail(page).locator('.admin-assignment > summary').click();
    await align(page,field(page,'담당 직원'),180);
    await capture(page,{id:'place-workflow',menu:'places',title:'담당 · 검수 상태 · 공개 후 다음 작업',path:'장소 상세 → 담당 영역 · 저장 · 공개',purpose:'담당 상태와 자료 공개를 구분하고 공개한 자료를 추천 여행으로 연결',steps:['① 담당 직원과 ② 검수 상태 선택','내용을 바꾼 경우 먼저 ⑤ 초안 저장','③ 담당·검수 상태 저장으로 작업 상태 반영','④ 고객 화면 미리보기에서 초안 확인','검수를 마친 뒤 ⑥ 공개. 공개 후 ⑦ 추천 여행 만들기로 이동'],notes:['검수 완료 상태만 저장해도 공개되지는 않음','담당·검수 상태와 장소 내용 저장은 다른 변경. 미저장 내용이 있을 때 상태 저장이 제한됨','고객 화면 미리보기는 현재 입력 초안. 실서비스 반영 완료를 뜻하지 않음','예시의 바다 전망대는 이미 공개된 가상 검수 자료','미저장 입력이나 저장 실패·충돌 메시지가 있으면 먼저 해결하고 공개']},[
      call('담당 직원',exact(detail(page),'combobox','담당 직원'),'이 자료의 작업 담당자','직원을 선택','자료 작업 목록의 내 담당에 반영'),
      call('검수 상태',exact(detail(page),'combobox','검수 상태'),'작성 중·확인 필요·검수 완료','확인 결과에 맞게 선택','작업 상태만 변경. 공개 여부와 별개'),
      call('담당·검수 상태 저장',exact(detail(page),'button','담당·검수 상태 저장'),'업무 담당과 검수 상태 저장','미저장 내용을 먼저 저장한 뒤 클릭','담당·검수 상태 변경 기록'),
      call('고객 화면 미리보기',exact(detail(page),'button','고객 화면 미리보기'),'현재 초안의 고객 표시 확인','미리보기 펼치기','사진·설명·주변 자료를 확인. 아직 공개 전일 수 있음'),
      call('초안 저장',exact(detail(page),'button','초안 저장'),'자료 내용 저장','편집 내용을 보관할 때 클릭','미공개 초안 저장. 기존 공개본은 유지'),
      call('검수하고 공개',exact(detail(page),'button','검수하고 공개'),'확인한 자료로 공개본 갱신','누락 항목·사실·권리를 확인한 뒤 클릭','현재 초안을 고객용 공개본으로 반영'),
      call('추천 여행 만들기 →',exact(detail(page),'button','추천 여행 만들기 →'),'공개 장소로 추천 여행 구성','공개 후 다음 작업으로 이동','현재 장소 지역을 이어받아 추천 여행 만들기 열기'),
    ],'detail');
    await openPlace(page,'부산 해변 카페 · 입력 예시');
    await tab(page,'이력');
    const historyRows=detail(page).locator('.admin-list-row');
    await capture(page,{id:'place-history',menu:'places',title:'장소 변경 이력 확인',path:'장소 상세 → 추가 관리 → 이력',purpose:'누가 언제 어떤 변경을 했는지 확인',steps:['① 이력 탭 선택','② 작업 종류 확인','③ 변경 시각과 운영자 확인','④ 변경 전후 상태와 사유 비교'],notes:['입력 예시를 고립된 브라우저에서 초안 저장한 실제 기록으로 촬영','공개·비활성·사용 철회·주변 추천 등 장소 관련 조치가 쌓이면 같은 장소의 이력에서 조회','현재 장소 정보의 변경 이력은 기존 고객 여행 당시의 글·사진을 덮어쓰는 이력이 아님']},[
      call('이력',exact(detail(page),'tab','이력'),'장소 변경 기록','추가 관리에서 이력 선택','현재 장소의 조치 기록 표시'),
      call('작업 종류',historyRows.first().locator('strong'),'저장·생성·공개 등 실행한 작업','기록의 작업 이름 읽기','무슨 종류의 변경인지 구분',undefined,'right'),
      call('시각 · 운영자',historyRows.first().locator('small'),'변경을 실행한 시각·작업자','시간과 이름 확인','변경 담당자와 순서 확인'),
      call('변경 전후 · 사유',historyRows.first().locator('p'),'상태와 조치 사유','이전 → 이후 상태 및 사유 비교','변경 내용을 추적',undefined,'right'),
    ],'detail');
    const danger=detail(page).locator('.admin-danger-zone');
    await danger.locator(':scope > summary').click();
    await danger.getByLabel('변경 사유',{exact:true}).fill('조치 전에 확인한 구체적인 사유 입력');
    await align(page,danger.locator(':scope > summary'),170);
    await capture(page,{id:'place-withdraw',menu:'places',title:'비활성화 · 사용 철회 · 초안 삭제',path:'장소 상세 → 비활성·사용 철회·초안 삭제',purpose:'잘못된 자료나 이용할 수 없는 자료의 조치를 목적에 맞게 선택',steps:['① 조치 영역을 펼치기','② 근거가 있는 변경 사유 입력','③ 비활성화 / ④ 사용 철회 / ⑤ 초안 삭제 중 필요한 작업 선택','조치 후 목록·이력·노출 영향 확인'],notes:['이 화면에서는 버튼을 실행하지 않고 사용법만 촬영','비활성화는 장소의 공용 이용 상태를 관리하는 조치','사용 철회는 권리 철회 등으로 자료 사용을 중단하는 조치. 재공개를 단순 허용하는 상태 변경과 다름','영구 초안 삭제는 공개본이 없고 참조도 없는 초안만 가능','고객의 기존 여행기 글·사진·당시 기록을 현재 장소 변경으로 덮어쓰지 않음','폐업·임시휴업은 기본 정보의 영업 상태에서 관리. 콘텐츠 공개 상태와 구분']},[
      call('비활성·사용 철회·초안 삭제',danger.locator(':scope > summary'),'자료 이용 중단·삭제 영역','필요한 경우에만 펼치기','사유와 조치 버튼 표시'),
      call('변경 사유',danger.getByLabel('변경 사유',{exact:true}),'조치의 구체적인 이유','확인한 문제·권리 철회 등의 사유 작성','변경 이력에 사유 보관'),
      call('비활성화',exact(danger,'button','비활성화'),'공용 장소 이용 상태 비활성화','대상·영향을 확인하고 클릭','장소 비활성 상태로 변경'),
      call('사용 철회',exact(danger,'button','사용 철회'),'자료 사용을 중단하는 조치','사용권 철회 등의 근거 확인 후 클릭','노출·검색 사용 중단 처리 대상으로 기록'),
      call('참조 없는 초안 삭제',exact(danger,'button','참조 없는 초안 삭제'),'공개되지 않은 불필요 초안 제거','공개본·연결 참조가 없는지 확인하고 클릭','조건을 통과한 초안만 영구 삭제'),
    ],'detail');
    await menu(page,'장소·업체'); await exact(active(page),'tab','장소 목록').click();
    const close=exact(places(page),'button','상세 닫기');if(await close.isVisible())await close.click();
    const filters=places(page).locator('.admin-place-filter-panel');if(await filters.getAttribute('open')===null)await filters.locator(':scope > summary').click();
    await exact(places(page),'searchbox','장소 검색').fill('');
    await exact(places(page),'button','CSV 가져오기').click();
    await places(page).getByLabel('CSV 내용',{exact:true}).fill('name,kind,area,address,description\n부산 카페 입력 예시,CAFE,부산,가상 예시 주소,사용법 설명용 초안\n부산 식당 입력 예시,FOOD,부산,가상 예시 주소 2,사용법 설명용 초안');
    await exact(places(page),'button','가져오기 미리보기').click();
    const csvPanel=places(page).locator('.admin-panel').filter({has:exact(page,'heading','CSV 초안 가져오기')});
    await csvPanel.evaluate(el=>{document.querySelector('.admin-main').scrollTop+=el.getBoundingClientRect().top-90;});
    await capture(page,{id:'place-csv',menu:'places',title:'CSV로 여러 장소 가져오기',path:'장소·업체 → CSV 가져오기',purpose:'행별 오류·중복·등록 지역을 확인한 뒤 새 초안 생성',steps:['① 양식을 내려받아 name·kind·area·address 필수 열 작성','② 가져온 자료의 담당 직원 선택','③ 파일 선택 또는 ④ 내용 붙여 넣기','⑤ 미리보기 후 ⑥ 행별 지역·오류 확인','⑦ 오류 없는 행만 초안 등록. 이후 장소 목록의 확인 필요에서 검수'],notes:['최대 200행·1MB 이하 CSV','종류 값 LANDMARK / FOOD / CAFE / STAY / SHOP','기존 공개본 자동 덮어쓰기·중복 자동 병합을 하지 않음','좌표를 가져와도 검증 완료 상태로 취급하지 않음','이 화면의 가상 입력 예시는 등록하지 않고 캡처만 함']},[
      call('양식 내려받기',exact(csvPanel,'button','양식 내려받기'),'CSV 열 양식 다운로드','파일에 실제 자료 입력','동일한 열 이름으로 가져오기 준비'),
      call('가져온 자료 담당 직원',exact(csvPanel,'combobox','가져온 자료 담당 직원'),'일괄 자료 담당자','검수할 담당 직원 선택','생성 초안에 담당자 연결'),
      call('CSV 파일 선택',csvPanel.getByLabel('CSV 파일 선택',{exact:true}),'CSV 파일 읽기','1MB 이하 CSV 선택','입력 영역에 파일 내용 표시'),
      call('CSV 내용',csvPanel.getByLabel('CSV 내용',{exact:true}),'CSV 텍스트 입력','양식에 맞는 내용을 붙여 넣기','파일 없이도 미리보기 가능'),
      call('가져오기 미리보기',exact(csvPanel,'button','가져오기 미리보기'),'실제 등록 전 검사','입력 내용을 검토할 때 클릭','행별 종류·중복·누락·지역 오류 표시'),
      call('행별 등록 지역',exact(csvPanel,'combobox','2행 등록 지역'),'각 행의 등록 지역 확인','기본 작업 지역과 다른 행은 수정','행별 최종 지역 결정'),
      call('오류 없는 2개 초안 등록',exact(csvPanel,'button','오류 없는 2개 초안 등록'),'검사를 통과한 행만 신규 초안 생성','오류·중복을 해결하고 등록 클릭','확인 필요 초안 생성. 공개는 검수 후 별도 실행'),
    ]);
    await exact(active(page),'tab','지역 설정').click();
    const regionPanel=active(page).locator('.admin-split').filter({has:exact(page,'heading','등록 지역')});
    await regionPanel.getByPlaceholder('지역 이름·ID 검색',{exact:true}).fill('부산');
    await regionPanel.getByRole('button',{name:/대한민국 · 부산 kr-busan · v/}).click();
    await page.locator('.admin-main').evaluate(el=>{el.scrollTop=0;});
    await capture(page,{id:'place-regions',menu:'places',title:'지역 추가 · 편집',path:'장소·업체 → 지역 설정',purpose:'장소·추천 여행에 공통으로 사용할 국가·시도·시군·구읍면 관리',steps:['① 지역 목록에서 선택하거나 ② 지역 추가','③ 이름, ④ 지역 구분, ⑤ 상위 지역 입력','⑥ 신규 선택 여부 설정','⑦ 지역 저장. 등록 자료 확인은 ⑧'],notes:['국가 → 시도 → 시군 → 구·읍면의 상하위 관계 사용','하위 지역을 등록하려면 맞는 단계의 상위 지역 선택 필요','신규 선택 중지해도 기존 장소의 지역·이력은 보존','지역 설정은 장소·업체와 추천 여행에서 같은 목록을 사용']},[
      call('등록 지역 목록',regionPanel.locator('.admin-list .admin-card[aria-pressed="true"]'),'기존 지역 선택','목록에서 대상 지역 클릭','오른쪽 편집 영역에 현재 지역 표시'),
      call('지역 추가',exact(regionPanel,'button','지역 추가'),'새 지역 생성','기존 목록에 없을 때 클릭','빈 지역 편집 양식 표시'),
      call('지역 이름',regionPanel.getByLabel('지역 이름',{exact:true}),'화면에 표시할 지역명','이름 입력','지역 선택 목록의 표시명'),
      call('지역 구분',exact(regionPanel,'combobox','지역 구분'),'국가·시도·시군·구읍면 단계','맞는 단계 선택','선택 가능한 상위 지역 결정'),
      call('상위 지역',exact(regionPanel,'combobox','상위 지역'),'부모 지역 지정','올바른 상위 지역 선택','지역별 자료 조회에 관계 반영'),
      call('신규 등록·선택 사용',exact(regionPanel,'combobox','신규 등록·선택 사용'),'새 등록에 사용할지 결정','사용 또는 신규 선택 중지 선택','기존 자료를 삭제하지 않고 새 선택만 제어'),
      call('지역 저장',exact(regionPanel,'button','지역 저장'),'지역 변경 저장','이름·단계·부모 확인 후 클릭','공통 지역 기준에 반영'),
      call('이 지역 장소 보기',exact(regionPanel,'button','이 지역 장소 보기'),'선택 지역의 장소 목록','자료 확인이 필요할 때 클릭','해당 지역 필터가 적용된 장소 목록'),
    ]);
    if(errors.length)throw new Error(errors.join('\n'));
    fs.writeFileSync(path.join(out,'data-capture-results.json'),JSON.stringify({base,createdAt:new Date().toISOString(),screens:entries.length,callouts:entries.reduce((n,p)=>n+p.callouts.length,0),errors,isolated:true},null,2));
  }finally{await context.close();await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
