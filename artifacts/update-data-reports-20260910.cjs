const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const base = 'web/public/reports/';
const sources = {
  tour:['한국관광공사 국문 관광정보','https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do?publicDataPk=15101578'],
  photo:['한국관광공사 관광사진 정보 API','https://www.data.go.kr/data/15101914/openapi.do'],
  kogl:['공공누리 이용 조건','https://www.kogl.or.kr/static/html/opencode.html'],
  admin:['행정안전부 인허가 데이터 통합','https://www.mois.go.kr/frt/bbs/type010/commonSelectBoardArticle.do?bbsId=BBSMSTR_000000000008&nttId=123399'],
  food:['일반음식점 인허가 API','https://www.data.go.kr/data/15154916/openapi.do'],
  close:['LOCALDATA 폐쇄·통합 안내','https://yongin.go.kr/home/ifOp/ifOpAdm/ifOpAdm07/ifOpAdm07_01.jsp'],
  migration:['네이버 API HUB 이관 공지','https://developers.naver.com/notice/article/32530'],
  policy:['검색 API 특별약관 개정 · 2026.09.07 시행','https://developers.naver.com/notice/article/33400'],
  local:['API HUB 지역 검색 규격','https://api.ncloud-docs.com/docs/naver-api-hub-search-local'],
  quota:['API HUB 이용 한도 안내','https://guide.ncloud-docs.com/docs/apihub-overview'],
  gemini:['검토한 Gemini 공유 대화','https://gemini.google.com/share/7d26f36898d4']
};
const escape = x => String(x).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const table = (heads,rows) => '<div class="table-wrap compact"><table><thead><tr>'+heads.map(x=>'<th scope="col">'+escape(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map((x,i)=>i?'<td>'+escape(x)+'</td>':'<th scope="row">'+escape(x)+'</th>').join('')+'</tr>').join('')+'</tbody></table></div>';
const page = (title,lead,heads,rows,note,refs,callout) => ({section:'2026.09.10 · DATA & LANDMARK GALLERY',title,lead,html:table(heads,rows)+(callout?'<div class="callout">'+escape(callout)+'</div>':'')+(note?'<p class="note">'+escape(note)+'</p>':''),sources:refs.map(x=>sources[x]),_md:{heads,rows,note,callout}});
const acquisition = page('관광 데이터 수급과 초기 콘텐츠 범위','스팟·음식점·숙소의 기초 자료와 사진·설명·실제 인기 데이터를 서로 다른 경로로 확보함.', ['수급 경로','확보할 자료와 적용 기준'],[
 ['TourAPI·지자체','관광지 이름·주소·좌표·분류와 공식 이용 정보를 확보함. 설명·사진의 개별 권리와 확인 시점을 점검한 뒤 내부 장소에 연결함.'],
 ['관광사진·직접 촬영','관광사진 API·지자체 허용 자산·직접 촬영본을 검토함. PhotoKorea 사이트 다운로드 원본은 API와 같은 조건으로 간주하지 않음.'],
 ['음식점·숙박 인허가','공공데이터포털의 현재 데이터셋으로 업체 존재·업종·영업 상태를 보완함. 평점·인기·사용 가능한 사진·정확한 영업시간까지 확보한 것으로 보지 않음.'],
 ['직접 제휴·사용자 기록','업체 제공 정보·사진은 계약 범위, 사용자 여행기·사진은 공개·재사용·AI 이용 동의를 관리함. 실제 저장·복사 지표는 별도 집계함.'],
 ['초기 확보 목표 · 제안','서울·부산·제주 각각 스팟 20곳 내외, 장소당 사진 2~3장을 우선 확보함. 당일·1박 2일·2박 3일 여행기 9개를 구성하며 기존 검증된 부산·경주 자산도 활용함.']
], '위 수량은 준비 목표이며 현재 확보 완료 수치가 아님. 제미나이 공유본에서 확인한 스팟 중심 구성안을 참고하되, 이 데이터 수급안은 별도로 공식 자료를 조사해 정리함.', ['tour','photo','admin','gemini']);
const rights = page('출처·사진 권리와 RAG 사용 범위','공공기관 자료라는 이유만으로 모든 사진의 상업 이용·편집·AI 입력을 허용하지 않음.', ['검사 대상','저장·사용 기준'],[
 ['항목별 권리','TourAPI 일반 관광정보의 사진에는 공공누리 1·3유형이 혼재함. 관광사진 API와 웹사이트 원본의 표시 조건도 각각 확인함.'],
 ['공공누리 유형','1유형은 출처 조건, 3유형은 변경 금지, 2·4유형은 비상업 조건을 검토함. 변경 금지 사진에 자동 자르기·모션을 적용하지 않으며 0·AI유형도 개별 조건을 기록함.'],
 ['장소와 사진 분리','장소 ID와 사진 ID를 분리함. 사진별 원문 URL·저작자·허용 범위·확인일·설명·정렬·대표 여부를 저장하고 같은 장소의 실제 사진인지 검수함.'],
 ['AI 사용 허용 구분','화면 표시·원본 보관·변형·검색 색인·임베딩·LLM 입력의 허용 여부를 각각 관리함. 권리 미확인 자료는 RAG와 생성 요청에서 제외함.'],
 ['수정·철회·최신성','원문 버전과 상태 변경을 기록함. 삭제·권리 철회 시 이미지 캐시·검색 색인·번역을 함께 무효화하고 과거 방문 기록과 현재 영업 상태를 구분함.']
], '기초 데이터의 좌표계와 갱신 주기도 데이터셋별로 검증함. 인허가 API의 EPSG:5174 좌표를 지도용 경위도로 그대로 사용하지 않음.', ['tour','photo','kogl','food']);
const naverPolicy = page('네이버 검색의 사용 범위와 계약 조건','네이버는 외부 검색 확인 경로로 검토함. 내부 추천용 원천 데이터 확보와 별도로 판단함.', ['확인 사항','연동 계획에 반영할 기준'],[
 ['신규 신청 경로','2026.07.31부터 신규 검색 API 신청은 NAVER API HUB에서 진행함. 기존 개발자센터 키의 유예 기한은 2027.06.30임.'],
 ['개발자센터 최신 약관','2026.09.07 시행 검색 특별약관은 독립된 결과 표시와 순서·출처·링크 유지, AI 입력·학습·평가 금지, 제한된 목적의 캐시 및 수익화 제한을 명시함.'],
 ['HUB 계약 확인','HUB는 별도 계약임. 위 약관의 동일 적용 여부와 상업 서비스·저장·캐시·외부 지도 표시 조건을 운영 계약 또는 서면 답변으로 확인함.'],
 ['기본 차단 범위','결과의 영구 DB 적재·RAG 입력·자체 인기 재정렬·다른 사진 결합·내부 장소 병합을 허용된 것으로 가정하지 않음. 사용자가 선택했다는 이유로 제한이 해제되지 않음.'],
 ['화면과 추천 분리','내부 후보는 허용된 공공·제휴·사용자 자료로 구성함. 네이버 결과는 별도 검색 확인 영역으로 검토하며 승인 범위가 확인된 동작만 활성화함.']
], '현재 네이버 API는 연동하지 않음. 조건이 맞지 않으면 내부 데이터와 직접 입력·허용 공급자를 사용하며 네이버 결과를 우회 수집하지 않음.', ['migration','policy','local']);
const naverServer = page('네이버 API HUB 서버 연결 준비','키와 공급자 정책을 서버에서 관리하고, 공식 응답 범위와 오류 상태부터 검증함.', ['기술 항목','구현 기준'],[
 ['호출·인증','서버가 GET /search/v1/local을 호출함. X-NCP-APIGW-API-KEY-ID·X-NCP-APIGW-API-KEY를 사용하며 웹·APK에 키를 넣지 않음.'],
 ['검색 조건','query, display 최대 5, start 1을 사용함. sort=random은 정확도, comment는 블로그·카페 리뷰 수 기준이며 별점순이나 Spotlog 인기순으로 표시하지 않음.'],
 ['응답 검증','이름·주소·분류·링크·mapx/mapy를 검사함. 문서상 WGS84라도 실제 값의 단위·스케일을 확인함. 안정적인 공급자 장소 ID가 있다고 가정하지 않음.'],
 ['제공하지 않는 항목','반경 검색·사진·평점·영업시간·경로는 별도 확보 대상임. 전화번호 필드는 빈 값이며 조회 결과에 없는 사실을 만들어 넣지 않음.'],
 ['한도·비용 확인','HUB 안내의 한시 무료·월 775,000회 공유·키별 50 RPS와 지역 API의 일 25,000회 설명이 함께 존재함. 콘솔·공식 답변으로 적용 한도와 유료 전환을 확정함.'],
 ['검증·차단','인증·한도 초과·빈 결과·지연·좌표 오류·표시 정책·캐시 만료를 시험함. 권한 없는 저장·AI 전달을 차단하고 키·개인정보를 로그에 남기지 않음.']
], '전체 주소는 공식 API 규격에서 확인함. 키 발급·실제 호출·내부 ID 연결은 계약과 데이터 사용 범위가 확인된 뒤 진행함.', ['local','quota','migration']);
const gallery = page('1차 · 랜드마크 카드의 여러 사진 넘김','현재 랜드마크 카드의 이미지 영역 안에서 같은 장소의 여러 사진을 좌우로 넘기게 함.', ['적용 영역','구현 방향과 완료 조건'],[
 ['동일한 큰 카드','지역 안내·AI 미리보기·담기 하단 팝업의 LandmarkGuideCard에 같은 사진 넘김 기능을 적용함. 사진 높이·둥글기·글자·여백은 현재 화면 기준을 유지함.'],
 ['좌우 넘김','사진 영역에서 가로 스와이프와 이전·다음 조작을 제공함. 현재 순번·전체 장수를 표시하고 한 장일 때 불필요한 조작·순번은 숨김.'],
 ['사진별 정보','현재 사진에 맞는 설명·대체 텍스트·출처를 연결함. 다른 장소의 사진으로 장수를 채우지 않으며 사진 없음·불러오기 실패를 구분함.'],
 ['조작·로딩','현재·인접 사진부터 불러옴. 가로 넘김이 카드 저장·담기나 팝업 닫기를 실행하지 않도록 분리하고, 세로 스크롤과 선택 상태를 보존함.'],
 ['다른 화면 역할','기존 사진 피드는 장소를 세로, 같은 장소의 사진을 가로로 넘김. 저장 목록의 작은 가로 카드는 대표 사진을 유지하고 본문 임베드·영상은 일괄 교체하지 않음.'],
 ['완료 검수','320·390·460px에서 0·1·여러 장, 실패·선택·스크롤·팝업 상태를 검증함. 키보드 조작·읽기 도구 안내와 화면 복귀 후 사진 상태도 확인함.']
], '1차 추가 개발 항목임. 이번 문서 갱신만으로 제품 카드가 변경되지는 않으며, 사진 모션 실험이나 공개 영상 화면을 교체하지 않음.', []);
const phases = page('데이터와 사진 구조의 차수별 개발','화면은 검증용 자료로 먼저 연결하고 실제 수급·계약·사용자 지표를 서버 단계에서 적용함.', ['단계','구현 내용','완료 기준'],[
 ['1차','큰 랜드마크 카드의 여러 사진·순번·출처·오류 상태, 사진 ID·권리 필드와 샘플 연결부를 구성함.','같은 장소를 지역 안내·AI·담기에서 일관되게 확인함. 기존 작은 저장 카드는 유지함.'],
 ['2차','내 여행의 주변 음식점·카페·숙소 선택, 방문·사진 연결과 카드별 좋아요·댓글 하단 팝업을 이어감.','사진 선택·DAY 이동·복사 후 연결이 유지됨. 반응은 샘플과 실제 집계를 구분함.'],
 ['3차','허용된 내부 후보를 사진으로 비교하고 AI 보완·승인·부분 수정·영어 안내에 같은 카드를 재사용함.','외부 검색을 실제 RAG 자료나 검증된 인기순으로 오인시키지 않음.'],
 ['B2 · 수급·미디어','공공데이터·제휴 수급, 출처·중복·좌표 검수, 사진 저장·최적화·버전·철회를 운영함.','LOCALDATA 구 포털 대신 현재 공공데이터포털을 사용함. 업체·사진·설명의 권리를 분리함.'],
 ['B3·B4 · 실제 추천','실제 저장·복사 등 내부 인기 지표, 권한 필터와 RAG를 연결함. 네이버는 계약 확인 후 별도 외부 검색으로 검토함.','샘플 인기를 성과로 사용하지 않음. 권리 철회·데이터 오류가 검색·안내에도 반영됨.']
], '초기 콘텐츠 확보는 개발과 별도 운영 과제임. 장소 목록의 수량보다 사진 일치·이용 정보·수정 가능 일정의 품질을 기준으로 확대함.', ['admin','close','policy']);
const summaryData = page('데이터 수급과 내부 추천 자료','공식 기초 정보와 허용된 사진·여행기를 내부 자료로 쌓고, 실제 사용자 반응으로 추천 품질을 높임.', ['수급 항목','적용 방향'],[
 ['랜드마크·공식 안내','TourAPI·지자체에서 장소와 이용 정보를 확인함. 필드별 출처·확인일·권리를 보존하고 미확인 정보는 표시함.'],
 ['여러 사진','관광사진 API·허용된 지자체 자료·직접 촬영·제휴·사용자 사진을 확보함. 같은 장소의 실제 사진만 사용하고 자산별 조건을 검사함.'],
 ['음식점·숙박','현재 공공데이터포털 인허가 자료로 기초 업체 정보를 보완함. 구 LOCALDATA는 2026.04.16 폐쇄되었으며 인허가 정보를 인기·평점·사진으로 간주하지 않음.'],
 ['권리와 RAG','공공누리 유형과 개별 조건을 검사함. 표시·보관·변형·임베딩·AI 입력 허용을 구분하고 권리 미확인 자료는 제외함.'],
 ['초기 목표 · 제안','서울·부산·제주 각각 스팟 20곳 내외·사진 2~3장, 기간별 여행기 총 9개를 준비함. 현재 완료 수치가 아니며 기존 검증 자산도 활용함.'],
 ['실제 운영','인기는 내부 실제 저장·복사·반응으로 계산함. 원문 수정·삭제·권리 철회 시 이미지·색인·번역도 갱신함.']
], '스팟을 먼저 고른 뒤 주변 음식점·숙소를 보완하는 방향을 유지함. 공유 대화의 데이터 수급 후속 내용은 확인되지 않아 공식 자료로 별도 조사함.', ['tour','photo','kogl','close']);
const summaryNaver = page('네이버 연동과 내부 RAG의 경계','네이버 지역 검색은 외부 검색 확인 경로로 검토하며, 내부 추천용 데이터 적재를 기본 허용으로 가정하지 않음.', ['항목','계획에 반영한 판단'],[
 ['신규 연결','2026.07.31부터 신규 신청은 NAVER API HUB임. 서버 키로 연결하며 기존 개발자센터 키 유예는 2027.06.30까지임.'],
 ['검색 범위','최대 5건·start 1이며 반경·사진·평점·경로는 제공하지 않음. comment 정렬은 블로그·카페 리뷰 수로, 내부 인기 점수와 구분함.'],
 ['약관 확인','개발자센터의 2026.09.07 시행 약관은 AI 입력·학습·평가, 결과 변경·수익화 등에 제한을 둠. HUB는 별도 계약이므로 적용 범위를 서면 확인함.'],
 ['기본 사용 경계','네이버 결과의 영구 DB·RAG·자체 재정렬·다른 사진 결합·내부 병합은 승인 범위 확인 전 차단함. 사용자 선택만으로 허용되지 않음.'],
 ['비용·연동 시점','공식 문서의 월 775,000회·키별 50 RPS와 지역 API 일 25,000회 설명을 콘솔에서 확인함. 한시 무료를 상시 무료로 계획하지 않으며 실제 연동은 서버 이후임.']
], '내부 추천은 허용된 공공·제휴·사용자 자료와 실제 반응을 사용함. 네이버 신규 키 발급·호출·저장 기능을 이번 문서 작업에서 실행하지 않음.', ['migration','policy','local','quota']);
const full = [acquisition,rights,naverPolicy,naverServer,gallery,phases];
const summary = [summaryData,summaryNaver,gallery];
const replacements = [
 ['기존 스타일·검색·사진 넘김·담기 팝업·홈 AI 초안·사진 카드','기존 스타일·검색·사진 쇼츠·카드 사진 넘김·담기·홈 AI 초안'],
 ['1차 사진 넘김·저장 통일','1차 쇼츠·카드 사진 넘김·저장 통일'],
 ['기존 스타일·검색·사진 쇼츠·홈 AI 초안','기존 스타일·검색·사진 쇼츠·카드 사진 넘김·홈 AI 초안'],
 ['사진 쇼츠·기존 장소 카드 재사용','사진 쇼츠·랜드마크 카드 사진 넘김'],
 ['한 화면 한 장소, 세로 장소·좌우 사진 전환과 저장 상태 일치','사진 피드와 카드의 좌우 사진·출처·저장 상태 일치'],
 ['사진 캐러셀·순번·장소 설명','사진 피드·큰 카드의 좌우 넘김·순번·출처'],
 ['사진 보기는 한 화면에 한 랜드마크를 표시함. 세로로 다른 장소, 좌우로 같은 장소의 사진 1~5장을 넘김. 순번·설명·저장 상태를 표시함.','사진 피드는 세로 장소·가로 사진 전환을 유지함. 지역 안내·AI·담기의 큰 카드도 같은 장소 사진을 좌우로 넘기며 순번·사진별 출처를 표시함. 작은 저장 카드는 대표 사진을 유지함.'],
 ['AI 결과·담기 팝업에 기존 큰 랜드마크 카드를 재사용함. 저장 본문의 작은 가로 카드는 유지함.','지역 안내·AI·담기의 큰 카드에 좌우 사진 넘김·순번·출처를 추가함. 저장 본문의 작은 가로 카드는 유지함.'],
 ['1차는 AI·담기 팝업의 사진 카드 확인을 구현함.','1차는 지역 안내·AI·담기의 큰 카드에 같은 장소의 여러 사진 넘김을 구현함.'],
 ['장소 보완은 네이버 지역 검색을 서버에서 연결하는 계획으로 변경함. 이름·주소·좌표 후보를 내부 장소와 연결하며 사진·가격·예약·인기 수치까지 제공된다고 가정하지 않음.','네이버 API HUB를 별도 외부 검색으로 검토함. 영구 저장·RAG·내부 병합·표시 허용을 계약으로 확인한 뒤 서버 연결 범위를 확정함. 사진·인기 데이터는 별도임.'],
 ['장소 검색을 Kakao Local에서 네이버로 변경함. 검색당 최대 5건, start 최대 1로 다음 페이지 탐색을 지원하지 않음. 검색 API 일 25,000회 한도를 공유함.','신규 연결은 NAVER API HUB를 검토함. 최대 5건·start 1이며 월·일 한도 안내 차이를 콘솔에서 확인함. 한시 무료를 상시 무료로 가정하지 않음.'],
 ['Client ID·Secret을 서버에서만 사용함. 반환 좌표의 실제 형식·스케일과 마크업을 검증하고 내부 placeId에 연결함. 이용·저장·표시 정책과 중복 통합 규칙을 확인함.','HUB의 API Gateway 키를 서버에서만 사용함. 좌표·표시와 계약을 검증하고, 내부 병합·영구 저장·RAG 사용은 허용 범위 확인 전 차단함.'],
 ['직접 검색을 보완하는 외부 후보 공급자임. 요청당 최대 5건이며 반경·사진·평점 필드를 제공하지 않음. 내부 주변 검색·인기 데이터와 구분함.','별도 외부 검색 확인 경로로 검토함. 최대 5건이며 반경·사진·평점은 없음. 결과의 내부 적재·RAG·재정렬은 계약 확인 전 차단함.'],
 ['네이버는 외부 장소 후보 확보에 사용함. 내부 자료·인기 기반 RAG와 LLM 추천 구조를 대체하지 않음.','네이버는 별도 외부 검색 확인 경로로 검토함. 계약 확인 전 내부 DB 적재나 RAG 입력을 허용된 것으로 가정하지 않음.'],
 ['내부 장소·직접 입력을 정규화함. 네이버 지역 검색 결과는 별도 출처로 연결함','허용된 내부 장소·직접 입력을 정규화함. 네이버 결과 연결은 계약상 허용 범위 확인 후 판단함'],
 ['내부 DB + 의미 검색 / 네이버 지역 검색 보완','내부 DB + 의미 검색 / 네이버 외부 검색 분리'],
 ['내부 권한·출처 우선. 외부 검색·저장 정책과 이미지 권리 별도 확인','내부 권한·출처 우선. HUB 계약 확인 전 영구 저장·RAG·내부 병합 차단'],
 ['장소 검색은 네이버 지역 검색으로 변경함. MapLibre 표시는 유지하고 실제 이동 경로는 TMAP·ODsay를 별도 검증함. 카카오 길찾기는 이번 선택안에서 채택하지 않음.','외부 검색은 NAVER API HUB를 검토하고 계약·표시·저장·AI 이용 허용부터 확인함. MapLibre는 유지하고 실제 이동 경로는 TMAP·ODsay를 별도 검증함.'],
 ['실제 내부 인기·RAG, 네이버 검색, 교통수단별 경로와 시간 검증을 연결함.','실제 내부 인기·RAG와 교통 검증을 연결함. 네이버는 계약을 확인한 뒤 별도 외부 검색으로 검토함.'],
 ['네이버 지역 검색 공식 문서 · 2026.09.10 확인','API HUB 지역 검색 규격 · 계약 별도 확인'],
 ['네이버 지역 검색 공식 문서','API HUB 지역 검색 규격'],
 ['https://developers.naver.com/docs/serviceapi/search/local/local.md','https://api.ncloud-docs.com/docs/naver-api-hub-search-local']
];
const context={window:{}};vm.createContext(context);vm.runInContext(fs.readFileSync(base+'report.js','utf8'),context);context.Report=context.window.Report;context.window=context;
vm.runInContext(fs.readFileSync(base+'ai-recommendation-sections.js','utf8'),context);
function readReport(name){let data;context.Report.mount=d=>data=d;vm.runInContext(fs.readFileSync(base+name+'.js','utf8'),context);return data;}
function clean(p){const {_md,...slide}=p;return slide;}
function mdPage(p,index,total){const m=p._md;return '\n\n---\n\n<a id="slide-'+index+'"></a>\n\n## '+String(index).padStart(2,'0')+' / '+total+' · '+p.title+'\n\n'+p.section+'\n\n'+p.lead+'\n\n| '+m.heads.join(' | ')+' |\n| '+m.heads.map(()=>'---').join(' | ')+' |\n'+m.rows.map(r=>'| '+r.join(' | ')+' |').join('\n')+'\n\n'+(m.callout?m.callout+'\n\n':'')+(m.note?m.note+'\n\n':'')+(p.sources.length?'출처: '+p.sources.map(([label,url])=>'['+label+']('+url+')').join(' · ')+'\n':'');}
const configs=[['development-plan','DEVELOPMENT_PLAN',40,full],['development-summary','DEVELOPMENT_SUMMARY',15,summary],['ai-guide-plan','AI_GUIDE_PLAN',61,full],['ai-guide-summary','AI_GUIDE_SUMMARY',9,summary]];
fs.writeFileSync('artifacts/data-reports-before-20260910.json',JSON.stringify(Object.fromEntries(configs.map(([name])=>[name,readReport(name)])),null,2));
for(const [name,mdName,oldCount,additions] of configs){
  const original=readReport(name);assert.equal(original.slides.length,oldCount);
  let js=fs.readFileSync(base+name+'.js','utf8');
  let md=fs.readFileSync('docs/handoff/'+mdName+'.md','utf8');
  for(const [from,to] of replacements){js=js.split(from).join(to);md=md.split(from).join(to);}
  const total=oldCount+additions.length;
  if(name.endsWith('summary')){
    const jsonStart=js.indexOf('Report.mount(')+'Report.mount('.length;
    const data=JSON.parse(js.slice(jsonStart,js.lastIndexOf(');')).trim());
    data.slides.push(...additions.map(clean));
    js=js.slice(0,jsonStart)+JSON.stringify(data,null,2)+');\n';
  }else{
    const mountIndex=js.lastIndexOf('Report.mount(');
    const target=name==='ai-guide-plan'?'finalSlides':'slides';
    js=js.slice(0,mountIndex)+target+'.push(\n'+additions.map(p=>JSON.stringify(clean(p),null,2)).join(',\n')+'\n);\n'+js.slice(mountIndex);
  }
  md=md.replace(new RegExp(' · '+oldCount+'쪽'),' · '+total+'쪽').replace(new RegExp(' / '+oldCount+' ·','g'),' / '+total+' ·');
  md+=additions.map((p,i)=>mdPage(p,oldCount+i+1,total)).join('');
  js=js.replaceAll('원본 상세 40쪽','원본 상세 46쪽').replaceAll('원본 상세 61쪽','원본 상세 67쪽');
  md=md.replaceAll('원본 상세 40쪽','원본 상세 46쪽').replaceAll('원본 상세 61쪽','원본 상세 67쪽');
  fs.writeFileSync(base+name+'.js',js);fs.writeFileSync('docs/handoff/'+mdName+'.md',md);
  const result=readReport(name);assert.equal(result.slides.length,total);
  const changed=[];for(let i=0;i<oldCount;i++){if(JSON.stringify(original.slides[i])!==JSON.stringify(result.slides[i]))changed.push(i+1);}
  console.log(JSON.stringify({name,total,changed,added:result.slides.slice(oldCount).map((p,i)=>({page:oldCount+i+1,title:p.title}))}));
}
