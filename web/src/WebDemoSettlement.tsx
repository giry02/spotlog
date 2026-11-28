import { useState } from 'react';
import SettlementPanel from './SettlementPanel';
import { isSettlementLedger, type SettlementLedger, type SettlementMember } from './settlementModel';
import { buildSettlementReviewDemo } from './settlementReviewDemo';
import './web-demo-settlement.css';

const presenter = { id: 'spotlog-local-review-member', name: '검수 여행자' };
const participants: readonly SettlementMember[] = [presenter, { id: 'example-parent', name: '엄마' }];
const tripDate = '2026-11-11';

export default function WebDemoSettlement() {
  const [session, setSession] = useState(() => ({ run: 0, ledger: buildSettlementReviewDemo(participants, tripDate) }));

  function reset() {
    setSession(current => ({ run: current.run + 1, ledger: buildSettlementReviewDemo(participants, tripDate) }));
  }

  function save(ledger: SettlementLedger) {
    if (!isSettlementLedger(ledger)) return false;
    setSession(current => ({ ...current, ledger }));
    return true;
  }

  return <section className="web-demo-settlement" aria-label="영수증 정산 시연">
    <div className="web-demo-settlement__intro">
      <p>지출 등록에서 시연 영수증을 불러오세요. 사진은 이 브라우저에서 읽고, 시연 장부는 이 화면을 열어 둔 동안 유지돼요.</p>
      <button type="button" onClick={reset}>처음부터 다시 시연</button>
    </div>
    <SettlementPanel key={session.run} ledger={session.ledger} scopeTitle="지난 주말 바다 나들이"
      roster={participants} preferredPayerId={presenter.id} demoReceipt canEdit onSave={save}/>
  </section>;
}
