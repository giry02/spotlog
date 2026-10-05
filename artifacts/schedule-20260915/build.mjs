import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';
import { tasks, phases, holidays, holidaySources } from './tasks.mjs';

const root='C:/Users/Giry/Documents/Spotlog';
const out=path.join(root,'outputs/01a00d5a-887a-70b2-93cf-260846464314');
const support=path.join(root,'artifacts/schedule-20260915');
const mdDir=path.join(root,'docs/execution');
await fs.mkdir(out,{recursive:true});
await fs.mkdir(mdDir,{recursive:true});
const start='2026-09-15';
const holidaySet=new Set(holidays.map(x=>x[0]));
const date=s=>new Date(s+'T00:00:00Z');
const iso=d=>d.toISOString().slice(0,10);
const serial=d=>Math.round((d.getTime()-Date.UTC(1899,11,30))/86400000);
function nextWork(d){d=new Date(d); do{d.setUTCDate(d.getUTCDate()+1);}while(d.getUTCDay()===0||d.getUTCDay()===6||holidaySet.has(iso(d))); return d;}
function schedule(startDate,extra=0){let cursor=date(startDate);cursor.setUTCDate(cursor.getUTCDate()-1);return tasks.map((t,i)=>{let a=nextWork(cursor),b=a;for(let k=1;k<t.days+(i===0?extra:0);k++)b=nextWork(b);cursor=b;return {...t,start:iso(a),end:iso(b),row:i+5,dep:i?tasks[i-1].id:'시작'};});}
const dated=schedule(start);
assert.equal(tasks.reduce((n,t)=>n+t.days,0),100);
for(const p of phases){assert.equal(tasks.filter(t=>t.phase===p.n).reduce((n,t)=>n+t.days,0),p.days);assert.equal(tasks.filter(t=>t.phase===p.n&&t.test==='buffer').reduce((n,t)=>n+t.days,0),p.buffer);}
for(const t of tasks)for(const f of t.files)if(f!=='docs/execution/HANDOFF.md')await fs.access(path.join(root,f));
console.log('schedule',phases.map(p=>{const d=dated.filter(t=>t.phase===p.n);return [p.n,d[0].start,d.at(-1).end,p.days];}));

