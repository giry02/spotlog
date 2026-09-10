// Standalone guide navigation only; no application data or service functionality.
document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.section) document.getElementById(button.dataset.section)?.scrollIntoView({ behavior: 'auto', block: 'start' });
  if (button.dataset.service) window.location.assign('./#home');
});
