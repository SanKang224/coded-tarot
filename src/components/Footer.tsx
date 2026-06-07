const FONT = 'var(--font-roboto-mono), var(--font-noto-sans-kr), "Courier New", monospace';

// 전자상거래법(제10조)상 사업자 신원정보 — 모든 페이지 초기화면 하단에 항상 노출
export default function Footer() {
  return (
    <footer
      className="w-full max-w-[468.5px] mx-auto px-5 pt-1 pb-4 shrink-0 text-center"
      style={{ fontFamily: FONT, color: 'rgba(0,255,65,0.4)', fontSize: '10px', lineHeight: 1.7 }}
    >
      <div>상호: 코딩하는 마녀 | 대표자: 강산</div>
      <div>사업자등록번호: 328-69-00642 | 통신판매업신고번호: [발급 후 기재]</div>
      <div>주소: [이전 후 비상주 사무실 주소 기재]</div>
      <div>
        고객센터:{' '}
        <a href="mailto:help@witchsterminal.dev" style={{ color: 'rgba(0,255,65,0.5)', textDecoration: 'underline' }}>
          help@witchsterminal.dev
        </a>
      </div>
    </footer>
  );
}
