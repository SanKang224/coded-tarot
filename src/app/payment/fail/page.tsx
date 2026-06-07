'use client';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { Suspense } from 'react';

const FONT = '"Courier New", monospace';

function FailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const code    = searchParams.get('code') ?? 'UNKNOWN';
  const message = searchParams.get('message') ?? '결제가 실패하였다.';

  return (
    <div style={{
      minHeight: '100dvh', background: '#000',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: FONT, padding: '24px',
    }}>
      <div style={{
        border: '1px solid #00FF41',
        padding: '32px 28px',
        maxWidth: '400px',
        width: '100%',
        color: '#00FF41',
      }}>
        <div style={{ marginBottom: '16px', fontSize: '11px', opacity: 0.4 }}>
          [CODED-TAROT_OS v0.78] — PAYMENT FAILED
        </div>

        <div style={{ color: '#FF3300', marginBottom: '12px', fontSize: '15px' }}>
          ■ 결제 실패
        </div>
        <div style={{ color: 'rgba(0,255,65,0.6)', fontSize: '13px', marginBottom: '8px' }}>
          {message}
        </div>
        <div style={{ color: 'rgba(0,255,65,0.3)', fontSize: '11px', marginBottom: '24px' }}>
          코드: {code}
        </div>

        <button
          onClick={() => router.push('/')}
          style={{
            background: 'transparent',
            border: '1px solid #00FF41',
            color: '#00FF41',
            padding: '10px 20px',
            fontFamily: FONT,
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          터미널로 돌아가라
        </button>
      </div>
    </div>
  );
}

export default function PaymentFailPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100dvh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00FF41', fontFamily: '"Courier New", monospace' }}>
        처리 중...
      </div>
    }>
      <FailContent />
    </Suspense>
  );
}
