import type { AdminState, MutationContext, MutationOutcome, AdminMedia } from './types';
import type { ExposureEntry, OpsCommand, OpsMember, OpsReport, PublicComment, PublicJournalPhoto } from './opsTypes';
import { eligiblePublished } from './selectors.ts';
import { buildEditorialJournal, curatedIssues, curatedPlaceIds } from './editorialDraft.ts';
import { parseCreatorGrades } from '../creatorGrade.ts';
import { makeOpsPopularitySeed } from './opsSeed.ts';

export class OpsError extends Error {
  readonly code: 'INVALID' | 'CONFLICT' | 'FORBIDDEN' | 'NOT_FOUND' | 'INELIGIBLE';
  constructor(code: OpsError['code'], message: string) { super(message); this.name = 'OpsError'; this.code = code; }
}
function requireValue<T>(value: T | undefined, message = '대상을 찾을 수 없습니다.'): T { if (!value) throw new OpsError('NOT_FOUND', message); return value; }
function requireRevision(record: { revision: number }, value?: number) { if (value !== record.revision) throw new OpsError('CONFLICT', '다른 운영자가 변경한 자료입니다. 최신 내용으로 다시 확인해 주세요.'); }
function requireReason(value: string) { if (!value.trim()) throw new OpsError('INVALID', '조치 사유를 입력해 주세요.'); }
function requireAdmin(context: MutationContext) { if (context.actor.role !== 'ADMIN') throw new OpsError('FORBIDDEN', '최고관리자 권한이 필요합니다.'); }
function timestamp(value: string): number { const time = Date.parse(value); if (!Number.isFinite(time)) throw new OpsError('INVALID', '날짜를 확인해 주세요.'); return time; }
type MemberDeletionStatus = NonNullable<OpsMember['deletionRequest']>['status'];
export function memberDeletionTransitions(status: MemberDeletionStatus): MemberDeletionStatus[] {
  const allowed: Record<MemberDeletionStatus, MemberDeletionStatus[]> = { RECEIVED: ['VERIFYING', 'WITHDRAWN'], VERIFYING: ['READY', 'WITHDRAWN'], READY: ['VERIFYING', 'WITHDRAWN'], WITHDRAWN: [] };
  return allowed[status];
}
export type PopularContentKind = 'LANDMARK' | 'PLACE' | 'JOURNAL';
export interface PopularContent {
  targetType: 'PLACE' | 'JOURNAL'; targetId: string; title: string; introduction: string; region: string;
  kind: string; saveCount: number; source: 'SERVER' | 'SAMPLE'; observedAt: string;
}
/** Popularity is read-only aggregate data; a missing API aggregate never falls back to local examples. */
export function popularContent(state: AdminState, mode: 'LOCAL' | 'API', kind: PopularContentKind): PopularContent[] {
  const snapshot = state.ops.popularity ?? (mode === 'LOCAL' ? makeOpsPopularitySeed() : undefined);
  if (!snapshot || snapshot.basis !== 'SAVES' || mode === 'API' && snapshot.source !== 'SERVER' || !Number.isFinite(Date.parse(snapshot.observedAt))) return [];
  const metrics = new Map(snapshot.items.map(item => [`${item.targetType}:${item.targetId}`, item]));
  if (mode === 'LOCAL' && snapshot.source === 'SAMPLE') for (const journal of state.ops.journals) {
    if (journal.metrics?.source === 'SAMPLE' && journal.metrics.copies !== null && !metrics.has(`JOURNAL:${journal.journalId}`)) metrics.set(`JOURNAL:${journal.journalId}`, { targetType: 'JOURNAL', targetId: journal.journalId, saveCount: journal.metrics.copies });
  }
  return [...metrics.values()].flatMap(metric => {
    if (!Number.isSafeInteger(metric.saveCount) || metric.saveCount < 0) return [];
    if (metric.targetType === 'JOURNAL') {
      if (kind !== 'JOURNAL') return [];
      const journal = state.ops.journals.find(record => record.journalId === metric.targetId && record.ownerVisibility === 'PUBLIC' && record.moderation === 'VISIBLE');
      return journal ? [{ ...metric, title: journal.title, introduction: journal.summary || journal.original, region: journal.region || '', kind: 'JOURNAL', source: snapshot.source, observedAt: snapshot.observedAt }] : [];
    }
    if (kind === 'JOURNAL') return [];
    const place = state.places.find(record => record.placeId === metric.targetId), content = place?.published ?? place?.draft;
    return place && content && (kind !== 'LANDMARK' || content.kind === 'LANDMARK') ? [{ ...metric, title: content.name, introduction: content.description, region: content.area, kind: content.kind, source: snapshot.source, observedAt: snapshot.observedAt }] : [];
  }).sort((left, right) => right.saveCount - left.saveCount || left.title.localeCompare(right.title, 'ko') || left.targetId.localeCompare(right.targetId));
}
export function mainExposureDraft(state: AdminState, candidate: PopularContent, exposureId: string): ExposureEntry {
  const channel = candidate.targetType === 'PLACE' ? 'HOME_PLACE' : 'HOME_JOURNAL';
  const previous = state.ops.exposures.find(entry => entry.channel === channel && entry.targetId === candidate.targetId);
  if (previous) return { ...previous, enabled: true };
  const media = exposureMediaChoices(state, { channel, targetId: candidate.targetId }).find(item => item.type === 'PHOTO');
  return { exposureId, revision: 0, channel, targetId: candidate.targetId, title: candidate.title, introduction: candidate.introduction, coverMediaId: media?.mediaId ?? '', startsAt: '', endsAt: '', enabled: true, order: state.ops.exposures.filter(entry => entry.channel === channel).length };
}
export function opsTrashExpiry(deletedAt: string): string {
  const local = new Date(timestamp(deletedAt) + 9 * 60 * 60 * 1000);
  const target = new Date(local); target.setUTCDate(1); target.setUTCMonth(target.getUTCMonth() + 6);
  const end = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(local.getUTCDate(), end));
  return new Date(target.getTime() - 9 * 60 * 60 * 1000).toISOString();
}
export function journalPublic(state: AdminState, journalId: string): boolean {
  const journal = state.ops.journals.find(j => j.journalId === journalId);
  return !!journal && journal.ownerVisibility === 'PUBLIC' && journal.moderation === 'VISIBLE';
}
export function journalThread(state: AdminState, journalId: string, cardId?: string): PublicComment[] {
  const comments = state.ops.comments.filter(c => c.journalId === journalId && c.cardId === cardId);
  const parents = comments.filter(c => !c.parentId).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return parents.flatMap(parent => [parent, ...comments.filter(c => c.parentId === parent.commentId).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))]);
}
/** Stable public report context can outlive a discovery card or its current media ordering. */
export function reportPhotoContext(state: AdminState, report: OpsReport) {
  const place = state.places.find(record => record.placeId === report.placeId || !!report.placeId && (record.published?.provenance?.sourcePlaceId === report.placeId || record.draft.provenance?.sourcePlaceId === report.placeId));
  const media = place?.published?.media.find(record => record.mediaId === (report.mediaId || report.targetId) || !!report.photoSnapshot && record.url === report.photoSnapshot.image);
  const photo: PublicJournalPhoto | undefined = report.photoSnapshot ?? (media ? { id: media.mediaId, image: media.url, caption: media.caption || media.alt, sourceCredit: { provider: media.provider, author: media.author, sourceUrl: media.sourceUrl, license: media.license, licenseUrl: media.licenseUrl, checkedAt: media.checkedAt } } : undefined);
  return { place, photo, withdrawn: !!place?.revoked || !!media && (media.withdrawn || !!place?.revokedMediaIds?.includes(media.mediaId) || !media.rights.display || !media.rights.store) };
}
export function exposureMediaChoices(state: AdminState, entry: Pick<ExposureEntry, 'channel' | 'targetId'>): AdminMedia[] {
  const placeIds = entry.channel === 'HOME_TRIP' ? state.ops.curatedTrips.find(t => t.curatedTripId === entry.targetId)?.placeIds ?? [] : entry.channel === 'HOME_JOURNAL' ? state.ops.journals.find(j => j.journalId === entry.targetId && j.ownerVisibility === 'PUBLIC' && j.moderation === 'VISIBLE')?.cards.map(c => c.placeId) ?? [] : [entry.targetId];
  return [...new Map(state.places.filter(p => placeIds.includes(p.placeId)).flatMap(p => eligiblePublished(p)?.media.filter(m => !m.withdrawn && !p.revokedMediaIds?.includes(m.mediaId) && m.rights.display && m.rights.store) ?? []).map(m => [m.mediaId, m])).values()];
}
export function exposureIssues(state: AdminState, entry: ExposureEntry): string[] {
  const issues: string[] = [];
  if (!entry.title.trim()) issues.push('노출 제목이 필요합니다.');
  if (entry.startsAt && !Number.isFinite(Date.parse(entry.startsAt))) issues.push('시작일을 확인해 주세요.');
  if (entry.endsAt && !Number.isFinite(Date.parse(entry.endsAt))) issues.push('종료일을 확인해 주세요.');
  if (entry.startsAt && entry.endsAt && Date.parse(entry.endsAt) <= Date.parse(entry.startsAt)) issues.push('종료일은 시작일보다 뒤여야 합니다.');
  if (entry.channel === 'HOME_JOURNAL') {
    if (!journalPublic(state, entry.targetId)) issues.push('현재 공개되어 있고 숨김 조치가 없는 여행기를 선택하세요.');
    else if (state.ops.journals.find(journal => journal.journalId === entry.targetId)?.sourceKind === 'SYNTHETIC') issues.push('검수용 가상 여행기는 고객 홈에 게시할 수 없습니다. 실제 공개 여행기를 선택하세요.');
  } else if (entry.channel === 'HOME_TRIP') {
    const trip = state.ops.curatedTrips.find(t => t.curatedTripId === entry.targetId && t.visibility === 'PUBLIC');
    if (!trip || !trip.placeIds.length || trip.placeIds.some(id => { const place = state.places.find(p => p.placeId === id); return !place || !eligiblePublished(place); })) issues.push('공개 가능한 장소가 포함된 운영 일정을 선택하세요.');
  } else {
    const record = state.places.find(p => p.placeId === entry.targetId), content = record && eligiblePublished(record);
    if (!content) issues.push('공개·운영·좌표·사용 조건을 확인한 장소를 선택하세요.');
    else if (entry.channel === 'HOME_PLACE' && (content.provenance?.origin === 'SYNTHETIC' || record?.draft.provenance?.origin === 'SYNTHETIC')) issues.push('검수용 가상 장소는 고객 홈에 게시할 수 없습니다. 실제 등록 장소를 검수하세요.');
    else if (entry.channel !== 'REGION_GUIDE') {
      const media = content.media.find(m => m.mediaId === entry.coverMediaId && !m.withdrawn && !record?.revokedMediaIds?.includes(m.mediaId) && m.rights.display && m.rights.store);
      if (!media) issues.push('표시·보관이 허용된 대표 미디어를 선택하세요.');
      else if ((entry.channel === 'DISCOVERY_PHOTO' || entry.channel === 'HOME_PLACE') && media.type !== 'PHOTO') issues.push('사진 채널에는 실제 사진을 선택하세요.');
      else if (entry.channel === 'DISCOVERY_VIDEO' && (media.type === 'PHOTO' || (media.type === 'MOTION' && !media.rights.modify))) issues.push('영상 또는 변형이 허용된 사진 모션을 선택하세요.');
    }
  }
  if ((entry.channel === 'HOME_TRIP' || entry.channel === 'HOME_JOURNAL') && entry.coverMediaId && !exposureMediaChoices(state, entry).some(m => m.mediaId === entry.coverMediaId && m.type === 'PHOTO')) issues.push('현재 사용 가능한 사진을 표지로 선택하세요.');
  return issues;
}
export function activeExposures(state: AdminState, now: string, channel?: ExposureEntry['channel']) {
  const time = timestamp(now);
  return state.ops.exposures.filter(entry => entry.enabled && (!channel || entry.channel === channel) && (!entry.startsAt || time >= Date.parse(entry.startsAt)) && (!entry.endsAt || time < Date.parse(entry.endsAt)) && !exposureIssues(state, entry).length).sort((a, b) => a.order - b.order);
}
export function placeHasReferences(state: AdminState, placeId: string): boolean {
  return state.ops.exposures.some(e => e.targetId === placeId) || state.ops.curatedTrips.some(t => t.placeIds.includes(placeId)) || state.ops.journals.some(j => j.cards.some(c => c.placeId === placeId));
}
export function invalidatePlaceExposure(state: AdminState, placeId: string): void {
  const tripIds = new Set(state.ops.curatedTrips.filter(t => t.placeIds.includes(placeId)).map(t => t.curatedTripId));
  const journalIds = new Set(state.ops.journals.filter(j => j.cards.some(c => c.placeId === placeId)).map(j => j.journalId));
  for (const entry of state.ops.exposures) if ((entry.targetId === placeId || tripIds.has(entry.targetId) || journalIds.has(entry.targetId)) && exposureIssues(state, entry).length && entry.enabled) { entry.enabled = false; entry.revision++; }
}

