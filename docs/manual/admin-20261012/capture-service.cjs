/* Manual screenshot capture. Fresh isolated contexts; no operator/customer browser is reused. */
const {chromium,expect}=require('C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const base='http://127.0.0.1:5210',out=__dirname,key='spotlog.admin.review.v1',pages=[];
const active=p=>p.locator('.admin-page-body:not([hidden])');
const button=(p,name)=>active(p).getByRole('button',{name,exact:true});
const field=(p,name)=>active(p).getByLabel(name,{exact:true});
const tab=(p,name)=>active(p).getByRole('tab',{name,exact:true});
async function menu(p,name){await p.getByRole('navigation').getByRole('button',{name,exact:true}).click();await expect(p.getByRole('heading',{level:1,name,exact:true})).toBeVisible();await top(p);}
async function top(p){await p.locator('.admin-main').evaluate(e=>e.scrollTop=0);await p.evaluate(()=>window.scrollTo(0,0));}
async function choose(p,label,value){await active(p).getByRole('combobox',{name:label,exact:true}).click();await p.locator(`[role="option"][data-value="${value}"]`).click();}
function c(label,locator,what,how,result,note){return{label,locator,what,how,result,...note?{note}:{}};}
async function capture(p,item,definitions){
  await p.evaluate(()=>document.fonts.ready);await p.locator('.admin-main').evaluate(e=>Promise.all(e.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{}))));
  const callouts=[];
  for(let i=0;i<definitions.length;i++){
    const d=definitions[i],box=await d.locator.boundingBox();
    if(!box||box.y<0||box.y+Math.min(box.height,18)>1000||box.x<0||box.x>1440)throw Error(`${item.id}: ${d.label} outside viewport ${JSON.stringify(box)}`);
    const {locator,...text}=d;callouts.push({n:i+1,...text,x:Number((100*(box.x+Math.min(box.width-8,16))/1440).toFixed(3)),y:Number((100*(box.y+Math.min(box.height/2,16))/1000).toFixed(3))});
  }
  const image=`assets/service-${item.id}.png`;await p.screenshot({path:path.join(out,image),animations:'disabled'});
  pages.push({...item,image,width:1440,height:1000,callouts});fs.writeFileSync(path.join(out,'service-pages.json'),JSON.stringify(pages,null,2)+'\n');console.log('CAPTURED',item.id,callouts.length);
}
async function main(){
 fs.mkdirSync(path.join(out,'assets'),{recursive:true});const browser=await chromium.launch({channel:'msedge',headless:true});
 const errors=[];try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Asia/Seoul'}),p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base+'/admin.html');await expect(p.getByRole('heading',{name:'어떤 작업을 할까요?',exact:true})).toBeVisible();
 await menu(p,'노출·추천');
 await capture(p,{id:'exposure-start',menu:'exposure',title:'노출·추천에서 무엇을 할까?',path:'노출·추천 → 작업 시작',purpose:'등록 자료를 추천 여행으로 만들고 홈에 올리는 순서 확인',steps:['장소 자료가 부족하면 ② 장소 자료 보기로 이동해 등록·검수부터 진행','준비됐다면 ③ 추천 여행 만들기를 눌러 DAY 초안 작성','이미 공개한 자료를 홈에 올릴 때는 ④ 메인 화면 편집으로 이동'],notes:['공개와 메인 게시는 다름. 공개는 고객 서비스에서 쓸 수 있게 하는 작업, 메인 게시는 홈에 보일 위치·순서·기간을 정하는 작업.']},[
 c('작업 탭',active(p).getByRole('tablist').first(),'추천 여행·게시·인기·미리보기 작업 구분','하고 싶은 작업의 탭 선택','선택한 작업 화면 열림'),
 c('장소 자료 보기',button(p,'장소 자료 보기'),'랜드마크·음식점·카페·숙소 자료 준비','장소 자료 보기 → 지역 선택 → 장소 등록·검수','같은 원본 자료를 추천 여행에 재사용'),
 c('추천 여행 만들기',button(p,'추천 여행 만들기'),'등록된 장소로 DAY 초안 작성','버튼 선택 → 지역·기간 입력','순서와 사진을 다듬을 추천 여행 초안 생성'),
 c('메인 화면 편집',button(p,'메인 화면 편집'),'이미 공개한 자료의 홈·발견 게시 설정','버튼 선택 → 게시 위치·대상·기간 선택','공개 자료를 원하는 위치에 게시'),
 c('공개와 게시의 구분',active(p).locator('.admin-editorial-context'),'공개만으로 홈 상단에 자동 게시되지 않는다는 안내','여행 공개 후 메인 게시까지 별도로 진행','자료 공개 상태와 홈 게시 상태를 따로 확인')]);
 await button(p,'추천 여행 만들기').click();await choose(p,'여행 지역','kr-busan');await choose(p,'여행 기간','2');await field(p,'어떤 여행을 만들까요? (선택)').fill('부산에서 2일. 식사와 카페를 포함해서 천천히 둘러보기');await top(p);
 await capture(p,{id:'curated-conditions',menu:'exposure',title:'추천 여행 초안 만들기',path:'노출·추천 → 추천 여행 만들기 → 새 초안 만들기',purpose:'지역·며칠·원하는 여행만 적어 추천 초안 생성',steps:['② 여행 지역 선택','③ 여행 기간 선택. 2박 3일은 3일로 선택','④ 원하는 여행 내용을 간단히 입력. 선택 항목이라 비워도 됨','⑤ 추천 여행 초안 만들기 클릭'],notes:['현재 초안은 등록 자료와 내부 배치 규칙으로 구성. 외부 AI가 실제 연결된 결과로 보지 않기.','지역에 공개 가능한 장소가 없으면 장소·업체에서 먼저 검수·공개.','고객 개인 여행이 아니라 운영자가 제공하는 추천 여행 콘텐츠.']},[
 c('내가 만든 추천 여행',active(p).getByRole('heading',{name:'내가 만든 추천 여행',exact:true}).locator('..'),'저장한 초안·공개 여행 목록','목록의 제목 선택해 이어서 수정, 새 초안 만들기로 새 콘텐츠 시작','초안과 공개본의 상태 확인'),
 c('여행 지역',field(p,'여행 지역'),'추천 여행을 만들 지역','부산처럼 시·도 또는 필요한 하위 지역 선택','해당 지역의 등록 장소를 사용'),
 c('여행 기간',field(p,'여행 기간'),'DAY 개수','1~14일 중 선택','선택한 개수만큼 DAY 구성'),
 c('여행 요청',field(p,'어떤 여행을 만들까요? (선택)'),'포함하고 싶은 활동·식사·카페·숙박 조건','짧은 자연어로 입력','가능한 등록 후보로 초안 구성'),
 c('초안 생성',button(p,'추천 여행 초안 만들기'),'DAY와 방문 후보 구성','조건 확인 후 클릭','초안 편집 화면으로 이어짐')]);
 // Generate the actual local rule-based draft from isolated sample records.
 await button(p,'추천 여행 초안 만들기').click();await expect(tab(p,'DAY 1')).toBeVisible();await field(p,'여행기 제목').fill('예시 · 부산 2일 추천 여행');await button(p,'초안 저장').click();await expect(p.getByRole('status')).toBeVisible();
 const generatedTitle='예시 · 부산 2일 추천 여행';
 // Show the actual imported Busan source draft, which has real licensed catalog images; it remains private.
 const sourceButton=active(p).getByRole('button',{name:/^부산의 오래된 골목과 새 바다/}).first();
 if(await sourceButton.count())await sourceButton.click();
 await field(p,'여행기 제목').scrollIntoViewIfNeeded();
 const dayArticle=active(p).locator('.admin-editorial-visit').first();await top(p);
 await capture(p,{id:'curated-day',menu:'exposure',title:'DAY별 장소·시간대·사진 다듬기',path:'노출·추천 → 추천 여행 만들기 → 추천 여행 선택',purpose:'자동으로 만든 초안이나 기존 추천 여행을 DAY별로 수정',steps:['① 수정할 추천 여행 선택','② 제목과 ③ DAY 선택','④ 장소를 보고 방문 순서 확인','⑤ 시간대·소개·사진 수정 펼쳐 세부 내용 수정','⑥ 위·아래 화살표, 제외, 다른 DAY 이동으로 배치 조정'],notes:['공개 검수 전 등록 자료 표시가 있다면 해당 장소를 먼저 검수·공개해야 추천 여행 공개 가능.','DAY 제목·소개와 여행 소개는 접힌 항목을 펼쳐 수정. 표지는 아래 표지 사진 선택에서 설정.','장소 추가는 DAY 아래 공개 등록 장소 선택에서 진행. 식사·카페·숙박도 함께 배치 가능.','화면의 기존 홈 추천 원본은 검수를 마치기 전에는 비공개 초안.']},[
 c('추천 여행 목록',active(p).getByRole('heading',{name:'내가 만든 추천 여행',exact:true}).locator('..'),'다른 추천 여행을 골라 이어서 수정','초안·공개 상태와 제목을 확인하고 선택','선택한 여행 내용 열림'),
 c('여행 제목',field(p,'여행기 제목'),'고객에게 보일 추천 여행 제목','여행 특징이 드러나는 제목 입력','저장·공개 시 제목 반영'),
 c('DAY 선택',tab(p,'DAY 1').locator('..'),'날짜별 방문 목록','DAY 1·2·3 탭 선택','해당 DAY만 편집'),
 c('여행 소개 수정',active(p).locator('summary').filter({hasText:'여행 소개 수정'}),'여행 전체 소개 수정','펼쳐 여행 특징과 추천 이유 입력','여행 제목 아래 소개 반영'),
 c('DAY 제목·소개',active(p).locator('summary').filter({hasText:'DAY 제목·소개'}),'DAY별 제목과 추천 설명','펼쳐 해당 DAY의 제목·소개 입력','현재 DAY 설명 수정')]);
 await dayArticle.locator('summary').filter({hasText:'시간대·소개·사진 수정'}).click();await dayArticle.locator('.admin-actions').last().scrollIntoViewIfNeeded();
 await capture(p,{id:'curated-visit-detail',menu:'exposure',title:'방문 한 곳의 시간대·소개·사진·순서 수정',path:'노출·추천 → 추천 여행 만들기 → DAY 방문 → 시간대·소개·사진 수정',purpose:'방문 항목별 시간대와 설명을 조정하고 DAY 사이 이동',steps:['① 방문 시간대를 선택','② 해당 장소를 추천하는 소개 입력','③ 사용 가능한 사진 선택','④ 사진·장소의 원자료와 사용 조건 확인','⑤ ↑·↓로 순서 변경, ×로 제외, 다른 DAY 선택으로 옮기기'],notes:['순서와 시간대는 별개. 장소를 옮긴 뒤 시간대도 일정에 맞게 확인.','다른 DAY로 이동하면 현재 DAY에서 빠지고 선택한 DAY에 추가.','수정 내용은 초안 저장하거나 확인하고 공개해야 저장본에 반영.']},[
 c('제안 시간대',dayArticle.getByLabel('제안 시간대',{exact:true}),'오전·점심·오후·저녁·숙박 방문 시간대','여행 흐름에 맞게 선택','현재 방문 시간대 반영'),
 c('장소 소개',dayArticle.getByLabel('장소 소개',{exact:true}),'이 방문의 추천 설명','방문 이유와 팁 입력','추천 여행의 장소 소개 변경'),
 c('장소 사진',dayArticle.getByLabel('장소 사진',{exact:true}),'해당 방문에 쓸 사진','사용 가능한 사진 중 선택','현재 방문 이미지 변경'),
 c('원자료·출처',dayArticle.locator('.admin-source-credit').first(),'장소 설명과 사진 출처·사용 조건','원자료 링크와 저작자·라이선스 확인','공개 전 자료 권리 확인'),
 c('순서·제외·DAY 이동',dayArticle.locator('.admin-actions').last(),'방문 배치 변경','↑·↓로 순서, ×로 제외, 다른 DAY로 이동','현재 추천 여행의 방문 배치 변경')]);
 // Return to the saved generated example; publish using the UI rather than inserting a forged result.
 await active(p).getByRole('button',{name:new RegExp('^'+generatedTitle)}).click();await button(p,'확인하고 공개').scrollIntoViewIfNeeded();
 await capture(p,{id:'curated-publish',menu:'exposure',title:'초안 저장 → 미리보기 → 공개',path:'노출·추천 → 추천 여행 만들기 → 편집 영역 하단',purpose:'고객에게 공개하기 전 내용을 확인하고, 작성 중인 내용은 초안으로 보관',steps:['① 빠진 장소가 있으면 추가','② 표지 사진 선택을 펼쳐 표지 지정','③ 여행기 미리보기로 구성 확인','아직 작업 중이면 ④ 초안 저장','확인 끝나면 ⑤ 확인하고 공개. 이후 위쪽 메인에 게시로 이동'],notes:['초안 저장은 비공개 저장. 확인하고 공개는 추천 여행 콘텐츠를 공개하는 작업. 홈 메인 게시는 별도.','공개 전 확인 경고가 있으면 장소 상태·좌표·출처·사용 권한 등을 먼저 보완.','예시 화면은 새 브라우저 안의 운영 예시 자료. 실제 고객 개인 여행이나 여행기를 바꾸지 않음.']},[
 c('DAY 장소 추가',field(p,'이 DAY에 장소 추가'),'DAY에 새 방문 항목 추가','공개 등록 장소 중 선택','선택한 DAY 끝에 방문 항목 추가'),
 c('표지 사진',active(p).locator('summary').filter({hasText:'표지 사진 선택'}),'추천 여행 표지 선택','펼쳐 현재 장소의 사용 가능한 사진 선택','고객용 추천 여행 표지 반영'),
 c('여행기 미리보기',button(p,'여행기 미리보기'),'고객용 본문 구성 확인','클릭해 글·DAY·사진·출처 확인','공개 전 화면 확인'),
 c('초안 저장',button(p,'초안 저장'),'추천 여행을 비공개 초안으로 저장','새 추천 여행의 작성 내용을 저장할 때 클릭. 이미 공개한 여행은 노출 중단 여부를 먼저 확인','비공개 작성 중으로 저장. 이미 공개한 추천 여행도 비공개로 바뀔 수 있음','장소 수정 초안과 달리 추천 여행은 기존 공개본을 유지하는 별도 초안이 아님. 초안 저장으로 메인 노출이 중단될 수 있음'),
 c('확인하고 공개',button(p,'확인하고 공개'),'검수한 추천 여행 공개','차단 항목이 없는지 확인하고 클릭','공개 상태로 바뀌고 메인 게시 작업 가능')]);
 await button(p,'확인하고 공개').click();await expect(p.getByRole('status')).toBeVisible();await button(p,'메인에 게시').click();await choose(p,'게시 여부','on');await field(p,'소개').fill('식사와 카페를 포함한 부산 2일 여행 제안');await field(p,'종료일 (선택)').fill('2027-10-12T18:00');await top(p);
 await capture(p,{id:'main-post',menu:'exposure',title:'홈에 올릴 대상·제목·기간 정하기',path:'노출·추천 → 메인 게시 관리',purpose:'공개한 자료를 홈·발견에 게시하고 노출 순서 관리',steps:['① 게시 위치 확인. 추천 여행은 홈 추천 일정','② 게시 항목 추가 또는 기존 항목 선택','③ 공개 대상 선택','④ 제목·소개·대표 사진 확인','⑤ 시작·종료 시각 선택. 기간 제한 없으면 비워두기','⑥ 게시 여부 켜짐 선택 → ⑦ 게시 설정 저장'],notes:['공개 대상만 선택 가능. 장소·여행을 먼저 공개해야 대상 목록에 나타남.','시작일 전·종료일 후에는 고객 화면에서 안 보임. 게시 여부 꺼짐은 게시 초안 보관.','목록에 게시한 항목이 생기면 ↑·↓로 위치별 순서 조정. 검색 중에는 순서 변경 불가. 검색 초기화 후 조정.','표지 사진은 홈 채널에서 선택 사항. 발견 사진·영상·지역 안내는 해당 채널의 미디어 요건 충족 필요.']},[
 c('게시 위치',field(p,'게시 위치'),'홈 추천 일정·홈 추천 여행기·홈 인기 장소·발견 등의 게시 위치','게시할 채널 선택','선택 채널의 목록·대상 조건 표시'),
 c('게시 항목 추가·목록',active(p).getByRole('heading',{name:'메인·발견 게시 목록',exact:true}).locator('..'),'신규 게시 설정과 기존 항목 수정','게시 항목 추가로 새 항목 등록, 목록 제목으로 기존 설정 열기','채널별 게시 설정 편집'),
 c('공개 대상',field(p,'대상'),'게시할 공개 여행·장소','공개 대상 선택','원본 콘텐츠와 게시 설정 연결'),
 c('제목·소개·대표 미디어',field(p,'화면에 보일 제목'),'홈에 표시할 제목과 소개·사진','아래 소개·대표 사진도 함께 확인','카드에 표시할 문구와 표지 설정'),
 c('게시 기간',field(p,'시작일 (선택)').locator('..').locator('..'),'게시 시작·종료 시각','필요할 때만 입력, 종료는 시작보다 뒤로 설정','정해진 기간만 게시')]);
 await button(p,'게시 설정 저장').scrollIntoViewIfNeeded();
 await capture(p,{id:'main-post-save',menu:'exposure',title:'게시 기간·켜짐 확인 후 저장',path:'노출·추천 → 메인 게시 관리 → 게시 설정 하단',purpose:'공개 자료를 메인에 보이게 할 기간과 게시 여부 확정',steps:['① 시작·종료일 확인','② 기기 시간대 확인','③ 게시 여부를 켜짐 또는 꺼짐으로 선택','④ 게시 설정 저장. 꺼짐이면 게시 초안 저장','저장 뒤 고객 화면 보기에서 현재 게시 결과 확인'],notes:['새 자료는 공개만으로 새 메인 게시 항목이 생기지 않음. 메인 게시 설정을 따로 만들어야 함.','이미 게시 중인 대상이나 기존 홈 추천 원본을 수정·공개하면 연결된 홈 콘텐츠도 갱신될 수 있음. 공개 전 기존 게시 상태까지 확인.','기간은 기기 시간대로 입력하고 저장. 종료일은 시작일보다 뒤여야 함.']},[
 c('게시 기간',field(p,'시작일 (선택)').locator('..').locator('..'),'선택적인 시작·종료 날짜와 시각','필요할 때 입력, 기간 제한 없으면 비우기','기간을 통과할 때만 노출'),
 c('시각 기준',active(p).getByText(/게시 시각은 기기 시간대/),'게시 시각 표시 기준','현재 기기 시간대 확인','운영자가 예상한 시각에 게시되도록 확인'),
 c('게시 여부',field(p,'게시 여부'),'켜짐 또는 게시 초안','고객에게 보이게 할 때 켜짐 선택','공개·기간·권리 조건을 충족할 때 노출'),
 c('게시 설정 저장',button(p,'게시 설정 저장'),'현재 대상의 게시 설정 적용','확인 후 저장','채널별 게시 목록과 고객 미리보기에 반영')]);
 await button(p,'게시 설정 저장').click();await expect(p.getByRole('status')).toBeVisible();await tab(p,'인기 콘텐츠').click();await top(p);
 await capture(p,{id:'popularity',menu:'exposure',title:'인기 장소·여행기를 골라 메인에 올리기',path:'노출·추천 → 인기 콘텐츠',purpose:'저장 수 순위를 보고 홈에 올릴 공개 콘텐츠 선정',steps:['① 랜드마크·장소 업체·여행기 중 조회 대상 선택','② 제목·지역 검색으로 범위 좁히기','③ 저장 수와 자료 상태 확인','④ 메인에 게시 버튼 선택','조건 미충족이면 자료 공개·좌표·권리 등을 먼저 보완','⑤ 게시 설정에서 기간과 표지 등을 수정'],notes:['인기는 저장 수 집계. 숫자를 관리자 임의로 입력하거나 변경하지 않음.','로컬 예시 집계와 실제 서버 집계를 구분. 실제 집계 연결 전에는 예시 수치로 인기 판단하지 않기.','검수용 가상 장소·가상 여행기는 고객 홈에 직접 게시할 수 없음.','메인 게시 중인 항목은 중복 게시 대신 게시 설정에서 수정.']},[
 c('인기 자료 종류',tab(p,'인기 랜드마크').locator('..'),'인기 랜드마크·장소 업체·여행기','조회할 자료 종류 선택','종류별 저장 수 순위 표시'),
 c('검색',active(p).getByRole('searchbox').first(),'제목·지역으로 인기 자료 찾기','검색어 입력, 검색 초기화로 전체 보기','일치하는 자료 표시'),
 c('순위·저장 수',active(p).locator('table').first(),'읽기 전용 인기 집계와 현재 자료 상태','저장 수·공개 상태·게시 가능 여부 함께 검토','메인에 올릴 자료 판단'),
 c('메인에 게시',active(p).getByRole('button',{name:'메인에 게시',exact:true}).first(),'인기 자료를 홈 게시 항목으로 추가','자료 조건을 충족한 경우 클릭','홈 인기 장소 또는 홈 추천 여행기에 게시'),
 c('장소 검수',active(p).getByRole('button',{name:'장소 검수',exact:true}).first(),'게시 조건이 부족한 장소 보완','장소 검수로 이동해 좌표·공개·사용 조건 확인','보완 후 메인 게시 가능')]);
 await tab(p,'고객 화면 보기').click();await choose(p,'미리보기 채널','HOME_TRIP');await top(p);
 await capture(p,{id:'customer-preview',menu:'exposure',title:'고객에게 보일 게시 콘텐츠 확인',path:'노출·추천 → 고객 화면 보기',purpose:'현재 공개·기간·사용 조건을 통과하는 게시 콘텐츠만 확인',steps:['① 미리보기 채널 선택','② 표지·제목·소개 확인','③ 여행기 본문 미리보기 펼쳐 DAY와 장소 확인','내용을 수정하려면 메인 게시 관리 또는 추천 여행 만들기로 이동'],notes:['여기에 안 보이면 공개 상태, 게시 여부, 시작·종료일, 자료 사용 조건 확인.','실제 고객 홈은 왼쪽 아래 고객 화면 열기로 함께 확인.']},[
 c('미리보기 채널',field(p,'미리보기 채널'),'확인할 홈·발견 채널','채널 선택','현재 노출 가능한 게시 콘텐츠만 표시'),
 c('게시 콘텐츠',active(p).locator('.admin-preview').first(),'고객용 제목·소개·표지','화면에 보이는 글과 이미지를 검토','게시 결과와 운영자 추천 표시 확인'),
 c('여행기 본문',active(p).locator('.admin-preview summary').first(),'추천 여행의 DAY·장소·출처 확인','여행기 본문 미리보기 펼치기','전체 추천 여행 내용 확인'),
 c('고객 화면 열기',p.getByRole('link',{name:/고객 화면 열기/}),'실제 고객 홈으로 이동','왼쪽 아래 링크로 고객 화면 확인','관리자 미리보기와 고객 홈을 비교')]);

 await menu(p,'여행기·커뮤니티');await field(p,'신고 처리 사유').fill('신고 대상과 관련 카드 댓글을 확인한 뒤 처리한 근거 입력');await top(p);
 await capture(p,{id:'report',menu:'community',title:'신고 대상과 문맥 확인 후 처리하기',path:'여행기·커뮤니티 → 신고·이의',purpose:'신고를 접수 내용·대상·관련 여행기와 함께 확인하고 처리 이력 기록',steps:['① 신고 검색·처리 상태로 대상을 찾기','② 신고 선택','③ 신고 대상·사유·원문과 ④ 관련 여행기·카드·댓글 확인','숨김 등 콘텐츠 조치가 필요하면 ⑤ 여행기와 댓글 문맥 확인으로 이동','⑥ 처리 근거 입력 후 ⑦ 처리 완료 또는 해당 없음 기록'],notes:['신고 처리 완료는 접수 건의 판단 기록. 여행기·댓글 숨김은 공개 여행기·댓글 화면에서 별도 조치.','프로필 신고는 회원 관리, 장소 신고는 장소 정보 확인으로 이동. 사진·저작권 이의는 사진과 사용 권리도 확인.','처리 사유·운영자·시각·대상은 관련 조치 이력에 남음.']},[
 c('신고 검색·상태',field(p,'처리 상태').locator('..'),'미처리·처리 완료·해당 없음·전체 보기','검색어와 상태 선택','처리할 신고 목록 필터'),
 c('신고 선택',active(p).locator('.admin-list button.admin-card').first(),'신고 대상 선택','신고 카드를 클릭','오른쪽 상세에 해당 신고 표시'),
 c('대상·신고 내용',active(p).getByText('COMMENT · review-comment-2',{exact:true}),'여행기·카드·댓글 등 정확한 신고 대상','대상 ID와 접수 원문 확인','잘못된 자료를 조치하는 실수 방지'),
 c('관련 문맥',active(p).locator('.admin-report-context').first(),'신고와 연결된 여행기·장소 카드·댓글','원문·관련 답글·사진을 함께 확인','신고 내용을 주변 문맥과 함께 판단')]);
 await active(p).getByRole('heading',{name:'관련 조치 이력',exact:true}).scrollIntoViewIfNeeded();
 await capture(p,{id:'report-decision',menu:'community',title:'신고 처리 사유와 판단 기록',path:'여행기·커뮤니티 → 신고·이의 → 신고 상세 하단',purpose:'신고 접수 건에 대한 판단과 처리 근거를 남기기',steps:['① 문맥 확인으로 이동해 실제 콘텐츠 조치가 필요한지 검토','② 신고 처리 사유 입력','③ 처리 완료 또는 해당 없음 선택','④ 관련 조치 이력에서 처리 결과 확인'],notes:['처리 완료 기록만으로 댓글·여행기가 자동 숨겨지지 않음. 콘텐츠 조치는 공개 여행기·댓글에서 별도로 수행.','대상·원문·사유·운영자·시각이 남도록 처리하며 원문을 다른 내용으로 덮어쓰지 않음.']},[
 c('여행기와 댓글 문맥 확인',button(p,'여행기와 댓글 문맥 확인'),'관련 콘텐츠와 스레드로 이동','버튼 선택해 실제 여행기·카드·댓글 확인','대상을 정확히 확인한 뒤 콘텐츠 조치'),
 c('신고 처리 사유',field(p,'신고 처리 사유'),'접수 건 판단 근거','확인한 내용과 처리 이유 입력','신고 기록에 사유 보존'),
 c('처리 완료·해당 없음',button(p,'처리 완료 기록').locator('..'),'신고의 처리 결과 기록','판단에 맞는 결과 선택','신고 상태 변경, 콘텐츠 자동 숨김 아님'),
 c('관련 조치 이력',active(p).getByRole('heading',{name:'관련 조치 이력',exact:true}),'대상·처리 근거 기록 확인','변경 후 표시되는 이력 확인','운영자·시각·대상·사유 보존 확인')]);
 await tab(p,'공개 여행기·댓글').click();await top(p);
 await capture(p,{id:'journal',menu:'community',title:'공개 여행기와 원문 확인',path:'여행기·커뮤니티 → 공개 여행기·댓글',purpose:'공개 여행기 본문·사진·카드와 언어별 내용을 읽고 대상 확인',steps:['① 여행기 검색 후 ② 목록에서 선택','③ 원문 또는 English 선택','④ 작성자·본문·사진·카드 내용 확인','카드 아래 대화 보기 버튼으로 카드별 댓글 위치 이동','숨김·삭제 조치는 아래 조치 사유를 적은 뒤 실행'],notes:['작성자가 비공개·삭제한 본문은 기본 조회에서 제외. 관리자가 다시 공개할 수 없음.','개인 일정·예약·개인 메모는 이 공개 여행기 목록에 포함하지 않음.','여행기 전체 댓글과 장소 카드별 댓글은 서로 다른 대화. 같은 업체라고 합치지 않음.']},[
 c('여행기 검색',active(p).getByRole('searchbox',{name:'여행기 제목·ID 검색',exact:true}),'공개 여행기 찾기','제목 또는 ID 입력','일치하는 여행기 목록 표시'),
 c('여행기 선택',active(p).locator('.admin-list button.admin-card').first(),'확인할 여행기와 작성자 공개 상태','목록에서 제목 선택','오른쪽 본문과 조치 영역 열림'),
 c('원문·English',button(p,'원문').locator('..'),'원문과 번역 비교 보기','전체 원문 또는 English 선택','선택 언어로 본문과 댓글 확인'),
 c('작성자·내용',active(p).locator('.admin-reading-preview').first(),'여행기 글·사진·카드 확인','본문을 읽고 사진 출처 확인','신고 대상과 조치 범위 판단'),
 c('카드 대화 보기',active(p).getByRole('button',{name:'이 장소 카드의 댓글 확인',exact:true}).first(),'해당 장소 카드 스레드로 이동','카드 아래 버튼 선택','그 카드의 댓글·답글만 확인')]);
 await field(p,'조치 사유').fill('해당 여행기 또는 댓글에 대한 확인 내용과 조치 근거 입력');await tab(p,'여행기 전체 댓글·응원').click();await active(p).getByRole('button',{name:'댓글 숨김',exact:true}).first().scrollIntoViewIfNeeded();await p.locator('.admin-main').evaluate(e=>e.scrollTop=Math.max(0,e.scrollTop-100));
 await capture(p,{id:'thread-actions',menu:'community',title:'여행기·카드별 댓글과 답글 조치',path:'여행기·커뮤니티 → 공개 여행기·댓글 → 하단 스레드',purpose:'전체 댓글과 장소 카드별 댓글을 구분하고 정확한 대상만 조치',steps:['① 조치 사유를 먼저 입력','② 여행기 전체를 조치할 때만 여행기 숨김·해제·삭제 선택','③ 전체 댓글 또는 장소 카드 탭 선택','④ 댓글과 들여쓰기 된 답글 확인','⑤ 해당 댓글의 숨김·해제·삭제 버튼 선택','관련 조치 이력에서 운영자·사유·결과 확인'],notes:['신고 대상이 댓글 한 개면 여행기 전체 숨김 버튼을 누르지 않기.','최상위 댓글은 최신순, 답글은 시간순. 다른 카드와 여행기의 댓글은 유지.','숨김 해제는 작성자가 계속 공개 중인 자료에만 가능. 삭제 조치는 사유가 필요한 별도 기록.']},[
 c('조치 사유',field(p,'조치 사유'),'콘텐츠 조치에 남길 근거','검토한 내용과 이유 입력','여행기·댓글 조치 기록에 반영'),
 c('여행기 전체 조치',button(p,'여행기 숨김').locator('..'),'여행기 전체 숨김·해제·삭제','전체 콘텐츠 조치가 필요한 경우만 실행','해당 여행기의 공개 노출 상태 변경'),
 c('댓글 대상 탭',tab(p,'여행기 전체 댓글·응원').locator('..'),'전체 댓글·응원과 카드별 댓글·좋아요 구분','전체 또는 장소 카드 이름 선택','선택한 대상의 스레드만 표시'),
 c('댓글·답글',active(p).getByText('전체 여행기에 남기는 샘플 댓글입니다.',{exact:true}),'댓글 원문·작성자·시각·상태','답글 들여쓰기와 대상 ID까지 확인','조치할 한 댓글 식별'),
 c('해당 댓글 조치',active(p).getByRole('button',{name:'댓글 숨김',exact:true}).first().locator('..'),'이 댓글만 숨김·해제·삭제','댓글 안의 필요한 버튼 선택','다른 댓글·카드에 영향 없이 해당 댓글 조치')]);
 await tab(p,'샘플 장소 카드 A').click();await active(p).getByRole('button',{name:'댓글 숨김',exact:true}).last().scrollIntoViewIfNeeded();
 await capture(p,{id:'card-replies',menu:'community',title:'장소 카드별 댓글과 답글 구분',path:'여행기·커뮤니티 → 공개 여행기·댓글 → 장소 카드 이름 탭',purpose:'여행기 안의 특정 카드 대화만 보고 댓글·답글 한 개에 조치',steps:['위쪽 조치 사유 입력 후 해당 장소 카드 탭 선택','① 댓글 내용과 ID·작성 시각 확인','② 그 댓글의 조치 버튼 선택','③ 들여쓰기 된 답글 확인','답글만 조치할 때는 ④ 답글 안의 버튼 선택'],notes:['같은 업체여도 다른 카드·여행기의 댓글은 서로 별개. 여행기＋카드 기준으로 관리.','카드별 좋아요 수와 좋아요한 공개 회원은 위쪽 카드 영역에서 확인. 서버가 제공하지 않은 목록은 미제공 표시.','답글을 숨기려고 원 댓글 또는 여행기 전체를 조치하지 않기.']},[
 c('카드 댓글',active(p).getByText('첫 번째 카드에 남기는 샘플 댓글입니다.',{exact:true}),'선택한 카드에 남긴 댓글','원문·댓글 ID·작성자·시각 확인','정확한 댓글 식별'),
 c('댓글 조치',active(p).getByRole('button',{name:'댓글 숨김',exact:true}).first().locator('..'),'이 댓글만 숨김·해제·삭제','원 댓글 안의 버튼 선택','현재 댓글만 조치'),
 c('답글',active(p).getByText('첫 번째 카드 댓글의 샘플 답글입니다.',{exact:true}),'원 댓글에 연결된 답글','들여쓰기·답글 표시와 내용 확인','원 댓글과 답글 구분'),
 c('답글 조치',active(p).getByRole('button',{name:'댓글 숨김',exact:true}).last().locator('..'),'이 답글만 조치','답글 안의 버튼 선택','다른 댓글·카드를 변경하지 않고 답글 조치')]);
 await tab(p,'번역 검수').click();await top(p);
 await capture(p,{id:'translation',menu:'community',title:'원문과 영어 번역 비교·검수',path:'여행기·커뮤니티 → 번역 검수',purpose:'현재 원문 버전에 맞춰 번역 내용을 확인하고 검수 상태 기록',steps:['① 여행기 선택','② 한국어 원문 확인','③ 영어 번역 내용 수정','④ 검수 메모 입력','수정 중이면 ⑤ 검수 초안 저장, 확인 완료면 ⑥ 번역 검수 완료'],notes:['원문은 읽기 전용. 원문 버전이 변경됐다면 최신 저장본을 확인한 뒤 다시 검수.','비공개 원문과 번역은 조회하지 않음. 이 화면은 원문과 번역 검수 상태를 관리하는 곳.']},[
 c('여행기 목록',active(p).locator('.admin-list button.admin-card').first(),'번역 검수할 여행기','제목 선택','해당 원문·번역 표시'),
 c('한국어 원문',field(p,'한국어 원문'),'번역 기준 원문','읽고 맥락 확인','원문을 바꾸지 않고 번역 검토'),
 c('영어 번역',field(p,'영어 번역'),'수정할 영어 내용','원문 의미·장소명·용어에 맞게 수정','번역 초안 작성'),
 c('검수 메모',field(p,'검수 메모'),'수정 이유와 주의사항','오역·용어 변경 근거 입력','다음 검수자가 판단 근거 확인'),
 c('검수 초안 저장',button(p,'검수 초안 저장'),'확정 전 내용 보관','검수 중 저장할 때 클릭','검수 대기 상태로 저장'),
 c('번역 검수 완료',button(p,'번역 검수 완료'),'현재 원문 버전 번역 검수 확정','확인 끝난 뒤 클릭','번역 검수 완료 상태 기록')]);

 await menu(p,'회원·문의');await active(p).getByRole('button',{name:/검수 회원 B/}).click();await field(p,'조치 사유').fill('공개 프로필과 본인 요청을 확인한 근거 입력');await field(p,'기간 정지 종료일').fill('2026-11-12T18:00');await top(p);
 await capture(p,{id:'members',menu:'members',title:'회원 공개 프로필·경고·정지 관리',path:'회원·문의 → 회원·삭제 요청',purpose:'회원의 공개 활동과 이용 상태를 확인하고 근거를 남겨 조치',steps:['① 공개 이름·회원 ID로 검색','② 회원 선택','③ 공개 프로필·공개 활동과 이용 상태 확인','④ 조치 사유 입력','경고는 ⑥ 경고 기록, 기간 정지는 ⑤ 종료일을 정한 뒤 ⑥ 기간 정지 기록','정지 상태 회원만 사유 입력 후 정지 해제 가능'],notes:['개인 일정·메모·예약·대화 원문은 기본 관리자 자료에서 제외.','등급·활동 수치는 서버 집계 사용. 제공 안 된 값은 —로 표시하며 임의 수정하지 않음.','계정 삭제 요청은 아래 별도 영역에서 접수 → 확인 중 → 삭제 처리 대기 순으로 기록. 실제 삭제 완료와 구분.']},[
 c('회원 검색',active(p).getByRole('searchbox',{name:'공개 이름·회원 ID 검색',exact:true}),'공개 이름·회원 ID 찾기','이름 또는 ID 입력','일치하는 회원 표시'),
 c('회원 선택',active(p).getByRole('button',{name:/검수 회원 B/}),'관리할 회원과 삭제 요청 여부','회원 카드 선택','공개 프로필·상태·요청 상세 열림'),
 c('공개 프로필·활동',active(p).locator('.admin-member-metrics'),'공개 여행기·팔로워·담김·조회 집계','예시인지 서버인지 출처와 상태 확인','공개 활동 범위에서 회원 확인'),
 c('조치 사유',field(p,'조치 사유'),'경고·정지·삭제 요청 처리 근거','확인한 사실과 조치 이유 입력','운영자·대상·사유가 이력에 보존'),
 c('기간 정지 종료일',field(p,'기간 정지 종료일'),'정지가 끝나는 시각','미래의 날짜·시각 지정','기간 정지 실행 조건 설정'),
 c('경고·기간 정지·해제',button(p,'경고 기록').locator('..'),'이용 상태 조치','상황에 맞는 버튼 선택','경고 기록 또는 회원 상태 변경')]);
 await field(p,'삭제 요청 처리 상태').scrollIntoViewIfNeeded();
 await capture(p,{id:'member-deletion',menu:'members',title:'계정 삭제 요청과 관련 이력 확인',path:'회원·문의 → 회원·삭제 요청 → 삭제 요청 회원 → 하단',purpose:'본인이 신청한 계정 삭제 요청을 단계별로 확인하고 처리 상태 기록',steps:['위쪽 조치 사유에 본인 요청 확인 근거 입력','① 접수 시각·현재 상태 확인','② 접수 → 확인 중 → 삭제 처리 대기 순서로 진행','③ 요청 상태 기록 클릭','④ 공개 프로필 신고와 ⑤ 관련 조치 이력 확인'],notes:['접수에서 바로 삭제 처리 대기로 넘어갈 수 없음. 본인 요청 확인을 마친 뒤 다음 단계 진행.','이 화면의 요청 상태 기록은 실제 계정 삭제 완료가 아님. 서버 삭제 결과와 구분해 확인.','철회된 요청은 다시 진행할 수 없고 새로운 요청을 기다려야 함.']},[
 c('계정 삭제 요청',active(p).getByRole('heading',{name:'계정 삭제 요청',exact:true}),'삭제 요청 접수와 현재 상태','접수 날짜·상태를 함께 확인','본인 요청의 처리 단계 파악'),
 c('삭제 요청 처리 상태',field(p,'삭제 요청 처리 상태'),'다음 처리 단계','확인 중 또는 허용된 다음 상태 선택','가능한 단계만 선택'),
 c('요청 상태 기록',button(p,'요청 상태 기록'),'사유와 요청 상태 저장','위쪽 조치 사유를 입력하고 클릭','상태 변경과 운영 이력 기록'),
 c('공개 프로필 신고',active(p).getByRole('heading',{name:'공개 프로필 신고',exact:true}),'회원 관련 공개 프로필 신고','본문·상태 확인','별도 신고 처리 필요 여부 판단'),
 c('관련 조치 이력',active(p).getByRole('heading',{name:'관련 조치 이력',exact:true}),'회원에게 한 이전 처리','시각·운영자·동작·사유 확인','중복·잘못된 조치 방지')]);
 await tab(p,'문의 처리').click();await field(p,'답변 기록').fill('사진 출처는 장소 상세의 사진 출처에서 확인할 수 있어요. 확인한 URL과 사용 조건을 함께 기록해 둘 것.');await top(p);
 await capture(p,{id:'inquiries',menu:'members',title:'접수 문의 담당자·처리 상태·답변 기록',path:'회원·문의 → 문의 처리',purpose:'문의 원문을 읽고 담당자와 진행 상태·내부 답변 기록 관리',steps:['① 문의 검색 후 목록 선택','② 문의 원문과 회원 확인','③ 담당자 지정','④ 처리 상태를 접수·처리 중·처리 완료 중 선택','⑤ 답변 내용을 내부 기록으로 작성','⑥ 문의 처리 기록 저장'],notes:['저장 버튼은 문의 처리와 내부 답변 기록 저장. 이메일·알림을 발송하는 기능 아님.','과거 답변 기록은 아래 날짜·운영자와 함께 표시. 담당자가 바뀌어도 이전 기록 유지.']},[
 c('문의 목록·검색',active(p).getByRole('searchbox',{name:'문의 제목·ID 검색',exact:true}),'처리할 접수 문의','제목·ID로 찾고 문의 카드 선택','오른쪽 문의 상세 표시'),
 c('문의 원문',active(p).getByText('장소 사진의 출처를 어디에서 확인할 수 있나요?',{exact:true}),'회원이 접수한 내용','문의 내용과 연결 자료 확인','답변과 처리 범위 판단'),
 c('담당자',field(p,'담당자'),'문의 처리 담당 운영자','담당자 선택','업무 인계 대상 기록'),
 c('처리 상태',field(p,'처리 상태'),'접수·처리 중·처리 완료','현재 진행 단계에 맞게 선택','목록 상태 반영'),
 c('답변 기록',field(p,'답변 기록'),'고객 문의에 대한 내부 답변 기록','답변과 처리 근거 입력','답변 기록에 시각·운영자·내용 보관'),
 c('문의 처리 기록 저장',button(p,'문의 처리 기록 저장'),'담당자·상태·답변 기록 저장','완료 후 클릭','문의 처리 기록 저장, 별도 이메일·알림 발송 없음')]);
 const item=id=>pages.find(page=>page.id===id);
 item('curated-publish').notes.push('이미 공개한 추천 여행에서 초안 저장을 누르면 현재 구현은 비공개로 바뀌어 메인 노출이 중단될 수 있음. 장소의 수정 초안·기존 공개본 유지 방식과 다름. 공개 중인 내용을 수정할 때는 미리보기로 확인한 뒤 확인하고 공개하거나, 노출 중단을 의도한 경우에만 초안 저장.');
 item('thread-actions').notes.push('댓글 숨김 해제는 작성자가 여행기를 공개 중이고 여행기 자체도 숨김 해제(VISIBLE) 상태일 때만 가능. 여행기가 숨김 상태면 먼저 여행기 상태를 확인. 삭제 조치 후에는 이 화면에서 복구할 수 없음.');
 item('exposure-start').callouts[4].what='새 메인 게시 항목은 자료 공개와 별도로 설정';
 item('exposure-start').notes.push('이미 게시 중인 대상·기존 홈 추천 원본은 내용을 수정해 다시 공개하면 연결된 홈 콘텐츠도 갱신될 수 있음. 공개 전 게시 상태 확인.');
 item('curated-day').steps=['① 수정할 추천 여행 선택','② 여행 제목 수정','③ DAY 선택','④ 여행 소개 수정, ⑤ DAY 제목·소개를 펼쳐 설명 수정','아래 방문 카드에서 시간대·사진·순서를 확인하고 다음 상세 화면처럼 수정'];
 item('main-post').steps=['① 게시 위치 확인. 추천 여행은 홈 추천 일정','② 게시 항목 추가 또는 기존 항목 선택','③ 공개 대상 선택','④ 제목·소개와 아래 대표 사진 확인','⑤ 시작·종료일 설정 후 아래 게시 여부·저장 화면으로 진행'];
 item('popularity').steps=['① 인기 랜드마크·장소 업체·여행기 중 조회 대상 선택','② 제목·지역 검색으로 범위 좁히기','③ 저장 수와 자료 상태 확인','조건 미충족이면 ⑤ 장소 검수로 이동해 공개·좌표·권리 보완','조건을 충족하면 ④ 메인에 게시 클릭. 이후 메인 게시 관리에서 기간·표지·순서 확인'];
 item('report').steps=['① 신고 검색·처리 상태로 대상을 찾기','② 신고 선택','③ 신고 대상과 접수 원문 확인','④ 관련 여행기·카드·댓글 문맥 확인','아래 신고 처리 사유·결과 기록 화면으로 이어서 진행'];
 fs.writeFileSync(path.join(out,'service-pages.json'),JSON.stringify(pages,null,2)+'\n');
 if(errors.length)throw Error('Browser errors: '+errors.join('\n'));console.log('SERVICE_MANUAL_PAGES',pages.length);await context.close();
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
