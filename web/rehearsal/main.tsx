import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowLeft } from 'lucide-react';
import '../src/styles.css';
import './rehearsal.css';

const Places = lazy(() => import('../src/WebDemoPlaces'));
const Settlement = lazy(() => import('../src/WebDemoSettlement'));

const screens = {
  reviews: { tab: '후기', title: '방문 후기와 답글' },
  ads: { tab: '광고', title: '추천 순위와 업체 광고' },
  settlement: { tab: '영수증·정산', title: '영수증으로 비용 정산' },
};
type Scene = keyof typeof screens;

function sceneFromHash(): Scene {
  const hash = window.location.hash.slice(1);
  return Object.hasOwn(screens, hash) ? hash as Scene : 'reviews';
}

function Rehearsal() {
  const [scene, setScene] = useState(sceneFromHash);
  const content = useRef<HTMLElement>(null);

  useEffect(() => {
    const navigate = () => {
      setScene(sceneFromHash());
      content.current?.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);

  return <div className="app-shell web-rehearsal">
    <header className="web-rehearsal__header">
      <a href="../reports/spotinmoim-demo-20261125/#run"><ArrowLeft size={19} aria-hidden="true"/>시연 자료</a>
      <p>스팟인모임</p>
    </header>
    <nav className="web-rehearsal__tabs" aria-label="시연 화면">
      {(Object.keys(screens) as Scene[]).map(key =>
        <a key={key} href={'#' + key} aria-current={scene === key ? 'page' : undefined}>{screens[key].tab}</a>
      )}
    </nav>
    <main className="content web-rehearsal__content" ref={content}>
      <h1>{screens[scene].title}</h1>
      <Suspense fallback={<p role="status">시연 화면을 불러오는 중…</p>}>
        {scene === 'settlement' ? <Settlement/> : <Places key={scene} scene={scene}/>}
      </Suspense>
    </main>
  </div>;
}

createRoot(document.getElementById('root')!).render(<Rehearsal/>);
