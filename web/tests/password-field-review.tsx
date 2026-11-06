import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PasswordField } from '../src/PasswordField';
import '../src/styles.css';
import '../src/theme.css';
import '../src/account-privacy.css';

/** DEV-only, memory-only controls. No session, storage, account adapter, consent or network calls. */
function PasswordReview() {
  const [values, setValues] = useState(['example-password-123', 'example-password-123', 'example-password-123']);
  const [locked, setLocked] = useState(false), [boundary, setBoundary] = useState(0), [opened, setOpened] = useState(true), [submits, setSubmits] = useState(0);
  return <main style={{ maxWidth: 460, margin: '0 auto', padding: 20, height: '100dvh', background: 'var(--paper)', overflowY: 'auto' }}>
    <h1 style={{ fontSize: 22 }}>비밀번호 입력 확인</h1><p style={{ fontSize: 14, lineHeight: 1.7 }}>메모리 전용. 실제 로그인·가입·약관 동의·이메일 발송 없음.</p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '18px 0' }}>
      <button type="button" className="outline" onClick={() => setLocked(current => !current)}>{locked ? '입력 잠금 해제' : '입력 잠금'}</button>
      <button type="button" className="outline" onClick={() => setBoundary(current => current + 1)}>화면·계정 경계 변경</button>
      <button type="button" className="outline" onClick={() => setValues(['', '', ''])}>입력 비우기</button>
      <button type="button" className="outline" onClick={() => setOpened(current => !current)}>{opened ? '입력 화면 닫기' : '입력 화면 다시 열기'}</button>
    </div>
    {opened && <form className="account-email-form" onSubmit={event => { event.preventDefault(); setSubmits(current => current + 1); }}>
      {['로그인 비밀번호', '가입 비밀번호', '가입 비밀번호 확인'].map((label, index) => <PasswordField key={`${boundary}:${index}`} label={label} value={values[index]} autoComplete={index ? 'new-password' : 'current-password'} minLength={index ? 10 : undefined} maxLength={128} required disabled={locked} hint={index === 1 ? '10~128자. 다른 서비스에서 쓰는 비밀번호는 피해주세요.' : undefined} aria-invalid={index === 2 && Boolean(values[2] && values[1] !== values[2])} onChange={event => setValues(current => current.map((value, at) => at === index ? event.target.value : value))}/>)}
      <button type="submit" className="primary">폼 제출 확인</button>
    </form>}
    <p role="status" id="password-review-status" style={{ fontSize: 14, marginTop: 20 }}>폼 제출 횟수: {submits} · 경계: {boundary} · {locked ? '잠김' : '입력 가능'}</p>
  </main>;
}
if (import.meta.env.DEV) createRoot(document.getElementById('root')!).render(<PasswordReview/>);
