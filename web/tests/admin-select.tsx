import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AdminSelect, Field } from '../src/admin/components';
import '../src/admin/admin.css';
function Fixture() {
  const [region,setRegion]=useState(''),[kind,setKind]=useState('LANDMARK');
  return <div className="admin-app"><main className="admin-main"><section className="admin-panel" style={{maxWidth:1000}}><Field label="작업 지역"><select value={region} onChange={event=>setRegion(event.target.value)}><option value="">전체 지역</option>{Array.from({length:40},(_,index)=><option key={index} value={'region-'+index}>{index===24?'부산 · 해운대':'지역 '+index}</option>)}</select></Field><output aria-label="선택 결과">{region||'ALL'}</output><Field label="종류"><select value={kind} onChange={event=>setKind(event.target.value)}><option value="LANDMARK">랜드마크</option><option value="FOOD">음식점</option><option value="STAY" disabled>숙소</option><option value="CAFE">카페</option></select></Field><fieldset disabled><Field label="권한 없는 설정"><select><option>최고관리자 전용</option></select></Field></fieldset><div style={{height:800}}/><Field label="화면 하단 선택"><select><option>첫 항목</option><option>두 번째 항목</option></select></Field><AdminSelect aria-label="준비 안 된 설정" disabled><option>비활성 설정</option></AdminSelect></section></main></div>;
}
createRoot(document.getElementById('root')!).render(import.meta.env.DEV?<Fixture/>:null);
