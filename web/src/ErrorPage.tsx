import { useEffect, useRef } from 'react';
import { ArrowLeft, CircleAlert, House, KeyRound, RefreshCw, ShieldAlert, MapPinOff, Timer, Unplug, WifiOff, type LucideIcon } from 'lucide-react';
import { Button } from './ui';
import { errorCodes, errorCopy, type ErrorKind, type RecoveryAction } from './errorStates';
import './error-pages.css';

const icons: Partial<Record<ErrorKind, LucideIcon>> = { 401: KeyRound, 403: ShieldAlert, 404: MapPinOff, 429: Timer, 502: Unplug, 503: Unplug, 504: Timer, network: WifiOff };
const actionLabels: Record<RecoveryAction, string> = { back: '이전 화면으로', login: '로그인하기', home: '홈으로 가기', retry: '다시 시도' };
const actionIcons: Record<RecoveryAction, LucideIcon> = { back: ArrowLeft, login: KeyRound, home: House, retry: RefreshCw };
export interface ErrorPageProps {
  kind: ErrorKind;
  onHome: () => void;
  onBack?: () => void;
  onRetry?: () => void;
  onLogin?: () => void;
  onReview?: () => void;
  busy?: boolean;
  preview?: boolean;
  inline?: boolean;
}

/** Full page for route/load failures; inline variant preserves the surrounding form. */
export function ErrorPage({ kind, onHome, onBack, onRetry, onLogin, onReview, busy = false, preview = false, inline = false }: ErrorPageProps) {
  const copy = errorCopy[kind], Icon = icons[kind] ?? CircleAlert;
  const heading = useRef<HTMLHeadingElement>(null);
  const callbacks = { back: onBack, login: onLogin, home: onHome, retry: onRetry };
  const action = callbacks[copy.action] ? copy.action : 'home';
  const ActionIcon = actionIcons[action];
  useEffect(() => {
    if (inline) return;
    const oldTitle = document.title;
    document.title = `${copy.title} · Spotlog`;
    heading.current?.focus({ preventScroll: true });
    return () => { document.title = oldTitle; };
  }, [copy.title, inline]);
  return <article className={`error-page ${inline ? 'error-page--inline' : ''}`} aria-labelledby={`error-title-${kind}`}>
    {!inline && <div className="error-page-brand">spotlog</div>}
    <div className="error-page-body">
      <span className="error-page-illustration" aria-hidden="true"><Icon size={38} strokeWidth={1.6} /></span>
      <span className="error-page-label">{copy.label}</span>
      <h1 ref={heading} tabIndex={-1} id={`error-title-${kind}`}>{copy.title}</h1>
      <p>{copy.description}</p>
      <div className="error-page-actions">
        <Button loading={busy} onClick={callbacks[action]}><ActionIcon size={18} aria-hidden="true" />{actionLabels[action]}</Button>
        {action !== 'home' && <Button variant="secondary" disabled={busy} onClick={onHome}><House size={18} aria-hidden="true" />홈으로 가기</Button>}
        {action === 'home' && onBack && <Button variant="secondary" disabled={busy} onClick={onBack}><ArrowLeft size={18} aria-hidden="true" />이전 화면으로</Button>}
      </div>
      {preview && <p className="error-page-preview-note">오류 화면 미리보기 · 실제 장애가 발생한 상태는 아니에요.</p>}
      {onReview && <Button variant="ghost" size="compact" onClick={onReview}>오류 화면 목록 보기</Button>}
    </div>
  </article>;
}

/** Local QA catalog, omitted from production navigation. */
export function ErrorPagesReview({ onOpen, onHome }: { onOpen: (kind: ErrorKind) => void; onHome: () => void }) {
  return <article className="error-review-page">
    <div className="error-review-header"><Button variant="ghost" size="compact" onClick={onHome}><ArrowLeft size={18} />홈으로</Button><span>로컬 검수</span></div>
    <h1>오류 화면</h1><p>각 화면의 안내와 복귀 버튼을 확인할 수 있어요. 실제 서버 오류를 발생시키지 않아요.</p>
    <div className="error-review-list">{[...errorCodes, 'network' as const].map(kind => <Button variant="secondary" key={kind} onClick={() => onOpen(kind)}><span>{errorCopy[kind].label}</span></Button>)}</div>
  </article>;
}
