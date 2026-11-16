import { useEffect, useState } from 'react';
import { ArrowLeft, Info } from 'lucide-react';
import { ScreenHeader } from '../ScreenHeader';
import { VisitGuideGuest } from './VisitGuidePanel';
import { createVisitGuidePublicStore, visitGuidePublicStorageKey } from './visitGuideStorage';
import type { VisitGuidePublication } from './visitGuideTypes';

/** Read only the explicitly published limited cache; no account/member repository is searched. */
export default function VisitGuideLink({ token, onBack }: { token: string; onBack: () => void }) {
  const read = (): { token: string; publication?: VisitGuidePublication } => {
    try { return { token, publication: createVisitGuidePublicStore(window.localStorage).read(token) }; }
    catch { return { token }; }
  };
  const [result, setResult] = useState(read);
  useEffect(() => {
    const refresh = () => setResult(read());
    const storage = (event: StorageEvent) => { if (!event.key || event.key === visitGuidePublicStorageKey) refresh(); };
    refresh();
    window.addEventListener('focus', refresh); window.addEventListener('storage', storage);
    const timer = window.setInterval(refresh, 30_000);
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('storage', storage); window.clearInterval(timer); };
  }, [token]);
  const publication = result.token === token ? result.publication : undefined;
  return <><ScreenHeader title="공유받은 방문 안내" variant="detail" leading={<button type="button" aria-label="홈으로" onClick={onBack}><ArrowLeft size={20}/></button>}/><div className="tg-pad">{publication ? <VisitGuideGuest publication={publication}/> : <section className="visit-guide"><div className="vg-local-note"><Info size={20}/><p>이 안내를 열 수 없어요. 이 브라우저에 저장되지 않았거나, 공유가 중단·만료되었을 수 있어요.</p></div><p className="vg-muted">현재 링크는 발급한 브라우저의 로컬 검수용입니다. 다른 기기의 열람과 최신 권한 확인에는 서버 연결이 필요해요.</p><button type="button" className="vg-primary" onClick={onBack}>홈으로</button></section>}</div></>;
}
