'use client';
import { useState } from 'react';

const FONT = 'var(--font-roboto-mono), var(--font-noto-sans-kr), "Courier New", monospace';

// 전자상거래법상 사업자 신원 정보 — 모든 페이지 하단 고정 노출 (접이식)
export default function Footer() {
  const [open, setOpen] = useState(false);

  return (
    <footer
      className="w-full max-w-[468.5px] mx-auto px-5 pt-1 pb-4 shrink-0"
      style={{ fontFamily: FONT, color: 'rgba(0,255,65,0.4)', fontSize: '10px', lineHeight: 1.6 }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'rgba(0,255,65,0.45)', fontFamily: FONT, fontSize: '10px', padding: 0,
        }}
      >
        ⓘ 코딩하는 마녀 · 사업자 정보 {open ? '▴' : '▾'}
      </button>

      {open && (
        <div style={{ marginTop: '6px', color: 'rgba(0,255,65,0.35)' }}>
          <div>상호명: 코딩하는 마녀</div>
          <div>대표자: 강산</div>
          <div>사업장 소재지: 서울특별시 강서구 강서로 231</div>
          <div>사업자등록번호: 328-69-00642</div>
          <div>통신판매업 신고번호: 추후등록</div>
          <div>
            고객센터:{' '}
            <a href="mailto:help@witchsterminal.dev" style={{ color: 'rgba(0,255,65,0.5)', textDecoration: 'underline' }}>
              help@witchsterminal.dev
            </a>
          </div>
        </div>
      )}
    </footer>
  );
}
