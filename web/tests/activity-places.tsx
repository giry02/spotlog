// DEV-only fixture. Uses public catalogue venue facts and fresh memory state; writes no customer data.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { placeCatalog } from '../src/data';
import { createEmptyState } from '../src/together/model';
import { applyActivityPlaceAction } from '../src/together/activityPlaces';
import ActivityPlacesRoute from '../src/together/ActivityPlacesRoute';
import PollView from '../src/together/PollView';
import '../src/styles.css';
import '../src/theme.css';

const places = (['FOOD', 'CAFE', 'STAY'] as const).map(kind => placeCatalog.find(place => place.kind === kind && !place.personal && `${place.area} ${place.address}`.includes('부산')) || placeCatalog.find(place => place.kind === kind && !place.personal)!).filter(Boolean);
const initial = createEmptyState('me', '나');
initial.groups.push({ id: 'fixture-group', name: '우리의 주말', kind: 'FRIENDS', region: '부산', introduction: '', cover: '', ownerId: 'me', memberIds: ['me'], managerIds: [], archived: false, visibility: 'PRIVATE', promotionPublished: false });
initial.activities.push({ id: 'fixture-appointment', groupId: 'fixture-group', kind: 'MEETUP', title: '음식점과 카페에서 만나요', date: '2026-12-05', endDate: '2026-12-05', meetingPoint: '', description: '', status: 'PLANNED', leadId: 'me', editorIds: [], participants: {}, arrivedIds: [], revision: 1, placeCandidateIds: places.map(place => place.id) });
for (const place of places.slice(0, 2)) applyActivityPlaceAction(initial, 'me', { groupId: 'fixture-group', activityId: 'fixture-appointment', expectedRevision: initial.activities[0].revision, type: 'ADD_STOP', placeId: place.id }, places);
initial.polls.push({ id: 'fixture-poll', groupId: 'fixture-group', activityId: 'fixture-appointment', question: '어디에서 만날까요?', options: places.slice(0, 2).map((place, index) => ({ id: `option-${index}`, label: `${place.name} · ${place.address}`, placeId: place.id, voterIds: [] })), closed: false });
function Fixture() {
  const [state, setState] = useState(initial);
  return <main className="app-shell"><div className="page" style={{ padding: 20 }}><ActivityPlacesRoute state={state} userId="me" groupId="fixture-group" activityId="fixture-appointment" places={placeCatalog} onAction={action => { const next = structuredClone(state); applyActivityPlaceAction(next, 'me', action, placeCatalog); setState(next); return true; }}/><div style={{ marginTop: 32 }}><PollView state={state} userId="me" poll={state.polls[0]} places={placeCatalog} onVote={id => { setState(current => ({ ...current, polls: current.polls.map(poll => ({ ...poll, options: poll.options.map(option => ({ ...option, voterIds: option.id === id ? ['me'] : [] })) })) })); return true; }}/></div></div></main>;
}
if (import.meta.env.DEV) createRoot(document.getElementById('root')!).render(<Fixture/>);
