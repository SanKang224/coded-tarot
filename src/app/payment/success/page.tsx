'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

const FONT = '"Courier New", monospace';

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const paymentKey = searchParams.get('paymentKey');
    const orderId    = searchParams.get('orderId');
    const amount     = searchParams.get('amount');

    if (!paymentKey || !orderId || !amount) {
      setStatus('error');
      setMessage('결제 파라미터가 올바르지 않다.');
      return;
    }

    fetch('/api/payments/toss/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentKey, orderId, amount: parseInt(amount, 10) }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setStatus('error');
          setMessage(`결제 확인 실패: ${data.error}`);
        } else {
          setStatus('ok');
          setMessage(`✦ ${data.tokensAdded}토큰 충전 완료. 잔액: ${data.balance}토큰`);
          // 2초 후 터미널로 복귀
          setTimeout(() => router.push('/'), 2000);
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('서버 오류. 문의하라.');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusColor = status === 'ok' ? '#00FF41' : status === 'error' ? '#FF3300' : 'rgba(0,255,65,0.6)';

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
          [CODED-TAROT_OS v0.78] — PAYMENT
        </div>

        {status === 'loading' && (
          <>
            <div style={{ marginBottom: '12px' }}>■ 결제 확인 중...</div>
            <div style={{ color: 'rgba(0,255,65,0.4)', fontSize: '12px' }}>
              잠시만 기다려라.
            </div>
          </>
        )}

        {status !== 'loading' && (
          <>
            <div style={{ color: statusColor, marginBottom: '12px', fontSize: '15px' }}>
              {message}
            </div>
            {status === 'ok' && (
              <div style={{ color: 'rgba(0,255,65,0.4)', fontSize: '12px' }}>
                터미널로 돌아간다...
              </div>
            )}
            {status === 'error' && (
              <button
                onClick={() => router.push('/')}
                style={{
                  marginTop: '16px',
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
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100dvh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00FF41', fontFamily: '"Courier New", monospace' }}>
        처리 중...
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
