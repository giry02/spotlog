// Shared document navigation only; does not affect the product application.
(() => {
  if (new URLSearchParams(location.search).get('embed') === '1' && window.parent !== window) {
    document.body.classList.add('report-embedded');
    return;
  }
  const nav = document.querySelector('.toolbar nav');
  if (!nav) return;
  const link = document.createElement('a');
  link.href = './spotlog-documents.html'; link.textContent = '문서 모음'; link.className = 'documents-link';
  nav.prepend(link);
  nav.querySelector('a:not(.documents-link):not(.service-link)')?.classList.add('peer-document-link');
})();