const wb=Workbook.create();
const overview=wb.worksheets.add('전체 일정');
const detail=wb.worksheets.add('기능별 일정');
const criteria=wb.worksheets.add('구현·완료 기준');
const gantt=wb.worksheets.add('주간 일정');
const cal=wb.worksheets.add('휴일·출처');
const navy='#23313D',accent='#E3634A',muted='#586874',border='#DDE2E6',light='#F2F5F7',input='#EAF3FC',blue='#1862A6';
const colors={1:'#DFEAF3',2:'#F7E4DA',3:'#DFEEE5'};
function col(n){let s='';while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s;}
function base(sh,end,widths){sh.showGridLines=false;const range=sh.getRange(`A1:${end}`);range.format.font={name:'Arial',size:11,color:navy};range.format.verticalAlignment='center';range.format.wrapText=true;range.format.rowHeight=29;widths.forEach((w,i)=>sh.getRange(`${col(i+1)}1:${col(i+1)}${end.match(/\d+/)[0]}`).format.columnWidthPx=w);sh.tabColor=navy;}
function mergeText(sh,r,text,fill=null,size=11){const rg=sh.getRange(r);rg.merge();rg.values=[[text]];if(fill)rg.format.fill=fill;rg.format.font={name:'Arial',size,color:navy};}
function title(sh,last,text,sub){mergeText(sh,`A1:${last}2`,text,navy,21);sh.getRange(`A1:${last}2`).format.font.color='#FFFFFF';sh.getRange('A1').format.rowHeight=28;mergeText(sh,`A3:${last}3`,sub,null,10);sh.getRange(`A3:${last}3`).format.font.color=muted;sh.getRange(`A3:${last}3`).format.rowHeight=34;}
function header(sh,range,labels){sh.getRange(range).values=[labels];sh.getRange(range).format={fill:navy,font:{name:'Arial',size:11,bold:true,color:'#FFFFFF'},wrapText:true,rowHeight:36,verticalAlignment:'center'};}
function zebra(sh,r,last,p=null){sh.getRange(`A${r}:${last}${r}`).format.fill=p?colors[p]:(r%2?light:'#FFFFFF');sh.getRange(`A${r}:${last}${r}`).format.borders={bottom:{style:'thin',color:border}};}
const last=tasks.length+4;
base(cal,'G104',[120,220,205,24,230,200,150]);title(cal,'G','휴일과 일정 기준','2026년 9월~2027년 3월 / 주말은 별도로 자동 제외함');
header(cal,'A4:C4',['휴일 날짜','구분','출처']);
holidays.forEach(([d,label],i)=>{const r=i+5;cal.getRange(`A${r}:C${r}`).values=[[date(d),label,d.startsWith('2026')?'우주항공청 2026년 월력요항':'우주항공청 2027년 월력요항']];zebra(cal,r,'C');});
cal.getRange('A5:A104').setNumberFormat('yyyy-mm-dd');
cal.getRange('A5:B104').format.font.color=blue;
mergeText(cal,'E4:G4','휴일 입력',navy);cal.getRange('E4:G4').format.font.color='#FFFFFF';
mergeText(cal,'E5:G8','휴가·임시 공휴일은 A18:B104의 빈 행에 날짜와 이름을 추가함. 날짜 계산은 A5:A104 전체를 참조함. 날짜 열에는 설명 문구를 넣지 않음. 주말과 겹치는 공휴일은 이중 차감하지 않음.',light);
mergeText(cal,'E10:G10','공식 달력 출처',navy);cal.getRange('E10:G10').format.font.color='#FFFFFF';
mergeText(cal,'E11:G13',holidaySources[0]);mergeText(cal,'E14:G16',holidaySources[1]);
mergeText(cal,'E18:G21','확인일 2026-09-15. 적용 기간 밖으로 일정을 옮기면 해당 기간의 휴일을 추가 확인함. 작업일은 기능 구현·검수에 배정한 일수이며 회의·휴가·새 요구사항은 필요에 따라 추가함.',light);
mergeText(cal,'E23:G23','기능 범위의 원본 계획',navy);cal.getRange('E23:G23').format.font.color='#FFFFFF';
for(const [i,name] of ['spotlog-development-plan','spotlog-development-summary','spotlog-ai-guide-plan','spotlog-ai-guide-summary','spotlog-data-supply-plan'].entries())mergeText(cal,`E${24+i*2}:G${25+i*2}`,`https://giry02.github.io/spotlog/${name}.html`);
cal.getRange('A5:A104').format.horizontalAlignment='center';
cal.freezePanes.freezeRows(4);

