export type PrimaryTab = 'home' | 'together' | 'travel' | 'saved' | 'my';
export type MySection = 'schedule' | 'travel' | 'records';
export const primaryTabs: ReadonlyArray<{ id: PrimaryTab; label: string; english: string }> = [
  { id: 'home', label: '홈', english: 'Home' },
  { id: 'together', label: '모임', english: 'Groups' },
  { id: 'travel', label: '여행', english: 'Travel' },
  { id: 'saved', label: '저장', english: 'Saved' },
  { id: 'my', label: '마이', english: 'My' },
];
/** Old public links remain readable; no customer records are migrated. */
export function mySectionForRoute(route: string): MySection | undefined {
  if (['my', 'my-schedule', 'appointments'].includes(route)) return 'schedule';
  if (route === 'my-travel') return 'travel';
  if (['my-records', 'records'].includes(route)) return 'records';
  return undefined;
}
export const myRoute = (section: MySection) => section === 'schedule' ? 'my' : `my-${section}`;
export const isTravelRootRoute = (route: string) => route === 'travel' || route === 'home-trips';
/** Detail URLs must identify their target even when opened from a group/calendar. */
export function detailScreen(state: { editorId?: string | null; journeyId?: string | null; templateId?: string | null }): string | undefined {
  if (state.editorId) return `edit-${state.editorId}`;
  if (state.journeyId) return `journey-${state.journeyId}`;
  if (state.templateId) return `recommendation-${state.templateId}`;
  return undefined;
}
/** Only the user's saved catalogue activates Saved; public discovery belongs to Home. */
export function primaryTabForScreen(tab: string): PrimaryTab {
  if (tab === 'saved') return 'saved';
  if (tab === 'together') return 'together';
  if (tab === 'travel' || tab === 'community') return 'travel';
  if (['my', 'appointments', 'records', 'trips', 'profile', 'offline'].includes(tab)) return 'my';
  return 'home';
}
export function legacyMySection(tab: string, range?: string): MySection | undefined {
  if (tab === 'records' || tab === 'appointments' && range === 'past') return 'records';
  return tab === 'appointments' ? 'schedule' : undefined;
}
/** Only a legacy root hash may retain its saved view; detail IDs must still match their own URL. */
export function legacyMyHashMatches(tab: string, hash: string, hasDetail: boolean): boolean {
  return !hasDetail && legacyMySection(tab) !== undefined && hash === `#${tab}`;
}
