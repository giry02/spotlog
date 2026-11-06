import type { Journey, Place } from '../data';
import { koreaDay } from '../together/discovery.ts';
import { isMember, memberName, togetherId, type TogetherActivity, type TogetherState } from '../together/model.ts';

export interface AppointmentInput {
  title: string;
  date: string;
  startTime?: string;
  meetingPoint?: string;
  description?: string;
  kind?: 'FRIENDS' | 'FAMILY';
  placeId?: string;
}

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00+09:00`))
    && koreaDay(new Date(`${value}T12:00:00+09:00`)) === value;
}

/** A short, private appointment owns its room without requiring a permanent club. */
export function createStandaloneAppointment(state: TogetherState, actorId: string, input: AppointmentInput, places: ReadonlyArray<Place> = []): TogetherActivity {
  if (!actorId || !state.members.some(member => member.id === actorId)) throw new Error('로그인한 뒤 약속을 만들 수 있어요.');
  const title = input.title.trim();
  if (!title || title.length > 100) throw new Error('약속 이름을 100자 안으로 적어 주세요.');
  if (input.date && !validDate(input.date)) throw new Error('약속 날짜를 다시 확인해 주세요.');
  if (input.startTime && (!input.date || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.startTime))) throw new Error('날짜와 시작 시간을 다시 확인해 주세요.');
  if ((input.meetingPoint?.length ?? 0) > 300 || (input.description?.length ?? 0) > 2000) throw new Error('장소는 300자, 설명은 2,000자 안으로 적어 주세요.');
  const selected = input.placeId ? places.find(place => place.id === input.placeId) : undefined;
  if (input.placeId && !selected) throw new Error('선택한 장소를 찾지 못했어요. 다시 골라 주세요.');
  const groupId = togetherId('appointment-space');
  const group = { id: groupId, name: title, kind: input.kind === 'FAMILY' ? 'FAMILY' as const : 'FRIENDS' as const,
    spaceType: 'ACTIVITY' as const, region: selected?.area.split(/\s+/)[0] ?? '', introduction: '', cover: selected?.image ?? '',
    visibility: 'PRIVATE' as const, ownerId: actorId, memberIds: [actorId], managerIds: [], archived: false,
    promotionPublished: false, sourceKind: 'LOCAL' as const, interestPlaceIds: selected ? [selected.id] : [] };
  let journey: Journey | undefined;
  if (selected) {
    // Selected place information only: personal notes, source booking locks and old visits are never copied.
    const place: Place = { id: selected.id, kind: selected.kind, name: selected.name, area: selected.area,
      address: selected.address, lat: selected.lat, lng: selected.lng, image: selected.image,
      photos: selected.photos ? structuredClone(selected.photos) : undefined, description: selected.description,
      note: '', duration: selected.duration, personal: selected.personal, locationVerified: selected.locationVerified,
      visitId: togetherId('visit'), bookingFixed: false, ...(input.startTime ? { time: input.startTime } : {}) };
    journey = { id: togetherId('appointment-plan'), purpose: 'PLAN', planStage: 'READY', title, region: group.region,
      dateRange: input.date, duration: '하루 약속', status: 'PLANNING', visibility: 'PRIVATE', cover: place.image,
      summary: '', story: '', tags: [], saves: 0, author: memberName(state, actorId), isMine: false,
      days: [{ dayId: togetherId('day'), day: 1, date: input.date, title: '함께할 일정', story: '', places: [place],
        blocks: [{ id: togetherId('block'), type: 'PLACE', placeId: place.id, visitId: place.visitId }] }] };
  }
  const activity: TogetherActivity = { id: togetherId('activity'), groupId, kind: 'MEETUP', title,
    date: input.date, endDate: input.date, ...(input.startTime ? { startTime: input.startTime } : {}),
    meetingPoint: input.meetingPoint?.trim() || selected?.name || '', description: input.description?.trim() ?? '',
    status: 'PLANNED', leadId: actorId, editorIds: [], participants: {}, arrivedIds: [], revision: 1, ...(journey ? { journey } : {}) };
  state.groups.push(group);
  state.activities.push(activity);
  return activity;
}

export type AppointmentRange = 'upcoming' | 'undated' | 'past';

/** Private material is selected only for current membership, including standalone appointment spaces. */
export function memberAppointments(state: TogetherState, userId: string, range: AppointmentRange, today = koreaDay()): TogetherActivity[] {
  if (!userId) return [];
  return state.activities.filter(activity => {
    const group = state.groups.find(item => item.id === activity.groupId);
    if (!group || group.archived || group.blockedMemberIds?.includes(userId) || !isMember(state, userId, group.id)) return false;
    const past = activity.status !== 'PLANNED' || Boolean((activity.endDate || activity.date) && (activity.endDate || activity.date) < today);
    return range === 'past' ? past : range === 'undated' ? !past && !activity.date : !past && Boolean(activity.date);
  }).sort((a, b) => {
    const result = `${a.date}T${a.startTime || '23:59'}`.localeCompare(`${b.date}T${b.startTime || '23:59'}`);
    return range === 'past' ? -result : result;
  });
}

export function appointmentRequests(state: TogetherState, userId: string, today = koreaDay()): number {
  return [...memberAppointments(state, userId, 'upcoming', today), ...memberAppointments(state, userId, 'undated', today)]
    .filter(activity => activity.leadId !== userId && activity.participants[userId] === undefined).length;
}

/** Expired historical trips belong to records; undated drafts remain in the appointment workspace. */
export function personalPlansForRange(plans: ReadonlyArray<Journey>, range: AppointmentRange, today = koreaDay()): Journey[] {
  return plans.filter(plan => {
    if (!plan.isMine || plan.trash || plan.purpose !== 'PLAN') return false;
    const dates = plan.days.map(day => day.date).filter(validDate).sort();
    const last = dates.at(-1) || (plan.startDate && validDate(plan.startDate) ? plan.startDate : '');
    return range === 'past' ? Boolean(last && last < today) : range === 'undated' ? !last : Boolean(last && last >= today);
  }).sort((a, b) => {
    const firstDate = (plan: Journey) => plan.days.map(day => day.date).filter(validDate).sort()[0] || plan.startDate || '';
    const order = firstDate(a).localeCompare(firstDate(b));
    return range === 'past' ? -order : order;
  });
}
