import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const inputPath = path.join(directory, 'features.json');
const outputPath = path.join(directory, 'index.html');
const statuses = ['연결 대기', '관리자 보완', '양쪽 보완', '후속 기능', '운영 전용'];
const currentStatuses = ['로컬 보완 완료', '일부 보완', '서버 연결 대기', '후속 유지'];
const currentDescriptions = {
  '로컬 보완 완료': '명시된 화면·계약·로컬 연결을 보완했습니다. 실제 서버 실행 완료를 뜻하지 않습니다.',
  '일부 보완': '자료·화면 일부를 보완했으며 남은 고객/관리자 표시·어댑터 연결이 있습니다.',
  '서버 연결 대기': '현재 로컬 흐름과 운영 검수는 유지하며 실제 서비스 API·작업·집계 연결이 필요합니다.',
  '후속 유지': '고객 화면 또는 공급 계약이 아직 없는 후속 범위입니다. 완료로 분류하지 않습니다.',
};
const statusDescriptions = {
  '연결 대기': '화면 동작은 있으나 서비스 자료·처리 결과의 연결이 필요합니다.',
  '관리자 보완': '관리자 화면 또는 데이터 계약에 필요한 항목이 부족합니다.',
  '양쪽 보완': '고객과 관리자 양쪽의 흐름·상태·식별자 대응을 보완해야 합니다.',
  '후속 기능': '고객 기능이 아직 구현되지 않았거나 후속 범위로 표시되어 있습니다.',
  '운영 전용': '고객 메뉴와 별도로 필요한 내부 운영 기능입니다.',
};
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
if (!Array.isArray(input.rows)) throw new Error('features.json의 rows 배열이 필요합니다.');
const ids = new Set();
const rows = input.rows.map((row, index) => {
  if (!row || ['id', 'group', 'feature', 'customer', 'admin', 'gap', 'status', 'after', 'remaining', 'currentStatus'].some(key => typeof row[key] !== 'string' || !row[key].trim())) throw new Error(`${index + 1}행의 필수 문자열을 확인해 주세요.`);
  if (ids.has(row.id)) throw new Error(`중복 ID: ${row.id}`);
  ids.add(row.id);
  if (!statuses.includes(row.status)) throw new Error(`지원하지 않는 상태: ${row.status}`);
  if (!currentStatuses.includes(row.currentStatus)) throw new Error(`지원하지 않는 현재 상태: ${row.currentStatus}`);
  if (!Array.isArray(row.beforeRefs)) throw new Error(`${row.id}: 최초 검수 근거를 보존해야 합니다.`);
  if (!Array.isArray(row.refs)) throw new Error(`${row.id}: refs 배열이 필요합니다.`);
  const refs = row.refs.map(ref => {
    const referencePath = typeof ref.path === 'string' ? ref.path.replaceAll('\\', '/') : '';
    if (!referencePath || referencePath.startsWith('/') || /^[a-zA-Z]:/.test(referencePath) || referencePath.split('/').includes('..') || !Number.isInteger(ref.line) || ref.line < 1) throw new Error(`${row.id}: 저장소 상대 경로와 1 이상의 근거 줄 번호가 필요합니다.`);
    const sourcePath = path.resolve(directory, '../../..', referencePath);
    if (!fs.existsSync(sourcePath)) throw new Error(`${row.id}: 근거 파일 없음: ${referencePath}`);
    const sourceLines = fs.readFileSync(sourcePath, 'utf8').split(/\r?\n/);
    const currentLine = ref.anchor ? sourceLines.findIndex(line => line.includes(ref.anchor)) + 1 : ref.line;
    if (!currentLine || currentLine > sourceLines.length) throw new Error(`${row.id}: 근거 줄/anchor를 확인하세요: ${referencePath}`);
    return { ...ref, path: referencePath, line: currentLine };
  });
  return { ...row, refs };
});
const groups = [...new Set(rows.map(row => row.group))];
const countStatus = status => rows.filter(row => row.currentStatus === status).length;
const currentClass = status => `current-${currentStatuses.indexOf(status)}`;
const statusClass = status => `status-${statuses.indexOf(status)}`;
const rowContent = row => `${row.id} ${row.group} ${row.feature} ${row.customer} ${row.admin} ${row.gap} ${row.status} ${row.after} ${row.remaining} ${row.currentStatus} ${row.refs.map(ref => ref.path).join(' ')}`;
const findFactRow = (id, test) => rows.find(row => row.id === id) ?? rows.find(row => test(`${row.feature} ${row.customer} ${row.admin} ${row.gap}`));
const facts = [
  { id: 'A01', label: '원본 83/83 · 미디어 77개', body: '같은 장소 ID로 원본 전체를 관리자 초안에 수용했습니다. 출처 22개와 영상·모션을 보존했으며 사용 허가는 미승인입니다. 최초 검수의 19/83·미디어 0개 기록은 아래에 남겨 두었습니다.' },
  { id: 'C01', label: '공개 여행기 12개 · 홈 추천 초안 7개', body: '고객 공개 여행기를 같은 ID·DAY·표지·사진/장소 문맥으로 읽습니다. 기존 홈 추천 7개도 비공개 수정 초안으로 수용했으며 공개 검수 전 기존 고객 노출을 유지합니다.' },
  { id: 'C36', label: '고객 신고 → 로컬 관리자 접수', body: '대상 ID·사유·접수 시각·댓글/사진 문맥과 접수 결과를 연결했습니다. 개발 모드 로컬 검수와 실제 신고 API를 구분하며 실제 서버 접수·처리 통지는 연결 대기입니다.' },
  { id: 'A05', label: '운영 작업 중심 첫 화면', body: '지역·담당·등록·CSV·검수·추천 생성과 대기 작업을 먼저 보여 줍니다. 연결 상태는 제공된 DTO를 사용하며 실제 서버 지표와 로컬 자료 숫자를 구분합니다.' },
].map(fact => ({ ...fact, row: rows.find(row => row.id === fact.id) })).filter(fact => fact.row);
const referenceLinks = refs => refs.map(ref => `<a href="../../../${ref.path.split('/').map(encodeURIComponent).join('/')}#L${ref.line}" target="_blank" rel="noopener">${escapeHtml(ref.path)}:${ref.line}</a>`).join('');
const renderRow = row => `<tr data-id="${escapeHtml(row.id)}" data-group="${escapeHtml(row.group)}" data-status="${escapeHtml(row.currentStatus)}" data-before-status="${escapeHtml(row.status)}" data-search="${escapeHtml(rowContent(row).toLocaleLowerCase('ko-KR'))}">
  <th scope="row"><span class="group-label">${escapeHtml(row.group)}</span><strong>${escapeHtml(row.feature)}</strong><span class="row-id">${escapeHtml(row.id)}</span></th>
  <td class="before-cell">${escapeHtml(row.customer)}</td><td class="before-cell">${escapeHtml(row.admin)}</td><td class="before-cell gap-cell">${escapeHtml(row.gap)}</td>
  <td class="before-cell"><span class="status ${statusClass(row.status)}">${escapeHtml(row.status)}</span></td>
  <td class="after-cell">${escapeHtml(row.after)}</td><td class="remaining-cell">${escapeHtml(row.remaining)}</td>
  <td><span class="status ${currentClass(row.currentStatus)}">${escapeHtml(row.currentStatus)}</span></td>
  <td class="references">${referenceLinks(row.refs)}<details><summary>최초 검수 근거</summary><p>당시 줄 번호이며 현재 소스와 달라질 수 있습니다.</p>${row.beforeRefs.map(ref => `<code>${escapeHtml(ref.path)}:${ref.line}</code>`).join('')}</details></td>
</tr>`;
const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Spotlog 고객·관리자 기능 대조 · 2026-10-05</title>
<style>
:root{color-scheme:light;--page:#f5f6f8;--surface:#fff;--text:#20242c;--muted:#5d6470;--line:#dce1e8;--accent:#264c7a;--focus:#1c6ed0}*{box-sizing:border-box}body{margin:0;background:var(--page);color:var(--text);font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI","Malgun Gothic",sans-serif}main{max-width:1920px;margin:0 auto;padding:36px 28px 44px}h1{font-size:30px;line-height:1.3;letter-spacing:-.035em;margin:0 0 14px}h2{font-size:20px;line-height:1.4;margin:0 0 12px}p{margin:0}button,input,select{font:inherit;color:inherit}button,select{cursor:pointer}button{min-height:38px;border:1px solid var(--line);border-radius:7px;background:var(--surface);padding:7px 13px;font-size:14px}button:hover{border-color:#8b96a7}button[aria-pressed=true]{background:var(--accent);color:#fff;border-color:var(--accent)}button:focus-visible,input:focus-visible,select:focus-visible,a:focus-visible{outline:3px solid var(--focus);outline-offset:3px}a{color:var(--accent);text-underline-offset:3px}.eyebrow{font-size:14px;font-weight:700;letter-spacing:.04em;color:var(--accent);margin-bottom:10px}.verdict{font-size:21px;font-weight:700;line-height:1.5}.metadata{display:flex;flex-wrap:wrap;gap:6px 20px;color:var(--muted);font-size:14px;margin-top:12px}.scope-note{color:var(--muted);margin-top:12px;max-width:1040px}.facts{display:grid;grid-template-columns:repeat(${Math.min(facts.length || 1, 2)},minmax(0,1fr));gap:24px;margin-top:28px;padding:22px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.fact h2{font-size:17px;margin:0 0 8px}.fact p{font-size:14px;line-height:1.7}.fact button{margin-top:10px}.audit-area{margin-top:28px}.filter-row{display:flex;align-items:end;flex-wrap:wrap;gap:14px;margin-bottom:14px}.field{display:flex;flex-direction:column;gap:6px}.field label{font-size:14px;font-weight:600}.field select,.field input{min-height:42px;background:var(--surface);border:1px solid #b7bfca;border-radius:7px;padding:8px 11px;font-size:16px}.field select{min-width:190px}.search-field{flex:1;min-width:270px}.chips{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 12px}.chip-count{display:inline-block;font-variant-numeric:tabular-nums;margin-left:6px;opacity:.85}.filter-summary{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:14px;color:var(--muted);margin:12px 0}.status-explanation{min-height:24px;font-size:14px;color:var(--muted)}.table-wrap{overflow-x:auto;background:var(--surface);border:1px solid var(--line);border-radius:9px}table{width:100%;min-width:2040px;border-collapse:collapse;table-layout:fixed;font-size:14px;line-height:1.65}col.feature{width:9%}col.customer{width:10%}col.admin{width:10%}col.gap{width:11%}col.status-col{width:6%}col.after{width:17%}col.remaining{width:15%}col.current-status{width:8%}col.refs{width:14%}thead th{background:#edf0f4;font-weight:700;text-align:left;position:sticky;top:0;z-index:1}th,td{padding:15px 14px;vertical-align:top;border-bottom:1px solid var(--line);overflow-wrap:anywhere}tbody th{text-align:left;font-weight:400}tbody tr:last-child th,tbody tr:last-child td{border-bottom:0}tbody tr:hover{background:#fafbfc}tbody tr[hidden]{display:none}.group-label{display:block;font-size:12px;color:var(--muted);margin-bottom:4px}tbody th strong{display:block;font-size:15px;line-height:1.5}.row-id{display:block;margin-top:6px;font-size:12px;color:var(--muted)}td:not(.references){white-space:pre-line}.status{display:inline-block;font-size:13px;font-weight:600;line-height:1.4;padding:5px 8px;border-radius:5px;white-space:nowrap}.status-0{background:#e9f0fa;color:#234c81}.status-1{background:#fff0d9;color:#794900}.status-2{background:#fde9e6;color:#97352a}.status-3{background:#edeaf8;color:#5c427c}.status-4{background:#e8efea;color:#31593c}.references a{display:block;font-size:12px;line-height:1.7;margin-bottom:9px;overflow-wrap:anywhere}.references a:last-child{margin-bottom:0}.empty{padding:32px;text-align:center;color:var(--muted);font-size:16px}.legend{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 24px;margin-top:22px;font-size:14px;color:var(--muted)}.legend-item{display:flex;gap:10px;align-items:start}.legend .status{flex:none}.footer-note{border-top:1px solid var(--line);margin-top:24px;padding-top:16px;color:var(--muted);font-size:14px}.flash{outline:3px solid var(--focus);outline-offset:-3px}@media(max-width:900px){main{padding:24px 16px}h1{font-size:25px}.verdict{font-size:19px}.facts{grid-template-columns:1fr;gap:20px}.legend{grid-template-columns:1fr}}@media(max-width:480px){.field,.search-field{width:100%;min-width:0}.field select,.field input{width:100%}.filter-row>button{width:100%}.chips button{min-height:44px}.metadata{display:block}.metadata span{display:block}}@media print{body{background:#fff}main{max-width:none;padding:0}.filter-row,.chips,.fact button{display:none}.table-wrap{overflow:visible;border:0}table{min-width:0;font-size:11px}th,td{padding:8px}thead th{position:static}.references a{font-size:10px}.status{font-size:10px}.facts{margin-top:18px}.legend{font-size:11px}.footer-note{font-size:11px}}
.group-label,.row-id,.status{font-size:14px}.references a{font-size:14px;min-height:36px;padding:5px 0}
.current-0{background:#e6f2e9;color:#245634}.current-1{background:#fff0d9;color:#794900}.current-2{background:#e9f0fa;color:#234c81}.current-3{background:#edeaf8;color:#5c427c}.before-cell{background:#fafafa}.after-cell{background:#f6fbf7}.remaining-cell{background:#fffdf8}.column-group{text-align:center;background:#e4eaf1}.history-note{margin-top:18px;padding:14px 18px;border:1px solid var(--line);border-radius:8px;background:#fff;font-size:14px}.history-note summary,.references summary{cursor:pointer;font-weight:600}.history-note p{margin-top:8px}.references details{border-top:1px solid var(--line);padding-top:10px;margin-top:12px}.references details p,.references code{display:block;font-size:14px;line-height:1.7;margin-top:6px}.audit-intro{font-size:14px;color:var(--muted);margin-bottom:16px}.table-wrap{max-width:100%}.status{white-space:normal}.history-legend{margin-top:12px}tbody th{position:sticky;left:0;z-index:1;background:var(--surface)}thead tr:first-child th:first-child{left:0;z-index:3}.column-before{background:#e9e9eb}.column-after{background:#e6efe9}@media print{.before-cell,.after-cell,.remaining-cell{background:#fff}.history-note{border:0;padding:0}}
</style>
</head>
<body>
<main>
  <header><p class="eyebrow">SPOTLOG · 기능 대조 감사</p><h1>고객 화면과 관리자 기능을 함께 확인합니다</h1><p class="verdict">로컬 화면·자료 연계를 보완했으며 실제 서버 연결은 남아 있습니다</p><div class="metadata"><span>기준일 2026-10-05</span><span>범위: 현재 로컬 검수본</span><span>확인 방법: 소스·계약·화면 대조</span></div><p class="scope-note">최초 검수의 고객 화면·관리자·보완 항목·상태를 보존하고 이후 보완 결과와 잔여 작업을 추가했습니다. “로컬 보완 완료”는 명시된 화면/자료 연결의 결과이며 실제 서비스 서버·DB·AI·발송 실행 완료를 뜻하지 않습니다.</p></header>
  <details class="history-note"><summary>최초 검수 기록과 현재 수치 구분</summary><p>최초 검수(${escapeHtml(input.date)}): 원본 ${input.counts.adminSourceSeedPlaces}/${input.counts.consumerMasterPlaces}개 · 누락 ${input.counts.missingSourceSeedPlaces}개 · 원본 미디어 ${input.counts.adminSourceSeedMedia}개 · 합성 장소 ${input.counts.adminSyntheticPlaces}개 · 브라우저 확인 ${input.counts.browserChecks}건.</p><p>보완 후(${escapeHtml(input.currentDate)}): 원본 ${input.afterCounts.adminSourceSeedPlaces}/${input.afterCounts.consumerMasterPlaces}개 · 미디어 ${input.afterCounts.adminSourceSeedMedia}개 · 출처 ${input.afterCounts.consumerPhotoSources}개 · 지역 ${input.afterCounts.canonicalRegions}개 · 공개 읽기 여행기 ${input.afterCounts.publicReadingJournals}개 · 홈 추천 비공개 초안 ${input.afterCounts.homeRecommendationDrafts}개 · 장소 작업 브라우저 확인 ${input.afterCounts.masterBrowserChecks}건.</p><p>${escapeHtml(input.verification.notes)}</p><p><a href="../../../${escapeHtml(input.verification.masterTests)}">장소·마이그레이션 검증</a> · <a href="../../../${escapeHtml(input.verification.masterChecks)}">격리 브라우저 검수 결과</a></p></details>
  ${facts.length ? `<section class="facts" aria-label="먼저 확인할 사실">${facts.map(fact => `<article class="fact"><h2>${escapeHtml(fact.label)}</h2><p>${escapeHtml(fact.body)}</p><button type="button" data-jump="${escapeHtml(fact.row.id)}">관련 항목 보기</button></article>`).join('')}</section>` : ''}
  <section class="audit-area" aria-labelledby="audit-title"><h2 id="audit-title">기능별 이전·현재 대조표</h2><p class="audit-intro">${rows.length}개 항목의 최초 상태는 당시의 분류입니다. 현재 보완 상태와 남은 작업은 별도 열에서 확인합니다. 표는 가로로 이동할 수 있습니다.</p>
    <div class="filter-row"><div class="field"><label for="section-filter">기능 영역</label><select id="section-filter"><option value="">모든 영역</option>${groups.map(group => `<option value="${escapeHtml(group)}">${escapeHtml(group)}</option>`).join('')}</select></div><div class="field"><label for="before-filter">최초 검수 상태</label><select id="before-filter"><option value="">모든 최초 상태</option>${statuses.map(status => `<option value="${escapeHtml(status)}">${escapeHtml(status)}</option>`).join('')}</select></div><div class="field search-field"><label for="search">기능·내용·근거 검색</label><input id="search" type="search" placeholder="예: 신고, 사진, 등급, AI" autocomplete="off"></div><button type="button" id="reset">필터 초기화</button></div>
    <div class="chips" role="group" aria-label="현재 보완 상태 필터"><button type="button" class="status-chip" data-status="" aria-pressed="true">전체<span class="chip-count">${rows.length}</span></button>${currentStatuses.map(status => `<button type="button" class="status-chip" data-status="${escapeHtml(status)}" aria-pressed="false">${escapeHtml(status)}<span class="chip-count">${countStatus(status)}</span></button>`).join('')}</div>
    <p id="status-explanation" class="status-explanation">현재 상태를 선택하면 로컬 보완·남은 연결·후속 범위를 나눠 볼 수 있습니다.</p><div class="filter-summary"><span id="result-count" role="status" aria-live="polite">${rows.length}개 중 ${rows.length}개 표시</span><span>근거는 저장소 상대 경로와 1부터 시작하는 줄 번호입니다.</span></div>
    <div class="table-wrap"><table aria-label="고객·관리자 기능의 최초 검수와 현재 보완"><colgroup><col class="feature"><col class="customer"><col class="admin"><col class="gap"><col class="status-col"><col class="after"><col class="remaining"><col class="current-status"><col class="refs"></colgroup><thead><tr><th scope="col" rowspan="2">영역 · 기능</th><th scope="colgroup" colspan="4" class="column-group column-before">최초 검수 기록 · ${escapeHtml(input.date)}</th><th scope="colgroup" colspan="3" class="column-group column-after">보완 후 현재 · ${escapeHtml(input.currentDate)}</th><th scope="col" rowspan="2">현재 근거 · 이전 기록</th></tr><tr><th scope="col">당시 고객 화면</th><th scope="col">당시 관리자</th><th scope="col">당시 보완 필요</th><th scope="col">당시 상태</th><th scope="col">현재 결과 · 해결 내용</th><th scope="col">남은 화면·서버·후속 작업</th><th scope="col">현재 보완 상태</th></tr></thead><tbody id="audit-rows">${rows.map(renderRow).join('')}</tbody></table><p id="empty" class="empty" hidden>조건에 맞는 항목이 없습니다. 검색어나 상태 필터를 바꿔 주세요.</p></div>
    <div class="legend" aria-label="현재 보완 상태의 의미">${currentStatuses.map(status => `<p class="legend-item"><span class="status ${currentClass(status)}">${escapeHtml(status)}</span><span>${escapeHtml(currentDescriptions[status])}</span></p>`).join('')}</div><details class="history-note history-legend"><summary>최초 검수 상태의 의미</summary><div class="legend">${statuses.map(status => `<p class="legend-item"><span class="status ${statusClass(status)}">${escapeHtml(status)}</span><span>${escapeHtml(statusDescriptions[status])}</span></p>`).join('')}</div></details>
  </section>
  <p class="footer-note">최초 검수 상태는 당시 분류를 그대로 보존한 기록이며 현재 상태도 개발 완료율이 아닙니다. 운영 전용 기능은 고객 메뉴에 같은 버튼이 없어도 필요한 기능이며, 개인 일정·예약·고객 AI 요청·대화 원문을 기본 관리자 조회에서 제외한 것은 의도된 개인정보 경계입니다.</p>
</main>
<script>
(() => {
  const descriptions = ${JSON.stringify(currentDescriptions).replaceAll('<', '\\u003c')};
  const tableRows = Array.from(document.querySelectorAll('#audit-rows tr'));
  const chips = Array.from(document.querySelectorAll('.status-chip'));
  const section = document.getElementById('section-filter');
  const search = document.getElementById('search');
  const before = document.getElementById('before-filter');
  const summary = document.getElementById('result-count');
  const explanation = document.getElementById('status-explanation');
  const empty = document.getElementById('empty');
  let selectedStatus = '';
  function update() {
    const term = search.value.trim().toLocaleLowerCase('ko-KR');
    let visible = 0;
    tableRows.forEach(row => {
      row.hidden = Boolean((selectedStatus && row.dataset.status !== selectedStatus) || (before.value && row.dataset.beforeStatus !== before.value) || (section.value && row.dataset.group !== section.value) || (term && !row.dataset.search.includes(term)));
      if (!row.hidden) visible++;
    });
    chips.forEach(chip => chip.setAttribute('aria-pressed', String(chip.dataset.status === selectedStatus)));
    summary.textContent = tableRows.length + '개 중 ' + visible + '개 표시';
    explanation.textContent = selectedStatus ? descriptions[selectedStatus] : '현재 상태를 선택하면 로컬 보완·남은 연결·후속 범위를 나눠 볼 수 있습니다.';
    empty.hidden = visible !== 0;
  }
  function reset() { selectedStatus = ''; section.value = ''; before.value = ''; search.value = ''; update(); }
  chips.forEach(chip => chip.addEventListener('click', () => { selectedStatus = chip.dataset.status; update(); }));
  section.addEventListener('change', update);
  before.addEventListener('change', update);
  search.addEventListener('input', update);
  document.getElementById('reset').addEventListener('click', reset);
  document.querySelectorAll('[data-jump]').forEach(button => button.addEventListener('click', () => {
    reset();
    const row = tableRows.find(item => item.dataset.id === button.dataset.jump);
    if (!row) return;
    row.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
    row.classList.add('flash');
    setTimeout(() => row.classList.remove('flash'), 1600);
  }));
})();
</script>
</body>
</html>`;
fs.writeFileSync(outputPath, html, 'utf8');
console.log(`Generated ${outputPath} (${rows.length} rows, ${groups.length} groups, ${facts.length} source-grounded facts).`);
