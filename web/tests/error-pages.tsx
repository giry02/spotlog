import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CustomerErrorBoundary } from '../src/CustomerErrorBoundary';
import { ErrorPage } from '../src/ErrorPage';
import '../src/styles.css';
import '../src/theme.css';

// DEV-only render failure fixture; no real requests, credentials or user records.
if (import.meta.env.DEV) {
  let fail = true;
  function Broken() { if (fail) throw new Error('fixture-private-error'); return <main className="app-shell"><p>검수 화면 복구 완료</p></main>; }
  function Fixture() {
    const [mode, setMode] = useState<'normal' | 'boundary'>('normal');
    return <><button onClick={() => { fail = true; setMode('boundary'); }}>화면 오류 검수</button><button onClick={() => { fail = false; }}>실패 원인 제거</button>{mode === 'boundary' ? <CustomerErrorBoundary><Broken /></CustomerErrorBoundary> : <main className="app-shell detail-open"><section className="content"><ErrorPage kind={500} onRetry={() => {}} onHome={() => {}} /></section></main>}</>;
  }
  createRoot(document.getElementById('root')!).render(<Fixture />);
}
