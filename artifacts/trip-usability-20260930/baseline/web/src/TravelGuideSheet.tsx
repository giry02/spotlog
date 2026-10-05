import { useEffect, useRef, useState } from 'react';
import { Accessibility, ArrowRight, CalendarDays, Check, Clock3, Copy, Languages, MapPin, Send, Sparkles } from 'lucide-react';
import type { Journey, Place } from './data';
import { BottomSheet, useBottomSheetDetail } from './BottomSheet';
import { LanguageControls, useLocale, type MessageKey } from './locale';
import { createGuideSessionStore, guideAnswerKey, guideDayId, guideRequest, guideSessionKey, guideVisitId, koreanPlaceAddress, localGuideAdapter, sourceVersion, validateGuideResponse, type GuideSession } from './travelGuide';
import type { GuideAdapter } from './aiPlanner';
import { TranslationText } from './TranslationText';
import { PhotoCredit } from './PublicTourismCredit';
import './travel-guide.css';

const guideSessions = createGuideSessionStore();
export const clearTravelGuideSessions = () => guideSessions.clear();

function KoreanAddress({ place }: { place: Place }) {
  const { t } = useLocale();
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copy = async () => {
    try { await navigator.clipboard.writeText(koreanPlaceAddress(place)); setStatus('copied'); }
    catch { setStatus('failed'); }
  };
  return <section className="guide-korean-address">
    <MapPin size={22} aria-hidden="true" />
    <h3 lang="ko">{place.name}</h3>
    <p lang="ko">{place.address.trim() || '주소가 등록되지 않았어요.'}</p>
    <button type="button" className="guide-button" onClick={() => void copy()}>{status === 'copied' ? <Check size={16} /> : <Copy size={16} />}{t('copyAddress')}</button>
    <p className="guide-status" role="status">{status === 'copied' ? t('copied') : status === 'failed' ? t('copyFailed') : ''}</p>
  </section>;
}

