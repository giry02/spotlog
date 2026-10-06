import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Flag } from 'lucide-react';
import type { Journey, Place } from './data';
import type { PlacePhotoInput } from './placePhotos';
import { BottomSheet } from './BottomSheet';
import { Button, Field } from './ui';
import { useLocale } from './locale';
import { createReportAdapter, type ReportAdapter, type ReportReceipt } from './reportService';
import { type ReportTarget, type ReportReason, type PublicPlaceProjection } from './reviewServiceBridge';
import { getPhotoSource } from './photoSources';
import { usePublicReview } from './publicReview';
import { journalReportChoices, reportPhotoCredit, type ReportChoice } from './journalReportTargets';
import type { JourneyComment } from './consumerPublicSeed';
import type { CardSocialStore } from './cardSocialState';
import './report.css';

const reasonOptions: [ReportReason, string, string][] = [['SPAM', '스팸·광고', 'Spam or advertising'], ['ABUSE', '욕설·괴롭힘', 'Abuse or harassment'], ['PRIVACY', '개인정보 노출', 'Personal information'], ['COPYRIGHT', '저작권·사진 사용', 'Copyright or photo rights'], ['INFORMATION', '장소 정보 오류', 'Incorrect place information'], ['OTHER', '기타', 'Other']];
type ReportContextValue = { openReport(target: ReportTarget, choices?: ReportChoice[]): void; publicJourney(id: string): Journey | undefined };
const ReportContext = createContext<ReportContextValue | null>(null);
export const useReport = () => useContext(ReportContext);
export function ReportProvider({ children, journeys }: { children: ReactNode; journeys: Journey[] }) {
  const [selection, setSelection] = useState<{ target: ReportTarget; choices?: ReportChoice[] } | null>(null);
  const adapter = useMemo(() => createReportAdapter({ endpoint: import.meta.env.VITE_REPORT_ENDPOINT ?? '', localReview: import.meta.env.DEV }), []);
  const value = { openReport: (target: ReportTarget, choices?: ReportChoice[]) => setSelection({ target, choices }), publicJourney: (id: string) => journeys.find(j => j.id === id && j.visibility === 'PUBLIC' && j.status === 'PUBLISHED' && j.purpose !== 'PLAN' && !j.trash) };
  return <ReportContext.Provider value={value}>{children}{selection && <ReportSheet key={`${selection.target.type}:${selection.target.id}`} target={selection.target} choices={selection.choices} adapter={adapter} onClose={() => setSelection(null)} />}</ReportContext.Provider>;
}
export function ReportButton({ target, choices, className = 'report-context-button', label }: { target: ReportTarget; choices?: ReportChoice[]; className?: string; label?: string }) {
  const context = useReport(), { locale } = useLocale();
  if (!context) return null;
  const labels: Record<string, string> = { '신고': 'Report', '장소 신고': 'Report place', '사진 신고': 'Report photo', '여행기 신고': 'Report journal', '표지 신고': 'Report cover', '작성자 신고': 'Report author' };
  const text = locale === 'en' ? labels[label ?? '신고'] ?? label ?? 'Report' : label ?? '신고';
  return <button type="button" className={className} aria-label={`${target.label} · ${text}`} title={text} onClick={event => { event.stopPropagation(); context.openReport(target, choices); }}><Flag size={16} aria-hidden="true" /><span>{text}</span></button>;
}
export function JournalReportButton({ journey, comments, threads, selfName }: { journey: Journey; comments: JourneyComment[]; threads?: CardSocialStore; selfName: string }) {
  const { state } = usePublicReview();
  const choices = journalReportChoices({ journey, comments, threads, selfName, publicComments: state.comments, hiddenCommentIds: state.commentModeration.filter(item => item.state !== 'VISIBLE').map(item => item.id), photoCredit: (image, place) => {
    const credit = reportPhotoCredit(image, place), source = getPhotoSource(image);
    return credit ?? (source && { provider: source.owner, author: source.author, sourceUrl: source.sourceUrl, license: source.license, licenseUrl: source.licenseUrl, checkedAt: source.verifiedAt, changes: source.changes });
  } });
  if (!choices.length) return null;
  return <div className="journal-report-footer"><ReportButton target={choices[0].target} choices={choices} /></div>;
}
/** Resolve public place identity from the published catalog, never a private saved snapshot. */
export function PlaceReportActions({ place, photo, journey, cardId }: { place: Place; photo?: PlacePhotoInput; journey?: Journey; cardId?: string }) {
  const { catalog } = usePublicReview();
  const publicJourney = journey?.visibility === 'PUBLIC' && journey.status === 'PUBLISHED' && journey.purpose !== 'PLAN' ? journey : undefined;
  const publicPlace = catalog.find(p => p.id === place.id) ?? (publicJourney?.visibility === 'PUBLIC' && publicJourney.status === 'PUBLISHED' && publicJourney.purpose !== 'PLAN' ? place : undefined);
  if (!publicPlace) return null;
  const shownPhoto = photo ?? publicPlace.photos?.[0];
  const source = shownPhoto && getPhotoSource(shownPhoto.image);
  const credit = (publicPlace as PublicPlaceProjection).publicMediaCredits?.find(c => c.image === shownPhoto?.image) ?? (source && { provider: source.owner, author: source.author, sourceUrl: source.sourceUrl, license: source.license, licenseUrl: source.licenseUrl, checkedAt: source.verifiedAt, changes: source.changes });
  const target: ReportTarget = { type: 'PLACE', id: publicPlace.id, label: publicPlace.name, place: publicPlace, journey: publicJourney, cardId };
  const choices: ReportChoice[] = [{ target, group: 'place', label: '장소 정보', english: 'Place information' }];
  if (shownPhoto?.image) choices.push({ group: 'photo', label: '사진', english: 'Photo', target: { type: 'PHOTO', id: shownPhoto.mediaId ?? `${publicPlace.id}:${shownPhoto.image}`, label: publicPlace.name, place: publicPlace, journey: publicJourney, cardId, photo: { id: shownPhoto.mediaId ?? `${publicPlace.id}:${shownPhoto.image}`, image: shownPhoto.image, caption: shownPhoto.caption, sourceCredit: credit } } });
  return <div className="report-context-actions"><ReportButton target={target} choices={choices} /></div>;
}
export function ReportSheet({ target: initialTarget, choices, adapter, onClose }: { target: ReportTarget; choices?: ReportChoice[]; adapter: ReportAdapter; onClose(): void }) {
  const { locale } = useLocale(), en = locale === 'en';
  const [selection, setSelection] = useState(0);
  const target = choices?.[selection]?.target ?? initialTarget;
  const [reason, setReason] = useState<ReportReason>('SPAM'), [detail, setDetail] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [receipt, setReceipt] = useState<ReportReceipt | null>(null);
  const lock = useRef(false), pending = useRef<AbortController | null>(null), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; pending.current?.abort(); }; }, []);
  const submit = async () => {
    if (lock.current || receipt || adapter.mode === 'UNAVAILABLE') return;
    lock.current = true; setBusy(true); setError(''); const controller = new AbortController(); pending.current = controller;
    try { const next = await adapter.submit(target, reason, detail, controller.signal); if (mounted.current && !controller.signal.aborted) setReceipt(next); }
    catch (failure) { if (mounted.current && !controller.signal.aborted) setError(failure instanceof Error ? failure.message : en ? 'Could not submit. Your reason is kept.' : '접수하지 못했어요. 작성한 이유는 유지했어요.'); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  };
  return <BottomSheet title={en ? 'Report public content' : '공개 콘텐츠 신고'} description={target.label} onClose={onClose}><div className="plan-form">
    {receipt ? <><p role="status">{receipt.mode === 'LOCAL_REVIEW' ? (en ? 'Received for local review.' : '로컬 검수 접수') : (en ? 'Received by the service.' : '서비스 서버 접수')}{receipt.duplicate && (en ? ' This report was already received.' : ' · 이미 접수한 신고예요.')}</p><p className="plan-help">{receipt.report.reportId} · {receipt.report.status === 'OPEN' ? en ? 'Awaiting review' : '검토 대기' : en ? 'Reviewed' : '처리됨'}</p><Button onClick={onClose}>{en ? 'Close' : '닫기'}</Button></> : <>
      <p className="plan-help">{adapter.mode === 'LOCAL_REVIEW' ? (en ? 'This receipt is saved locally for review. It is not sent to a live service.' : '이 기기에 로컬 검수용으로 접수해요. 실제 서비스 서버로 전송되지 않습니다.') : adapter.mode === 'UNAVAILABLE' ? (en ? 'The report service is not connected yet.' : '신고 서비스 연결 전이에요.') : (en ? 'The service will review the public target you select.' : '선택한 공개 대상과 사유를 서비스 운영자에게 보내요.')}</p>
      {choices && choices.length > 1 && <Field label={en ? 'Report target' : '신고 대상'}><select aria-label={en ? 'Report target' : '신고 대상'} disabled={busy} value={selection} onChange={event => { setSelection(Number(event.target.value)); setError(''); }}>{(['journal', 'place', 'photo', 'comment'] as const).map(group => {
        const options = choices.map((choice, index) => ({ choice, index })).filter(item => item.choice.group === group);
        const labels = { journal: en ? 'Journal / author' : '여행기·작성자', place: en ? 'Places' : '장소', photo: en ? 'Photos' : '사진', comment: en ? 'Comments / replies' : '댓글·답글' };
        return options.length > 0 && <optgroup key={group} label={labels[group]}>{options.map(({ choice, index }) => <option key={index} value={index}>{en ? choice.english : choice.label}</option>)}</optgroup>;
      })}</select></Field>}
      <Field label={en ? 'Reason' : '신고 이유'}><select aria-label={en ? 'Reason' : '신고 이유'} disabled={busy} value={reason} onChange={e => setReason(e.target.value as ReportReason)}>{reasonOptions.map(([id, ko, english]) => <option key={id} value={id}>{en ? english : ko}</option>)}</select></Field>
      <Field label={en ? 'Details (optional)' : '상세 사유 (선택)'}><textarea aria-label={en ? 'Details (optional)' : '상세 사유 (선택)'} rows={3} maxLength={1000} disabled={busy} value={detail} onChange={e => setDetail(e.target.value)} placeholder={en ? 'Describe the issue. Do not include private information.' : '문제가 있는 부분을 적어 주세요. 개인 정보는 입력하지 마세요.'} /></Field>
      {error && <p className="ui-error" role="alert">{error}</p>}<Button loading={busy} disabled={adapter.mode === 'UNAVAILABLE'} onClick={() => void submit()}>{error ? en ? 'Try again' : '다시 접수' : adapter.mode === 'LOCAL_REVIEW' ? en ? 'Submit local report' : '로컬 검수 접수' : en ? 'Submit report' : '신고 접수'}</Button>
    </>}
  </div></BottomSheet>;
}