base(detail,`L${last}`,[84,62,270,135,70,70,70,116,116,90,86,130]);
title(detail,'L','기능별 세부 개발 일정','파란색 작업일·예비일·상태를 수정할 수 있음. 위에서 아래로 순차 진행하며 뒤 일정이 자동 이동함.');
header(detail,'A4:L4',['작업 ID','차수','기능','착수 시 판단','작업일','예비일','합계일','시작 예정','종료 예정','선행 작업','진행 상태','계획서 항목']);
for(const t of dated){let r=t.row;detail.getRange(`A${r}:L${r}`).values=[[t.id,`${t.phase}차`,t.title,t.current,t.test==='buffer'?0:t.days,t.test==='buffer'?t.days:0,null,null,null,t.dep,'대기',t.refs]];detail.getRange(`G${r}`).formulas=[[`=SUM(E${r}:F${r})`]];detail.getRange(`H${r}`).formulas=[[r===5?`=WORKDAY('전체 일정'!$A$5-1,1,'휴일·출처'!$A$5:$A$104)`:`=WORKDAY(I${r-1},1,'휴일·출처'!$A$5:$A$104)`]];detail.getRange(`I${r}`).formulas=[[`=WORKDAY(H${r}-1,G${r},'휴일·출처'!$A$5:$A$104)`]];zebra(detail,r,'L',t.test==='buffer'?t.phase:null);detail.getRange(`A${r}:L${r}`).format.rowHeight=48;}
detail.getRange(`H5:I${last}`).setNumberFormat('yyyy-mm-dd');detail.getRange(`E5:G${last}`).setNumberFormat('0');detail.getRange(`E5:F${last}`).format.fill=input;detail.getRange(`E5:F${last}`).format.font.color=blue;detail.getRange(`K5:K${last}`).format.font.color=blue;
detail.getRange(`H5:J${last}`).format.horizontalAlignment='center';
detail.getRange(`K5:K${last}`).dataValidation={rule:{type:'list',values:['대기','진행','검수','완료','보류']}};
detail.dataValidations.add({range:`E5:F${last}`,rule:{type:'whole',operator:'between',formula1:0,formula2:100}});
detail.getRange(`G5:G${last}`).conditionalFormats.add('cellIs',{operator:'lessThan',formula:1,format:{fill:'#FFD7D1'}});
detail.tables.add(`A4:L${last}`,true,'FeatureSchedule');detail.freezePanes.freezeRows(4);detail.freezePanes.freezeColumns(3);

base(overview,'G33',[110,290,115,105,145,130,130]);title(overview,'G','Spotlog 차수별 개발 일정','2026-09-15 시작 / 프런트엔드 1·2·3차 / 기존 구현 검수와 추가 구현을 구분함');
header(overview,'A4:G4',['시작일','기능·검수 작업일','예비일','전체 작업일','완료 예정일','작업 기준','']);
overview.getRange('A5:G5').values=[[date(start),null,null,null,null,'주 5일','']];overview.getRange('A5').setNumberFormat('yyyy-mm-dd');overview.getRange('A5').format.fill=input;overview.getRange('A5').format.font.color=blue;
overview.getRange('B5:E5').formulas=[[`=SUM('기능별 일정'!E5:E${last})`,`=SUM('기능별 일정'!F5:F${last})`,`=SUM('기능별 일정'!G5:G${last})`,`='기능별 일정'!I${last}`]];overview.getRange('E5').setNumberFormat('yyyy-mm-dd');overview.getRange('A5:G5').format.rowHeight=42;overview.getRange('B5:D5').format.font.size=19;
overview.getRange('E5:F5').format.horizontalAlignment='center';
mergeText(overview,'A7:G8','시작일과 기능별 작업일을 변경하면 다음 작업·차수·주간 일정이 함께 이동함. 주말과 등록 휴일을 제외함. 기능·검수 80일에 수정 여유 20일을 별도로 배정한 계획 추정이며 실제 완료일을 보장하는 값은 아님.',light);
header(overview,'A10:G10',['차수','범위','기능·검수일','예비일','합계일','시작 예정','종료 예정']);
for(const p of phases){const r=p.n+10, ts=dated.filter(t=>t.phase===p.n),a=ts[0].row,b=ts.at(-1).row;overview.getRange(`A${r}:B${r}`).values=[[`${p.n}차`,p.title]];overview.getRange(`C${r}:G${r}`).formulas=[[`=SUM('기능별 일정'!E${a}:E${b})`,`=SUM('기능별 일정'!F${a}:F${b})`,`=SUM(C${r}:D${r})`,`='기능별 일정'!H${a}`,`='기능별 일정'!I${b}`]];zebra(overview,r,'G',p.n);overview.getRange(`A${r}:G${r}`).format.rowHeight=50;}
overview.getRange('F11:G13').setNumberFormat('yyyy-mm-dd');overview.getRange('A14:B14').values=[['전체','순차 개발']];overview.getRange('C14:E14').formulas=[['=SUM(C11:C13)','=SUM(D11:D13)','=SUM(E11:E13)']];overview.getRange('F14:G14').formulas=[['=F11','=G13']];overview.getRange('F14:G14').setNumberFormat('yyyy-mm-dd');overview.getRange('A14:G14').format.font.bold=true;overview.getRange('A14:G14').format.rowHeight=36;
mergeText(overview,'A16:G16','차수별 완료 기준',navy);overview.getRange('A16:G16').format.font.color='#FFFFFF';
for(const p of phases){const r=16+p.n;overview.getRange(`A${r}`).values=[[`${p.n}차`]];mergeText(overview,`B${r}:G${r}`,p.gate);overview.getRange(`A${r}:G${r}`).format.rowHeight=52;zebra(overview,r,'G');}
mergeText(overview,'A21:G22','3차까지는 로컬 화면·샘플 연결 검증임. 실제 로그인·서버 저장·발행·댓글 집계·네이버·RAG·LLM·교통·번역 API는 후속 백엔드에서 연결함. 60개 내외 스팟과 대량 사진 수급·작성자 모집은 별도 운영 범위임.',light);
mergeText(overview,'A24:G25','사용 방법: ① 시작일 수정 ② 작업일/예비일 조정 ③ 진행 상태 기록 ④ 실행 MD 대조. 필터로 조회하되 행 정렬/삽입/삭제 시 선후관계를 재검토함. 합계 0일은 빨간색으로 표시함. MD 날짜는 최초 기준이며 변경 일정은 엑셀에서 확인함.');
mergeText(overview,'A27:G28','진행 중인 기존 기능을 다시 만들지 않음. 착수 시 현재 코드·최신 인수인계를 확인해 재사용 가능 여부를 판단함. 예비일은 발견된 결함 수정용이며 기능 추가 승인이나 공개 배포 승인을 뜻하지 않음.',light);
mergeText(overview,'A30:G31','계획 출처: Spotlog 추가 개발 전체 47쪽·요약 19쪽, AI 계획 67쪽, 데이터 수급 방안, 최신 로컬 1차 현황. 세부 기능표의 F 번호와 실행 MD의 P 번호를 함께 사용함.');
overview.freezePanes.freezeRows(4);

