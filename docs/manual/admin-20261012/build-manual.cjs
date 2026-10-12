const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const menus = [
  { id: 'overview', n: 1, name: '운영 현황', what: '오늘 할 일을 시작하고, 담당 자료의 미완료 작업을 이어가는 곳', use: '지역·담당 범위 선택 → 등록 / 검수 / 추천 여행 만들기', role: '운영자 · 최고관리자' },
  { id: 'places', n: 2, name: '장소·업체', what: '지역과 랜드마크·음식점·카페·숙소의 원본 자료를 관리하는 곳', use: '지역 설정 → 장소 등록 → 위치·사진·출처 확인 → 공개', role: '운영자 · 최고관리자' },
  { id: 'exposure', n: 3, name: '노출·추천', what: '추천 여행을 만들고, 인기 장소·여행기를 골라 홈에 게시하는 곳', use: '추천 여행 만들기 / 인기 콘텐츠 선택 → 게시 위치·기간·순서 지정', role: '운영자 · 최고관리자' },
  { id: 'community', n: 4, name: '여행기·커뮤니티', what: '공개 여행기·댓글·답글·신고와 번역을 확인하는 곳', use: '대상과 문맥 확인 → 사유 입력 → 해당 대상에 조치', role: '운영자 · 최고관리자' },
  { id: 'members', n: 5, name: '회원·문의', what: '회원의 공개 프로필·상태·계정 요청과 문의를 처리하는 곳', use: '회원 또는 문의 검색 → 담당자·처리 상태 확인 → 조치 기록', role: '운영자 · 최고관리자' },
  { id: 'ai', n: 6, name: 'AI·검색 운영', what: '장소 설명의 검색 반영, 추천 품질, 실패 원인과 실행 기준을 관리하는 곳', use: '검색 자료 → 색인 작업 → 품질 시험 → 요청 현황 / 실행 정책', role: '운영자: 자료·시험 확인 / 최고관리자: 정책·색인 적용 및 복구' },
  { id: 'settings', n: 7, name: '운영 설정·이력', what: '분류·등급·운영자·알림·연결·휴지통·변경 기록을 관리하는 곳', use: '바꾸려는 운영 기준의 탭 선택 → 저장 → 변경 이력 확인', role: '운영자: 허용된 기준·기록 / 최고관리자: 계정·연결·정리 작업' },
];
const fragments = ['data-pages.json', 'service-pages.json', 'technical-pages.json'];
const collected = fragments.flatMap(file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')));
const pages = menus.flatMap(menu => collected.filter(page => page.menu === menu.id));
const ids = new Set();
for (const page of pages) {
  if (!/^[a-z][a-z0-9-]*$/.test(page.id) || ids.has(page.id)) throw new Error(`Invalid or repeated page ID: ${page.id}`);
  ids.add(page.id);
  if (!/^assets\/[a-z0-9-]+\.png$/.test(page.image)) throw new Error(`Invalid asset path: ${page.image}`);
  const png = fs.readFileSync(path.join(root, page.image));
  if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error(`Not PNG: ${page.image}`);
  if (png.readUInt32BE(16) !== page.width || png.readUInt32BE(20) !== page.height) throw new Error(`Dimensions differ: ${page.id}`);
  for (const [index, callout] of page.callouts.entries()) {
    if (callout.n !== index + 1 || ![callout.x, callout.y].every(value => Number.isFinite(value) && value >= 0 && value <= 100)) throw new Error(`Invalid callout: ${page.id} ${callout.n}`);
    for (const key of ['label', 'what', 'how', 'result']) if (typeof callout[key] !== 'string' || !callout[key].trim()) throw new Error(`Missing ${key}: ${page.id} ${callout.n}`);
  }
}
for (const menu of menus) if (!pages.some(page => page.menu === menu.id)) throw new Error(`Empty menu: ${menu.id}`);
if (pages.length !== collected.length) throw new Error('Unknown menu in fragments');
const esc = value => String(value).replace(/[&<>"']/g, chr => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[chr]));
const json = value => JSON.stringify(value).replace(/</g, '\\u003c');
const menuLink = (menu, label, cls = '') => `<a href="#${esc(menu)}" data-menu-link="${esc(menu)}"${cls ? ` class="${cls}"` : ''}>${label}</a>`;
const marker = (page, callout) => `<button type="button" class="guide-marker" style="left:${callout.x}%;top:${callout.y}%" data-marker-page="${page.id}" data-marker-number="${callout.n}" aria-label="${callout.n}. ${esc(callout.label)}" aria-pressed="false" aria-controls="${page.id}-callout-${callout.n}">${callout.n}</button>`;
const calloutRow = (page, callout) => `<section class="guide-callout" id="${page.id}-callout-${callout.n}" aria-labelledby="${page.id}-label-${callout.n}">
  <h4 id="${page.id}-label-${callout.n}"><span class="guide-number" aria-hidden="true">${callout.n}</span>${esc(callout.label)}</h4>
  <p><b>하는 일</b><br>${esc(callout.what)}</p>
  <p><b>사용 방법</b><br>${esc(callout.how)}</p>
  <p><b>다음 결과</b><br>${esc(callout.result)}</p>
  ${callout.note ? `<p class="guide-callout-note"><b>확인</b><br>${esc(callout.note)}</p>` : ''}
</section>`;
const section = (page, code) => `<article class="guide-page${page.width >= 1200 ? ' guide-page--wide' : ''}" id="${page.id}" aria-labelledby="${page.id}-heading">
  <header class="guide-page-head"><p class="guide-path">${esc(page.path)}</p><h3 id="${page.id}-heading">${code}. ${esc(page.title)}</h3><p>${esc(page.purpose)}</p></header>
  <div class="guide-page-layout">
    <div class="guide-capture-area">
      <div class="guide-capture-tools"><span>번호를 누르면 같은 번호의 설명 확인</span><button type="button" class="guide-button" data-enlarge="${page.id}" aria-label="${esc(page.title)} 화면 확대">화면 확대 ↗</button></div>
      <figure class="guide-shot"><button type="button" class="guide-image-button" data-enlarge="${page.id}" aria-label="${esc(page.title)} 스크린샷 확대"><img src="${page.image}" alt="${esc(page.title)} 실제 관리자 화면" width="${page.width}" height="${page.height}" loading="lazy" decoding="async"></button>${page.callouts.map(callout => marker(page, callout)).join('')}</figure>
      <p class="guide-caption">실제 화면 캡처 · 번호는 매뉴얼 표시 · 이 화면의 번호 1~${page.callouts.length}</p>
    </div>
    <div class="guide-explanations" aria-label="${esc(page.title)} 번호별 기능 설명">${page.callouts.map(callout => calloutRow(page, callout)).join('')}</div>
  </div>
  <footer class="guide-page-footer"><h4>이 순서로 사용</h4><ol class="guide-steps">${page.steps.map(step => `<li>${esc(step)}</li>`).join('')}</ol>${page.notes.length ? `<div class="guide-notes" aria-label="사용 전 확인">${page.notes.map(note => `<p>${esc(note)}</p>`).join('')}</div>` : ''}</footer>
</article>`;
const chapters = menus.map(menu => {
  const chapterPages = pages.filter(page => page.menu === menu.id);
  return `<header class="guide-chapter-heading" data-menu="${menu.id}"><h2>${menu.n}. ${menu.name}</h2><p>${menu.what} · ${esc(menu.role)}</p></header>${chapterPages.map((page, index) => section(page, `${menu.n}-${index + 1}`)).join('')}`;
}).join('');
const features = pages.reduce((total, page) => total + page.callouts.length, 0);
const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="실제 관리자 스크린샷의 번호와 사용 순서로 보는 Spotlog 관리자 사용 매뉴얼"><title>Spotlog 관리자 사용 매뉴얼</title><link rel="stylesheet" href="manual.css"></head>
<body><a class="guide-skip" href="#manual-main">본문 바로가기</a><div class="guide-shell">
  <aside class="guide-nav" aria-label="매뉴얼 메뉴"><div class="guide-brand">spotlog<span>관리자 사용 매뉴얼</span></div><nav aria-label="메뉴별 설명">
    ${menuLink('start', '처음 사용하기')}${menus.map(menu => menuLink(menu.id, `<span class="menu-index">${menu.n}</span>${menu.name}`)).join('')}${menuLink('all', '전체 화면 보기')}
  </nav><div class="guide-contents"><strong>현재 메뉴의 화면</strong><div id="manual-contents"></div></div><a class="live-link" data-live-admin-link href="https://giry02.github.io/spotlog/admin.html" target="_blank" rel="noopener">관리자 화면 열기 ↗</a></aside>
  <main id="manual-main" class="guide-main" tabindex="-1">
    <header class="guide-header"><h1>관리자, 어디서 무엇을 할까?</h1><p><strong>화면의 번호 → 같은 번호의 기능 설명 → 사용 순서.</strong><br>왼쪽에서 메뉴 선택. 작은 글씨는 ‘화면 확대’로 확인. 번호는 화면마다 1부터 시작.</p><div class="guide-meta"><span>2026.10.12 로컬 검수 화면 기준</span><span>7개 메뉴 · ${pages.length}개 화면 · ${features}개 번호 설명</span><span>별도 로그인 없이 매뉴얼 열람</span></div></header>
    <div class="guide-tools"><div class="guide-search"><label for="manual-search">기능 찾기</label><input type="search" id="manual-search" placeholder="예: 지역, 좌표, 사진 출처, 메인 게시, 댓글, 색인" autocomplete="off"></div><button type="button" id="manual-search-clear" class="guide-button">검색 지우기</button><button type="button" id="manual-print" class="guide-button">전체 인쇄</button></div>
    <p id="manual-search-state" class="guide-search-state" role="status" aria-live="polite"></p>
    <section id="quickstart" class="guide-intro" aria-labelledby="quickstart-heading"><h2 id="quickstart-heading">처음에는 이 네 단계부터</h2><p>부산의 장소를 등록하고, 추천 여행을 만들어 고객 홈에 올리는 예시.</p>
      <div class="guide-flow">
        ${menuLink('places', '<small>01 · 원본 준비</small><strong>지역·장소 등록</strong><span>부산 선택 → 장소명·종류·주소 입력 → 초안 저장</span>')}
        ${menuLink('places', '<small>02 · 자료 확인</small><strong>검수하고 공개</strong><span>좌표·소개·사진·사용 범위 확인 → 공개</span>')}
        ${menuLink('exposure', '<small>03 · 추천 콘텐츠</small><strong>추천 여행 만들기</strong><span>부산·기간·요청 입력 → DAY 편집 → 미리보기·공개</span>')}
        ${menuLink('exposure', '<small>04 · 고객 홈 배치</small><strong>메인 게시 관리</strong><span>공개 대상 선택 → 노출 위치·순서·기간 → 저장</span>')}
      </div>
      <h3>메뉴 선택 기준</h3><table class="guide-menu-map"><tbody>${menus.map(menu => `<tr><th scope="row">${menuLink(menu.id, `${menu.n}. ${menu.name}`)}</th><td>${esc(menu.what)}<br><span>${esc(menu.use)}</span></td></tr>`).join('')}</tbody></table>
      <h3>초안 · 공개 · 메인 게시의 차이</h3><div class="guide-state-map"><div><strong>초안 저장</strong><p>작성 중인 내용 보관. 장소는 기존 공개본 유지. 추천 여행의 초안 저장은 해당 여행을 비공개로 전환하므로 별도 확인.</p></div><div><strong>검수하고 공개</strong><p>확인한 자료를 공개본으로 적용. 새 홈 게시 위치는 ‘메인 게시 관리’에서 지정.</p></div><div><strong>메인 게시 저장</strong><p>대상·채널·순서·기간·켜짐 설정. 해당 채널의 게시 조건에 따라 노출.</p></div></div><p class="guide-boundary">이미 게시 중인 대상이나 연결된 홈 추천 원본을 수정·공개하면 기존 게시 내용도 갱신될 수 있음. 새 게시와 기존 콘텐츠 갱신을 구분.</p>
      <p class="guide-boundary">캡처는 별도 환경의 예시 자료로 진행. 실제 회원 조치·AI 호출·알림 발송·파일 정리는 서버 연결 필요. 화면의 사용법과 실제 처리 완료는 구분해서 확인.</p>
    </section>
    <div id="manual-no-results" class="guide-no-results" hidden>검색 결과 없음. ‘메인’, ‘장소’, ‘신고’처럼 짧은 단어로 다시 검색.</div>
    ${chapters}
    <section id="glossary" class="guide-intro" aria-labelledby="glossary-heading"><h2 id="glossary-heading">헷갈리기 쉬운 기준</h2><dl class="guide-glossary">
      <div><dt>지역과 장소</dt><dd>지역 추가·수정은 ‘장소·업체 → 지역 설정’. 업체는 실제 지점 단위로 등록. 같은 상호라도 주소와 좌표가 다르면 별도 장소.</dd></div>
      <div><dt>공개 상태와 영업 상태</dt><dd>공개는 고객에게 사용할 자료인지에 대한 설정. 영업 중·임시휴업·폐업은 현재 운영 상태. 서로 다른 항목으로 관리.</dd></div>
      <div><dt>주변 후보와 운영자 추천</dt><dd>좌표로 조회한 거리 후보와 직접 선정한 추천을 구분. 기본 직선 3km, 필요하면 15km로 확장. 이동 시간과는 다름.</dd></div>
      <div><dt>사진 출처와 사용 범위</dt><dd>사진마다 원문·제공자·사용 조건 확인. 출처 표기가 사용 허가를 대신하지 않음. 확인한 범위만 표시·보관·AI 활용에 적용.</dd></div>
      <div><dt>검색 자료 · 색인 · 정책</dt><dd>검색 자료는 승인된 장소 설명. 색인은 그 설명을 찾는 검색 목록의 버전. 정책은 모델·기능·시간·비용 제한 등 AI 실행 기준.</dd></div>
      <div><dt>버튼이 비활성화된 경우</dt><dd>필수 정보·사용 범위·권한·처리 중 상태 확인. ‘공개 전 확인 항목’에서 누락된 입력으로 이동해 해결.</dd></div>
      <div><dt>동시에 수정했다는 안내</dt><dd>입력 내용을 먼저 확인하고 최신본과 비교. 최신본 다시 읽기는 현재 입력을 바꿀 수 있으므로 무작정 반복 저장하지 않기.</dd></div>
      <div><dt>휴지통과 신고 숨김</dt><dd>사용자 휴지통은 한국 시각 기준 달력 6개월. 복원은 비공개. 신고 숨김과 별도 상태이며, 사진은 다른 기록의 사용 여부도 확인.</dd></div>
      <div><dt>관리자가 보는 고객 자료</dt><dd>공개 프로필·공개 여행기·대상 댓글·요청 처리 중심. 개인 일정·메모·AI 요청문·대화 원문은 기본 열람 대상에서 제외.</dd></div>
      <div><dt>식별자와 연결</dt><dd>placeId는 개별 장소, mediaId는 사진·영상, journalId는 여행기. 화면의 제목이 같아도 실제 ID를 확인해 대상 구분.</dd></div>
    </dl></section>
    <footer class="guide-footer">화면이 바뀌면 같은 경로의 최신 캡처와 설명을 함께 갱신. 본 매뉴얼은 현재 관리자 사용법 안내.</footer>
  </main></div>
  <dialog id="manual-viewer" class="guide-dialog" aria-labelledby="manual-viewer-title"><header class="guide-dialog-header"><strong id="manual-viewer-title">화면 확대</strong><div class="guide-zoom-actions"><button type="button" class="guide-button" id="manual-zoom-out" aria-label="화면 축소">−</button><span class="guide-zoom-ratio" id="manual-zoom-ratio" aria-live="polite">100%</span><button type="button" class="guide-button" id="manual-zoom-in" aria-label="화면 확대">+</button><button type="button" class="guide-button" id="manual-zoom-fit">너비 맞춤</button><button type="button" class="guide-button" id="manual-zoom-original">원본 크기</button><button type="button" class="guide-button primary" id="manual-viewer-close">닫기</button></div></header><div class="guide-dialog-body"><div class="guide-zoom-scroll" id="manual-zoom-scroll"><div class="guide-zoom-canvas" id="manual-zoom-canvas"></div></div><aside class="guide-zoom-details" id="manual-zoom-details" aria-live="polite"></aside></div></dialog>
  <script type="application/json" id="manual-data">${json(pages)}</script><script type="application/json" id="manual-menus">${json(menus)}</script><script src="manual.js" defer></script>
</body></html>`.replace(/[ \t]+$/gm, '');
fs.writeFileSync(path.join(root, 'index.html'), html, 'utf8');
fs.writeFileSync(path.join(root, 'manual-data.json'), JSON.stringify({ updated: '2026-10-12', menus, pages }, null, 2) + '\n');
const standalonePages = pages.map(page => ({ ...page, image: `data:image/png;base64,${fs.readFileSync(path.join(root, page.image)).toString('base64')}` }));
let standalone = html
  .replace('<link rel="stylesheet" href="manual.css">', `<style>${fs.readFileSync(path.join(root, 'manual.css'), 'utf8')}</style>`)
  .replace(`<script type="application/json" id="manual-data">${json(pages)}</script>`, `<script type="application/json" id="manual-data">${json(standalonePages)}</script>`)
  .replace('<script src="manual.js" defer></script>', `<script>${fs.readFileSync(path.join(root, 'manual.js'), 'utf8')}</script>`);
for (let index = 0; index < pages.length; index++) standalone = standalone.replace(`src="${pages[index].image}"`, `src="${standalonePages[index].image}"`);
fs.writeFileSync(path.join(root, 'spotlog-admin-manual.html'), standalone, 'utf8');
console.log(JSON.stringify({ pages: pages.length, numberedFeatures: features, menus: menus.length, htmlBytes: Buffer.byteLength(html), standaloneBytes: Buffer.byteLength(standalone) }));
