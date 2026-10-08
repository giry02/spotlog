/** Review drafts, not published legal documents or proof of a customer's consent. */
export type PolicyId = 'terms' | 'privacy' | 'collection' | 'location' | 'marketing';
export interface PolicySection { heading: string; paragraphs: string[]; points?: string[] }
export interface PolicyDocument { id: PolicyId; title: string; version: string; sections: PolicySection[] }
export interface PolicyBundle {
  status: 'DRAFT' | 'PUBLISHED';
  operator: { name: string; address: string; email: string };
  minimumAge: number;
  documents: PolicyDocument[];
  locationEnabled: boolean;
}
const version = '2026-10-08.draft-2';
export const draftPolicies: PolicyBundle = {
  status: 'DRAFT', operator: { name: '미정', address: '미정', email: '미정' }, minimumAge: 14, locationEnabled: false,
  documents: [
    { id: 'terms', title: '서비스 이용약관', version, sections: [
      { heading: '1. 서비스와 운영 주체', paragraphs: ['Spotlog는 장소 발견, 찜, 여행 일정 생성·수정, 여행기와 댓글 공유 기능을 제공하는 여행 서비스입니다.', '운영자명·주소·문의 이메일은 현재 미정입니다. 이 문서는 검수 초안이며 정식 시행 전 운영 주체와 시행일을 확정합니다.'] },
      { heading: '2. 가입과 계정 이용', paragraphs: ['이메일·비밀번호로 일반 가입하고 이메일 인증을 완료하거나 Google·Apple 인증으로 가입할 수 있습니다. 최초 가입 시 필수 약관과 개인정보 항목을 확인합니다. 이미 가입한 고객은 유효한 동의와 계정 상태가 확인되면 바로 이용합니다.', '초기 검수안은 만 14세 이상 가입을 기준으로 합니다. 서비스 국가별 가입 연령과 아동·보호자 절차는 출시 전 확정하며, 미성년자 가입을 지원한다는 의미는 아닙니다.'], points: ['타인의 계정을 이용하거나 허위 권한으로 가입하지 않습니다.', '이메일·소셜 인증은 해당 계정의 이용자를 확인하는 방식이며 실명 본인인증과는 구분합니다.'] },
      { heading: '3. 여행과 AI 추천', paragraphs: ['AI가 제안하는 일정과 업체 정보는 확인·수정 가능한 초안입니다. 실제 영업시간, 휴무, 가격, 이동 여건은 방문 전에 확인해 주세요.', '일정 저장·변경 적용·여행기 공개는 고객의 명시적인 조작으로 확정합니다. 숙소 예약 고정은 일정 보호 표시이며 실제 예약·결제 완료를 뜻하지 않습니다.'] },
      { heading: '4. 작성 자료와 공개 범위', paragraphs: ['고객이 작성한 글·사진의 권리는 작성자 또는 정당한 권리자에게 있습니다. 고객은 업로드할 권한이 있는 자료만 등록해야 합니다.', '서비스는 고객이 선택한 공개 범위 안에서 자료를 보관·표시합니다. 개인 일정·메모·대화 원문을 공용 장소 자료나 RAG로 자동 편입하지 않습니다.', '다른 사람이 복사한 일정은 독립된 기록입니다. 공개 철회·삭제 시 기존 복사본과 사진 참조 처리 범위를 안내합니다.'] },
      { heading: '5. 커뮤니티와 운영 조치', paragraphs: ['괴롭힘, 불법 내용, 개인정보 무단 공개, 저작권 침해와 스팸은 제한합니다. 신고 대상과 문맥을 확인한 뒤 숨김·정지 등 필요한 조치를 하고 이의를 접수합니다.', '운영 조치와 고객의 자발적인 삭제·비공개는 구분합니다. 운영자 숨김 해제로 고객이 삭제하거나 비공개로 바꾼 자료를 다시 공개하지 않습니다.'] },
      { heading: '6. 탈퇴·삭제·휴지통', paragraphs: ['탈퇴와 삭제 요청은 계정 설정 또는 확정된 문의 채널에서 처리합니다. 법적 보존 의무가 있는 항목은 일반 서비스 자료와 분리합니다.', '고객 휴지통은 한국 시각 기준 달력 6개월의 복원 기간을 적용하는 검수안입니다. 복원 자료는 비공개이며, 이 기간이 회원 개인정보 전체의 보관 기간을 뜻하지 않습니다.'] },
      { heading: '7. 안내·변경·문의', paragraphs: ['중요한 약관이나 개인정보 처리 변경은 시행 전에 알리고, 새로운 동의가 필요한 변경은 다시 확인합니다. 운영자와 문의 채널은 공개 전에 기재합니다.', '이 약관은 법령상 고객의 권리를 배제하거나 사업자의 책임을 일괄 면제하지 않습니다.'] },
    ] },
    { id: 'collection', title: '개인정보 수집·이용 동의', version, sections: [
      { heading: '수집 목적', paragraphs: ['회원 식별과 로그인 유지, 회원별 찜·여행 저장 및 조회, 여행기·댓글 작성, 계정 보호와 고객 요청 처리를 위해 사용합니다.'] },
      { heading: '수집 항목', paragraphs: ['가입 방식(이메일·Google·Apple), 소셜 제공자의 계정 식별값, 서비스 회원 ID, 활동 이름, 제공되거나 고객이 등록한 이메일과 확인 상태, 필수 약관의 버전·동의 일시입니다. 일반 가입의 비밀번호는 서버에서 검증된 해시로 보관하며 원문을 저장하거나 관리자에게 제공하지 않습니다.', 'Apple의 비공개 이메일도 사용할 수 있습니다. 이메일이 제공되지 않는 경우의 가입·연락 처리 기준은 서버에서 적용합니다. 실명·전화번호·생년월일·집 주소는 초기 가입 필수 항목으로 수집하지 않습니다.'] },
      { heading: '보유·이용 기간', paragraphs: ['회원 정보는 탈퇴 또는 처리 목적 달성 시 파기하는 것을 기준으로 하며, 법령상 보존이 필요한 자료는 근거·항목·기간을 구분해 안내합니다.', '로그인·보안·동의 증빙 로그의 세부 보존 기간과 삭제·백업 정리 일정은 실제 서버 구성 후 공개 전 확정합니다. 고객 휴지통 6개월을 모든 개인정보에 일괄 적용하지 않습니다.'] },
      { heading: '동의 거부와 이용 범위', paragraphs: ['동의를 거부할 수 있습니다. 회원 식별과 개인 자료 저장을 위한 필수 항목에 동의하지 않으면 회원 가입은 진행할 수 없지만 공개 장소·여행기 둘러보기는 이용할 수 있습니다.', '위치 정보·마케팅 수신 등 선택 동의를 거부해도 가입과 기본 여행 기능을 이용할 수 있습니다.'] },
    ] },
    { id: 'privacy', title: '개인정보 처리방침', version, sections: [
      { heading: '1. 현재 검수본과 실제 서비스 구분', paragraphs: ['현재 검수본의 여행·프로필·댓글은 이 기기의 저장소에 보관됩니다. 실제 회원 인증·기기 간 동기화·위치 수집은 연결 전입니다.', '이 문서는 실제 서비스에 연결할 개인정보 처리 기준의 초안입니다. 운영자, 처리업체, 저장 국가와 보존 기간이 확정되기 전에는 정식 방침으로 시행하지 않습니다.'] },
      { heading: '2. 회원과 서비스 이용 자료', paragraphs: ['회원 가입 항목은 별도의 개인정보 수집·이용 동의에서 확인합니다. 서비스 이용 중에는 고객이 저장한 찜·개인 여행·공개 여행기·댓글·신고·문의가 기능별로 처리됩니다.', '사진·활동 이름은 고객이 선택하여 등록합니다. 접속·보안 로그, 알림 기기 정보 등은 실제 사용하는 항목과 기간을 확정하여 추가 안내합니다.'] },
      { heading: '3. 개인 정보와 공개 자료', paragraphs: ['개인 일정·메모는 기본 비공개로 보관합니다. 여행기와 댓글은 고객이 공개를 선택한 범위에서 다른 고객에게 표시됩니다.', '관리자 기본 목록에는 개인 일정·메모·예약 본문이나 AI 요청·대화 원문을 자동 제공하지 않습니다. 공개 자료와 운영에 필요한 요약·오류·조치 이력을 구분합니다.'] },
      { heading: '4. AI 처리와 검색 자료', paragraphs: ['공용 RAG에는 사용 권한과 검수를 확인한 장소 설명만 사용합니다. 고객의 개인 일정·사진·대화는 공용 검색 자료로 자동 전환하지 않습니다.', '간단 생성에 입력한 문장은 해당 요청 처리에 사용하며 불필요한 개인 정보 입력을 요구하지 않습니다. 외부 대형 AI로 보완할 때의 업체·항목·국가·기간·법적 근거와 필요한 절차는 실제 연결 전에 별도로 확정합니다.'] },
      { heading: '5. 위치 정보', paragraphs: ['향후 내 위치 주변의 장소·식당·숙소 검색과 이동 안내를 위해 현재 위치를 선택적으로 사용합니다. 고객이 직접 선택한 여행 지역이나 장소 좌표는 기기의 GPS 좌표와 구분합니다.', '위치 기능을 선택한 때 이용 목적·항목·기간을 먼저 안내하고 위치 이용 동의와 브라우저·OS 권한을 각각 확인합니다. 가입 시 위치 권한을 강제하지 않습니다. 상세 내용은 위치기반서비스 이용약관에서 확인합니다.'] },
      { heading: '6. 외부 연결·위탁·국외 처리', paragraphs: ['Google·Apple 인증, 외부 지도·길찾기, 사진 보관·메일·알림과 외부 AI 연결은 각각 필요한 정보와 처리 주체를 구분합니다.', '외부 길찾기에는 선택한 목적지 이름·좌표를 전달합니다. 기기 현재 위치를 당사 서버나 지도 서비스에 전송하는 기능은 별도의 위치 안내 범위에서 설계합니다.', '실제 수탁업체, 제3자 제공 여부, 저장·처리 국가와 이전 조건은 미정입니다. 단순히 외부 서비스를 사용한다는 이유로 모든 처리를 제3자 제공 동의 하나에 묶지 않습니다.'] },
      { heading: '7. 보관·파기·안전한 관리', paragraphs: ['목적을 달성한 개인 정보는 파기하고 법적 보존 자료는 접근을 제한해 분리합니다. 휴지통 자료·공유 사진의 참조·백업 삭제는 각각 처리 상태를 관리합니다.', '인증 비밀키와 제공자 토큰은 서버에서 관리합니다. 프론트에 비밀번호·비밀키를 보관하지 않습니다. 접근 권한·암호화·로그·침해 대응의 실제 운영 정책은 서버 구축 단계에 확정합니다.'] },
      { heading: '8. 고객의 권리와 문의', paragraphs: ['고객은 계정·선택 동의 변경, 열람·정정·삭제·처리 정지 요청을 할 수 있습니다. 위치 동의 철회와 OS 권한 철회는 각각 안내합니다.', '운영자명·주소·개인정보 문의 이메일은 미정입니다. 처리 요청 경로와 담당자를 공개 전에 기재합니다.'] },
    ] },
    { id: 'location', title: '위치기반서비스 이용약관', version, sections: [
      { heading: '이용하는 기능', paragraphs: ['향후 고객의 현재 위치에서 가까운 장소·음식점·카페·숙소를 찾고 거리와 이동 안내를 제공하는 데 사용합니다. 위치 권한 없이도 지역·주소를 직접 선택할 수 있습니다.', '현재는 위치 수집 미연결 상태입니다. 이 약관을 열거나 가입 동의를 체크하는 것만으로 GPS를 수집하지 않습니다.'] },
      { heading: '사용할 위치 정보', paragraphs: ['고객이 기능을 실행한 시점에 브라우저·OS가 제공한 위도·경도·정확도·측정 시각을 필요한 범위에서 사용합니다. 현재 위치 기능의 검수안은 1회 조회이며 지속 추적이나 백그라운드 수집을 포함하지 않습니다.', '사진의 위치 메타데이터, IP를 이용한 위치 추정, 지속 방문 이력 수집은 별도 목적·기준을 확정하지 않는 한 포함하지 않습니다.'] },
      { heading: '동의와 기기 권한', paragraphs: ['내 위치 기능 선택 → 목적과 약관 확인 → 선택 동의 → 브라우저·OS 권한 요청 → 해당 기능 실행 순서입니다. 선택 동의와 기기 권한은 별개로 확인합니다.', '동의 거부·권한 거부·시간 초과 시 직접 지역 선택으로 돌아갈 수 있습니다. 기능 이용 시의 동의 버전·목적을 확인하고 변경이 있으면 다시 안내합니다.'] },
      { heading: '전송·보관·제공 범위', paragraphs: ['원시 좌표는 해당 기능을 처리하는 동안 필요한 범위에서 사용하고 상시 이동 기록으로 저장하지 않는 방향으로 설계합니다. 정확한 서버 전송 범위, 지도·경로 제공자, 파기 시점은 실제 연결 전에 확정합니다.', '위치 정보 이용·제공사실 확인자료는 실제 사업 형태에 적용되는 법적 근거와 보존 기간을 따로 확정합니다. 원시 GPS와 확인자료의 보관 기간을 동일하게 취급하지 않습니다.', '개인위치정보를 제3자에게 제공하는 기능은 수신자·목적·항목·통지 방법과 필요한 별도 동의가 준비된 뒤 제공합니다.'] },
      { heading: '철회·권리·운영 주체', paragraphs: ['고객은 위치 이용 동의를 철회하거나 이용을 일시 중지할 수 있고 관련 자료의 열람·정정을 요청할 수 있습니다. 브라우저·OS 설정에서도 위치 권한을 취소할 수 있습니다.', '서비스 운영자명·주소·연락처와 적용되는 신고·등록·위치정보 보호 담당 기준은 공개 전에 확정합니다. 이 초안은 실제 수집 동의를 대체하지 않습니다.'] },
    ] },
    { id: 'marketing', title: '혜택·소식 수신 동의', version, sections: [
      { heading: '선택 목적과 항목', paragraphs: ['서비스의 새로운 기능·여행 콘텐츠·혜택 소식을 이메일로 받는 선택 항목입니다. 발송에 필요한 회원 식별값·등록 이메일·수신 동의 상태를 사용합니다.'] },
      { heading: '기간·철회·거부', paragraphs: ['수신 동의 철회 또는 탈퇴 시까지 사용하며 계정 설정과 발송 메시지의 수신 거부 경로로 철회할 수 있습니다. 거부해도 기본 서비스를 이용할 수 있습니다.', '필수 약관만 동의 버튼은 이 항목을 체크하지 않습니다. 서비스 장애·보안 등 필수 안내와 홍보 메시지를 구분합니다. 실제 발송 연결 전에는 메시지를 보내지 않습니다.'] },
    ] },
  ],
};
export const policyDocument = (bundle: PolicyBundle, id: PolicyId) => bundle.documents.find(d => d.id === id)!;
export interface SignupChoices { terms: boolean; collection: boolean; age: boolean; marketing: boolean }
export const emptySignupChoices = (): SignupChoices => ({ terms: false, collection: false, age: false, marketing: false });
export const requiredSignupAccepted = (v: SignupChoices) => v.terms && v.collection && v.age;
export function signupConsentPayload(bundle: PolicyBundle, choices: SignupChoices) {
  if (bundle.status !== 'PUBLISHED' || !requiredSignupAccepted(choices) || Object.values(bundle.operator).some(v => !v.trim() || v === '미정') || bundle.documents.some(d => /draft/i.test(d.version))) throw new Error('consent-not-ready');
  return { versions: { terms: policyDocument(bundle, 'terms').version, collection: policyDocument(bundle, 'collection').version },
    accepted: { terms: true as const, collection: true as const, age: true as const, minimumAge: bundle.minimumAge },
    marketing: { accepted: choices.marketing, version: policyDocument(bundle, 'marketing').version } };
}