base(criteria,`E${last}`,[84,245,480,480,130]);title(criteria,'E','기능별 구현과 완료 기준','기능별 일정과 같은 작업 ID를 사용함. 기존 제품의 화면·데이터·출처를 보존하며 보완함.');header(criteria,'A4:E4',['작업 ID','기능','구현 범위','완료 조건','계획서 항목']);
for(const t of dated){let r=t.row;criteria.getRange(`A${r}:E${r}`).values=[[t.id,t.title,t.scope,t.accept,t.refs]];zebra(criteria,r,'E',t.test==='buffer'?t.phase:null);criteria.getRange(`A${r}:E${r}`).format.rowHeight=100;}
criteria.tables.add(`A4:E${last}`,true,'ImplementationCriteria');criteria.freezePanes.freezeRows(4);criteria.freezePanes.freezeColumns(2);

const weeks=30;const endCol=col(weeks+4);
base(gantt,`${endCol}${last}`,[84,255,116,116,...Array(weeks).fill(62)]);title(gantt,'P','주간 개발 일정','색이 있는 주에 해당 작업을 수행함. 날짜는 월요일 기준이며 휴일을 제외한 정확한 기간은 시작·종료 열을 확인함.');header(gantt,'A4:D4',['작업 ID','기능','시작 예정','종료 예정']);
for(let w=0;w<weeks;w++){let c=col(w+5);gantt.getRange(`${c}4`).formulas=[[w===0?`='전체 일정'!$A$5-WEEKDAY('전체 일정'!$A$5,2)+1`:`=${col(w+4)}4+7`]];gantt.getRange(`${c}4`).setNumberFormat('mm/dd');gantt.getRange(`${c}4`).format={fill:navy,font:{color:'#FFFFFF',bold:true},rowHeight:36};}
for(const t of dated){let r=t.row;gantt.getRange(`A${r}:B${r}`).values=[[t.id,t.title]];gantt.getRange(`C${r}:D${r}`).formulas=[[`='기능별 일정'!H${r}`,`='기능별 일정'!I${r}`]];gantt.getRange(`C${r}:D${r}`).setNumberFormat('yyyy-mm-dd');gantt.getRange(`A${r}:${endCol}${r}`).format.rowHeight=38;for(let w=0;w<weeks;w++){let c=col(w+5);gantt.getRange(`${c}${r}`).formulas=[[`=IF(AND($C${r}<=${c}$4+6,$D${r}>=${c}$4),1,0)`]];}gantt.getRange(`E${r}:${endCol}${r}`).setNumberFormat(';;;');gantt.getRange(`E${r}:${endCol}${r}`).conditionalFormats.add('cellIs',{operator:'equal',formula:1,format:{fill:colors[t.phase]}});}
gantt.freezePanes.freezeRows(4);gantt.freezePanes.freezeColumns(2);
// The visible calendar is deliberately bounded; date columns remain authoritative.
mergeText(gantt,`A${last+2}:J${last+3}`,'주간 표시는 시작 주부터 30주임. 범위를 넘는 일정 변경은 기능별 시작·종료 열에서 확인하고 주간 열을 확장함.');

