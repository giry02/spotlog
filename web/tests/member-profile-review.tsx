// Fictional, DEV-only fixture. No customer storage or external account is read or written.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import TogetherApp from '../src/together/TogetherApp';
import { createEmptyState } from '../src/together/model';
import { createTogetherRepository, togetherStorageKey } from '../src/together/repository';
import { DISCOVERY_CATALOG_VERSION } from '../src/together/discoveryExamples';
import { koreaDay, shiftDay } from '../src/together/discovery';
import { placeCatalog } from '../src/data';
import photo from '../../assets/spotlog/seoul-forest-evening.webp';
import '../src/styles.css';
import '../src/theme.css';

const viewer = { id: 'profile-viewer', name: '검수 모임장' }, groupId = 'profile-group', activityId = 'profile-activity', authorId = 'profile-member';
const state = createEmptyState(viewer.id, viewer.name), timestamp = new Date().toISOString(), date = shiftDay(koreaDay(new Date()), 3);
state.discoveryCatalogVersion = DISCOVERY_CATALOG_VERSION;
state.members.push({ id: authorId, name: '검수 멤버', avatar: photo }, { id: 'profile-other', name: '다른 검수 멤버' });
state.groups.push({ id: groupId, name: '가상 산책 모임', kind: 'HOBBY', region: '서울', introduction: '멤버 기록을 확인하는 가상 모임입니다.', cover: photo,
  ownerId: viewer.id, memberIds: state.members.map(item => item.id), managerIds: [], archived: false, visibility: 'PRIVATE', promotionPublished: false,
  memberProfiles: { [authorId]: { nickname: '산책 친구', introduction: '이 가상 모임에 직접 남긴 소개입니다.', answers: [], availableTimes: [], rulesAccepted: true } } });
state.activities.push({ id: activityId, groupId, title: '함께 걷는 오후', date, endDate: date, startTime: '15:00', meetingPoint: '가상 만남 장소', description: '멤버 활동 확인용 약속입니다.',
  cover: photo, status: 'PLANNED', leadId: viewer.id, editorIds: [], participants: { [viewer.id]: 'JOINED', [authorId]: 'JOINED' }, arrivedIds: [], revision: 1 });
for (const scope of [undefined, activityId]) state.posts.push({ id: scope ? 'profile-activity-post' : 'profile-group-post', groupId, activityId: scope, authorId: viewer.id,
  title: scope ? '약속에 남긴 정확한 원문' : '모임 전체에 남긴 정확한 원문', body: '댓글 링크가 이 글을 펼치고 정확한 댓글을 보여주는지 확인합니다.', category: 'FREE', createdAt: timestamp, likes: [],
  comments: [{ id: scope ? 'profile-activity-comment' : 'profile-group-comment', authorId, body: scope ? '이 약속에 남긴 가상 댓글입니다.' : '모임 전체 글에 남긴 가상 댓글입니다.', createdAt: timestamp }] });
state.posts.push({ id: 'profile-member-post', groupId, authorId, title: '내가 작성한 모임 이야기', body: '기존 게시글 탭도 유지합니다.', category: 'FREE', createdAt: timestamp, likes: [], comments: [] });
state.media.push({ id: 'profile-member-photo', groupId, authorId, kind: 'PHOTO', url: photo, caption: '가상 검수 참고 사진', createdAt: timestamp });
const memory = new Map<string, string>([[togetherStorageKey(viewer.id), JSON.stringify(state)]]);
const storage: Storage = { get length() { return memory.size; }, getItem: key => memory.get(key) ?? null, setItem: (key, value) => { memory.set(key, value); }, removeItem: key => { memory.delete(key); }, clear: () => memory.clear(), key: index => [...memory.keys()][index] ?? null };
const repository = createTogetherRepository(viewer.id, viewer.name, placeCatalog, storage);
function Review() {
  const [route, setRoute] = useState(`group-${groupId}`);
  return <main className="app-shell"><section className="content"><TogetherApp repository={repository} route={route} viewer={viewer} places={placeCatalog} journeys={[]} onNavigate={setRoute} onBack={() => setRoute(`group-${groupId}`)} onLogin={() => {}} onOpenJourney={() => {}} onSavePlace={() => {}} onCopyJourney={() => {}}/></section></main>;
}
if (import.meta.env.DEV) createRoot(document.getElementById('root')!).render(<Review/>);
