(() => {
  const adminLink = document.querySelector('[data-live-admin-link]');
  if (adminLink && (location.protocol === 'file:' || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname))) adminLink.href = 'http://127.0.0.1:5210/admin.html';
  const pages = JSON.parse(document.getElementById('manual-data').textContent);
  const menus = JSON.parse(document.getElementById('manual-menus').textContent);
  const byId = new Map(pages.map(page => [page.id, page]));
  const search = document.getElementById('manual-search');
  const status = document.getElementById('manual-search-state');
  const contents = document.getElementById('manual-contents');
  let menu = 'start';
  const text = page => JSON.stringify([page.title, page.purpose, page.path, page.callouts, page.steps, page.notes]).toLocaleLowerCase();
  function update() {
    const query = search.value.trim().toLocaleLowerCase();
    const matching = pages.filter(page => (!query ? menu === 'start' ? page.menu === 'overview' : menu === 'all' || page.menu === menu : text(page).includes(query)));
    const ids = new Set(matching.map(page => page.id));
    document.querySelectorAll('.guide-page').forEach(element => element.hidden = !ids.has(element.id));
    document.querySelectorAll('.guide-chapter-heading').forEach(element => element.hidden = !matching.some(page => page.menu === element.dataset.menu));
    document.getElementById('quickstart').hidden = menu !== 'start' || !!query;
    document.getElementById('glossary').hidden = !['start', 'all'].includes(menu) || !!query;
    document.getElementById('manual-no-results').hidden = matching.length > 0;
    status.textContent = query ? `“${search.value.trim()}” 검색 · ${matching.length}개 화면` : `${menu === 'start' ? '처음 사용하기' : menu === 'all' ? '전체 화면' : menus.find(item => item.id === menu)?.name} · ${matching.length}개 화면`;
    document.querySelectorAll('[data-menu-link]').forEach(link => { if (link.dataset.menuLink === menu && !query) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
    contents.replaceChildren();
    for (const page of matching) {
      const anchor = document.createElement('a'); anchor.href = '#' + page.id; anchor.textContent = page.title;
      anchor.addEventListener('click', event => { event.preventDefault(); history.replaceState(null, '', '#' + page.id); document.getElementById(page.id).scrollIntoView({ behavior: 'smooth', block: 'start' }); });
      contents.append(anchor);
    }
  }
  function choose(id, move = true) {
    if (!['start', 'all', ...menus.map(item => item.id)].includes(id)) return;
    menu = id; search.value = ''; history.replaceState(null, '', '#' + id); update();
    if (move) document.getElementById('manual-main').scrollIntoView({ block: 'start' });
  }
  document.querySelectorAll('[data-menu-link]').forEach(link => link.addEventListener('click', event => { event.preventDefault(); choose(link.dataset.menuLink); }));
  search.addEventListener('input', update);
  document.getElementById('manual-search-clear').addEventListener('click', () => { search.value = ''; update(); search.focus(); });
  document.getElementById('manual-print').addEventListener('click', () => { const before = menu; menu = 'all'; search.value = ''; update(); window.print(); menu = before; update(); });
  function selectCallout(pageId, n, move) {
    const page = byId.get(pageId), callout = page?.callouts.find(item => item.n === n);
    if (!callout) return;
    document.querySelectorAll('.guide-callout.is-active').forEach(row => row.classList.remove('is-active'));
    document.querySelectorAll('.guide-marker[aria-pressed=true]').forEach(marker => marker.setAttribute('aria-pressed', 'false'));
    const row = document.getElementById(`${pageId}-callout-${n}`);
    row.classList.add('is-active');
    document.querySelectorAll(`[data-marker-page="${CSS.escape(pageId)}"][data-marker-number="${n}"]`).forEach(marker => marker.setAttribute('aria-pressed', 'true'));
    if (move) row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return callout;
  }
  document.querySelectorAll('[data-marker-page]').forEach(marker => marker.addEventListener('click', () => selectCallout(marker.dataset.markerPage, Number(marker.dataset.markerNumber), true)));
  const dialog = document.getElementById('manual-viewer'), canvas = document.getElementById('manual-zoom-canvas'), viewerText = document.getElementById('manual-zoom-details');
  let shown, scale = 1, returnTo;
  const setScale = value => { if (!shown) return; scale = Math.min(2, Math.max(.15, value)); canvas.style.width = `${shown.width * scale}px`; document.getElementById('manual-zoom-ratio').textContent = `${Math.round(scale * 100)}%`; };
  const fit = () => setScale((document.getElementById('manual-zoom-scroll').clientWidth - 40) / shown.width);
  function viewerExplain(callout) {
    viewerText.replaceChildren();
    const heading = document.createElement('h3'); heading.textContent = callout ? `${callout.n}. ${callout.label}` : shown.title; viewerText.append(heading);
    const entries = callout ? [['하는 일', callout.what], ['사용 방법', callout.how], ['다음 결과', callout.result], ['확인', callout.note]] : [['사용 방법', '화면의 번호를 눌러 기능 설명 확인. + / −로 확대하고 화면 안에서 스크롤.']];
    for (const [label, value] of entries) if (value) { const paragraph = document.createElement('p'), title = document.createElement('b'); title.textContent = label; paragraph.append(title, document.createElement('br'), document.createTextNode(value)); viewerText.append(paragraph); }
  }
  function openViewer(id, trigger) {
    shown = byId.get(id); if (!shown) return; returnTo = trigger; canvas.replaceChildren();
    document.getElementById('manual-viewer-title').textContent = shown.title;
    const img = document.createElement('img'); img.src = shown.image; img.alt = shown.title + ' 실제 관리자 화면'; canvas.append(img);
    for (const callout of shown.callouts) {
      const marker = document.createElement('button'); marker.type = 'button'; marker.className = 'guide-marker'; marker.textContent = callout.n;
      marker.style.left = callout.x + '%'; marker.style.top = callout.y + '%'; marker.setAttribute('aria-label', `${callout.n}. ${callout.label}`);
      marker.setAttribute('aria-pressed', 'false'); marker.dataset.markerPage = shown.id; marker.dataset.markerNumber = callout.n;
      marker.addEventListener('click', () => { selectCallout(shown.id, callout.n, false); viewerExplain(callout); }); canvas.append(marker);
    }
    viewerExplain(); dialog.showModal(); requestAnimationFrame(() => { fit(); document.getElementById('manual-viewer-close').focus(); });
  }
  document.querySelectorAll('[data-enlarge]').forEach(button => button.addEventListener('click', () => openViewer(button.dataset.enlarge, button)));
  document.getElementById('manual-viewer-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => returnTo?.focus({ preventScroll: true }));
  dialog.addEventListener('click', event => { if (event.target === dialog) { const bounds = dialog.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close(); } });
  document.getElementById('manual-zoom-in').addEventListener('click', () => setScale(scale + .15));
  document.getElementById('manual-zoom-out').addEventListener('click', () => setScale(scale - .15));
  document.getElementById('manual-zoom-fit').addEventListener('click', fit);
  document.getElementById('manual-zoom-original').addEventListener('click', () => setScale(1));
  function selectHash() {
    let hash;
    try { hash = decodeURIComponent(location.hash.slice(1)); } catch { hash = ''; }
    if (byId.has(hash)) {
      choose(byId.get(hash).menu, false);
      history.replaceState(null, '', '#' + hash);
      requestAnimationFrame(() => document.getElementById(hash).scrollIntoView({ block: 'start' }));
    } else choose(['start', 'all', ...menus.map(item => item.id)].includes(hash) ? hash : 'start', false);
  }
  window.addEventListener('hashchange', selectHash);
  selectHash();
})();
