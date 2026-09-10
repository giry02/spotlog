(() => {
  const docs = {
    development: { title: 'Spotlog 추가 개발 계획서', file: 'spotlog-development-plan.html', category: 'development' },
    ai: { title: 'Spotlog AI 관광 가이드·자동번역 개발 계획서', file: 'spotlog-ai-guide-plan.html', category: 'ai' },
    data: { title: 'Spotlog 데이터 수집 계획서', file: 'spotlog-data-supply-plan.html', category: 'data' },
    'summary-development': { title: '개발 계획 요약', file: 'spotlog-development-summary.html', category: 'summary' },
    'summary-ai': { title: 'AI 개발 요약', file: 'spotlog-ai-guide-summary.html', category: 'summary' },
  };
  const viewer = document.getElementById('document-viewer'), status = document.getElementById('document-status');
  const open = document.getElementById('open-document'), print = document.getElementById('print-document');
  const frames = new Map(); let active = 'development', lastSummary = 'summary-development';
  function keyFromHash() { const key = location.hash.slice(1); return key === 'summary' ? lastSummary : docs[key] ? key : 'development'; }
  function updateLink(frame, doc) { let hash = ''; try { hash = frame.contentWindow.location.hash; } catch {} open.href = './' + doc.file + hash; }
  function load(key, requestedHash) {
    const doc = docs[key]; active = key; if (doc.category === 'summary') lastSummary = key;
    for (const [id, frame] of frames) frame.hidden = id !== key;
    for (const tab of document.querySelectorAll('[role="tab"]')) { const selected = tab.id === 'tab-' + doc.category; tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1; }
    viewer.setAttribute('aria-labelledby', 'tab-' + doc.category);
    document.getElementById('document-name').textContent = doc.title;
    document.title = doc.title + ' | Spotlog 문서 모음';
    document.getElementById('summary-options').hidden = doc.category !== 'summary';
    for (const option of document.querySelectorAll('#summary-options a')) if (option.hash.slice(1) === key) option.setAttribute('aria-current', 'page'); else option.removeAttribute('aria-current');
    let frame = frames.get(key);
    if (!frame) {
      frame = document.createElement('iframe'); frame.title = doc.title; frame.dataset.doc = key;
      frame.src = './' + doc.file + '?embed=1' + (requestedHash || '');
      frames.set(key, frame); status.hidden = false; print.disabled = true;
      const timeout = setTimeout(() => { if (!frame.dataset.ready) { frame.dataset.failed = 'true'; if (active === key) { status.textContent = '문서를 불러오지 못했습니다. 별도 열기로 다시 확인해 주세요.'; status.hidden = false; } } }, 12000);
      frame.addEventListener('load', () => {
        clearTimeout(timeout);
        try {
          if (!frame.contentDocument.querySelector('.slide.active')) throw Error('document not ready');
          frame.dataset.ready = 'true';
          delete frame.dataset.failed;
          if (frame.dataset.pendingHash) { frame.contentWindow.location.hash = frame.dataset.pendingHash; delete frame.dataset.pendingHash; }
          frame.contentDocument.addEventListener('click', event => {
            const link = event.target.closest('a[href]'); if (!link || link.getAttribute('href').startsWith('#')) return;
            const url = new URL(link.href), target = Object.entries(docs).find(([, item]) => new URL('./' + item.file, location.href).pathname === url.pathname);
            if (!target || url.origin !== location.origin) return;
            event.preventDefault(); history.pushState(null, '', '#' + target[0]); load(target[0], url.hash);
          });
          frame.contentWindow.addEventListener('hashchange', () => { if (active === key) updateLink(frame, doc); });
          // The report viewer also uses replaceState for next/previous navigation.
          for (const event of ['click', 'keydown', 'touchend']) frame.contentDocument.addEventListener(event, () => setTimeout(() => { if (active === key) updateLink(frame, doc); }, 0));
          if (active === key) { status.hidden = true; print.disabled = false; updateLink(frame, doc); }
        } catch { frame.dataset.failed = 'true'; if (active === key) { status.textContent = '문서를 불러오지 못했습니다. 별도 열기로 확인해 주세요.'; status.hidden = false; } }
      });
      viewer.append(frame);
    } else {
      frame.hidden = false;
      if (requestedHash) { if (frame.dataset.ready) frame.contentWindow.location.hash = requestedHash; else frame.dataset.pendingHash = requestedHash; }
      status.hidden = Boolean(frame.dataset.ready); print.disabled = !frame.dataset.ready;
    }
    status.textContent = frame.dataset.failed ? '문서를 불러오지 못했습니다. 별도 열기로 확인해 주세요.' : '문서를 불러오는 중입니다.'; updateLink(frame, doc);
  }
  window.addEventListener('hashchange', () => load(keyFromHash()));
  document.querySelector('.document-tabs').addEventListener('keydown', event => {
    const tabs = [...document.querySelectorAll('[role="tab"]')], index = tabs.indexOf(event.target); if (index < 0) return;
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    if (event.key === 'Home') next = 0; if (event.key === 'End') next = tabs.length - 1;
    if (next === undefined) return;
    event.preventDefault(); tabs[next].focus(); location.hash = tabs[next].hash;
  });
  print.addEventListener('click', () => { const frame = frames.get(active); if (frame?.dataset.ready) { frame.contentWindow.focus(); frame.contentWindow.print(); } });
  load(keyFromHash());
})();
