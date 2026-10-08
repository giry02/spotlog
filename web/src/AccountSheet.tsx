import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, LogOut, MapPin, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import { BottomSheet } from './BottomSheet';
import { Button, Field } from './ui';
import { PolicyLink } from './PolicyDocumentView';
import { draftPolicies, emptySignupChoices, requiredSignupAccepted, type PolicyBundle, type PolicyId, type SignupChoices } from './accountPolicies';
import { createSocialAccountAdapter, validEmail, validSignupPassword, type AccountProvider, type LoginProvider, type SocialAccountAdapter, type SocialAccountUser, type SocialSession } from './socialAccountService';
import { useAccount, type AccountView } from './accountContext';
import { ServiceError } from './serviceRequest';
import { isNativeShell } from './nativeBridge';
import './frontend-completion.css';
import './account-privacy.css';

const defaultAdapter = createSocialAccountAdapter(import.meta.env.VITE_ACCOUNT_ENDPOINT ?? '');
const providerName = (p: AccountProvider) => p === 'EMAIL' ? '이메일' : p === 'GOOGLE' ? 'Google' : 'Apple';
function ConsentRow({ name, label, checked, onChange, policy, bundle, disabled }: { name: keyof SignupChoices; label: string; checked: boolean; onChange: (checked: boolean) => void; policy?: PolicyId; bundle: PolicyBundle; disabled: boolean }) {
  return <div className="signup-consent-row"><label><input type="checkbox" name={name} checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} /><span>{label}</span></label>{policy && <PolicyLink id={policy} bundle={bundle} />}</div>;
}
export function AccountSheet({ onClose, adapter: suppliedAdapter, initialView = 'login', reason, onSignedIn, navigate = url => window.location.assign(url) }: { onClose: () => void; adapter?: SocialAccountAdapter; initialView?: AccountView; reason?: string; onSignedIn?: (user: SocialAccountUser) => void; navigate?: (url: string) => void }) {
  const account = useAccount(), adapter = suppliedAdapter ?? account?.adapter ?? defaultAdapter;
  const reviewAccount = adapter.reviewAccount;
  const [session, setSession] = useState<SocialSession>(account?.session ?? { state: 'GUEST' });
  const [bundle, setBundle] = useState<PolicyBundle>(draftPolicies);
  const [view, setView] = useState<'login' | 'signup' | 'signup-details' | 'consent' | 'verify' | 'reset' | 'delete'>(initialView);
  const [selected, setSelected] = useState<LoginProvider>('GOOGLE');
  const [choices, setChoices] = useState(emptySignupChoices);
  const [email, setEmail] = useState(initialView === 'login' ? reviewAccount?.email ?? '' : ''), [password, setPassword] = useState(initialView === 'login' ? reviewAccount?.password ?? '' : ''), [confirmation, setConfirmation] = useState(''), [name, setName] = useState(''), [code, setCode] = useState('');
  const [socialNotice, setSocialNotice] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');
  const codeInput = useRef<HTMLInputElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(adapter.configured), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const pending = useRef<AbortController | null>(null), version = useRef(0), locked = useRef(false);
  const connected = adapter.configured;
  const member = session.state === 'SIGNED_IN' ? session.user : null;
  const clearVerification = () => { setVerificationEmail(''); setCode(''); };
  useEffect(() => { if ((view === 'signup-details' && verificationEmail) || view === 'verify') codeInput.current?.focus(); }, [view, verificationEmail]);
  useEffect(() => { if (account?.adapter === adapter) { setSession(account.session); if (account.session.state === 'GUEST') setView(current => current === 'delete' ? 'login' : current); } }, [account?.session, adapter]);
  const updateSession = (next: SocialSession) => { setSession(next); if (account?.adapter === adapter) account.updateSession(next); };
  const signedIn = (user: SocialAccountUser) => { updateSession({ state: 'SIGNED_IN', user }); setPassword(''); setConfirmation(''); clearVerification(); setView('login'); setNotice(reviewAccount ? '검수 계정으로 로그인했어요. 하던 화면을 확인해 보세요.' : '로그인했어요. 하던 작업으로 돌아가서 이어가세요.'); onSignedIn?.(user); if (reviewAccount) onClose(); };
  const load = async (signal: AbortSignal) => {
    const next = await adapter.session(signal);
    if (signal.aborted) return;
    updateSession(next);
    const policies = await adapter.policies(signal);
    if (signal.aborted) return;
    setBundle(policies);
    if (next.state === 'PENDING_SIGNUP') { setSelected(next.provider); setView('consent'); }
  };
  useEffect(() => {
    const c = new AbortController(); pending.current = c; const v = ++version.current;
    if (!connected) { setBusy(false); return () => c.abort(); }
    void load(c.signal).catch(() => { if (!c.signal.aborted && v === version.current) setError('계정을 확인하지 못했어요. 다시 시도해 주세요.'); }).finally(() => { if (!c.signal.aborted && v === version.current) setBusy(false); });
    return () => { version.current++; c.abort(); pending.current?.abort(); };
  }, [adapter, connected]);
  const run = async (action: (signal: AbortSignal) => Promise<void>, socialProvider?: LoginProvider) => {
    if (locked.current || !connected) return;
    locked.current = true; setBusy(true); setError(''); setNotice('');
    const v = ++version.current; pending.current?.abort(); const c = new AbortController(); pending.current = c;
    try { await action(c.signal); }
    catch (e) {
      if (c.signal.aborted || v !== version.current) return;
      if (socialProvider) {
        if (e instanceof ServiceError && e.status === 401) updateSession({ state: 'GUEST' });
        setSocialNotice(e instanceof ServiceError && e.status === 429 ? '요청이 많아요. 잠시 후 다시 시도하거나 이메일로 로그인해 주세요.' : providerName(socialProvider) + ' 로그인을 시작하지 못했어요. 다시 시도하거나 이메일로 로그인해 주세요.');
        return;
      }
      if (e instanceof ServiceError && e.status === 401) {
        updateSession({ state: 'GUEST' });
        setError(member ? '로그인이 만료됐어요. 다시 로그인해 주세요. 작성하던 내용은 유지돼요.' : '이메일과 비밀번호를 다시 확인해 주세요.');
        if (member) setView('login');
      } else if (e instanceof ServiceError && e.status === 409 && view === 'login') { setView('verify'); setPassword(''); setNotice('이메일 인증을 완료한 뒤 이용할 수 있어요.'); }
      else if (e instanceof ServiceError && (e.status === 412 || (e.status === 409 && view === 'consent'))) { setBundle(draftPolicies); setChoices(emptySignupChoices()); clearVerification(); if (view === 'signup-details') setView('signup'); setError('약관 버전이 바뀌었어요. 계정 다시 확인 후 새 약관에 동의해 주세요.'); }
      else if (e instanceof ServiceError && (e.status === 400 || e.status === 410) && (view === 'verify' || (view === 'signup-details' && verificationEmail))) setError('인증번호가 맞지 않거나 만료됐어요. 확인하거나 다시 받아주세요.');
      else setError(e instanceof ServiceError && e.status === 429 ? '요청이 많아요. 잠시 후 다시 시도해 주세요.' : '요청을 완료하지 못했어요. 입력은 유지했으니 다시 시도해 주세요.');
    } finally { if (v === version.current) { locked.current = false; setBusy(false); } }
  };
  const changeView = (next: typeof view) => { setView(next); setError(''); setNotice(''); setSocialNotice(''); setPassword(next === 'login' ? reviewAccount?.password ?? '' : ''); if (next === 'login' && reviewAccount) setEmail(reviewAccount.email); setConfirmation(''); clearVerification(); };
  const begin = (p: LoginProvider) => {
    setSelected(p); setError(''); setNotice(''); setSocialNotice('');
    if (reviewAccount) { setSocialNotice(providerName(p) + ' 로그인은 인증 연결 후 이용할 수 있어요. 미리 입력된 검수 계정으로 이메일 로그인해 주세요.'); return; }
    if (!connected) { setSocialNotice(providerName(p) + ' 로그인 연결이 아직 준비되지 않았어요. 연결이 준비되면 이용할 수 있어요.'); return; }
    if (isNativeShell()) { setSocialNotice('앱의 ' + providerName(p) + ' 로그인은 시스템 브라우저 인증 연결 후 이용할 수 있어요. 이메일 로그인은 계속 사용할 수 있어요.'); return; }
    void run(async signal => { const url = await adapter.beginSignIn(p, window.location.pathname + '#profile', signal); if (!signal.aborted) navigate(url); }, p);
  };
  const agree = (key: keyof SignupChoices, value: boolean) => { clearVerification(); setChoices(current => ({ ...current, [key]: value })); };
  const signupReady = connected && bundle.status === 'PUBLISHED' && requiredSignupAccepted(choices) && (view === 'consent' ? session.state === 'PENDING_SIGNUP' : validEmail(email) && validSignupPassword(password) && password === confirmation && Boolean(name.trim()) && name.trim().length <= 40);
  const requestSignupCode = () => {
    if (!signupReady || verificationEmail) return;
    void run(async signal => { const result = await adapter.signUpEmail({ email, password, displayName: name }, bundle, choices, signal); if (!signal.aborted) { setEmail(result.email); setVerificationEmail(result.email); setCode(''); setNotice(result.email + '로 인증번호를 보냈어요. 아래에서 인증을 완료해 주세요.'); } });
  };
  const submitEmail = (event: FormEvent) => {
    event.preventDefault();
    if (view === 'login' && validEmail(email) && password) void run(async signal => { const user = await adapter.signInEmail(email, password, signal); if (!signal.aborted) signedIn(user); });
    else if (view === 'signup-details' && verificationEmail && signupReady && /^\d{6}$/.test(code)) void run(async signal => { const user = await adapter.verifyEmail(verificationEmail, code, signal); if (!signal.aborted) signedIn(user); });
    else if (view === 'verify' && /^\d{6}$/.test(code)) void run(async signal => { const user = await adapter.verifyEmail(email, code, signal); if (!signal.aborted) signedIn(user); });
    else if (view === 'reset' && validEmail(email)) void run(async signal => { await adapter.resetPassword(email, signal); if (!signal.aborted) setNotice('사용 가능한 계정이면 재설정 안내가 발송돼요. 이메일을 확인해 주세요.'); });
  };
  const title = view === 'delete' ? '회원 탈퇴' : member ? '내 계정' : view === 'signup' ? '회원가입 · 약관 동의' : view === 'signup-details' ? '회원가입 · 정보 입력' : view === 'consent' ? '가입 약관 확인' : view === 'verify' ? '이메일 인증' : view === 'reset' ? '비밀번호 찾기' : '로그인';
  return <BottomSheet title={title} onClose={onClose}><div className="account-form">
    {reason && !member && <p className="account-notice">{reason} 로그인 후 돌아와서 직접 완료해 주세요.</p>}
    {!connected && <p className="account-notice" role="status">인증 연결 전이에요. 화면을 확인할 수 있지만 실제 가입·이메일 발송·로그인은 아직 사용할 수 없어요.</p>}
    {reviewAccount && <div className="account-review-notice"><div className="account-review-heading"><strong>로컬 검수 계정</strong>{!member && view === 'login' && <Button variant="ghost" size="compact" disabled={busy} onClick={() => { setEmail(reviewAccount.email); setPassword(reviewAccount.password); setError(''); }}>검수 계정 채우기</Button>}</div><p>실제 서비스 회원과 별도의 검수용 로그인이에요.</p></div>}
    {notice && <p className="account-notice" role="status">{notice}</p>}
    {busy && !member && <p role="status">계정을 확인하고 있어요.</p>}
    {member && view !== 'delete' ? <>
      <div className="account-identity"><UserRound size={24} aria-hidden="true" /><div><strong>{member.displayName}</strong><p>{providerName(member.provider)} 계정 · {member.email ?? '이메일 미제공'}</p></div></div>
      <Button onClick={onClose}>하던 작업으로 돌아가기</Button>
      <Button variant="secondary" loading={busy} onClick={() => void run(async signal => { await adapter.signOut(signal); if (!signal.aborted) { updateSession({ state: 'GUEST' }); changeView('login'); setNotice('로그아웃했어요. 이 기기의 여행은 유지돼요.'); } })}><LogOut size={16} />로그아웃</Button>
      {!reviewAccount && <Button variant="ghost" size="compact" disabled={busy} onClick={() => { setConfirmDelete(false); setView('delete'); }}><Trash2 size={16} />회원 탈퇴</Button>}
    </> : view === 'delete' ? <>
      <Button variant="ghost" size="compact" disabled={busy} onClick={() => changeView('login')}><ArrowLeft size={16} />내 계정</Button>
      <p>계정과 서버의 회원 자료를 삭제해요. 이 기기의 기록과 다른 사람이 작성한 자료는 별도로 처리해요.</p>
      <label className="account-check"><input type="checkbox" checked={confirmDelete} onChange={e => setConfirmDelete(e.target.checked)} disabled={busy} /><span>삭제 내용을 확인했고 탈퇴할게요.</span></label>
      <Button variant="danger" disabled={!confirmDelete} loading={busy} onClick={() => void run(async signal => { await adapter.removeAccount(signal); if (!signal.aborted) { updateSession({ state: 'GUEST' }); changeView('login'); setConfirmDelete(false); setChoices(emptySignupChoices()); setNotice('탈퇴가 완료됐어요.'); } })}>탈퇴하기</Button>
    </> : <>
      {view === 'signup-details' ? <Button variant="ghost" size="compact" disabled={busy} onClick={() => { setView('signup'); setError(''); setNotice(''); }}><ArrowLeft size={16} />약관 다시 확인</Button> : view !== 'login' && <Button variant="ghost" size="compact" disabled={busy} onClick={() => changeView('login')}><ArrowLeft size={16} />로그인으로</Button>}
      {(view === 'signup' || view === 'signup-details') && <ol className="account-signup-steps" aria-label="회원가입 단계"><li aria-current={view === 'signup' ? 'step' : undefined}>1. 약관 동의</li><li aria-current={view === 'signup-details' ? 'step' : undefined}>2. 정보 · 이메일 인증</li></ol>}
      {view === 'login' && <>
        <div className="account-welcome"><strong>{reviewAccount ? '로그인하고 화면을 확인하세요' : '여행을 내 계정에 이어서'}</strong><p>{reviewAccount ? '미리 입력된 이메일로 바로 로그인할 수 있어요.' : '이메일로 로그인하거나 Google·Apple 계정을 사용하세요.'}</p></div>
        <form className="account-email-form" onSubmit={submitEmail}>
          <Field label="이메일"><input type="email" autoComplete="username" value={email} maxLength={254} onChange={e => setEmail(e.target.value)} disabled={busy} required /></Field>
          <Field label="비밀번호"><input type="password" autoComplete="current-password" value={password} maxLength={128} onChange={e => setPassword(e.target.value)} disabled={busy} required /></Field>
          <Button type="submit" disabled={!connected || !validEmail(email) || !password} loading={busy}>이메일로 로그인</Button>
        </form>
        <div className="account-inline-actions"><Button variant="ghost" size="compact" disabled={busy} onClick={() => changeView('signup')}>이메일 회원가입</Button><Button variant="ghost" size="compact" disabled={busy} onClick={() => changeView('reset')}>비밀번호 찾기</Button></div>
        <div className="account-divider"><span>또는 간편 로그인</span></div>
        <div className="social-login-buttons"><Button variant="secondary" className="social-login-google" disabled={busy} onClick={() => begin('GOOGLE')}>Google로 로그인</Button><Button className="social-login-apple" disabled={busy} onClick={() => begin('APPLE')}>Apple로 로그인</Button></div>
        {socialNotice && <p className="account-social-notice" role="status">{socialNotice}</p>}
        {isNativeShell() && <p className="signup-short-note">앱의 간편 로그인은 시스템 브라우저 인증 연결 후 제공해요.</p>}
        <div className="account-policy-links"><PolicyLink id="terms" bundle={bundle} label="이용약관" /><PolicyLink id="privacy" bundle={bundle} label="개인정보 처리방침" /></div>
        <Button variant="ghost" size="compact" disabled={busy} onClick={onClose}>둘러보기 계속</Button>
      </>}
      {(view === 'signup' || view === 'consent') && <>
        {view === 'consent' && <div className="signup-provider-summary"><ShieldCheck size={20} aria-hidden="true" /><div><strong>{providerName(selected)}로 가입</strong><p>처음 가입할 때만 필수 약관을 확인해요.</p></div></div>}
        {bundle.status === 'DRAFT' && <p className="account-notice">약관 검수 초안이에요. 운영자 정보와 정식 약관이 준비되면 가입할 수 있어요. 지금 체크는 실제 동의로 저장되지 않아요.</p>}
        <div className="account-email-form">
          <Button variant="secondary" disabled={busy} onClick={() => { clearVerification(); setChoices({ terms: true, collection: true, age: true, marketing: false }); }}>필수 항목만 동의</Button>
          <div className="signup-consent-list">
            <ConsentRow name="age" label={'[필수] 만 ' + bundle.minimumAge + '세 이상이에요'} checked={choices.age} onChange={v => agree('age', v)} bundle={bundle} disabled={busy} />
            <ConsentRow name="terms" label="[필수] 서비스 이용약관 동의" checked={choices.terms} onChange={v => agree('terms', v)} policy="terms" bundle={bundle} disabled={busy} />
            <ConsentRow name="collection" label="[필수] 개인정보 수집·이용 동의" checked={choices.collection} onChange={v => agree('collection', v)} policy="collection" bundle={bundle} disabled={busy} />
            <ConsentRow name="marketing" label="[선택] 이메일로 혜택·소식 받기" checked={choices.marketing} onChange={v => agree('marketing', v)} policy="marketing" bundle={bundle} disabled={busy} />
          </div>
          <div className="signup-policy-notice"><p>보관·삭제와 외부 연결 범위도 확인해 주세요.</p><PolicyLink id="privacy" bundle={bundle} /></div>
          <section className="privacy-summary"><MapPin size={20} aria-hidden="true" /><div><h3>위치는 필요할 때 선택</h3><p>내 위치 주변 찾기를 사용할 때 별도로 동의해요. 위치·소식 수신에 동의하지 않아도 가입할 수 있어요.</p><PolicyLink id="location" bundle={bundle} label="위치 이용 안내" /></div></section>
          <div className="account-submit">{view === 'signup' ? <Button disabled={!requiredSignupAccepted(choices) || busy} onClick={() => { setView('signup-details'); setError(''); setNotice(''); }}>동의하고 다음</Button> : <Button disabled={!signupReady} loading={busy} onClick={() => void run(async signal => { const user = await adapter.completeSignup(bundle, choices, signal); if (!signal.aborted) signedIn(user); })}>동의하고 가입하기</Button>}</div>
        </div>
      </>}
      {view === 'signup-details' && <>
        <p className="signup-short-note">휴대폰 번호 없이 이메일로 인증해요. 입력부터 인증까지 이 화면에서 완료할 수 있어요.</p>
        <form className="account-email-form" onSubmit={submitEmail}>
          <Field label="활동 이름"><input autoComplete="nickname" value={name} maxLength={40} onChange={e => setName(e.target.value)} disabled={busy || Boolean(verificationEmail)} required placeholder="여행기에서 사용할 이름" /></Field>
          <Field label="이메일"><input type="email" autoComplete="email" value={email} maxLength={254} onChange={e => setEmail(e.target.value)} disabled={busy || Boolean(verificationEmail)} required /></Field>
          <Field label="비밀번호" hint="10~128자. 다른 서비스에서 쓰는 비밀번호는 피해주세요."><input type="password" autoComplete="new-password" value={password} minLength={10} maxLength={128} onChange={e => setPassword(e.target.value)} disabled={busy || Boolean(verificationEmail)} required /></Field>
          <Field label="비밀번호 확인"><input type="password" autoComplete="new-password" value={confirmation} maxLength={128} onChange={e => setConfirmation(e.target.value)} disabled={busy || Boolean(verificationEmail)} required aria-invalid={Boolean(confirmation && password !== confirmation)} /></Field>
          {confirmation && password !== confirmation && <p className="ui-error">비밀번호가 서로 달라요.</p>}
          <section className="account-email-verification" aria-labelledby="signup-verification-title">
            <div className="account-verification-heading"><h3 id="signup-verification-title">이메일 인증</h3><Button variant="secondary" size="compact" disabled={busy || (!verificationEmail && !signupReady)} onClick={() => verificationEmail ? void run(async signal => { await adapter.resendVerification(verificationEmail, signal); if (!signal.aborted) { setCode(''); setNotice('이메일로 인증번호를 다시 보냈어요. 최신 번호를 확인하세요.'); codeInput.current?.focus(); } }) : requestSignupCode()}>{verificationEmail ? '인증번호 다시 받기' : '인증번호 받기'}</Button></div>
            {verificationEmail ? <p><strong>{verificationEmail}</strong>로 보낸 번호를 입력해 주세요.</p> : <p>위 정보를 입력한 뒤 인증번호를 받아주세요.</p>}
            <Field label="이메일 인증번호"><input ref={codeInput} inputMode="numeric" autoComplete="one-time-code" value={code} pattern="[0-9]{6}" maxLength={6} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} disabled={busy || !verificationEmail} required placeholder="메일로 받은 6자리 번호" /></Field>
            {verificationEmail && <Button variant="ghost" size="compact" disabled={busy} onClick={() => { clearVerification(); setError(''); setNotice('가입 정보를 바꾸고 인증번호를 다시 받아주세요.'); }}>이메일 · 가입 정보 수정</Button>}
          </section>
          <div className="account-submit"><Button type="submit" disabled={!verificationEmail || !signupReady || !/^\d{6}$/.test(code)} loading={busy}>인증하고 가입하기</Button></div>
        </form>
      </>}
      {view === 'verify' && <form className="account-email-form" onSubmit={submitEmail}>
        <p><strong>{email}</strong>로 받은 6자리 인증번호를 입력하세요.</p>
        <Field label="이메일 인증번호"><input ref={codeInput} inputMode="numeric" autoComplete="one-time-code" value={code} pattern="[0-9]{6}" maxLength={6} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} disabled={busy} required /></Field>
        <Button type="submit" disabled={!connected || !validEmail(email) || !/^\d{6}$/.test(code)} loading={busy}>인증하고 시작하기</Button>
        <Button variant="secondary" disabled={!connected || busy} onClick={() => void run(async signal => { await adapter.resendVerification(email, signal); if (!signal.aborted) setNotice('인증번호를 다시 보냈어요. 최신 번호를 확인하세요.'); })}>인증번호 다시 받기</Button>
        <Button variant="ghost" size="compact" disabled={busy} onClick={() => changeView('signup')}>이메일 변경 · 가입 정보 다시 입력</Button>
      </form>}
      {view === 'reset' && <form className="account-email-form" onSubmit={submitEmail}>
        <p>가입한 이메일로 비밀번호 재설정 안내를 받아요.</p>
        <Field label="이메일"><input type="email" autoComplete="email" value={email} maxLength={254} onChange={e => setEmail(e.target.value)} disabled={busy} required /></Field>
        <Button type="submit" disabled={!connected || !validEmail(email)} loading={busy}>재설정 안내 받기</Button>
      </form>}
    </>}
    {error && <div className="account-error"><p className="ui-error" role="alert">{error}</p>{connected && <Button variant="secondary" size="compact" disabled={busy} onClick={() => void run(load)}>계정 다시 확인</Button>}</div>}
  </div></BottomSheet>;
}
