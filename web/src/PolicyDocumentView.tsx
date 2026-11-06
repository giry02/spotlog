import { useBottomSheetDetail } from './BottomSheet';
import { ChevronRight } from 'lucide-react';
import { draftPolicies, policyDocument, type PolicyBundle, type PolicyId } from './accountPolicies';
import './account-privacy.css';

export function PolicyDocumentView({ id, bundle = draftPolicies }: { id: PolicyId; bundle?: PolicyBundle }) {
  const doc = policyDocument(bundle, id);
  return <article className="policy-document">
    <div className="policy-meta"><span>{bundle.status === 'DRAFT' ? '검수 초안 · 시행 전' : '공개 약관'}</span><span>버전 {doc.version}</span></div>
    {doc.sections.map(section => <section className="policy-section" key={section.heading}><h3>{section.heading}</h3>{section.paragraphs.map(p => <p key={p}>{p}</p>)}{section.points && <ul>{section.points.map(p => <li key={p}>{p}</li>)}</ul>}</section>)}
    <section className="policy-section"><h3>운영자 정보</h3><dl><div><dt>운영자</dt><dd>{bundle.operator.name}</dd></div><div><dt>주소</dt><dd>{bundle.operator.address}</dd></div><div><dt>문의 이메일</dt><dd>{bundle.operator.email}</dd></div></dl></section>
  </article>;
}
export function PolicyLink({ id, bundle = draftPolicies, label = '보기' }: { id: PolicyId; bundle?: PolicyBundle; label?: string }) {
  const detail = useBottomSheetDetail();
  return <button type="button" className="policy-link" aria-label={`${policyDocument(bundle, id).title} ${label}`} onClick={() => detail?.({ title: policyDocument(bundle, id).title, children: <PolicyDocumentView id={id} bundle={bundle} /> })}>{label}<ChevronRight size={14} aria-hidden="true" /></button>;
}