function GuideContent({ journey, initialDay = 1, adapter = localGuideAdapter }: { journey: Journey; initialDay?: number; adapter?: GuideAdapter }) {
  const { locale, t } = useLocale();
  const sessionKey = guideSessionKey(journey, initialDay);
  const [session, setSession] = useState<GuideSession>(() => guideSessions.read(sessionKey) ?? { dayId: guideDayId(journey.days.find(day => day.day === initialDay) ?? journey.days[0]), visitsByDay: {}, question: '', answers: {}, lastAnswerByScope: {} });
  useEffect(() => { guideSessions.write(sessionKey, session); }, [sessionKey, session]);
  const day = journey.days.find(value => guideDayId(value) === session.dayId) ?? journey.days[0];
  const visitId = session.visitsByDay[guideDayId(day)] ?? '';
  const index = Math.max(0, day.places.findIndex((place, i) => guideVisitId(place, i) === visitId));
  const place = day.places[index];
  const question = session.question;
  const setQuestion = (value: string) => setSession(current => ({ ...current, question: value }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ scope: string; question: string } | null>(null);
  const controller = useRef<AbortController | null>(null);
  const scope = `${sourceVersion(journey)}:${guideDayId(day)}:${index}:${locale}`;
  const scopeRef = useRef(scope); scopeRef.current = scope;
  const requestRef = useRef('');
  const showDetail = useBottomSheetDetail();
  useEffect(() => { controller.current?.abort(); setBusy(false); setError(null); return () => controller.current?.abort(); }, [scope]);
  const ask = async (value: string) => {
    if (!value.trim()) return;
    controller.current?.abort();
    const abort = new AbortController(); controller.current = abort;
    const request = guideRequest(journey, day, place, index, value, locale);
    requestRef.current = request.requestId;
    setBusy(true); setError(null);
    const answerKey = guideAnswerKey(scope, value);
    if (session.answers[answerKey]) {
      setSession(current => ({ ...current, lastAnswerByScope: { ...current.lastAnswerByScope, [scope]: answerKey } }));
      setBusy(false); return;
    }
    try {
      const response: unknown = await adapter.answer(request, abort.signal);
      if (abort.signal.aborted || scopeRef.current !== scope || requestRef.current !== request.requestId) return;
      const result = validateGuideResponse(response, request);
      setSession(current => ({ ...current, answers: { ...current.answers, [answerKey]: { question: value.trim(), value: result } }, lastAnswerByScope: { ...current.lastAnswerByScope, [scope]: answerKey } }));
    } catch { if (!abort.signal.aborted && scopeRef.current === scope) setError({ scope, question: value.trim() }); }
    finally { if (!abort.signal.aborted && scopeRef.current === scope) setBusy(false); }
  };
  const quick: MessageKey[] = ['today', 'nextPlace', 'highlights', 'hours', 'accessibility'];
  const quickIcons = [CalendarDays, ArrowRight, Sparkles, Clock3, Accessibility];
  const activeAnswer = session.answers[session.lastAnswerByScope[scope]] ?? null;
  return <section className="travel-guide">
    <div className="guide-topline"><span className="guide-meta">{t('sample')}</span><LanguageControls /></div>
    <label className="guide-field"><span>{t('day')}</span><select value={guideDayId(day)} onChange={event => setSession(current => ({ ...current, dayId: event.target.value }))}>
      {journey.days.map(value => <option key={guideDayId(value)} value={guideDayId(value)}>DAY {value.day}{value.date && value.date!==`DAY ${value.day}` ? ` · ${value.date}` : ''}</option>)}
    </select></label>
    {day.places.length ? <>
      <label className="guide-field"><span>{t('currentPlace')}</span><select value={guideVisitId(place, index)} onChange={event => setSession(current => ({ ...current, visitsByDay: { ...current.visitsByDay, [guideDayId(day)]: event.target.value } }))}>
        {day.places.map((value, i) => <option key={guideVisitId(value, i)} value={guideVisitId(value, i)}>{i + 1}. {value.name}</option>)}
      </select></label>
      <div className="guide-place">
        <div className="guide-place-heading">{place.image&&<div className="guide-place-media"><img src={place.image} alt=""/><PhotoCredit image={place.image}/></div>}<div><h3 lang="ko">{place.name}</h3><p className="guide-address" lang="ko">{place.address}</p></div></div>
        <button type="button" className="guide-button" onClick={() => showDetail?.({ title: t('koreanAddress'), children: <KoreanAddress place={place} /> })}><Languages size={16} />{t('showAddress')}</button>
        {place.description && <TranslationText key={place.id} sourceId={`place:${place.id}:description`} sourceVersion={sourceVersion(place.description)} text={place.description} kind="journal" />}
      </div>
    </> : <p className="guide-empty">{t('guideEmpty')}</p>}
    <div className="guide-questions" aria-label={t('question')}>
      {quick.map((key,i) => {const Icon=quickIcons[i];return <button type="button" className="guide-button" key={key} disabled={busy || (!day.places.length && key !== 'today')} onClick={() => { setQuestion(t(key)); void ask(t(key)); }}><Icon size={14}/>{t(key)}</button>;})}
    </div>
    <form className="guide-question-form" onSubmit={event => { event.preventDefault(); void ask(question); }}>
      <label className="guide-field"><span>{t('question')}</span><textarea maxLength={600} rows={2} value={question} onChange={event => setQuestion(event.target.value)} /></label>
      <button type="submit" className="guide-button" disabled={busy || !question.trim()}><Send size={16} />{busy ? t('loading') : t('ask')}</button>
      {busy && <button type="button" className="guide-button" onClick={() => { controller.current?.abort(); setBusy(false); }}>{t('cancel')}</button>}
    </form>
    {error?.scope === scope && <div className="guide-error ui-error" role="alert"><p>{error.question}</p><p>{t('guideFailure')}</p><button type="button" className="guide-button" onClick={() => void ask(error.question)}>{t('retry')}</button></div>}
    {activeAnswer && <section className="guide-answer" aria-live="polite"><h3>{activeAnswer.question}</h3><p>{activeAnswer.value.data.text}</p><div className="guide-sources"><strong>{t('sources')}</strong>{activeAnswer.value.sources.map(source => <span key={source.id}>{source.label} · {source.checkedAt ?? t('unknownDate')}</span>)}</div></section>}
  </section>;
}

export default function TravelGuideSheet({ journey, initialDay = 1, onClose, adapter }: { journey: Journey; initialDay?: number; onClose: () => void; adapter?: GuideAdapter }) {
  const { t } = useLocale();
  return <BottomSheet title={t('guide')} description={journey.title} onClose={onClose}>
    {journey.days.length ? <GuideContent key={guideSessionKey(journey, initialDay)} journey={journey} initialDay={initialDay} adapter={adapter} /> : <p className="guide-empty">{t('guideEmpty')}</p>}
  </BottomSheet>;
}

export function AccountAppInfo() {
  const { t } = useLocale();
  return <section className="guide-account">
    <h3>{t('language')}</h3><LanguageControls />
    <h3>{t('localAccount')}</h3><p>{t('accountExplanation')}</p><p className="guide-meta">{t('syncUnavailable')}</p>
    <h3>{t('appHelp')}</h3><p>{t('appExplanation')}</p>
  </section>;
}
