import { requestJson, servicePath, isRecord } from './serviceRequest.ts';
import { assertReviewReport, receiveLocalReviewReport, validateReportTarget, type ReportTarget, type ReportReason, type ReviewStorage } from './reviewServiceBridge.ts';
import type { OpsReport } from './publicServiceTypes';

export interface ReportReceipt { report: OpsReport; duplicate: boolean; mode: 'LOCAL_REVIEW' | 'API' }
export interface ReportAdapter { mode: 'LOCAL_REVIEW' | 'API' | 'UNAVAILABLE'; submit(target: ReportTarget, reason: ReportReason, detail: string, signal: AbortSignal): Promise<ReportReceipt> }
export function createReportAdapter({ endpoint = '', localReview = false, reporterId = 'local-self', storage }: { endpoint?: string; localReview?: boolean; reporterId?: string; storage?: ReviewStorage } = {}): ReportAdapter {
  if (endpoint) servicePath(endpoint);
  const mode = endpoint ? 'API' : localReview ? 'LOCAL_REVIEW' : 'UNAVAILABLE';
  return { mode, async submit(target, reason, detail, signal) {
    validateReportTarget(target);
    if (signal.aborted) throw signal.reason;
    if (!['SPAM', 'ABUSE', 'PRIVACY', 'COPYRIGHT', 'INFORMATION', 'OTHER'].includes(reason) || detail.length > 1000) throw new Error('신고 사유를 확인해 주세요.');
    if (mode === 'UNAVAILABLE') throw new Error('신고 서비스 연결 전이에요.');
    if (mode === 'LOCAL_REVIEW') return { ...receiveLocalReviewReport(target, reason, detail, reporterId, storage), mode };
    const value = await requestJson(endpoint, { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: crypto.randomUUID(), targetType: target.type, targetId: target.id, journalId: target.journalId ?? target.journey?.id, cardId: target.cardId, placeId: target.place?.id, mediaId: target.mediaId ?? (target.type === 'PHOTO' ? target.id : undefined), reasonCode: reason, reasonDetail: detail.trim() }) });
    if (!isRecord(value) || Object.keys(value).some(key => !['report', 'duplicate'].includes(key)) || typeof value.duplicate !== 'boolean') throw new Error('신고 접수 응답 형식을 확인해 주세요.');
    assertReviewReport(value.report);
    if (value.report.targetId !== target.id || value.report.targetType !== target.type || (value.report.journalId ?? '') !== (target.journalId ?? target.journey?.id ?? '') || (value.report.cardId ?? '') !== (target.cardId ?? '') || value.report.localReview || value.report.source === 'LOCAL_REVIEW' || !value.report.reporterId?.trim() || !value.report.receivedAt) throw new Error('신고 대상과 서버 접수 결과가 맞지 않아요.');
    return { report: value.report, duplicate: value.duplicate, mode: 'API' };
  } };
}
