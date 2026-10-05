import { useEffect, useRef, useState } from 'react';
import { Languages } from 'lucide-react';
import type { AiTranslationRequest, TranslationAdapter } from './aiPlanner';
import { useLocale } from './locale';
import { createTranslationCache, localTranslationAdapter, TRANSLATION_GLOSSARY_VERSION, translationState, validateTranslationResponse, type TranslationRecord } from './travelGuide';
import './travel-guide.css';

/** Attach to authored text without rewriting the original source or its IDs. */
export function TranslationText({ sourceId, sourceVersion, text, kind, glossaryVersion = TRANSLATION_GLOSSARY_VERSION, showOriginal = true, adapter = localTranslationAdapter }: {
  sourceId: string; sourceVersion: string; text: string; kind: 'journal' | 'caption' | 'comment';
  glossaryVersion?: string; showOriginal?: boolean; adapter?: TranslationAdapter;
}) {
  const { t } = useLocale();
  const [record, setRecord] = useState<TranslationRecord | null>(null);
  const [translated, setTranslated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const cache = useRef(createTranslationCache());
  const request: AiTranslationRequest = { requestId: '', sourceId, sourceVersion, language: 'en', glossaryVersion, text, selectedPlaceIds: [], dayIds: [], lockedVisitIds: [] };
  const state = translationState(record, request);
  useEffect(() => { controller.current?.abort(); setBusy(false); setFailed(false); return () => controller.current?.abort(); }, [sourceId, sourceVersion, text, glossaryVersion]);
  const translate = async () => {
    controller.current?.abort(); const abort = new AbortController(); controller.current = abort;
    const current = ++sequence.current; const input = { ...request, requestId: crypto.randomUUID() };
    setFailed(false); setBusy(true);
    const cached = cache.current.get(input);
    if (cached) { setRecord(cached); setTranslated(true); setBusy(false); return; }
    try {
      const response: unknown = await adapter.translate(input, abort.signal);
      if (abort.signal.aborted || sequence.current !== current) return;
      const result = validateTranslationResponse(response, input);
      const next: TranslationRecord = { sourceId, sourceVersion, original: text, language: 'en', glossaryVersion, translated: result.data.text, status: result.data.status };
      cache.current.put(input, next); setRecord(next); setTranslated(true);
    } catch { if (!abort.signal.aborted && current === sequence.current) { setFailed(true); setTranslated(false); } }
    finally { if (!abort.signal.aborted && current === sequence.current) setBusy(false); }
  };
  const ready = translated && (state === 'sample' || state === 'reviewed');
  return <div className={`translation-text translation-${kind}`}>
    {showOriginal && !ready && <p className="translation-original" lang="ko">{text}</p>}
    {ready && <p className="translation-result" lang="en">{record?.translated}</p>}
    <div className="translation-actions">
      <button type="button" onClick={() => ready ? setTranslated(false) : void translate()} disabled={busy} aria-expanded={ready}><Languages size={14} />{busy ? t('translating') : ready ? t(showOriginal ? 'original' : 'hideTranslation') : t('translate')}</button>
      {ready && <span>{t(state === 'reviewed' ? 'translationReviewed' : 'translationSample')}</span>}
    </div>
    {state === 'stale' && <p className="translation-notice" role="status">{t('translationStale')}</p>}
    {translated && state === 'unavailable' && <p className="translation-notice" role="status">{t('translationUnavailable')}</p>}
    {failed && <p className="translation-notice" role="alert">{t('translationError')}</p>}
  </div>;
}
