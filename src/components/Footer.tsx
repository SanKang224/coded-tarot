'use client';

const FONT = 'var(--font-roboto-mono), var(--font-noto-sans-kr), "Courier New", monospace';
const GRAY = 'rgba(255,255,255,0.34)';
const GRAY_LINK = 'rgba(255,255,255,0.5)';

// 법적 고지 링크 클릭 → Terminal이 듣고 문서를 출력 (페이지 이동 없이 터미널 안에서)
function openLegal(kind: 'terms' | 'privacy' | 'refund') {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('witch-legal', { detail: kind }));
  }
}

const linkStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  padding: 0,
  margin: 0,
  fontFamily: FONT,
  fontSize: '9px',
  color: GRAY_LINK,
  textDecoration: 'underline',
  cursor: 'pointer',
  textAlign: 'right',
  lineHeight: 1.7,
};

// 전자상거래법상 사업자 신원정보 — 모든 페이지 초기화면 하단에 항상 노출
export default function Footer() {
  return (
    <footer
      className="w-full max-w-[468.5px] mx-auto px-5 pt-1 pb-4 shrink-0"
      style={{ fontFamily: FONT, color: GRAY, fontSize: '9px', lineHeight: 1.6 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
        {/* 좌: 사업자 정보 */}
        <div style={{ textAlign: 'left', flex: 1, minWidth: 0 }}>
          <div>상호: 코딩하는 마녀 | 대표자: 강산</div>
          <div>사업자등록번호: 328-69-00642</div>
          <div>통신판매업신고번호: [발급 후 기재]</div>
          <div>주소: 인천 서구 미래로 11, 1126-S8호 (22755) (운영시간: [평일 00:00–00:00])</div>
          <div>호스팅 제공: Vercel Inc.   |   결제대행: 토스페이먼츠(주)<div>
          <div>
          
            고객센터:{' '}
            <a href="mailto:help@witchsterminal.dev" style={{ color: GRAY_LINK, textDecoration: 'underline' }}>
              help@witchsterminal.dev
            </a>
          </div>
        </div>
        {/* 우: 약관·방침·정책 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px', whiteSpace: 'nowrap', flexShrink: 0 }}>
          <button onClick={() => openLegal('terms')} style={linkStyle}>서비스 이용약관</button>
          <button onClick={() => openLegal('privacy')} style={linkStyle}>개인정보처리방침</button>
          <button onClick={() => openLegal('refund')} style={linkStyle}>청약철회정책</button>
        </div>
      </div>
    </footer>
  );
}
