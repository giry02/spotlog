import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { screenGroups, buttonRoles, cardRoles, typeRoles, typographyRules } from './styleGuideCatalog';
import './style-guide-page.css';

/** Dev-only documentation. Captures contain isolated test data, not live user records. */
export function StyleGuide({ onBack }: { onBack: () => void }) {
  const goTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'auto', block: 'start' });
  return <article className="site-design-guide">
    <header className="sg-toolbar">
      <button type="button" onClick={onBack} aria-label="이전 화면으로"><ArrowLeft size={18} /></button>
      <strong>spotlog <span>DESIGN REFERENCE</span></strong>
      <small>현재 전 화면 기준 · 로컬 전용</small>
    </header>
    <div className="sg-inner">
      <section className="sg-intro">
        <p className="sg-eyebrow">EXISTING SCREENS → SHARED RULES</p>
        <h1>지금의 Spotlog를<br />다음 화면의 기준으로.</h1>
        <p>홈부터 상세·편집·팝업까지, 현재 화면의 모양과 역할을 함께 기록했습니다. 저장 화면 하나를 기준으로 삼거나 모든 버튼을 같은 크기로 바꾸지 않습니다.</p>
        <div className="sg-boundary"><strong>기존 디자인을 보존하며 글자 역할 기준을 명확히 했습니다.</strong><span>2026.09.13 작성자 목록·통계의 글자만 보완했습니다. 아래 캡처는 이전 기준일의 화면 기록이며 최신 글자 값은 규격표를 따릅니다.</span></div>
      </section>
      <nav className="sg-index" aria-label="디자인 가이드 목차">
        {[['sg-foundation', '공통 기준'], ['sg-screens', '전체 화면'], ['sg-components', '부품별 기준'], ['sg-process', '추가 작업 원칙']].map(([id, label], index) => <button key={id} onClick={() => goTo(id)}><span>0{index + 1}</span>{label}</button>)}
      </nav>
      <section className="sg-section" id="sg-foundation">
        <div className="sg-section-heading"><div><p className="sg-eyebrow">01 · FOUNDATION</p><h2>전 화면이 공유하는 기준</h2></div><p>새 수치를 정한 것이 아니라, 기존 화면에서 반복되는 값을 추출했습니다.</p></div>
        <div className="sg-rule-grid">
          <section><h3>밝은 화면 + 사진 중심</h3><p>미색 배경, 흰색 내용 카드, 짙은 검정의 핵심 행동. 코랄은 포인트·저장 상태에 사용합니다. 영상과 사진 피드는 전체 화면 위에 글과 버튼을 겹칩니다.</p></section>
          <section><h3>같은 역할, 같은 형태</h3><p>일반 목록·긴 여행기·편집 도구의 글자 크기를 구분합니다. 같은 장소라도 발견 카드, 여행기 안의 카드, 저장 목록 카드는 서로 다른 구성입니다.</p></section>
          <section><h3>현재 화면이 우선</h3><p>승인된 화면 → 최종 적용 CSS → 가이드 → 공통 부품 순서로 판단합니다. 가이드나 부품 기본값이 다르면 화면 대신 가이드를 정정합니다.</p></section>
        </div>
        <div className="sg-colors">{[['주요 글자·핵심 버튼', '#171716'], ['화면 배경', '#f8f8f6'], ['카드 바탕', '#ffffff'], ['보조 글자', '#777773'], ['구분선', '#e9e9e5'], ['포인트', '#ff5a3d']].map(([label, color]) => <div key={color}><i style={{ background: color }} /><strong>{label}</strong><code>{color}</code></div>)}</div>
        <h3 className="sg-subtitle" id="sg-typography">글자 — 역할별 적용 규칙 · 2026.09.13</h3>
        <p className="sg-caption">제목: Manrope 선언 · 본문: DM Sans, Pretendard 및 시스템 대체 서체. 한글은 실제 기기에 설치된 지원 서체로 표시될 수 있습니다. 임의의 새 글꼴을 추가하지 않습니다.</p>
        <div className="sg-callout"><strong>새 작업에 적용할 기준</strong><ul>{typographyRules.map(rule => <li key={rule}>{rule}</li>)}</ul></div>
        <SpecTable headings={['역할', '현재 규격', '사용 위치']} rows={typeRoles} />
        <p className="sg-caption">작성자 소개10px·목록 개수9px·댓글 날짜9px·일부 알림8~9px는 기존 잔여 항목입니다. 권장값이 아니며 이번에 일괄 변경하지 않았습니다. 자동 검사: node --test web/tests/typography.test.cjs</p>
        <div className="sg-rule-grid sg-two">
          <section><h3>레이아웃·여백</h3><ul><li>서비스 화면 최대 너비 460px, 최소 320px, 넓은 화면 중앙 배치.</li><li>일반 목록 좌우 18px. 여행기 소개와 팝업은 20px.</li><li>홈 섹션 간 30px, 일반 카드 목록 14~15px, 저장 묶음 12px.</li><li>카드 안쪽: 홈 가로 카드 10px, 저장 카드 14px, 큰 카드 16px.</li><li>영상·사진·여행기 표지에는 일반 목록의 바깥 여백을 넣지 않음.</li></ul></section>
          <section><h3>이동·상태</h3><ul><li>기본 메뉴: 홈·여행기·장소·내 여행·저장. 프로필은 별도 진입.</li><li>상세 뒤로가기는 상단과 고정 DAY줄 안에 존재. 고정 제목줄을 더 늘리지 않음.</li><li>상세·편집 하단 행동은 고정. 마지막 내용까지 가려지지 않는 여백 유지.</li><li>코랄 북마크는 저장 여부, 녹색 DAY는 여행에 담긴 상태.</li><li>선택·미선택·처리 중·빈 목록·실패를 화면별로 확인.</li></ul></section>
        </div>
      </section>
      <section className="sg-section" id="sg-screens">
        <div className="sg-section-heading"><div><p className="sg-eyebrow">02 · SCREEN ATLAS</p><h2>전체 화면과 구성 기준</h2></div><p>탐색 → 저장 → 여행 → 작성·프로필까지. 빈 상태·스크롤·팝업도 포함합니다.</p></div>
        <nav className="sg-screen-index" aria-label="화면별 바로가기">{screenGroups.map(group => <button key={group.id} onClick={() => goTo(group.id)}>{group.title}</button>)}</nav>
        {screenGroups.map((group, index) => <section className="sg-screen-group" id={group.id} key={group.id}>
          <div className="sg-group-heading"><span>{String(index + 1).padStart(2, '0')}</span><div><h3>{group.title}</h3><p>{group.description}</p></div></div>
          <div className="sg-shots">{group.shots.map(shot => <figure key={shot.file}>
            <a href={import.meta.env.BASE_URL + 'design-guide/' + shot.file + '.png'} target="_blank" rel="noreferrer" aria-label={shot.title + ' 390px 원본 이미지 보기'}><img src={import.meta.env.BASE_URL + 'design-guide/' + shot.file + '.png'} width="390" height="900" alt={shot.title + ' — 현재 Spotlog 화면 캡처'} loading="lazy" /><span>원본 크기로 보기 <ArrowUpRight size={14} /></span></a>
            <figcaption><strong>{shot.title}</strong><p>{shot.note}</p></figcaption>
          </figure>)}</div>
          <div className="sg-group-rules"><strong>이 화면을 추가·수정할 때</strong><ul>{group.rules.map(rule => <li key={rule}>{rule}</li>)}</ul><p className="sg-source">원본: {group.source}</p></div>
        </section>)}
      </section>
      <section className="sg-section" id="sg-components">
        <div className="sg-section-heading"><div><p className="sg-eyebrow">03 · COMPONENT ROLES</p><h2>어떤 부품을 가져다 쓸 것인가</h2></div><p>수치가 조금 다르다고 평균 내지 않습니다. 사용 위치가 같은 부품부터 재사용합니다.</p></div>
        <h3 className="sg-subtitle">버튼·선택·아이콘</h3>
        <SpecTable headings={['기존 역할', '현재 규격', '쓰는 곳 / 유지할 차이']} rows={buttonRoles} />
        <h3 className="sg-subtitle">사진 카드·정보 카드</h3>
        <SpecTable headings={['기존 역할', '사진·모서리·안쪽', '글자·용도']} rows={cardRoles} />
        <h3 className="sg-subtitle">입력·팝업·피드백</h3>
        <SpecTable headings={['기존 역할', '현재 규격', '적용 원칙']} rows={[
          ['검색 입력', '최소 51px · R14 · 14px', '여행기·장소 탐색의 검색. 편집 입력과 구분.'],
          ['편집 일반 입력', '50px · R12 · 16px', '제목은 별도 25px·밑줄형. 본문은 16px/1.75.'],
          ['새 여행 팝업 입력', '라벨 12px · 입력 16px/50px/R12', '범용 Field 라벨 14px와 실제 사용 위치의 차이를 유지.'],
          ['현재 BottomSheet', '상단 R24 · 최대 88dvh · 좌우 20px', '제목 20px/1.4 · 설명 14px. 내부 스크롤·닫기·뒤로가기·포커스 처리 재사용.'],
          ['여행·DAY 담기 팝업', '기존 BottomSheet + LandmarkGuideCard + Field', '큰 사진 카드로 장소와 담김을 확인한 뒤 여행·DAY 선택. 해당 방문만 해제. 저장 화면의 작은 가로 카드는 유지.'],
          ['홈 AI 여행 팝업', '기존 BottomSheet · DAY별 LandmarkGuideCard', '사진·설명·출처를 보고 방문별 포함/제외 후 비공개 여행 확정. 빈 DAY와 실패한 초안 유지. 실제 AI 미연결 표시.'],
          ['팝업 닫기·오류', '기존 닫기 원형 44px · ui-error 13px/1.7', '닫기·Esc·배경·뒤로가기, 포커스 복귀. 내부 스크롤과 safe-area 유지. 저장 실패를 성공으로 처리하지 않음.'],
          ['장소 삽입 팝업', '외부 R24 · 최대 88dvh · 본문 좌우 20px', '직접 등록 / 목록에서 선택. 현재 BottomSheet 안에 삽입하며 내부 모서리·패딩은 0.'],
          ['토스트·저장 경고', '기존 .toast / .local-storage-warning', '성공은 짧게 알림. 실패에는 다시 시도할 행동 제공. 결과 없이 성공을 표시하지 않음.'],
          ['사진·파일 선택', '프로필 OS 파일 선택기 / 현재 FileUpload', '브라우저·OS 기본 창과 앱 내부 디자인을 구분. 없는 프로필 편집 팝업을 가정하지 않음.'],
        ]} />
        <div className="sg-callout"><strong>예: 새로운 음식점 카드를 넣는다면</strong><p>지역 안내 목록이라면 큰 사진의 장소 카드, 여행기 본문이라면 여행기 내부 장소 카드, 저장 목록이라면 작은 가로 저장 카드를 사용합니다. 음식점이라는 이유로 새로운 버튼·서체·카드를 만들지 않습니다.</p></div>
      </section>
      <section className="sg-section" id="sg-process">
        <div className="sg-section-heading"><div><p className="sg-eyebrow">04 · MAINTENANCE</p><h2>다음 작업에서도 지킬 기준</h2></div><p>가이드는 실제 화면을 따라 갱신하고, 제품 디자인 변경은 별도 요청으로 구분합니다.</p></div>
        <ol className="sg-workflow"><li><strong>사용 위치 확인</strong><span>새 기능이 어느 화면·카드·행동에 해당하는지 결정.</span></li><li><strong>가장 가까운 원본 재사용</strong><span>현재 클래스·컴포넌트의 최종 적용 수치 확인. 공통 부품 기본값으로 덮어쓰지 않음.</span></li><li><strong>상태와 작은 화면 확인</strong><span>320·390·460px, 긴 글, 빈 목록, 선택·해제, 하단 고정 영역을 확인.</span></li><li><strong>전후 비교 후 기록</strong><span>의도하지 않은 디자인 변화를 비교. 새 시각 유형은 별도 승인 후 추가.</span></li></ol>
        <div className="sg-rule-grid sg-two">
          <section><h3>확인한 범위</h3><p>홈·여행기 검색·지역 안내·영상·사진·저장·내 여행·공개/내 여행 상세·DAY·지도·댓글·작성자·편집·프로필·설정·팝업·빈 목록을 현재 코드와 분리된 테스트 데이터로 확인했습니다.</p><p>320/390/460px 실제 표시값을 기준으로 기록합니다. 이미지 속 여행·수치는 검수용 데이터이며 실제 사용자 성과가 아닙니다.</p></section>
          <section><h3>아직 바꾸지 않은 것</h3><p>상세에서 특정 섹션으로 바로 스크롤하면 고정 DAY줄에 제목 일부가 가려질 수 있습니다. 지도에는 조회 중·대체 경로 상태가 포함됩니다. 이번 가이드 작업에서 기능을 수정하지 않았습니다.</p><p>기존 사진 실험은 별도 분류했습니다. 철회된 저장/보관함 시안과 공통 부품의 임의 기본값은 기준으로 사용하지 않습니다.</p></section>
        </div>
        <p className="sg-footnote">화면 기록 2026.09.10 · 글자 적용 규칙 2026.09.13 · 상세 규격: docs/STYLE_GUIDE.md · 측정: artifacts/site-design-discovery.json, site-design-journeys.json, design-guide-current-qa/results.json(저장 원본 비교) · 로컬 개발용으로 공개 메뉴에 추가하지 않습니다.</p>
      </section>
    </div>
  </article>;
}

function SpecTable({ headings, rows }: { headings: string[]; rows: string[][] }) {
  return <div className="sg-table-wrap" tabIndex={0} aria-label={headings[0] + ' 규격 표 — 좁은 화면에서는 가로로 이동'}><table><thead><tr>{headings.map(heading => <th scope="col" key={heading}>{heading}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row[0]}>{row.map((cell, index) => index === 0 ? <th scope="row" key={index}>{cell}</th> : <td key={index}>{cell}</td>)}</tr>)}</tbody></table></div>;
}
