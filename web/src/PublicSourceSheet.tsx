import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, X } from 'lucide-react';
import { notifyNavigationState } from './nativeBridge';
import './public-source-sheet.css';

function IconButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} />;
}

export const hasActiveSheet = () => Boolean(document.querySelector('[data-spotlog-sheet]'));

type SheetDetail = { title: string; description?: string; children: ReactNode };
type OpenSheetDetail = (detail: SheetDetail) => void;
const SheetDetailContext = createContext<OpenSheetDetail | null>(null);
/** A disclosure inside a sheet reuses its panel instead of opening another dialog. */
export const useBottomSheetDetail = () => useContext(SheetDetailContext);

export function BottomSheet({ title, description, onClose, children }: { title: string; description?: string; onClose: () => void; children: ReactNode }) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const sheetId = useRef<string | null>(null);
  const [detail, setDetail] = useState<(SheetDetail & { id: string }) | null>(null);
  const detailRef = useRef(detail);
  const lastDetail = useRef(detail);
  const detailOrigin = useRef<{ focus: HTMLElement | null; scrollTop: number } | null>(null);
  const returningFromDetail = useRef(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const showDetail = useCallback<OpenSheetDetail>((content) => {
    if (detailRef.current) return;
    const next = { ...content, id: crypto.randomUUID() };
    detailOrigin.current = { focus: document.activeElement as HTMLElement | null, scrollTop: body.current?.scrollTop ?? 0 };
    detailRef.current = next;
    lastDetail.current = next;
    if (window.history.state?.spotlogSheet === sheetId.current) {
      window.history.pushState({ ...window.history.state, spotlogSheetDetail: next.id }, '', window.location.href);
    }
    setDetail(next);
  }, []);
  const dismiss = useCallback(() => {
    if (!detailRef.current) { closeRef.current(); return; }
    if (returningFromDetail.current) return;
    if (window.history.state?.spotlogSheet === sheetId.current && window.history.state?.spotlogSheetDetail === detailRef.current.id) {
      returningFromDetail.current = true;
      window.history.back();
    } else { detailRef.current = null; setDetail(null); }
  }, []);
  useLayoutEffect(() => {
    if (detail) { panel.current?.focus({ preventScroll: true }); return; }
    if (detailOrigin.current) {
      if (body.current) body.current.scrollTop = detailOrigin.current.scrollTop;
      detailOrigin.current.focus?.focus({ preventScroll: true });
    }
  }, [detail]);
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const app = document.querySelector<HTMLElement>('.app-shell');
    const id = crypto.randomUUID();
    sheetId.current = id;
    const previous = { ...window.history.state, scrollTop: document.querySelector('.content')?.scrollTop ?? 0 };
    let popped = false;
    let installed = false;
    // Defer history mutation so React StrictMode's setup/cleanup probe is side-effect free.
    const setup = window.setTimeout(() => {
      installed = true;
      window.history.replaceState(previous, '', window.location.href);
      window.history.pushState({ ...previous, spotlogSheet: id }, '', window.location.href);
      if (app) app.inert = true;
      notifyNavigationState(true);
      panel.current?.focus();
    }, 0);
    const pop = (event: PopStateEvent) => {
      event.stopImmediatePropagation();
      returningFromDetail.current = false;
      // Back from attribution returns to the still-mounted form; forward may reopen it.
      if (event.state?.spotlogSheet === id) {
        const restored = event.state?.spotlogSheetDetail === lastDetail.current?.id ? lastDetail.current : null;
        detailRef.current = restored;
        setDetail(restored);
        return;
      }
      popped = true;
      closeRef.current();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); dismiss(); }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]') ?? []).filter((item) => item.getClientRects().length);
      const first = focusable[0]; const last = focusable.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('popstate', pop, true);
    document.addEventListener('keydown', key);
    return () => {
      window.clearTimeout(setup);
      window.removeEventListener('popstate', pop, true);
      document.removeEventListener('keydown', key);
      if (app) app.inert = false;
      if (installed && !popped && window.history.state?.spotlogSheet === id) window.history.go(window.history.state?.spotlogSheetDetail ? -2 : -1);
      notifyNavigationState((previous?.depth ?? 0) > 0);
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, [dismiss]);
  return createPortal(<div className="phase-sheet-backdrop" onClick={(event) => { if (event.target === event.currentTarget) dismiss(); }}>
    <div ref={panel} data-spotlog-sheet role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="phase-sheet">
      <header className={detail ? 'phase-sheet-detail-header' : undefined}>{detail && <IconButton aria-label="이전 화면으로" onClick={dismiss}><ArrowLeft size={20} /></IconButton>}<div><h2 id={titleId}>{detail?.title ?? title}</h2>{(detail ? detail.description : description) && <p>{detail ? detail.description : description}</p>}</div><IconButton aria-label={detail ? '사진 출처 닫기' : '닫기'} onClick={dismiss}><X size={20} /></IconButton></header>
      <SheetDetailContext.Provider value={showDetail}>
        <div ref={body} className="phase-sheet-body" style={detail ? { display: 'none' } : undefined} aria-hidden={detail ? true : undefined}>{children}</div>
        {detail && <div className="phase-sheet-body" data-spotlog-sheet-detail>{detail.children}</div>}
      </SheetDetailContext.Provider>
    </div>
  </div>, document.body);
}