const inspect=await wb.inspect({kind:'table',range:"'전체 일정'!A10:G14",include:'values,formulas',tableMaxRows:5,tableMaxCols:7,maxChars:3500});console.log(inspect.ndjson);
function asSerial(v){return v instanceof Date?serial(v):typeof v==='string'?serial(new Date(v)):v;}
for(const t of dated){const actual=detail.getRange(`H${t.row}:I${t.row}`).values[0];assert.equal(asSerial(actual[0]),serial(date(t.start)),`${t.id} start`);assert.equal(asSerial(actual[1]),serial(date(t.end)),`${t.id} end`);}
// Changing the start date and workload must propagate to every later phase.
overview.getRange('A5').values=[[date('2026-09-16')]];assert.equal(asSerial(detail.getRange(`I${last}`).values[0][0]),serial(date(schedule('2026-09-16').at(-1).end)));overview.getRange('A5').values=[[date(start)]];
detail.getRange('E5').values=[[tasks[0].days+1]];assert.equal(asSerial(detail.getRange(`I${last}`).values[0][0]),serial(date(schedule(start,1).at(-1).end)));detail.getRange('E5').values=[[tasks[0].days]];
assert.equal(overview.getRange('D5').values[0][0],100);
const errors=await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:100},summary:'final formula error scan',maxChars:2000});console.log(errors.ndjson);
await fs.writeFile(path.join(support,'checks.json'),JSON.stringify({tasks:tasks.length,totalDays:100,bufferDays:20,start,phases:phases.map(p=>{const d=dated.filter(t=>t.phase===p.n);return {...p,start:d[0].start,end:d.at(-1).end};}),formulaCheck:errors.ndjson,dateMutationTests:'passed'},null,2));
for(const [sh,range,file] of [[overview,'A1:G31','overview'],[detail,'A1:L11','detail'],[criteria,'A1:E8','criteria'],[criteria,'A34:E40','criteria-late'],[gantt,'A1:P14','gantt'],[cal,'A1:G34','calendar']]){const p=await wb.render({sheetName:sh.name,range,scale:1.4,format:'png'});await fs.writeFile(path.join(support,`${file}.png`),new Uint8Array(await p.arrayBuffer()));}
const xlsx=await SpreadsheetFile.exportXlsx(wb);await xlsx.save(path.join(out,'Spotlog_차수별_개발일정_20260915.xlsx'));

