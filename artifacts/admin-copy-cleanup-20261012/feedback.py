from pathlib import Path
root=Path(r'C:/Users/Giry/Documents/Spotlog')
replacements={
'web/src/admin/domain.ts': [('관리자 검수본에 공개했어요. 실제 서비스에는 반영되지 않아요.', '공개 설정을 저장했어요.')],
'web/src/admin/aiDomain.ts': [
('로컬 색인 작업을 대기에 추가했어요. 실제 RAG 작업은 연결 전이에요.', '색인 작업을 대기에 추가했어요.'),
('로컬 실패 시나리오를 기록했어요. 현재 적용 색인은 유지해요.', '실패 상태를 기록했어요. 현재 색인은 유지해요.'),
('로컬 실행 단계로 이동했어요.', '실행 단계로 이동했어요.'),
('로컬 작업이 검증 대기에 들어갔어요.', '검증 대기에 들어갔어요.'),
('현재 공개 자료로 로컬 작업을 다시 준비했어요. 실행과 자료 검증을 다시 진행해 주세요.', '현재 공개 자료로 작업을 다시 준비했어요.'),
('로컬 자료·사용권·버전 검증을 통과했어요.', '자료·사용권·버전 검증을 통과했어요.'),
('이전 로컬 색인으로 복구했어요. 철회·폐업·원문 변경 자료는 계속 제외해요.', '이전 색인 설정으로 복구했어요.'),
('검증한 로컬 색인을 적용했어요. 실제 RAG는 연결 전이에요.', '검증한 색인 설정을 적용했어요.'),
('로컬 계약 시험 ${result.outcome', '시험 결과: ${result.outcome'),
(' · LLM 호출·고객 여행 저장 없음`', '`'),
('로컬 정책 규칙 검수를 통과했어요. 실제 모델 품질 검수는 연결 후 필요해요.', '정책 규칙 검증을 통과했어요.'),
('이전 로컬 정책으로 복구했어요.', '이전 정책 설정으로 복구했어요.'),
('검수한 로컬 정책을 적용했어요. 실제 모델 연결 전이에요.', '검증한 정책 설정을 적용했어요.'),
],
'web/src/admin/opsDomain.ts': [
('운영 추천 여행기의 공개 검수본을 저장했습니다.', '운영 추천 여행기의 공개 설정을 저장했습니다.'),
('샘플 세션 종료를 기록했습니다. 실제 인증 서버는 미연결입니다.', '세션 종료 상태를 저장했습니다.'),
('샘플 기록을 비공개로 복원했습니다. 연결된 개인 일정·여행기는 각각 유지됩니다.', '비공개 복원 상태를 저장했습니다.'),
('참조 없는 샘플 파일을 정리 대상으로 검수했습니다. 실제 파일은 삭제하지 않았습니다.', '참조 없는 파일을 정리 대상으로 지정했습니다.'),
]}
for name,pairs in replacements.items():
 p=root/name;s=p.read_text(encoding='utf-8')
 for a,b in pairs:
  if a not in s: raise RuntimeError(f'Missing {name}: {a}')
  s=s.replace(a,b)
 p.write_text(s,encoding='utf-8')
selectors={'검수본 공개':'공개','로컬 실행 시작':'실행 시작','로컬 적용':'적용','로컬 계약 시험':'시험 실행','샘플 비공개 복원':'비공개 복원','검수용 역할 전환':'역할 전환','검수용 작업자':'작업자','운영자 작성 문장 · 실제 해석 시험 전':'시험 문장','검수용 샘플 저장 수':'예시 집계'}
for p in (root/'web/tests').glob('admin*Browser.cjs'):
 s=p.read_text(encoding='utf-8');old=s
 for a,b in selectors.items(): s=s.replace(a,b)
 if p.name=='adminOperationsBrowser.cjs':
  s=s.replace("assert.ok((await topJournal.innerText()).includes('샘플 집계'));", "await expect(active(page).getByText('예시 집계',{exact:true})).toBeVisible();")
 if s!=old:p.write_text(s,encoding='utf-8')
print('Admin feedback and exact browser selectors updated')
