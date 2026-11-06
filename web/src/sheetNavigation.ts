type Host = Pick<Window, 'history' | 'addEventListener' | 'removeEventListener' | 'setTimeout' | 'clearTimeout'>;
const sheet = (state: unknown) => Boolean(state && typeof state === 'object' && 'spotlogSheet' in state && (state as { spotlogSheet?: unknown }).spotlogSheet);

/** Wait for the sheet's own history entry to close; never leave an extra Back step or navigate on a timer. */
export function afterSheetClose(host: Host, matchesOrigin: (state: unknown) => boolean, navigate: () => void): () => void {
  if (!sheet(host.history.state)) { navigate(); return () => {}; }
  let settled = false;
  let timeout: number | undefined;
  const cancel = () => { if (settled) return; settled = true; host.removeEventListener('popstate', onPop); if (timeout !== undefined) host.clearTimeout(timeout); };
  const onPop = (event: PopStateEvent) => {
    if (sheet(event.state)) return;
    cancel();
    if (matchesOrigin(event.state)) navigate();
  };
  host.addEventListener('popstate', onPop);
  timeout = host.setTimeout(cancel, 10_000);
  return cancel;
}
