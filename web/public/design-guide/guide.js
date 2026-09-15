// Standalone guide navigation only; no application data or service functionality.
document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.section) document.getElementById(button.dataset.section)?.scrollIntoView({ behavior: 'auto', block: 'start' });
  if (button.dataset.service) {
    const destination = new URL('./#home', window.location.href).href;
    if (new URLSearchParams(window.location.search).get('embed') === '1') window.parent.location.href = destination;
    else window.location.assign(destination);
  }
});
