import { useEffect,useRef,useState } from 'react';
import { ArrowLeft,LogIn,LogOut,Mail,UserRound,Trash2 } from 'lucide-react';
import { BottomSheet } from './BottomSheet';
import { Button,Field } from './ui';
import { useLocale } from './locale';
import { createAccountAdapter,type AccountAdapter,type AccountUser } from './accountService';
import { safeExternalUrl,ServiceError } from './serviceRequest';
import './frontend-completion.css';
const accountAdapter=createAccountAdapter(import.meta.env.VITE_ACCOUNT_ENDPOINT??'',{termsUrl:import.meta.env.VITE_TERMS_URL,privacyUrl:import.meta.env.VITE_PRIVACY_URL});
type View='signin'|'signup'|'reset'|'account'|'delete';
export function AccountSheet({onClose,adapter=accountAdapter,onSignedIn}:{onClose:()=>void;adapter?:AccountAdapter;onSignedIn?:(user:AccountUser)=>void}) {
  const {locale}=useLocale(),en=locale==='en';
  const [view,setView]=useState<View>('signin'),[user,setUser]=useState<AccountUser|null>(null),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[accepted,setAccepted]=useState(false),[confirmDelete,setConfirmDelete]=useState(false),[busy,setBusy]=useState(adapter.configured),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const pending=useRef<AbortController|null>(null),version=useRef(0),locked=useRef(false);
  useEffect(()=>{const c=new AbortController();pending.current=c;const v=++version.current;
    void adapter.session(c.signal).then(value=>{if(c.signal.aborted||v!==version.current)return;setUser(value);setView(value?'account':'signin');}).catch(()=>{if(!c.signal.aborted)setError(en?'Could not check your account. Try again.':'계정을 확인하지 못했어요. 다시 시도해 주세요.');}).finally(()=>{if(!c.signal.aborted&&v===version.current)setBusy(false);});
    return()=>{version.current++;c.abort();pending.current?.abort();};
  },[adapter]);
  const change=(next:View)=>{version.current++;pending.current?.abort();setView(next);setPassword('');setError('');setNotice('');setAccepted(false);setConfirmDelete(false);setBusy(false);locked.current=false;};
  const run=async(action:()=>Promise<void>)=>{if(locked.current)return;locked.current=true;setBusy(true);setError('');const v=++version.current;pending.current?.abort();pending.current=new AbortController();
    try{await action();}catch(e){if(v!==version.current||pending.current.signal.aborted)return;if(e instanceof ServiceError&&e.status===401){setUser(null);setView('signin');setPassword('');setError(en?'Check your sign-in details, or sign in again. Your trip draft is kept.':'로그인 정보를 확인하거나 다시 로그인해 주세요. 작성하던 여행은 유지돼요.');}else setError(e instanceof ServiceError&&e.status===429?(en?'Please try again shortly.':'잠시 후 다시 시도해 주세요.'):(en?'The request could not be completed. Please try again.':'요청을 완료하지 못했어요. 다시 시도해 주세요.'));}
    finally{if(v===version.current){setBusy(false);locked.current=false;}}
  };
  const signal=()=>pending.current!.signal;
  const validEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const terms=safeExternalUrl(adapter.termsUrl),privacy=safeExternalUrl(adapter.privacyUrl);
  const title=view==='signup'?(en?'Create account':'회원가입'):view==='reset'?(en?'Reset password':'비밀번호 재설정'):view==='delete'?(en?'Delete account':'회원 탈퇴'):user?(en?'My account':'내 계정'):(en?'Sign in':'로그인');
  const submit=()=>{if(!adapter.configured||!validEmail||(view!=='reset'&&!password)||(view==='signup'&&(!name.trim()||password.length<8||!accepted||!terms||!privacy)))return;void run(async()=>{
    const requestSignal=signal();
    if(view==='signin'){const account=await adapter.signIn(email.trim(),password,requestSignal);if(requestSignal.aborted)return;setUser(account);setPassword('');setView('account');setNotice(en?'Signed in. Continue where you left off.':'로그인했어요. 하던 작업을 이어갈 수 있어요.');onSignedIn?.(account);}
    else if(view==='signup'){await adapter.signUp({email:email.trim(),password,displayName:name.trim(),acceptedTerms:true},requestSignal);if(requestSignal.aborted)return;setPassword('');setView('signin');setNotice(en?'Check your email to finish registration, then sign in.':'이메일에서 가입 확인 후 로그인해 주세요.');}
    else{await adapter.resetPassword(email.trim(),requestSignal);if(!requestSignal.aborted)setNotice(en?'If this email is registered, a reset link will be sent.':'등록된 이메일이면 비밀번호 재설정 안내를 보내드려요.');}
  });};
  return <BottomSheet title={title} onClose={onClose}><div className="account-form">
    {!adapter.configured&&<p className="account-notice" role="status">{en?'Account connection is not available yet. You can keep using the trips on this device.':'계정 연결 전이에요. 이 기기의 여행은 계속 이용할 수 있어요.'}</p>}
    {notice&&<p className="account-notice" role="status">{notice}</p>}
    {view==='account'&&user?<><div className="account-identity"><UserRound size={24}/><div><strong>{user.displayName}</strong><p>{user.email}</p></div></div><Button onClick={onClose}>{en?'Continue':'하던 작업으로 돌아가기'}</Button><Button variant="secondary" loading={busy} onClick={()=>void run(async()=>{const s=signal();await adapter.signOut(s);if(!s.aborted){setUser(null);setView('signin');setNotice(en?'Signed out. Trips on this device are kept.':'로그아웃했어요. 이 기기의 여행은 유지돼요.');}})}><LogOut size={16}/>{en?'Sign out':'로그아웃'}</Button><Button size="compact" variant="ghost" disabled={busy} onClick={()=>change('delete')}><Trash2 size={14}/>{en?'Delete account':'회원 탈퇴'}</Button></>:view==='delete'?<><button className="plan-back" disabled={busy} onClick={()=>change('account')}><ArrowLeft size={16}/>{en?'My account':'내 계정'}</button><p>{en?'Your account and its server data will be deleted. This cannot be undone. Trips saved only on this device are not deleted by this action.':'계정과 서버에 보관된 계정 자료를 삭제하며 되돌릴 수 없어요. 이 기기에만 저장된 여행을 지우는 기능은 아니에요.'}</p><label className="account-check"><input type="checkbox" checked={confirmDelete} onChange={e=>setConfirmDelete(e.target.checked)}/>{en?'I understand and want to delete my account.':'삭제 내용을 확인했고 탈퇴할게요.'}</label><Button variant="danger" disabled={!confirmDelete} loading={busy} onClick={()=>void run(async()=>{const s=signal();await adapter.removeAccount(s);if(!s.aborted){setUser(null);setView('signin');setConfirmDelete(false);setNotice(en?'Your account has been deleted.':'탈퇴가 완료됐어요.');}})}>{en?'Delete my account':'탈퇴하기'}</Button></>:<>
    {view!=='signin'&&<button className="plan-back" onClick={()=>change('signin')}><ArrowLeft size={16}/>{en?'Back to sign in':'로그인으로 돌아가기'}</button>}
    <form onSubmit={e=>{e.preventDefault();submit();}} className="account-fields">
      {view==='signup'&&<Field label={en?'Display name':'활동 이름'}><input value={name} onChange={e=>setName(e.target.value)} maxLength={30} autoComplete="nickname" required/></Field>}
      <Field label={en?'Email':'이메일'}><input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} maxLength={254} required/></Field>
      {view!=='reset'&&<Field label={en?'Password':'비밀번호'} hint={view==='signup'?(en?'Use at least 8 characters.':'8자 이상 입력해 주세요.'):undefined}><input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={view==='signup'?'new-password':'current-password'} minLength={view==='signup'?8:1} maxLength={128} required/></Field>}
      {view==='signup'&&<>{terms&&privacy?<label className="account-check"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/><span><a href={terms} target="_blank" rel="noopener noreferrer">{en?'Terms':'이용약관'}</a> · <a href={privacy} target="_blank" rel="noopener noreferrer">{en?'Privacy policy':'개인정보 처리방침'}</a>{en?' — I agree.':'에 동의해요.'}</span></label>:<p className="plan-help">{en?'Registration opens after the service policies are available.':'서비스 약관이 준비되면 가입할 수 있어요.'}</p>}</>}
      <Button type="submit" loading={busy} disabled={!adapter.configured||!validEmail||(view!=='reset'&&!password)||(view==='signup'&&(!name.trim()||password.length<8||!accepted||!terms||!privacy))}>{view==='reset'?<Mail size={16}/>:<LogIn size={16}/>} {view==='reset'?(en?'Send reset link':'재설정 안내 받기'):view==='signup'?(en?'Create account':'가입하기'):(en?'Sign in':'로그인')}</Button>
    </form>
    {view==='signin'&&<div className="account-links"><Button size="compact" variant="ghost" disabled={busy} onClick={()=>change('signup')}>{en?'Create account':'회원가입'}</Button><Button size="compact" variant="ghost" disabled={busy} onClick={()=>change('reset')}>{en?'Forgot password?':'비밀번호 찾기'}</Button></div>}
    </>}{error&&<p className="ui-error" role="alert">{error}</p>}
  </div></BottomSheet>;
}
