import { MapPin, ShieldCheck } from 'lucide-react';
import { BottomSheet } from './BottomSheet';
import { PolicyLink } from './PolicyDocumentView';
import { draftPolicies, type PolicyId } from './accountPolicies';
import './account-privacy.css';
import { useEffect, useState } from 'react';
import { useAccount } from './accountContext';
import { Button } from './ui';
import { LocationConsentPanel } from './LocationConsentPanel';

export function PrivacySheet({ onClose }: { onClose: () => void }) {
  const account = useAccount();
  const [bundle, setBundle] = useState(draftPolicies), [error, setError] = useState('');
  useEffect(() => { const c = new AbortController(); if (account?.adapter.configured) void account.adapter.policies(c.signal).then(next => { if (!c.signal.aborted) setBundle(next); }).catch(() => { if (!c.signal.aborted) setError('현재 약관을 가져오지 못했어요. 아래 문서는 검수 초안이에요.'); }); return () => c.abort(); }, [account?.adapter]);
  const [locationPreview, setLocationPreview] = useState(false);
  const ids: PolicyId[] = ['terms', 'privacy', 'collection', 'location', 'marketing'];
  return <BottomSheet title={locationPreview ? '내 위치 이용 안내' : '약관 · 개인정보'} onClose={onClose}>{locationPreview ? <LocationConsentPanel bundle={bundle} onBack={() => setLocationPreview(false)} /> : <div className="account-form">
    {bundle.status === 'DRAFT' && <p className="account-notice" role="status">검수 초안이에요. 운영자 정보는 미정이며, 실제 동의 이력 저장과 위치 기능은 연결 전입니다.</p>}
    {error && <p className="ui-error" role="alert">{error}</p>}
    <section className="privacy-summary"><ShieldCheck size={20} aria-hidden="true" /><div><h3>가입에 필요한 정보만</h3><p>로그인 계정 식별값·활동 이름·제공된 이메일을 기준으로 준비해요. 실명·전화번호·집 주소를 요구하지 않아요.</p></div></section>
    <div className="policy-list">{ids.map(id => <div key={id}><strong>{bundle.documents.find(d => d.id === id)!.title}</strong><PolicyLink id={id} bundle={bundle} /></div>)}</div>
    <section className="privacy-summary"><MapPin size={20} aria-hidden="true" /><div><h3>내 위치 주변 찾기 · 향후 기능</h3><p>가입할 때 GPS를 요구하지 않아요. 내 위치로 찾기를 선택한 때 위치 이용 동의와 기기 권한을 확인해요.</p><p>동의하지 않아도 지역을 직접 선택할 수 있어요. 지속 추적·백그라운드 수집은 초기 범위에 포함하지 않아요.</p></div></section>
    <Button variant="secondary" onClick={() => setLocationPreview(true)}>내 위치 동의 화면 보기</Button>
  </div>}</BottomSheet>;
}
