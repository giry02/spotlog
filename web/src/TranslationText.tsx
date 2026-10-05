import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AiTranslationRequest, TranslationAdapter } from './aiPlanner';
import { LanguageControls, useLocale } from './locale';
import { createTranslationCache, localTranslationAdapter, TRANSLATION_GLOSSARY_VERSION, translationState, validateTranslationResponse, type TranslationRecord } from './travelGuide';
import './travel-guide.css';
import { usePublicReview } from './publicReview';
import { reviewedPublicTranslation } from './reviewServiceBridge';

type ReadingStatus = 'original' | 'loading' | 'sample' | 'reviewed' | 'unavailable' | 'failed';
type ReadingContext = {
  statuses: Record<string, ReadingStatus>; retryEpoch: number;
  report: (id: string, status: ReadingStatus | null) => void; retry: () => void;
};
const ReadingContext = createContext<ReadingContext | null>(null);

/** One reading preference and one status notice for the whole document. */
export function ContentTranslationScope({ children }: { children: ReactNode }) {
  const [statuses, setStatuses] = useState<Record<string, ReadingStatus>>({});
  const [retryEpoch, setRetryEpoch] = useState(0);
  const report = useCallback((id: string, status: ReadingStatus | null) => {
    setStatuses(current => {
      if (current[id] === status || (status === null && !(id in current))) return current;
      const next = { ...current };
      if (status === null) delete next[id]; else next[id] = status;
      return next;
    });
  }, []);
  const retry = useCallback(() => setRetryEpoch(current => current + 1), []);
  const value = useMemo(() => ({ statuses, retryEpoch, report, retry }), [statuses, retryEpoch, report, retry]);
  return <ReadingContext.Provider value={value}>{children}</ReadingContext.Provider>;
}

export function ContentLanguageControls() {
  const { locale } = useLocale();
  const reading = useContext(ReadingContext);
  const statuses = Object.values(reading?.statuses ?? {});
  const loading = statuses.includes('loading');
  const failed = statuses.includes('failed');
  const unavailable = statuses.includes('unavailable');
  const sample = statuses.includes('sample');
  const notice = loading ? 'Loading English…' : failed
    ? 'Some translations could not be loaded. The original text is shown.'
    : unavailable ? 'Some text has no English translation yet. The original is shown.'
    : sample ? 'Sample translations.' : '';
  return <div className="content-language-controls">
    <LanguageControls />
    {locale === 'en' && notice && <div className="content-language-status" role="status">
      <span>{notice}{!loading && sample && (failed || unavailable) ? ' Available translations are samples.' : ''}</span>
      {failed && !loading && <button type="button" className="guide-button" onClick={reading?.retry}>Try again</button>}
    </div>}
  </div>;
}

/** Replace the visible text, never the authored source. Typography belongs to its parent. */
export function TranslationText({ sourceId, sourceVersion, text, kind, glossaryVersion = TRANSLATION_GLOSSARY_VERSION, as: Tag = 'p', className, adapter = localTranslationAdapter }: {
  sourceId: string; sourceVersion: string; text: string; kind: 'journal' | 'caption' | 'comment';
  glossaryVersion?: string; as?: 'p' | 'span' | 'h1' | 'h2' | 'h3' | 'blockquote' | 'figcaption'; className?: string; adapter?: TranslationAdapter;
}) {
  const { locale } = useLocale();
  const { state: publicState } = usePublicReview();
  const reviewed = reviewedPublicTranslation(publicState, sourceId, sourceVersion, text, glossaryVersion);
  const reading = useContext(ReadingContext);
  const report = reading?.report;
  const retryEpoch = reading?.retryEpoch ?? 0;
  const id = useId();
  const cache = useRef(createTranslationCache());
  const key = JSON.stringify([sourceId, sourceVersion, text, glossaryVersion]);
  const [result, setResult] = useState<{ key: string; record: TranslationRecord | null; failed: boolean }>({ key: '', record: null, failed: false });
  const request: AiTranslationRequest = { requestId: '', sourceId, sourceVersion, language: 'en', glossaryVersion, text, selectedPlaceIds: [], dayIds: [], lockedVisitIds: [] };
  const current = result.key === key ? result : null;
  const visibleRecord = reviewed ?? current?.record ?? null;
  const state = translationState(visibleRecord, request);
  const ready = locale === 'en' && (state === 'sample' || state === 'reviewed');
  const status: ReadingStatus = locale === 'ko' || !text.trim() ? 'original' : current?.failed ? 'failed'
    : state === 'original' || state === 'stale' ? 'loading' : state;

  useEffect(() => {
    if (locale !== 'en' || !text.trim() || reviewed) return;
    const abort = new AbortController();
    const input: AiTranslationRequest = { requestId: crypto.randomUUID(), sourceId, sourceVersion, language: 'en', glossaryVersion, text, selectedPlaceIds: [], dayIds: [], lockedVisitIds: [] };
    const cached = cache.current.get(input);
    if (cached) { setResult({ key, record: cached, failed: false }); return; }
    setResult({ key, record: null, failed: false });
    void (async () => {
      try {
        const response: unknown = await adapter.translate(input, abort.signal);
        if (abort.signal.aborted) return;
        const translated = validateTranslationResponse(response, input);
        const record: TranslationRecord = { sourceId, sourceVersion, original: text, language: 'en', glossaryVersion, translated: translated.data.text, status: translated.data.status };
        cache.current.put(input, record);
        setResult({ key, record, failed: false });
      } catch {
        if (!abort.signal.aborted) setResult({ key, record: null, failed: true });
      }
    })();
    return () => abort.abort();
  }, [locale, sourceId, sourceVersion, text, glossaryVersion, key, adapter, retryEpoch, reviewed?.translated]);

  useEffect(() => { report?.(id, status); }, [report, id, status]);
  useEffect(() => () => report?.(id, null), [report, id]);
  return <Tag className={className} lang={ready ? 'en' : 'ko'} data-content-kind={kind}>{ready ? visibleRecord?.translated : text}</Tag>;
}
