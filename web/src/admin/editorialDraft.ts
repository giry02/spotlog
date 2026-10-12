import type { AdminState, AdminPlace, PlaceContent } from './types';
import type { CuratedDay, CuratedTrip, CuratedVisit, EditorialJournalDraft, OpsMember, OpsReference, PublicJournalPhoto, PublicJournalPlace, PublicSourceCredit } from './opsTypes';
import { distanceKm, eligiblePublished } from './selectors.ts';
import { contentInRegion, regionLabel } from './regions.ts';
import { creatorGradeRules, currentCreatorGrade } from '../creatorGrade.ts';

export const editorialSlotLabels: Record<CuratedVisit['slot'], string> = { morning: '오전', lunch: '점심', afternoon: '오후', dinner: '저녁', stay: '숙박' };
export const editorialKindLabels: Record<PlaceContent['kind'], string> = { LANDMARK: '랜드마크', FOOD: '음식점', CAFE: '카페', STAY: '숙소', SHOP: '쇼핑' };
export function curatedPlaceIds(days: CuratedDay[]): string[] { return [...new Set(days.flatMap(day => day.visits.map(visit => visit.placeId)))]; }
export function publicPlaceMedia(record: AdminPlace | undefined) {
  return (record ? eligiblePublished(record)?.media ?? [] : []).filter(media => media.type === 'PHOTO' && !media.withdrawn && !record?.revokedMediaIds?.includes(media.mediaId) && media.rights.display && media.rights.store);
}
/** Existing public sample source media can be inspected in an operator-owned private editing draft. */
export function editorialReviewMedia(record: AdminPlace | undefined, trip: CuratedTrip) {
  return trip.sourceKind === 'PUBLIC_SAMPLE' && trip.visibility === 'PRIVATE' ? (record?.draft.media ?? []).filter(media => media.type === 'PHOTO' && !media.withdrawn && !record?.revokedMediaIds?.includes(media.mediaId)) : publicPlaceMedia(record);
}
function credit(content: PlaceContent): PublicSourceCredit { return { provider: content.provider, sourceUrl: content.sourceUrl, checkedAt: content.checkedAt }; }
function mediaPhoto(record: AdminPlace, mediaId?: string, trip?: CuratedTrip): PublicJournalPhoto | undefined {
  const choices = trip ? editorialReviewMedia(record, trip) : publicPlaceMedia(record), media = mediaId ? choices.find(item => item.mediaId === mediaId) : choices[0];
  return media ? { id: media.mediaId, image: media.url, caption: media.caption || media.alt, sourceCredit: { provider: media.provider, author: media.author, sourceUrl: media.sourceUrl, license: media.license, licenseUrl: media.licenseUrl, checkedAt: media.checkedAt } } : undefined;
}
export function editorialRegionChoices(state: AdminState): string[] { return [...new Set(state.places.flatMap(record => { const content = eligiblePublished(record); return content ? [content.area] : []; }))].sort((a, b) => a.localeCompare(b, 'ko')); }
export function editorialCandidates(state: AdminState, region: string, placeIds?: string[]): AdminPlace[] {
  return state.places.filter(record => { const content = eligiblePublished(record); return !!content && (placeIds ? placeIds.includes(record.placeId) : !region || (state.regions?.some(item => item.regionId === region) ? contentInRegion(content, state.regions, region) : content.area === region || content.area.startsWith(region + ' '))); });
}
export interface EditorialDraftRequest { curatedTripId: string; regionId: string; regionName?: string; dayCount: number; prompt: string; now: string; eligiblePlaceIds?: string[] }
/** Deterministic local composition over registered published records; no model or external place search. */
export function generateEditorialDraft(state: AdminState, request: EditorialDraftRequest): CuratedTrip {
  if (!request.regionId || !Number.isInteger(request.dayCount) || request.dayCount < 1 || request.dayCount > 14) throw new Error('지역과 1~14일 기간을 선택하세요.');
  const pool = editorialCandidates(state, request.regionId, request.eligiblePlaceIds), landmarks = pool.filter(record => record.published!.kind === 'LANDMARK');
  if (landmarks.length < request.dayCount) throw new Error(`선택한 지역의 공개 랜드마크 ${landmarks.length}곳으로 ${request.dayCount}개 DAY를 구성할 수 없습니다. 기간을 줄이거나 장소를 등록하세요.`);
  const prompt = request.prompt.trim(), wants = (words: string) => new RegExp(words, 'i').test(prompt) && !new RegExp(`(?:${words})(?:은|는|을|를|도|만)?\\s*(?:제외|빼|없이|포함하지|불필요)|(?:제외|빼고|없이)\\s*(?:${words})`, 'i').test(prompt);
  const includeFood = wants('맛집|음식점|식당|식사|점심|저녁|food|meal|restaurant'), includeCafe = wants('카페|커피|cafe|coffee'), includeStay = wants('숙소|숙박|호텔|리조트|stay|hotel');
  const includeDinner = includeFood && wants('저녁|dinner'), includeLunch = includeFood && (!includeDinner || wants('점심|lunch'));
  const notes = ['등록된 공개 장소와 거리 기준으로 구성한 로컬 규칙 초안입니다. 이동 시간·영업시간·예약 가능 여부는 확인하지 않았습니다.'];
  const preferenceTokens = prompt.split(/[\s,·.!?]+/).filter(word => word.length >= 2 && !/추천|여행|일정|해주세요|주세요|맛집|식당|음식|카페|숙소|숙박/.test(word));
  const preferenceScore = (record: AdminPlace) => preferenceTokens.reduce((score, token) => score + Number(`${record.published!.name} ${record.published!.description} ${record.published!.tags?.join(' ') ?? ''}`.includes(token)), 0);
  const available = [...landmarks].sort((a, b) => preferenceScore(b) - preferenceScore(a) || a.placeId.localeCompare(b.placeId)), used = new Set<string>();
  const nearest = (records: AdminPlace[], anchor: AdminPlace) => [...records].sort((a, b) => distanceKm(anchor.published!, a.published!) - distanceKm(anchor.published!, b.published!) || a.placeId.localeCompare(b.placeId));
  const days: CuratedDay[] = [];
  const addVisit = (day: CuratedDay, record: AdminPlace, slot: CuratedVisit['slot']) => { used.add(record.placeId); day.visits.push({ visitId: `${request.curatedTripId}:day-${day.day}:visit-${day.visits.length + 1}`, placeId: record.placeId, slot, introduction: record.published!.description, ...(publicPlaceMedia(record)[0] ? { mediaId: publicPlaceMedia(record)[0].mediaId } : {}) }); };
  let previous: AdminPlace | undefined;
  for (let dayNumber = 1; dayNumber <= request.dayCount; dayNumber++) {
    const first = previous ? nearest(available, previous)[0] : available[0]; available.splice(available.indexOf(first), 1);
    const day: CuratedDay = { dayId: `${request.curatedTripId}:day-${dayNumber}`, day: dayNumber, title: first.published!.name + ' 중심', introduction: '공개 장소 자료를 바탕으로 제안하는 방문 순서입니다.', visits: [] };
    addVisit(day, first, 'morning');
    const addBusiness = (kind: PlaceContent['kind'], slot: CuratedVisit['slot'], anchor: AdminPlace) => {
      const candidate = nearest(pool.filter(record => record.published!.kind === kind && (kind === 'STAY' || !used.has(record.placeId)) && !state.nearbyOverrides.some(override => override.anchorPlaceId === anchor.placeId && override.businessPlaceId === record.placeId && override.mode === 'EXCLUDED')), anchor).find(record => distanceKm(anchor.published!, record.published!) <= 15);
      if (candidate) addVisit(day, candidate, slot); else notes.push(`DAY ${dayNumber} ${editorialKindLabels[kind]}: 가까운 공개 등록 자료가 없어 배치하지 않았습니다.`);
    };
    if (includeLunch) addBusiness('FOOD', 'lunch', first);
    let last = first;
    if (!/천천히|느긋|여유|slow/i.test(prompt) && available.length > request.dayCount - dayNumber) { last = nearest(available, first)[0]; available.splice(available.indexOf(last), 1); addVisit(day, last, 'afternoon'); }
    if (includeCafe) addBusiness('CAFE', 'afternoon', last);
    if (includeDinner) addBusiness('FOOD', 'dinner', last);
    if (includeStay && dayNumber < request.dayCount) addBusiness('STAY', 'stay', last);
    previous = last; days.push(day);
  }
  if (includeStay && request.dayCount === 1) notes.push('당일 일정에는 숙박을 넣지 않았습니다. 숙박이 필요하면 기간을 늘리세요.');
  const regionName = request.regionName || request.regionId;
  const draft: CuratedTrip = { curatedTripId: request.curatedTripId, revision: 0, title: `${regionName} ${request.dayCount}일 운영 추천 여행`, introduction: `${regionName}의 공개 등록 장소를 엮은 ${request.dayCount}일 방문 제안입니다. 실제 방문 후기가 아닌 운영 추천 여행기입니다.`, placeIds: curatedPlaceIds(days), visibility: 'PRIVATE', sourceKind: 'EDITORIAL', regionId: request.regionId, dayCount: request.dayCount, days, generation: { method: 'LOCAL_RULES', requestedAt: request.now, notes } };
  const cover = draft.placeIds.flatMap(placeId => publicPlaceMedia(pool.find(record => record.placeId === placeId)))[0]; if (cover) draft.coverMediaId = cover.mediaId;
  draft.editorialJournal = buildEditorialJournal(state, draft, request.now);
  return draft;
}
/** Rebuild owned editorial content from the chosen public records; never edits source places or customer journals. */
export function buildEditorialJournal(state: AdminState, trip: CuratedTrip, now: string): EditorialJournalDraft {
  const days = (trip.days ?? []).map(day => {
    const places = day.visits.flatMap(visit => {
      const record = state.places.find(item => item.placeId === visit.placeId), content = record && (eligiblePublished(record) ?? (trip.sourceKind === 'PUBLIC_SAMPLE' && trip.visibility === 'PRIVATE' ? record.draft : null)); if (!record || !content) return [];
      const photo = visit.mediaId ? mediaPhoto(record, visit.mediaId, trip) : undefined, place: PublicJournalPlace = { id: record.placeId, visitId: visit.visitId, kind: content.kind, name: content.name, area: content.area, address: content.address, image: photo?.image ?? '', description: content.description, note: visit.introduction, duration: content.visitDuration ?? '', planningSlot: visit.slot, sourceCredit: credit(content), photos: photo ? [photo] : [] };
      return [place];
    });
    return { dayId: day.dayId, day: day.day, date: '', title: day.title, story: day.introduction, places, blocks: places.map(place => ({ id: place.visitId!, type: 'PLACE' as const, placeId: place.id, visitId: place.visitId })) };
  });
  const allPhotos = days.flatMap(day => day.places.flatMap(place => place.photos ?? [])), coverRecord = state.places.find(record => trip.placeIds.includes(record.placeId) && editorialReviewMedia(record, trip).some(photo => photo.mediaId === trip.coverMediaId)), cover = coverRecord ? mediaPhoto(coverRecord, trip.coverMediaId, trip) : allPhotos[0];
  const article = days.map(day => `DAY ${day.day}은 ${day.places.map(place => `${editorialSlotLabels[place.planningSlot ?? 'afternoon']} ${place.name}`).join(' → ')} 순서로 제안합니다.`).join('\n\n');
  return { journalId: `editorial:${trip.curatedTripId}`, revision: trip.revision + 1, title: trip.title, original: article, english: '', summary: trip.introduction, authorId: 'spotlog-editorial', authorName: 'Spotlog 운영', sourceKind: 'EDITORIAL', sourceJournalId: trip.curatedTripId, sourceTemplateId: trip.sourceTemplateId, ownerVisibility: trip.visibility, moderation: 'VISIBLE', createdAt: trip.editorialJournal?.createdAt || now, region: trip.regionId && state.regions?.length ? regionLabel(state.regions, trip.regionId) : trip.regionId, tags: ['운영 추천 여행기'], ...(cover ? { cover } : {}), days, cards: days.flatMap(day => day.places.map(place => ({ cardId: place.visitId!, placeId: place.id, visitId: place.visitId, day: day.day, name: place.name, original: place.note, english: '', kind: place.kind, address: place.address, description: place.description, image: place.image, photos: place.photos, sourceCredit: place.sourceCredit, likes: null }))), translation: { sourceRevision: trip.revision + 1, status: 'REVIEW', note: '운영 추천 원문 · 영어 번역 미등록' } };
}
export function curatedIssues(state: AdminState, trip: CuratedTrip): string[] {
  const issues: string[] = [];
  if (trip.dayCount !== undefined && (!Number.isInteger(trip.dayCount) || trip.dayCount < 1 || trip.dayCount > 14)) issues.push('기간은 1~14일로 입력하세요.');
  if (trip.days) {
    if (!trip.days.length || trip.dayCount !== trip.days.length) issues.push('기간과 DAY 개수가 일치해야 합니다.');
    if (trip.days.some((day, index) => day.day !== index + 1 || !day.dayId || !day.title.trim() || !day.visits.length)) issues.push('각 DAY에 제목과 방문 장소가 필요합니다.');
    const visitIds = trip.days.flatMap(day => day.visits.map(visit => visit.visitId));
    if (new Set(visitIds).size !== visitIds.length || visitIds.some(id => !id)) issues.push('방문 식별자가 중복되었습니다.');
    if (JSON.stringify(curatedPlaceIds(trip.days)) !== JSON.stringify([...new Set(trip.placeIds)])) issues.push('DAY 장소와 추천 장소 목록이 일치해야 합니다.');
  }
  const ids = trip.days ? curatedPlaceIds(trip.days) : trip.placeIds;
  if (!ids.length || ids.some(id => { const record = state.places.find(place => place.placeId === id); return !record || !eligiblePublished(record); })) issues.push('공개 가능한 등록 장소를 사용하세요.');
  for (const visit of trip.days?.flatMap(day => day.visits) ?? []) if (visit.mediaId && !publicPlaceMedia(state.places.find(record => record.placeId === visit.placeId)).some(media => media.mediaId === visit.mediaId)) issues.push('사용할 수 없는 장소 사진을 다시 선택하세요.');
  if (trip.coverMediaId && !ids.some(id => { const record = state.places.find(item => item.placeId === id); return record && publicPlaceMedia(record).some(media => media.mediaId === trip.coverMediaId); })) issues.push('현재 사용 가능한 표지 사진을 선택하세요.');
  return [...new Set(issues)];
}
export function memberGrade(member: OpsMember, references: OpsReference[] = []): string | null {
  if (member.publicActivity.source !== 'SERVER') return member.grade ?? null;
  const copies = member.publicActivity.copies;
  return typeof copies === 'number' && Number.isSafeInteger(copies) && copies >= 0 ? currentCreatorGrade(copies, creatorGradeRules(references)).label : member.grade ?? null;
}