/** Mutates only the root transaction's cloned state. Root owns persistence, global revision and audit. */
export function applyOpsCommand(state: AdminState, command: OpsCommand, context: MutationContext): MutationOutcome {
  const ops = state.ops;
  switch (command.kind) {
    case 'ops.curated.save': {
      const previous = ops.curatedTrips.find(t => t.curatedTripId === command.payload.curatedTripId); if (previous) requireRevision(previous, command.entityRevision);
      else if (command.entityRevision !== undefined) throw new OpsError('CONFLICT', '운영 일정이 삭제되었습니다.');
      if (!command.payload.curatedTripId || !command.payload.title.trim()) throw new OpsError('INVALID', '운영 일정 제목을 입력해 주세요.');
      const next = structuredClone({ ...command.payload, placeIds: command.payload.days ? curatedPlaceIds(command.payload.days) : [...new Set(command.payload.placeIds)], revision: (previous?.revision ?? 0) + 1 });
      if (previous?.sourceTemplateId) { if (next.sourceTemplateId && next.sourceTemplateId !== previous.sourceTemplateId) throw new OpsError('INVALID', '홈 추천 원본 연결을 다른 일정으로 변경할 수 없습니다.'); next.sourceTemplateId = previous.sourceTemplateId; next.sourceKind = previous.sourceKind; }
      if (next.dayCount !== undefined && (!Number.isInteger(next.dayCount) || next.dayCount < 1 || next.dayCount > 14)) throw new OpsError('INVALID', '기간은 1~14일로 입력하세요.');
      if (next.visibility === 'PUBLIC') { const issues = curatedIssues(state, next); if (issues.length) throw new OpsError('INELIGIBLE', issues.join(' ')); }
      if (next.days) next.editorialJournal = buildEditorialJournal(state, { ...next, revision: next.revision - 1 }, context.now);
      else delete next.editorialJournal;
      if (previous) ops.curatedTrips[ops.curatedTrips.indexOf(previous)] = next; else ops.curatedTrips.push(next);
      return { message: next.visibility === 'PUBLIC' ? '운영 추천 여행기의 공개 설정을 저장했습니다.' : '운영 추천 여행기 초안을 저장했습니다.', targetId: next.curatedTripId, before: previous?.visibility ?? '신규', after: next.visibility };
    }
    case 'ops.exposure.save': {
      const previous = ops.exposures.find(e => e.exposureId === command.payload.exposureId);
      if (previous) requireRevision(previous, command.entityRevision);
      else if (command.entityRevision !== undefined) throw new OpsError('CONFLICT', '노출 항목이 삭제되었습니다.');
      const entry: ExposureEntry = { ...command.payload, revision: (previous?.revision ?? 0) + 1, order: previous?.order ?? ops.exposures.filter(e => e.channel === command.payload.channel).length };
      if (!entry.exposureId || !entry.targetId || !entry.title.trim()) throw new OpsError('INVALID', '대상과 제목을 입력해 주세요.');
      const problems = exposureIssues(state, entry);
      if (entry.enabled && problems.length) throw new OpsError('INELIGIBLE', problems.join(' '));
      if (previous) ops.exposures[ops.exposures.indexOf(previous)] = entry; else ops.exposures.push(entry);
      return { message: '노출 설정을 검수 저장했습니다.', targetId: entry.exposureId, before: previous?.enabled ? '노출 켜짐' : '노출 꺼짐', after: entry.enabled ? '노출 켜짐' : '노출 꺼짐' };
    }
    case 'ops.exposure.move': {
      const entry = requireValue(ops.exposures.find(e => e.exposureId === command.exposureId));
      const channel = ops.exposures.filter(e => e.channel === entry.channel).sort((a, b) => a.order - b.order), index = channel.indexOf(entry);
      const neighbor = channel[index + command.direction]; if (!neighbor) throw new OpsError('INVALID', '이미 첫 번째 또는 마지막 항목입니다.');
      const before = String(entry.order); [entry.order, neighbor.order] = [neighbor.order, entry.order]; entry.revision++; neighbor.revision++;
      return { message: '운영자 추천 순서를 변경했습니다.', targetId: entry.exposureId, before, after: String(entry.order) };
    }
    case 'ops.content.moderate': {
      requireReason(command.reason);
      const record = command.targetType === 'JOURNAL' ? requireValue(ops.journals.find(j => j.journalId === command.targetId)) : requireValue(ops.comments.find(c => c.commentId === command.targetId));
      requireRevision(record, command.entityRevision);
      const journal = requireValue(ops.journals.find(j => j.journalId === ('journalId' in record ? record.journalId : command.targetId)));
      if (command.action === 'UNHIDE' && (journal.ownerVisibility !== 'PUBLIC' || record.moderation === 'DELETED')) throw new OpsError('INELIGIBLE', '작성자가 비공개·삭제한 자료는 재공개할 수 없습니다.');
      if (command.action === 'UNHIDE' && command.targetType === 'COMMENT' && journal.moderation !== 'VISIBLE') throw new OpsError('INELIGIBLE', '여행기 숨김을 먼저 확인해 주세요.');
      if (record.moderation === 'DELETED') throw new OpsError('INELIGIBLE', '삭제 조치된 콘텐츠는 다시 변경할 수 없습니다.');
      const before = record.moderation; record.moderation = command.action === 'HIDE' ? 'HIDDEN' : command.action === 'UNHIDE' ? 'VISIBLE' : 'DELETED'; record.revision++;
      return { message: '콘텐츠 조치를 기록했습니다.', targetId: command.targetId, before, after: record.moderation, reason: command.reason.trim() };
    }
    case 'ops.report.resolve': {
      requireReason(command.reason); const report = requireValue(ops.reports.find(r => r.reportId === command.reportId)); requireRevision(report, command.entityRevision);
      if (report.status !== 'OPEN') throw new OpsError('INELIGIBLE', '이미 처리된 신고입니다.');
      report.status = command.status; report.decision = command.reason.trim(); report.revision++;
      return { message: '신고 처리 결과를 기록했습니다.', targetId: report.reportId, before: 'OPEN', after: report.status, reason: report.decision };
    }
    case 'ops.translation.review': {
      const journal = requireValue(ops.journals.find(j => j.journalId === command.journalId)); requireRevision(journal, command.entityRevision);
      if (journal.ownerVisibility !== 'PUBLIC' || command.sourceRevision !== journal.translation.sourceRevision) throw new OpsError('CONFLICT', '원문 버전과 공개 상태를 다시 확인해 주세요.');
      if (!command.english.trim()) throw new OpsError('INVALID', '영어 내용을 입력해 주세요.');
      const before = journal.translation.status; journal.english = command.english.trim(); journal.translation.status = command.status; journal.translation.note = command.note.trim(); journal.revision++;
      return { message: '번역 검수 결과를 저장했습니다.', targetId: journal.journalId, before, after: command.status, reason: command.note.trim() };
    }
    case 'ops.member.action': {
      requireReason(command.reason); const member = requireValue(ops.members.find(m => m.memberId === command.memberId)); requireRevision(member, command.entityRevision);
      if (command.action === 'SUSPEND' && (!command.until || timestamp(command.until) <= timestamp(context.now))) throw new OpsError('INVALID', '정지 종료일은 현재보다 뒤여야 합니다.');
      if (command.action === 'REINSTATE' && member.state !== 'SUSPENDED') throw new OpsError('INELIGIBLE', '정지 중인 회원만 해제할 수 있습니다.');
      const before = member.state;
      if (command.action === 'WARN') member.warnings.push({ at: context.now, reason: command.reason.trim() });
      else if (command.action === 'SUSPEND') { member.state = 'SUSPENDED'; member.suspendedUntil = command.until; }
      else { member.state = 'ACTIVE'; delete member.suspendedUntil; }
      member.revision++;
      return { message: '회원 조치를 기록했습니다.', targetId: member.memberId, before, after: command.action === 'WARN' ? 'WARN' : member.state, reason: command.reason.trim() };
    }
    case 'ops.member.deletion': {
      requireReason(command.reason); const member = requireValue(ops.members.find(m => m.memberId === command.memberId)); requireRevision(member, command.entityRevision);
      const request = requireValue(member.deletionRequest, '회원이 접수한 삭제 요청이 없습니다.'); const before = request.status;
      if (!memberDeletionTransitions(request.status).includes(command.status)) throw new OpsError('INVALID', '삭제 요청의 다음 처리 단계를 확인해 주세요.');
      request.status = command.status; member.revision++;
      return { message: '삭제 요청 상태를 기록했습니다. 실제 계정 삭제는 서버 연결 후 처리합니다.', targetId: member.memberId, before, after: command.status, reason: command.reason.trim() };
    }
    case 'ops.inquiry.save': {
      const inquiry = requireValue(ops.inquiries.find(i => i.inquiryId === command.inquiryId)); requireRevision(inquiry, command.entityRevision);
      if (!ops.operators.some(o => o.operatorId === command.assigneeId && o.active)) throw new OpsError('INVALID', '활성 운영자를 담당자로 선택하세요.');
      if (command.status === 'RESOLVED' && !command.reply.trim() && !inquiry.replyRecords.length) throw new OpsError('INVALID', '문의 처리 답변을 기록해 주세요.');
      const before = inquiry.status; inquiry.status = command.status; inquiry.assigneeId = command.assigneeId;
      if (command.reply.trim()) inquiry.replyRecords.push({ at: context.now, operatorId: context.actor.operatorId, body: command.reply.trim() }); inquiry.revision++;
      return { message: '문의 상태와 답변 기록을 저장했습니다. 고객에게 발송하지 않았습니다.', targetId: inquiry.inquiryId, before, after: inquiry.status };
    }
    case 'ops.operator.role': {
      requireAdmin(context); const operator = requireValue(ops.operators.find(o => o.operatorId === command.operatorId)); requireRevision(operator, command.entityRevision);
      if (operator.role === 'ADMIN' && command.role !== 'ADMIN' && ops.operators.filter(o => o.active && o.role === 'ADMIN').length < 2) throw new OpsError('INELIGIBLE', '마지막 활성 최고관리자의 권한을 해제할 수 없습니다.');
      const before = operator.role; operator.role = command.role; operator.revision++; return { message: '검수용 운영자 역할을 변경했습니다.', targetId: operator.operatorId, before, after: operator.role };
    }
    case 'ops.operator.create': {
      requireAdmin(context);
      const { operatorId, name, role } = command.payload;
      if (!operatorId.trim() || !name.trim() || !['ADMIN', 'OPERATOR'].includes(role)) throw new OpsError('INVALID', '운영자 ID와 이름·역할을 확인하세요.');
      if (ops.operators.some(operator => operator.operatorId === operatorId.trim())) throw new OpsError('CONFLICT', '이미 등록된 운영자 ID입니다.');
      ops.operators.push({ operatorId: operatorId.trim(), name: name.trim(), role, active: true, revision: 1, sessions: [] });
      return { message: '운영자 계정 검수 기록을 추가했습니다. 실제 로그인 초대는 발송하지 않았습니다.', targetId: operatorId.trim(), before: '신규', after: role };
    }
    case 'ops.operator.session': {
      requireAdmin(context); const operator = requireValue(ops.operators.find(o => o.operatorId === command.operatorId)); requireRevision(operator, command.entityRevision);
      const session = requireValue(operator.sessions.find(s => s.sessionId === command.sessionId));
      if (session.status !== 'ACTIVE') throw new OpsError('INELIGIBLE', '이미 종료된 검수용 세션입니다.'); session.status = 'REVOKED'; operator.revision++;
      return { message: '세션 종료 상태를 저장했습니다.', targetId: session.sessionId, before: 'ACTIVE', after: 'REVOKED' };
    }
    case 'ops.reference.save': {
      const previous = ops.references.find(r => r.referenceId === command.payload.referenceId); if (previous) requireRevision(previous, command.entityRevision);
      else if (command.entityRevision !== undefined) throw new OpsError('CONFLICT', '기준 항목이 삭제되었습니다.');
      if (!command.payload.name.trim() || !command.payload.value.trim() || !command.payload.referenceId) throw new OpsError('INVALID', '이름과 기준값을 입력해 주세요.');
      if (command.payload.category === 'GRADE' && command.payload.enabled) {
        try { parseCreatorGrades(command.payload.value); } catch (failure) { throw new OpsError('INVALID', failure instanceof Error ? failure.message : '등급 기준을 확인해 주세요.'); }
        if (ops.references.some(reference => reference.category === 'GRADE' && reference.enabled && reference.referenceId !== command.payload.referenceId)) throw new OpsError('INELIGIBLE', '현재 사용 중인 등급 기준을 먼저 중지한 뒤 새 기준을 적용하세요.');
      }
      const next = { ...command.payload, name: command.payload.name.trim(), value: command.payload.value.trim(), revision: (previous?.revision ?? 0) + 1 };
      if (previous) ops.references[ops.references.indexOf(previous)] = next; else ops.references.push(next);
      return { message: '운영 기준의 새 버전을 저장했습니다.', targetId: next.referenceId, before: previous ? 'v' + previous.revision : '신규', after: 'v' + next.revision };
    }
    case 'ops.template.save': {
      const template = requireValue(ops.templates.find(t => t.templateId === command.payload.templateId)); requireRevision(template, command.entityRevision);
      if (!command.payload.title.trim() || !command.payload.body.trim()) throw new OpsError('INVALID', '템플릿 제목과 본문을 입력해 주세요.');
      const before = template.revision; Object.assign(template, command.payload, { revision: before + 1 }); return { message: '알림 템플릿을 저장했습니다.', targetId: template.templateId, before: 'v' + before, after: 'v' + template.revision };
    }
    case 'ops.notification.retry': {
      const notification = requireValue(ops.notifications.find(n => n.notificationId === command.notificationId)); requireRevision(notification, command.entityRevision);
      const member = requireValue(ops.members.find(m => m.memberId === notification.memberId)), template = requireValue(ops.templates.find(t => t.templateId === notification.templateId));
      if (member.notificationOptOut || notification.status === 'OPTED_OUT') throw new OpsError('INELIGIBLE', '수신 거부한 회원에게 재시도할 수 없습니다.');
      if (!template.enabled || notification.status !== 'FAILED') throw new OpsError('INELIGIBLE', '활성 템플릿의 실패 기록만 재시도 검수할 수 있습니다.');
      if (ops.notifications.some(n => n.notificationId !== notification.notificationId && n.memberId === notification.memberId && n.dedupeKey === notification.dedupeKey && n.status === 'RETRY_REVIEWED')) throw new OpsError('INELIGIBLE', '같은 알림의 재시도가 이미 검수되었습니다.');
      notification.status = 'RETRY_REVIEWED'; notification.revision++; notification.error = '재시도 검수 완료 · 실제 발송 대기';
      return { message: '재시도 조건을 검수했습니다. 실제 알림은 발송하지 않았습니다.', targetId: notification.notificationId, before: 'FAILED', after: 'RETRY_REVIEWED' };
    }
    case 'ops.connection.limit': {
      requireAdmin(context); const connection = requireValue(ops.connections.find(c => c.connectionId === command.connectionId));
      if (!Number.isInteger(command.limit) || command.limit <= 0) throw new OpsError('INVALID', '확인한 호출 한도를 양의 정수로 입력하세요.');
      const before = connection.limit; connection.limit = command.limit;
      return { message: '검수용 한도를 저장했습니다. 연결 상태는 미연결입니다.', targetId: connection.connectionId, before: String(before ?? '미설정'), after: String(command.limit) };
    }
    case 'ops.supply.retry': {
      const job = requireValue(ops.supplyJobs.find(j => j.jobId === command.jobId)); if (job.status !== 'FAILED') throw new OpsError('INELIGIBLE', '실패 작업만 재시도 검수할 수 있습니다.');
      job.retryReviews++; job.status = 'REVIEW'; return { message: '재시도 검수 대상으로 기록했습니다. 실제 수급 작업은 미연결입니다.', targetId: job.jobId, before: 'FAILED', after: 'REVIEW' };
    }
    case 'ops.trash.restore': {
      requireAdmin(context); requireReason(command.reason); const trash = requireValue(ops.trash.find(t => t.trashId === command.trashId)); requireRevision(trash, command.entityRevision);
      if (trash.status !== 'TRASHED' || timestamp(context.now) >= timestamp(opsTrashExpiry(trash.deletedAt))) throw new OpsError('INELIGIBLE', '한국 시각 기준 달력 6개월이 지났거나 이미 복원된 기록입니다.');
      trash.status = 'RESTORED_PRIVATE'; trash.revision++;
      if (trash.kind === 'JOURNAL' && trash.publicJournalId) {
        const journal = requireValue(ops.journals.find(j => j.journalId === trash.publicJournalId));
        if (journal.authorId !== trash.ownerId) throw new OpsError('INELIGIBLE', '휴지통 소유자와 여행기 소유자를 다시 확인해 주세요.');
        journal.ownerVisibility = 'PRIVATE'; journal.revision++;
        // This state is the administrator response projection. Production retains
        // authored records in the owner store and excludes their body from this DTO.
        journal.original = ''; journal.english = ''; journal.cards = [];
        delete journal.days; delete journal.cover; delete journal.summary; delete journal.tags; delete journal.metrics; delete journal.reactionBreakdown;
        for (const comment of ops.comments.filter(c => c.journalId === journal.journalId)) {
          comment.original = ''; comment.english = ''; comment.revision++;
        }
        for (const entry of ops.exposures.filter(e => e.targetId === journal.journalId && e.enabled)) { entry.enabled = false; entry.revision++; }
      }
      return { message: '비공개 복원 상태를 저장했습니다.', targetId: trash.trashId, before: 'TRASHED', after: 'RESTORED_PRIVATE', reason: command.reason.trim() };
    }
    case 'ops.cleanup.review': {
      requireAdmin(context); requireReason(command.reason); const file = requireValue(ops.mediaCleanup.find(m => m.mediaId === command.mediaId)); requireRevision(file, command.entityRevision);
      if (file.references.length) throw new OpsError('INELIGIBLE', '다른 기록이 참조하는 사진은 정리 대상으로 확정할 수 없습니다.');
      if (file.status !== 'WAITING') throw new OpsError('INELIGIBLE', '이미 검수한 정리 대상입니다.'); file.status = 'REVIEWED'; file.revision++;
      return { message: '참조 없는 파일을 정리 대상으로 지정했습니다.', targetId: file.mediaId, before: 'WAITING', after: 'REVIEWED', reason: command.reason.trim() };
    }
  }
}
