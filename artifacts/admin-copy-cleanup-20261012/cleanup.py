from pathlib import Path
root = Path(r'C:/Users/Giry/Documents/Spotlog')
changes = {}
def update(name, replacements):
    p=root/name
    s=p.read_text(encoding='utf-8')
    count=0
    for before, after in replacements:
        if before not in s:
            raise RuntimeError(f'Missing exact copy in {name}: {before[:150]}')
        count += s.count(before)
        s=s.replace(before,after)
    p.write_text(s, encoding='utf-8')
    changes[name]=count
update('web/src/admin/AIPage.tsx', [
    ("<Badge tone={mode === 'LOCAL' ? 'sample' : 'neutral'}>{mode === 'LOCAL' ? '로컬 검수' : '관리자 API'}</Badge>", ''),
    ("    <Notice>{mode === 'LOCAL' ? '맥미니 소형 LLM → 서버 검증·DB/RAG 검색·일정 계산 → 소형 설명 흐름의 운영 검수본입니다. 실제 모델·Flowise·RAG는 연결 전입니다. 아래 모의 작업을 실제 실행 결과로 표시하지 않습니다.' : '관리자 API 응답의 실행 상태와 버전을 표시합니다. 모의 실행이 포함된 응답은 로컬 모의 표시로 구분하고 실제 호출·시간·비용은 서버가 확인한 값만 표시합니다.'}</Notice>\n", ''),
    (" · 챗봇 고객 채널 준비 중", ''),
    ("mode === 'LOCAL' ? '로컬 색인 반영' : '색인 반영'", "'색인 반영'"),
    ("      <Notice>{mode === 'LOCAL' ? '각 작업은 ‘대기 → 로컬 실행 → 검증 대기 → 자료 검증 → 적용’ 순서로 조작합니다. 실제 임베딩 생성과 RAG 성능 시험은 서버 연결 후 수행합니다.' : '작업 상태는 관리자 API 응답을 따릅니다. 대기·실행·검증 완료와 적용 완료를 구분합니다.'}</Notice>\n", ''),
    ("<Badge tone={job.localSimulation ? 'sample' : 'neutral'}>{job.localSimulation ? '로컬 모의 작업' : '서버 작업'}</Badge>", ''),
    ("'로컬 실행 시작'", "'실행 시작'"),
    ("'서버 작업 실행'", "'실행 시작'"),
    ("<Badge tone={index.localSimulation ? 'sample' : 'neutral'}>{index.localSimulation ? '로컬 모의 색인' : '서버 색인'}</Badge>", ''),
    ("{index.localSimulation ? '로컬 적용' : '서버 적용'}", '적용'),
    ("합성 시험을 저장했습니다. 새 시험은 목록에서 선택해 실행하세요.", "시험 조건을 저장했습니다."),
    ("    <Notice>{mode === 'LOCAL' ? '이 화면은 명시된 조건과 공개 ID로 처리 계약을 검증하는 결정형 모의 시험입니다. 입력 문장의 의미 해석·LLM 품질·실제 이동 시간을 검증하지 않습니다.' : '운영자가 작성한 시험만 관리자 API로 실행합니다. 결과의 모의 실행 여부와 평가 상태를 확인하세요.'} 고객 요청문을 붙여 넣지 말고 운영자가 만든 예시를 사용하세요.</Notice>\n", ''),
    ("'새 합성 시험'", "'새 시험'"),
    ("label=\"운영자 작성 문장 · 실제 해석 시험 전\"", "label=\"시험 문장\" hint=\"고객 개인정보 없이 작성하세요.\""),
    ('description="고객 저장소에 접근하지 않는 로컬 계약 시험입니다. 정책·색인 버전을 선택해 같은 시험의 결과를 비교할 수 있습니다."', 'description="정책·색인 버전별 결과 비교"'),
    ("{mode === 'LOCAL' ? '로컬 계약 시험' : '운영자 품질 시험 실행'}", '시험 실행'),
    ('{mode === \'LOCAL\' && <button disabled title="LLM·RAG 서버 연결 후 활성화">실제 모델 품질 시험 · 연결 전</button>}', ''),
    ('description="공개 자료를 색인한 뒤 로컬 계약 시험을 실행하세요."', 'description="시험 조건을 저장하고 실행하세요."'),
    ('description="합성 시험 결과의 오류 유형과 운영자 평가만 보관합니다."', ''),
    ('<p>합성 다중 대화 시험에서 제안된 일정은 revision 7을 기준으로 계산합니다. 실제 고객의 찜·저장·수정 적용은 명시적 버튼 승인과 서버 최신 버전 검사를 거칩니다.</p>', ''),
    ('합성 대화 시험 선택', '대화 시험 선택'),
    ("<p className=\"admin-meta\">{session.role === 'ADMIN' ? '관리자도 고객 승인 없이 여행 저장·공개·삭제를 실행하지 않습니다.' : '운영자 합성 시험을 실행할 수 있습니다.'}</p>", ''),
    ("<Badge tone={result.localSimulation ? 'sample' : 'neutral'}>{result.localSimulation ? '결정형 모의 시험' : '서버 품질 시험'}</Badge>", ''),
    ("result.localSimulation ? '계약 통과' : '평가 통과'", "result.localSimulation ? '조건 통과' : '평가 통과'"),
    ('합성 예약 고정', '예약 고정'),
    ("{result.localSimulation ? '관광 안내 근거 · LLM 생성 전' : '관광 안내 공개 근거'}", '관광 안내 근거'),
    ("{message.role === 'USER' ? '운영자 합성 발화' : '합성 응답'}", "{message.role === 'USER' ? '시험 문장' : '응답'}"),
    ("    <Notice>{result.externalReason} · 실제 외부 호출 {result.externalCalls}회 · {result.localSimulation ? '실측 시간·비용 없음.' : '실측 시간·비용은 요청 요약에서 확인하세요.'} 고객 여행 저장 없음.</Notice>", "    <div className=\"admin-meta\">외부 호출 {result.externalCalls}회 · {result.externalReason}</div>"),
    ('<Notice>기본 운영 기록은 요청 식별자·단계·모델·오류·공용 근거·버전·시간·비용 요약입니다. 고객 요청문·대화 원문·개인 일정·메모를 수집하거나 표시하지 않습니다.</Notice>', ''),
    (" description={mode === 'LOCAL' ? '현재 목록은 운영자 합성 시험에서 생성된 로컬 메타데이터입니다. 실제 서비스 요청과 집계는 연결 전입니다.' : '서버가 반환한 실행 요약을 표시합니다. 합성·모의 시험은 실제 서비스 결과와 구분합니다.'}", ''),
    ("{request.localSimulation ? '합성·모의 시험' : '서버 실행'}", "{request.localSimulation ? '시험 기록' : '서비스 요청'}"),
    ("request.localSimulation ? '계약 통과' : '실행 성공'", "request.localSimulation ? '조건 통과' : '실행 성공'"),
    ("request.localSimulation ? '계약 실패·보류' : '실행 실패'", "request.localSimulation ? '조건 실패·보류' : '실행 실패'"),
    ("챗봇 고객 채널 · 후속 연결 전", "챗봇 · 준비 중"),
    ("{mode === 'LOCAL' ? '로컬 규칙 검수' : '정책 규칙 검수'}", '규칙 검증'),
])
update('web/src/admin/AdminApp.tsx', [
    ("{adapter.mode === 'LOCAL' ? '로컬 검수 환경' : '관리자 API 환경'}", "{adapter.mode === 'LOCAL' ? '로컬' : '서비스'}"),
    ("<p>{adapter.mode === 'LOCAL' ? '실제 고객 자료·공개 사이트와 분리' : '서버 권한으로 접근 검사'}</p>", ''),
    ('aria-label="검수용 작업자"', 'aria-label="작업자"'),
    ('aria-label="검수용 역할 전환"', 'aria-label="역할 전환"'),
    (" description={mode === 'LOCAL' ? '현재 기기의 관리자 검수 자료 · 실제 서비스 이용 지표와 구분' : '현재 담당·지역과 서비스 접수 자료 기준'}", ''),
    ("<span>{mode === 'LOCAL' ? '서버·AI는 연결 전 · 자료 등록과 검수는 로컬에서 진행 가능' : `연결 확인 ${connections.filter(connection => connection.status === 'CONNECTED').length} · 장애 ${connections.filter(connection => connection.status === 'FAILED' || connection.status === 'DEGRADED').length}`} </span>", "{mode === 'API' && <span>{`연결 확인 ${connections.filter(connection => connection.status === 'CONNECTED').length} · 장애 ${connections.filter(connection => connection.status === 'FAILED' || connection.status === 'DEGRADED').length}`}</span>}"),
])
update('web/src/admin/PlacesPage.tsx', [
    ("PUBLISHED: mode === 'LOCAL' ? '공개 검수본' : '공개'", "PUBLISHED: '공개'"),
    ('검수용 사진은 PNG/JPG/WebP/GIF, 2MB 이하만 보관할 수 있어요. 실제 원본 업로드는 서버 연결 후 제공돼요.', 'PNG/JPG/WebP/GIF, 2MB 이하 사진을 선택해 주세요.'),
    ('검수용 사진 파일을 읽지 못했어요. 입력은 유지했어요.', '사진 파일을 읽지 못했어요. 입력은 유지했어요.'),
    ("<Notice>{mode === 'LOCAL' ? '검수용 기기 보관입니다. ' : ''}실제 원본·썸네일 업로드 서버는 연결 전이에요. 사진별 사용 조건은 별도로 확인해 주세요.</Notice>", ''),
])
update('web/src/admin/OperationsPages.tsx', [
    ("{trip.sourceKind === 'PUBLIC_SAMPLE' && <Badge tone=\"info\">{trip.visibility === 'PRIVATE' ? '홈 추천 샘플 · 수정 초안' : '홈 추천 샘플 · 공개 수정본'}</Badge>}", ''),
    ('description="현재 시각과 대상의 공개·운영·권리 상태를 적용한 검수 결과입니다."', ''),
    ("'검수용 샘플 저장 수'", "'예시 집계'"),
    ("source === 'SAMPLE' ? '실제 회원 집계가 아닙니다. 로컬 게시 검수용입니다.' : '저장 수 기준 · 읽기 전용'", "'저장 수 기준 · 읽기 전용'"),
    ("<br /><span className=\"admin-muted\">{item.source === 'SAMPLE' ? '샘플 집계' : '서버 집계'}</span>", ''),
    (" description={props.mode === 'LOCAL' ? '저장한 설정은 로컬 검수본에만 반영됩니다.' : '검수한 노출 설정을 서비스에 저장합니다.'}", ''),
    ('<Notice>로컬 규칙 초안 · 실제 AI 연결 없이 공개 등록 장소의 소개와 위치를 사용합니다. 요청한 음식점·카페·숙소 자료가 없으면 배치하지 않습니다.</Notice>', ''),
    ('<Badge tone="info">로컬 규칙으로 구성한 초안</Badge>', ''),
    ("<Notice>{props.mode === 'LOCAL' ? '샘플 공개 여행기·댓글로 조치를 검수합니다. ' : '서비스의 공개 콘텐츠와 접수된 신고를 확인합니다. '}전체 여행기의 소통과 장소 카드의 소통은 각각 관리합니다.</Notice>", ''),
    ('로컬 신고 접수 · 서버 전송 미연결', '접수 기록'),
    ("<Badge>{member.source === 'SAMPLE' ? '로컬 검수 반응' : '서버 공개 반응'}</Badge>", ''),
    ("<Badge tone=\"info\">{journal.sourceKind === 'EDITORIAL' ? '운영 추천 여행기' : journal.sourceKind === 'SYNTHETIC' ? '합성 검수 샘플' : journal.sourceKind === 'PUBLIC_SAMPLE' ? '고객 공개 샘플' : '공개 여행기'}</Badge>", "<Badge tone=\"info\">{journal.sourceKind === 'EDITORIAL' ? '운영 추천 여행기' : '여행기'}</Badge>"),
    ("' · 샘플 수치'", "' · 예시 집계'"),
    ('로컬 검수 반응 · 실제 사용자 서버 집계가 아닙니다.', '예시 집계'),
    ('로컬 검수 샘플 · 실제 사용자 집계가 아닙니다.', '예시 집계'),
    (" description={props.mode === 'LOCAL' ? '로컬 검수용 역할과 세션입니다. 실제 권한 검사와 인증은 서비스 서버에서 수행해야 합니다.' : '서비스 운영자 역할과 세션입니다. 변경 권한은 서비스 서버에서 검사합니다.'}", ''),
    ("<p className=\"admin-muted\">{props.mode === 'LOCAL' ? '활성 검수 계정을 등록해 장소 담당자로 지정할 수 있습니다. 실제 로그인·초대는 미연결입니다.' : '계정 등록 결과를 확인합니다. 로그인 초대 발송은 별도 연결이 필요합니다.'}</p>", ''),
    ("session.status === 'ACTIVE' ? (props.mode === 'LOCAL' ? '샘플 활성 세션' : '활성 세션') : (props.mode === 'LOCAL' ? '샘플 종료 세션' : '종료 세션')", "session.status === 'ACTIVE' ? '활성 세션' : '종료 세션'"),
    ("{props.mode === 'LOCAL' ? '세션 종료 검수' : '세션 종료'}", '세션 종료'),
    (" description={props.mode === 'LOCAL' ? '재시도는 조건 검수 결과를 기록합니다. 실제 발송 상태로 표시하지 않습니다.' : '재시도 검수 결과와 실제 발송 상태를 구분해 확인합니다.'}", ''),
    ("(props.mode === 'LOCAL' ? '샘플 실패' : '발송 실패')", "'발송 실패'"),
    ("(props.mode === 'LOCAL' ? '샘플 실패' : '수급 실패')", "'수급 실패'"),
    ("(props.mode === 'LOCAL' ? '비공개 복원 검수' : '비공개 복원 완료')", "'비공개 복원'"),
    ("{props.mode === 'LOCAL' ? '샘플 비공개 복원' : '비공개 복원'}", '비공개 복원'),
    (" description={props.mode === 'LOCAL' ? '사진을 공유하는 다른 기록이 있으면 정리 대상을 확정할 수 없습니다. 실제 파일 삭제는 미연결입니다.' : '사진을 공유하는 다른 기록이 있으면 정리 대상을 확정할 수 없습니다. 검수 완료와 실제 파일 삭제 결과는 각각 확인합니다.'}", ' description="다른 기록에서 사용 중인 사진은 정리할 수 없습니다."'),
])
print(changes)