// Execution documents share the task dataset, so dates, IDs and acceptance stay aligned.
const baseTests=`\`npm run web:typecheck\`\n\n\`npm run web:build\`\n\n\`node --test web/tests/typography.test.cjs\`\n\n기존 Node 테스트는 Node 24 환경에서 파일별 또는 목록으로 실행함. 파일이 없으면 해당 체크아웃의 실제 테스트 경로를 먼저 확인함.\n\n\`node --test web/tests/visits.test.mjs web/tests/localRepository.test.mjs web/tests/tripPlacement.test.mjs web/tests/journeyCreation.test.mjs web/tests/aiTravelDraft.test.mjs web/tests/aiTravelSelection.test.mjs web/tests/photoCaption.test.mjs\``;
const testNotes={
 baseline:'격리된 테스트 브라우저/프로필을 사용하고 사용자 localStorage를 초기화하지 않음. 실행 전 git status·현재 경로·HEAD와 화면을 기록함.',
 ui:'320/390/460px에서 전후 비교. 긴 한글·영어, 선택·빈 화면·스크롤 아래·입력 키보드·Esc·브라우저/Android 뒤로가기와 초점 복원을 확인함.',
 storage:'구버전·정상·손상·용량 초과·복원 취소 fixture를 사용함. 원본 데이터의 복사본을 비교하고 방문·본문 참조가 끊기지 않는지 검사함.',
 search:'0건·1건·여러 페이지·필터 연속 변경·상세 왕복·오류 재시도를 검수하고 목록 위치와 조건 보존을 확인함.',
 placement:'2개 소유 여행과 타인 여행, 1/2/7일, 날짜 미정·실제 날짜, 같은 DAY 중복·다른 DAY 재방문을 검수함. DAY2 승인 결과와 실제 방문을 대조함.',
 gallery:'0/1/여러 사진·첫/마지막·부분 실패·느린 로딩·긴 출처. 사진을 넘겨도 담기/포함/제외/다른 방문 상태가 바뀌지 않음. 무한 반복·자동재생은 기본으로 추가하지 않음.',
 ai:'생성→포함/제외→취소→재진입→승인→연속 승인과 늦게 도착한 응답을 확인함. 원본·고정 일정·외부 대상 범위가 변경되지 않는지 비교함.',
 content:'장소·사진 일치, 권리 근거·사진별 출처 전환·캡션 중복 없음·사본 출처 보존·비공개 복사본 분리를 확인함. 미확보 자료는 빈 상태 테스트로 분리함.',
 editor:'글2·사진3·장소2·같은 숙소 연박·주변 업체1을 가진 DAY fixture로 이동/복사/삭제/복구/종료를 반복함. 원본과 사본의 ID 및 참조를 비교함.',
 nearby:'추천/직접 검색/저장한 장소 전환, 기준 스팟 삭제, 같은 업체 재선택, 취소, 연박·당일·마지막 DAY·고정 숙소를 검사함. 샘플 결과임을 표시함.',
 social:'같은 업체가 들어간 여행기2개·카드2개를 만들고 서로 다른 계정 샘플로 토글·답글·편집·삭제·실패를 확인함. 이동/복사와 합계 수·초안·초점 보존을 검사함.',
 map:'지도 핀↔목록 선택, DAY 전환·반복 방문·좌표 없음·worker 실패·이동수단 불일치 확인. 실제 라우팅 미연결과 네트워크 실패를 구분함.',
 contract:'요청ID·원본버전·취소·401/403/429/5xx·시간초과·빈 자료 샘플과 타입 검사를 추가함. 프런트의 모의 권한 확인은 서버 접근제어의 대체가 아님.',
 guide:'같은 질문을 DAY/장소를 바꿔 검사함. 출처 없는 현재 사실·후기·긴급 정보에 확답하지 않는 응답 fixture를 검수함.',
 translation:'한→영→원문 전환, 원문 수정·용어집 버전 변경·재번역 실패·긴 영어·한글주소 복사. 번호·날짜·금액·부정문 보호 fixture로 검사함.',
 gate:'모든 기존 관련 테스트와 신규 회귀 검사, 실제 웹 빌드, 화면 폭3종, Android 뒤로가기·키보드·재실행을 기록함. 실행하지 않은 검사는 미검증으로 남김.',
 buffer:'이전 검수에서 실패한 테스트를 먼저 재현하고 수정 후 재실행함. 결함·변경 파일·전후 캡처·검증 명령/결과·미검증 이유를 남긴 후 차수 완료를 판단함.',
};
for(const p of phases){const ts=dated.filter(t=>t.phase===p.n);let md=`# Spotlog ${p.n}차 실행 계획 — ${p.title}\n\n기준일: 2026-09-15 · 상태: 실행 지침 작성 완료 / 해당 차수 전체 구현 완료 아님\n\n[공통 인수인계](HANDOFF.md) · [실행 문서 목차](README.md)\n\n## 1. 구현 목표와 범위\n\n${p.goal}\n\n최초 일정: **${ts[0].start}~${ts.at(-1).end}**, ${p.days}작업일(기능·검수 ${p.days-p.buffer}일 + 수정 여유 ${p.buffer}일). 일정은 추정이며 작업 완료 여부를 대신하지 않음. 엑셀에서 날짜/작업일을 조정했으면 변경된 일정과 아래 작업 ID를 대조함.\n\n${p.n===1?'기존 담기·홈 AI·사진 피드·로컬 저장을 먼저 검사하고 남은 기능만 보완함. 큰 카드의 같은 랜드마크 사진 갤러리는 계획 상태이며 신규 구현 대상으로 다룸.':'앞 차수의 완료 기록을 읽고 데이터 손실·잘못된 DAY·중복 반응 등 차단 결함이 없는지 확인한 뒤 시작함. 이전 차수의 검증 증거가 없으면 자동 완료로 간주하지 않음.'}\n\n제품 전체 재작성·디자인 교체·새 보관함 계층·실제 서버/AI API 연결·공개 배포는 이 차수에 포함하지 않음. 현재 승인은 계획 및 인계 문서 제작임. 이 문서를 읽는 것만으로 구현·커밋·푸시가 승인되는 것은 아니며, 새 대화의 사용자가 해당 차수 구현을 요청하면 로컬 범위에서 실행함.\n\n## 2. 시작 전에 읽을 문서\n\n1. 루트 AGENTS.md와 [공통 인수인계](HANDOFF.md).\n2. [현재 인수인계](../handoff/CURRENT_HANDOFF.md)의 최신 기록, [1차 현재 상태](../handoff/PHASE_ONE_STATUS.md), [로컬 추가 구현](../handoff/LOCAL_TRAVEL_ADDITIONS.md).\n3. [전체 계획](../handoff/DEVELOPMENT_PLAN.md), [개발 요약](../handoff/DEVELOPMENT_SUMMARY.md)의 ${p.n}차와 관련 F 번호.\n4. [디자인 가이드](../STYLE_GUIDE.md) §3 및 변경할 화면의 실제 CSS/상태.\n5. [데이터 수급·네이버 계획](../DATA_SUPPLY_AND_NAVER_PLAN.md), [AI 계획](../handoff/AI_GUIDE_PLAN.md), [AI 요약](../handoff/AI_GUIDE_SUMMARY.md)의 관련 부분.\n\n문서 제목/작업 ID로 찾음. HTML 페이지 번호는 재생성 후 바뀔 수 있음. 최신 사용자 결정과 실제 코드가 오래된 상태표보다 우선하며 충돌은 임의로 확대 해석하지 않음.\n\n## 3. 작업 순서와 일정\n\n작업은 아래 순서로 수행함. 이미 구현된 항목도 회귀 검증과 보완 시간을 배정한 것이며, 재구현 지시가 아님. 진행 상태는 공통 인계 문서의 기록 형식에 남김.\n\n| 작업 ID | 기능 | 작업일 | 시작 | 종료 | 선행 |\n|---|---|---:|---|---|---|\n${ts.map(t=>`| ${t.id} | ${t.title} | ${t.days} | ${t.start} | ${t.end} | ${t.dep} |`).join('\n')}\n\n## 4. 기능별 실행 지침\n\n`;
 for(const t of ts){md+=`### ${t.id} ${t.title}\n\n- 계획서 대응: ${t.refs}. 착수 판단: ${t.current}.\n- 선행: ${t.dep}. 예상 ${t.days}작업일.\n\n**구현할 내용**\n\n${t.scope}\n\n**우선 확인할 파일** — 실제 호출·참조를 먼저 추적함. 같은 이름의 과거 실험 화면을 활성 화면으로 가정하지 않음.\n\n${t.files.map(f=>`- [${f}](../../${f})`).join('\n')}\n\n**완료 조건**\n\n- [ ] ${t.accept}\n- [ ] ${testNotes[t.test]}\n- [ ] 변경 파일·검증 결과·미검증 사항을 현재 인수인계에 기록함.\n\n`;}
 md+=`## 5. 차수 완료 판정\n\n${p.gate}\n\n- [ ] 핵심 동작과 실패 상태를 함께 확인함.\n- [ ] 기존 사용자 기록, 사진별 출처, 여행/방문/카드 관계를 보존함.\n- [ ] 기존 화면 역할별 폰트·색·간격·카드 구조의 의도치 않은 변경 없음.\n- [ ] 320/390/460px의 선택·빈 목록·스크롤·팝업 전후 기록이 있음.\n- [ ] Android 뒤로가기·키보드·재실행을 실제 확인함. 환경이 없으면 미검증으로 기록하고 전체 완료를 주장하지 않음.\n- [ ] 테스트·타입 검사·빌드 결과와 재현 절차를 저장함.\n- [ ] 차단 결함·작업 중 변경·다음 시작 작업 ID를 인계함.\n\n## 6. 검수 명령과 결과 보관\n\n${baseTests}\n\n새 기능에는 해당 순수 상태 로직의 단위 테스트와 사용자 흐름 검사를 추가함. 테스트 통과만으로 기기·화면 검수가 끝났다고 표시하지 않음. 이번 계획 문서 작성에서는 제품 테스트를 새로 실행해 기능 완료를 확인한 것이 아님.\n\n검증 결과는 \`docs/execution/PROGRESS.md\`(구현 착수 시 생성), 캡처와 재현 자료는 \`artifacts/phase-${p.n}-qa/\`에 남김. 개인정보가 있는 실제 사용자 데이터는 증거 파일에 넣지 않음.\n\n## 7. 새 대화에 전달할 요청\n\n다음 문장을 새 대화에 붙여 넣고 이 파일과 HANDOFF.md를 함께 전달함.\n\n> Spotlog의 docs/execution/HANDOFF.md와 docs/execution/PHASE_${p.n}.md를 읽고 ${p.n}차를 로컬에서 구현해줘. 먼저 최신 인수인계·진행 기록과 실제 활성 코드를 확인해 완료된 기능은 재사용하고, 아직 검증되지 않은 첫 작업부터 순서대로 진행해. 기존 화면 역할별 디자인과 사용자 데이터를 보존하고, 변경마다 완료 조건을 검수해. GitHub에 올리거나 커밋·푸시하지 말고, 중단 시 완료/진행/남은 작업 ID와 재현 방법을 인수인계에 기록해줘.\n`;
 await fs.writeFile(path.join(mdDir,`PHASE_${p.n}.md`),md,'utf8');
}
await fs.writeFile(path.join(support,'schedule.json'),JSON.stringify(dated,null,2));
console.log('CREATED',path.join(out,'Spotlog_차수별_개발일정_20260915.xlsx'),'and PHASE_1/2/3.md');
