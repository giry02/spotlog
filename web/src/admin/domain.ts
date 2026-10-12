import type { AdminCommand, AdminCommandResult, AdminSession, AdminState, PlaceCommand, PlaceContent, MutationOutcome, MutationContext } from './types';
import { applyAiCommand, onPublishedPlaceChange } from './aiDomain.ts';
import { applyOpsCommand, placeHasReferences, invalidatePlaceExposure } from './opsDomain.ts';
import { distanceKm, eligiblePublished, publicationIssues } from './selectors.ts';
import { matchesAdminDto } from './contractGuard.ts';
import { inferRegionId, makeRegionSeed, regionDescendantIds } from './regions.ts';

export class AdminError extends Error { code: string; constructor(code: string, message: string) { super(message); this.code = code; } }
const requireValue = (ok: unknown, message: string) => { if (!ok) throw new AdminError('VALIDATION', message); };
const id = () => crypto.randomUUID();
export function checkContent(content: PlaceContent) {
  requireValue(content && ['LANDMARK', 'FOOD', 'CAFE', 'STAY', 'SHOP'].includes(content.kind), '장소 종류를 확인해 주세요.');
  requireValue(content.location && content.rights && content.guide && content.ai && Array.isArray(content.media), '장소 자료 형식이 올바르지 않아요.');
  for (const field of [content.name, content.area, content.address, content.description, content.provider, content.sourceUrl]) requireValue(typeof field === 'string', '장소 입력값을 확인해 주세요.');
  for (const field of [content.regionId,content.visitDuration,content.hook,content.creatorLabel]) requireValue(field === undefined || typeof field === 'string', '지역·방문 시간 입력값을 확인해 주세요.');
  requireValue(!content.provenance || ['CATALOG','CSV','STAFF','SYNTHETIC'].includes(content.provenance.origin), '장소 자료의 등록 경로를 확인해 주세요.');
  requireValue(content.media.length <= 30, '관리자 원본 미디어는 한 번에 30개까지 등록해 주세요.');
  requireValue(new Set(content.media.map(m => m.mediaId)).size === content.media.length, '미디어 ID가 중복됐어요.');
  requireValue(content.media.filter(m => m.cover && !m.withdrawn).length <= 1, '대표 미디어는 한 개만 선택해 주세요.');
  requireValue(['OPEN', 'TEMP_CLOSED', 'CLOSED', 'CHECK'].includes(content.operation), '영업 상태를 확인해 주세요.');
  requireValue(Array.isArray(content.tags) && content.tags.every(t => typeof t === 'string') && Array.isArray(content.ai.tags) && content.ai.tags.every(t => typeof t === 'string'), '태그 형식이 올바르지 않아요.');
  for (const rights of [content.rights, ...content.media.map(m => m.rights)]) requireValue(rights && ['display','store','modify','ai'].every(key => typeof rights[key as keyof typeof rights] === 'boolean'), '자료 사용 범위를 확인해 주세요.');
  for (const field of [content.companyId, content.checkedAt, content.ai.text, content.ai.provider, content.ai.sourceUrl, content.ai.checkedAt, content.location.reference, content.location.sourceUrl, content.location.checkedAt, content.guide.hours, content.guide.bestTime, content.guide.facilities, content.guide.menu, content.guide.lodging, content.guide.access, content.guide.english, content.guide.sourceUrl, content.guide.checkedAt]) requireValue(typeof field === 'string', '장소 자료 형식이 올바르지 않아요.');
  requireValue(typeof content.location.verified === 'boolean' && typeof content.ai.allowed === 'boolean' && Number.isInteger(content.ai.version) && content.ai.version > 0, '좌표·AI 검수 상태를 확인해 주세요.');
  for (const coordinate of [content.location.lat, content.location.lng]) requireValue(coordinate === null || typeof coordinate === 'number' && Number.isFinite(coordinate), '좌표는 유효한 숫자 또는 미입력이어야 해요.');
  requireValue(['MISSING','DRAFT','REVIEWED','STALE'].includes(content.guide.englishStatus) && Number.isInteger(content.guide.sourceRevision), '번역 검수 상태를 확인해 주세요.');
  for (const media of content.media) {
    requireValue(['PHOTO','VIDEO','MOTION'].includes(media.type) && typeof media.cover === 'boolean' && typeof media.withdrawn === 'boolean', '미디어 종류·상태를 확인해 주세요.');
    for (const value of [media.mediaId, media.url, media.caption, media.alt, media.provider, media.author, media.sourceUrl, media.license, media.licenseUrl, media.checkedAt]) requireValue(typeof value === 'string', '미디어 입력값을 확인해 주세요.');
    requireValue(!media.provenance || ['CATALOG','CSV','STAFF','SYNTHETIC'].includes(media.provenance.origin), '미디어 원본 출처를 확인해 주세요.');
  }
}
function checkPlaceRegion(state: AdminState, content: PlaceContent, previous?: PlaceContent) {
  if (!content.regionId) return;
  const region = (state.regions ?? makeRegionSeed()).find(item => item.regionId === content.regionId);
  requireValue(region && (region.enabled || previous?.regionId === content.regionId), '사용 가능한 등록 지역을 선택해 주세요.');
}
function checkAssignee(state: AdminState, assignedToId: string) {
  requireValue(typeof assignedToId === 'string' && (!assignedToId || state.ops.operators.some(operator => operator.operatorId === assignedToId && operator.active)), '담당 직원이 없거나 비활성 상태예요.');
}
function applyPlaceCommand(state: AdminState, command: PlaceCommand, context: MutationContext): MutationOutcome {
  const { actor, now } = context;
  if (command.kind === 'region.save') {
    const regions = state.regions ??= makeRegionSeed(), input = command.payload, current = regions.find(region => region.regionId === input.regionId);
    requireValue(input.regionId.trim() && input.name.trim() && ['COUNTRY','PROVINCE','CITY','DISTRICT'].includes(input.level), '지역 ID·이름·단계를 확인해 주세요.');
    requireValue(typeof input.enabled === 'boolean', '지역 사용 상태를 확인해 주세요.');
    if (current && current.revision !== command.entityRevision) throw new AdminError('CONFLICT','지역 기준이 바뀌었어요. 최신 값을 확인해 주세요.');
    if (!current) requireValue(command.entityRevision === undefined, '신규 지역의 버전 입력을 확인해 주세요.');
    const parent = regions.find(region => region.regionId === input.parentId);
    requireValue(input.level === 'COUNTRY' ? !input.parentId : parent && parent.regionId !== input.regionId && !regionDescendantIds(regions,input.regionId).has(parent.regionId), '지역의 상위 관계를 확인해 주세요.');
    requireValue(input.level === 'COUNTRY' || input.level === 'PROVINCE' && parent?.level === 'COUNTRY' || input.level === 'CITY' && parent?.level === 'PROVINCE' || input.level === 'DISTRICT' && ['PROVINCE','CITY'].includes(parent?.level ?? ''), '국가·시도·도시·구역 순서로 연결해 주세요.');
    requireValue(!regions.some(region => region.regionId !== input.regionId && region.parentId === input.parentId && region.name === input.name), '같은 상위 지역에 동일한 이름이 있어요.');
    if (current) Object.assign(current,structuredClone(input),{revision:current.revision+1});
    else regions.push({...structuredClone(input),revision:1});
    return {message:'지역 기준과 사용 상태를 저장했어요.',targetId:input.regionId,after:input.enabled ? 'ENABLED' : 'DISABLED'};
  }
  if (command.kind === 'place.create') {
    checkContent(command.payload.content);
    checkPlaceRegion(state,command.payload.content);
    requireValue(command.payload.placeId && !state.places.some(p => p.placeId === command.payload.placeId), '이미 등록된 장소 ID예요.');
    const draft = structuredClone(command.payload.content); draft.provenance ??= {origin:'STAFF'};
    state.places.unshift({ placeId: command.payload.placeId, revision: 1, state: 'DRAFT', draft, revoked: false, updatedAt: now, meta: {createdById:actor.operatorId,assignedToId:actor.operatorId,reviewStatus:'DRAFT'} });
    return { message: '검수용 장소 초안을 등록했어요.', targetId: command.payload.placeId, after: 'DRAFT' };
  }
  if (command.kind === 'place.import') {
    requireValue(command.payload.rows.length > 0 && command.payload.rows.length <= 200, '한 번에 1~200개 초안을 가져올 수 있어요.');
    command.payload.rows.forEach(checkContent);
    const assignedToId = command.payload.assignedToId ?? actor.operatorId; checkAssignee(state,assignedToId);
    const batchId = command.payload.batchId || 'csv-'+id();
    for (const content of command.payload.rows) {
      requireValue(!state.places.some(p => p.draft.name.trim() === content.name.trim() && p.draft.address.trim() === content.address.trim()), '같은 이름·주소 자료가 있어요. 기존 자료를 비교해 주세요.');
      const draft = structuredClone(content); draft.regionId ||= command.payload.regionId || inferRegionId(draft.area,draft.address); draft.provenance ??= {origin:'CSV'}; checkPlaceRegion(state,draft);
      state.places.unshift({ placeId: id(), revision: 1, state: 'DRAFT', draft, revoked: false, updatedAt: now, meta:{createdById:actor.operatorId,assignedToId,reviewStatus:'NEEDS_CHECK',sourceBatchId:batchId,importedAt:now} });
    }
    return { message: command.payload.rows.length + '개 자료를 초안으로 가져왔어요. 기존 공개본은 유지돼요.', targetId: 'import', after: String(command.payload.rows.length) };
  }
  if (command.kind === 'place.nearby') {
    const { anchorPlaceId, businessPlaceId, mode } = command.payload;
    const anchorRecord = state.places.find(p => p.placeId === anchorPlaceId), business = state.places.find(p => p.placeId === businessPlaceId);
    requireValue(anchorRecord && business, '주변 업체 연결 대상을 찾지 못했어요.');
    requireValue(['FEATURED','EXCLUDED','DEFAULT'].includes(mode) && anchorRecord!.draft.kind === 'LANDMARK' && ['FOOD','CAFE','STAY'].includes(business!.draft.kind) && anchorPlaceId !== businessPlaceId, '랜드마크·업체 연결과 설정을 확인해 주세요.');
    requireValue(command.payload.order === undefined || Number.isInteger(command.payload.order), '추천 순서는 정수로 입력해 주세요.');
    if (mode === 'FEATURED') {
      const anchor = eligiblePublished(anchorRecord!), candidate = eligiblePublished(business!);
      requireValue(anchor && candidate && anchor.kind === 'LANDMARK' && ['FOOD', 'CAFE', 'STAY'].includes(candidate.kind) && distanceKm(anchor, candidate) <= 15, '공개·영업·좌표·거리 조건을 충족한 주변 업체만 추천할 수 있어요.');
    }
    const previous = state.nearbyOverrides.find(v => v.anchorPlaceId === anchorPlaceId && v.businessPlaceId === businessPlaceId);
    const businessKind = business!.published?.kind ?? business!.draft.kind;
    const featured = state.nearbyOverrides.filter(value => {
      const place = state.places.find(place => place.placeId === value.businessPlaceId);
      return value.anchorPlaceId === anchorPlaceId && value.mode === 'FEATURED' && (place?.published?.kind ?? place?.draft.kind) === businessKind;
    }).sort((a,b) => a.order - b.order);
    const previousIndex = featured.findIndex(value => value.businessPlaceId === businessPlaceId);
    const reordered = featured.filter(value => value.businessPlaceId !== businessPlaceId);
    if (mode === 'FEATURED') {
      const position = Math.max(0,Math.min(command.payload.order ?? (previousIndex >= 0 ? previousIndex : reordered.length),reordered.length));
      reordered.splice(position,0,{anchorPlaceId,businessPlaceId,mode,order:position});
    }
    state.nearbyOverrides = state.nearbyOverrides.filter(v => v.anchorPlaceId !== anchorPlaceId || v.businessPlaceId !== businessPlaceId);
    if (mode === 'EXCLUDED') state.nearbyOverrides.push({anchorPlaceId,businessPlaceId,mode,order:0});
    if (mode === 'FEATURED') state.nearbyOverrides.push(reordered.find(value => value.businessPlaceId === businessPlaceId)!);
    for (const [order,value] of reordered.entries()) {
      const stored = state.nearbyOverrides.find(item => item.anchorPlaceId === anchorPlaceId && item.businessPlaceId === value.businessPlaceId);
      if (stored) stored.order = order;
    }
    return { message: '이 랜드마크의 주변 업체 설정을 저장했어요.', targetId: anchorPlaceId + ':' + businessPlaceId, before: previous?.mode ?? 'DEFAULT', after: mode };
  }
  const record = state.places.find(p => p.placeId === command.payload.placeId);
  requireValue(record, '장소가 삭제되거나 바뀌었어요. 목록을 다시 확인해 주세요.');
  const previous = structuredClone(record!.published), previousDraft = structuredClone(record!.draft), previousRevision = record!.revision, before = record!.state;
  if (command.kind === 'place.workflow') {
    if (record!.revision !== command.entityRevision) throw new AdminError('CONFLICT','담당·검수 상태가 바뀌었어요. 최신 장소 자료를 확인해 주세요.');
    checkAssignee(state,command.payload.assignedToId);
    requireValue(['DRAFT','NEEDS_CHECK','READY'].includes(command.payload.reviewStatus), '검수 상태를 확인해 주세요.');
    if (command.payload.reviewStatus === 'READY') {
      const issues = publicationIssues(record!.draft);
      requireValue(!record!.revoked && !issues.length, issues.join(' ') || '사용 철회 자료는 검수 완료로 변경할 수 없어요.');
      requireValue(record!.draft.regionId || inferRegionId(record!.draft.area,record!.draft.address), '검수 완료 전에 등록 지역을 선택해 주세요.');
    }
    record!.meta = { ...record!.meta, createdById:record!.meta?.createdById ?? actor.operatorId, assignedToId:command.payload.assignedToId, reviewStatus:command.payload.reviewStatus };
  } else if (command.kind === 'place.save') {
    checkContent(command.payload.content);
    checkPlaceRegion(state,command.payload.content,record!.draft);
    const draft = structuredClone(command.payload.content);
    for (const media of draft.media) if (record!.revokedMediaIds?.includes(media.mediaId)) { media.withdrawn = true; media.cover = false; media.rights = { display:false,store:false,modify:false,ai:false }; }
    if (record!.published && draft.description !== record!.published.description && draft.guide.englishStatus === 'REVIEWED') draft.guide.englishStatus = 'STALE';
    const documentKey = (value: PlaceContent) => JSON.stringify([value.ai.text,value.ai.tags,value.ai.sourceUrl,value.ai.provider,value.ai.checkedAt,value.guide.englishStatus === 'REVIEWED' ? value.guide.english : '',value.guide.sourceUrl,value.guide.sourceRevision]);
    draft.ai.version = documentKey(draft) !== documentKey(record!.draft) ? record!.draft.ai.version + 1 : record!.draft.ai.version;
    record!.draft = draft;
    if (record!.meta?.reviewStatus === 'READY' && JSON.stringify(previousDraft) !== JSON.stringify(draft)) record!.meta.reviewStatus = 'NEEDS_CHECK';
  } else if (command.kind === 'place.media.revoke') {
    requireValue(command.payload.reason.trim(), '미디어 사용 철회 사유를 입력해 주세요.');
    requireValue(record!.draft.media.some(m => m.mediaId === command.payload.mediaId) || record!.published?.media.some(m => m.mediaId === command.payload.mediaId), '철회할 미디어가 없어요.');
    record!.revokedMediaIds = [...new Set([...(record!.revokedMediaIds ?? []),command.payload.mediaId])];
    for (const content of [record!.draft, record!.published]) {
      const media = content?.media.find(m => m.mediaId === command.payload.mediaId);
      if (media) { media.withdrawn = true; media.cover = false; media.rights = {display:false,store:false,modify:false,ai:false}; }
    }
  } else if (command.kind === 'place.publish') {
    const issues = publicationIssues(record!.draft);
    requireValue(!record!.revoked, '사용 철회 자료는 다시 공개할 수 없어요. 새 허가 자료로 별도 검수해 주세요.');
    requireValue(!issues.length, issues.join(' '));
    requireValue(!record!.draft.media.some(media => record!.revokedMediaIds?.includes(media.mediaId) && (!media.withdrawn || media.rights.display || media.rights.ai)), '철회된 미디어를 다시 사용할 수 없어요. 새 허가 자료로 등록해 주세요.');
    record!.published = structuredClone(record!.draft); record!.state = 'PUBLISHED';
    record!.meta = {...record!.meta,createdById:record!.meta?.createdById ?? actor.operatorId,assignedToId:record!.meta?.assignedToId ?? actor.operatorId,reviewStatus:'READY'};
  } else if (command.kind === 'place.delete') {
    requireValue(command.payload.reason.trim(), '삭제 사유를 입력해 주세요.');
    requireValue(!record!.published && record!.state === 'DRAFT' && !state.nearbyOverrides.some(v => v.anchorPlaceId === record!.placeId || v.businessPlaceId === record!.placeId) && !placeHasReferences(state, record!.placeId), '참조 없는 미공개 초안만 삭제할 수 있어요. 공개 장소는 비활성화해 주세요.');
    state.places = state.places.filter(p => p.placeId !== record!.placeId);
  } else {
    requireValue(command.payload.reason.trim(), '변경 사유를 입력해 주세요.');
    record!.state = 'INACTIVE';
    if (command.kind === 'place.revoke') { record!.revoked = true; record!.draft.rights = { display: false, store: false, modify: false, ai: false }; }
  }
  if (command.kind !== 'place.delete') { record!.revision++; record!.updatedAt = now; }
  if (command.kind !== 'place.save' && command.kind !== 'place.workflow') { onPublishedPlaceChange(state, record!.placeId, previous, now); invalidatePlaceExposure(state, record!.placeId); }
  const changed = (Object.keys(previousDraft) as (keyof PlaceContent)[]).filter(key => JSON.stringify(previousDraft[key]) !== JSON.stringify(record!.draft[key]));
  return { message: command.kind === 'place.workflow' ? '담당 직원과 검수 상태를 저장했어요.' : command.kind === 'place.save' ? '초안을 저장했어요. 공개본은 그대로 유지돼요.' : command.kind === 'place.publish' ? '공개 설정을 저장했어요.' : '자료 사용 상태를 변경했어요.', targetId: record!.placeId, before: before + ' / v' + previousRevision, after: command.kind === 'place.delete' ? 'DELETED' : record!.state + ' / v' + record!.revision + (command.kind === 'place.workflow' ? ' / ' + record!.meta?.reviewStatus : ''), reason: 'reason' in command.payload ? command.payload.reason : changed.length ? '변경 항목: ' + changed.join(', ') : undefined };
}
export function executeAdminCommand(source: AdminState, command: AdminCommand, actor: AdminSession, now = new Date().toISOString()): AdminCommandResult {
  requireValue(['OPERATOR', 'ADMIN'].includes(actor.role), '관리자 권한이 필요해요.');
  requireValue(matchesAdminDto('AdminCommand', command), '관리자 요청 형식이 올바르지 않아요. 지원하는 작업과 버전을 확인해 주세요.');
  const placeKinds = ['place.create','place.import','place.nearby','place.save','place.publish','place.delete','place.inactivate','place.revoke','place.media.revoke','place.workflow'];
  if (command.kind.startsWith('place.') && !placeKinds.includes(command.kind)) throw new AdminError('VALIDATION', '지원하지 않는 장소 작업이에요.');
  requireValue(command.idempotencyKey && command.idempotencyKey.length <= 200, '요청 식별자가 필요해요.');
  const { expectedRevision: _revision, idempotencyKey: _key, ...input } = command;
  const fingerprint = JSON.stringify(input);
  const replay = source.processedCommands.find(v => v.key === command.idempotencyKey);
  if (replay) { if (replay.fingerprint !== fingerprint) throw new AdminError('CONFLICT', '같은 요청 식별자로 다른 작업을 실행할 수 없어요.'); return { state: structuredClone(source), message: replay.message, replayed: true }; }
  if (source.revision !== command.expectedRevision) throw new AdminError('CONFLICT', '다른 창에서 자료가 변경됐어요. 새 자료를 확인한 뒤 다시 저장해 주세요.');
  const state = structuredClone(source), context = { actor, now };
  let outcome: MutationOutcome;
  if (command.kind.startsWith('place.') || command.kind === 'region.save') outcome = applyPlaceCommand(state, command as PlaceCommand, context);
  else if (command.kind.startsWith('ai.')) outcome = applyAiCommand(state, command as Parameters<typeof applyAiCommand>[1], context);
  else if (command.kind.startsWith('ops.')) outcome = applyOpsCommand(state, command as Parameters<typeof applyOpsCommand>[1], context);
  else throw new AdminError('VALIDATION', '지원하지 않는 관리자 작업이에요.');
  state.revision++;
  state.audit.unshift({ id: id(), at: now, actorId: actor.operatorId, actorName: actor.name, action: command.kind, targetId: outcome.targetId, reason: outcome.reason ?? '', before: outcome.before ?? '', after: outcome.after ?? '' });
  state.processedCommands.push({ key: command.idempotencyKey, fingerprint, message: outcome.message, revision: state.revision });
  return { state, message: outcome.message };
}
