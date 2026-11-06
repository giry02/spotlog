type SheetNavigationHost = Pick<Window, 'history' | 'addEventListener' | 'removeEventListener' | 'setTimeout' | 'clearTimeout'>;
const isSheet = (state: unknown) => Boolean(state && typeof state === 'object' && 'spotlogSheet' in state && (state as { spotlogSheet?: unknown }).spotlogSheet);

/** Close the sheet's own history entry before entering the selected public appointment. */
export function navigateAfterPublicJoin(host: SheetNavigationHost, currentRoute: string, destination: string, navigate: () => void): () => void {
  // Joining changes membership in place. Pushing the same group again makes Back appear to do nothing.
  if (currentRoute === destination) return () => {};
  if (!isSheet(host.history.state)) { navigate(); return () => {}; }
  let settled = false;
  let cancellation: number | undefined;
  const cancel = () => {
    if (settled) return;
    settled = true;
    host.removeEventListener('popstate', onPop);
    if (cancellation !== undefined) host.clearTimeout(cancellation);
  };
  const onPop = (event: PopStateEvent) => {
    if (isSheet(event.state)) return;
    cancel();
    if (!event.state || event.state.togetherRoute !== currentRoute) return;
    navigate();
  };
  host.addEventListener('popstate', onPop);
  // A missing browser close event leaves the joined group's screen usable; it never triggers delayed navigation.
  cancellation = host.setTimeout(cancel, 10_000);
  return cancel;
}
