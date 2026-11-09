/** Authored synthetic cover photography, never evidence of a real member or event. */
const groupPhotos: Record<string, string> = {
  'public-busan-food': 'friends-shared-meal',
  'public-busan-guide': 'coastal-walking',
  'discovery-gwangan-cafe': 'cafe-conversation',
  'discovery-yeongdo-photo': 'coastal-walking',
  'discovery-gijang-outdoor': 'coastal-walking',
  'discovery-seomyeon-culture': 'cafe-conversation',
  'discovery-seoul-forest': 'coastal-walking',
  'discovery-seoul-culture': 'cafe-conversation',
  'discovery-jeju-slow': 'coastal-walking',
  'discovery-gangneung-photo': 'coastal-walking',
  'discovery-family-weekend': 'coastal-walking',
  'discovery-incheon-taste': 'friends-shared-meal',
  'discovery-busan-books': 'neighborhood-bookclub',
  'discovery-busan-boardgame': 'boardgame-friends',
  'discovery-busan-badminton': 'badminton-club',
  'discovery-busan-running': 'riverside-running',
  'discovery-busan-craft': 'cafe-handcraft',
  'discovery-busan-music': 'music-listening',
  'discovery-busan-language': 'cafe-conversation',
  'discovery-busan-pets': 'neighborhood-dog-walk',
  'family-busan': 'coastal-walking',
  'weekend-walk': 'neighborhood-bookclub',
};

export function exampleGroupPhoto(groupId: string, base = import.meta.env?.BASE_URL ?? '/'): string {
  const photo = Object.hasOwn(groupPhotos, groupId) ? groupPhotos[groupId] : undefined;
  return photo ? `${base.replace(/\/?$/, '/')}media/groups/${photo}-20261109.jpg` : '';
}
